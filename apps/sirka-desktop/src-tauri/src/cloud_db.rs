use crate::db::get_pg_client;
use crate::models::{BuyerRecord, DiscountRecord, PreOrderRecord, ProductRecord, TransactionRecord};
use serde_json::Value;
use tokio_postgres::{Client, Transaction};

// =============================================================
// TRANSACTIONS (POSTGRESQL DIRECT METHODS)
// =============================================================

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
    // BUG FIX: field split payment / kembalian / infaq / shift / refund
    // sebelumnya dibuang serde sehingga tidak pernah sampai ke PostgreSQL.
    let is_split_payment = tx.is_split_payment.unwrap_or(false);
    let cash_amount = tx.cash_amount.unwrap_or(0.0);
    let non_cash_amount = tx.non_cash_amount.unwrap_or(0.0);
    let change_amount = tx.change_amount.unwrap_or(0.0);
    let infaq_amount = tx.infaq_amount.unwrap_or(0.0);
    let refund_status = tx
        .refund_status
        .clone()
        .unwrap_or_else(|| "NONE".to_string());
    let refund_total = tx.refund_total.unwrap_or(0.0);

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
                is_pre_order, pic_name, created_at,
                is_split_payment, cash_amount, non_cash_amount, non_cash_method,
                change_amount, infaq_amount, shift_id, refund_status, refund_total
             )
             VALUES (
                $1, $2, $3::text::date, $4, $5, $6::float8, $7::float8, $8::float8,
                $9::float8, $10, $11, $12, $13,
                $14::float8, $15, $16::float8, $17::float8, $18::float8, $19::float8,
                $20, $21, NOW(),
                $22, $23::float8, $24::float8, $25, $26::float8, $27::float8, $28, $29, $30::float8
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
                &is_split_payment,
                &cash_amount,
                &non_cash_amount,
                &tx.non_cash_method,
                &change_amount,
                &infaq_amount,
                &tx.shift_id,
                &refund_status,
                &refund_total,
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
            let pid = item.get("productId").and_then(|v| v.as_str());
            let qty = item.get("qty").and_then(|v| v.as_f64());
            let price = item.get("sellPrice").and_then(|v| v.as_f64());
            if let (Some(id), Some(qty), Some(price)) = (pid, qty, price) {
                // BUG FIX: `products.stock` disimpan dalam SATUAN DASAR, sedangkan
                // `qty` adalah jumlah dalam satuan AKTIF (mis. 1 DUS). Gunakan
                // `baseQty` (fallback qty * conversionFactor) agar PostgreSQL
                // memotong stok sebanyak yang benar-benar keluar dari rak.
                let conversion = item
                    .get("conversionFactor")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(1.0);
                let base_qty = item
                    .get("baseQty")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(qty * conversion);
                let base_qty = if base_qty.is_finite() && base_qty > 0.0 {
                    base_qty
                } else {
                    qty
                };
                // Harga jual per satuan dasar hanya relevan bila faktor konversi = 1
                let sell_price = if (conversion - 1.0).abs() < f64::EPSILON {
                    price
                } else {
                    price / conversion
                };

                let _ = client
                    .execute(
                        "UPDATE products SET stock = GREATEST(0, stock - $1::float8), last_sell_price = $2::float8,
                         updated_at = NOW() WHERE id = $3",
                        &[&base_qty, &sell_price, &id],
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

// =============================================================
// PRODUCTS (POSTGRESQL DIRECT METHODS)
// =============================================================

pub async fn pg_upsert_product(product: ProductRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    let id = product.id;

    let units_json: Option<String> = product
        .units
        .as_ref()
        .and_then(|u| serde_json::to_string(u).ok());
    let is_perishable = product.is_perishable.unwrap_or(false);

    client
        .execute(
            "INSERT INTO products (id, code, name, category, unit, default_markup_percent, last_buy_price, last_sell_price, stock, notes, barcode, units, is_perishable, supplier, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6::float8::numeric, $7::float8::numeric, $8::float8::numeric, $9::float8::numeric, $10, $11, $12::text::jsonb, $13, $14, NOW())
             ON CONFLICT (id) DO UPDATE SET
               code = EXCLUDED.code,
               name = EXCLUDED.name,
               category = EXCLUDED.category,
               unit = EXCLUDED.unit,
               default_markup_percent = EXCLUDED.default_markup_percent,
               last_buy_price = EXCLUDED.last_buy_price,
               last_sell_price = EXCLUDED.last_sell_price,
               stock = EXCLUDED.stock,
               notes = EXCLUDED.notes,
               barcode = EXCLUDED.barcode,
               units = COALESCE(EXCLUDED.units, products.units),
               is_perishable = EXCLUDED.is_perishable,
               supplier = EXCLUDED.supplier,
               updated_at = NOW()",
            &[
                &id,
                &product.code,
                &product.name,
                &product.category,
                &product.unit,
                &product.default_markup_percent,
                &product.last_buy_price,
                &product.last_sell_price,
                &product.stock,
                &product.notes,
                &product.barcode,
                &units_json,
                &is_perishable,
                &product.supplier,
            ],
        )
        .await
        .map_err(|e| {
            if let Some(dbe) = e.as_db_error() {
                format!("Gagal menyimpan produk ke PostgreSQL [{}]: {} (detail: {:?})", dbe.code().code(), dbe.message(), dbe.detail())
            } else {
                format!("Gagal menyimpan produk ke PostgreSQL: {}", e)
            }
        })?;

    Ok(id)
}

pub async fn pg_update_stock_and_price(
    product_id: String,
    added_stock: f64,
    buy_price: f64,
    sell_price: f64,
) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "UPDATE products 
             SET stock = stock + $1::float8::numeric,
                 last_buy_price = CASE WHEN $2::float8::numeric > 0 THEN $2::float8::numeric ELSE last_buy_price END,
                 last_sell_price = CASE WHEN $3::float8::numeric > 0 THEN $3::float8::numeric ELSE last_sell_price END,
                 updated_at = NOW()
             WHERE id = $4",
            &[&added_stock, &buy_price, &sell_price, &product_id],
        )
        .await
        .map_err(|e| format!("Gagal update stok ke PostgreSQL: {}", e))?;

    Ok(())
}

pub async fn pg_delete_product(product_id: String) -> Result<(), String> {
    let client = get_pg_client().await?;

    let usage = client
        .query_one(
            "SELECT COUNT(*) FROM transactions WHERE items::text LIKE '%' || $1 || '%'",
            &[&product_id],
        )
        .await
        .map_err(|e| format!("Gagal cek penggunaan produk: {}", e))?;

    let count: i64 = usage.get(0);
    if count > 0 {
        client
            .execute(
                "UPDATE products SET stock = 0, notes = COALESCE(notes, '') || ' [DIHAPUS]', updated_at = NOW() WHERE id = $1",
                &[&product_id],
            )
            .await
            .map_err(|e| format!("Gagal menonaktifkan produk di PostgreSQL: {}", e))?;
    } else {
        client
            .execute("DELETE FROM products WHERE id = $1", &[&product_id])
            .await
            .map_err(|e| format!("Gagal menghapus produk di PostgreSQL: {}", e))?;
    }

    Ok(())
}

// =============================================================
// CATEGORY MARKUPS (POSTGRESQL DIRECT METHODS)
// =============================================================

pub async fn pg_update_markup(category: String, markup_percent: f64) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "UPDATE category_markups
             SET default_markup_percent = $1::float8::numeric
             WHERE category = $2",
            &[&markup_percent, &category],
        )
        .await
        .map_err(|e| format!("Gagal update markup di PostgreSQL: {}", e))?;

    Ok(())
}

pub async fn pg_update_markup_full(
    category: String,
    markup_percent: f64,
    description: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "UPDATE category_markups
             SET default_markup_percent = $1::float8::numeric,
                 description = COALESCE($2, description),
                 color = COALESCE($3, color)
             WHERE category = $4",
            &[&markup_percent, &description, &color, &category],
        )
        .await
        .map_err(|e| format!("Gagal update markup di PostgreSQL: {}", e))?;

    Ok(())
}

pub async fn pg_create_markup(
    category: String,
    markup_percent: f64,
    description: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "INSERT INTO category_markups (category, default_markup_percent, description, color)
             VALUES ($1, $2::float8::numeric, $3, $4)
             ON CONFLICT (category) DO UPDATE SET
               default_markup_percent = EXCLUDED.default_markup_percent,
               description = COALESCE(EXCLUDED.description, category_markups.description),
               color = COALESCE(EXCLUDED.color, category_markups.color)",
            &[&category, &markup_percent, &description, &color],
        )
        .await
        .map_err(|e| format!("Gagal menambah kategori/vendor ke PostgreSQL: {}", e))?;

    Ok(())
}

pub async fn pg_delete_markup(category: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    let usage = client
        .query_one(
            "SELECT COUNT(*) FROM products WHERE category = $1",
            &[&category],
        )
        .await
        .map_err(|e| format!("Gagal cek penggunaan kategori: {}", e))?;

    let count: i64 = usage.get(0);
    if count > 0 {
        return Err(format!(
            "Kategori '{}' masih digunakan oleh {} produk di PostgreSQL.",
            category, count
        ));
    }

    client
        .execute("DELETE FROM category_markups WHERE category = $1", &[&category])
        .await
        .map_err(|e| format!("Gagal menghapus kategori/vendor dari PostgreSQL: {}", e))?;

    Ok(())
}

// =============================================================
// BUYERS (POSTGRESQL DIRECT METHODS)
// =============================================================

pub async fn pg_upsert_buyer(buyer: BuyerRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    let id = buyer.id;
    let customer_type = buyer.customer_type.unwrap_or_else(|| "B2B".to_string());
    let tier = buyer.tier.unwrap_or_else(|| "REGULAR".to_string());
    let points = buyer.points.unwrap_or(0.0);
    let total_spend = buyer.total_spend.unwrap_or(0.0);
    let member_since = buyer.member_since.clone().filter(|s| !s.trim().is_empty());

    client
        .execute(
            "INSERT INTO buyers (id, name, code, phone, address, customer_type, member_card_no, tier, points, total_spend, member_since, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::float8::numeric, $10::float8::numeric, $11::text::date, $12)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               code = EXCLUDED.code,
               phone = EXCLUDED.phone,
               address = EXCLUDED.address,
               customer_type = EXCLUDED.customer_type,
               member_card_no = EXCLUDED.member_card_no,
               tier = EXCLUDED.tier,
               points = EXCLUDED.points,
               total_spend = EXCLUDED.total_spend,
               member_since = COALESCE(EXCLUDED.member_since, buyers.member_since),
               notes = EXCLUDED.notes",
            &[
                &id,
                &buyer.name,
                &buyer.code,
                &buyer.phone,
                &buyer.address,
                &customer_type,
                &buyer.member_card_no,
                &tier,
                &points,
                &total_spend,
                &member_since,
                &buyer.notes,
            ],
        )
        .await
        .map_err(|e| format!("Gagal menyimpan data buyer ke PostgreSQL: {}", e))?;

    Ok(id)
}

pub async fn pg_delete_buyer(id: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute("DELETE FROM buyers WHERE id = $1", &[&id])
        .await
        .map_err(|e| format!("Gagal menghapus data buyer dari PostgreSQL: {}", e))?;

    Ok(())
}

// =============================================================
// PRE-ORDERS (POSTGRESQL DIRECT METHODS)
// =============================================================

fn normalize_date(raw: &str) -> String {
    let trimmed = raw.trim();
    let bytes = trimmed.as_bytes();
    let valid = bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(i, c)| i == 4 || i == 7 || c.is_ascii_digit());
    if valid {
        trimmed.to_string()
    } else {
        chrono::Local::now().format("%Y-%m-%d").to_string()
    }
}

pub async fn pg_save_preorder(record: PreOrderRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    let date_str = normalize_date(&record.date);
    client
        .execute(
            "INSERT INTO pre_orders (id, date, day_name, buyer, items, is_loaded_to_pos)
             VALUES ($1, $2::text::date, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               date = EXCLUDED.date,
               day_name = EXCLUDED.day_name,
               buyer = EXCLUDED.buyer,
               items = EXCLUDED.items,
               is_loaded_to_pos = EXCLUDED.is_loaded_to_pos",
            &[
                &record.id,
                &date_str,
                &record.day_name,
                &record.buyer,
                &record.items,
                &record.is_loaded_to_pos,
            ],
        )
        .await
        .map_err(|e| format!("Gagal simpan pre-order ke PostgreSQL: {}", e))?;

    Ok(record.id)
}

pub async fn pg_delete_preorder(id: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute("DELETE FROM pre_orders WHERE id = $1", &[&id])
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// =============================================================
// PURCHASES (POSTGRESQL DIRECT METHODS)
// =============================================================

async fn ensure_purchases_schema(client: &Client) -> Result<(), String> {
    client
        .batch_execute(include_str!("../../db/purchases.sql"))
        .await
        .map_err(|e| e.to_string())
}

async fn lock_purchases(client: &Transaction<'_>) -> Result<(), String> {
    client
        .query_one("SELECT pg_advisory_xact_lock(73619204)", &[])
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn purchase_items(receipt: &Value) -> Result<&Vec<Value>, String> {
    receipt
        .get("items")
        .and_then(Value::as_array)
        .ok_or("Item nota tidak valid".into())
}

async fn read_pg_purchase_items(
    client: &Transaction<'_>,
    receipt_id: &str,
) -> Result<Vec<Value>, String> {
    let rows = client
        .query(
            "SELECT id, product_id, code, name, category, unit,
                    qty_received::float8, buy_price::float8, subtotal_buy::float8,
                    markup_percent::float8, new_sell_price::float8,
                    base_qty::float8, conversion_factor::float8
             FROM purchase_receipt_items WHERE receipt_id = $1
             ORDER BY created_at ASC, id ASC",
            &[&receipt_id],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows
        .iter()
        .map(|r| {
            serde_json::json!({
                "id": r.get::<_, Option<String>>(0).unwrap_or_default(),
                "productId": r.get::<_, Option<String>>(1).unwrap_or_default(),
                "code": r.get::<_, Option<String>>(2).unwrap_or_default(),
                "name": r.get::<_, Option<String>>(3).unwrap_or_default(),
                "category": r.get::<_, Option<String>>(4).unwrap_or_default(),
                "unit": r.get::<_, Option<String>>(5).unwrap_or_default(),
                "qtyReceived": r.get::<_, Option<f64>>(6).unwrap_or(0.0),
                "buyPrice": r.get::<_, Option<f64>>(7).unwrap_or(0.0),
                "subtotalBuy": r.get::<_, Option<f64>>(8).unwrap_or(0.0),
                "markupPercent": r.get::<_, Option<f64>>(9).unwrap_or(0.0),
                "newSellPrice": r.get::<_, Option<f64>>(10).unwrap_or(0.0),
                "baseQty": r.get::<_, Option<f64>>(11).unwrap_or(0.0),
                "conversionFactor": r.get::<_, Option<f64>>(12).unwrap_or(1.0),
            })
        })
        .collect())
}

fn receipt_item_base_qty(item: &Value) -> Option<f64> {
    let qty = item.get("qtyReceived").and_then(Value::as_f64)?;
    let factor = item
        .get("conversionFactor")
        .and_then(Value::as_f64)
        .unwrap_or(1.0);
    let base = item
        .get("baseQty")
        .and_then(Value::as_f64)
        .unwrap_or(qty * factor);
    Some(if base.is_finite() && base > 0.0 { base } else { qty })
}

async fn adjust_purchase_items(
    client: &Transaction<'_>,
    items: &[Value],
    reverse: bool,
) -> Result<(), String> {
    for item in items {
        let id = item
            .get("productId")
            .and_then(Value::as_str)
            .ok_or("Produk tidak valid")?;
        let qty = receipt_item_base_qty(item).ok_or("Jumlah tidak valid")?;
        let buy = item
            .get("buyPrice")
            .and_then(Value::as_f64)
            .ok_or("Harga beli tidak valid")?;
        let sell = item
            .get("newSellPrice")
            .and_then(Value::as_f64)
            .ok_or("Harga jual tidak valid")?;
        if !qty.is_finite()
            || qty <= 0.0
            || !buy.is_finite()
            || buy < 0.0
            || !sell.is_finite()
            || sell < 0.0
        {
            return Err("Jumlah atau harga nota tidak valid".into());
        }
        let delta = if reverse { -qty } else { qty };
        let changed = client
            .execute(
                "UPDATE products SET stock = stock + $1::float8,
             last_buy_price = CASE WHEN $4 THEN last_buy_price ELSE $2::float8 END,
             last_sell_price = CASE WHEN $4 THEN last_sell_price ELSE $3::float8 END,
             updated_at = NOW() WHERE id = $5",
                &[&delta, &buy, &sell, &reverse, &id],
            )
            .await
            .map_err(|e| e.to_string())?;
        if changed != 1 {
            return Err(format!("Produk {} tidak ditemukan", id));
        }
    }
    Ok(())
}

async fn adjust_purchase(client: &Transaction<'_>, receipt: &Value, reverse: bool) -> Result<(), String> {
    adjust_purchase_items(client, purchase_items(receipt)?, reverse).await
}

pub async fn pg_save_purchase(receipt: Value) -> Result<(), String> {
    let id = receipt
        .get("id")
        .and_then(Value::as_str)
        .ok_or("ID nota tidak valid")?;
    if purchase_items(&receipt)?.is_empty() {
        return Err("Nota kosong".into());
    }
    let mut connection = get_pg_client().await?;
    ensure_purchases_schema(&connection).await?;
    let client = connection.transaction().await.map_err(|e| e.to_string())?;
    lock_purchases(&client).await?;
    let mut affected: Vec<String> = purchase_items(&receipt)?
        .iter()
        .filter_map(|i| i["productId"].as_str().map(str::to_owned))
        .collect();
    if let Some(row) = client
        .query_opt(
            "SELECT receipt FROM purchase_receipts WHERE id = $1 FOR UPDATE",
            &[&id],
        )
        .await
        .map_err(|e| e.to_string())?
    {
        let previous: Value = row.get(0);
        let mut previous_items = read_pg_purchase_items(&client, &id).await.unwrap_or_default();
        if previous_items.is_empty() {
            previous_items = purchase_items(&previous)?.clone();
        }
        affected.extend(
            previous_items
                .iter()
                .filter_map(|i| i["productId"].as_str().map(str::to_owned)),
        );
        let _ = adjust_purchase_items(&client, &previous_items, true).await;
    }
    let _ = adjust_purchase(&client, &receipt, false).await;
    let supplier_inv = receipt.get("supplierInvoiceNo").and_then(Value::as_str);
    let r_date = receipt.get("date").and_then(Value::as_str);
    let supplier = receipt.get("supplier").and_then(Value::as_str);
    let total_buy = receipt.get("totalBuy").and_then(Value::as_f64).unwrap_or(0.0);
    let notes = receipt.get("notes").and_then(Value::as_str);

    client
        .execute(
            "INSERT INTO purchase_receipts (id, supplier_invoice_no, date, supplier, total_buy, notes, receipt)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET
                 supplier_invoice_no = EXCLUDED.supplier_invoice_no,
                 date = EXCLUDED.date,
                 supplier = EXCLUDED.supplier,
                 total_buy = EXCLUDED.total_buy,
                 notes = EXCLUDED.notes,
                 receipt = EXCLUDED.receipt",
            &[&id, &supplier_inv, &r_date, &supplier, &total_buy, &notes, &receipt],
        )
        .await
        .map_err(|e| e.to_string())?;

    client
        .execute("DELETE FROM purchase_receipt_items WHERE receipt_id = $1", &[&id])
        .await
        .map_err(|e| e.to_string())?;

    for item in purchase_items(&receipt)? {
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

        client
            .execute(
                "INSERT INTO purchase_receipt_items (
                    id, receipt_id, product_id, code, name, category, unit,
                    qty_received, base_qty, conversion_factor, buy_price, subtotal_buy,
                    markup_percent, new_sell_price
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)",
                &[
                    &item_uuid, &id, &pid, &code, &name, &category, &unit, &qty, &base_qty,
                    &factor, &buy, &subtotal, &markup, &sell
                ],
            )
            .await
            .map_err(|e| e.to_string())?;
    }

    client.commit().await.map_err(|e| e.to_string())
}

pub async fn pg_delete_purchase(id: String) -> Result<(), String> {
    let mut connection = get_pg_client().await?;
    ensure_purchases_schema(&connection).await?;
    let client = connection.transaction().await.map_err(|e| e.to_string())?;
    lock_purchases(&client).await?;
    if let Some(row) = client
        .query_opt(
            "SELECT receipt FROM purchase_receipts WHERE id = $1 FOR UPDATE",
            &[&id],
        )
        .await
        .map_err(|e| e.to_string())?
    {
        let receipt: Value = row.get(0);
        let mut receipt_items = read_pg_purchase_items(&client, &id).await.unwrap_or_default();
        if receipt_items.is_empty() {
            receipt_items = purchase_items(&receipt)?.clone();
        }
        let _ = adjust_purchase_items(&client, &receipt_items, true).await;
        client
            .execute("DELETE FROM purchase_receipt_items WHERE receipt_id = $1", &[&id])
            .await
            .map_err(|e| e.to_string())?;
        client
            .execute("DELETE FROM purchase_receipts WHERE id = $1", &[&id])
            .await
            .map_err(|e| e.to_string())?;
    }
    client.commit().await.map_err(|e| e.to_string())
}

// =============================================================
// DISCOUNTS (POSTGRESQL DIRECT METHODS)
// =============================================================

pub async fn pg_upsert_discount(discount: DiscountRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    let id = discount.id;

    client
        .execute(
            "INSERT INTO discounts (
                id, code, name, type, value, min_purchase, max_discount, 
                scope, target_category, target_customer_type, is_active, description, usage_count
             )
             VALUES ($1, UPPER($2), $3, $4, $5::float8::numeric, $6::float8::numeric, $7::float8::numeric, $8, $9, $10, $11, $12, COALESCE($13, 0))
             ON CONFLICT (id) DO UPDATE SET
               code = UPPER(EXCLUDED.code),
               name = EXCLUDED.name,
               type = EXCLUDED.type,
               value = EXCLUDED.value,
               min_purchase = EXCLUDED.min_purchase,
               max_discount = EXCLUDED.max_discount,
               scope = EXCLUDED.scope,
               target_category = EXCLUDED.target_category,
               target_customer_type = EXCLUDED.target_customer_type,
               is_active = EXCLUDED.is_active,
               description = EXCLUDED.description,
               usage_count = COALESCE(EXCLUDED.usage_count, discounts.usage_count)",
            &[
                &id,
                &discount.code,
                &discount.name,
                &discount.r#type,
                &discount.value,
                &discount.min_purchase,
                &discount.max_discount,
                &discount.scope,
                &discount.target_category,
                &discount.target_customer_type,
                &discount.is_active,
                &discount.description,
                &discount.usage_count.unwrap_or(0),
            ],
        )
        .await
        .map_err(|e| format!("Gagal menyimpan diskon ke PostgreSQL: {}", e))?;

    Ok(id)
}

pub async fn pg_delete_discount(id: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute("DELETE FROM discounts WHERE id = $1", &[&id])
        .await
        .map_err(|e| format!("Gagal menghapus diskon dari PostgreSQL: {}", e))?;
    Ok(())
}

pub async fn pg_toggle_discount(id: String, is_active: bool) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute("UPDATE discounts SET is_active = $1 WHERE id = $2", &[&is_active, &id])
        .await
        .map_err(|e| format!("Gagal mengubah status diskon di PostgreSQL: {}", e))?;
    Ok(())
}

// =============================================================
// SETTINGS (POSTGRESQL DIRECT METHODS)
// =============================================================

pub async fn pg_update_setting(key: String, value: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "INSERT INTO store_settings (key, value, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()",
            &[&key, &value],
        )
        .await
        .map_err(|e| format!("Gagal menyimpan pengaturan ke PostgreSQL {}: {}", key, e))?;

    Ok(())
}
