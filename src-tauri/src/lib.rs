// Native Rust backend for Kasir Citra (POS Distribusi SPPG)
// Modular Architecture

pub mod commands;
pub mod db;
pub mod models;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .on_permission_request(|_webview, _kind| {
            tauri::webview::PermissionResponse::Allow
        })
        .invoke_handler(tauri::generate_handler![
            // 1. Hardware & System
            save_export_file,
            generate_receipt_text,
            // 2. Products & Inventory
            db_get_products,
            db_upsert_product,
            db_update_stock_and_price,
            // 3. Category Markups & Vendors (Dynamic)
            db_get_markups,
            db_update_markup,
            db_create_markup,
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
            // 7. Pre-Orders
            db_get_preorders,
            db_save_preorder,
            // 8. Discounts & Promos
            db_get_discounts,
            db_upsert_discount,
            db_delete_discount,
            db_toggle_discount
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
