use crate::db::get_pg_client;
use crate::models::PreOrderRecord;

#[tauri::command]
pub async fn db_get_preorders() -> Result<Vec<PreOrderRecord>, String> {
    let client = get_pg_client().await?;
    let rows = client
        .query(
            "SELECT id, date::text, day_name, buyer, items, is_loaded_to_pos 
             FROM pre_orders 
             ORDER BY date, buyer",
            &[],
        )
        .await
        .map_err(|e| format!("Gagal memuat pre-orders: {}", e))?;

    let pos = rows
        .into_iter()
        .map(|r| PreOrderRecord {
            id: r.get(0),
            date: r.get(1),
            day_name: r.get(2),
            buyer: r.get(3),
            items: r.get(4),
            is_loaded_to_pos: r.get(5),
        })
        .collect();

    Ok(pos)
}

#[tauri::command]
pub async fn db_save_preorder(record: PreOrderRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "INSERT INTO pre_orders (id, date, day_name, buyer, items, is_loaded_to_pos)
             VALUES ($1, $2::date, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               buyer = EXCLUDED.buyer,
               items = EXCLUDED.items,
               is_loaded_to_pos = EXCLUDED.is_loaded_to_pos",
            &[
                &record.id,
                &record.date,
                &record.day_name,
                &record.buyer,
                &record.items,
                &record.is_loaded_to_pos,
            ],
        )
        .await
        .map_err(|e| format!("Gagal simpan pre-order: {}", e))?;

    Ok(record.id)
}
