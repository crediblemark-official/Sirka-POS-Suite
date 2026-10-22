use tokio_postgres::{Client, NoTls};

use crate::tls::{self, SslMode};

/// BUG FIX (keamanan): kredensial database produksi sebelumnya tertanam sebagai
/// konstanta di dalam source code — sehingga bisa diekstrak dari APK Android
/// (`strings app.apk | grep pgsql-...`) dan memberi akses baca/tulis penuh ke
/// database toko.
///
/// Sekarang kredensial WAJIB disediakan lewat environment variable
/// `DATABASE_URL` (diisi saat build) atau lewat pengaturan API di aplikasi.
///
/// BUG FIX (keamanan #2): koneksi kini memakai TLS (rustls) bila tersedia,
/// sehingga password & data keuangan tidak melintas internet dalam bentuk
/// plaintext. Fallback ke koneksi polos hanya dilakukan bila provider belum
/// mengaktifkan SSL, dan disertai peringatan.
pub async fn get_pg_client(custom_url: Option<String>) -> Result<Client, String> {
    let conn_str = custom_url
        .filter(|s| !s.trim().is_empty())
        .or_else(|| std::env::var("DATABASE_URL").ok().filter(|s| !s.trim().is_empty()))
        .ok_or_else(|| {
            "DATABASE_URL belum dikonfigurasi. Isi environment variable DATABASE_URL \
             saat build atau atur URL API PostgreSQL lewat pengaturan aplikasi."
                .to_string()
        })?;

    let mode = tls::parse_ssl_mode(&conn_str);
    let clean = tls::strip_ssl_mode(&conn_str);

    if mode == SslMode::Disable {
        eprintln!(
            "[Owner PG] sslmode=disable — koneksi PostgreSQL TANPA enkripsi. \
             Jangan gunakan ini di jaringan publik."
        );
        return connect_plain(&clean).await;
    }

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
                    "[Owner PG] Koneksi TLS gagal ({}), mencoba koneksi polos. \
                     DATA LAPORAN MENGIRIM MELINTAS JARINGAN TANPA ENKRIPSI.",
                    e
                );
            }
        },
        Err(e) => {
            if mode == SslMode::Require {
                return Err(format!("TLS tidak dapat disiapkan: {}", e));
            }
            eprintln!("[Owner PG] TLS tidak dapat disiapkan ({}), memakai koneksi polos.", e);
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
            eprintln!("[Owner PG Error] {}", e);
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
            eprintln!("[Owner PG TLS Error] {}", e);
        }
    });

    Ok(client)
}
