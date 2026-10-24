use crate::local_db::{
    enqueue_outbox, get_conn, local_delete_markup, local_get_markups, local_upsert_markup,
};
use crate::models::CategoryMarkupRecord;

#[tauri::command]
pub async fn db_get_markups() -> Result<Vec<CategoryMarkupRecord>, String> {
    let conn = get_conn().lock().unwrap();
    let markups = local_get_markups(&conn).map_err(|e| e.to_string())?;
    Ok(markups)
}

#[tauri::command]
pub async fn db_update_markup(category: String, markup_percent: f64) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_upsert_markup(&conn, &category, markup_percent, None, None).map_err(|e| e.to_string())?;
        enqueue_outbox(
            &conn,
            "UPDATE_MARKUP",
            &serde_json::json!({
                "category": category,
                "markupPercent": markup_percent
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
pub async fn db_create_markup(
    category: String,
    markup_percent: f64,
    description: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_upsert_markup(
            &conn,
            &category,
            markup_percent,
            description.as_deref(),
            color.as_deref(),
        )
        .map_err(|e| e.to_string())?;
        enqueue_outbox(
            &conn,
            "CREATE_MARKUP",
            &serde_json::json!({
                "category": category,
                "markupPercent": markup_percent,
                "description": description,
                "color": color
            }),
        )
        .map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

/// BUG FIX: perintah update kategori harus bisa menyimpan warna (fitur kisi produk
/// berwarna kategori) dan KEEP margin lama saat kategori hanya di-rename.
#[tauri::command]
pub async fn db_update_markup_full(
    category: String,
    markup_percent: f64,
    description: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_upsert_markup(
            &conn,
            &category,
            markup_percent,
            description.as_deref(),
            color.as_deref(),
        )
        .map_err(|e| e.to_string())?;
        enqueue_outbox(
            &conn,
            "UPDATE_MARKUP",
            &serde_json::json!({
                "category": category,
                "markupPercent": markup_percent,
                "description": description,
                "color": color
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
pub async fn db_delete_markup(category: String) -> Result<(), String> {
    {
        let conn = get_conn().lock().unwrap();
        local_delete_markup(&conn, &category).map_err(|e| e.to_string())?;
        enqueue_outbox(
            &conn,
            "DELETE_MARKUP",
            &serde_json::json!({ "category": category }),
        )
        .map_err(|e| e.to_string())?;
    }

    tauri::async_runtime::spawn(async move {
        let _ = crate::sync::run_sync_cycle().await;
    });

    Ok(())
}

