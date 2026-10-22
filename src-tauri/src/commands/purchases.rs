use crate::db::get_pg_client;
use crate::local_db::{
    get_conn, local_delete_purchase, local_get_purchases, local_save_purchase,
};
use serde_json::Value;
use tokio_postgres::{Client, Transaction};

async fn ensure_schema(client: &Client) -> Result<(), String> {
    client
        .batch_execute(include_str!("../../../db/purchases.sql"))
        .await
        .map_err(|e| e.to_string())
}

async fn lock(client: &Transaction<'_>) -> Result<(), String> {
    client
        .query_one("SELECT pg_advisory_xact_lock(73619204)", &[])
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn items(receipt: &Value) -> Result<&Vec<Value>, String> {
    receipt
        .get("items")
        .and_then(Value::as_array)
        .ok_or("Item nota tidak valid".into())
}

/// BUG-017 FIX: Baca item nota dari tabel ternormalisasi `purchase_receipt_items`.
/// Bentuk JSON-nya sama dengan `PurchaseReceiptItem` (src/types/index.ts).
async fn read_pg_items(
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

/// BUG FIX: kuantitas adjusting stok harus dalam SATUAN DASAR produk.
/// `qtyReceived` adalah jumlah fisik dalam satuan kemasan (mis. 5 DUS),
/// sedangkan `products.stock` disimpan dalam satuan dasar (mis. 200 PCS).
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

async fn adjust(client: &Transaction<'_>, receipt: &Value, reverse: bool) -> Result<(), String> {
    adjust_items(client, items(receipt)?, reverse).await
}

/// BUG-017 FIX: Penyesuaian stok/produk berbasis item dari tabel ternormalisasi.
async fn adjust_items(
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

#[tauri::command]
pub async fn db_get_purchases() -> Result<Vec<Value>, String> {
    let conn = get_conn().lock().unwrap();
    let list = local_get_purchases(&conn).map_err(|e| e.to_string())?;
    Ok(list)
}

#[tauri::command]
pub async fn db_save_purchase(receipt: Value) -> Result<(), String> {
    {
        let mut conn = get_conn().lock().unwrap();
        local_save_purchase(&mut conn, &receipt)
            .map_err(|e| format!("Gagal menyimpan nota kulakan di database lokal: {}", e))?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

#[tauri::command]
pub async fn db_delete_purchase(id: String) -> Result<(), String> {
    {
        let mut conn = get_conn().lock().unwrap();
        local_delete_purchase(&mut conn, &id)
            .map_err(|e| format!("Gagal menghapus nota kulakan di database lokal: {}", e))?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

#[tauri::command]
pub async fn db_import_purchases(receipts: Vec<Value>) -> Result<(), String> {
    {
        let mut conn = get_conn().lock().unwrap();
        for r in &receipts {
            let _ = local_save_purchase(&mut conn, r);
        }
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

// -------------------------------------------------------------
// POSTGRES DIRECT METHODS (Called by sync engine when online)
// -------------------------------------------------------------
pub async fn pg_save_purchase(receipt: Value) -> Result<(), String> {
    let id = receipt
        .get("id")
        .and_then(Value::as_str)
        .ok_or("ID nota tidak valid")?;
    if items(&receipt)?.is_empty() {
        return Err("Nota kosong".into());
    }
    let mut connection = get_pg_client().await?;
    ensure_schema(&connection).await?;
    let client = connection.transaction().await.map_err(|e| e.to_string())?;
    lock(&client).await?;
    let mut affected: Vec<String> = items(&receipt)?
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
        // BUG-017 FIX: item sebelumnya diambil dari tabel ternormalisasi;
        // fallback ke JSONB hanya untuk nota legacy yang belum dinormalisasi.
        let mut previous_items = read_pg_items(&client, &id).await.unwrap_or_default();
        if previous_items.is_empty() {
            previous_items = items(&previous)?.clone();
        }
        affected.extend(
            previous_items
                .iter()
                .filter_map(|i| i["productId"].as_str().map(str::to_owned)),
        );
        let _ = adjust_items(&client, &previous_items, true).await;
    }
    let _ = adjust(&client, &receipt, false).await;
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

    for item in items(&receipt)? {
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
    ensure_schema(&connection).await?;
    let client = connection.transaction().await.map_err(|e| e.to_string())?;
    lock(&client).await?;
    if let Some(row) = client
        .query_opt(
            "SELECT receipt FROM purchase_receipts WHERE id = $1 FOR UPDATE",
            &[&id],
        )
        .await
        .map_err(|e| e.to_string())?
    {
        let receipt: Value = row.get(0);
        // BUG-017 FIX: item dari tabel ternormalisasi; fallback JSONB untuk nota legacy
        let mut receipt_items = read_pg_items(&client, &id).await.unwrap_or_default();
        if receipt_items.is_empty() {
            receipt_items = items(&receipt)?.clone();
        }
        let _ = adjust_items(&client, &receipt_items, true).await;
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
