use crate::db::get_pg_client;
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

// -------------------------------------------------------------
// POSTGRES DIRECT METHODS
// -------------------------------------------------------------
pub async fn pg_update_markup(category: String, markup_percent: f64) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "UPDATE category_markups
             SET default_markup_percent = $1::float8::numeric
             WHERE category = $2",
            &[&markup_percent, &category],
        )
        .await
        .map_err(|e| format!("Gagal update markup di PostgreSQL: {}", e))?;

    Ok(())
}

pub async fn pg_update_markup_full(
    category: String,
    markup_percent: f64,
    description: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "UPDATE category_markups
             SET default_markup_percent = $1::float8::numeric,
                 description = COALESCE($2, description),
                 color = COALESCE($3, color)
             WHERE category = $4",
            &[&markup_percent, &description, &color, &category],
        )
        .await
        .map_err(|e| format!("Gagal update markup di PostgreSQL: {}", e))?;

    Ok(())
}

pub async fn pg_create_markup(
    category: String,
    markup_percent: f64,
    description: Option<String>,
    color: Option<String>,
) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "INSERT INTO category_markups (category, default_markup_percent, description, color)
             VALUES ($1, $2::float8::numeric, $3, $4)
             ON CONFLICT (category) DO UPDATE SET
               default_markup_percent = EXCLUDED.default_markup_percent,
               description = COALESCE(EXCLUDED.description, category_markups.description),
               color = COALESCE(EXCLUDED.color, category_markups.color)",
            &[&category, &markup_percent, &description, &color],
        )
        .await
        .map_err(|e| format!("Gagal menambah kategori/vendor ke PostgreSQL: {}", e))?;

    Ok(())
}

pub async fn pg_delete_markup(category: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    let usage = client
        .query_one(
            "SELECT COUNT(*) FROM products WHERE category = $1",
            &[&category],
        )
        .await
        .map_err(|e| format!("Gagal cek penggunaan kategori: {}", e))?;

    let count: i64 = usage.get(0);
    if count > 0 {
        return Err(format!(
            "Kategori '{}' masih digunakan oleh {} produk di PostgreSQL.",
            category, count
        ));
    }

    client
        .execute("DELETE FROM category_markups WHERE category = $1", &[&category])
        .await
        .map_err(|e| format!("Gagal menghapus kategori/vendor dari PostgreSQL: {}", e))?;

    Ok(())
}
