use rusqlite::{params, Connection, Result as SqliteResult};
use serde_json::Value;

use crate::local_db::outbox::enqueue_outbox;
use crate::models::PreOrderRecord;

pub fn local_get_preorders(conn: &Connection) -> SqliteResult<Vec<PreOrderRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, date, day_name, buyer, items, is_loaded_to_pos FROM pre_orders ORDER BY date DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let items_raw: String = row.get(4)?;
        let items: Value = serde_json::from_str(&items_raw).unwrap_or(Value::Array(vec![]));
        let loaded_int: i32 = row.get(5)?;
        Ok(PreOrderRecord {
            id: row.get(0)?,
            date: row.get(1)?,
            day_name: row.get(2)?,
            buyer: row.get(3)?,
            items,
            is_loaded_to_pos: loaded_int == 1,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_save_preorder(conn: &Connection, po: &PreOrderRecord) -> SqliteResult<()> {
    let loaded = if po.is_loaded_to_pos { 1 } else { 0 };
    conn.execute(
        "INSERT INTO pre_orders (id, date, day_name, buyer, items, is_loaded_to_pos)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT (id) DO UPDATE SET
            date = excluded.date,
            day_name = excluded.day_name,
            buyer = excluded.buyer,
            items = excluded.items,
            is_loaded_to_pos = excluded.is_loaded_to_pos",
        params![po.id, po.date, po.day_name, po.buyer, po.items.to_string(), loaded],
    )?;
    enqueue_outbox(conn, "SAVE_PREORDER", &serde_json::json!({ "record": po }))?;
    Ok(())
}

pub fn local_delete_preorder(conn: &Connection, id: &str) -> SqliteResult<()> {
    conn.execute("DELETE FROM pre_orders WHERE id = ?1", params![id])?;
    enqueue_outbox(conn, "DELETE_PREORDER", &serde_json::json!({ "id": id }))?;
    Ok(())
}

pub fn local_save_preorder_direct(conn: &Connection, po: &PreOrderRecord) -> SqliteResult<()> {
    let loaded = if po.is_loaded_to_pos { 1 } else { 0 };
    conn.execute(
        "INSERT INTO pre_orders (id, date, day_name, buyer, items, is_loaded_to_pos)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT (id) DO UPDATE SET
            date = excluded.date,
            day_name = excluded.day_name,
            buyer = excluded.buyer,
            items = excluded.items,
            is_loaded_to_pos = excluded.is_loaded_to_pos",
        params![po.id, po.date, po.day_name, po.buyer, po.items.to_string(), loaded],
    )?;
    Ok(())
}
