use crate::db::get_pg_client;
use crate::models::TransactionRecord;

#[tauri::command]
pub async fn db_get_transactions() -> Result<Vec<TransactionRecord>, String> {
    let client = get_pg_client().await?;
    let rows = client
        .query(
            "SELECT id, invoice_no, date::text, buyer, items, 
                    total_buy::float8, total_sell::float8, total_profit::float8, profit_percent::float8,
                    payment_status, payment_method, customer_type, notes, created_at::text,
                    COALESCE(discount_amount, 0)::float8, discount_code,
                    COALESCE(points_used, 0)::float8, COALESCE(points_discount, 0)::float8,
                    COALESCE(points_earned, 0)::float8, COALESCE(final_total, total_sell)::float8
             FROM transactions 
             ORDER BY created_at DESC",
            &[],
        )
        .await
        .map_err(|e| format!("Gagal memuat transaksi: {}", e))?;

    let txs = rows
        .into_iter()
        .map(|r| TransactionRecord {
            id: r.get(0),
            invoice_no: r.get(1),
            date: r.get(2),
            buyer: r.get(3),
            items: r.get(4),
            total_buy: r.get(5),
            total_sell: r.get(6),
            total_profit: r.get(7),
            profit_percent: r.get(8),
            payment_status: r.get(9),
            payment_method: r.get(10),
            customer_type: r.get(11),
            notes: r.get(12),
            created_at: r.get(13),
            discount_amount: r.get(14),
            discount_code: r.get(15),
            points_used: r.get(16),
            points_discount: r.get(17),
            points_earned: r.get(18),
            final_total: r.get(19),
        })
        .collect();

    Ok(txs)
}

#[tauri::command]
pub async fn db_create_transaction(tx: TransactionRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    let customer_type = tx.customer_type.unwrap_or_else(|| "B2B".to_string());
    let discount_amount = tx.discount_amount.unwrap_or(0.0);
    let points_used = tx.points_used.unwrap_or(0.0);
    let points_discount = tx.points_discount.unwrap_or(0.0);
    let points_earned = tx.points_earned.unwrap_or(0.0);
    let final_total = tx.final_total.unwrap_or(tx.total_sell);

    client
        .execute(
            "INSERT INTO transactions (
                id, invoice_no, date, buyer, items, total_buy, total_sell, total_profit, 
                profit_percent, payment_status, payment_method, customer_type, notes, 
                discount_amount, discount_code, points_used, points_discount, points_earned, final_total, 
                created_at
             )
             VALUES (
                $1, $2, $3::date, $4, $5, $6::numeric, $7::numeric, $8::numeric, 
                $9::numeric, $10, $11, $12, $13, 
                $14::numeric, $15, $16::numeric, $17::numeric, $18::numeric, $19::numeric, 
                NOW()
             )
             ON CONFLICT (id) DO UPDATE SET
               buyer = EXCLUDED.buyer,
               payment_status = EXCLUDED.payment_status,
               payment_method = EXCLUDED.payment_method,
               customer_type = EXCLUDED.customer_type",
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
            ],
        )
        .await
        .map_err(|e| format!("Gagal simpan transaksi: {}", e))?;

    // Kurangi stok barang & perbarui harga jual terakhir
    if let Some(items_array) = tx.items.as_array() {
        for item in items_array {
            if let (Some(prod_id), Some(qty), Some(sell_price)) = (
                item.get("productId").and_then(|v| v.as_str()),
                item.get("quantity").and_then(|v| v.as_f64()),
                item.get("sellPrice").and_then(|v| v.as_f64()),
            ) {
                let _ = client
                    .execute(
                        "UPDATE products 
                         SET stock = GREATEST(0, stock - $1::numeric),
                             last_sell_price = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE last_sell_price END,
                             updated_at = NOW() 
                         WHERE id = $3",
                        &[&qty, &sell_price, &prod_id],
                    )
                    .await;
            }
        }
    }

    Ok(tx.invoice_no)
}

#[tauri::command]
pub async fn db_update_transaction_status(id: String, payment_status: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "UPDATE transactions SET payment_status = $1 WHERE id = $2",
            &[&payment_status, &id],
        )
        .await
        .map_err(|e| format!("Gagal update status transaksi: {}", e))?;

    Ok(())
}
