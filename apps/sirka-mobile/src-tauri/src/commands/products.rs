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

