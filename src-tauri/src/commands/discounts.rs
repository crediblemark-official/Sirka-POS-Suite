use crate::db::get_pg_client;
use crate::models::DiscountRecord;

#[tauri::command]
pub async fn db_get_discounts() -> Result<Vec<DiscountRecord>, String> {
    let client = get_pg_client().await?;
    let rows = client
        .query(
            "SELECT id, code, name, type, value::float8, min_purchase::float8, 
                    max_discount::float8, scope, target_category, target_customer_type, 
                    is_active, description, usage_count, created_at::text 
             FROM discounts 
             ORDER BY created_at DESC",
            &[],
        )
        .await
        .map_err(|e| format!("Gagal memuat data diskon: {}", e))?;

    let discounts = rows
        .into_iter()
        .map(|r| DiscountRecord {
            id: r.get(0),
            code: r.get(1),
            name: r.get(2),
            r#type: r.get(3),
            value: r.get(4),
            min_purchase: r.get(5),
            max_discount: r.get(6),
            scope: r.get(7),
            target_category: r.get(8),
            target_customer_type: r.get(9),
            is_active: r.get(10),
            description: r.get(11),
            usage_count: r.get(12),
            created_at: r.get(13),
        })
        .collect();

    Ok(discounts)
}

#[tauri::command]
pub async fn db_upsert_discount(discount: DiscountRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    let id = if discount.id.is_empty() {
        format!("disc-{}", chrono::Utc::now().timestamp_millis())
    } else {
        discount.id
    };

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
        .map_err(|e| format!("Gagal menyimpan diskon: {}", e))?;

    Ok(id)
}

#[tauri::command]
pub async fn db_delete_discount(id: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute("DELETE FROM discounts WHERE id = $1", &[&id])
        .await
        .map_err(|e| format!("Gagal menghapus diskon: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn db_toggle_discount(id: String, is_active: bool) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute("UPDATE discounts SET is_active = $1 WHERE id = $2", &[&is_active, &id])
        .await
        .map_err(|e| format!("Gagal mengubah status diskon: {}", e))?;
    Ok(())
}
