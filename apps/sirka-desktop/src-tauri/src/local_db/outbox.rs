use rusqlite::{params, Connection, Result as SqliteResult};
use serde_json::Value;

// ---------------------------------------------------------
// OUTBOX QUEUE HELPERS
// ---------------------------------------------------------
pub fn enqueue_outbox(conn: &Connection, action: &str, payload: &Value) -> SqliteResult<i64> {
    let payload_str = payload.to_string();
    conn.execute(
        "INSERT INTO sync_outbox (action, payload, status, created_at) VALUES (?1, ?2, 'PENDING', datetime('now'))",
        params![action, payload_str],
    )?;
    Ok(conn.last_insert_rowid())
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct OutboxItem {
    pub id: i64,
    pub action: String,
    pub payload: Value,
}

pub fn get_pending_outbox(conn: &Connection, limit: i64) -> SqliteResult<Vec<OutboxItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, action, payload FROM sync_outbox WHERE status = 'PENDING' ORDER BY id ASC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], |row| {
        let payload_str: String = row.get(2)?;
        let payload: Value = serde_json::from_str(&payload_str).unwrap_or(Value::Null);
        Ok(OutboxItem {
            id: row.get(0)?,
            action: row.get(1)?,
            payload,
        })
    })?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn mark_outbox_synced(conn: &Connection, id: i64) -> SqliteResult<()> {
    conn.execute(
        "UPDATE sync_outbox SET status = 'SYNCED', last_error = NULL WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn mark_outbox_failed(conn: &Connection, id: i64, error: &str) -> SqliteResult<()> {
    conn.execute(
        "UPDATE sync_outbox SET
            retry_count = retry_count + 1,
            last_error = ?2,
            status = CASE WHEN retry_count + 1 >= 5 THEN 'FAILED' ELSE 'PENDING' END
         WHERE id = ?1",
        params![id, error],
    )?;
    Ok(())
}

pub fn park_outbox_item(conn: &Connection, id: i64, error: &str) -> SqliteResult<()> {
    conn.execute(
        "UPDATE sync_outbox SET
            retry_count = retry_count + 1,
            last_error = ?2,
            status = 'FAILED'
         WHERE id = ?1",
        params![id, error],
    )?;
    Ok(())
}

pub fn retry_failed_outbox(conn: &Connection) -> SqliteResult<usize> {
    conn.execute(
        "UPDATE sync_outbox SET status = 'PENDING', retry_count = 0 WHERE status = 'FAILED'",
        [],
    )
}

pub fn count_pending_outbox(conn: &Connection) -> SqliteResult<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM sync_outbox WHERE status = 'PENDING'",
        [],
        |r| r.get(0),
    )
}

pub fn local_clear_cache(conn: &Connection) -> SqliteResult<()> {
    conn.execute_batch(
        "
        DELETE FROM category_markups;
        DELETE FROM products;
        DELETE FROM buyers;
        DELETE FROM pre_orders;
        DELETE FROM transactions;
        DELETE FROM discounts;
        DELETE FROM store_settings;
        DELETE FROM purchase_receipt_items;
        DELETE FROM purchase_receipts;
        DELETE FROM suppliers;
        DELETE FROM sync_outbox;
        ",
    )?;
    Ok(())
}
