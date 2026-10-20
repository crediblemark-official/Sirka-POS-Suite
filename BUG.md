# Bug & Issue Tracker — Kasir Citra

**Terakhir diperbarui:** 21 Oktober 2026 (Verifikasi Perbaikan #4)
**Sumber:** Audit gap implementasi terhadap PRD v2.2 (Section 7.2–7.3 pada `prd_sistem_kasir_distribusi_sppg.md`)
**Format status:** `[ ]` Buka · `[~]` Dikerjakan / Sebagian · `[x]` Selesai

> Catatan: nomor ID mengikuti urutan pemanggilan saat audit. Referensi `file:line` mengikuti kondisi repo saat audit — bisa bergeser setelah ada perubahan kode.

---

## ✅ Verifikasi Perbaikan #4 (21 Okt 2026 — sesi keempat, BUG-017 normalisasi penuh)

| Pemeriksaan | Hasil |
| ----- | ----- |
| `cargo check --manifest-path src-tauri/Cargo.toml` | ✅ Bersih (tanpa warning) |
| `cargo test --manifest-path src-tauri/Cargo.toml` | ✅ **14 pass / 0 fail** (10 test `local_db_tests` + 4 test struk) |
| `bun test tests/persistence.test.ts` | ✅ **7 pass / 0 fail** |
| `npx vue-tsc --noEmit` | ✅ Bersih |

**Progress sesi keempat:**
- **BUG-017 ✅ (normalisasi penuh)** — item nota kulakan kini sumber kebenaran ada di tabel `purchase_receipt_items`, bukan blob JSONB:
  - Semua jalur **baca** dialihkan ke tabel ternormalisasi: `local_get_purchases`, `local_save_purchase`, `local_delete_purchase`, `pg_save_purchase`, `pg_delete_purchase`, dan jalur pull `sync.rs` (PG→SQLite).
  - **Backfill historis** (idempotent, tiap startup): SQLite `local_backfill_purchase_items()` di `init_schema()`; PostgreSQL di `db/migrations.sql` (`jsonb_array_elements ... WITH ORDINALITY`).
  - **Fallback JSONB** tetap dipertahankan untuk nota legacy yang belum dinormalisasi.
  - Kolom `receipt` JSONB jadi **nullable + deprecated** — bisa di-drop tanpa migrasi data destruktif.
  - **Laporan SQL per-item** baru: `db/reports_purchase.sql` (6 query: rekap per barang, per supplier, detail nota, deteksi selisih subtotal, cek konsistensi, rekap per bulan).
  - 2 test regresi Rust baru: `test_get_purchases_reads_from_normalized_items_not_jsonb` & `test_legacy_jsonb_receipt_is_backfilled_to_items_table`.
- **Catatan arsitektur:** query PostgreSQL pada jalur sync dipisah dari penulisan SQLite agar `MutexGuard` rusqlite tidak melewati `.await` (butuh future `Send`).

## ✅ Verifikasi Perbaikan #3 (19 Okt 2026 — sesi ketiga, fitur sisa + fungsional baru)

| Pemeriksaan | Hasil |
| ----- | ----- |
| `cargo check` | ✅ Bersih |
| `cargo test --lib` (3 test struk thermal baru) | ✅ 3 pass / 0 fail |
| `bun test tests/persistence.test.ts` | ✅ 6 pass / 0 fail |
| `npx vue-tsc --noEmit` | ✅ Bersih |

**Progress sesi ketiga:**
- **BUG-014 ✅ & BUG-006 ✅** — struk thermal berfungsi utuh (generator Rust + UI preview/salin/simpan).
- **BUG-016 ✅** — fitur barcode dibangun: kolom DB + migrasi otomatis startup, master produk, scanner engine kasir (buffer kecepatan + lookup + feedback), jalur pencarian.
- **GAP-3 (PRD Aturan #4) ✅** — kolom `pic_name` transaksi (schema + migrasi + model + INSERT/SELECT), input PIC di modal bayar B2B, blok PIC & tanda terima pengiriman di faktur cetak + struk thermal + salinan WhatsApp.
- **Migrasi otomatis baru:** `db/migrations.sql` + hook `ensure_migrations()` di `lib.rs` — ALTER idempotent dijalankan setiap aplikasi start. Bila perlu manual: `psql -f db/migrations.sql`.

## ✅ Verifikasi Perbaikan #2 (19 Okt 2026 — sesi kedua)

| Pemeriksaan | Hasil |
| ----- | ----- |
| `bun test tests/persistence.test.ts` | ✅ **6 pass / 0 fail** (5 lama + 1 baru: test engine markup BUG-019) |
| `npx vue-tsc --noEmit` | ✅ Bersih |
| Rust | Tidak ada perubahan backend pada sesi ini (cargo check tetap hijau dari Verifikasi #1) |

**Progress sesi kedua:** BUG-018 ✅, BUG-019 ✅ (GAP-1 v2.2 inti tertutup), BUG-015 ✅.

## ✅ Verifikasi Perbaikan #1 (19 Okt 2026)

**Hasil pengujian pada perubahan yang belum di-commit (working tree):**

| Pemeriksaan | Hasil |
| ----- | ----- |
| `bun test tests/persistence.test.ts` | ✅ **5 pass / 0 fail** (22 assertion) |
| `npx vue-tsc --noEmit` | ✅ Bersih, tanpa error |
| `cargo check --manifest-path src-tauri/Cargo.toml` | ✅ Bersih, tanpa error |

**Ringkasan:** 11 PENUH, 3 SEBAGIAN, 3 BELUM dari 17 item terdaftar.

---

## 🔴 Kritis

### BUG-001: Transaksi bisa "sukses" di UI tapi tidak tersimpan & stok tidak terpotong
- **Status:** `[x]` **SELESAI** (diverifikasi)
- **Perbaikan yang dilakukan:**
  - `generateInvoiceNumber` kini deterministik: urutan = jumlah transaksi tanggal sama + 1, dengan loop cek duplikat (`posStore.ts:~311-327`).
  - Backend: pre-check duplikat `SELECT id ... WHERE id = $1 OR invoice_no = $2` → return **error** (bukan sukses). `ON CONFLICT DO NOTHING` dihapus (`transactions.rs`, komentar `BUG-001 FIX`).
  - Validasi input: poin/total wajib finite & non-negative.
  - `processCheckout` kini `throw` error DB (tidak menutupi kegagalan), `isCheckingOut` dioptimalkan benar.
  - ID transaksi diberi suffix acak tambahan `tx-${Date.now()}-${random}` untuk mengurangi tabrakan antar tab.
- **Uji:** tercakup di `tests/persistence.test.ts` (retry idempotency) — pass.

### BUG-002: Hapus produk tidak sinkron ke DB — produk "dihapus" muncul lagi
- **Status:** `[x]` **SELESAI** (diverifikasi)
- **Perbaikan:** command Rust baru `db_delete_product` (`src-tauri/src/commands/products.rs`, komentar `BUG-002 FIX`) — soft delete (stok=0 + catatan `[DIHAPUS]`) jika produk sudah dipakai di transaksi (histori tetap valid), hard delete jika belum; `deleteProduct` store kini DB-first + `alert` error ke UI.

### BUG-003: Hapus kategori diterapkan lokal walau DB menolak (FK constraint)
- **Status:** `[x]` **SELESAI** (diverifikasi)
- **Perbaikan:** `deleteCategory` kini DB-first: hanya menghapus lokal setelah `deleteMarkup` sukses; error FK ditampilkan via `alert` (`inventoryStore.ts`, komentar `BUG-003 FIX`). Barrier FK tetap aktif sebagai proteksi data.

---

## 🟠 Mayor

### BUG-004: Export Excel tidak mengikuti filter segmen B2B/B2C & tanpa kolom tipe transaksi
- **Status:** `[x]` **SELESAI** (diverifikasi)
- **Perbaikan:** `filteredFlatRows` kini memfilter `matchMarket` (`LedgerView.vue:151`); export menyertakan kolom **TIPE TRANSAKSI** (`ledgerStore.ts`, `'TIPE TRANSAKSI': r.customerType`).

### BUG-005: Unduhan file export berpotensi gagal diam-diam di Tauri WebView
- **Status:** `[x]` **SELESA** (diverifikasi)
- **Perbaikan:** `save_export_file` Rust kini menerima binary `Vec<u8>` dan default menulis ke folder `~/Downloads` (`system.rs`); frontend `exportToExcel` kini `XLSX.write → arrayOfBytes → dbService.saveExportFile`, dengan fallback browser hanya bila gagal (`ledgerStore.ts:~134-146`) + alert lokasi file.

### BUG-006: Cetak struk mencetak seluruh jendela aplikasi
- **Status:** `[x]` **SELESAI** (diverifikasi Verifikasi #3)
- **Selesai:**
  - CSS `@media print` + `#printableReceipt` isolate + `@page { margin: 4mm }` (Verifikasi #1) → `window.print()` mencetak hanya area struk (max-width 80mm).
  - (Verifikasi #3) **BUG-014 FIX**: `generate_receipt_text` ditulis ulang — membangun struk **teks thermal 32 kolom utuh dari data transaksi lengkap** (items, diskon, poin, PIC, tanda terima) di Rust; frontend `ReceiptModal` kini punya tombol **"Struk Thermal"** dengan preview, salin teks, dan simpan `.txt` — siap dikirim ke printer 58mm / driver label. 3 unit test Rust.

### BUG-007: Hapus transaksi tidak membalikkan stok & poin
- **Status:** `[x]` **SELESAI** (backend Verifikasi #1; teks UI & README disinkron pada BUG-018, Verifikasi #2)
- **Selesai (backend):** `db_delete_transaction` kini **transaksional**: rollback stok per item + pulihkan poin/tier member + decrement `usage_count` kupon (`transactions.rs`, komentar `BUG-007 FIX`).
- **Selesai (dokumentasi/UI):** dialog konfirmasi & `tests/README.md` kini menyatakan perilaku reversal dengan benar (lihat BUG-018).

### BUG-008: Semua store menelan error DB — data bisa terlihat ada padahal gagal tersimpan
- **Status:** `[x]` **SELESAI** (diverifikasi)
- **Perbaikan:** pola DB-first + rollback state + `throw` diterapkan konsisten di `buyerStore` (create/update/delete + loyalty), `inventoryStore` (markup/category/product/prices/stock), `preOrderStore` (save/update DB-first), `discountStore` (create/update/delete + rollback `old`). Error kini naik ke UI.

---

## 🟡 Minor

### BUG-009: Flag `is_loaded_to_pos` Pre-Order tidak pernah di-set
- **Status:** `[x]` **SELESA** (diverifikasi)
- **Perbaikan:** `handleLoadToPos` kini mengeset `isLoadedToPos = true` + `updateSchedule` ke DB (`PreOrderMatrix.vue:~193-195`); kartu menampilkan badge **"✓ Dimuat Kasir"** dan tombol berubah jadi **"Tarik Ulang"**. Error delete schedule kini di-alert.

### BUG-010: `usage_count` kupon tidak pernah bertambah
- **Status:** `[x]` **SELESA** (diverifikasi)
- **Perbaikan:** `db_create_transaction` increment `usage_count` saat kupon valid dipakai (skip `MANUAL` & `MEMBER-*`); `db_delete_transaction` decrement balik. Keduanya dalam satu transaksi DB.

### BUG-011: Flag `isPreOrder` transaksi hilang setelah reload
- **Status:** `[x]` **SELESAI** (diverifikasi)
- **Perbaikan:** kolom `is_pre_order BOOLEAN DEFAULT FALSE` ditambah di `db/schema.sql` (transactions), field `is_pre_order: Option<bool>` di model Rust, di-INSERT & di-SELECT (`COALESCE(is_pre_order, FALSE)`).

### BUG-012: Badge status "PostgreSQL Aktif" dimatikan (statis)
- **Status:** `[x]` **SELESA** (diverifikasi)
- **Perbaikan:** badge `AppTitleBar.vue` kini reaktif terhadap `inventoryStore.isConnectedToPg` — hijau "PostgreSQL Aktif" / merah "DB Terputus" + tooltip mode offline.

### BUG-013: Pengaturan program loyalitas hanya localStorage, tidak masuk DB
- **Status:** `[x]` **SELESA** (diverifikasi)
- **Perbaikan:** `updateLoyaltySettings` kini async dan menyimpan ke `store_settings` via `dbService.updateSetting('loyalty_settings', ...)`; `fetchBuyers` memuat balik dari DB (`buyerStore.ts`).

### BUG-014: Dead-code backend `generate_receipt_text` & `save_export_file`
- **Status:** `[x]` **SELESA** (Verifikasi #3)
- **Selesai:**
  - `save_export_file` dipakai export Excel (Verifikasi #1) dan kini juga dipakai simpan teks struk `.txt`.
  - `generate_receipt_text` ditulis ulang: menerima objek transaksi lengkap (items, diskon, poin, picName, isPreOrder, status bayar) dan menghasilkan struk teks 32 kolom siap printer thermal 58mm — termasuk blok tanda terima pengiriman (GAP-3) untuk faktur B2B. Frontend `ReceiptModal` menyediakan tombol "Struk Thermal" (preview + salin + simpan .txt); pengiriman ke perangkat mengikuti driver/spooler printer sistem yang tersambung.
  - 3 unit test Rust (`cargo test --lib`).

### BUG-015: Dead-code state/fungsi frontend yang melanggar PRD kalau tidak di-wire
- **Status:** `[x]` **SELESAI** (diverifikasi Verifikasi #2)
- **Selesai:**
  - `updateItemSellPrice` — kini wired SEBAGAI INPUT INLINE: kolom `Jual` di setiap baris keranjang (`PosCart.vue`); `prompt()` native dihapus.
  - `setManualDiscount` — wired: panel "Diskon Kasir" (% dan Rp) + reset + baris ringkasan potongan di PosCart.
  - `addPointsAndSpend` & `deductPoints` (`buyerStore.ts`) — **dihapus**: poin diurus backend secara atomik (`db_create_transaction` / `db_delete_transaction`).
  - `setPaymentStatus` (`ledgerStore.ts`) — sudah dihapus sendiri sejak Verifikasi #1.

### BUG-016: Tombol PR "scan barcode" mengklaim fitur yang belum ada
- **Status:** `[x]` **SELESA** (Verifikasi #3 — fitur dibangun utuh)
- **Selesai:**
  - **Backend/DB:** kolom `products.barcode TEXT` (schema.sql + `db/migrations.sql` idempotent, dieksekusi otomatis saat app start via `ensure_migrations` di `lib.rs`); `ProductRecord.barcode` + SELECT/UPSERT di `products.rs`; index `idx_products_barcode`.
  - **Master:** field "Barcode Kasir" di form barang (`MasterProducts.vue`).
  - **Kasir:** scanner engine di `ProductCatalog.vue` — buffer kecepatan tinggi (gap < 80 ms) ala scanner USB/HID, Enter memulai lookup exact barcode/SKU → langsung `addProductToCart` + feedback ✓/✗; jalur kedua saat kursor di kotak pencarian (`ExplorerToolbar.vue`, tab Kasir). Barcode juga ikut dipencari & ditandai di list view.
  - Placeholder pencarian kasir kini "Cari barang / SKU / barcode...".

### BUG-017: `PurchaseReceipt` disimpan sebagai JSONB tanpa normalisasi
- **Status:** `[x]` **SELESAI** — *normalisasi penuh, terverifikasi (sesi keempat, 21 Okt 2026)*
- **File:** `db/purchases.sql`, `db/migrations.sql`, `db/schema.sql`, `db/reports_purchase.sql`, `src-tauri/src/local_db.rs`, `src-tauri/src/commands/purchases.rs`, `src-tauri/src/sync.rs`, `src-tauri/tests/local_db_tests.rs`
- **Kondisi Sebelumnya:** tabel `purchase_receipts` hanya memakai kolom `receipt JSONB`, sehingga query SQL murni tidak bisa mengekstrak item per nota kulakan secara relasional.
- **Perbaikan (gelombang 1 — tabel relasional):**
  - Menambahkan kolom header relasional pada `purchase_receipts` (`supplier_invoice_no`, `date`, `supplier`, `total_buy`, `notes`).
  - Membuat tabel relasional `purchase_receipt_items` (`id`, `receipt_id`, `product_id`, `code`, `name`, `category`, `unit`, `qty_received`, `buy_price`, `subtotal_buy`, `markup_percent`, `new_sell_price`, `created_at`) dengan index dan relasi foreign key cascade.
  - Memperbarui penyimpanan lokal SQLite (`local_save_purchase`, `local_save_purchase_direct`, `local_delete_purchase`) dan PostgreSQL direct command (`pg_save_purchase`, `pg_delete_purchase`) agar otomatis menyisipkan dan membersihkan baris item secara relasional.
  - Test verifikasi relasional `test_purchase_receipt_items_normalization` berhasil lolos 100%.
- **Perbaikan (gelombang 2 — normalisasi penuh, 21 Okt 2026):** jalur **baca** masih bergantung pada blob JSONB dan data historis belum dinormalisasi, sehingga data lama tetap tidak bisa di-query per item dari SQL.
  - **Semua jalur baca dialihkan ke tabel ternormalisasi:**
    - `local_get_purchases` (SQLite) — dirakit ulang dari kolom header + `purchase_receipt_items` (helper `local_items_from_table`).
    - `local_save_purchase` & `local_delete_purchase` — rollback stok membaca item dari tabel items (helper `local_receipt_items`).
    - `pg_save_purchase` & `pg_delete_purchase` — rollback stok via helper baru `read_pg_items()` + `adjust_items()`.
    - `sync.rs` jalur pull PG→SQLite — item diambil dari `purchase_receipt_items`, bukan `receipt` JSONB.
  - **Backfill data historis (idempotent, jalan tiap startup):**
    - SQLite → `local_backfill_purchase_items()` dipanggil dari `init_schema()`.
    - PostgreSQL → `db/migrations.sql` (`jsonb_array_elements ... WITH ORDINALITY`, casting aman via regex, `ON CONFLICT DO NOTHING`).
  - **Fallback aman:** nota legacy yang belum dinormalisasi tetap terbaca lewat kolom JSONB (kolom & JSONB dipertahankan sebagai *mirror* kompatibilitas).
  - **Kolom `receipt` JSONB jadi `nullable` + deprecated** (PG & SQLite) — bisa di-drop kapan saja tanpa migrasi data destruktif.
  - **Laporan SQL per-item** ditambahkan di `db/reports_purchase.sql` — 6 query siap pakai: rekap per barang, rekap per supplier, detail per nota, deteksi selisih subtotal vs header, cek konsistensi normalisasi, dan rekap harga beli per bulan.
  - **Catatan arsitektur:** query `pg` pada jalur sync dipisah dari penulisan SQLite agar `MutexGuard` rusqlite tidak melewati `.await` (butuh future `Send`).
- **Uji regresi baru (Rust):**
  - `test_get_purchases_reads_from_normalized_items_not_jsonb` — item tetap utuh walau kolom JSONB dikosongkan.
  - `test_legacy_jsonb_receipt_is_backfilled_to_items_table` — nota lama otomatis dinormalisasi saat startup.
- **Status test suite (sesi keempat):** Rust 14 pass / 0 fail · Bun 7 pass / 0 fail · `vue-tsc` bersih · `cargo check` bersih.

---

## 🆕 Temuan Baru Saat Verifikasi

### BUG-018: Dialog konfirmasi delete transaksi berbunyi lawan dengan perilaku baru
- **Status:** `[x]` **SELESAI** (Verifikasi #2)
- **File:** `src/components/ledger/LedgerView.vue:216` vs `src-tauri/src/commands/transactions.rs` (BUG-007 FIX), `tests/README.md:22`
- **Gejala:** backend kini membalikkan stok+poin, tapi dialog masih bilang "tidak membatalkan stok atau poin" → user bisa salah keputusan (mengira aman menghapus, atau takut menghapus padahal aman).
- **Perbaikan (selesai):** teks confirm kini *"Stok barang dan poin member akan dikembalikan otomatis sesuai transaksi yang dihapus"* (`LedgerView.vue:216`); `tests/README.md:22` juga sudah disinkronkan.

### BUG-019: Edit harga jual via `prompt()` native — belum sesuai prinsip UX PRD
- **Status:** `[x]` **SELESAI** (Verifikasi #2 — GAP-1 v2.2 inti tertutup)
- **File:** `src/components/pos/PosCart.vue`, `src/stores/posStore.ts`
- **Gejala:** dialog prompt native memblok UI dan tidak inline-input sesuai baris PRD 101–102 ("Zero-Form", inline editing dengan Tab/Enter). Panel preset markup (`0/+15/+20/+25/+30%` + % custom) dan input inline `Harga Beli (Nota)` belum dibuat.
- **Perbaikan (selesai):**
  - `posStore`: fungsi baru `updateItemBuyPrice`, `updateItemMarkup`, `applyTransactionMarkup` + state `transactionMarkupPercent` (reset saat `clearCart`).
  - `posStore`: perbaikan bug pembulatan float sekaligus — formula kini `Math.round(buy * (100 + pct) / 100)` (dulu `buy * 1.pct`, mis. `50 * 1.15 = 57.499…` dibulatkan salah jadi 57, sewajarnya 58).
  - `PosCart.vue`: **Baris Kontrol Markup Dinamis** (preset `0/+15/+20/+25/+30%` + input `%` bebas desimal, indikator jumlah baris override) di atas daftar item.
  - `PosCart.vue`: setiap baris item kini punya input inline **Beli / +% / Jual** (badge `edit` bila harga jual override manual); baris manual dikecualikan dari preset transaksi; `handleEditSellPrice` (prompt) dihapus.
  - Test regresi baru di `tests/persistence.test.ts` (input harga beli, markup per baris, preset transaksi + baris manual dipertahankan).

### BUG-020: Penggandaan stok saat edit nota kulakan (`local_save_purchase`)
- **Status:** `[x]` **SELESAI**
- **File:** `src-tauri/src/local_db.rs`, `src/stores/purchaseStore.ts`
- **Gejala:** Ketika nota kulakan diedit dan disimpan ulang, jumlah barang baru ditambahkan langsung ke stok tanpa mengurangi kuantitas lama dari nota sebelumnya, menyebabkan stok berlipat ganda.
- **Perbaikan (selesai):** Membaca item lama dari nota sebelumnya di DB/store dan mengurangkannya dari stok produk sebelum mengaplikasikan item baru.

### BUG-021: Head-of-Line Blocking antrean sinkronisasi outbox lokal
- **Status:** `[x]` **SELESAI**
- **File:** `src-tauri/src/local_db.rs`, `src-tauri/src/sync.rs`
- **Gejala:** Outbox memproses item dengan urutan `ORDER BY id ASC`. Kegagalan pada satu item (data tidak valid / constraint error) menyebabkan antrean macet permanen (*infinite retry loop*).
- **Perbaikan (selesai):** Status dialihkan ke `FAILED` setelah 5x gagal beruntun agar outbox tetap memproses antrean berikutnya. Ditambahkan mekanisme pemulihan `retry_failed_outbox` yang otomatis aktif saat tombol *Sinkronkan Manual* ditekan.

### BUG-022: Inkonsistensi soft-delete produk di SQLite lokal
- **Status:** `[x]` **SELESAI**
- **File:** `src-tauri/src/local_db.rs`
- **Gejala:** Postgres menggunakan soft-delete (`stock = 0`, nama berawalan `[DIHAPUS]`) bila produk pernah memiliki riwayat transaksi, sedangkan SQLite langsung menghapus baris produk sehingga integritas relasi lokal berpotensi rusak.
- **Perbaikan (selesai):** `local_delete_product` diselaraskan untuk mengecek riwayat transaksi dan menerapkan soft-delete identik dengan Postgres.

### BUG-023: Layout cetak struk rusak di media print
- **Status:** `[x]` **SELESAI**
- **File:** `src/components/pos/ReceiptModal.vue`
- **Gejala:** Aturan CSS `@media print { #printableReceipt * { display: block !important; } }` merusak semua layout berbasis flexbox (kolom nama item, harga, dan subtotal yang seharusnya sejajar berubah menjadi bertumpuk vertikal).
- **Perbaikan (selesai):** Menghapus penimpaan `display: block` global pada anak elemen struk dan menambahkan pembersihan `onafterprint`.

### BUG-024: Shortcut Enter & event listener modal kasir
- **Status:** `[x]` **SELESAI**
- **File:** `PosPaymentModal.vue`, `LedgerStatusModal.vue`, `TotalAdjustModal.vue`, `ItemPriceAdjustModal.vue`, `local_db.rs`
- **Gejala:** Kasir harus mengklik mouse untuk menyelesaikan pembayaran atau konfirmasi; modal nego tidak merespons tombol `Escape` di luar input; `usage_count` kupon diskon belum dihitung di transaksi lokal.
- **Perbaikan (selesai):** Shortcut `Enter` ditambahkan pada form pembayaran dan ledger modal; event listener keyboard `keydown` dipasang pada modal penyesuaian harga; `usage_count` diskon diperbarui otomatis saat transaksi dibuat/dihapus di SQLite.

---

## Ringkasan

| Status | Jumlah | ID |
| ----- | ----- | ----- |
| 🔴 Kritis | 5 | BUG-001 ✅, BUG-002 ✅, BUG-003 ✅, BUG-020 ✅, BUG-021 ✅ |
| 🟠 Mayor | 7 | BUG-004 ✅, BUG-005 ✅, BUG-006 ✅, BUG-007 ✅, BUG-008 ✅, BUG-022 ✅, BUG-023 ✅ |
| 🟡 Minor | 12 | BUG-009 ✅, BUG-010 ✅, BUG-011 ✅, BUG-012 ✅, BUG-013 ✅, BUG-014 ✅, BUG-015 ✅, BUG-016 ✅, BUG-017 ✅, BUG-018 ✅, BUG-019 ✅, BUG-024 ✅ |
| **Total** | **24 ✅ · 0 ⏸️ (Semua Selesai)** | (24 dari 24 bug terselesaikan) |

Semua bug yang tercatat dari audit PRD, pengujian menyeluruh, dan verifikasi relasional telah **100% diperbaiki dan diuji lolos secara menyeluruh**.

> Dokumen ini melengkapi `prd_sistem_kasir_distribusi_sppg.md` (Section 7) dan harus diperbarui bersamaan setiap kali satu item diselesaikan.
