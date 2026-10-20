use crate::db::get_pg_client;
use crate::local_db::{
    get_conn, local_create_transaction, local_delete_transaction, local_get_transactions,
    local_update_transaction_status,
};
use crate::models::TransactionRecord;

#[tauri::command]
pub async fn db_get_transactions() -> Result<Vec<TransactionRecord>, String> {
    let conn = get_conn().lock().unwrap();
    let txs = local_get_transactions(&conn).map_err(|e| e.to_string())?;
    Ok(txs)
}

#[tauri::command]
pub async fn db_create_transaction(
    tx: TransactionRecord,
    member_id: Option<String>,
) -> Result<String, String> {
    let invoice_no = {
        let mut conn = get_conn().lock().unwrap();
        local_create_transaction(&mut conn, &tx, member_id.as_deref())
            .map_err(|e| format!("Gagal mencatat transaksi di database lokal: {}", e))?;
        tx.invoice_no
    };

    // Trigger background sync ke PostgreSQL Cloud secara non-blocking
    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(invoice_no)
}

#[tauri::command]
pub async fn db_update_transaction_status(
    id: String,
    payment_status: String,
) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_update_transaction_status(&conn, &id, &payment_status)
            .map_err(|e| format!("Gagal update status transaksi di database lokal: {}", e))?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

#[tauri::command]
pub async fn db_delete_transaction(id: String) -> Result<(), String> {
    {
        let mut conn = get_conn().lock().unwrap();
        local_delete_transaction(&mut conn, &id)
            .map_err(|e| format!("Gagal menghapus transaksi di database lokal: {}", e))?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

// -------------------------------------------------------------
// POSTGRES DIRECT METHODS (Called by sync engine when online)
// -------------------------------------------------------------
pub async fn pg_create_transaction(
    tx: TransactionRecord,
    member_id: Option<String>,
) -> Result<String, String> {
    let mut connection = get_pg_client().await?;
    let client = connection.transaction().await.map_err(|e| e.to_string())?;
    let customer_type = tx.customer_type.unwrap_or_else(|| "B2B".to_string());
    let discount_amount = tx.discount_amount.unwrap_or(0.0);
    let points_used = tx.points_used.unwrap_or(0.0);
    let points_discount = tx.points_discount.unwrap_or(0.0);
    let points_earned = tx.points_earned.unwrap_or(0.0);
    let final_total = tx.final_total.unwrap_or(tx.total_sell);
    let is_pre_order = tx.is_pre_order.unwrap_or(false);
    let pic_name = tx.pic_name.clone().filter(|s| !s.trim().is_empty());

    let existing = client
        .query_opt(
            "SELECT id FROM transactions WHERE id = $1 OR invoice_no = $2",
            &[&tx.id, &tx.invoice_no],
        )
        .await
        .map_err(|e| format!("Gagal cek duplikat transaksi di PostgreSQL: {}", e))?;

    if existing.is_some() {
        return Ok(tx.invoice_no);
    }

    client
        .execute(
            "INSERT INTO transactions (
                id, invoice_no, date, buyer, items, total_buy, total_sell, total_profit, 
                profit_percent, payment_status, payment_method, customer_type, notes, 
                discount_amount, discount_code, points_used, points_discount, points_earned, final_total, 
                is_pre_order, pic_name, created_at
             )
             VALUES (
                $1, $2, $3::text::date, $4, $5, $6::float8, $7::float8, $8::float8, 
                $9::float8, $10, $11, $12, $13, 
                $14::float8, $15, $16::float8, $17::float8, $18::float8, $19::float8, 
                $20, $21, NOW()
             )",
            &[
                &tx.id,
                &tx.invoice_no,
                &tx.date,
                &tx.buyer,
                &tx.items,
                &tx.total_buy,
                &tx.total_sell,
                &tx.total_profit,
                &tx.profit_percent,
                &tx.payment_status,
                &tx.payment_method,
                &customer_type,
                &tx.notes,
                &discount_amount,
                &tx.discount_code,
                &points_used,
                &points_discount,
                &points_earned,
                &final_total,
                &is_pre_order,
                &pic_name,
            ],
        )
        .await
        .map_err(|e| format!("Gagal simpan transaksi ke PostgreSQL: {}", e))?;

    if let Some(member_id) = member_id {
        let (plat_min, gold_min, silver_min) = {
            let mut plat = 15_000_000.0;
            let mut gold = 5_000_000.0;
            let mut silver = 1_000_000.0;
            if let Ok(Some(row)) = client.query_opt("SELECT value FROM store_settings WHERE key = 'loyalty_settings'", &[]).await {
                let raw: String = row.get(0);
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                    if let Some(tms) = val.get("tierMinSpend") {
                        if let Some(p) = tms.get("PLATINUM").and_then(serde_json::Value::as_f64) { plat = p; }
                        if let Some(g) = tms.get("GOLD").and_then(serde_json::Value::as_f64) { gold = g; }
                        if let Some(s) = tms.get("SILVER").and_then(serde_json::Value::as_f64) { silver = s; }
                    }
                }
            }
            (plat, gold, silver)
        };

        let _ = client
            .execute(
                "UPDATE buyers SET points = GREATEST(0, points - $1::float8 + $2::float8),
                 total_spend = total_spend + $3::float8,
                 tier = CASE WHEN total_spend + $3::float8 >= $5::float8 THEN 'PLATINUM'
                             WHEN total_spend + $3::float8 >= $6::float8 THEN 'GOLD'
                             WHEN total_spend + $3::float8 >= $7::float8 THEN 'SILVER' ELSE 'REGULAR' END
                 WHERE id = $4",
                &[
                    &points_used,
                    &points_earned,
                    &final_total,
                    &member_id,
                    &plat_min,
                    &gold_min,
                    &silver_min,
                ],
            )
            .await;
    }

    if let Some(items) = tx.items.as_array() {
        for item in items {
            if let (Some(id), Some(qty), Some(price)) = (
                item.get("productId").and_then(|v| v.as_str()),
                item.get("qty").and_then(|v| v.as_f64()),
                item.get("sellPrice").and_then(|v| v.as_f64()),
            ) {
                let _ = client
                    .execute(
                        "UPDATE products SET stock = GREATEST(0, stock - $1::float8), last_sell_price = $2::float8,
                         updated_at = NOW() WHERE id = $3",
                        &[&qty, &price, &id],
                    )
                    .await;
            }
        }
    }

    if let Some(ref code) = tx.discount_code {
        if !code.is_empty() && code != "MANUAL" && !code.starts_with("MEMBER-") {
            let _ = client
                .execute(
                    "UPDATE discounts SET usage_count = usage_count + 1 WHERE code = $1",
                    &[code],
                )
                .await;
        }
    }

    client.commit().await.map_err(|e| e.to_string())?;
    Ok(tx.invoice_no)
}

pub async fn pg_update_transaction_status(
    id: String,
    payment_status: String,
) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "UPDATE transactions SET payment_status = $1 WHERE id = $2",
            &[&payment_status, &id],
        )
        .await
        .map_err(|e| format!("Gagal update status transaksi di PostgreSQL: {}", e))?;

    Ok(())
}

pub async fn pg_delete_transaction(id: String) -> Result<(), String> {
    let mut connection = get_pg_client().await?;
    let db_tx = connection.transaction().await.map_err(|e| e.to_string())?;

    let row = db_tx
        .query_opt(
            "SELECT items, buyer, COALESCE(points_used, 0)::float8, COALESCE(points_earned, 0)::float8,
                    COALESCE(final_total, total_sell)::float8, discount_code
             FROM transactions WHERE id = $1",
            &[&id],
        )
        .await
        .map_err(|e| format!("Gagal membaca transaksi di PostgreSQL: {}", e))?;

    if let Some(row) = row {
        let items: serde_json::Value = row.get(0);
        let buyer: String = row.get(1);
        let points_used: f64 = row.get(2);
        let points_earned: f64 = row.get(3);
        let final_total: f64 = row.get(4);
        let discount_code: Option<String> = row.get(5);

        if let Some(arr) = items.as_array() {
            for item in arr {
                let product_id = item
                    .get("productId")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let qty = item.get("qty").and_then(|v| v.as_f64()).unwrap_or(0.0);

                if !product_id.is_empty() && qty > 0.0 {
                    let _ = db_tx
                        .execute(
                            "UPDATE products SET stock = stock + $1::float8, updated_at = NOW() WHERE id = $2",
                            &[&qty, &product_id],
                        )
                        .await;
                }
            }
        }

        if points_used > 0.0 || points_earned > 0.0 {
            let _ = db_tx
                .execute(
                    "UPDATE buyers SET 
                        points = GREATEST(0, points + $1::float8 - $2::float8),
                        total_spend = GREATEST(0, total_spend - $3::float8),
                        tier = CASE 
                            WHEN GREATEST(0, total_spend - $3::float8) >= 15000000 THEN 'PLATINUM'
                            WHEN GREATEST(0, total_spend - $3::float8) >= 5000000 THEN 'GOLD'
                            WHEN GREATEST(0, total_spend - $3::float8) >= 1000000 THEN 'SILVER'
                            ELSE 'REGULAR' END
                     WHERE name = $4 AND member_card_no IS NOT NULL",
                    &[&points_used, &points_earned, &final_total, &buyer],
                )
                .await;
        }

        if let Some(ref code) = discount_code {
            if !code.is_empty() && code != "MANUAL" && !code.starts_with("MEMBER-") {
                let _ = db_tx
                    .execute(
                        "UPDATE discounts SET usage_count = GREATEST(0, usage_count - 1) WHERE code = $1",
                        &[code],
                    )
                    .await;
            }
        }

        let _ = db_tx
            .execute("DELETE FROM transactions WHERE id = $1", &[&id])
            .await;

        db_tx.commit().await.map_err(|e| e.to_string())?;
    }

    Ok(())
}
