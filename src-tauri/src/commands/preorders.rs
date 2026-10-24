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
