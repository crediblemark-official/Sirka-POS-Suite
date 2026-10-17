use crate::db::get_pg_client;
use crate::models::CategoryMarkupRecord;

#[tauri::command]
pub async fn db_get_markups() -> Result<Vec<CategoryMarkupRecord>, String> {
    let client = get_pg_client().await?;
    let rows = client
        .query(
            "SELECT category, default_markup_percent::float8, description 
             FROM category_markups 
             ORDER BY category",
            &[],
        )
        .await
        .map_err(|e| format!("Gagal memuat markup: {}", e))?;

    let markups = rows
        .into_iter()
        .map(|r| CategoryMarkupRecord {
            category: r.get(0),
            default_markup_percent: r.get(1),
            description: r.get(2),
        })
        .collect();

    Ok(markups)
}

#[tauri::command]
pub async fn db_update_markup(category: String, markup_percent: f64) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "UPDATE category_markups 
             SET default_markup_percent = $1::numeric 
             WHERE category = $2",
            &[&markup_percent, &category],
        )
        .await
        .map_err(|e| format!("Gagal update markup: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_create_markup(
    category: String,
    markup_percent: f64,
    description: Option<String>,
) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute(
            "INSERT INTO category_markups (category, default_markup_percent, description)
             VALUES ($1, $2::numeric, $3)
             ON CONFLICT (category) DO UPDATE SET
               default_markup_percent = EXCLUDED.default_markup_percent,
               description = EXCLUDED.description",
            &[&category, &markup_percent, &description],
        )
        .await
        .map_err(|e| format!("Gagal menambah kategori/vendor: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn db_delete_markup(category: String) -> Result<(), String> {
    let client = get_pg_client().await?;
    client
        .execute("DELETE FROM category_markups WHERE category = $1", &[&category])
        .await
        .map_err(|e| format!("Gagal menghapus kategori/vendor: {}", e))?;

    Ok(())
}
