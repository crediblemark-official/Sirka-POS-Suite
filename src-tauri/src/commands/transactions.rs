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
                    COALESCE(points_earned, 0)::float8, COALESCE(final_total, total_sell)::float8,
                    COALESCE(is_pre_order, FALSE),
                    pic_name
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
            is_pre_order: r.get(20),
            pic_name: r.get(21),
        })
        .collect();

    Ok(txs)
}

#[tauri::command]
pub async fn db_create_transaction(
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

    if [points_used, points_earned, final_total]
        .iter()
        .any(|v| !v.is_finite() || *v < 0.0)
    {
        return Err("Poin atau total transaksi tidak valid".into());
    }

    // BUG-001 FIX: Cek duplikat ID dan invoice_no sebelum insert, bukan ON CONFLICT DO NOTHING
    let existing = client
        .query_opt(
            "SELECT id FROM transactions WHERE id = $1 OR invoice_no = $2",
            &[&tx.id, &tx.invoice_no],
        )
        .await
        .map_err(|e| format!("Gagal cek duplikat transaksi: {}", e))?;

    if existing.is_some() {
        return Err(format!(
            "Transaksi dengan ID {} atau invoice {} sudah ada. Silakan coba lagi.",
            tx.id, tx.invoice_no
        ));
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
        .map_err(|e| format!("Gagal simpan transaksi: {}", e))?;

    if let Some(member_id) = member_id {
        let changed = client
            .execute(
                "UPDATE buyers SET points = points - $1::float8 + $2::float8,
             total_spend = total_spend + $3::float8,
             tier = CASE WHEN total_spend + $3::float8 >= 15000000 THEN 'PLATINUM'
                         WHEN total_spend + $3::float8 >= 5000000 THEN 'GOLD'
                         WHEN total_spend + $3::float8 >= 1000000 THEN 'SILVER' ELSE 'REGULAR' END
             WHERE id = $4 AND name = $5 AND member_card_no IS NOT NULL AND points >= $1::float8",
                &[
                    &points_used,
                    &points_earned,
                    &final_total,
                    &member_id,
                    &tx.buyer,
                ],
            )
            .await
            .map_err(|e| e.to_string())?;
        if changed != 1 {
            return Err("Member tidak ditemukan atau poin tidak cukup".into());
        }
    } else if points_used > 0.0 || points_earned > 0.0 {
        return Err("Member wajib dipilih untuk transaksi poin".into());
    }

    // Kurangi stok barang & perbarui harga jual terakhir
    let items = tx.items.as_array().ok_or("Item transaksi tidak valid")?;
    if items.is_empty() {
        return Err("Keranjang kosong".into());
    }
    for item in items {
        let id = item
            .get("productId")
            .and_then(|v| v.as_str())
            .ok_or("Produk tidak valid")?;
        let qty = item
            .get("qty")
            .and_then(|v| v.as_f64())
            .ok_or("Jumlah tidak valid")?;
        let price = item
            .get("sellPrice")
            .and_then(|v| v.as_f64())
            .ok_or("Harga tidak valid")?;
        if !qty.is_finite() || qty <= 0.0 || !price.is_finite() || price < 0.0 {
            return Err("Jumlah atau harga tidak valid".into());
        }
        let changed = client
            .execute(
                "UPDATE products SET stock = stock - $1::float8, last_sell_price = $2::float8,
             updated_at = NOW() WHERE id = $3 AND stock >= $1::float8",
                &[&qty, &price, &id],
            )
            .await
            .map_err(|e| e.to_string())?;
        if changed != 1 {
            return Err(format!(
                "Produk {} tidak ditemukan atau stok tidak cukup",
                id
            ));
        }
    }

    // BUG-010 FIX: Increment usage_count kupon jika digunakan
    if let Some(ref code) = tx.discount_code {
        if !code.is_empty() && code != "MANUAL" && !code.starts_with("MEMBER-") {
            client
                .execute(
                    "UPDATE discounts SET usage_count = usage_count + 1 WHERE code = $1",
                    &[code],
                )
                .await
                .map_err(|e| format!("Gagal update penggunaan kupon: {}", e))?;
        }
    }

    client.commit().await.map_err(|e| e.to_string())?;

    Ok(tx.invoice_no)
}

#[tauri::command]
pub async fn db_update_transaction_status(
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
        .map_err(|e| format!("Gagal update status transaksi: {}", e))?;

    Ok(())
}

// BUG-007 FIX: Hapus transaksi dengan pemulihan stok dan poin member
#[tauri::command]
pub async fn db_delete_transaction(id: String) -> Result<(), String> {
    let mut connection = get_pg_client().await?;
    let db_tx = connection.transaction().await.map_err(|e| e.to_string())?;

    // Ambil data transaksi sebelum dihapus untuk rollback stok & poin
    let row = db_tx
        .query_opt(
            "SELECT items, buyer, COALESCE(points_used, 0)::float8, COALESCE(points_earned, 0)::float8,
                    COALESCE(final_total, total_sell)::float8, discount_code
             FROM transactions WHERE id = $1",
            &[&id],
        )
        .await
        .map_err(|e| format!("Gagal membaca transaksi: {}", e))?;

    let row = row.ok_or_else(|| format!("Transaksi {} tidak ditemukan", id))?;

    let items: serde_json::Value = row.get(0);
    let buyer: String = row.get(1);
    let points_used: f64 = row.get(2);
    let points_earned: f64 = row.get(3);
    let final_total: f64 = row.get(4);
    let discount_code: Option<String> = row.get(5);

    // 1. Kembalikan stok per item
    if let Some(arr) = items.as_array() {
        for item in arr {
            let product_id = item
                .get("productId")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let qty = item.get("qty").and_then(|v| v.as_f64()).unwrap_or(0.0);

            if !product_id.is_empty() && qty > 0.0 {
                db_tx
                    .execute(
                        "UPDATE products SET stock = stock + $1::float8, updated_at = NOW() WHERE id = $2",
                        &[&qty, &product_id],
                    )
                    .await
                    .map_err(|e| format!("Gagal kembalikan stok produk {}: {}", product_id, e))?;
            }
        }
    }

    // 2. Pulihkan poin & spend member (balik: +points_used, -points_earned, -final_total dari spend)
    if points_used > 0.0 || points_earned > 0.0 {
        db_tx
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
            .await
            .map_err(|e| format!("Gagal pulihkan poin member: {}", e))?;
    }

    // 3. Kurangi usage_count kupon jika digunakan
    if let Some(ref code) = discount_code {
        if !code.is_empty() && code != "MANUAL" && !code.starts_with("MEMBER-") {
            db_tx
                .execute(
                    "UPDATE discounts SET usage_count = GREATEST(0, usage_count - 1) WHERE code = $1",
                    &[code],
                )
                .await
                .map_err(|e| format!("Gagal pulihkan penggunaan kupon: {}", e))?;
        }
    }

    // 4. Hapus transaksi
    db_tx
        .execute("DELETE FROM transactions WHERE id = $1", &[&id])
        .await
        .map_err(|e| format!("Gagal menghapus transaksi: {}", e))?;

    db_tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}
