-- Migrasi Kasir Citra (idempotent — aman dijalankan berulang kali)
-- Otomatis dieksekusi aplikasi saat startup (src-tauri/src/lib.rs::ensure_migrations).
-- Bila perlu dijalankan manual: psql -h 127.0.0.1 -p 5434 -U kasir_citra_user -d kasir_citra_db -f db/migrations.sql

-- BUG-011: flag pesanan/titipan pada transaksi
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_pre_order BOOLEAN DEFAULT FALSE;

-- Gap-3 (PRD Aturan #4): PIC penerima barang pada faktur B2B
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS pic_name TEXT;

-- BUG-016: barcode barang untuk scanning di kasir
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- BUG-017: Normalisasi kolom purchase_receipts dan tabel purchase_receipt_items
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS supplier_invoice_no VARCHAR(100);
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS date VARCHAR(50);
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS supplier VARCHAR(100);
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS total_buy NUMERIC(15,2) DEFAULT 0;
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS notes TEXT;

-- BUG-017: kolom `receipt` JSONB menjadi nullable (deprecated) — sumber kebenaran
-- item nota sudah pindah ke tabel `purchase_receipt_items` (normalized).
ALTER TABLE purchase_receipts ALTER COLUMN receipt DROP NOT NULL;

CREATE TABLE IF NOT EXISTS purchase_receipt_items (
    id VARCHAR(50) PRIMARY KEY,
    receipt_id VARCHAR(50) NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL,
    code VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    unit VARCHAR(50),
    qty_received NUMERIC(15,2) NOT NULL DEFAULT 0,
    buy_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    subtotal_buy NUMERIC(15,2) NOT NULL DEFAULT 0,
    markup_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    new_sell_price NUMERIC(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt_id ON purchase_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_product_id ON purchase_receipt_items(product_id);

-- BUG-017: Backfill — normalisasi item nota lama yang hanya tersimpan di kolom JSONB
-- ke tabel purchase_receipt_items, supaya seluruh data historis bisa di-query per item.
INSERT INTO purchase_receipt_items (
    id, receipt_id, product_id, code, name, category, unit,
    qty_received, buy_price, subtotal_buy, markup_percent, new_sell_price
)
SELECT
    COALESCE(
        NULLIF(item.item->>'id', ''),
        md5(r.id || '|' || item.ord::text)
    ),
    r.id,
    COALESCE(item.item->>'productId', ''),
    NULLIF(item.item->>'code', ''),
    COALESCE(item.item->>'name', ''),
    NULLIF(item.item->>'category', ''),
    NULLIF(item.item->>'unit', ''),
    CASE WHEN (item.item->>'qtyReceived') ~ '^-?[0-9]+(\.[0-9]+)?$'
         THEN (item.item->>'qtyReceived')::numeric ELSE 0 END,
    CASE WHEN (item.item->>'buyPrice') ~ '^-?[0-9]+(\.[0-9]+)?$'
         THEN (item.item->>'buyPrice')::numeric ELSE 0 END,
    CASE WHEN (item.item->>'subtotalBuy') ~ '^-?[0-9]+(\.[0-9]+)?$'
         THEN (item.item->>'subtotalBuy')::numeric
         ELSE CASE WHEN (item.item->>'qtyReceived') ~ '^-?[0-9]+(\.[0-9]+)?$'
                   AND (item.item->>'buyPrice') ~ '^-?[0-9]+(\.[0-9]+)?$'
              THEN (item.item->>'qtyReceived')::numeric * (item.item->>'buyPrice')::numeric
              ELSE 0 END END,
    CASE WHEN (item.item->>'markupPercent') ~ '^-?[0-9]+(\.[0-9]+)?$'
         THEN (item.item->>'markupPercent')::numeric ELSE 0 END,
    CASE WHEN (item.item->>'newSellPrice') ~ '^-?[0-9]+(\.[0-9]+)?$'
         THEN (item.item->>'newSellPrice')::numeric ELSE 0 END
FROM purchase_receipts r
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
        WHEN jsonb_typeof(r.receipt) = 'array' THEN r.receipt
        ELSE COALESCE(r.receipt->'items', '[]'::jsonb)
    END
) WITH ORDINALITY AS item(item, ord)
WHERE r.receipt IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM purchase_receipt_items i WHERE i.receipt_id = r.id)
ON CONFLICT (id) DO NOTHING;

-- Tabel Rekap Pergantian Shift Kasir & Rekonsiliasi Kas Laci
CREATE TABLE IF NOT EXISTS cashier_shifts (
    id VARCHAR(50) PRIMARY KEY,
    cashier_name VARCHAR(100) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    starting_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
    cash_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
    non_cash_sales NUMERIC(15,2) NOT NULL DEFAULT 0,
    cash_outflow NUMERIC(15,2) NOT NULL DEFAULT 0,
    expected_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
    actual_cash NUMERIC(15,2) NOT NULL DEFAULT 0,
    discrepancy NUMERIC(15,2) NOT NULL DEFAULT 0,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_status ON cashier_shifts(status);
CREATE INDEX IF NOT EXISTS idx_cashier_shifts_start_time ON cashier_shifts(start_time);

-- Pemisahan Entitas: Tabel Master Supplier Pemasok
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(50),
    contact_person VARCHAR(100),
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Kolom supplier pada produk barang dagangan
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier);
