use rusqlite::{Connection, Result as SqliteResult};

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
    crate::local_db::purchases::local_backfill_purchase_items(conn);

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
