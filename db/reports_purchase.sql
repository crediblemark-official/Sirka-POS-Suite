-- ============================================================
-- Laporan Pembelian per Item — Kasir Citra
-- ============================================================
-- BUG-017 FIX: data item purchase receipt kini tersimpan di tabel
-- ternormalisasi `purchase_receipt_items`, sehingga bisa di-query
-- per item langsung dari SQL (tidak perlu parse kolom JSONB).
--
-- Jalankan: psql -h 127.0.0.1 -p 5434 -U kasir_citra_user -d kasir_citra_db -f db/reports_purchase.sql
-- ============================================================


-- ------------------------------------------------------------
-- 1. Ringkasan pembelian per barang (semua nota)
-- ------------------------------------------------------------
SELECT
    i.product_id,
    i.code,
    i.name                                     AS nama_barang,
    i.category,
    i.unit,
    COUNT(DISTINCT i.receipt_id)                AS jumlah_nota,
    SUM(i.qty_received)                         AS total_qty,
    SUM(i.subtotal_buy)                         AS total_beli,
    ROUND(AVG(i.buy_price), 2)                  AS rata2_harga_beli,
    MAX(i.buy_price)                            AS harga_beli_tertinggi,
    MIN(i.buy_price)                            AS harga_beli_terendah,
    ROUND(AVG(i.new_sell_price), 2)             AS rata2_harga_jual,
    MAX(i.created_at)                           AS pembelian_terakhir
FROM purchase_receipt_items i
GROUP BY i.product_id, i.code, i.name, i.category, i.unit
ORDER BY total_beli DESC;


-- ------------------------------------------------------------
-- 2. Rekap per supplier (kategori vendor)
-- ------------------------------------------------------------
SELECT
    r.supplier,
    COUNT(DISTINCT r.id)                        AS jumlah_nota,
    COUNT(i.id)                                 AS jumlah_baris_item,
    SUM(i.qty_received)                         AS total_qty,
    SUM(i.subtotal_buy)                         AS total_beli,
    MIN(r.date)                                 AS periode_awal,
    MAX(r.date)                                 AS periode_akhir
FROM purchase_receipts r
JOIN purchase_receipt_items i ON i.receipt_id = r.id
GROUP BY r.supplier
ORDER BY total_beli DESC;


-- ------------------------------------------------------------
-- 3. Detail per nota (bisa dipakai untuk audit / cetak ulang)
-- ------------------------------------------------------------
SELECT
    r.id                                        AS receipt_id,
    r.supplier_invoice_no                       AS no_nota_vendor,
    r.date                                      AS tanggal,
    r.supplier,
    i.code,
    i.name                                      AS nama_barang,
    i.qty_received                              AS qty,
    i.unit,
    i.buy_price                                 AS harga_beli,
    i.subtotal_buy                             AS subtotal,
    i.markup_percent                            AS markup_persen,
    i.new_sell_price                            AS harga_jual_baru
FROM purchase_receipts r
JOIN purchase_receipt_items i ON i.receipt_id = r.id
ORDER BY r.date DESC, r.id, i.created_at, i.id;


-- ------------------------------------------------------------
-- 4. Deteksi selisih: subtotal item vs total header nota
--    (nilai != 0 berarti ada nota yang tidak konsisten)
-- ------------------------------------------------------------
SELECT
    r.id                                        AS receipt_id,
    r.supplier_invoice_no,
    r.date,
    r.supplier,
    r.total_buy                                 AS total_header,
    COALESCE(SUM(i.subtotal_buy), 0)            AS total_item,
    r.total_buy - COALESCE(SUM(i.subtotal_buy), 0) AS selisih
FROM purchase_receipts r
LEFT JOIN purchase_receipt_items i ON i.receipt_id = r.id
GROUP BY r.id, r.supplier_invoice_no, r.date, r.supplier, r.total_buy
HAVING r.total_buy <> COALESCE(SUM(i.subtotal_buy), 0)
ORDER BY r.date DESC;


-- ------------------------------------------------------------
-- 5. Cek konsistensi data historis (backfill BUG-017)
--    Mengembalikan nota yang itemnya belum ternormalisasi.
--    Hasil kosong = seluruh data sudah dinormalisasi.
-- ------------------------------------------------------------
SELECT
    r.id                                        AS receipt_id,
    r.supplier_invoice_no,
    r.date,
    r.supplier,
    (r.receipt->'items') IS NOT NULL            AS punya_jsonb_items
FROM purchase_receipts r
WHERE NOT EXISTS (
    SELECT 1 FROM purchase_receipt_items i WHERE i.receipt_id = r.id
)
ORDER BY r.date DESC;


-- ------------------------------------------------------------
-- 6. Rekap harga beli per barang per bulan (untuk analisis HPP)
-- ------------------------------------------------------------
SELECT
    to_char(r.date, 'YYYY-MM')                  AS periode,
    i.product_id,
    i.name                                      AS nama_barang,
    COUNT(*)                                    AS jumlah_transaksi,
    SUM(i.qty_received)                         AS total_qty,
    SUM(i.subtotal_buy)                         AS total_beli,
    ROUND(AVG(i.buy_price), 2)                  AS rata2_harga_beli
FROM purchase_receipt_items i
JOIN purchase_receipts r ON r.id = i.receipt_id
GROUP BY to_char(r.date, 'YYYY-MM'), i.product_id, i.name
ORDER BY periode DESC, total_beli DESC;
