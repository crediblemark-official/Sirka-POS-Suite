use crate::db::get_pg_client;
use crate::local_db::{
    enqueue_outbox, get_conn, local_delete_buyer, local_get_buyers, local_upsert_buyer,
};
use crate::models::BuyerRecord;

#[tauri::command]
pub async fn db_get_buyers() -> Result<Vec<BuyerRecord>, String> {
    let conn = get_conn().lock().unwrap();
    let buyers = local_get_buyers(&conn).map_err(|e| e.to_string())?;
    Ok(buyers)
}

#[tauri::command]
pub async fn db_upsert_buyer(buyer: BuyerRecord) -> Result<String, String> {
    let id = if buyer.id.is_empty() {
        format!("buyer-{}", uuid::Uuid::new_v4())
    } else {
        buyer.id.clone()
    };
    let mut b = buyer;
    b.id = id.clone();

    {
        let conn = get_conn().lock().unwrap();
        local_upsert_buyer(&conn, &b).map_err(|e| e.to_string())?;
        enqueue_outbox(&conn, "UPSERT_BUYER", &serde_json::json!({ "buyer": b }))
            .map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(id)
}

#[tauri::command]
pub async fn db_delete_buyer(id: String) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_delete_buyer(&conn, &id).map_err(|e| e.to_string())?;
        enqueue_outbox(&conn, "DELETE_BUYER", &serde_json::json!({ "id": id }))
            .map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

// -------------------------------------------------------------
// POSTGRES DIRECT METHODS
// -------------------------------------------------------------
pub async fn pg_upsert_buyer(buyer: BuyerRecord) -> Result<String, String> {
    let client = get_pg_client().await?;
    let id = buyer.id;
    let customer_type = buyer.customer_type.unwrap_or_else(|| "B2B".to_string());
    let tier = buyer.tier.unwrap_or_else(|| "REGULAR".to_string());
    let points = buyer.points.unwrap_or(0.0);
    let total_spend = buyer.total_spend.unwrap_or(0.0);
    // BUG FIX: `member_since` sebelumnya tidak pernah ditulis ke PostgreSQL
    // sehingga anggota lama tampak baru terdaftar di dashboard owner, dan
    // nilainya hilang permanen setelah cache lokal dibersihkan.
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
