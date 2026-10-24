use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Once, OnceLock};
use tokio_postgres::{Client, NoTls};

use crate::tls::{self, SslMode};

static CACHED_DB_URL: OnceLock<String> = OnceLock::new();
static TLS_UNSUPPORTED: AtomicBool = AtomicBool::new(false);
static TLS_WARN_ONCE: Once = Once::new();
static SSL_DISABLE_WARN_ONCE: Once = Once::new();

/// Mencari `DATABASE_URL` dari berbagai sumber:
/// 1. Environment variable sistem (`std::env::var("DATABASE_URL")`)
/// 2. File `.env` di direktori kerja, direktori induk, atau lokasi binary
/// 3. Tabel `store_settings` di SQLite lokal (`key = 'database_url'`)
pub fn get_database_url() -> Option<String> {
    if let Ok(val) = std::env::var("DATABASE_URL") {
        let trimmed = val.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }

    if let Some(cached) = CACHED_DB_URL.get() {
        return Some(cached.clone());
    }

    let mut candidates = vec![
        std::path::PathBuf::from(".env"),
        std::path::PathBuf::from("../.env"),
        std::path::PathBuf::from("../../.env"),
    ];

    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.join(".env"));
        if let Some(parent) = current_dir.parent() {
            candidates.push(parent.join(".env"));
        }
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join(".env"));
            if let Some(p) = exe_dir.parent() {
                candidates.push(p.join(".env"));
            }
        }
    }

    for path in &candidates {
        if let Ok(content) = std::fs::read_to_string(path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    continue;
                }
                if let Some((key, val)) = trimmed.split_once('=') {
                    if key.trim() == "DATABASE_URL" {
                        let v = val.trim().trim_matches('"').trim_matches('\'').to_string();
                        if !v.is_empty() {
                            println!("[Env] Berhasil memuat DATABASE_URL dari: {:?}", path);
                            let _ = CACHED_DB_URL.set(v.clone());
                            return Some(v);
                        }
                    }
                }
            }
        }
    }

    if let Ok(conn) = crate::local_db::get_conn().lock() {
        if let Ok(val) = conn.query_row(
            "SELECT value FROM store_settings WHERE key = 'database_url'",
            [],
            |r| r.get::<_, String>(0),
        ) {
            let trimmed = val.trim().to_string();
            if !trimmed.is_empty() {
                let _ = CACHED_DB_URL.set(trimmed.clone());
                return Some(trimmed);
            }
        }
    }

    None
}

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
    let conn_str = get_database_url().ok_or_else(|| {
        "DATABASE_URL belum dikonfigurasi. Set environment variable DATABASE_URL \
         (lihat .env.example) atau isi pengaturan 'database_url' di aplikasi. \
         Kredensial tidak lagi disertakan di dalam binary demi keamanan."
            .to_string()
    })?;

    // Pastikan tersimpan ke SQLite store_settings agar tetap ada saat offline/restart
    if let Ok(conn) = crate::local_db::get_conn().lock() {
        let _ = conn.execute(
            "INSERT INTO store_settings (key, value) VALUES ('database_url', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![&conn_str],
        );
    }

    let mode = tls::parse_ssl_mode(&conn_str);
    let clean = tls::strip_ssl_mode(&conn_str);

    if mode == SslMode::Disable {
        SSL_DISABLE_WARN_ONCE.call_once(|| {
            eprintln!(
                "[PG] sslmode=disable — koneksi PostgreSQL TANPA enkripsi TLS."
            );
        });
        return connect_plain(&clean).await;
    }

    // Jika pada percobaan sebelumnya server tidak mendukung TLS, langsung pakai koneksi polos
    // untuk menghemat latensi handshake dan menghindari spam log.
    if mode != SslMode::Require && TLS_UNSUPPORTED.load(Ordering::Relaxed) {
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
                TLS_UNSUPPORTED.store(true, Ordering::Relaxed);
                TLS_WARN_ONCE.call_once(|| {
                    eprintln!(
                        "[PG] Server database tidak merespons handshake TLS ({}), beralih ke koneksi polos.",
                        e
                    );
                });
            }
        },
        Err(e) => {
            if mode == SslMode::Require {
                return Err(format!("TLS tidak dapat disiapkan: {}", e));
            }
            TLS_UNSUPPORTED.store(true, Ordering::Relaxed);
            TLS_WARN_ONCE.call_once(|| {
                eprintln!(
                    "[PG] TLS tidak dapat disiapkan ({}), memakai koneksi polos.",
                    e
                );
            });
        }
    }

    connect_plain(&clean).await
}

use std::time::Duration;

async fn connect_plain(conn_str: &str) -> Result<Client, String> {
    let connect_fut = tokio_postgres::connect(conn_str, NoTls);
    let (client, connection) = tokio::time::timeout(Duration::from_secs(7), connect_fut)
        .await
        .map_err(|_| "Koneksi PostgreSQL timeout (7s)".to_string())?
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
    let connect_fut = tokio_postgres::connect(conn_str, connector);
    let (client, connection) = tokio::time::timeout(Duration::from_secs(7), connect_fut)
        .await
        .map_err(|_| "Koneksi PostgreSQL TLS timeout (7s)".to_string())?
        .map_err(|e| format!("{}", e))?;

    tauri::async_runtime::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("[Rust PG TLS Error] {}", e);
        }
    });

    Ok(client)
}

