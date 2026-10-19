# Product Requirements Document (PRD) Final v2.1: Sistem Kasir (POS) & Distribusi Hibrida (B2B Grosir & B2C Eceran)

**Status Dokumen:** Final v2.2 (Revisi Model Bisnis: Hibrida B2B Grosir / Suplai Institusi & B2C Eceran / Walk-in Retail, dengan Aturan Markup Dinamis, Dual Pricing, Input Harga Saat Nota Supplier Datang, Nota Per Transaksi, & Pembayaran Dinamis — ditambah Audit Gap Implementasi, lihat Section 7)

**Dokumen Referensi Sumber Data Klien:**

* **Buku Pencatatan Keuangan & Stok Manual:** AGST SEP OKT DATA PEMBELIAN DAN PENJUALAN APD DAN SABUN CUCI (36 Sheet SKU, periode Agustus–Oktober 2026)
* **Dokumen Operasional Pemesanan:** 4 Lembar Rekap Pesanan Harian Supplier (Periode 12 s/d 16 Oktober 2026 untuk Dapur SPPG & Konsumen)

## 1. Bedah Model Bisnis Klien (As-Is Business Model Analysis)

Berdasarkan audit komprehensif, usaha klien menjalankan **Model Bisnis Hibrida (Dual Market Engine)** yang melayani dua segmen pasar utama secara simultan:

1. **B2B (Business-to-Business / Grosir & Pengadaan Institusi):**
   * Berperan sebagai **Agregator Pengadaan & Distributor Suplai Utama** untuk jaringan **Dapur SPPG (Satuan Pelayanan Pemenuhan Gizi)**, unit katering, restoran, dan reseller/toko mitra.
   * Karakteristik transaksi: Pembelian volume besar (kartonan, bal, puluhan box, ratusan kg), pesanan terjadwal (Pre-Order harian/mingguan), sistem pembayaran fleksibel (Tunai, Transfer, maupun **Tempo / Piutang Tagihan Rekap**), serta faktur resmi pengiriman.

2. **B2C (Business-to-Consumer / Eceran & Walk-in Retail):**
   * Melayani **konsumen akhir (pembeli perorangan / walk-in customer / eceran)** yang membeli langsung di toko/gudang untuk kebutuhan sehari-hari (sabun, detergen cuci, APD eceran, sembako, bumbu masak satuan/pcs).
   * Karakteristik transaksi: Pembelian satuan / pcs / renceng, transaksi cepat di kasir (*fast checkout*), langsung lunas seketika (*instant settlement* via Tunai atau QRIS/Transfer), dan menggunakan struk kasir belanja langsung.

### 1.1. Ekosistem & Entitas Bisnis

Bisnis klien berada di titik temu strategis yang menghubungkan rantai pasok hulu dengan dua kanal hilir:

| Entitas | Tipe Pasar | Peran dalam Model Bisnis | Karakteristik Operasional |
| ----- | ----- | ----- | ----- |
| **Unit Dapur SPPG & Institusi** | **B2B (Grosir)** | Pelanggan korporat/rutin (Dapur Banjarsari, Pahlawan, Mangunharjo, katering mitra). | Volume besar, Pre-Order harian, harga grosir/markup B2B khusus, fasilitas pembayaran tempo. |
| **Konsumen Umum / Walk-in** | **B2C (Eceran)** | Pembeli perorangan/eceran yang datang langsung ke toko fisik. | Pembelian per pcs/satuan, harga retail/eceran, wajib lunas tunai/QRIS, struk kasir ringkas. |
| **Supplier Bahan Pangan (Hulu)** | Hulu Pasar | 7 vendor spesialis bahan basah & kering harian. | Hari Barokah, Sayur Tufel, Haff Pro Jaya, Pantry Co, Koko Didid, Fadhil Food, Pak Agus. |
| **Supplier Non-Pangan (Hulu)** | Hulu Pasar | Vendor pabrikan APD dapur, kimia sabun cuci, & ATK. | Suplai kartonan/jeriken/dus (Latex, Masker, Soklin, Sunlight 5L, Spons, dll.). | 

### 1.2. Siklus Operasional Nyata di Lapangan (Real-World Workflow)

Dari hasil konfirmasi alur lapangan, siklus transaksi klien berjalan dalam **2 Tahap Utama**:

1. **Tahap 1 — Rekap Pesanan Dapur (Hanya Kuantitas, Tanpa Harga):**
   Dapur SPPG (**Banjarsari, Pahlawan, Mangunharjo**) menyetorkan daftar kebutuhan barang harian (seperti pada 4 foto *Rekap Pesanan Supplier 12–16 Oktober*). Pada tahap ini baru diketahui **Nama Barang, Dapur Tujuan, Tanggal, dan Kuantitas/Satuan**, sedangkan **Harga Beli belum diketahui** karena mengikuti harga pasar/nota supplier saat pengiriman.

2. **Tahap 2 — Barang Datang Bersama Nota Supplier (Penentuan Harga Beli & Markup Dinamis):**
   Saat barang tiba dari supplier disertai **Nota Fisik Supplier**, barulah admin mengetahui **Harga Beli Aktual** hari itu. Admin memasukkan Harga Beli dari nota supplier ke sistem kasir, lalu sistem otomatis menghitung **Harga Jual ke SPPG** menggunakan **Pengaturan Markup Dinamis** (misalnya default `+25%`, atau persentase/nominal custom), dan langsung mencetak **Nota Per Transaksi** untuk penagihan ke Dapur SPPG.

## 2. Masalah Kritis pada Pencatatan Manual Saat Ini (Pain Points)

1. **Satu Barang Satu Tab Sheet (Tidak Scalable):**
   Di Spreadsheet Klien, setiap 1 jenis barang dibuatkan 1 tab sheet sendiri (34 tab APD/Sabun/ATK + 2 tab bumbu `TEPUNG JEMPOL` dan `SAORI PANDA` = **36 tab**). Jika 110+ item bahan baku dari 9 rekap supplier dimasukkan dengan cara yang sama, file spreadsheet akan membengkak menjadi **150+ tab** yang sangat lambat dan sulit dicari.

2. **Kerja Dua Kali (*Double Entry*) Saat Nota Supplier Datang:**
   Admin sudah mengetik daftar pesanan 5 hari per dapur di tabel *Rekap Pesanan Supplier*, namun ketika barang dan nota supplier datang, admin harus mengetik ulang nama barang dan jumlahnya satu per satu ke dalam Google Sheet untuk menghitung harga jual dan margin.

3. **Penggabungan Pesanan Dapur secara Manual di Dalam Rumus Sel:**
   Pada sheet `SARUNG TANGAN LATEX` baris 5 (`D5`), tertulis rumus `=33+35` (total 68 box) dan baris 6 (`D6`) tertulis `=17+15` (total 32 box), sementara kolom `SPPG` kosong. Admin terpaksa menjumlahkan pesanan beberapa dapur di dalam rumus sel karena tidak ada sistem kasir per transaksi yang praktis.

4. **Human Error pada Rumus Excel Manual:**
   * Pada sheet `ISOLASI` baris 6 dan 7 (pembelian 180 pcs @ Rp1.638), kolom `TOTAL BELI` (`F6` dan `F7`) salah mengacu ke rumus `=F5` (Rp58.968 milik 36 pcs), padahal seharusnya Rp294.840.
   * Pada hampir semua sheet, kolom `LABA` (`M`) hanya menghitung `Harga Jual Satuan - Harga Beli Satuan` (`=K5-L5`), belum dikalikan dengan `JUMLAH` barang, sehingga klien tidak mengetahui total laba bersih rupiah secara instan.

## 3. Keputusan Arsitektur Bisnis Final (Locked Business Rules)

Berdasarkan konfirmasi kebutuhan operasional hibrida B2B & B2C, berikut adalah **5 Aturan Bisnis Utama** yang dikunci ke dalam desain sistem:

| No | Area Aturan Bisnis | Spesifikasi Sistem yang Dikunci (Locked Requirement) | 
| ----- | ----- | ----- | 
| **1** | **Mode Transaksi Hibrida (B2B Grosir vs B2C Eceran)** | Kasir memiliki **Mode Switcher 1-Klik** di keranjang:  • **Mode B2B (Grosir / Distribusi):** Ditujukan untuk Dapur SPPG, katering, atau reseller. Mendukung kuantitas besar, pemilahan buyer instansi, syarat pembayaran Tempo / Piutang, dan pencetakan Faktur/Invoice resmi.  • **Mode B2C (Eceran / Retail):** Ditujukan untuk pembeli perorangan/walk-in. Otomatis menetapkan pembeli sebagai `Pelanggan Umum (Eceran)`, default bayar `Lunas (Tunai/QRIS)`, dan mencetak Struk Kasir Retail cepat. |
| **2** | **Pengaturan Markup Dinamis (*Dynamic Markup Engine*)** | Markup **tidak dikunci mati**, melainkan dinamis di 3 level:  1\. **Global/Transaksi:** Kasir bisa memilih preset cepat (`0%`, `+10%`, `+15%`, `+20%`, `+25%`, `+30%`) atau **mengetik angka `%` bebas** (misal `12.5%` grosir atau `35%` eceran).  2\. **Per Kategori/Supplier:** Setiap supplier/kategori bisa diset default markup-nya masing-masing.  3\. **Per Baris Barang (Override):** Kasir bisa mengubah `% Markup` atau langsung mengetik `Harga Jual Tetap (Rp)` per barang di keranjang. | 
| **3** | **Input Harga Beli Saat Nota Supplier Datang (*Arrival Costing Flow*)** | Karena harga beli bahan pangan/komoditas baru diketahui saat barang datang bersama nota dari supplier, **setiap baris item di keranjang kasir memiliki kotak input langsung (`Inline Input`) untuk `Harga Beli Nota`** dan `Qty Aktual`. Begitu kasir mengetik angka `Harga Beli`, harga jual dan laba otomatis terhitung saat itu juga. | 
| **4** | **Cetak Struk & Faktur Dinamis (Invoice B2B vs Struk Kasir B2C)** | Format output dokumen menyesuaikan mode transaksi:  • **B2B:** Format Faktur / Invoice Penjualan Resmi dengan rincian Dapur/Institusi pemesan, PIC, status tempo/lunas, dan tanda terima pengiriman.  • **B2C:** Format Struk Kasir Ritel Ringkas (cocok untuk printer thermal atau struk belanja harian konsumen). | 
| **5** | **Metode & Status Pembayaran Dinamis (*Flexible Settlement*)** | Panel checkout kasir menyediakan pilihan dinamis:  • **Status Bayar:** `Lunas` vs `Tempo / Belum Lunas (Piutang)`  • **Metode Bayar:** `Transfer Bank`, `Tunai / Kas`, `QRIS`, atau `Nota Tempo SPPG`  Di Buku Besar, transaksi dapat difilter berdasarkan segmen: `Semua`, `B2B (Grosir)`, atau `B2C (Eceran)`. | 

## 4. Prinsip UX: "Zero-Form Enterprise Desktop POS"

Agar aplikasi terasa **compact, cepat, dan tidak ribet (minim form input)** layaknya aplikasi kasir desktop enterprise:

1. **Dual Mode Toggle (🏢 B2B Grosir ↔ 🛒 B2C Eceran):**
   Tombol toggle cepat di header keranjang. Ketika kasir berganti ke `B2C Eceran`, sistem otomatis mengarahkan ke pelanggan umum dan metode bayar tunai tanpa memerlukan pengisian nama instansi.

2. **Inline Editing di Keranjang Kasir (Tanpa Buka-Tutup Modal Form):**
   Kasir dapat **langsung mengetik `Qty`, `Harga Beli`, dan `Harga Jual` di baris keranjang** (pindah baris menggunakan tombol `Tab` / `Enter`).

3. **1-Click Pill Selector Tujuan Buyer:**
   Tombol pilih cepat buyer: `[Pelanggan Umum (Eceran)]`, `[Banjarsari]`, `[Pahlawan]`, `[Mangunharjo]`, serta buyer kustom lainnya.

4. **1-Click Pull dari Jadwal Rekap Supplier:**
   Daftar pesanan harian dapur dari jadwal Pre-Order dapat ditarik ke keranjang kasir dengan **1 klik** saat nota fisik kurir tiba.

5. **Quick Multiplier Chips (`+1`, `+5`, `+10`, `+25`, `+50`):**
   Memudahkan input barang satuan eceran maupun puluhan/ratusan grosir.

## 5. Spesifikasi Modul & Fitur Utama (Functional Requirements)

### Modul 1: Layar Utama Kasir & Input Nota Kedatangan (POS Workspace)

* **Panel Kiri (60% Lebar Layar) — Katalog & Filter Cepat 9 Supplier:**
  * Pencarian instan (`/`) berdasarkan nama barang, kode, atau satuan.
  * Filter 1-klik per kategori/supplier (`Semua`, `APD & Sabun`, `ATK & Kertas`, `Hari Barokah`, `Sayur Tufel`, `Haff Pro`, `Pantry Co`, `Koko Didid`, `Fadhil Food`, `Pak Agus`).
  * Toggle tampilan **Icon View** dan **Compact List View**.

* **Panel Kanan (40% Lebar Layar) — Keranjang Pintar Hibrida (B2B/B2C):**
  * **Baris Mode Switcher:** Toggle `🏢 B2B (Grosir)` vs `🛒 B2C (Eceran)`.
  * **Baris Kontrol Buyer & Tanggal:** Pilih Buyer/Pelanggan (Eceran Umum / Dapur SPPG / Mitra) dan Tanggal Transaksi.
  * **Baris Kontrol Markup Dinamis:** Preset tombol (`0%`, `+15%`, `+20%`, `+25%`, `+30%`) + Kotak Input `% Markup Custom`.
  * **Tabel Keranjang Inline (Zero-Modal):** Kolom input langsung untuk `Qty`, `Harga Beli (Nota)`, `% Markup`, dan `Harga Jual`.
  * **Baris Status Pembayaran Dinamis:** Pilihan `Lunas (Tunai/TF/QRIS)` atau `Tempo (Piutang)`.
  * **Footer Ringkasan Real-Time:** Menampilkan Total Modal Beli, Total Tagihan Jual, Total Laba Bersih, dan tombol cetak struk/nota (`F12`).

### Modul 2: Matriks Rekap Pesanan Supplier Mingguan (Pre-Order B2B)

* Menampilkan jadwal pesanan harian untuk unit dapur B2B.
* Tombol **`+ Masukkan ke Kasir (Input Harga Nota)`** memindahkan seluruh pesanan ke keranjang kasir dalam hitungan detik.

### Modul 3: Buku Besar Transaksi, Piutang Dinamis & Filter Segmen Pasar

* Menggabungkan seluruh transaksi ke dalam satu tabel Buku Kas terpadu.
* **Filter Segmen Pasar:** Memfilter riwayat transaksi berdasarkan `Semua`, `B2B (Grosir)`, dan `B2C (Eceran)`.
* **1-Click Pelunasan Tempo:** Mengubah piutang menjadi `LUNAS` saat pembayaran tagihan diterima.
* **Export CSV/Excel:** Mengunduh pembukuan dengan rincian laba kotor, laba bersih, dan tipe transaksi.

### Modul 4: Master Barang, Vendor, Pelanggan & Identitas Toko (White-Label)

* Mengelola data barang, vendor & margin %, pelanggan B2B dan B2C, serta profil identitas toko (nama toko, alamat, invoice prefix).

## 6. Alur Kerja End-to-End Pengguna di Aplikasi (User Journey)

1. **Skenario A — Transaksi B2C (Eceran / Walk-in Customer):**
   * Pembeli umum datang membeli 2 pcs Sabun Cuci Tangan dan 1 box Masker.
   * Kasir memilih mode **`🛒 B2C (Eceran)`** (otomatis terpilih pelanggan `Umum`).
   * Kasir klik barang di katalog kiri atau scan barcode/ketik nama.
   * Kasir memilih metode bayar `Tunai / Kas` atau `QRIS` → tekan **`F12`**. Struk kasir belanja eceran langsung keluar.

2. **Skenario B — Transaksi B2B (Barang Supplier Datang untuk Dapur SPPG / Grosir):**
   * Kurir Supplier sayur/lauk datang membawa barang pesanan Dapur Pahlawan beserta nota fisik.
   * Admin memilih mode **`🏢 B2B (Grosir)`**, klik **`⚡ Muat Pesanan Harian Dapur`** (Pahlawan).
   * Daftar pesanan langsung terisi di keranjang.
   * Admin mengisi/menyesuaikan `Harga Beli` dari nota supplier.
   * Admin memilih status pembayaran (`Tempo / Piutang`), lalu tekan **`F12`** untuk mencetak Faktur Pengiriman & Penagihan B2B.

3. **Skenario C — Penjualan Grosir ke Reseller / Katering Mitra:**
   * Katering mitra memesan 10 Jeriken Sunlight 5L dan 50 pack Sarung Tangan.
   * Admin memilih mode **`🏢 B2B (Grosir)`**, memilih nama Buyer mitra, memberikan markup grosir (misal `+12%`), dan menerbitkan nota faktur transaksi.

---

## 7. Catatan Audit Implementasi (Gap Analysis vs Kode Aktual)

**Status:** Ditambahkan pada v2.2 — hasil audit fitur (tanggal audit: 19 Oktober 2026) membandingkan requirement dokumen ini dengan implementasi aktual (Tauri 2 + Vue 3 + Pinia + Rust/PostgreSQL). Semua referensi file:line mengikuti struktur repo Kasir-Citra.

### 7.1. Fitur Sudah Lengkap

| Fitur PRD | Bukti Implementasi |
| ----- | ----- |
| Aturan #1 Mode Switcher B2B/B2C 1-klik + hotkey (Alt+G/E, Alt+1..9), auto-set buyer & metode bayar B2C | `src/components/pos/PosCart.vue:136-219`; `src/stores/posStore.ts:63-76` |
| Panel kiri: katalog, filter kategori/supplier 1-klik, Icon/List view, multiplier chips `+1/+5/+10/+25/+50` | `src/components/pos/ProductCatalog.vue:40-58,144-151,240-253` |
| Pilih buyer (combobox + auto-create cepat) & tanggal transaksi | `PosCart.vue:244-258,328-333,565-572` |
| Aturan #5 status Lunas/Tempo + metode (Transfer/Tunai/QRIS/Nota Tempo) | `src/components/pos/PosPaymentModal.vue:27-32,118-159` |
| Footer ringkasan real-time (Modal, Tagihan, Laba %) | `PosCart.vue:469-521`; `posStore.ts:240-241,305-310` |
| Regulasi stok otomatis + validasi stok saat checkout (transaksional) | `src-tauri/src/commands/transactions.rs:117-134` |
| Modul 2: matriks Pre-Order + 1-klik pull ke kasir | `src/components/preorder/PreOrderMatrix.vue:195-198,381-390`; `src-tauri/src/commands/preorders.rs` |
| Modul 3: buku besar terpadu, 1-klik pelunasan piutang (toggle LUNAS↔TEMPO), metrik piutang, filter status/buyer | `src/components/ledger/LedgerView.vue:138-142,265-356,475-485`; `src/stores/ledgerStore.ts:37-74`; `transactions.rs:140-151` |
| Aturan #2 level 2: markup per kategori/supplier (CRUD lengkap) | `src/stores/inventoryStore.ts:55-104`; `src-tauri/src/commands/markups.rs:29-76`; `MasterVendorTab.vue:120-154` |
| Arrival costing via modul Kulakan: harga beli nota inline + markup auto + riwayat/edit nota (balik stok) | `src/components/receiving/ReceivingFormDrawer.vue:235-247,314-323`; `src/stores/purchaseStore.ts:83-108`; `src-tauri/src/commands/purchases.rs:18-86` |
| Modul 4: master barang, vendor & margin, pelanggan B2B/B2C, identitas toko white-label + invoice prefix | `MasterProducts.vue:115-140`; `MasterBuyerTab.vue:175-203`; `MasterBrandingTab.vue:96-102` |
| Struk dinamis B2B (faktur) vs B2C (struk retail), header & salam berbeda + salin teks WhatsApp | `src/components/pos/ReceiptModal.vue:26-75,114-121` |

### 7.2. Gap Kritis (Belum Sesuai Locked Requirement)

#### GAP-1: Keranjang kasir TANPA inline Harga Beli (Nota), % Markup, & override Harga Jual — melanggar Aturan #2 (level 3), Aturan #3, dan Modul 1

- Baris item keranjang hanya punya input Qty (`PosCart.vue:381-392`); input `buyPrice|markupPercent` di `src/components/pos/*` = 0 hasil.
- **Baris Kontrol Markup Dinamis** (preset `0/+15/+20/+25/+30%` + `%` custom — PRD baris 101) tidak ada di PosCart.
- Dead-code: `posStore.setManualDiscount` (`posStore.ts:189`) & `posStore.updateItemSellPrice` (`posStore.ts:132`) lengkap tapi tak pernah dipanggil UI.
- Konsekuensi: Skenario B (baris 134, isi harga nota di keranjang) tidak bisa jalan; alur aktual dipaksa lewat tab Kulakan lalu memakai `lastSellPrice` (`posStore.ts:96-98`).
- **Aksi:** tambahkan column input inline `Harga Beli`, `% Markup`, `Harga Jual` + baris kontrol preset markup; wire `setManualDiscount` & `updateItemSellPrice`.

#### GAP-2: Cetak struk/faktur (F12) tidak benar-benar mencetak — melanggar Aturan #4

- "Cetak" hanya `window.print()` (`ReceiptModal.vue:87-89`); **tanpa CSS `@media print`/`@page` sama sekali** di `src/assets/main.css` → mencetak seluruh jendela, bukan struk.
- Backend `generate_receipt_text` (`src-tauri/src/commands/system.rs:14-24`, terdaftar `lib.rs:20`) tidak pernah di-invoke frontend; isinya hanya 4 field hardcoded tanpa rincian item. Tidak ada dukungan printer thermal.
- **Aksi:** buat CSS print layout struk + wiring `generate_receipt_text`; pertimbangkan ESC/POS thermal.

#### GAP-3: Faktur B2B belum punya PIC & tanda terima pengiriman — melanggar Aturan #4

- Meta struk hanya invoiceNo/tanggal/pembeli/status (`ReceiptModal.vue:125-145`).
- **Aksi:** tambah field PIC pemesan, petugas pengirir, area tanda terima/ttd.

#### GAP-4: Export & filter segmen B2B/B2C setengah jadi — melanggar Modul 3 (baris 114-116)

- Export Excel tidak mengikuti filter segmen, tanpa kolom Tipe Transaksi (B2B/B2C); `filteredFlatRows` (`LedgerView.vue:149-162`) tidak memfilter `filterMarket` → view "Rincian Barang" menampilkan semua segmen walau difilter.
- Export pakai `XLSX.writeFile` browser (`ledgerStore.ts:120-143`) padahal backend `save_export_file` (`system.rs:5-10`, `lib.rs:19`) tak pernah dipakai → unduhan bisa gagal diam-diam di Tauri WebView. Tidak ada opsi CSV.
- **Aksi:** terapkan `filterMarket` di `filteredFlatRows`, tambah kolom tipe transaksi, routing file via `save_export_file`, tambah opsi CSV.

#### GAP-5: Flag & counter deklaratif tidak pernah ditulis ke data

| Item | Masalah | Bukti |
| ----- | ----- | ----- |
| `is_loaded_to_pos` Pre-Order | Tak pernah di-set → PO bisa ditarik kasir berkali-kali | `db/schema.sql:31`; `PreOrderMatrix.vue:195-198`; `posStore.ts:200-237` |
| `usage_count` kupon | Tak ada kode increment → statistik "X Kali" selalu 0 | `db/schema.sql:94`; `MasterDiscountTab.vue:55,634`; `posStore.ts:321-374`; `transactions.rs:51-136` |
| `isPreOrder` transaksi | Checkbox ada, tapi model Rust/DB tak punya kolom → flag hilang saat reload; ReceiptModal menebak via regex | `types/index.ts:100`; `models.rs:66-102`; `schema.sql:35-56`; `ReceiptModal.vue:20-24` |
| Loyalty program | Simpan hanya localStorage, tanpa tabel/command DB → aturan poin hilang antar perangkat | `src/stores/buyerStore.ts:205-208` |

- **Aksi:** tambah kolom `is_pre_order` di `transaction_records`, increment `usage_count` saat checkout kupon, set `is_loaded_to_pos` saat pull ke kasir, buat tabel + command loyalty settings.

#### GAP-6: Hapus data tidak sinkron ke DB

- `deleteProduct` (`inventoryStore.ts:161-164`) hanya lokal — tak ada command `db_delete_product` (cek `lib.rs:25-27`) → produk "dihapus" muncul lagi setelah `fetchFromDb`.
- `deleteCategory` berisiko FK error (`products.category` FK tanpa ON DELETE, `db/schema.sql:14`) dan error hanya `console.error` (`inventoryStore.ts:100-102`).
- **Aksi:** buat `db_delete_product`, paksa cek relasi sebelum hapus kategori, tampilkan error ke UI.

#### GAP-7: Barcode scan barang di kasir belum ada — melanggar Skenario A (baris 128)

- `Product` tak punya field barcode (`types/index.ts:57-68`); `ProductCatalog.vue` tidak menangani input scanner fisik. Scan hanya untuk kartu member (webcam QR). PR tombol "barcode" (`FileExplorerLayout.vue:117`) mengklaim tersedia — menyesatkan.
- **Aksi:** tambah field `barcode` di master barang + handler scanner HID di katalog; ubah klaim UI agar sesuai realita.

### 7.3. Bug Berisiko (Hardening Wajib)

1. **Kolisi nomor invoice bisa memuntahkan transaksi diam-diam:** suffix random 4-digit (`posStore.ts:312-317`) vs `invoice_no UNIQUE` (`schema.sql:37`); `db_create_transaction` pakai `ON CONFLICT DO NOTHING` lalu return sukses (`transactions.rs:76,102`) → transaksi "sukses" di UI tapi tak tersimpan & stok tak terpotong. Aksi: nomor invoice deterministik dari sequence/counter DB, dan perbaiki return path agar tak menyetujui transaksi gagal.
2. **Hapus transaksi tidak membalikkan stok/poin** (`LedgerView.vue:216`; `transactions.rs:153-158`). Aksi: reverse stok + poin saat delete.
3. **Badge status DB palsu:** "PostgreSQL Aktif (5434)" hijau statis (`AppTitleBar.vue:94-100`), tak memakai `isConnectedToPg` yang tersedia (`inventoryStore.ts:44,48`).
4. **Dual sumber kebenaran localStorage vs DB:** semua store menulis lokal dulu dan menelan error DB (`buyerStore.ts:149-153`; `discountStore.ts:179-183`; `preOrderStore.ts:17-28`; `inventoryStore.ts:66-70`) → data terlihat ada di UI walau gagal tersimpan. Aksi: tampilkan feedback error DB ke UI, jadikan DB sumber utama.
5. **Dead-code backend & frontend:** `generate_receipt_text`, `save_export_file`, `setManualDiscount`, `updateItemSellPrice` (posStore), `addPointsAndSpend`/`deductPoints` (`buyerStore.ts:174-203`), `setPaymentStatus` (`ledgerStore.ts:52-58`) — wire ke UI atau hapus.

### 7.4. Fitur di Kode yang TIDAK Ada di PRD (Bonus Terdokumentasi, jadikan bagian resmi scope)

- **Program member & poin loyalitas:** kartu member, tier REGULAR/SILVER/GOLD/PLATINUM, diskon otomatis per tier (`posStore.ts:244-252`), tukar poin, scan kartu via QR webcam + scanner USB (`MemberScanModal.vue`), modul Member lengkap.
- **Voucher/kupon promo:** scope `ALL/CATEGORY/CUSTOMER_TYPE/MEMBER_ONLY`, min belanja, max diskon, simulator (`src/components/master/discount/*`).
- **Modul Kulakan/Penerimaan Barang:** riwayat nota, edit nota dengan rebalancing stok (advisory lock), import historis (`src-tauri/src/commands/purchases.rs`; `SupplierReceiving.vue`).
- **Mesin tema/white-label:** preset warna, tema latar, aksen header (`settingsStore.ts:75-103`; `src/utils/theme.ts`).

### 7.5. Roadmap Prioritas Pelengkapan

| Prioritas | Item | Gap Terkait |
| ----- | ----- | ----- |
| **P1** | Inline `Harga Beli`/`% Markup`/`Harga Jual` + baris kontrol markup di keranjang | GAP-1 |
| **P1** | CSS print struk + wiring cetak backend | GAP-2 |
| **P2** | PIC & tanda terima di faktur B2B | GAP-3 |
| **P2** | Perbaikan export & filter segmen | GAP-4 |
| **P2** | Sinkronisasi flag (`is_pre_order`, `usage_count`, `is_loaded_to_pos`, loyalty DB) | GAP-5 |
| **P3** | Hapus produk/kategori sinkron DB | GAP-6 |
| **P3** | Barcode scan barang + field barcode master | GAP-7 |
| **P3** | Hardening: invoice deterministik, reverse stok saat delete, badge DB asli, error DB ke UI | Bug 7.3 |

> **Progress Log (19 Okt 2026):** Status perbaikan didokumentasikan di `BUG.md` (19 item). **Semua GAP kritis & mayor telah tertutup dan diverifikasi** (`bun test` 6 pass, `cargo test --lib` 3 pass, `vue-tsc` & `cargo check` bersih): GAP-1 (inline `Beli / % Markup / Jual` + baris kontrol markup dinamis via `updateItemBuyPrice`/`updateItemMarkup`/`applyTransactionMarkup`), GAP-2 (CSS print + **generator struk thermal 32 kolom di Rust** dengan preview/salin/simpan), GAP-3 (**kolom `pic_name` + input PIC di modal bayar B2B + blok tanda terima pengiriman pada faktur cetak & thermal**), GAP-4, GAP-5, GAP-6, **GAP-7** (fitur barcode: kolom `products.barcode` + migrasi otomatis `db/migrations.sql` via `ensure_migrations()` di `lib.rs`, field master, scanner engine di katalog & pencarian kasir), dan bug 7.3. **Sisa (by design):** normalisasi JSONB `PurchaseReceipt` (opsional, tunggu kebutuhan laporan SQL). Seluruh perbaikan telah di-commit ke branch `main` (lihat `BUG.md` untuk detail tracker).