use crate::local_db::{
    get_conn, local_delete_purchase, local_get_purchases, local_save_purchase,
};
use serde_json::Value;

#[tauri::command]
pub async fn db_get_purchases() -> Result<Vec<Value>, String> {
    let conn = get_conn().lock().unwrap();
    let list = local_get_purchases(&conn).map_err(|e| e.to_string())?;
    Ok(list)
}

#[tauri::command]
pub async fn db_save_purchase(receipt: Value) -> Result<(), String> {
    {
        let mut conn = get_conn().lock().unwrap();
        local_save_purchase(&mut conn, &receipt)
            .map_err(|e| format!("Gagal menyimpan nota kulakan di database lokal: {}", e))?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

#[tauri::command]
pub async fn db_delete_purchase(id: String) -> Result<(), String> {
    {
        let mut conn = get_conn().lock().unwrap();
        local_delete_purchase(&mut conn, &id)
            .map_err(|e| format!("Gagal menghapus nota kulakan di database lokal: {}", e))?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

#[tauri::command]
pub async fn db_import_purchases(receipts: Vec<Value>) -> Result<(), String> {
    {
        let mut conn = get_conn().lock().unwrap();
        for r in &receipts {
            let _ = local_save_purchase(&mut conn, r);
        }
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}
