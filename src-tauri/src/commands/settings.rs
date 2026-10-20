use crate::db::get_pg_client;
use crate::local_db::{get_conn, local_get_settings, local_update_setting};
use crate::models::StoreSettingRecord;

#[tauri::command]
pub async fn db_get_settings() -> Result<Vec<StoreSettingRecord>, String> {
    let conn = get_conn().lock().unwrap();
    let list = local_get_settings(&conn).map_err(|e| e.to_string())?;
    Ok(list)
}

#[tauri::command]
pub async fn db_update_setting(key: String, value: String) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_update_setting(&conn, &key, &value).map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

// -------------------------------------------------------------
// POSTGRES DIRECT METHODS
// -------------------------------------------------------------
pub async fn pg_update_setting(key: String, value: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "INSERT INTO store_settings (key, value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
            &[&key, &value],
        )
        .await
        .map_err(|e| format!("Gagal menyimpan pengaturan ke PostgreSQL {}: {}", key, e))?;

    Ok(())
}
