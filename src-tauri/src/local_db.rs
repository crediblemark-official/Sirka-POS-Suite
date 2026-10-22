use rusqlite::{params, Connection, Result as SqliteResult};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use crate::models::{
    BuyerRecord, CategoryMarkupRecord, DiscountRecord, PreOrderRecord, ProductRecord,
    ProductUnitConversionRecord, StoreSettingRecord, TransactionRecord,
};

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

pub fn init_schema(conn: &Connection) -> SqliteResult<()> {
    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS category_markups (
            category TEXT PRIMARY KEY,
            default_markup_percent REAL NOT NULL DEFAULT 20.0,
            description TEXT,
            color TEXT
        );

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            unit TEXT NOT NULL,
            default_markup_percent REAL NOT NULL DEFAULT 20.0,
            last_buy_price REAL NOT NULL DEFAULT 0,
            last_sell_price REAL NOT NULL DEFAULT 0,
            stock REAL NOT NULL DEFAULT 0,
            barcode TEXT,
            notes TEXT,
            units TEXT,
            is_perishable INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS buyers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT,
            phone TEXT,
            address TEXT,
            customer_type TEXT NOT NULL DEFAULT 'B2B',
            member_card_no TEXT,
            tier TEXT NOT NULL DEFAULT 'REGULAR',
            points REAL NOT NULL DEFAULT 0,
            total_spend REAL NOT NULL DEFAULT 0,
            member_since TEXT,
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            invoice_no TEXT UNIQUE NOT NULL,
            date TEXT NOT NULL,
            buyer TEXT NOT NULL,
            items TEXT NOT NULL DEFAULT '[]',
            total_buy REAL NOT NULL DEFAULT 0,
            total_sell REAL NOT NULL DEFAULT 0,
            total_profit REAL NOT NULL DEFAULT 0,
            profit_percent REAL NOT NULL DEFAULT 0,
            payment_status TEXT NOT NULL DEFAULT 'LUNAS',
            payment_method TEXT NOT NULL DEFAULT 'Transfer Bank',
            customer_type TEXT NOT NULL DEFAULT 'B2B',
            notes TEXT,
            discount_amount REAL DEFAULT 0,
            discount_code TEXT,
            points_used REAL DEFAULT 0,
            points_discount REAL DEFAULT 0,
            points_earned REAL DEFAULT 0,
            final_total REAL DEFAULT 0,
            is_pre_order INTEGER DEFAULT 0,
            pic_name TEXT,
            -- BUG FIX: field transaksi yang sebelumnya dibuang serde
            -- (split payment, kembalian, infaq, shift, refund).
            is_split_payment INTEGER DEFAULT 0,
            cash_amount REAL DEFAULT 0,
            non_cash_amount REAL DEFAULT 0,
            non_cash_method TEXT,
            change_amount REAL DEFAULT 0,
            infaq_amount REAL DEFAULT 0,
            shift_id TEXT,
            refund_status TEXT DEFAULT 'NONE',
            refund_total REAL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS pre_orders (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            day_name TEXT NOT NULL,
            buyer TEXT NOT NULL,
            items TEXT NOT NULL DEFAULT '[]',
            is_loaded_to_pos INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS discounts (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'PERCENT',
            value REAL NOT NULL DEFAULT 0,
            min_purchase REAL NOT NULL DEFAULT 0,
            max_discount REAL,
            scope TEXT NOT NULL DEFAULT 'ALL',
            target_category TEXT,
            target_customer_type TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            description TEXT,
            usage_count INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS store_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS purchase_receipts (
            id TEXT PRIMARY KEY,
            supplier_invoice_no TEXT,
            date TEXT,
            supplier TEXT,
            total_buy REAL DEFAULT 0,
            notes TEXT,
            receipt TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS purchase_receipt_items (
            id TEXT PRIMARY KEY,
            receipt_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            code TEXT,
            name TEXT NOT NULL,
            category TEXT,
            unit TEXT,
            qty_received REAL NOT NULL DEFAULT 0,
            base_qty REAL NOT NULL DEFAULT 0,
            conversion_factor REAL NOT NULL DEFAULT 1,
            buy_price REAL NOT NULL DEFAULT 0,
            subtotal_buy REAL NOT NULL DEFAULT 0,
            markup_percent REAL NOT NULL DEFAULT 0,
            new_sell_price REAL NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sync_outbox (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
        CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_no);
        CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_outbox(status);
        CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt_id ON purchase_receipt_items(receipt_id);
        CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_product_id ON purchase_receipt_items(product_id);
        ",
    )?;

    // Migrasi idempotent untuk database SQLite eksisting
    let _ = conn.execute("ALTER TABLE purchase_receipts ADD COLUMN supplier_invoice_no TEXT", []);
    let _ = conn.execute("ALTER TABLE purchase_receipts ADD COLUMN date TEXT", []);
    let _ = conn.execute("ALTER TABLE purchase_receipts ADD COLUMN supplier TEXT", []);
    let _ = conn.execute("ALTER TABLE purchase_receipts ADD COLUMN total_buy REAL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE purchase_receipts ADD COLUMN notes TEXT", []);
    let _ = conn.execute("ALTER TABLE products ADD COLUMN supplier TEXT", []);
    // BUG FIX: kolom multi-satuan, penanda mudah busuk, warna kategori, dan
    // kuantitas dasar nota kulakan. Tanpa kolom ini fitur terkait hilang setiap
    // kali data dimuat ulang dari database.
    let _ = conn.execute("ALTER TABLE products ADD COLUMN units TEXT", []);
    let _ = conn.execute("ALTER TABLE products ADD COLUMN is_perishable INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE category_markups ADD COLUMN color TEXT", []);
    let _ = conn.execute("ALTER TABLE purchase_receipt_items ADD COLUMN base_qty REAL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE purchase_receipt_items ADD COLUMN conversion_factor REAL DEFAULT 1", []);
    // BUG FIX: field transaksi yang sebelumnya dibuang serde (split payment,
    // kembalian, infaq, shift, refund) — perlu kolom agar tidak hilang.
    let _ = conn.execute("ALTER TABLE buyers ADD COLUMN notes TEXT", []);
    let _ = conn.execute("ALTER TABLE transactions ADD COLUMN is_split_payment INTEGER DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE transactions ADD COLUMN cash_amount REAL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE transactions ADD COLUMN non_cash_amount REAL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE transactions ADD COLUMN non_cash_method TEXT", []);
    let _ = conn.execute("ALTER TABLE transactions ADD COLUMN change_amount REAL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE transactions ADD COLUMN infaq_amount REAL DEFAULT 0", []);
    let _ = conn.execute("ALTER TABLE transactions ADD COLUMN shift_id TEXT", []);
    let _ = conn.execute("ALTER TABLE transactions ADD COLUMN refund_status TEXT DEFAULT 'NONE'", []);
    let _ = conn.execute("ALTER TABLE transactions ADD COLUMN refund_total REAL DEFAULT 0", []);
    let _ = conn.execute("CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        phone TEXT,
        contact_person TEXT,
        address TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )", []);

    // BUG-017 FIX: normalisasi item nota lama (JSONB) ke tabel purchase_receipt_items
    local_backfill_purchase_items(conn);

    // Self-healing: pulihkan supplier produk yang kosong berdasarkan prefix kode dan kategori
    let _ = conn.execute(
        "UPDATE products SET supplier = 'Sayur Tufel' 
         WHERE (supplier IS NULL OR TRIM(supplier) = '' OR supplier = '-') 
           AND (code LIKE 'ST-%' OR category IN ('Sayur Tufel', 'Sayuran Segar'))",
        [],
    );
    let _ = conn.execute(
        "UPDATE products SET supplier = 'Pak Agus' 
         WHERE (supplier IS NULL OR TRIM(supplier) = '' OR supplier = '-') 
           AND (code LIKE 'PA-%' OR category IN ('Pak Agus', 'Bumbu Kering & Rempah'))",
        [],
    );
    let _ = conn.execute(
        "UPDATE products SET supplier = 'Hari Barokah' 
         WHERE (supplier IS NULL OR TRIM(supplier) = '' OR supplier = '-') 
           AND (code LIKE 'HB-%' OR category IN ('Hari Barokah', 'Saus, Kecap & Tepung'))",
        [],
    );
    let _ = conn.execute(
        "UPDATE products SET supplier = 'Fadhil Food' 
         WHERE (supplier IS NULL OR TRIM(supplier) = '' OR supplier = '-') 
           AND (code LIKE 'FF-%' OR category IN ('Fadhil Food', 'Daging & Telur'))",
        [],
    );
    let _ = conn.execute(
        "UPDATE products SET supplier = 'Haff Pro Jaya' 
         WHERE (supplier IS NULL OR TRIM(supplier) = '' OR supplier = '-') 
           AND (code LIKE 'HP-%' OR category IN ('Haff Pro Jaya', 'Haff Pro', 'Tahu, Tempe & Bawang'))",
        [],
    );
    let _ = conn.execute(
        "UPDATE products SET supplier = 'Pantry Co' 
         WHERE (supplier IS NULL OR TRIM(supplier) = '' OR supplier = '-') 
           AND (code LIKE 'PC-%' OR category IN ('Pantry Co', 'Buah Segar'))",
        [],
    );
    let _ = conn.execute(
        "UPDATE products SET supplier = 'Koko Didid' 
         WHERE (supplier IS NULL OR TRIM(supplier) = '' OR supplier = '-') 
           AND (code LIKE 'KD-%' OR category IN ('Koko Didid', 'Beras & Minyak'))",
        [],
    );
    let _ = conn.execute(
        "UPDATE products SET supplier = 'Mitra APD & Sanitasi' 
         WHERE (supplier IS NULL OR TRIM(supplier) = '' OR supplier = '-') 
           AND (code LIKE 'APD-%' OR category = 'APD & Sabun')",
        [],
    );
    let _ = conn.execute(
        "UPDATE products SET supplier = 'CV Surya Gemilang ATK' 
         WHERE (supplier IS NULL OR TRIM(supplier) = '' OR supplier = '-') 
           AND (code LIKE 'ATK-%' OR category = 'ATK & Kertas')",
        [],
    );

    Ok(())
}

// ---------------------------------------------------------
// OUTBOX QUEUE HELPERS
// ---------------------------------------------------------
pub fn enqueue_outbox(conn: &Connection, action: &str, payload: &Value) -> SqliteResult<i64> {
    let payload_str = payload.to_string();
    conn.execute(
        "INSERT INTO sync_outbox (action, payload, status, created_at) VALUES (?1, ?2, 'PENDING', datetime('now'))",
        params![action, payload_str],
    )?;
    Ok(conn.last_insert_rowid())
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct OutboxItem {
    pub id: i64,
    pub action: String,
    pub payload: Value,
    pub retry_count: i32,
}

pub fn get_pending_outbox(conn: &Connection, limit: i64) -> SqliteResult<Vec<OutboxItem>> {
    let mut stmt = conn.prepare(
        "SELECT id, action, payload, retry_count FROM sync_outbox WHERE status = 'PENDING' ORDER BY id ASC LIMIT ?1",
    )?;
    let rows = stmt.query_map(params![limit], |row| {
        let payload_raw: String = row.get(2)?;
        let val: Value = serde_json::from_str(&payload_raw).unwrap_or(Value::Null);
        Ok(OutboxItem {
            id: row.get(0)?,
            action: row.get(1)?,
            payload: val,
            retry_count: row.get(3)?,
        })
    })?;

    let mut items = Vec::new();
    for r in rows {
        items.push(r?);
    }
    Ok(items)
}

pub fn mark_outbox_synced(conn: &Connection, id: i64) -> SqliteResult<()> {
    conn.execute(
        "UPDATE sync_outbox SET status = 'SYNCED', last_error = NULL WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn mark_outbox_failed(conn: &Connection, id: i64, error: &str) -> SqliteResult<()> {
    conn.execute(
        "UPDATE sync_outbox SET
            retry_count = retry_count + 1,
            last_error = ?2,
            status = CASE WHEN retry_count + 1 >= 5 THEN 'FAILED' ELSE 'PENDING' END
         WHERE id = ?1",
        params![id, error],
    )?;
    Ok(())
}

/// Parkir satu item outbox secara permanen (status FAILED) tanpa menambah
/// retry_count.
///
/// BUG FIX (head-of-line blocking): item dengan error permanen (mis. constraint
/// violation) harus langsung disingkirkan supaya tidak memblokir item lain
/// di belakangnya. Versi lama membiarkan status PENDING sampai 5 percobaan,
/// sehingga satu baris rusak tetap jadi kepala antrean.
pub fn park_outbox_item(conn: &Connection, id: i64, error: &str) -> SqliteResult<()> {
    conn.execute(
        "UPDATE sync_outbox SET
            status = 'FAILED',
            retry_count = retry_count + 1,
            last_error = ?2
         WHERE id = ?1",
        params![id, error],
    )?;
    Ok(())
}

pub fn retry_failed_outbox(conn: &Connection) -> SqliteResult<usize> {
    conn.execute(
        "UPDATE sync_outbox SET status = 'PENDING', retry_count = 0, last_error = NULL WHERE status = 'FAILED'",
        [],
    )
}

pub fn count_pending_outbox(conn: &Connection) -> SqliteResult<i64> {
    conn.query_row(
        "SELECT COUNT(*) FROM sync_outbox WHERE status = 'PENDING'",
        [],
        |r| r.get(0),
    )
}

// ---------------------------------------------------------
// LOCAL CRUD: PRODUCTS
// ---------------------------------------------------------
pub fn local_get_products(conn: &Connection) -> SqliteResult<Vec<ProductRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, code, name, category, unit, default_markup_percent, last_buy_price, last_sell_price, stock, barcode, notes, supplier, units, is_perishable FROM products ORDER BY name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        let units_json: Option<String> = row.get(12)?;
        let units: Option<Vec<ProductUnitConversionRecord>> = units_json
            .as_deref()
            .and_then(|raw| serde_json::from_str(raw).ok());
        Ok(ProductRecord {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            category: row.get(3)?,
            unit: row.get(4)?,
            default_markup_percent: row.get(5)?,
            last_buy_price: row.get(6)?,
            last_sell_price: row.get(7)?,
            stock: row.get(8)?,
            barcode: row.get(9)?,
            notes: row.get(10)?,
            supplier: row.get(11)?,
            units,
            is_perishable: Some(row.get::<_, i64>(13)? != 0),
        })
    })?;

    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_upsert_product(conn: &Connection, p: &ProductRecord) -> SqliteResult<()> {
    let units_json: Option<String> = p
        .units
        .as_ref()
        .and_then(|u| serde_json::to_string(u).ok());
    let is_perishable = if p.is_perishable.unwrap_or(false) { 1 } else { 0 };
    conn.execute(
        "INSERT INTO products (id, code, name, category, unit, default_markup_percent, last_buy_price, last_sell_price, stock, barcode, notes, supplier, units, is_perishable, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))
         ON CONFLICT (id) DO UPDATE SET
            code = excluded.code,
            name = excluded.name,
            category = excluded.category,
            unit = excluded.unit,
            default_markup_percent = excluded.default_markup_percent,
            last_buy_price = excluded.last_buy_price,
            last_sell_price = excluded.last_sell_price,
            stock = excluded.stock,
            barcode = excluded.barcode,
            notes = excluded.notes,
            supplier = excluded.supplier,
            units = excluded.units,
            is_perishable = excluded.is_perishable,
            updated_at = datetime('now')",
        params![
            p.id,
            p.code,
            p.name,
            p.category,
            p.unit,
            p.default_markup_percent,
            p.last_buy_price,
            p.last_sell_price,
            p.stock,
            p.barcode,
            p.notes,
            p.supplier,
            units_json,
            is_perishable,
        ],
    )?;
    Ok(())
}

pub fn local_delete_product(conn: &Connection, id: &str) -> SqliteResult<()> {
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM transactions WHERE items LIKE '%' || ?1 || '%'",
            params![id],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if count > 0 {
        conn.execute(
            "UPDATE products SET stock = 0, notes = COALESCE(notes, '') || ' [DIHAPUS]', updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
    } else {
        conn.execute("DELETE FROM products WHERE id = ?1", params![id])?;
    }
    Ok(())
}

pub fn local_update_stock_and_price(
    conn: &Connection,
    product_id: &str,
    added_stock: f64,
    buy_price: f64,
    sell_price: f64,
) -> SqliteResult<()> {
    conn.execute(
        "UPDATE products SET
            stock = stock + ?2,
            last_buy_price = CASE WHEN ?3 > 0 THEN ?3 ELSE last_buy_price END,
            last_sell_price = CASE WHEN ?4 > 0 THEN ?4 ELSE last_sell_price END,
            updated_at = datetime('now')
         WHERE id = ?1",
        params![product_id, added_stock, buy_price, sell_price],
    )?;
    Ok(())
}

// ---------------------------------------------------------
// LOCAL CRUD: CATEGORY MARKUPS
// ---------------------------------------------------------
pub fn local_get_markups(conn: &Connection) -> SqliteResult<Vec<CategoryMarkupRecord>> {
    let mut stmt = conn.prepare(
        "SELECT category, default_markup_percent, description, color FROM category_markups ORDER BY category ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CategoryMarkupRecord {
            category: row.get(0)?,
            default_markup_percent: row.get(1)?,
            description: row.get(2)?,
            color: row.get(3)?,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_upsert_markup(
    conn: &Connection,
    category: &str,
    percent: f64,
    desc: Option<&str>,
    color: Option<&str>,
) -> SqliteResult<()> {
    conn.execute(
        "INSERT INTO category_markups (category, default_markup_percent, description, color)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (category) DO UPDATE SET
            default_markup_percent = excluded.default_markup_percent,
            description = COALESCE(excluded.description, category_markups.description),
            color = COALESCE(excluded.color, category_markups.color)",
        params![category, percent, desc, color],
    )?;
    Ok(())
}

pub fn local_delete_markup(conn: &Connection, category: &str) -> SqliteResult<()> {
    conn.execute("DELETE FROM category_markups WHERE category = ?1", params![category])?;
    Ok(())
}

// ---------------------------------------------------------
// LOCAL CRUD: BUYERS
// ---------------------------------------------------------
pub fn local_get_buyers(conn: &Connection) -> SqliteResult<Vec<BuyerRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, code, phone, address, customer_type, member_card_no, tier, points, total_spend, member_since, notes FROM buyers ORDER BY name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(BuyerRecord {
            id: row.get(0)?,
            name: row.get(1)?,
            code: row.get(2)?,
            phone: row.get(3)?,
            address: row.get(4)?,
            customer_type: row.get(5)?,
            member_card_no: row.get(6)?,
            tier: row.get(7)?,
            points: row.get(8)?,
            total_spend: row.get(9)?,
            member_since: row.get(10)?,
            notes: row.get(11)?,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_upsert_buyer(conn: &Connection, b: &BuyerRecord) -> SqliteResult<()> {
    let customer_type = b.customer_type.as_deref().unwrap_or("B2B");
    let tier = b.tier.as_deref().unwrap_or("REGULAR");
    conn.execute(
        "INSERT INTO buyers (id, name, code, phone, address, customer_type, member_card_no, tier, points, total_spend, member_since, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT (id) DO UPDATE SET
            name = excluded.name,
            code = excluded.code,
            phone = excluded.phone,
            address = excluded.address,
            customer_type = excluded.customer_type,
            member_card_no = excluded.member_card_no,
            tier = excluded.tier,
            points = excluded.points,
            total_spend = excluded.total_spend,
            member_since = excluded.member_since,
            notes = excluded.notes",
        params![
            b.id,
            b.name,
            b.code,
            b.phone,
            b.address,
            customer_type,
            b.member_card_no,
            tier,
            b.points.unwrap_or(0.0),
            b.total_spend.unwrap_or(0.0),
            b.member_since,
            b.notes,
        ],
    )?;
    Ok(())
}

pub fn local_delete_buyer(conn: &Connection, id: &str) -> SqliteResult<()> {
    conn.execute("DELETE FROM buyers WHERE id = ?1", params![id])?;
    Ok(())
}

// ---------------------------------------------------------
// LOCAL CRUD: TRANSACTIONS (ATOMIC: INSERT + STOCK + POINTS)
// ---------------------------------------------------------
pub fn local_get_transactions(conn: &Connection) -> SqliteResult<Vec<TransactionRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, invoice_no, date, buyer, items, total_buy, total_sell, total_profit, profit_percent, payment_status, payment_method, customer_type, notes, discount_amount, discount_code, points_used, points_discount, points_earned, final_total, is_pre_order, pic_name, created_at,
                is_split_payment, cash_amount, non_cash_amount, non_cash_method, change_amount, infaq_amount, shift_id, refund_status, refund_total
         FROM transactions ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let items_raw: String = row.get(4)?;
        let items: Value = serde_json::from_str(&items_raw).unwrap_or(Value::Array(vec![]));
        let is_pre_order_int: i32 = row.get(19)?;
        let is_split_int: i32 = row.get(22)?;
        Ok(TransactionRecord {
            id: row.get(0)?,
            invoice_no: row.get(1)?,
            date: row.get(2)?,
            buyer: row.get(3)?,
            items,
            total_buy: row.get(5)?,
            total_sell: row.get(6)?,
            total_profit: row.get(7)?,
            profit_percent: row.get(8)?,
            payment_status: row.get(9)?,
            payment_method: row.get(10)?,
            customer_type: row.get(11)?,
            notes: row.get(12)?,
            discount_amount: row.get(13)?,
            discount_code: row.get(14)?,
            points_used: row.get(15)?,
            points_discount: row.get(16)?,
            points_earned: row.get(17)?,
            final_total: row.get(18)?,
            is_pre_order: Some(is_pre_order_int == 1),
            pic_name: row.get(20)?,
            created_at: row.get(21)?,
            is_split_payment: Some(is_split_int == 1),
            cash_amount: row.get(23)?,
            non_cash_amount: row.get(24)?,
            non_cash_method: row.get(25)?,
            change_amount: row.get(26)?,
            infaq_amount: row.get(27)?,
            shift_id: row.get(28)?,
            refund_status: row.get(29)?,
            refund_total: row.get(30)?,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_create_transaction(
    conn: &mut Connection,
    tx: &TransactionRecord,
    member_id: Option<&str>,
) -> SqliteResult<String> {
    let tx_sqlite = conn.transaction()?;

    let items_str = tx.items.to_string();
    let is_pre_order_val = if tx.is_pre_order.unwrap_or(false) { 1 } else { 0 };
    let is_split_val = if tx.is_split_payment.unwrap_or(false) { 1 } else { 0 };

    tx_sqlite.execute(
        "INSERT INTO transactions (
            id, invoice_no, date, buyer, items, total_buy, total_sell, total_profit,
            profit_percent, payment_status, payment_method, customer_type, notes,
            discount_amount, discount_code, points_used, points_discount, points_earned, final_total,
            is_pre_order, pic_name, created_at,
            is_split_payment, cash_amount, non_cash_amount, non_cash_method, change_amount,
            infaq_amount, shift_id, refund_status, refund_total
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
            ?9, ?10, ?11, ?12, ?13,
            ?14, ?15, ?16, ?17, ?18, ?19,
            ?20, ?21, datetime('now'),
            ?22, ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30
        )",
        params![
            tx.id,
            tx.invoice_no,
            tx.date,
            tx.buyer,
            items_str,
            tx.total_buy,
            tx.total_sell,
            tx.total_profit,
            tx.profit_percent,
            tx.payment_status,
            tx.payment_method,
            tx.customer_type,
            tx.notes,
            tx.discount_amount.unwrap_or(0.0),
            tx.discount_code,
            tx.points_used.unwrap_or(0.0),
            tx.points_discount.unwrap_or(0.0),
            tx.points_earned.unwrap_or(0.0),
            tx.final_total.unwrap_or(tx.total_sell),
            is_pre_order_val,
            tx.pic_name,
            is_split_val,
            tx.cash_amount.unwrap_or(0.0),
            tx.non_cash_amount.unwrap_or(0.0),
            tx.non_cash_method,
            tx.change_amount.unwrap_or(0.0),
            tx.infaq_amount.unwrap_or(0.0),
            tx.shift_id,
            tx.refund_status,
            tx.refund_total.unwrap_or(0.0),
        ],
    )?;

    // Kurangi stok barang
    // BUG FIX: `qty` adalah jumlah dalam SATUAN AKTIF (mis. 1 DUS), sedangkan
    // `products.stock` disimpan dalam SATUAN DASAR. Sebelumnya SQLite memotong
    // hanya 1 sehingga stok tidak sinkron dengan layer batch FIFO/FEFO di frontend
    // (yang memotong baseQty). Digunakan `baseQty` (fallback ke qty * conversionFactor).
    // `last_sell_price` juga hanya diperbarui bila penjualan memakai satuan dasar,
    // kalau tidak harga per-kemasan akan ditulis sebagai harga per-satuan-dasar.
    if let Some(items) = tx.items.as_array() {
        for item in items {
            let pid = item.get("productId").and_then(Value::as_str);
            let qty = item.get("qty").and_then(Value::as_f64);
            let price = item.get("sellPrice").and_then(Value::as_f64);
            if let (Some(pid), Some(qty), Some(price)) = (pid, qty, price) {
                let conversion = item
                    .get("conversionFactor")
                    .and_then(Value::as_f64)
                    .unwrap_or(1.0);
                let base_qty = item
                    .get("baseQty")
                    .and_then(Value::as_f64)
                    .unwrap_or(qty * conversion);
                let base_qty = if base_qty.is_finite() && base_qty > 0.0 {
                    base_qty
                } else {
                    qty
                };
                // Harga jual per satuan dasar hanya relevan bila faktor konversi = 1
                let sell_price = if (conversion - 1.0).abs() < f64::EPSILON {
                    price
                } else {
                    price / conversion
                };

                tx_sqlite.execute(
                    "UPDATE products SET stock = MAX(0, stock - ?2), last_sell_price = ?3, updated_at = datetime('now') WHERE id = ?1",
                    params![pid, base_qty, sell_price],
                )?;
            }
        }
    }

    // Update member points jika ada
    if let Some(mid) = member_id {
        let points_used = tx.points_used.unwrap_or(0.0);
        let points_earned = tx.points_earned.unwrap_or(0.0);
        let final_total = tx.final_total.unwrap_or(tx.total_sell);

        // Ambil aturan tier dinamis dari store_settings (key: loyalty_settings)
        let (plat_min, gold_min, silver_min) = {
            let mut plat = 15_000_000.0;
            let mut gold = 5_000_000.0;
            let mut silver = 1_000_000.0;
            let stmt = tx_sqlite.prepare("SELECT value FROM store_settings WHERE key = 'loyalty_settings'").ok();
            if let Some(mut s) = stmt {
                if let Ok(raw) = s.query_row([], |r| r.get::<_, String>(0)) {
                    if let Ok(val) = serde_json::from_str::<Value>(&raw) {
                        if let Some(tms) = val.get("tierMinSpend") {
                            if let Some(p) = tms.get("PLATINUM").and_then(Value::as_f64) { plat = p; }
                            if let Some(g) = tms.get("GOLD").and_then(Value::as_f64) { gold = g; }
                            if let Some(s) = tms.get("SILVER").and_then(Value::as_f64) { silver = s; }
                        }
                    }
                }
            }
            (plat, gold, silver)
        };

        tx_sqlite.execute(
            "UPDATE buyers SET
                points = MAX(0, points - ?1 + ?2),
                total_spend = total_spend + ?3,
                tier = CASE
                    WHEN total_spend + ?3 >= ?5 THEN 'PLATINUM'
                    WHEN total_spend + ?3 >= ?6 THEN 'GOLD'
                    WHEN total_spend + ?3 >= ?7 THEN 'SILVER'
                    ELSE 'REGULAR'
                END
             WHERE id = ?4",
            params![points_used, points_earned, final_total, mid, plat_min, gold_min, silver_min],
        )?;
    }

    // Update usage_count diskon jika ada
    if let Some(ref code) = tx.discount_code {
        if !code.is_empty() && code != "MANUAL" && !code.starts_with("MEMBER-") {
            let _ = tx_sqlite.execute(
                "UPDATE discounts SET usage_count = usage_count + 1 WHERE code = ?1",
                params![code],
            );
        }
    }

    // Catat ke outbox sync
    let payload = serde_json::json!({
        "tx": tx,
        "memberId": member_id
    });
    enqueue_outbox(&tx_sqlite, "CREATE_TRANSACTION", &payload)?;

    tx_sqlite.commit()?;
    Ok(tx.id.clone())
}

pub fn local_update_transaction_status(
    conn: &Connection,
    id: &str,
    status: &str,
) -> SqliteResult<()> {
    conn.execute(
        "UPDATE transactions SET payment_status = ?2 WHERE id = ?1",
        params![id, status],
    )?;
    enqueue_outbox(
        conn,
        "UPDATE_TRANSACTION_STATUS",
        &serde_json::json!({ "id": id, "paymentStatus": status }),
    )?;
    Ok(())
}

pub fn local_delete_transaction(conn: &mut Connection, id: &str) -> SqliteResult<()> {
    let tx = conn.transaction()?;

    // Baca transaksi sebelum dihapus untuk rollback stok, poin & diskon
    let found = {
        let mut stmt = tx.prepare("SELECT items, buyer, points_used, points_earned, final_total, discount_code FROM transactions WHERE id = ?1")?;
        stmt.query_row(params![id], |row| {
            let items_raw: String = row.get(0)?;
            let items: Value = serde_json::from_str(&items_raw).unwrap_or(Value::Array(vec![]));
            Ok((
                items,
                row.get::<_, String>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, Option<String>>(5)?,
            ))
        })
    };

    if let Ok((items, buyer_name, p_used, p_earned, spend, disc_code)) = found {
        // Rollback stok
        // BUG FIX: samakan dengan pemotongan stok saat create — gunakan baseQty
        // (satuan dasar), bukan qty (satuan aktif).
        if let Some(arr) = items.as_array() {
            for item in arr {
                let pid = item.get("productId").and_then(Value::as_str);
                let qty = item.get("qty").and_then(Value::as_f64);
                if let (Some(pid), Some(qty)) = (pid, qty) {
                    let conversion = item
                        .get("conversionFactor")
                        .and_then(Value::as_f64)
                        .unwrap_or(1.0);
                    let base_qty = item
                        .get("baseQty")
                        .and_then(Value::as_f64)
                        .unwrap_or(qty * conversion);
                    let base_qty = if base_qty.is_finite() && base_qty > 0.0 {
                        base_qty
                    } else {
                        qty
                    };
                    tx.execute(
                        "UPDATE products SET stock = stock + ?2 WHERE id = ?1",
                        params![pid, base_qty],
                    )?;
                }
            }
        }

        // Ambil aturan tier dinamis dari store_settings (key: loyalty_settings)
        let (plat_min, gold_min, silver_min) = {
            let mut plat = 15_000_000.0;
            let mut gold = 5_000_000.0;
            let mut silver = 1_000_000.0;
            let stmt = tx.prepare("SELECT value FROM store_settings WHERE key = 'loyalty_settings'").ok();
            if let Some(mut s) = stmt {
                if let Ok(raw) = s.query_row([], |r| r.get::<_, String>(0)) {
                    if let Ok(val) = serde_json::from_str::<Value>(&raw) {
                        if let Some(tms) = val.get("tierMinSpend") {
                            if let Some(p) = tms.get("PLATINUM").and_then(Value::as_f64) { plat = p; }
                            if let Some(g) = tms.get("GOLD").and_then(Value::as_f64) { gold = g; }
                            if let Some(s) = tms.get("SILVER").and_then(Value::as_f64) { silver = s; }
                        }
                    }
                }
            }
            (plat, gold, silver)
        };

        // Rollback poin member
        tx.execute(
            "UPDATE buyers SET
                points = MAX(0, points + ?1 - ?2),
                total_spend = MAX(0, total_spend - ?3),
                tier = CASE
                    WHEN total_spend - ?3 >= ?5 THEN 'PLATINUM'
                    WHEN total_spend - ?3 >= ?6 THEN 'GOLD'
                    WHEN total_spend - ?3 >= ?7 THEN 'SILVER'
                    ELSE 'REGULAR'
                END
             WHERE name = ?4",
            params![p_used, p_earned, spend, buyer_name, plat_min, gold_min, silver_min],
        )?;

        // Rollback usage_count kupon diskon
        if let Some(ref code) = disc_code {
            if !code.is_empty() && code != "MANUAL" && !code.starts_with("MEMBER-") {
                let _ = tx.execute(
                    "UPDATE discounts SET usage_count = MAX(0, usage_count - 1) WHERE code = ?1",
                    params![code],
                );
            }
        }
    }

    tx.execute("DELETE FROM transactions WHERE id = ?1", params![id])?;
    enqueue_outbox(&tx, "DELETE_TRANSACTION", &serde_json::json!({ "id": id }))?;

    tx.commit()?;
    Ok(())
}

// ---------------------------------------------------------
// LOCAL CRUD: PRE-ORDERS
// ---------------------------------------------------------
pub fn local_get_preorders(conn: &Connection) -> SqliteResult<Vec<PreOrderRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, date, day_name, buyer, items, is_loaded_to_pos FROM pre_orders ORDER BY date DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let items_raw: String = row.get(4)?;
        let items: Value = serde_json::from_str(&items_raw).unwrap_or(Value::Array(vec![]));
        let loaded_int: i32 = row.get(5)?;
        Ok(PreOrderRecord {
            id: row.get(0)?,
            date: row.get(1)?,
            day_name: row.get(2)?,
            buyer: row.get(3)?,
            items,
            is_loaded_to_pos: loaded_int == 1,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_save_preorder(conn: &Connection, po: &PreOrderRecord) -> SqliteResult<()> {
    let loaded = if po.is_loaded_to_pos { 1 } else { 0 };
    conn.execute(
        "INSERT INTO pre_orders (id, date, day_name, buyer, items, is_loaded_to_pos)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT (id) DO UPDATE SET
            date = excluded.date,
            day_name = excluded.day_name,
            buyer = excluded.buyer,
            items = excluded.items,
            is_loaded_to_pos = excluded.is_loaded_to_pos",
        params![po.id, po.date, po.day_name, po.buyer, po.items.to_string(), loaded],
    )?;
    enqueue_outbox(conn, "SAVE_PREORDER", &serde_json::json!({ "record": po }))?;
    Ok(())
}

pub fn local_delete_preorder(conn: &Connection, id: &str) -> SqliteResult<()> {
    conn.execute("DELETE FROM pre_orders WHERE id = ?1", params![id])?;
    enqueue_outbox(conn, "DELETE_PREORDER", &serde_json::json!({ "id": id }))?;
    Ok(())
}

// ---------------------------------------------------------
// LOCAL CRUD: PURCHASES (KULAKAN)
// ---------------------------------------------------------

/// BUG-017 FIX: Baca item nota dari tabel ternormalisasi `purchase_receipt_items`.
/// Bentuk JSON-nya sama persis dengan `PurchaseReceiptItem` (src/types/index.ts)
/// supaya frontend tidak perlu tahu-menahu soal sumber datanya.
fn local_items_from_table(conn: &Connection, receipt_id: &str) -> Vec<Value> {
    let mut stmt = match conn.prepare(
        "SELECT id, product_id, code, name, category, unit,
                qty_received, buy_price, subtotal_buy, markup_percent, new_sell_price,
                base_qty, conversion_factor
         FROM purchase_receipt_items WHERE receipt_id = ?1
         ORDER BY created_at ASC, id ASC",
    ) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    let rows = stmt.query_map(params![receipt_id], |row| {
        Ok(serde_json::json!({
            "id": row.get::<_, String>(0)?,
            "productId": row.get::<_, String>(1)?,
            "code": row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            "name": row.get::<_, String>(3)?,
            "category": row.get::<_, Option<String>>(4)?.unwrap_or_default(),
            "unit": row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            "qtyReceived": row.get::<_, f64>(6)?,
            "buyPrice": row.get::<_, f64>(7)?,
            "subtotalBuy": row.get::<_, f64>(8)?,
            "markupPercent": row.get::<_, f64>(9)?,
            "newSellPrice": row.get::<_, f64>(10)?,
            "baseQty": row.get::<_, f64>(11)?,
            "conversionFactor": row.get::<_, f64>(12)?,
        }))
    });
    match rows {
        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
        Err(_) => Vec::new(),
    }
}

/// BUG FIX: kuantitas yang dipakai untuk adjusting stok harus expressed dalam
/// SATUAN DASAR produk. `qtyReceived` adalah jumlah fisik dalam satuan kemasan
/// (mis. 5 DUS), sedangkan stok produk disimpan dalam satuan dasar (mis. 200 PCS).
///
/// Tanpa konversi ini, edit/hapus nota kulakan mengembalikan jumlah yang salah
/// sehingga muncul "hantu stok" (phantom stock).
fn receipt_item_base_qty(item: &Value) -> Option<f64> {
    let qty = item.get("qtyReceived").and_then(Value::as_f64)?;
    let factor = item
        .get("conversionFactor")
        .and_then(Value::as_f64)
        .unwrap_or(1.0);
    let base = item
        .get("baseQty")
        .and_then(Value::as_f64)
        .unwrap_or(qty * factor);
    Some(if base.is_finite() && base > 0.0 { base } else { qty })
}

/// BUG-017 FIX: Baca nota legacy yang itemnya masih tersimpan di kolom `receipt` JSONB.
fn local_legacy_receipt(conn: &Connection, receipt_id: &str) -> Option<Value> {
    let mut stmt = conn
        .prepare("SELECT receipt FROM purchase_receipts WHERE id = ?1")
        .ok()?;
    let raw: Option<String> = stmt
        .query_row(params![receipt_id], |row| row.get(0))
        .ok()
        .flatten();
    raw.and_then(|r| serde_json::from_str::<Value>(&r).ok())
}

/// BUG-017 FIX: Sumber kebenaran item nota = tabel ternormalisasi.
/// Fallback ke kolom JSONB hanya untuk nota lama yang belum dinormalisasi (backfill).
fn local_receipt_items(conn: &Connection, receipt_id: &str) -> Vec<Value> {
    let normalized = local_items_from_table(conn, receipt_id);
    if !normalized.is_empty() {
        return normalized;
    }
    local_legacy_receipt(conn, receipt_id)
        .and_then(|r| r.get("items").and_then(Value::as_array).cloned())
        .unwrap_or_default()
}

/// BUG-017 FIX: Backfill — normalisasi item nota lama (hanya ada di kolom JSONB)
/// ke tabel `purchase_receipt_items` agar bisa di-query per item dari SQL.
fn local_backfill_purchase_items(conn: &Connection) {
    let ids: Vec<String> = {
        let mut stmt = match conn.prepare(
            "SELECT r.id FROM purchase_receipts r
             WHERE r.receipt IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM purchase_receipt_items i WHERE i.receipt_id = r.id)",
        ) {
            Ok(s) => s,
            Err(_) => return,
        };
        let rows = stmt.query_map([], |row| row.get::<_, String>(0));
        match rows {
            Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
            Err(_) => return,
        }
    };

    for id in ids {
        let Some(receipt) = local_legacy_receipt(conn, &id) else {
            continue;
        };
        let Some(items) = receipt.get("items").and_then(Value::as_array) else {
            continue;
        };
        for item in items {
            let raw_id = item.get("id").and_then(Value::as_str).unwrap_or("");
            let item_uuid = if raw_id.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                raw_id.to_string()
            };
            let pid = item.get("productId").and_then(Value::as_str).unwrap_or("");
            let code = item.get("code").and_then(Value::as_str);
            let name = item.get("name").and_then(Value::as_str).unwrap_or("");
            let category = item.get("category").and_then(Value::as_str);
            let unit = item.get("unit").and_then(Value::as_str);
            let qty = item.get("qtyReceived").and_then(Value::as_f64).unwrap_or(0.0);
            let factor = item.get("conversionFactor").and_then(Value::as_f64).unwrap_or(1.0);
            let base_qty = item
                .get("baseQty")
                .and_then(Value::as_f64)
                .unwrap_or(qty * factor);
            let buy = item.get("buyPrice").and_then(Value::as_f64).unwrap_or(0.0);
            let subtotal = item
                .get("subtotalBuy")
                .and_then(Value::as_f64)
                .unwrap_or(qty * buy);
            let markup = item.get("markupPercent").and_then(Value::as_f64).unwrap_or(0.0);
            let sell = item.get("newSellPrice").and_then(Value::as_f64).unwrap_or(0.0);

            // BUG FIX: backfill harus menulis base_qty & conversion_factor.
            // Tanpa ini nota legacy (yang hanya ada di JSONB) tercatat dengan
            // base_qty = 0 dan saat nota dihapus rollback stoknya salah.
            let _ = conn.execute(
                "INSERT OR IGNORE INTO purchase_receipt_items (
                    id, receipt_id, product_id, code, name, category, unit,
                    qty_received, base_qty, conversion_factor, buy_price, subtotal_buy,
                    markup_percent, new_sell_price, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))",
                params![
                    item_uuid, id, pid, code, name, category, unit, qty, base_qty, factor, buy,
                    subtotal, markup, sell
                ],
            );
        }
    }
}

pub fn local_get_purchases(conn: &Connection) -> SqliteResult<Vec<Value>> {
    // BUG-017 FIX: baca nota dari kolom ternormalisasi (bukan JSONB blob),
    // lalu dirakit ulang menjadi objek receipt untuk frontend.
    let mut stmt = conn.prepare(
        "SELECT id, supplier_invoice_no, date, supplier, total_buy, notes, receipt, created_at
         FROM purchase_receipts ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<f64>>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
        ))
    })?;

    let mut list = Vec::new();
    for r in rows {
        let (id, supplier_inv, date, supplier, total_buy, notes, legacy, created_at) = r?;

        // Item: pakai tabel ternormalisasi; fallback JSONB untuk nota legacy.
        let mut items = local_items_from_table(conn, &id);
        if items.is_empty() {
            if let Some(raw) = legacy.as_deref() {
                if let Ok(v) = serde_json::from_str::<Value>(raw) {
                    items = v
                        .get("items")
                        .and_then(Value::as_array)
                        .cloned()
                        .unwrap_or_default();
                }
            }
        }

        let mut obj = serde_json::Map::new();
        obj.insert("id".into(), serde_json::json!(id));
        obj.insert(
            "supplierInvoiceNo".into(),
            serde_json::json!(supplier_inv.unwrap_or_default()),
        );
        obj.insert("date".into(), serde_json::json!(date.unwrap_or_default()));
        obj.insert(
            "supplier".into(),
            serde_json::json!(supplier.unwrap_or_default()),
        );
        obj.insert("items".into(), serde_json::json!(items));
        obj.insert(
            "totalBuy".into(),
            serde_json::json!(total_buy.unwrap_or(0.0)),
        );
        if let Some(n) = notes {
            if !n.is_empty() {
                obj.insert("notes".into(), serde_json::json!(n));
            }
        }
        obj.insert(
            "createdAt".into(),
            serde_json::json!(created_at.unwrap_or_default()),
        );
        list.push(Value::Object(obj));
    }
    Ok(list)
}

pub fn local_save_purchase(conn: &mut Connection, receipt: &Value) -> SqliteResult<()> {
    let tx = conn.transaction()?;

    let id = receipt
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| rusqlite::Error::InvalidQuery)?;

    // 1. Jika nota sudah ada sebelumnya (edit nota kulakan), rollback kuantitas lama
    // BUG-017 FIX: sumber item = tabel ternormalisasi (fallback JSONB untuk nota legacy)
    // BUG FIX: kuantitas rollback memakai SATUAN DASAR (baseQty), bukan satuan kemasan.
    for item in local_receipt_items(&tx, id) {
        if let (Some(pid), Some(base_qty)) = (
            item.get("productId").and_then(Value::as_str),
            receipt_item_base_qty(&item),
        ) {
            tx.execute(
                "UPDATE products SET stock = MAX(0, stock - ?2) WHERE id = ?1",
                params![pid, base_qty],
            )?;
        }
    }

    // 2. Simpan / perbarui nota
    let supplier_inv = receipt.get("supplierInvoiceNo").and_then(Value::as_str);
    let r_date = receipt.get("date").and_then(Value::as_str);
    let supplier = receipt.get("supplier").and_then(Value::as_str);
    let total_buy = receipt.get("totalBuy").and_then(Value::as_f64).unwrap_or(0.0);
    let notes = receipt.get("notes").and_then(Value::as_str);

    tx.execute(
        "INSERT INTO purchase_receipts (id, supplier_invoice_no, date, supplier, total_buy, notes, receipt, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
         ON CONFLICT (id) DO UPDATE SET
             supplier_invoice_no = excluded.supplier_invoice_no,
             date = excluded.date,
             supplier = excluded.supplier,
             total_buy = excluded.total_buy,
             notes = excluded.notes,
             receipt = excluded.receipt",
        params![id, supplier_inv, r_date, supplier, total_buy, notes, receipt.to_string()],
    )?;

    // 2b. Simpan item-item nota secara relasional
    tx.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = ?1", params![id])?;
    if let Some(items) = receipt.get("items").and_then(Value::as_array) {
        for item in items {
            let item_id = item.get("id").and_then(Value::as_str).unwrap_or("");
            let item_uuid = if item_id.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                item_id.to_string()
            };
            let pid = item.get("productId").and_then(Value::as_str).unwrap_or("");
            let code = item.get("code").and_then(Value::as_str);
            let name = item.get("name").and_then(Value::as_str).unwrap_or("");
            let category = item.get("category").and_then(Value::as_str);
            let unit = item.get("unit").and_then(Value::as_str);
            let qty = item.get("qtyReceived").and_then(Value::as_f64).unwrap_or(0.0);
            let factor = item.get("conversionFactor").and_then(Value::as_f64).unwrap_or(1.0);
            let base_qty = item
                .get("baseQty")
                .and_then(Value::as_f64)
                .unwrap_or(qty * factor);
            let buy = item.get("buyPrice").and_then(Value::as_f64).unwrap_or(0.0);
            let subtotal = item.get("subtotalBuy").and_then(Value::as_f64).unwrap_or(qty * buy);
            let markup = item.get("markupPercent").and_then(Value::as_f64).unwrap_or(0.0);
            let sell = item.get("newSellPrice").and_then(Value::as_f64).unwrap_or(0.0);

            tx.execute(
                "INSERT INTO purchase_receipt_items (
                    id, receipt_id, product_id, code, name, category, unit,
                    qty_received, base_qty, conversion_factor, buy_price, subtotal_buy,
                    markup_percent, new_sell_price, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))",
                params![
                    item_uuid, id, pid, code, name, category, unit, qty, base_qty, factor, buy,
                    subtotal, markup, sell
                ],
            )?;
        }
    }

    // 3. Tambah stok barang & update HPP + harga jual
    // BUG FIX: stok bertambah dalam SATUAN DASAR (baseQty), bukan satuan kemasan.
    if let Some(items) = receipt.get("items").and_then(Value::as_array) {
        for item in items {
            if let (Some(pid), Some(base_qty), Some(buy), Some(sell)) = (
                item.get("productId").and_then(Value::as_str),
                receipt_item_base_qty(item),
                item.get("buyPrice").and_then(Value::as_f64),
                item.get("newSellPrice").and_then(Value::as_f64),
            ) {
                tx.execute(
                    "UPDATE products SET
                        stock = stock + ?2,
                        last_buy_price = CASE WHEN ?3 > 0 THEN ?3 ELSE last_buy_price END,
                        last_sell_price = CASE WHEN ?4 > 0 THEN ?4 ELSE last_sell_price END,
                        updated_at = datetime('now')
                     WHERE id = ?1",
                    params![pid, base_qty, buy, sell],
                )?;
            }
        }
    }

    enqueue_outbox(&tx, "SAVE_PURCHASE", &serde_json::json!({ "receipt": receipt }))?;
    tx.commit()?;
    Ok(())
}

pub fn local_delete_purchase(conn: &mut Connection, id: &str) -> SqliteResult<()> {
    let tx = conn.transaction()?;

    // BUG-017 FIX: rollback stok memakai item dari tabel ternormalisasi
    // (fallback JSONB untuk nota lama yang belum dinormalisasi)
    // BUG FIX: kuantitas rollback memakai SATUAN DASAR (baseQty).
    for item in local_receipt_items(&tx, id) {
        if let (Some(pid), Some(base_qty)) = (
            item.get("productId").and_then(Value::as_str),
            receipt_item_base_qty(&item),
        ) {
            tx.execute(
                "UPDATE products SET stock = MAX(0, stock - ?2) WHERE id = ?1",
                params![pid, base_qty],
            )?;
        }
    }

    tx.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = ?1", params![id])?;
    tx.execute("DELETE FROM purchase_receipts WHERE id = ?1", params![id])?;
    enqueue_outbox(&tx, "DELETE_PURCHASE", &serde_json::json!({ "id": id }))?;
    tx.commit()?;
    Ok(())
}

// ---------------------------------------------------------
// LOCAL CRUD: DISCOUNTS
// ---------------------------------------------------------
pub fn local_get_discounts(conn: &Connection) -> SqliteResult<Vec<DiscountRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, code, name, type, value, min_purchase, max_discount, scope, target_category, target_customer_type, is_active, description, usage_count, created_at FROM discounts ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        let is_act: i32 = row.get(10)?;
        Ok(DiscountRecord {
            id: row.get(0)?,
            code: row.get(1)?,
            name: row.get(2)?,
            r#type: row.get(3)?,
            value: row.get(4)?,
            min_purchase: row.get(5)?,
            max_discount: row.get(6)?,
            scope: row.get(7)?,
            target_category: row.get(8)?,
            target_customer_type: row.get(9)?,
            is_active: is_act == 1,
            description: row.get(11)?,
            usage_count: row.get(12)?,
            created_at: row.get(13)?,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_upsert_discount(conn: &Connection, d: &DiscountRecord) -> SqliteResult<()> {
    let act = if d.is_active { 1 } else { 0 };
    conn.execute(
        "INSERT INTO discounts (id, code, name, type, value, min_purchase, max_discount, scope, target_category, target_customer_type, is_active, description, usage_count)
         VALUES (?1, UPPER(?2), ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, COALESCE(?13, 0))
         ON CONFLICT (id) DO UPDATE SET
            code = UPPER(excluded.code),
            name = excluded.name,
            type = excluded.type,
            value = excluded.value,
            min_purchase = excluded.min_purchase,
            max_discount = excluded.max_discount,
            scope = excluded.scope,
            target_category = excluded.target_category,
            target_customer_type = excluded.target_customer_type,
            is_active = excluded.is_active,
            description = excluded.description",
        params![
            d.id,
            d.code,
            d.name,
            d.r#type,
            d.value,
            d.min_purchase,
            d.max_discount,
            d.scope,
            d.target_category,
            d.target_customer_type,
            act,
            d.description,
            d.usage_count.unwrap_or(0),
        ],
    )?;
    enqueue_outbox(conn, "UPSERT_DISCOUNT", &serde_json::json!({ "discount": d }))?;
    Ok(())
}

pub fn local_delete_discount(conn: &Connection, id: &str) -> SqliteResult<()> {
    conn.execute("DELETE FROM discounts WHERE id = ?1", params![id])?;
    enqueue_outbox(conn, "DELETE_DISCOUNT", &serde_json::json!({ "id": id }))?;
    Ok(())
}

pub fn local_toggle_discount(conn: &Connection, id: &str, is_active: bool) -> SqliteResult<()> {
    let act = if is_active { 1 } else { 0 };
    let affected = conn.execute(
        "UPDATE discounts SET is_active = ?2 WHERE id = ?1",
        params![id, act],
    )?;
    // BUG FIX: `rows_affected` tidak diperiksa sehingga toggle untuk id yang
    // tidak ada tetap "berhasil" (dan UI menyimpan state yang tidak pernah
    // tersimpan). Sekarang error dikembalikan bila tidak ada baris yang berubah.
    if affected == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    enqueue_outbox(
        conn,
        "TOGGLE_DISCOUNT",
        &serde_json::json!({ "id": id, "isActive": is_active }),
    )?;
    Ok(())
}

// ---------------------------------------------------------
// LOCAL CRUD: SETTINGS
// ---------------------------------------------------------
pub fn local_get_settings(conn: &Connection) -> SqliteResult<Vec<StoreSettingRecord>> {
    let mut stmt = conn.prepare("SELECT key, value FROM store_settings ORDER BY key ASC")?;
    let rows = stmt.query_map([], |row| {
        Ok(StoreSettingRecord {
            key: row.get(0)?,
            value: row.get(1)?,
        })
    })?;
    let mut list = Vec::new();
    for r in rows {
        list.push(r?);
    }
    Ok(list)
}

pub fn local_update_setting(conn: &Connection, key: &str, value: &str) -> SqliteResult<()> {
    conn.execute(
        "INSERT INTO store_settings (key, value, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        params![key, value],
    )?;
    enqueue_outbox(
        conn,
        "UPDATE_SETTING",
        &serde_json::json!({ "key": key, "value": value }),
    )?;
    Ok(())
}

pub fn local_update_setting_direct(conn: &Connection, key: &str, value: &str) -> SqliteResult<()> {
    conn.execute(
        "INSERT INTO store_settings (key, value, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
        params![key, value],
    )?;
    Ok(())
}

pub fn local_upsert_discount_direct(conn: &Connection, d: &DiscountRecord) -> SqliteResult<()> {
    let act = if d.is_active { 1 } else { 0 };
    conn.execute(
        "INSERT INTO discounts (id, code, name, type, value, min_purchase, max_discount, scope, target_category, target_customer_type, is_active, description, usage_count)
         VALUES (?1, UPPER(?2), ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, COALESCE(?13, 0))
         ON CONFLICT (id) DO UPDATE SET
            code = UPPER(excluded.code),
            name = excluded.name,
            type = excluded.type,
            value = excluded.value,
            min_purchase = excluded.min_purchase,
            max_discount = excluded.max_discount,
            scope = excluded.scope,
            target_category = excluded.target_category,
            target_customer_type = excluded.target_customer_type,
            is_active = excluded.is_active,
            description = excluded.description",
        params![
            d.id,
            d.code,
            d.name,
            d.r#type,
            d.value,
            d.min_purchase,
            d.max_discount,
            d.scope,
            d.target_category,
            d.target_customer_type,
            act,
            d.description,
            d.usage_count.unwrap_or(0),
        ],
    )?;
    Ok(())
}

pub fn local_save_preorder_direct(conn: &Connection, po: &PreOrderRecord) -> SqliteResult<()> {
    let loaded = if po.is_loaded_to_pos { 1 } else { 0 };
    conn.execute(
        "INSERT INTO pre_orders (id, date, day_name, buyer, items, is_loaded_to_pos)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT (id) DO UPDATE SET
            date = excluded.date,
            day_name = excluded.day_name,
            buyer = excluded.buyer,
            items = excluded.items,
            is_loaded_to_pos = excluded.is_loaded_to_pos",
        params![po.id, po.date, po.day_name, po.buyer, po.items.to_string(), loaded],
    )?;
    Ok(())
}

pub fn local_save_purchase_direct(conn: &Connection, receipt: &Value) -> SqliteResult<()> {
    let id = receipt
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if id.is_empty() {
        return Ok(());
    }
    let supplier_inv = receipt.get("supplierInvoiceNo").and_then(Value::as_str);
    let r_date = receipt.get("date").and_then(Value::as_str);
    let supplier = receipt.get("supplier").and_then(Value::as_str);
    let total_buy = receipt.get("totalBuy").and_then(Value::as_f64).unwrap_or(0.0);
    let notes = receipt.get("notes").and_then(Value::as_str);
    let receipt_str = serde_json::to_string(receipt).unwrap_or_else(|_| "{}".to_string());

    conn.execute(
        "INSERT INTO purchase_receipts (id, supplier_invoice_no, date, supplier, total_buy, notes, receipt, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
         ON CONFLICT (id) DO UPDATE SET
             supplier_invoice_no = excluded.supplier_invoice_no,
             date = excluded.date,
             supplier = excluded.supplier,
             total_buy = excluded.total_buy,
             notes = excluded.notes,
             receipt = excluded.receipt",
        params![id, supplier_inv, r_date, supplier, total_buy, notes, receipt_str],
    )?;

    conn.execute("DELETE FROM purchase_receipt_items WHERE receipt_id = ?1", params![id])?;
    if let Some(items) = receipt.get("items").and_then(Value::as_array) {
        for item in items {
            let item_id = item.get("id").and_then(Value::as_str).unwrap_or("");
            let item_uuid = if item_id.is_empty() {
                uuid::Uuid::new_v4().to_string()
            } else {
                item_id.to_string()
            };
            let pid = item.get("productId").and_then(Value::as_str).unwrap_or("");
            let code = item.get("code").and_then(Value::as_str);
            let name = item.get("name").and_then(Value::as_str).unwrap_or("");
            let category = item.get("category").and_then(Value::as_str);
            let unit = item.get("unit").and_then(Value::as_str);
            let qty = item.get("qtyReceived").and_then(Value::as_f64).unwrap_or(0.0);
            let factor = item.get("conversionFactor").and_then(Value::as_f64).unwrap_or(1.0);
            let base_qty = item
                .get("baseQty")
                .and_then(Value::as_f64)
                .unwrap_or(qty * factor);
            let buy = item.get("buyPrice").and_then(Value::as_f64).unwrap_or(0.0);
            let subtotal = item.get("subtotalBuy").and_then(Value::as_f64).unwrap_or(qty * buy);
            let markup = item.get("markupPercent").and_then(Value::as_f64).unwrap_or(0.0);
            let sell = item.get("newSellPrice").and_then(Value::as_f64).unwrap_or(0.0);

            conn.execute(
                "INSERT INTO purchase_receipt_items (
                    id, receipt_id, product_id, code, name, category, unit,
                    qty_received, base_qty, conversion_factor, buy_price, subtotal_buy,
                    markup_percent, new_sell_price, created_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, datetime('now'))",
                params![
                    item_uuid, id, pid, code, name, category, unit, qty, base_qty, factor, buy,
                    subtotal, markup, sell
                ],
            )?;
        }
    }
    Ok(())
}

pub fn local_save_transaction_direct(conn: &Connection, tx: &TransactionRecord) -> SqliteResult<()> {
    let is_pre_order_val = if tx.is_pre_order.unwrap_or(false) { 1 } else { 0 };
    let is_split_val = if tx.is_split_payment.unwrap_or(false) { 1 } else { 0 };
    conn.execute(
        "INSERT INTO transactions (
            id, invoice_no, date, buyer, items,
            total_buy, total_sell, total_profit, profit_percent,
            payment_status, payment_method, customer_type, notes,
            discount_amount, discount_code, points_used, points_discount,
            points_earned, final_total,
            is_pre_order, pic_name, created_at,
            is_split_payment, cash_amount, non_cash_amount, non_cash_method,
            change_amount, infaq_amount, shift_id, refund_status, refund_total
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            ?6, ?7, ?8, ?9,
            ?10, ?11, ?12, ?13,
            ?14, ?15, ?16, ?17,
            ?18, ?19,
            ?20, ?21, COALESCE(?22, datetime('now')),
            ?23, ?24, ?25, ?26, ?27, ?28, ?29, ?30, ?31
        ) ON CONFLICT (id) DO UPDATE SET
            total_buy = excluded.total_buy,
            total_sell = excluded.total_sell,
            total_profit = excluded.total_profit,
            profit_percent = excluded.profit_percent,
            payment_status = excluded.payment_status,
            payment_method = excluded.payment_method,
            final_total = excluded.final_total,
            -- BUG FIX: sebelumnya hanya 7 dari 20 kolom yang di-update. Akibatnya
            -- `items`, `date`, `buyer`, diskon, poin, dan info split TIDAK ikut
            -- ter-update -> transaksi lokal menampilkan total yang tidak cocok
            -- dengan daftar itemnya.
            items = excluded.items,
            date = excluded.date,
            buyer = excluded.buyer,
            customer_type = excluded.customer_type,
            notes = excluded.notes,
            discount_amount = excluded.discount_amount,
            discount_code = excluded.discount_code,
            points_used = excluded.points_used,
            points_discount = excluded.points_discount,
            points_earned = excluded.points_earned,
            is_pre_order = excluded.is_pre_order,
            pic_name = excluded.pic_name,
            is_split_payment = excluded.is_split_payment,
            cash_amount = excluded.cash_amount,
            non_cash_amount = excluded.non_cash_amount,
            non_cash_method = excluded.non_cash_method,
            change_amount = excluded.change_amount,
            infaq_amount = excluded.infaq_amount,
            shift_id = excluded.shift_id,
            refund_status = excluded.refund_status,
            refund_total = excluded.refund_total",
        params![
            tx.id,
            tx.invoice_no,
            tx.date,
            tx.buyer,
            tx.items.to_string(),
            tx.total_buy,
            tx.total_sell,
            tx.total_profit,
            tx.profit_percent,
            tx.payment_status,
            tx.payment_method,
            tx.customer_type.as_deref().unwrap_or("B2B"),
            tx.notes,
            tx.discount_amount.unwrap_or(0.0),
            tx.discount_code,
            tx.points_used.unwrap_or(0.0),
            tx.points_discount.unwrap_or(0.0),
            tx.points_earned.unwrap_or(0.0),
            tx.final_total.unwrap_or(0.0),
            is_pre_order_val,
            tx.pic_name,
            tx.created_at,
            is_split_val,
            tx.cash_amount.unwrap_or(0.0),
            tx.non_cash_amount.unwrap_or(0.0),
            tx.non_cash_method,
            tx.change_amount.unwrap_or(0.0),
            tx.infaq_amount.unwrap_or(0.0),
            tx.shift_id,
            tx.refund_status,
            tx.refund_total.unwrap_or(0.0),
        ],
    )?;
    Ok(())
}

pub fn local_clear_cache(conn: &Connection) -> SqliteResult<()> {
    conn.execute_batch(
        "
        DELETE FROM category_markups;
        DELETE FROM products;
        DELETE FROM buyers;
        DELETE FROM pre_orders;
        DELETE FROM transactions;
        DELETE FROM discounts;
        DELETE FROM store_settings;
        DELETE FROM purchase_receipt_items;
        DELETE FROM purchase_receipts;
        DELETE FROM suppliers;
        DELETE FROM sync_outbox;
        ",
    )?;
    Ok(())
}


