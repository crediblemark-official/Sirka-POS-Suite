use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Once, RwLock};
use tokio_postgres::{Client, NoTls};

use crate::tls::{self, SslMode};

static CACHED_DB_URL: RwLock<Option<String>> = RwLock::new(None);
static DB_URL_INITIALIZED: AtomicBool = AtomicBool::new(false);
static TLS_UNSUPPORTED: AtomicBool = AtomicBool::new(false);
static TLS_WARN_ONCE: Once = Once::new();
static SSL_DISABLE_WARN_ONCE: Once = Once::new();

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub database_url: Option<String>,
    pub worker_url: Option<String>,
    pub worker_token: Option<String>,
    pub is_online: bool,
    pub pending_count: i64,
    pub last_sync_at: Option<String>,
    pub last_error: Option<String>,
}

/// Mencari `DATABASE_URL` dari berbagai sumber:
/// 1. Environment variable sistem (`std::env::var("DATABASE_URL")`)
/// 2. Cache runtime (jika pernah dimuat atau diset pengguna via UI)
/// 3. File `.env` di direktori kerja, direktori induk, atau lokasi binary
/// 4. Tabel `store_settings` di SQLite lokal (`key = 'database_url'`)
pub fn get_database_url() -> Option<String> {
    if let Ok(val) = std::env::var("DATABASE_URL") {
        let trimmed = val.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }

    if DB_URL_INITIALIZED.load(Ordering::Relaxed) {
        if let Ok(guard) = CACHED_DB_URL.read() {
            return guard.clone();
        }
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
                            if let Ok(mut guard) = CACHED_DB_URL.write() {
                                *guard = Some(v.clone());
                            }
                            DB_URL_INITIALIZED.store(true, Ordering::Relaxed);
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
                if let Ok(mut guard) = CACHED_DB_URL.write() {
                    *guard = Some(trimmed.clone());
                }
                DB_URL_INITIALIZED.store(true, Ordering::Relaxed);
                return Some(trimmed);
            }
        }
    }

    DB_URL_INITIALIZED.store(true, Ordering::Relaxed);
    None
}

/// Memperbarui URL Database secara dinamis (disimpan ke SQLite lokal)
pub fn set_database_url(new_url: Option<String>) -> Result<(), String> {
    let clean = new_url.map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    if let Ok(conn) = crate::local_db::get_conn().lock() {
        match &clean {
            Some(url) => {
                let _ = conn.execute(
                    "INSERT INTO store_settings (key, value, updated_at) VALUES ('database_url', ?1, datetime('now'))
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
                    rusqlite::params![url],
                );
            }
            None => {
                let _ = conn.execute(
                    "DELETE FROM store_settings WHERE key = 'database_url'",
                    [],
                );
            }
        }
    }

    if let Ok(mut guard) = CACHED_DB_URL.write() {
        *guard = clean;
    }
    DB_URL_INITIALIZED.store(true, Ordering::Relaxed);
    TLS_UNSUPPORTED.store(false, Ordering::Relaxed);

    Ok(())
}

/// Helper untuk koneksi async ke PostgreSQL (cloud / container).
pub async fn get_pg_client() -> Result<Client, String> {
    let conn_str = get_database_url().ok_or_else(|| {
        "Database Cloud belum dikonfigurasi. Mode offline murni SQLite lokal aktif.".to_string()
    })?;

    // Pastikan tersimpan ke SQLite store_settings agar tetap ada saat offline/restart
    if let Ok(conn) = crate::local_db::get_conn().lock() {
        let _ = conn.execute(
            "INSERT INTO store_settings (key, value, updated_at) VALUES ('database_url', ?1, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
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
                        "Koneksi PostgreSQL TLS gagal: {}. `sslmode=require` meminta koneksi terenkripsi.",
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

/// Menguji koneksi string PostgreSQL secara langsung tanpa mengubah konfigurasi aktif
pub async fn test_connection_string(conn_str: &str) -> Result<String, String> {
    let trimmed = conn_str.trim();
    if trimmed.is_empty() {
        return Err("URL Database kosong".to_string());
    }

    let mode = tls::parse_ssl_mode(trimmed);
    let clean = tls::strip_ssl_mode(trimmed);

    let client = if mode == SslMode::Disable {
        connect_plain(&clean).await?
    } else {
        match tls::make_tls_connector() {
            Ok(connector) => match connect_tls(&clean, connector).await {
                Ok(c) => c,
                Err(e) => {
                    if mode == SslMode::Require {
                        return Err(format!("Koneksi PostgreSQL TLS gagal: {}", e));
                    }
                    connect_plain(&clean).await?
                }
            },
            Err(e) => {
                if mode == SslMode::Require {
                    return Err(format!("TLS Connector gagal: {}", e));
                }
                connect_plain(&clean).await?
            }
        }
    };

    let row = client
        .query_one("SELECT version()", &[])
        .await
        .map_err(|e| format!("Query test gagal: {}", e))?;

    let version: String = row.get(0);
    Ok(version)
}

/// Mengambil konfigurasi server lengkap (Database Cloud + Worker)
pub fn get_server_config() -> Result<ServerConfig, String> {
    let db_url = get_database_url();
    let mut worker_url: Option<String> = None;
    let mut worker_token: Option<String> = None;

    if let Ok(conn) = crate::local_db::get_conn().lock() {
        if let Ok(v) = conn.query_row(
            "SELECT value FROM store_settings WHERE key = 'worker_url'",
            [],
            |r| r.get::<_, String>(0),
        ) {
            let t = v.trim().to_string();
            if !t.is_empty() {
                worker_url = Some(t);
            }
        }

        if let Ok(v) = conn.query_row(
            "SELECT value FROM store_settings WHERE key = 'owner_api_token'",
            [],
            |r| r.get::<_, String>(0),
        ) {
            let t = v.trim().to_string();
            if !t.is_empty() {
                worker_token = Some(t);
            }
        }
    }

    let status = crate::sync::get_status();

    Ok(ServerConfig {
        database_url: db_url,
        worker_url,
        worker_token,
        is_online: status.is_online,
        pending_count: status.pending_count,
        last_sync_at: status.last_sync_time,
        last_error: status.last_error,
    })
}

/// Menyimpan konfigurasi server lengkap (Database Cloud + Worker)
pub fn save_server_config(
    database_url: Option<String>,
    worker_url: Option<String>,
    worker_token: Option<String>,
) -> Result<(), String> {
    set_database_url(database_url)?;

    if let Ok(conn) = crate::local_db::get_conn().lock() {
        if let Some(w_url) = worker_url {
            let trimmed = w_url.trim();
            if trimmed.is_empty() {
                let _ = conn.execute("DELETE FROM store_settings WHERE key = 'worker_url'", []);
            } else {
                let _ = conn.execute(
                    "INSERT INTO store_settings (key, value, updated_at) VALUES ('worker_url', ?1, datetime('now'))
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
                    rusqlite::params![trimmed],
                );
            }
        }

        if let Some(w_token) = worker_token {
            let trimmed = w_token.trim();
            if trimmed.is_empty() {
                let _ = conn.execute("DELETE FROM store_settings WHERE key = 'owner_api_token'", []);
            } else {
                let _ = conn.execute(
                    "INSERT INTO store_settings (key, value, updated_at) VALUES ('owner_api_token', ?1, datetime('now'))
                     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
                    rusqlite::params![trimmed],
                );
            }
        }
    }

    Ok(())
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
