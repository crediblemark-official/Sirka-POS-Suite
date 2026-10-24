use rusqlite::{params, Connection, Result as SqliteResult};

use crate::models::BuyerRecord;

// ---------------------------------------------------------
// LOCAL CRUD: BUYERS
// ---------------------------------------------------------
pub fn local_get_buyers(conn: &Connection) -> SqliteResult<Vec<BuyerRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, code, phone, address, customer_type, member_card_no, tier, points, total_spend, member_since, notes FROM buyers ORDER BY name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(BuyerRecord {
            id: row.get(0)?,
            name: row.get(1)?,
            code: row.get(2)?,
            phone: row.get(3)?,
            address: row.get(4)?,
            customer_type: row.get(5)?,
            member_card_no: row.get(6)?,
            tier: row.get(7)?,
            points: row.get(8)?,
            total_spend: row.get(9)?,
            member_since: row.get(10)?,
            notes: row.get(11)?,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_upsert_buyer(conn: &Connection, b: &BuyerRecord) -> SqliteResult<()> {
    let customer_type = b.customer_type.as_deref().unwrap_or("B2B");
    let tier = b.tier.as_deref().unwrap_or("REGULAR");
    conn.execute(
        "INSERT INTO buyers (id, name, code, phone, address, customer_type, member_card_no, tier, points, total_spend, member_since, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT (id) DO UPDATE SET
            name = excluded.name,
            code = excluded.code,
            phone = excluded.phone,
            address = excluded.address,
            customer_type = excluded.customer_type,
            member_card_no = excluded.member_card_no,
            tier = excluded.tier,
            points = excluded.points,
            total_spend = excluded.total_spend,
            member_since = excluded.member_since,
            notes = excluded.notes",
        params![
            b.id,
            b.name,
            b.code,
            b.phone,
            b.address,
            customer_type,
            b.member_card_no,
            tier,
            b.points.unwrap_or(0.0),
            b.total_spend.unwrap_or(0.0),
            b.member_since,
            b.notes,
        ],
    )?;
    Ok(())
}

pub fn local_delete_buyer(conn: &Connection, id: &str) -> SqliteResult<()> {
    conn.execute("DELETE FROM buyers WHERE id = ?1", params![id])?;
    Ok(())
}
