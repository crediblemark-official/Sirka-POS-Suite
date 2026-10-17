use crate::db::get_pg_client;
use crate::models::BuyerRecord;

#[tauri::command]
pub async fn db_get_buyers() -> Result<Vec<BuyerRecord>, String> {
    let client = get_pg_client().await?;
    let rows = client
        .query(
            "SELECT id, name, code, phone, address, customer_type, 
                    member_card_no, tier, COALESCE(points, 0)::float8, COALESCE(total_spend, 0)::float8, member_since::text 
             FROM buyers ORDER BY created_at ASC",
            &[],
        )
        .await
        .map_err(|e| format!("Gagal memuat data pelanggan/buyer: {}", e))?;

    let buyers = rows
        .into_iter()
        .map(|r| BuyerRecord {
            id: r.get(0),
            name: r.get(1),
            code: r.get(2),
            phone: r.get(3),
            address: r.get(4),
            customer_type: r.get(5),
            member_card_no: r.get(6),
            tier: r.get(7),
            points: r.get(8),
            total_spend: r.get(9),
            member_since: r.get(10),
        })
        .collect();

    Ok(buyers)
}

#[tauri::command]
pub async fn db_upsert_buyer(buyer: BuyerRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    let id = if buyer.id.is_empty() {
        format!("buyer-{}", chrono::Utc::now().timestamp_millis())
    } else {
        buyer.id
    };
    let customer_type = buyer.customer_type.unwrap_or_else(|| "B2B".to_string());
    let tier = buyer.tier.unwrap_or_else(|| "REGULAR".to_string());
    let points = buyer.points.unwrap_or(0.0);
    let total_spend = buyer.total_spend.unwrap_or(0.0);

    client
        .execute(
            "INSERT INTO buyers (id, name, code, phone, address, customer_type, member_card_no, tier, points, total_spend)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $10::numeric)
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name,
               code = EXCLUDED.code,
               phone = EXCLUDED.phone,
               address = EXCLUDED.address,
               customer_type = EXCLUDED.customer_type,
               member_card_no = COALESCE(EXCLUDED.member_card_no, buyers.member_card_no),
               tier = COALESCE(EXCLUDED.tier, buyers.tier),
               points = COALESCE(EXCLUDED.points, buyers.points),
               total_spend = COALESCE(EXCLUDED.total_spend, buyers.total_spend)",
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
            ],
        )
        .await
        .map_err(|e| format!("Gagal menyimpan data buyer: {}", e))?;

    Ok(id)
}

#[tauri::command]
pub async fn db_delete_buyer(id: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute("DELETE FROM buyers WHERE id = $1", &[&id])
        .await
        .map_err(|e| format!("Gagal menghapus data buyer: {}", e))?;

    Ok(())
}
