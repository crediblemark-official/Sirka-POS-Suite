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
        format!("disc-{}", uuid::Uuid::new_v4())
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

