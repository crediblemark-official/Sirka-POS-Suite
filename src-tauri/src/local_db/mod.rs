pub mod buyers;
pub mod discounts;
pub mod outbox;
pub mod preorders;
pub mod products;
pub mod purchases;
pub mod schema;
pub mod settings;
pub mod transactions;

pub use buyers::*;
pub use discounts::*;
pub use outbox::*;
pub use preorders::*;
pub use products::*;
pub use purchases::*;
pub use schema::*;
pub use settings::*;
pub use transactions::*;

use rusqlite::{Connection, Result as SqliteResult};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static DB_CONN: OnceLock<Mutex<Connection>> = OnceLock::new();
static DB_PATH: OnceLock<PathBuf> = OnceLock::new();

pub fn get_conn() -> &'static Mutex<Connection> {
    DB_CONN.get_or_init(|| {
        let path = DB_PATH
            .get()
            .cloned()
            .unwrap_or_else(|| PathBuf::from("kasir_citra.db"));
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(&path).expect("Gagal membuka database SQLite lokal");
        init_schema(&conn).expect("Gagal inisialisasi schema SQLite lokal");
        Mutex::new(conn)
    })
}

pub fn init_local_db(path: &Path) -> SqliteResult<()> {
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = DB_PATH.set(path.to_path_buf());
    let conn = Connection::open(path)?;
    init_schema(&conn)?;
    let _ = DB_CONN.set(Mutex::new(conn));
    println!("[SQLite] Database lokal siap di: {:?}", path);
    Ok(())
}
