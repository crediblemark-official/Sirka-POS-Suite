use crate::db::get_pg_client;
use crate::local_db::{
    get_conn, local_delete_preorder, local_get_preorders, local_save_preorder,
};
use crate::models::PreOrderRecord;

#[tauri::command]
pub async fn db_get_preorders() -> Result<Vec<PreOrderRecord>, String> {
    let conn = get_conn().lock().unwrap();
    let pos = local_get_preorders(&conn).map_err(|e| e.to_string())?;
    Ok(pos)
}

#[tauri::command]
pub async fn db_save_preorder(record: PreOrderRecord) -> Result<String, String> {
    // BUG FIX: tidak ada lagi fallback "id kosong" seperti pada buyer/kupon.
    // Tanpa ini, pre-order dengan id kosong tersimpan pada baris PK '' dan
    // pre-order berikutnya menimpanya -> jadwal pengantaran hilang.
    let id = if record.id.trim().is_empty() {
        format!("po-{}", uuid::Uuid::new_v4())
    } else {
        record.id.clone()
    };
    let mut record = record;
    record.id = id.clone();
    {
        let conn = get_conn().lock().unwrap();
        local_save_preorder(&conn, &record).map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(id)
}

#[tauri::command]
pub async fn db_delete_preorder(id: String) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_delete_preorder(&conn, &id).map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

// -------------------------------------------------------------
// POSTGRES DIRECT METHODS
// -------------------------------------------------------------
pub async fn pg_save_preorder(record: PreOrderRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    // BUG FIX: `$2::text::date` membuat format tanggal yang tidak valid
    // (mis. "22/10/2026") menjadi error PostgreSQL permanen yang memblokir
    // seluruh antrean outbox. Sekarang divalidasi & difallback ke hari ini.
    let date_str = normalize_date(&record.date);
    client
        .execute(
            "INSERT INTO pre_orders (id, date, day_name, buyer, items, is_loaded_to_pos)
             VALUES ($1, $2::text::date, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               date = EXCLUDED.date,
               day_name = EXCLUDED.day_name,
               buyer = EXCLUDED.buyer,
               items = EXCLUDED.items,
               is_loaded_to_pos = EXCLUDED.is_loaded_to_pos",
            &[
                &record.id,
                &date_str,
                &record.day_name,
                &record.buyer,
                &record.items,
                &record.is_loaded_to_pos,
            ],
        )
        .await
        .map_err(|e| format!("Gagal simpan pre-order ke PostgreSQL: {}", e))?;

    Ok(record.id)
}

/// Validasi format tanggal ISO (YYYY-MM-DD). Nilai lain dikembalikan sebagai
/// error agar tidak diam-diam corrup data.
fn normalize_date(raw: &str) -> String {
    let trimmed = raw.trim();
    let bytes = trimmed.as_bytes();
    let valid = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit());
    if valid {
        trimmed.to_string()
    } else {
        // Fallback: hari ini (lokal) — lebih baik daripada menggagalkan
        // seluruh sinkronisasi karena satu tanggal tidak valid.
        chrono::Local::now().format("%Y-%m-%d").to_string()
    }
}

pub async fn pg_delete_preorder(id: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute("DELETE FROM pre_orders WHERE id = $1", &[&id])
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
