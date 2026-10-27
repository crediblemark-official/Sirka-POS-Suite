use rusqlite::{params, Connection, Result as SqliteResult};
use serde_json::Value;

use crate::local_db::outbox::enqueue_outbox;

/// BUG-017 FIX: Baca item nota dari tabel ternormalisasi `purchase_receipt_items`.
/// Bentuk JSON-nya sama persis dengan `PurchaseReceiptItem` (src/types/index.ts)
/// supaya frontend tidak perlu tahu-menahu soal sumber datanya.
pub fn local_items_from_table(conn: &Connection, receipt_id: &str) -> Vec<Value> {
    let mut stmt = match conn.prepare(
        "SELECT id, product_id, code, name, category, unit,
                qty_received, buy_price, subtotal_buy, markup_percent, new_sell_price,
                base_qty, conversion_factor
         FROM purchase_receipt_items
         WHERE receipt_id = ?1
         ORDER BY rowid ASC",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let rows = stmt.query_map(params![receipt_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "productId": row.get::<_, String>(1)?,
            "code": row.get::<_, Option<String>>(2)?,
            "name": row.get::<_, String>(3)?,
            "category": row.get::<_, Option<String>>(4)?,
            "unit": row.get::<_, Option<String>>(5)?,
            "qtyReceived": row.get::<_, f64>(6)?,
            "buyPrice": row.get::<_, f64>(7)?,
            "subtotalBuy": row.get::<_, f64>(8)?,
            "markupPercent": row.get::<_, f64>(9)?,
            "newSellPrice": row.get::<_, f64>(10)?,
            "baseQty": row.get::<_, Option<f64>>(11)?.unwrap_or_else(|| row.get::<_, f64>(6).unwrap_or(0.0)),
            "conversionFactor": row.get::<_, Option<f64>>(12)?.unwrap_or(1.0),
        }))
    });

    match rows {
        Ok(mapped) => mapped.filter_map(Result::ok).collect(),
        Err(_) => Vec::new(),
    }
}

pub fn receipt_item_base_qty(item: &Value) -> Option<f64> {
    if let Some(b) = item.get("baseQty").and_then(Value::as_f64) {
        if b.is_finite() && b > 0.0 {
            return Some(b);
        }
    }
    let qty = item.get("qtyReceived").and_then(Value::as_f64)?;
    let factor = item
        .get("conversionFactor")
        .and_then(Value::as_f64)
        .unwrap_or(1.0);
    Some(qty * factor)
}

pub fn local_legacy_receipt(conn: &Connection, receipt_id: &str) -> Option<Value> {
    let mut stmt = conn
        .prepare("SELECT receipt FROM purchase_receipts WHERE id = ?1")
        .ok()?;
    let raw: String = stmt
        .query_row(params![receipt_id], |r| r.get(0))
        .ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn local_receipt_items(conn: &Connection, receipt_id: &str) -> Vec<Value> {
    let from_table = local_items_from_table(conn, receipt_id);
    if !from_table.is_empty() {
        return from_table;
    }
    local_legacy_receipt(conn, receipt_id)
        .and_then(|r| r.get("items").and_then(Value::as_array).cloned())
        .unwrap_or_default()
}

pub fn local_backfill_purchase_items(conn: &Connection) {
    let mut check_stmt = match conn.prepare(
        "SELECT COUNT(*) FROM purchase_receipts pr
         WHERE NOT EXISTS (
             SELECT 1 FROM purchase_receipt_items pri WHERE pri.receipt_id = pr.id
         )",
    ) {
        Ok(s) => s,
        Err(_) => return,
    };

    let unbackfilled: i64 = check_stmt.query_row([], |r| r.get(0)).unwrap_or(0);
    if unbackfilled == 0 {
        return;
    }

    let mut stmt = match conn.prepare("SELECT id, receipt FROM purchase_receipts") {
        Ok(s) => s,
        Err(_) => return,
    };

    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map(|mapped| mapped.filter_map(Result::ok).collect())
        .unwrap_or_default();

    for (receipt_id, receipt_str) in rows {
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM purchase_receipt_items WHERE receipt_id = ?1",
                params![receipt_id],
                |r| r.get(0),
            )
            .unwrap_or(0);

        if count > 0 {
            continue;
        }

        let parsed: Value = match serde_json::from_str(&receipt_str) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let items = match parsed.get("items").and_then(Value::as_array) {
            Some(arr) => arr,
            None => continue,
        };

        for item in items {
            let item_id = item.get("id").and_then(Value::as_str).unwrap_or("");
            let item_uuid = if item_id.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                item_id.to_string()
            };
            let pid = item.get("productId").and_then(Value::as_str).unwrap_or("");
            let code = item.get("code").and_then(Value::as_str);
            let name = item.get("name").and_then(Value::as_str).unwrap_or("");
            let category = item.get("category").and_then(Value::as_str);
            let unit = item.get("unit").and_then(Value::as_str);
            let qty = item.get("qtyReceived").and_then(Value::as_f64).unwrap_or(0.0);
            let factor = item.get("conversionFactor").and_then(Value::as_f64).unwrap_or(1.0);
            let base_qty = item
                .get("baseQty")
                .and_then(Value::as_f64)
                .unwrap_or(qty * factor);
            let buy = item.get("buyPrice").and_then(Value::as_f64).unwrap_or(0.0);
            let subtotal = item.get("subtotalBuy").and_then(Value::as_f64).unwrap_or(qty * buy);
            let markup = item.get("markupPercent").and_then(Value::as_f64).unwrap_or(0.0);
            let sell = item.get("newSellPrice").and_then(Value::as_f64).unwrap_or(0.0);

            let _ = conn.execute(
                "INSERT INTO purchase_receipt_items (
                    id, receipt_id, product_id, code, name, category, unit,
                    qty_received, base_qty, conversion_factor, buy_price, subtotal_buy,
                    markup_percent, new_sell_price, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))",
                params![
                    item_uuid, receipt_id, pid, code, name, category, unit, qty, base_qty, factor, buy,
                    subtotal, markup, sell
                ],
            );
        }
    }
}

pub fn local_get_purchases(conn: &Connection) -> SqliteResult<Vec<Value>> {
    let mut stmt = conn.prepare(
        "SELECT id, supplier_invoice_no, date, supplier, total_buy, notes, receipt, created_at
         FROM purchase_receipts
         ORDER BY date DESC, created_at DESC",
    )?;

    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let raw_receipt: String = row.get(6)?;
        let mut val: Value = serde_json::from_str(&raw_receipt).unwrap_or_else(|_| serde_json::json!({}));

        val["id"] = Value::String(id.clone());
        if let Ok(inv) = row.get::<_, Option<String>>(1) {
            val["supplierInvoiceNo"] = inv.map(Value::String).unwrap_or(Value::Null);
        }
        if let Ok(d) = row.get::<_, Option<String>>(2) {
            val["date"] = d.map(Value::String).unwrap_or(Value::Null);
        }
        if let Ok(s) = row.get::<_, Option<String>>(3) {
            val["supplier"] = s.map(Value::String).unwrap_or(Value::Null);
        }
        if let Ok(t) = row.get::<_, Option<f64>>(4) {
            val["totalBuy"] = t.map(|n| serde_json::json!(n)).unwrap_or(serde_json::json!(0.0));
        }
        if let Ok(n) = row.get::<_, Option<String>>(5) {
            val["notes"] = n.map(Value::String).unwrap_or(Value::Null);
        }
        if let Ok(c) = row.get::<_, Option<String>>(7) {
            val["createdAt"] = c.map(Value::String).unwrap_or(Value::Null);
        }

        let items_from_table = local_items_from_table(conn, &id);
        if !items_from_table.is_empty() {
            val["items"] = Value::Array(items_from_table);
        }

        Ok(val)
    })?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_save_purchase(conn: &mut Connection, receipt: &Value) -> SqliteResult<()> {
    let tx = conn.transaction()?;

    let id = receipt
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| rusqlite::Error::InvalidQuery)?
        .to_string();

    let supplier_inv = receipt.get("supplierInvoiceNo").and_then(Value::as_str);
    let r_date = receipt.get("date").and_then(Value::as_str);
    let supplier = receipt.get("supplier").and_then(Value::as_str);
    let total_buy = receipt.get("totalBuy").and_then(Value::as_f64).unwrap_or(0.0);
    let notes = receipt.get("notes").and_then(Value::as_str);

    let old_items = local_receipt_items(&tx, &id);
    let mut old_stock_deltas: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for item in &old_items {
        if let (Some(pid), Some(base_qty)) = (
            item.get("productId").and_then(Value::as_str),
            receipt_item_base_qty(item),
        ) {
            *old_stock_deltas.entry(pid.to_string()).or_insert(0.0) += base_qty;
        }
    }

    let receipt_str = serde_json::to_string(receipt).unwrap_or_else(|_| "{}".to_string());
    tx.execute(
        "INSERT INTO purchase_receipts (id, supplier_invoice_no, date, supplier, total_buy, notes, receipt, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
         ON CONFLICT (id) DO UPDATE SET
             supplier_invoice_no = excluded.supplier_invoice_no,
             date = excluded.date,
             supplier = excluded.supplier,
             total_buy = excluded.total_buy,
             notes = excluded.notes,
             receipt = excluded.receipt",
        params![id, supplier_inv, r_date, supplier, total_buy, notes, receipt_str],
    )?;

    tx.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = ?1", params![id])?;

    if let Some(items) = receipt.get("items").and_then(Value::as_array) {
        let mut new_stock_deltas: std::collections::HashMap<String, f64> = std::collections::HashMap::new();

        for item in items {
            let item_id = item.get("id").and_then(Value::as_str).unwrap_or("");
            let item_uuid = if item_id.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                item_id.to_string()
            };
            let pid = item.get("productId").and_then(Value::as_str).unwrap_or("");
            let code = item.get("code").and_then(Value::as_str);
            let name = item.get("name").and_then(Value::as_str).unwrap_or("");
            let category = item.get("category").and_then(Value::as_str);
            let unit = item.get("unit").and_then(Value::as_str);
            let qty = item.get("qtyReceived").and_then(Value::as_f64).unwrap_or(0.0);
            let factor = item.get("conversionFactor").and_then(Value::as_f64).unwrap_or(1.0);
            let base_qty = item
                .get("baseQty")
                .and_then(Value::as_f64)
                .unwrap_or(qty * factor);
            let buy = item.get("buyPrice").and_then(Value::as_f64).unwrap_or(0.0);
            let subtotal = item.get("subtotalBuy").and_then(Value::as_f64).unwrap_or(qty * buy);
            let markup = item.get("markupPercent").and_then(Value::as_f64).unwrap_or(0.0);
            let sell = item.get("newSellPrice").and_then(Value::as_f64).unwrap_or(0.0);

            tx.execute(
                "INSERT INTO purchase_receipt_items (
                    id, receipt_id, product_id, code, name, category, unit,
                    qty_received, base_qty, conversion_factor, buy_price, subtotal_buy,
                    markup_percent, new_sell_price, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))",
                params![
                    item_uuid, id, pid, code, name, category, unit, qty, base_qty, factor, buy,
                    subtotal, markup, sell
                ],
            )?;

            if !pid.is_empty() {
                *new_stock_deltas.entry(pid.to_string()).or_insert(0.0) += base_qty;

                let is_base_unit = (factor - 1.0).abs() < f64::EPSILON;
                if is_base_unit && buy > 0.0 && sell > 0.0 {
                    tx.execute(
                        "UPDATE products SET last_buy_price = ?2, last_sell_price = ?3, updated_at = datetime('now') WHERE id = ?1",
                        params![pid, buy, sell],
                    )?;
                } else if is_base_unit && buy > 0.0 {
                    tx.execute(
                        "UPDATE products SET last_buy_price = ?2, updated_at = datetime('now') WHERE id = ?1",
                        params![pid, buy],
                    )?;
                } else if is_base_unit && sell > 0.0 {
                    tx.execute(
                        "UPDATE products SET last_sell_price = ?2, updated_at = datetime('now') WHERE id = ?1",
                        params![pid, sell],
                    )?;
                }
            }
        }

        let mut all_pids: std::collections::HashSet<String> = old_stock_deltas.keys().cloned().collect();
        all_pids.extend(new_stock_deltas.keys().cloned());

        for pid in all_pids {
            let old_qty = old_stock_deltas.get(&pid).copied().unwrap_or(0.0);
            let new_qty = new_stock_deltas.get(&pid).copied().unwrap_or(0.0);
            let net_change = new_qty - old_qty;
            if net_change.abs() > f64::EPSILON {
                tx.execute(
                    "UPDATE products SET stock = MAX(0, stock + ?2), updated_at = datetime('now') WHERE id = ?1",
                    params![pid, net_change],
                )?;
            }
        }
    }

    enqueue_outbox(&tx, "SAVE_PURCHASE", &serde_json::json!({ "receipt": receipt }))?;
    tx.commit()?;
    Ok(())
}

pub fn local_delete_purchase(conn: &mut Connection, id: &str) -> SqliteResult<()> {
    let tx = conn.transaction()?;

    for item in local_receipt_items(&tx, id) {
        if let (Some(pid), Some(base_qty)) = (
            item.get("productId").and_then(Value::as_str),
            receipt_item_base_qty(&item),
        ) {
            tx.execute(
                "UPDATE products SET stock = MAX(0, stock - ?2) WHERE id = ?1",
                params![pid, base_qty],
            )?;
        }
    }

    tx.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = ?1", params![id])?;
    tx.execute("DELETE FROM purchase_receipts WHERE id = ?1", params![id])?;
    enqueue_outbox(&tx, "DELETE_PURCHASE", &serde_json::json!({ "id": id }))?;
    tx.commit()?;
    Ok(())
}

pub fn local_save_purchase_direct(conn: &Connection, receipt: &Value) -> SqliteResult<()> {
    let id = receipt
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if id.is_empty() {
        return Ok(());
    }
    let supplier_inv = receipt.get("supplierInvoiceNo").and_then(Value::as_str);
    let r_date = receipt.get("date").and_then(Value::as_str);
    let supplier = receipt.get("supplier").and_then(Value::as_str);
    let total_buy = receipt.get("totalBuy").and_then(Value::as_f64).unwrap_or(0.0);
    let notes = receipt.get("notes").and_then(Value::as_str);
    let receipt_str = serde_json::to_string(receipt).unwrap_or_else(|_| "{}".to_string());

    conn.execute(
        "INSERT INTO purchase_receipts (id, supplier_invoice_no, date, supplier, total_buy, notes, receipt, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
         ON CONFLICT (id) DO UPDATE SET
             supplier_invoice_no = excluded.supplier_invoice_no,
             date = excluded.date,
             supplier = excluded.supplier,
             total_buy = excluded.total_buy,
             notes = excluded.notes,
             receipt = excluded.receipt",
        params![id, supplier_inv, r_date, supplier, total_buy, notes, receipt_str],
    )?;

    conn.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = ?1", params![id])?;
    if let Some(items) = receipt.get("items").and_then(Value::as_array) {
        for item in items {
            let item_id = item.get("id").and_then(Value::as_str).unwrap_or("");
            let item_uuid = if item_id.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                item_id.to_string()
            };
            let pid = item.get("productId").and_then(Value::as_str).unwrap_or("");
            let code = item.get("code").and_then(Value::as_str);
            let name = item.get("name").and_then(Value::as_str).unwrap_or("");
            let category = item.get("category").and_then(Value::as_str);
            let unit = item.get("unit").and_then(Value::as_str);
            let qty = item.get("qtyReceived").and_then(Value::as_f64).unwrap_or(0.0);
            let factor = item.get("conversionFactor").and_then(Value::as_f64).unwrap_or(1.0);
            let base_qty = item
                .get("baseQty")
                .and_then(Value::as_f64)
                .unwrap_or(qty * factor);
            let buy = item.get("buyPrice").and_then(Value::as_f64).unwrap_or(0.0);
            let subtotal = item.get("subtotalBuy").and_then(Value::as_f64).unwrap_or(qty * buy);
            let markup = item.get("markupPercent").and_then(Value::as_f64).unwrap_or(0.0);
            let sell = item.get("newSellPrice").and_then(Value::as_f64).unwrap_or(0.0);

            conn.execute(
                "INSERT INTO purchase_receipt_items (
                    id, receipt_id, product_id, code, name, category, unit,
                    qty_received, base_qty, conversion_factor, buy_price, subtotal_buy,
                    markup_percent, new_sell_price, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))",
                params![
                    item_uuid, id, pid, code, name, category, unit, qty, base_qty, factor, buy,
                    subtotal, markup, sell
                ],
            )?;
        }
    }
    Ok(())
}
