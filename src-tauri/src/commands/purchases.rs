use crate::db::get_pg_client;
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

async fn adjust(client: &Transaction<'_>, receipt: &Value, reverse: bool) -> Result<(), String> {
    for item in items(receipt)? {
        let id = item
            .get("productId")
            .and_then(Value::as_str)
            .ok_or("Produk tidak valid")?;
        let qty = item
            .get("qtyReceived")
            .and_then(Value::as_f64)
            .ok_or("Jumlah tidak valid")?;
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
    let client = get_pg_client().await?;
    ensure_schema(&client).await?;
    let rows = client
        .query(
            "SELECT receipt FROM purchase_receipts ORDER BY receipt->>'createdAt' DESC",
            &[],
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(rows.into_iter().map(|row| row.get(0)).collect())
}

#[tauri::command]
pub async fn db_save_purchase(receipt: Value) -> Result<(), String> {
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
        affected.extend(
            items(&previous)?
                .iter()
                .filter_map(|i| i["productId"].as_str().map(str::to_owned)),
        );
        adjust(&client, &previous, true).await?;
    }
    adjust(&client, &receipt, false).await?;
    // Check after applying both sides of an edit; intermediate reversal may be negative.
    // Include removed items as well as incoming items when validating the final stock.
    let negative = client
        .query_opt(
            "SELECT id FROM products WHERE stock < 0 AND id = ANY($1) LIMIT 1",
            &[&affected],
        )
        .await
        .map_err(|e| e.to_string())?;
    if negative.is_some() {
        return Err("Perubahan nota membuat stok negatif".into());
    }
    client.execute("INSERT INTO purchase_receipts (id, receipt) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET receipt = EXCLUDED.receipt", &[&id, &receipt]).await.map_err(|e| e.to_string())?;
    client.commit().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn db_delete_purchase(id: String) -> Result<(), String> {
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
        adjust(&client, &receipt, true).await?;
        for item in items(&receipt)? {
            let product_id = item["productId"].as_str().ok_or("Produk tidak valid")?;
            if client
                .query_opt(
                    "SELECT id FROM products WHERE id = $1 AND stock < 0",
                    &[&product_id],
                )
                .await
                .map_err(|e| e.to_string())?
                .is_some()
            {
                return Err("Nota tidak dapat dihapus karena stok sudah terpakai".into());
            }
        }
        client
            .execute("DELETE FROM purchase_receipts WHERE id = $1", &[&id])
            .await
            .map_err(|e| e.to_string())?;
    }
    client.commit().await.map_err(|e| e.to_string())
}

// Historical receipts have already affected stock. Import only their audit data.
#[tauri::command]
pub async fn db_import_purchases(receipts: Vec<Value>) -> Result<(), String> {
    let mut connection = get_pg_client().await?;
    ensure_schema(&connection).await?;
    let client = connection.transaction().await.map_err(|e| e.to_string())?;
    lock(&client).await?;
    for receipt in receipts {
        let id = receipt
            .get("id")
            .and_then(Value::as_str)
            .ok_or("ID nota tidak valid")?;
        items(&receipt)?;
        client.execute("INSERT INTO purchase_receipts (id, receipt) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING", &[&id, &receipt]).await.map_err(|e| e.to_string())?;
    }
    client.commit().await.map_err(|e| e.to_string())
}
