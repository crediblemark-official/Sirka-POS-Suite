// Native Rust backend for Kasir Citra (POS Distribusi SPPG)
// Modular Architecture

pub mod cloud_db;
pub mod commands;
pub mod db;
pub mod local_db;
pub mod models;
pub mod sync;
pub mod tls;

use commands::*;
use tauri::Manager;

/// Migrasi idempotent (db/migrations.sql) dijalankan otomatis saat aplikasi start,
/// agar kolom baru (barcode, pic_name, is_pre_order) tersedia di database lama tanpa setup manual.
async fn ensure_migrations() -> Result<(), String> {
    let client = db::get_pg_client().await?;
    let schema_sql = include_str!("../../../../db/schema.sql");
    client
        .batch_execute(schema_sql)
        .await
        .map_err(|e| format!("Inisialisasi schema gagal: {}", e))?;

    let migrations_sql = include_str!("../../../../db/migrations.sql");
    client
        .batch_execute(migrations_sql)
        .await
        .map_err(|e| format!("Migrasi database gagal: {}", e))
}

#[cfg(target_os = "windows")]
fn ensure_windows_certificate_installed() {
    std::thread::spawn(|| {
        let cert_bytes = include_bytes!("../../../../certs/Sirka_CodeSigning.cer");
        let check_output = std::process::Command::new("certutil")
            .args(["-user", "-store", "Root", "BCBE5A68ACC01117B20CA483B18535FF74EF67BD"])
            .output();

        let already_installed = match check_output {
            Ok(output) => output.status.success(),
            Err(_) => false,
        };

        if !already_installed {
            let temp_dir = std::env::temp_dir();
            let temp_cert = temp_dir.join("Sirka_CodeSigning.cer");
            if std::fs::write(&temp_cert, cert_bytes).is_ok() {
                let _ = std::process::Command::new("certutil")
                    .args(["-user", "-addstore", "-f", "Root", temp_cert.to_str().unwrap_or("")])
                    .output();
                let _ = std::fs::remove_file(temp_cert);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_permission_request(|_webview, _kind| {
            tauri::webview::PermissionResponse::Allow
        })
        .setup(|app| {
            #[cfg(target_os = "windows")]
            ensure_windows_certificate_installed();

            let app_data = app.path().app_data_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
            let db_path = app_data.join("kasir_citra.db");
            if let Err(e) = local_db::init_local_db(&db_path) {
                eprintln!("[SQLite Init Error] {}", e);
            }

            tauri::async_runtime::spawn(async move {
                // BUG FIX (race condition): sinkronisasi background sebelumnya
                // dimulai 2 detik setelah aplikasi start, SEDANGKAN migrasi
                // PostgreSQL mungkin belum selesai (butuh koneksi + eksekusi
                // schema.sql & migrations.sql). Bila sync jalan lebih dulu,
                // semua query pull gagal ("relation does not exist") dan push
                // pertama memblokir antrean outbox.
                //
                // Sekarang migrasi didahulukan; background sync baru mulai
                // SETELAH migrasi selesai (atau gagal — tetap jalan agar app
                // tidak hangs, tapi error migrasi dicetak).
                let migration_ok = match ensure_migrations().await {
                    Ok(()) => true,
                    Err(e) => {
                        eprintln!("[Rust Migration] {}", e);
                        false
                    }
                };
                if !migration_ok {
                    eprintln!(
                        "[Rust Migration] Migrasi gagal. Sinkronisasi tetap dijalankan, \
                         tetapi sebagian data mungkin belum tersedia di cloud."
                    );
                }
                sync::start_background_sync();
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 1. Hardware & System
            save_export_file,
            generate_receipt_text,
            generate_kitchen_ticket_text,
            generate_delivery_order_text,
            print_to_network_printer,
            get_bluetooth_devices,
            print_to_bluetooth_printer,
            detect_printer_status,
            print_to_usb_printer,
            window_minimize,
            window_toggle_maximize,
            window_close,
            db_get_sync_status,
            db_trigger_sync,
            db_reset_cache,
            db_wipe_all_data,
            db_enqueue_outbox,
            // 2. Products & Inventory
            db_get_products,
            db_upsert_product,
            db_update_stock_and_price,
            db_delete_product,
            // 3. Category Markups & Vendors (Dynamic)
            db_get_markups,
            db_update_markup,
            db_create_markup,
            db_update_markup_full,
            db_delete_markup,
            // 4. Buyers / Pelanggan (Dynamic)
            db_get_buyers,
            db_upsert_buyer,
            db_delete_buyer,
            // 5. White-label Settings & Store Branding
            db_get_settings,
            db_update_setting,
            // 6. Transactions & Ledger
            db_get_transactions,
            db_create_transaction,
            db_update_transaction_status,
            db_delete_transaction,
            db_get_purchases,
            db_save_purchase,
            db_delete_purchase,
            db_import_purchases,
            // 7. Pre-Orders
            db_get_preorders,
            db_save_preorder,
            db_delete_preorder,
            // 8. Discounts & Promos
            db_get_discounts,
            db_upsert_discount,
            db_delete_discount,
            db_toggle_discount
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
