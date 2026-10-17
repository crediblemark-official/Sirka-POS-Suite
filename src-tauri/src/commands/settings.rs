use crate::db::get_pg_client;
use crate::models::StoreSettingRecord;

#[tauri::command]
pub async fn db_get_settings() -> Result<Vec<StoreSettingRecord>, String> {
    let client = get_pg_client().await?;
    let rows = client
        .query("SELECT key, value FROM store_settings ORDER BY key", &[])
        .await
        .map_err(|e| format!("Gagal memuat pengaturan toko: {}", e))?;

    let settings = rows
        .into_iter()
        .map(|r| StoreSettingRecord {
            key: r.get(0),
            value: r.get(1),
        })
        .collect();

    Ok(settings)
}

#[tauri::command]
pub async fn db_update_setting(key: String, value: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "INSERT INTO store_settings (key, value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
            &[&key, &value],
        )
        .await
        .map_err(|e| format!("Gagal menyimpan pengaturan {}: {}", key, e))?;

    Ok(())
}
