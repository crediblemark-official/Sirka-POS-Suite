use tokio_postgres::{Client, NoTls};

use crate::tls::{self, SslMode};

/// Helper untuk koneksi async ke PostgreSQL (cloud / container).
///
/// BUG FIX (keamanan): koneksi sebelumnya selalu memakai `NoTls`, sehingga
/// password database dan seluruh data keuangan melintas internet **tanpa
/// enkripsi**. Sekarang TLS (rustls) dicoba lebih dulu; bila provider belum
/// mengaktifkan SSL, koneksi polos dipakai sebagai cadangan **dengan
/// peringatan** sehingga aplikasi tetap berfungsi.
///
/// Kontrol mode:
/// - `sslmode=disable` → tanpa TLS (permintaan eksplisit)
/// - `sslmode=require|prefer|verify-ca|verify-full` → wajib TLS (gagal = error)
/// - `sslmode` tidak disebut → coba TLS, boleh fallback ke polos
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
        .ok_or_else(|| {
            "DATABASE_URL belum dikonfigurasi. Set environment variable DATABASE_URL \
             (lihat .env.example) atau isi pengaturan 'database_url' di aplikasi. \
             Kredensial tidak lagi disertakan di dalam binary demi keamanan."
                .to_string()
        })?;

    let mode = tls::parse_ssl_mode(&conn_str);
    let clean = tls::strip_ssl_mode(&conn_str);

    if mode == SslMode::Disable {
        eprintln!(
            "[PG] sslmode=disable — koneksi PostgreSQL TANPA enkripsi. \
             Jangan gunakan ini di jaringan publik."
        );
        return connect_plain(&clean).await;
    }

    // Coba TLS lebih dulu
    match tls::make_tls_connector() {
        Ok(connector) => match connect_tls(&clean, connector).await {
            Ok(client) => return Ok(client),
            Err(e) => {
                if mode == SslMode::Require {
                    return Err(format!(
                        "Koneksi PostgreSQL TLS gagal: {}. \
                         `sslmode=require` meminta koneksi terenkripsi.",
                        e
                    ));
                }
                eprintln!(
                    "[PG] Koneksi TLS gagal ({}), mencoba koneksi polos. \
                     DATA KASIR MENGIRIM MELINTAS JARINGAN TANPA ENKRIPSI.",
                    e
                );
            }
        },
        Err(e) => {
            if mode == SslMode::Require {
                return Err(format!("TLS tidak dapat disiapkan: {}", e));
            }
            eprintln!(
                "[PG] TLS tidak dapat disiapkan ({}), memakai koneksi polos.",
                e
            );
        }
    }

    connect_plain(&clean).await
}

async fn connect_plain(conn_str: &str) -> Result<Client, String> {
    let (client, connection) = tokio_postgres::connect(conn_str, NoTls)
        .await
        .map_err(|e| format!("Koneksi PostgreSQL gagal: {}", e))?;

    tauri::async_runtime::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("[Rust PG Error] {}", e);
        }
    });

    Ok(client)
}

async fn connect_tls(
    conn_str: &str,
    connector: crate::tls::RustlsConnect,
) -> Result<Client, String> {
    let (client, connection) = tokio_postgres::connect(conn_str, connector)
        .await
        .map_err(|e| format!("{}", e))?;

    tauri::async_runtime::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("[Rust PG TLS Error] {}", e);
        }
    });

    Ok(client)
}
