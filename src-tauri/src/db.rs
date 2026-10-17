use tokio_postgres::{Client, NoTls};

/// Helper untuk koneksi async ke PostgreSQL Container (port 5434)
pub async fn get_pg_client() -> Result<Client, String> {
    let conn_str = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "host=127.0.0.1 port=5434 user=kasir_citra_user password=kasir_citra_password dbname=kasir_citra_db".to_string()
    });

    let (client, connection) = tokio_postgres::connect(&conn_str, NoTls)
        .await
        .map_err(|e| format!("Koneksi PostgreSQL gagal: {}", e))?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("[Rust PG Error] {}", e);
        }
    });

    Ok(client)
}
