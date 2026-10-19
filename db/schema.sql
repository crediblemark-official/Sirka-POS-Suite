-- Schema Database Kasir Citra (POS & Distribusi Penjualan)
-- PostgreSQL 16

CREATE TABLE IF NOT EXISTS category_markups (
    category VARCHAR(100) PRIMARY KEY,
    default_markup_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    description TEXT
);

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL REFERENCES category_markups(category) ON UPDATE CASCADE,
    unit VARCHAR(50) NOT NULL,
    default_markup_percent NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    last_buy_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    last_sell_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    stock NUMERIC(15,2) NOT NULL DEFAULT 0,
    barcode TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pre_orders (
    id VARCHAR(50) PRIMARY KEY,
    date DATE NOT NULL,
    day_name VARCHAR(20) NOT NULL,
    buyer VARCHAR(100) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_loaded_to_pos BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    invoice_no VARCHAR(100) UNIQUE NOT NULL,
    date DATE NOT NULL,
    buyer VARCHAR(100) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_buy NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_sell NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_profit NUMERIC(15,2) NOT NULL DEFAULT 0,
    profit_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'LUNAS',
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Transfer Bank',
    customer_type VARCHAR(20) NOT NULL DEFAULT 'B2B',
    notes TEXT,
    discount_amount NUMERIC(15,2) DEFAULT 0,
    discount_code VARCHAR(50),
    points_used NUMERIC(10,0) DEFAULT 0,
    points_discount NUMERIC(15,2) DEFAULT 0,
    points_earned NUMERIC(10,0) DEFAULT 0,
    final_total NUMERIC(15,2) DEFAULT 0,
    is_pre_order BOOLEAN DEFAULT FALSE,
    pic_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions(buyer);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(payment_status);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_type ON transactions(customer_type);
CREATE INDEX IF NOT EXISTS idx_preorders_date_buyer ON pre_orders(date, buyer);

CREATE TABLE IF NOT EXISTS buyers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50),
    phone VARCHAR(50),
    address TEXT,
    customer_type VARCHAR(20) NOT NULL DEFAULT 'B2B',
    member_card_no VARCHAR(50),
    tier VARCHAR(20) NOT NULL DEFAULT 'REGULAR',
    points NUMERIC(10,0) NOT NULL DEFAULT 0,
    total_spend NUMERIC(15,2) NOT NULL DEFAULT 0,
    member_since TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS discounts (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'PERCENT',
    value NUMERIC(15,2) NOT NULL DEFAULT 0,
    min_purchase NUMERIC(15,2) NOT NULL DEFAULT 0,
    max_discount NUMERIC(15,2),
    scope VARCHAR(30) NOT NULL DEFAULT 'ALL',
    target_category VARCHAR(100),
    target_customer_type VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    description TEXT,
    usage_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS store_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS purchase_receipts (
    id VARCHAR(50) PRIMARY KEY,
    receipt JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
