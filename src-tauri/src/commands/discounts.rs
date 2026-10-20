use crate::db::get_pg_client;
use crate::local_db::{
    get_conn, local_delete_discount, local_get_discounts, local_toggle_discount,
    local_upsert_discount,
};
use crate::models::DiscountRecord;

#[tauri::command]
pub async fn db_get_discounts() -> Result<Vec<DiscountRecord>, String> {
    let conn = get_conn().lock().unwrap();
    let list = local_get_discounts(&conn).map_err(|e| e.to_string())?;
    Ok(list)
}

#[tauri::command]
pub async fn db_upsert_discount(discount: DiscountRecord) -> Result<String, String> {
    let id = if discount.id.is_empty() {
        format!("disc-{}", chrono::Utc::now().timestamp_millis())
    } else {
        discount.id.clone()
    };
    let mut d = discount;
    d.id = id.clone();

    {
        let conn = get_conn().lock().unwrap();
        local_upsert_discount(&conn, &d).map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(id)
}

#[tauri::command]
pub async fn db_delete_discount(id: String) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_delete_discount(&conn, &id).map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

#[tauri::command]
pub async fn db_toggle_discount(id: String, is_active: bool) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_toggle_discount(&conn, &id, is_active).map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

// -------------------------------------------------------------
// POSTGRES DIRECT METHODS
// -------------------------------------------------------------
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
               description = EXCLUDED.description",
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
