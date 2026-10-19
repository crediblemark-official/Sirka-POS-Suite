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
