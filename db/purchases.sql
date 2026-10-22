CREATE TABLE IF NOT EXISTS purchase_receipts (
    id VARCHAR(50) PRIMARY KEY,
    supplier_invoice_no VARCHAR(100),
    date VARCHAR(50),
    supplier VARCHAR(100),
    total_buy NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    -- BUG-017: kolom JSONB ini kini hanya "mirror" (deprecated).
    -- Sumber kebenaran item nota adalah tabel `purchase_receipt_items` (normalized).
    -- Dipertahankan nullable agar bisa di-drop tanpa migrasi data destruktif.
    receipt JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_receipt_items (
    id VARCHAR(50) PRIMARY KEY,
    receipt_id VARCHAR(50) NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(50),
    qty_received NUMERIC(15,2) NOT NULL DEFAULT 0,
    -- BUG FIX: kuantitas dalam SATUAN DASAR produk & faktor konversi satuan
    -- kemasan -> satuan dasar. Dipakai untuk adjusting stok saat edit/hapus nota.
    base_qty NUMERIC(15,2) NOT NULL DEFAULT 0,
    conversion_factor NUMERIC(15,4) NOT NULL DEFAULT 1,
    buy_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    subtotal_buy NUMERIC(15,2) NOT NULL DEFAULT 0,
    markup_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    new_sell_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt_id ON purchase_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_product_id ON purchase_receipt_items(product_id);

-- Migrasi idempotent untuk tabel yang sudah ada sebelum kolom base_qty/conversion_factor
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS base_qty NUMERIC(15,2) DEFAULT 0;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS conversion_factor NUMERIC(15,4) DEFAULT 1;

