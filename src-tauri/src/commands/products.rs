use crate::db::get_pg_client;
use crate::models::ProductRecord;

#[tauri::command]
pub async fn db_get_products() -> Result<Vec<ProductRecord>, String> {
    let client = get_pg_client().await?;
    let rows = client
        .query(
            "SELECT id, code, name, category, unit, 
                    default_markup_percent::float8, 
                    last_buy_price::float8, 
                    last_sell_price::float8, 
                    stock::float8, 
                    notes 
             FROM products 
             ORDER BY category, name",
            &[],
        )
        .await
        .map_err(|e| format!("Gagal memuat produk: {}", e))?;

    let products = rows
        .into_iter()
        .map(|r| ProductRecord {
            id: r.get(0),
            code: r.get(1),
            name: r.get(2),
            category: r.get(3),
            unit: r.get(4),
            default_markup_percent: r.get(5),
            last_buy_price: r.get(6),
            last_sell_price: r.get(7),
            stock: r.get(8),
            notes: r.get(9),
        })
        .collect();

    Ok(products)
}

#[tauri::command]
pub async fn db_upsert_product(product: ProductRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    let id = if product.id.is_empty() {
        format!("prod-{}", chrono::Utc::now().timestamp_millis())
    } else {
        product.id
    };

    client
        .execute(
            "INSERT INTO products (id, code, name, category, unit, default_markup_percent, last_buy_price, last_sell_price, stock, notes, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric, $9::numeric, $10, NOW())
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
            ],
        )
        .await
        .map_err(|e| format!("Gagal menyimpan produk: {}", e))?;

    Ok(id)
}

#[tauri::command]
pub async fn db_update_stock_and_price(
    product_id: String,
    added_stock: f64,
    buy_price: f64,
    sell_price: f64,
) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "UPDATE products 
             SET stock = stock + $1::numeric,
                 last_buy_price = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE last_buy_price END,
                 last_sell_price = CASE WHEN $3::numeric > 0 THEN $3::numeric ELSE last_sell_price END,
                 updated_at = NOW()
             WHERE id = $4",
            &[&added_stock, &buy_price, &sell_price, &product_id],
        )
        .await
        .map_err(|e| format!("Gagal update stok supplier: {}", e))?;

    Ok(())
}
