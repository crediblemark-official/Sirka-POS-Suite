use rusqlite::{params, Connection, Result as SqliteResult};

use crate::local_db::outbox::enqueue_outbox;
use crate::models::StoreSettingRecord;

pub fn local_get_settings(conn: &Connection) -> SqliteResult<Vec<StoreSettingRecord>> {
    let mut stmt = conn.prepare("SELECT key, value FROM store_settings ORDER BY key ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(StoreSettingRecord {
            key: row.get(0)?,
            value: row.get(1)?,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_update_setting(conn: &Connection, key: &str, value: &str) -> SqliteResult<()> {
    conn.execute(
        "INSERT INTO store_settings (key, value, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        params![key, value],
    )?;
    enqueue_outbox(
        conn,
        "UPDATE_SETTING",
        &serde_json::json!({ "key": key, "value": value }),
    )?;
    Ok(())
}

pub fn local_update_setting_direct(conn: &Connection, key: &str, value: &str) -> SqliteResult<()> {
    conn.execute(
        "INSERT INTO store_settings (key, value, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        params![key, value],
    )?;
    Ok(())
}
