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
pub async fn db_create_transaction(tx: TransactionRecord, member_id: Option<String>) -> Result<String, String> {
    let mut connection = get_pg_client().await?;
    let client = connection.transaction().await.map_err(|e| e.to_string())?;
    let customer_type = tx.customer_type.unwrap_or_else(|| "B2B".to_string());
    let discount_amount = tx.discount_amount.unwrap_or(0.0);
    let points_used = tx.points_used.unwrap_or(0.0);
    let points_discount = tx.points_discount.unwrap_or(0.0);
    let points_earned = tx.points_earned.unwrap_or(0.0);
    let final_total = tx.final_total.unwrap_or(tx.total_sell);

    let inserted = client
        .execute(
            "INSERT INTO transactions (
                id, invoice_no, date, buyer, items, total_buy, total_sell, total_profit, 
                profit_percent, payment_status, payment_method, customer_type, notes, 
                discount_amount, discount_code, points_used, points_discount, points_earned, final_total, 
                created_at
             )
             VALUES (
                $1, $2, $3::text::date, $4, $5, $6::float8, $7::float8, $8::float8, 
                $9::float8, $10, $11, $12, $13, 
                $14::float8, $15, $16::float8, $17::float8, $18::float8, $19::float8, 
                NOW()
             )
             ON CONFLICT (id) DO NOTHING",
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

    if inserted == 0 { return Ok(tx.invoice_no); }
    if let Some(member_id) = member_id {
        let changed = client.execute(
            "UPDATE buyers SET points = points - $1::float8 + $2::float8,
             total_spend = total_spend + $3::float8,
             tier = CASE WHEN total_spend + $3::float8 >= 15000000 THEN 'PLATINUM'
                         WHEN total_spend + $3::float8 >= 5000000 THEN 'GOLD'
                         WHEN total_spend + $3::float8 >= 1000000 THEN 'SILVER' ELSE 'REGULAR' END
             WHERE id = $4 AND member_card_no IS NOT NULL AND points >= $1::float8",
            &[&points_used, &points_earned, &final_total, &member_id]
        ).await.map_err(|e| e.to_string())?;
        if changed != 1 { return Err("Member tidak ditemukan atau poin tidak cukup".into()); }
    } else if points_used > 0.0 || points_earned > 0.0 {
        return Err("Member wajib dipilih untuk transaksi poin".into());
    }
    // Kurangi stok barang & perbarui harga jual terakhir
    let items = tx.items.as_array().ok_or("Item transaksi tidak valid")?;
    if items.is_empty() { return Err("Keranjang kosong".into()); }
    for item in items {
        let id = item.get("productId").and_then(|v| v.as_str()).ok_or("Produk tidak valid")?;
        let qty = item.get("qty").and_then(|v| v.as_f64()).ok_or("Jumlah tidak valid")?;
        let price = item.get("sellPrice").and_then(|v| v.as_f64()).ok_or("Harga tidak valid")?;
        if !qty.is_finite() || qty <= 0.0 || !price.is_finite() || price < 0.0 {
            return Err("Jumlah atau harga tidak valid".into());
        }
        let changed = client.execute(
            "UPDATE products SET stock = stock - $1::float8, last_sell_price = $2::float8,
             updated_at = NOW() WHERE id = $3 AND stock >= $1::float8",
            &[&qty, &price, &id]
        ).await.map_err(|e| e.to_string())?;
        if changed != 1 { return Err(format!("Produk {} tidak ditemukan atau stok tidak cukup", id)); }
    }
    client.commit().await.map_err(|e| e.to_string())?;

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

#[tauri::command]
pub async fn db_delete_transaction(id: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client.execute("DELETE FROM transactions WHERE id = $1", &[&id]).await.map_err(|e| e.to_string())?;
    Ok(())
}
