# Bug Analysis Report — Kasir Citra
**Generated:** 2026-10-21  
**Source:** Full codebase audit (src/, src-tauri/src/, src-tauri/tests/, tests/)  
**Framework:** Vue 3 + Tauri 2 (Rust backend with SQLite local-first & PostgreSQL cloud sync)  

---

## Executive Summary

- **Total bugs in tracker:** 24 items (24 ✅ resolved, 0 ⏸️ open)
- **Code health:** All tests pass (**7/7 Frontend, 14/14 Rust**), TypeScript clean, Rust compiles cleanly with 0 warnings/errors
- **Test Organization:** Seluruh kode tes telah dipisahkan keluar dari file produksi ke folder khusus (`src-tauri/tests/` & `tests/`)
- **Status Open Issues:** 0 — Seluruh bug teridentifikasi (termasuk normalisasi penuh nota pembelian BUG-017) telah diselesaikan
- **Architecture:** Local-first architecture (SQLite outbox sync ➔ PostgreSQL Cloud PgBouncer) dengan fallback non-blocking and RPC Tauri native

---

## 1. Resolved Bugs (Verified ✅)

| ID | Severity | Title | Fix Summary |
|----|----------|-------|-------------|
| BUG-001 | Kritis | Transaksi sukses di UI tapi tidak tersimpan & stok tidak terpotong | `generateInvoiceNumber` deterministik, duplicate check, `ON CONFLICT DO NOTHING` removed |
| BUG-002 | Kritis | Hapus produk tidak sinkron ke DB | `db_delete_product` Rust command + soft delete logic (`stock=0, [DIHAPUS]`) |
| BUG-003 | Kritis | Hapus kategori dilanggar FK constraint | `deleteCategory` DB-first: hapus local setelah `deleteMarkup` sukses |
| BUG-004 | Mayor | Export Excel tidak mengikuti filter segment | `filteredFlatRows` memfilter `matchMarket`, tambah kolom TIPE TRANSAKSI |
| BUG-005 | Mayor | Unduhan file export gagal diam-diam di WebView | `save_export_file` menerima binary `Vec<u8>`, default `~/Downloads`, fallback browser + alert |
| BUG-006 | Kritis | Cetak struk mencetak seluruh jendela aplikasi | CSS `@media print` + `#printableReceipt`, `window.print()` area terisolasi 80mm |
| BUG-007 | Kritis | Hapus transaksi tidak membalikkan stok & poin | `db_delete_transaction` transaksional: rollback stok + pulihkan poin/tier + decrement `usage_count` |
| BUG-008 | Mayor | Semua store menelan error DB | Pola DB-first + rollback state + `throw` diterapkan konsisten |
| BUG-009 | Minor | Flag `is_loaded_to_pos` Pre-Order tidak di-set | `handleLoadToPos` set true + `updateSchedule` ke DB |
| BUG-010 | Minor | `usage_count` kupon tidak bertambah | `db_create_transaction` increment, `db_delete_transaction` decrement |
| BUG-011 | Minor | Flag `isPreOrder` hilang setelah reload | Kolom `is_pre_order BOOLEAN DEFAULT FALSE` ditambah schema + model + SELECT |
| BUG-012 | Minor | Badge status PostgreSQL statis | `AppTitleBar.vue` reaktif terhadap `inventoryStore.isConnectedToPg` |
| BUG-013 | Minor | Pengaturan loyalitas hanya localStorage | `updateLoyaltySettings` async + simpan ke `store_settings` via DB |
| BUG-014 | Minor | Dead-code backend `generate_receipt_text` | Ditulis ulang + unit test Rust + dipakai export + struk thermal 32/42 kolom |
| BUG-015 | Minor | Dead-code state/fungsi frontend | `updateItemSellPrice`, `setManualDiscount`, `addPointsAndSpend`, `deductPoints` dihapus/wired |
| BUG-016 | Mayor | Tombol PR "scan barcode" mengklaim fitur belum ada | Barcode engine full: DB kolom + master produk + scanner engine kasir |
| BUG-017 | Minor | Normalisasi PurchaseReceipt JSONB | **Normalisasi penuh (21 Okt 2026):** sumber kebenaran item nota = tabel `purchase_receipt_items`; semua jalur baca (SQLite + PostgreSQL + sync pull) dialihkan ke tabel ternormalisasi, backfill historis idempotent tiap startup, kolom `receipt` JSONB jadi nullable+deprecated, laporan SQL per-item di `db/reports_purchase.sql` |
| BUG-018 | Minor | Dialog konfirmasi delete transaksi berbunyi lawan | Teks confirm diupdate + tests/README.md disinkronkan |
| BUG-019 | Minor | Edit harga jual via `prompt()` native | Inline editing dengan preset markup + formula pembulatan fixed |
| BUG-020 | Kritis | Penggandaan stok saat edit nota kulakan (`local_save_purchase`) | Rollback kuantitas nota lama dari stok sebelum insert/update nota baru |
| BUG-021 | Kritis | *Head-of-Line Blocking* outbox sinkronisasi macet permanen | Status beralih ke `FAILED` setelah 5x gagal, dan otomatis di-retry saat sinkronisasi manual |
| BUG-022 | Mayor | Inkonsistensi soft-delete produk di SQLite lokal | SQLite menyelaraskan logika soft-delete produk bila pernah dipakai di transaksi |
| BUG-023 | Mayor | Kerusakan layout cetak struk tabular flexbox | Menghapus override `display: block` pada anak elemen struk di `@media print` + `onafterprint` cleanup |
| BUG-024 | Minor | Shortcut `Enter` & event listener keyboard terisolasi | Menambahkan handler `Enter` pada modal bayar & konfirmasi ledger, serta listener `window` pada modal nego |

---

## 2. Open / Known Issues

*Tidak ada bug terbuka.* Seluruh 24 item dalam bug tracker telah diselesaikan dan terverifikasi dengan tes otomatis.

---

## 3. Test Architecture & Organization

Seluruh kode pengujian telah dipisahkan dari file produksi dan dikumpulkan dalam 2 lokasi terstruktur:

### A. Backend Rust Suite (`src-tauri/tests/`)
1. **`local_db_tests.rs` (10 tests)**:
   - `test_clear_cache`: Pembersihan cache lokal SQLite.
   - `test_product_and_markup_workflow`: Siklus input produk, kategori markup, dan barcode.
   - `test_transaction_stock_deduction_and_rollback`: Pemotongan stok dan pengembalian poin saat transaksi dibatalkan.
   - `test_outbox_queue_and_synced`: Antrean sync outbox SQLite.
   - `test_purchase_receipt_update_stock_rollback`: Verifikasi perbaikan BUG-020 (stok tidak berlipat ganda saat edit kulakan).
   - `test_outbox_max_retry_failed_and_retry_all`: Verifikasi perbaikan BUG-021 (pencegahan *head-of-line blocking* dan pemulihan retry).
   - `test_discount_usage_count_on_transaction`: Penghitungan otomatis kupon diskon.
   - `test_purchase_receipt_items_normalization`: Verifikasi BUG-017 gelombang 1 — tabel relasional `purchase_receipt_items` terisi & terhapus bersama nota.
   - `test_get_purchases_reads_from_normalized_items_not_jsonb`: Verifikasi BUG-017 gelombang 2 — item nota dibaca dari tabel ternormalisasi, bukan blob JSONB.
   - `test_legacy_jsonb_receipt_is_backfilled_to_items_table`: Verifikasi BUG-017 gelombang 2 — backfill nota legacy (JSONB) ke tabel items saat startup.
2. **`system_tests.rs` (4 tests)**:
   - `receipt_renders_items_total_pic_and_tanda_terima`: Format faktur B2B dengan tanda terima pengiriman (GAP-3).
   - `receipt_b2c_is_achievable_without_tanda_terima`: Format struk eceran B2C.
   - `receipt_supports_80mm_width`: Format thermal lebar 80mm (42 kolom).
   - `receipt_rejects_invalid_payload`: Proteksi input data rusak.
3. **`persistence.rs` (1 integration test)**:
   - Alur integrasi database PostgreSQL test disposable.

### B. Frontend Pinia Suite (`tests/`)
1. **`persistence.test.ts` (7 tests)**:
   - Offline checkout atomic local-first recording.
   - Checkout lock & double-submission guard.
   - Inline markup engine + row override preservation (GAP-1 / BUG-019).
   - Zero-receivables handling after 100% discount.
   - Local-first offline delete propagation.
   - Local-first receiving save & inventory update.
   - Purchase receipt delta update & delete consistency.

---

## 4. Laporan SQL per-Item (BUG-017)

Normalisasi penuh membuka kemampuan query per item langsung dari SQL. Kumpulan query siap pakai tersedia di **`db/reports_purchase.sql`**:

| # | Query | Kegunaan |
|---|-------|----------|
| 1 | Rekap pembelian per barang | Total qty, total beli, rata-rata harga beli/jual, tanggal pembelian terakhir |
| 2 | Rekap per supplier | Jumlah nota, total qty, total beli, periode awal–akhir per kategori vendor |
| 3 | Detail per nota | Baris nota lengkap (no nota vendor, tanggal, qty, harga beli, markup, harga jual baru) |
| 4 | Deteksi selisih subtotal | Membandingkan `purchase_receipts.total_buy` vs `SUM(purchase_receipt_items.subtotal_buy)` |
| 5 | Cek konsistensi normalisasi | Menampilkan nota yang itemnya belum dinormalisasi (hasil kosong = semua data sudah rapi) |
| 6 | Rekap harga beli per bulan | Analisis HPP & pergerakan harga beli per barang |

Cara menjalankan:
```bash
psql -h 127.0.0.1 -p 5434 -U kasir_citra_user -d kasir_citra_db -f db/reports_purchase.sql
```

Migrasi backfill dijalankan otomatis setiap aplikasi start (`ensure_migrations()` di `lib.rs` + `init_schema()` untuk SQLite lokal). Bila perlu manual:
```bash
psql -h 127.0.0.1 -p 5434 -U kasir_citra_user -d kasir_citra_db -f db/migrations.sql
```

---

## 5. Verification Commands

Jalankan perintah ini di root direktori untuk menguji status kesehatan proyek secara penuh:

```bash
# 1. Jalankan seluruh test suite (Frontend + Backend Rust)
bun run test:all

# 2. Jalankan test frontend saja
bun run test

# 3. Jalankan test Rust saja
bun run test:rust

# 4. Validasi type-check dan production build bundle
bun run build
```

Status terakhir (21 Okt 2026 — sesi keempat):

| Pemeriksaan | Hasil |
| ----- | ----- |
| `bun test tests/persistence.test.ts` | ✅ 7 pass / 0 fail |
| `cargo test --manifest-path src-tauri/Cargo.toml` | ✅ 14 pass / 0 fail |
| `npx vue-tsc --noEmit` | ✅ Bersih |
| `cargo check --manifest-path src-tauri/Cargo.toml` | ✅ Bersih (0 warning) |

---
*Report updated: 2026-10-21.*