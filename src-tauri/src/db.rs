use tokio_postgres::{Client, NoTls};

/// Helper untuk koneksi async ke PostgreSQL Container (port 5434)
pub async fn get_pg_client() -> Result<Client, String> {
    let conn_str = std::env::var("DATABASE_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| {
            let conn = crate::local_db::get_conn().lock().unwrap();
            conn.query_row(
                "SELECT value FROM store_settings WHERE key = 'database_url'",
                [],
                |r| r.get::<_, String>(0),
            ).ok()
        })
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            "postgresql://ubjMYAl9vhpXpajHQ.jkt_001:aad2354f32977874bd6a646b@pgsql-dbas-jkt-001.sumobase.my.id:6432/dbd17904386f2e55b4".to_string()
        });

    let (client, connection) = tokio_postgres::connect(&conn_str, NoTls)
        .await
        .map_err(|e| format!("Koneksi PostgreSQL gagal: {}", e))?;

    tauri::async_runtime::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("[Rust PG Error] {}", e);
        }
    });

    Ok(client)
}
