use rusqlite::{params, Connection, Result as SqliteResult};
use serde_json::Value;

use crate::local_db::outbox::enqueue_outbox;
use crate::models::TransactionRecord;

// ---------------------------------------------------------
// LOCAL CRUD: TRANSACTIONS (ATOMIC: INSERT + STOCK + POINTS)
// ---------------------------------------------------------
pub fn local_get_transactions(conn: &Connection) -> SqliteResult<Vec<TransactionRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, invoice_no, date, buyer, items, total_buy, total_sell, total_profit, profit_percent, payment_status, payment_method, customer_type, notes, discount_amount, discount_code, points_used, points_discount, points_earned, final_total, is_pre_order, pic_name, created_at,
                is_split_payment, cash_amount, non_cash_amount, non_cash_method, change_amount, infaq_amount, shift_id, refund_status, refund_total
         FROM transactions ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let items_raw: String = row.get(4)?;
        let items: Value = serde_json::from_str(&items_raw).unwrap_or(Value::Array(vec![]));
        let is_pre_order_int: i32 = row.get(19)?;
        let is_split_int: i32 = row.get(22)?;
        Ok(TransactionRecord {
            id: row.get(0)?,
            invoice_no: row.get(1)?,
            date: row.get(2)?,
            buyer: row.get(3)?,
            items,
            total_buy: row.get(5)?,
            total_sell: row.get(6)?,
            total_profit: row.get(7)?,
            profit_percent: row.get(8)?,
            payment_status: row.get(9)?,
            payment_method: row.get(10)?,
            customer_type: row.get(11)?,
            notes: row.get(12)?,
            discount_amount: row.get(13)?,
            discount_code: row.get(14)?,
            points_used: row.get(15)?,
            points_discount: row.get(16)?,
            points_earned: row.get(17)?,
            final_total: row.get(18)?,
            is_pre_order: Some(is_pre_order_int == 1),
            pic_name: row.get(20)?,
            created_at: row.get(21)?,
            is_split_payment: Some(is_split_int == 1),
            cash_amount: row.get(23)?,
            non_cash_amount: row.get(24)?,
            non_cash_method: row.get(25)?,
            change_amount: row.get(26)?,
            infaq_amount: row.get(27)?,
            shift_id: row.get(28)?,
            refund_status: row.get(29)?,
            refund_total: row.get(30)?,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_create_transaction(
    conn: &mut Connection,
    tx: &TransactionRecord,
    member_id: Option<&str>,
) -> SqliteResult<String> {
    let tx_sqlite = conn.transaction()?;

    let items_str = tx.items.to_string();
    let is_pre_order_val = if tx.is_pre_order.unwrap_or(false) { 1 } else { 0 };
    let is_split_val = if tx.is_split_payment.unwrap_or(false) { 1 } else { 0 };

    tx_sqlite.execute(
        "INSERT INTO transactions (
            id, invoice_no, date, buyer, items, total_buy, total_sell, total_profit,
            profit_percent, payment_status, payment_method, customer_type, notes,
            discount_amount, discount_code, points_used, points_discount, points_earned, final_total,
            is_pre_order, pic_name, created_at,
            is_split_payment, cash_amount, non_cash_amount, non_cash_method, change_amount,
            infaq_amount, shift_id, refund_status, refund_total
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
            ?9, ?10, ?11, ?12, ?13,
            ?14, ?15, ?16, ?17, ?18, ?19,
            ?20, ?21, datetime('now'),
            ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30
        )",
        params![
            tx.id,
            tx.invoice_no,
            tx.date,
            tx.buyer,
            items_str,
            tx.total_buy,
            tx.total_sell,
            tx.total_profit,
            tx.profit_percent,
            tx.payment_status,
            tx.payment_method,
            tx.customer_type,
            tx.notes,
            tx.discount_amount.unwrap_or(0.0),
            tx.discount_code,
            tx.points_used.unwrap_or(0.0),
            tx.points_discount.unwrap_or(0.0),
            tx.points_earned.unwrap_or(0.0),
            tx.final_total.unwrap_or(tx.total_sell),
            is_pre_order_val,
            tx.pic_name,
            is_split_val,
            tx.cash_amount.unwrap_or(0.0),
            tx.non_cash_amount.unwrap_or(0.0),
            tx.non_cash_method,
            tx.change_amount.unwrap_or(0.0),
            tx.infaq_amount.unwrap_or(0.0),
            tx.shift_id,
            tx.refund_status,
            tx.refund_total.unwrap_or(0.0),
        ],
    )?;

    // Kurangi stok barang
    if let Some(items) = tx.items.as_array() {
        for item in items {
            let pid = item.get("productId").and_then(Value::as_str);
            let qty = item.get("qty").and_then(Value::as_f64);
            let price = item.get("sellPrice").and_then(Value::as_f64);
            if let (Some(pid), Some(qty), Some(price)) = (pid, qty, price) {
                let conversion = item
                    .get("conversionFactor")
                    .and_then(Value::as_f64)
                    .unwrap_or(1.0);
                let base_qty = item
                    .get("baseQty")
                    .and_then(Value::as_f64)
                    .unwrap_or(qty * conversion);
                let base_qty = if base_qty.is_finite() && base_qty > 0.0 {
                    base_qty
                } else {
                    qty
                };
                let sell_price = if (conversion - 1.0).abs() < f64::EPSILON {
                    price
                } else {
                    price / conversion
                };

                tx_sqlite.execute(
                    "UPDATE products SET stock = MAX(0, stock - ?2), last_sell_price = ?3, updated_at = datetime('now') WHERE id = ?1",
                    params![pid, base_qty, sell_price],
                )?;
            }
        }
    }

    // Update member points jika ada
    if let Some(mid) = member_id {
        let points_used = tx.points_used.unwrap_or(0.0);
        let points_earned = tx.points_earned.unwrap_or(0.0);
        let final_total = tx.final_total.unwrap_or(tx.total_sell);

        // Ambil aturan tier dinamis dari store_settings (key: loyalty_settings)
        let (plat_min, gold_min, silver_min) = {
            let mut plat = 15_000_000.0;
            let mut gold = 5_000_000.0;
            let mut silver = 1_000_000.0;
            let stmt = tx_sqlite.prepare("SELECT value FROM store_settings WHERE key = 'loyalty_settings'").ok();
            if let Some(mut s) = stmt {
                if let Ok(raw) = s.query_row([], |r| r.get::<_, String>(0)) {
                    if let Ok(val) = serde_json::from_str::<Value>(&raw) {
                        if let Some(tms) = val.get("tierMinSpend") {
                            if let Some(p) = tms.get("PLATINUM").and_then(Value::as_f64) { plat = p; }
                            if let Some(g) = tms.get("GOLD").and_then(Value::as_f64) { gold = g; }
                            if let Some(s) = tms.get("SILVER").and_then(Value::as_f64) { silver = s; }
                        }
                    }
                }
            }
            (plat, gold, silver)
        };

        tx_sqlite.execute(
            "UPDATE buyers SET
                points = MAX(0, points - ?1 + ?2),
                total_spend = total_spend + ?3,
                tier = CASE
                    WHEN total_spend + ?3 >= ?5 THEN 'PLATINUM'
                    WHEN total_spend + ?3 >= ?6 THEN 'GOLD'
                    WHEN total_spend + ?3 >= ?7 THEN 'SILVER'
                    ELSE 'REGULAR'
                END
             WHERE id = ?4",
            params![points_used, points_earned, final_total, mid, plat_min, gold_min, silver_min],
        )?;
    }

    // Update usage_count diskon jika ada
    if let Some(ref code) = tx.discount_code {
        if !code.is_empty() && code != "MANUAL" && !code.starts_with("MEMBER-") {
            let _ = tx_sqlite.execute(
                "UPDATE discounts SET usage_count = usage_count + 1 WHERE code = ?1",
                params![code],
            );
        }
    }

    // Catat ke outbox sync
    let payload = serde_json::json!({
        "tx": tx,
        "memberId": member_id
    });
    enqueue_outbox(&tx_sqlite, "CREATE_TRANSACTION", &payload)?;

    tx_sqlite.commit()?;
    Ok(tx.id.clone())
}

pub fn local_update_transaction_status(
    conn: &Connection,
    id: &str,
    status: &str,
) -> SqliteResult<()> {
    conn.execute(
        "UPDATE transactions SET payment_status = ?2 WHERE id = ?1",
        params![id, status],
    )?;
    enqueue_outbox(
        conn,
        "UPDATE_TRANSACTION_STATUS",
        &serde_json::json!({ "id": id, "paymentStatus": status }),
    )?;
    Ok(())
}

pub fn local_delete_transaction(conn: &mut Connection, id: &str) -> SqliteResult<()> {
    let tx = conn.transaction()?;

    let found = {
        let mut stmt = tx.prepare("SELECT items, buyer, points_used, points_earned, final_total, discount_code FROM transactions WHERE id = ?1")?;
        stmt.query_row(params![id], |row| {
            let items_raw: String = row.get(0)?;
            let items: Value = serde_json::from_str(&items_raw).unwrap_or(Value::Array(vec![]));
            Ok((
                items,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })
    };

    if let Ok((items, buyer_name, p_used, p_earned, spend, disc_code)) = found {
        // Rollback stok
        if let Some(arr) = items.as_array() {
            for item in arr {
                let pid = item.get("productId").and_then(Value::as_str);
                let qty = item.get("qty").and_then(Value::as_f64);
                if let (Some(pid), Some(qty)) = (pid, qty) {
                    let conversion = item
                        .get("conversionFactor")
                        .and_then(Value::as_f64)
                        .unwrap_or(1.0);
                    let base_qty = item
                        .get("baseQty")
                        .and_then(Value::as_f64)
                        .unwrap_or(qty * conversion);
                    let base_qty = if base_qty.is_finite() && base_qty > 0.0 {
                        base_qty
                    } else {
                        qty
                    };
                    tx.execute(
                        "UPDATE products SET stock = stock + ?2 WHERE id = ?1",
                        params![pid, base_qty],
                    )?;
                }
            }
        }

        // Ambil aturan tier dinamis dari store_settings (key: loyalty_settings)
        let (plat_min, gold_min, silver_min) = {
            let mut plat = 15_000_000.0;
            let mut gold = 5_000_000.0;
            let mut silver = 1_000_000.0;
            let stmt = tx.prepare("SELECT value FROM store_settings WHERE key = 'loyalty_settings'").ok();
            if let Some(mut s) = stmt {
                if let Ok(raw) = s.query_row([], |r| r.get::<_, String>(0)) {
                    if let Ok(val) = serde_json::from_str::<Value>(&raw) {
                        if let Some(tms) = val.get("tierMinSpend") {
                            if let Some(p) = tms.get("PLATINUM").and_then(Value::as_f64) { plat = p; }
                            if let Some(g) = tms.get("GOLD").and_then(Value::as_f64) { gold = g; }
                            if let Some(s) = tms.get("SILVER").and_then(Value::as_f64) { silver = s; }
                        }
                    }
                }
            }
            (plat, gold, silver)
        };

        // Rollback poin member
        tx.execute(
            "UPDATE buyers SET
                points = MAX(0, points + ?1 - ?2),
                total_spend = MAX(0, total_spend - ?3),
                tier = CASE
                    WHEN total_spend - ?3 >= ?5 THEN 'PLATINUM'
                    WHEN total_spend - ?3 >= ?6 THEN 'GOLD'
                    WHEN total_spend - ?3 >= ?7 THEN 'SILVER'
                    ELSE 'REGULAR'
                END
             WHERE name = ?4",
            params![p_used, p_earned, spend, buyer_name, plat_min, gold_min, silver_min],
        )?;

        // Rollback usage_count kupon diskon
        if let Some(ref code) = disc_code {
            if !code.is_empty() && code != "MANUAL" && !code.starts_with("MEMBER-") {
                let _ = tx.execute(
                    "UPDATE discounts SET usage_count = MAX(0, usage_count - 1) WHERE code = ?1",
                    params![code],
                );
            }
        }
    }

    tx.execute("DELETE FROM transactions WHERE id = ?1", params![id])?;
    enqueue_outbox(&tx, "DELETE_TRANSACTION", &serde_json::json!({ "id": id }))?;

    tx.commit()?;
    Ok(())
}

pub fn local_save_transaction_direct(conn: &Connection, tx: &TransactionRecord) -> SqliteResult<()> {
    let is_pre_order_val = if tx.is_pre_order.unwrap_or(false) { 1 } else { 0 };
    let is_split_val = if tx.is_split_payment.unwrap_or(false) { 1 } else { 0 };
    conn.execute(
        "INSERT INTO transactions (
            id, invoice_no, date, buyer, items,
            total_buy, total_sell, total_profit, profit_percent,
            payment_status, payment_method, customer_type, notes,
            discount_amount, discount_code, points_used, points_discount,
            points_earned, final_total,
            is_pre_order, pic_name, created_at,
            is_split_payment, cash_amount, non_cash_amount, non_cash_method,
            change_amount, infaq_amount, shift_id, refund_status, refund_total
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, ?8, ?9,
            ?10, ?11, ?12, ?13,
            ?14, ?15, ?16, ?17,
            ?18, ?19,
            ?20, ?21, COALESCE(?22, datetime('now')),
            ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31
        ) ON CONFLICT (id) DO UPDATE SET
            total_buy = excluded.total_buy,
            total_sell = excluded.total_sell,
            total_profit = excluded.total_profit,
            profit_percent = excluded.profit_percent,
            payment_status = excluded.payment_status,
            payment_method = excluded.payment_method,
            final_total = excluded.final_total,
            items = excluded.items,
            date = excluded.date,
            buyer = excluded.buyer,
            customer_type = excluded.customer_type,
            notes = excluded.notes,
            discount_amount = excluded.discount_amount,
            discount_code = excluded.discount_code,
            points_used = excluded.points_used,
            points_discount = excluded.points_discount,
            points_earned = excluded.points_earned,
            is_pre_order = excluded.is_pre_order,
            pic_name = excluded.pic_name,
            is_split_payment = excluded.is_split_payment,
            cash_amount = excluded.cash_amount,
            non_cash_amount = excluded.non_cash_amount,
            non_cash_method = excluded.non_cash_method,
            change_amount = excluded.change_amount,
            infaq_amount = excluded.infaq_amount,
            shift_id = excluded.shift_id,
            refund_status = excluded.refund_status,
            refund_total = excluded.refund_total",
        params![
            tx.id,
            tx.invoice_no,
            tx.date,
            tx.buyer,
            tx.items.to_string(),
            tx.total_buy,
            tx.total_sell,
            tx.total_profit,
            tx.profit_percent,
            tx.payment_status,
            tx.payment_method,
            tx.customer_type.as_deref().unwrap_or("B2B"),
            tx.notes,
            tx.discount_amount.unwrap_or(0.0),
            tx.discount_code,
            tx.points_used.unwrap_or(0.0),
            tx.points_discount.unwrap_or(0.0),
            tx.points_earned.unwrap_or(0.0),
            tx.final_total.unwrap_or(0.0),
            is_pre_order_val,
            tx.pic_name,
            tx.created_at,
            is_split_val,
            tx.cash_amount.unwrap_or(0.0),
            tx.non_cash_amount.unwrap_or(0.0),
            tx.non_cash_method,
            tx.change_amount.unwrap_or(0.0),
            tx.infaq_amount.unwrap_or(0.0),
            tx.shift_id,
            tx.refund_status,
            tx.refund_total.unwrap_or(0.0),
        ],
    )?;
    Ok(())
}
