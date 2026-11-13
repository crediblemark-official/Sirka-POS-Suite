use rusqlite::{params, Connection, Result as SqliteResult};

use crate::models::{CategoryMarkupRecord, ProductRecord, ProductUnitConversionRecord};

// ---------------------------------------------------------
// LOCAL CRUD: PRODUCTS
// ---------------------------------------------------------
pub fn local_get_products(conn: &Connection) -> SqliteResult<Vec<ProductRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, code, name, category, unit, default_markup_percent, last_buy_price, last_sell_price, stock, barcode, notes, supplier, units, is_perishable, product_type, tier_pricing, available_modifiers, service_duration_minutes FROM products ORDER BY name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let units_json: Option<String> = row.get(12)?;
        let units: Option<Vec<ProductUnitConversionRecord>> = units_json
            .as_deref()
            .and_then(|raw| serde_json::from_str(raw).ok());
        let tier_pricing: Option<serde_json::Value> = row.get::<_, Option<String>>(15)?
            .as_deref()
            .and_then(|raw| serde_json::from_str(raw).ok());
        let available_modifiers: Option<Vec<String>> = row.get::<_, Option<String>>(16)?
            .as_deref()
            .and_then(|raw| serde_json::from_str(raw).ok());
        Ok(ProductRecord {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            category: row.get(3)?,
            unit: row.get(4)?,
            default_markup_percent: row.get(5)?,
            last_buy_price: row.get(6)?,
            last_sell_price: row.get(7)?,
            stock: row.get(8)?,
            barcode: row.get(9)?,
            notes: row.get(10)?,
            supplier: row.get(11)?,
            units,
            is_perishable: Some(row.get::<_, i64>(13)? != 0),
            product_type: row.get(14)?,
            tier_pricing,
            available_modifiers,
            service_duration_minutes: row.get(17)?,
        })
    })?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_upsert_product(conn: &Connection, p: &ProductRecord) -> SqliteResult<()> {
    let units_json: Option<String> = p
        .units
        .as_ref()
        .and_then(|u| serde_json::to_string(u).ok());
    let is_perishable = if p.is_perishable.unwrap_or(false) { 1 } else { 0 };
    let tier_pricing_json: Option<String> = p
        .tier_pricing
        .as_ref()
        .and_then(|t| serde_json::to_string(t).ok());
    let modifiers_json: Option<String> = p
        .available_modifiers
        .as_ref()
        .and_then(|m| serde_json::to_string(m).ok());
    let p_type = p.product_type.as_deref().unwrap_or("GOODS");

    conn.execute(
        "INSERT INTO products (
            id, code, name, category, unit, default_markup_percent, last_buy_price, last_sell_price,
            stock, barcode, notes, supplier, units, is_perishable,
            product_type, tier_pricing, available_modifiers, service_duration_minutes, updated_at
         ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
            ?9, ?10, ?11, ?12, ?13, ?14,
            ?15, ?16, ?17, ?18, datetime('now')
         )
         ON CONFLICT (id) DO UPDATE SET
            code = excluded.code,
            name = excluded.name,
            category = excluded.category,
            unit = excluded.unit,
            default_markup_percent = excluded.default_markup_percent,
            last_buy_price = excluded.last_buy_price,
            last_sell_price = excluded.last_sell_price,
            stock = excluded.stock,
            barcode = excluded.barcode,
            notes = excluded.notes,
            supplier = excluded.supplier,
            units = excluded.units,
            is_perishable = excluded.is_perishable,
            product_type = excluded.product_type,
            tier_pricing = excluded.tier_pricing,
            available_modifiers = excluded.available_modifiers,
            service_duration_minutes = excluded.service_duration_minutes,
            updated_at = datetime('now')",
        params![
            p.id,
            p.code,
            p.name,
            p.category,
            p.unit,
            p.default_markup_percent,
            p.last_buy_price,
            p.last_sell_price,
            p.stock,
            p.barcode,
            p.notes,
            p.supplier,
            units_json,
            is_perishable,
            p_type,
            tier_pricing_json,
            modifiers_json,
            p.service_duration_minutes.unwrap_or(0),
        ],
    )?;
    Ok(())
}

pub fn local_delete_product(conn: &Connection, id: &str) -> SqliteResult<()> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM transactions WHERE items LIKE '%' || ?1 || '%'",
            params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if count > 0 {
        conn.execute(
            "UPDATE products SET stock = 0, notes = COALESCE(notes, '') || ' [DIHAPUS]', updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
    } else {
        conn.execute("DELETE FROM products WHERE id = ?1", params![id])?;
    }
    Ok(())
}

pub fn local_update_stock_and_price(
    conn: &Connection,
    product_id: &str,
    added_stock: f64,
    buy_price: f64,
    sell_price: f64,
) -> SqliteResult<()> {
    conn.execute(
        "UPDATE products SET
            stock = stock + ?2,
            last_buy_price = CASE WHEN ?3 > 0 THEN ?3 ELSE last_buy_price END,
            last_sell_price = CASE WHEN ?4 > 0 THEN ?4 ELSE last_sell_price END,
            updated_at = datetime('now')
         WHERE id = ?1",
        params![product_id, added_stock, buy_price, sell_price],
    )?;
    Ok(())
}

// ---------------------------------------------------------
// LOCAL CRUD: CATEGORY MARKUPS
// ---------------------------------------------------------
pub fn local_get_markups(conn: &Connection) -> SqliteResult<Vec<CategoryMarkupRecord>> {
    let mut stmt = conn.prepare(
        "SELECT category, default_markup_percent, description, color FROM category_markups ORDER BY category ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CategoryMarkupRecord {
            category: row.get(0)?,
            default_markup_percent: row.get(1)?,
            description: row.get(2)?,
            color: row.get(3)?,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_upsert_markup(
    conn: &Connection,
    category: &str,
    percent: f64,
    desc: Option<&str>,
    color: Option<&str>,
) -> SqliteResult<()> {
    conn.execute(
        "INSERT INTO category_markups (category, default_markup_percent, description, color)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (category) DO UPDATE SET
            default_markup_percent = excluded.default_markup_percent,
            description = COALESCE(excluded.description, category_markups.description),
            color = COALESCE(excluded.color, category_markups.color)",
        params![category, percent, desc, color],
    )?;
    Ok(())
}

pub fn local_delete_markup(conn: &Connection, category: &str) -> SqliteResult<()> {
    conn.execute("DELETE FROM category_markups WHERE category = ?1", params![category])?;
    Ok(())
}
