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

