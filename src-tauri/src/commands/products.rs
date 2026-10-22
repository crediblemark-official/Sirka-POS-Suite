use crate::db::get_pg_client;
use crate::local_db::{
    enqueue_outbox, get_conn, local_delete_product, local_get_products,
    local_update_stock_and_price, local_upsert_product,
};
use crate::models::ProductRecord;

#[tauri::command]
pub async fn db_get_products() -> Result<Vec<ProductRecord>, String> {
    let conn = get_conn().lock().unwrap();
    let prods = local_get_products(&conn).map_err(|e| e.to_string())?;
    Ok(prods)
}

#[tauri::command]
pub async fn db_upsert_product(product: ProductRecord) -> Result<String, String> {
    let id = if product.id.is_empty() {
        format!("prod-{}", uuid::Uuid::new_v4())
    } else {
        product.id.clone()
    };
    let mut p = product;
    p.id = id.clone();

    {
        let conn = get_conn().lock().unwrap();
        local_upsert_product(&conn, &p).map_err(|e| e.to_string())?;
        enqueue_outbox(&conn, "UPSERT_PRODUCT", &serde_json::json!({ "product": p }))
            .map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(id)
}

#[tauri::command]
pub async fn db_update_stock_and_price(
    product_id: String,
    added_stock: f64,
    buy_price: f64,
    sell_price: f64,
) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_update_stock_and_price(&conn, &product_id, added_stock, buy_price, sell_price)
            .map_err(|e| e.to_string())?;
        enqueue_outbox(
            &conn,
            "UPDATE_STOCK_AND_PRICE",
            &serde_json::json!({
                "productId": product_id,
                "addedStock": added_stock,
                "buyPrice": buy_price,
                "sellPrice": sell_price,
            }),
        )
        .map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

#[tauri::command]
pub async fn db_delete_product(product_id: String) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_delete_product(&conn, &product_id).map_err(|e| e.to_string())?;
        enqueue_outbox(
            &conn,
            "DELETE_PRODUCT",
            &serde_json::json!({ "id": product_id }),
        )
        .map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

// -------------------------------------------------------------
// POSTGRES DIRECT METHODS (Called by sync engine when online)
// -------------------------------------------------------------
pub async fn pg_upsert_product(product: ProductRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    let id = product.id;

    // BUG FIX: multi-satuan (units) & penanda mudah busuk harus ikut tersimpan
    // ke PostgreSQL, kalau tidak fitur jual per DUS/SAK/PETI hilang saat sinkron.
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
