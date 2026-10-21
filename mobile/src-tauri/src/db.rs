use tokio_postgres::{Client, NoTls};

pub const DEFAULT_DATABASE_URL: &str = "postgresql://ubjMYAl9vhpXpajHQ.jkt_001:aad2354f32977874bd6a646b@pgsql-dbas-jkt-001.sumobase.my.id:6432/dbd17904386f2e55b4";

pub async fn get_pg_client(custom_url: Option<String>) -> Result<Client, String> {
    let conn_str = custom_url
        .filter(|s| !s.trim().is_empty())
        .or_else(|| std::env::var("DATABASE_URL").ok().filter(|s| !s.trim().is_empty()))
        .unwrap_or_else(|| DEFAULT_DATABASE_URL.to_string());

    let (client, connection) = tokio_postgres::connect(&conn_str, NoTls)
        .await
        .map_err(|e| format!("Koneksi PostgreSQL gagal: {}", e))?;

    tauri::async_runtime::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("[Owner PG Error] {}", e);
        }
    });

    Ok(client)
}
