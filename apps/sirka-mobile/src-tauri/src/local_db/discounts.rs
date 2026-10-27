use rusqlite::{params, Connection, Result as SqliteResult};

use crate::local_db::outbox::enqueue_outbox;
use crate::models::DiscountRecord;

pub fn local_get_discounts(conn: &Connection) -> SqliteResult<Vec<DiscountRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, code, name, type, value, min_purchase, max_discount, scope, target_category, target_customer_type, is_active, description, usage_count, created_at FROM discounts ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let is_act: i32 = row.get(10)?;
        Ok(DiscountRecord {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            r#type: row.get(3)?,
            value: row.get(4)?,
            min_purchase: row.get(5)?,
            max_discount: row.get(6)?,
            scope: row.get(7)?,
            target_category: row.get(8)?,
            target_customer_type: row.get(9)?,
            is_active: is_act == 1,
            description: row.get(11)?,
            usage_count: row.get(12)?,
            created_at: row.get(13)?,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_upsert_discount(conn: &Connection, d: &DiscountRecord) -> SqliteResult<()> {
    let act = if d.is_active { 1 } else { 0 };
    conn.execute(
        "INSERT INTO discounts (id, code, name, type, value, min_purchase, max_discount, scope, target_category, target_customer_type, is_active, description, usage_count)
         VALUES (?1, UPPER(?2), ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, COALESCE(?13, 0))
         ON CONFLICT (id) DO UPDATE SET
            code = UPPER(excluded.code),
            name = excluded.name,
            type = excluded.type,
            value = excluded.value,
            min_purchase = excluded.min_purchase,
            max_discount = excluded.max_discount,
            scope = excluded.scope,
            target_category = excluded.target_category,
            target_customer_type = excluded.target_customer_type,
            is_active = excluded.is_active,
            description = excluded.description",
        params![
            d.id,
            d.code,
            d.name,
            d.r#type,
            d.value,
            d.min_purchase,
            d.max_discount,
            d.scope,
            d.target_category,
            d.target_customer_type,
            act,
            d.description,
            d.usage_count.unwrap_or(0),
        ],
    )?;
    enqueue_outbox(conn, "UPSERT_DISCOUNT", &serde_json::json!({ "discount": d }))?;
    Ok(())
}

pub fn local_delete_discount(conn: &Connection, id: &str) -> SqliteResult<()> {
    conn.execute("DELETE FROM discounts WHERE id = ?1", params![id])?;
    enqueue_outbox(conn, "DELETE_DISCOUNT", &serde_json::json!({ "id": id }))?;
    Ok(())
}

pub fn local_toggle_discount(conn: &Connection, id: &str, is_active: bool) -> SqliteResult<()> {
    let act = if is_active { 1 } else { 0 };
    let affected = conn.execute(
        "UPDATE discounts SET is_active = ?2 WHERE id = ?1",
        params![id, act],
    )?;
    // BUG FIX: `rows_affected` tidak diperiksa sehingga toggle untuk id yang
    // tidak ada tetap "berhasil" (dan UI menyimpan state yang tidak pernah
    // tersimpan). Sekarang error dikembalikan bila tidak ada baris yang berubah.
    if affected == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    enqueue_outbox(
        conn,
        "TOGGLE_DISCOUNT",
        &serde_json::json!({ "id": id, "isActive": is_active }),
    )?;
    Ok(())
}

pub fn local_upsert_discount_direct(conn: &Connection, d: &DiscountRecord) -> SqliteResult<()> {
    let act = if d.is_active { 1 } else { 0 };
    conn.execute(
        "INSERT INTO discounts (id, code, name, type, value, min_purchase, max_discount, scope, target_category, target_customer_type, is_active, description, usage_count)
         VALUES (?1, UPPER(?2), ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, COALESCE(?13, 0))
         ON CONFLICT (id) DO UPDATE SET
            code = UPPER(excluded.code),
            name = excluded.name,
            type = excluded.type,
            value = excluded.value,
            min_purchase = excluded.min_purchase,
            max_discount = excluded.max_discount,
            scope = excluded.scope,
            target_category = excluded.target_category,
            target_customer_type = excluded.target_customer_type,
            is_active = excluded.is_active,
            description = excluded.description",
        params![
            d.id,
            d.code,
            d.name,
            d.r#type,
            d.value,
            d.min_purchase,
            d.max_discount,
            d.scope,
            d.target_category,
            d.target_customer_type,
            act,
            d.description,
            d.usage_count.unwrap_or(0),
        ],
    )?;
    Ok(())
}
