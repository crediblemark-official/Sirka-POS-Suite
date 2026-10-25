# 🛒 Sirka

**Sistem Kasir (POS) & Distribusi Hibrida (B2B Grosir SPPG & B2C Eceran)**

Sirka adalah sistem kasir point-of-sale dan manajemen distribusi terintegrasi yang dibangun untuk operasional bisnis hibrida (*Dual Market Engine*):
1. **B2B (Grosir & Distribusi Institusi):** Agregator pengadaan Dapur SPPG (*Satuan Pelayanan Pemenuhan Gizi*), katering, dan mitra toko (Pre-Order terjadwal, penerimaan nota supplier harian, kalkulasi markup dinamis, dan pencatatan piutang tempo).
2. **B2C (Eceran & Walk-in Retail):** Kasir cepat (*fast checkout*), scan barcode, manajemen shift & kas laci, program poin member, kupon promo bertingkat, split payment, dan cetak struk thermal ESC/POS 80mm/58mm.

---

## 🏗️ Arsitektur Sistem

Aplikasi ini menggunakan pendekatan **Local-First (Offline-First)** untuk memastikan kasir di toko fisik tetap beroperasi 100% lancar walau jaringan internet mati:

```
[ Frontend: Vue 3 + Tailwind v4 ]
         │ (Tauri IPC Invoke)
         ▼
[ Desktop Runtime: Tauri v2 (Rust) ]
   ├── SQLite Lokal (sirka.db, WAL Mode) ──► Transaksi & Operasi Instan
   └── Outbox Queue Sync Engine
         │ (tokio-postgres + rustls TLS)
         ▼
[ Cloud: PostgreSQL 16 / PgBouncer ]
         ▲
         │ (Stateless HTTPS REST API)
[ Cloudflare Worker (worker/) — Hono ]
         ▲
         │ (Bearer Token Auth)
[ Mobile App (mobile/) — Android Owner Monitoring ]
```

- **SQLite Lokal (`src-tauri/src/local_db.rs`):** Seluruh aksi kasir, stok, dan pencatatan berjalan langsung ke database SQLite lokal dengan mode WAL (*Write-Ahead Logging*) dan jaminan integritas *Foreign Keys*.
- **Outbox Sync Engine (`src-tauri/src/sync.rs`):** Mutasi data saat offline diantrekan dalam tabel `outbox`. Saat koneksi cloud tersedia, worker Rust secara otomatis menyinkronkan data ke PostgreSQL tanpa memblokir antarmuka pengguna (*non-blocking*). Dilengkapi isolasi kegagalan (*parking outbox*) agar tidak terjadi *Head-of-Line Blocking*.
- **TLS Terisolasi (`src-tauri/src/tls.rs`):** Koneksi PostgreSQL menggunakan `rustls` murni Rust (tanpa ketergantungan library C OpenSSL eksternal).
- **Backend Serverless (`worker/`):** REST API Cloudflare Workers + Hono untuk melayani pembacaan data eksekutif oleh aplikasi mobile owner secara aman tanpa mengekspos kredensial database langsung ke perangkat HP.
- **Mobile Companion (`mobile/`):** Aplikasi Android khusus owner toko berbasis Tauri Mobile v2 untuk pemantauan omzet, laporan kasir, stok kritis, dan buku kas.

---

## 📦 Modul Aplikasi Desktop

Antarmuka desktop dirancang modular menyerupai File Explorer desktop terintegrasi (`src/components/explorer/FileExplorerLayout.vue`) dengan tab bar dinamis, ribbon/toolbar, dan status bar sinkronisasi:

| Modul | Nama Tab | Komponen Utama | Deskripsi Fungsional |
|---|---|---|---|
| **Dashboard** | `Home` | `HomeInsightView.vue` | Metrik omzet, laba kotor, grafik performa harian, dan ringkasan transaksi. |
| **Kasir** | `Kasir` | `ProductCatalog.vue`, `PosCart.vue` | Checkout ritel cepat, tahan keranjang (*held carts*), penyesuaian diskon baris/total, dan modal pembayaran. |
| **Shift Kasir** | — | `OpenShiftModal.vue`, `CloseShiftModal.vue`, `ShiftSummaryModal.vue` | Manajemen modal awal kasir, pencatatan kas masuk (*cash inflow*), dan rekonsiliasi kas laci saat tutup shift. |
| **Pesanan** | `Pesanan` | `PreOrderMatrix.vue`, `PreOrderFormDrawer.vue` | Matriks rekap PO harian untuk Dapur SPPG, penentuan tanggal kirim, dan loader pesanan langsung ke kasir. |
| **Kulakan** | `Kulakan` | `ProductReceivingDrawer.vue` | Penerimaan barang supplier, penyesuaian harga beli aktual nota fisik, dan update stok delta otomatis. |
| **Inventaris** | `Inventaris` | `MasterProducts.vue`, `MasterSkuTab.vue` | Katalog SKU produk, multi-satuan bertingkat (*baseQty*), penyesuaian opname stok fisik, dan kartu riwayat stok. |
| **Kategori** | `Kategori` | `MasterVendorTab.vue` | Manajemen kategori produk, palet warna visual, dan aturan markup persentase margin per kategori. |
| **Supplier** | `Supplier` | `MasterSupplierTab.vue` | Master data supplier bahan pangan (sayur, lauk, bumbu) dan non-pangan (APD dapur, sabun, detergen). |
| **Pelanggan** | `Pelanggan` | `MasterBuyerTab.vue` | Master pembeli institusi (Dapur SPPG) dan pelanggan umum beserta catatan piutang/tempo. |
| **Diskon & Promo**| `Diskon` | `MasterDiscountTab.vue` | Kupon promosi belanja, simulator diskon, kupon tipe pelanggan, dan batas pemakaian. |
| **Member** | `Member` | `MasterMemberTab.vue` | Program poin loyalitas, tier member, pencetakan/ekspor kartu anggota, dan riwayat perolehan poin. |
| **Buku Kas** | `Buku Kas` | `LedgerView.vue`, `LedgerMutationsTable.vue` | Buku besar penjualan, pelunasan tempo, dan pencatatan mutasi kas masuk/keluar harian (*Cash Mutation*). |
| **Laporan** | `Laporan` | `FinancialReportsView.vue` | Laporan Laba Rugi (PnL), Neraca, Arus Kas, Rekap Shift, Rekonsiliasi QRIS, dan Piutang Belum Lunas. |
| **Retur & Rusak** | — | `RefundModal.vue`, `WasteModal.vue` | Retur penjualan pembeli & pencatatan barang rusak/waste (otomatis mengembalikan stok dan poin transaksi). |
| **Branding Toko** | `Profil` | `MasterBrandingTab.vue`, `PrinterConfigModal.vue` | Konfigurasi profil toko, logo, token akses Cloudflare Worker, dan setelan printer thermal. |

---

## 🛠️ Tech Stack & Dependensi

### Frontend Desktop (`src/`)
- **Framework:** Vue 3 (v3.5, Composition API dengan `<script setup>`)
- **Build Tool:** Vite 8 & TypeScript (~6.0)
- **State Management:** Pinia 4 (15 modul store modular di `src/stores/`)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite` 4.3)
- **Komponen & Utilitas:** Lucide Vue Next, `@vueuse/core`, `xlsx` (ekspor buku besar), `jsbarcode`, `qrcode`, `html5-qrcode`, `html-to-image`

### Backend Desktop Native (`src-tauri/`)
- **Runtime:** Tauri v2 (Rust edisi 2024)
- **Database Lokal:** `rusqlite` 0.32 (SQLite bundled)
- **Database Cloud:** `tokio-postgres` 0.7 dengan driver TLS `tokio-rustls` & `webpki-roots`
- **Asinkron:** `tokio` 1.53, `chrono` 0.4, `uuid` 1.28, `serde` / `serde_json`

### Mobile Companion (`mobile/`)
- **Framework:** Tauri v2 Mobile + Vue 3 + Tailwind CSS v4
- **Keamanan:** ECDSA P-256 Device Key (IndexedDB sandbox) + Enkripsi token AES-GCM (ECDH) + Dukungan Android Biometric Keystore

### Cloud Backend (`worker/`)
- **Platform:** Cloudflare Workers (Wrangler 3)
- **Framework:** Hono 4 + `pg` (PostgreSQL client)
- **Autentikasi:** Constant-time comparison Bearer Token (`OWNER_SECRET_KEY`)

---

## 📁 Struktur Direktori Repository

```text
sirka/
├── src/                          # Frontend Utama Desktop (Vue 3 + TypeScript)
│   ├── assets/                   # main.css (Tailwind CSS v4 entry)
│   ├── components/               # Komponen UI modular
│   │   ├── cash/                 # CashMutationModal, CashPocketCards
│   │   ├── common/               # AppTitleBar, DateRangePicker, Modal, SearchableSelect
│   │   ├── explorer/             # FileExplorerLayout, ExplorerToolbar, TabBar, StatusBar
│   │   ├── home/                 # HomeInsightView (Dashboard bisnis)
│   │   ├── inventory/            # StockAdjustModal, StockCardModal
│   │   ├── ledger/               # LedgerView, LedgerMutationsTable, LedgerTransactionsTable
│   │   ├── master/               # Master tab (Produk, Kategori, Supplier, Buyer, Member, Diskon)
│   │   ├── pos/                  # ProductCatalog, PosCart, PaymentModal, ShiftModals, ReceiptModal
│   │   ├── preorder/             # PreOrderMatrix, PreOrderFormDrawer
│   │   ├── reports/              # FinancialReportsView & subtab PnL, Cashflow, Neraca, Shifts
│   │   ├── returns/              # RefundModal, WasteModal, RefundHistoryTable
│   │   └── settings/             # PrinterConfigModal (Thermal ESC/POS setup)
│   ├── composables/              # useConfirmDialog, useModalLock
│   ├── stores/                   # 15 Pinia store (pos, inventory, ledger, shift, purchase, dll.)
│   ├── types/                    # Definisi tipe TypeScript modular (product, buyer, transaction, dll.)
│   └── utils/                    # Format mata uang, tema visual, export kartu, horizontal scroll
├── src-tauri/                    # Native Core Rust (Tauri v2)
│   ├── src/
│   │   ├── commands/             # Handler RPC Tauri (products, transactions, purchases, system, dll.)
│   │   ├── db.rs                 # Manajemen koneksi PostgreSQL cloud
│   │   ├── lib.rs                # Entrypoint aplikasi desktop & registrasi invoke handler
│   │   ├── local_db.rs           # Engine database SQLite lokal & skema WAL
│   │   ├── models.rs             # Struct model data Rust
│   │   ├── sync.rs               # Outbox background sync engine & retry logic
│   │   └── tls.rs                # Konfigurasi rustls TLS untuk PostgreSQL
│   ├── tests/                    # Backend Rust Test Suite
│   │   ├── local_db_tests.rs     # 17 unit test operasi SQLite & outbox
│   │   ├── system_tests.rs       # 4 unit test cetak struk ESC/POS 80mm
│   │   └── persistence.rs        # Test regresi alur transaksi PostgreSQL
│   └── Cargo.toml                # Dependensi Rust
├── mobile/                       # Aplikasi Android Owner (Tauri Mobile)
│   ├── src/                      # UI monitoring mobile (Vue 3)
│   └── scripts/                  # Script helper Android Keystore
├── worker/                       # Cloudflare Worker API (Hono REST API)
│   ├── src/index.ts              # Endpoint REST API untuk aplikasi mobile
│   └── wrangler.toml             # Konfigurasi Cloudflare Worker
├── db/                           # Skema Database & Migrasi SQL
│   ├── schema.sql                # DDL skema tabel PostgreSQL
│   ├── migrations.sql            # Skema migrasi idempotent
│   ├── purchases.sql             # Skema tabel kulakan & purchase items
│   ├── reports_purchase.sql      # View agregasi laporan kulakan
│   └── seed.ts                   # Script seed data awal via Bun
├── tests/                        # Frontend Test Suite (Bun test)
│   ├── persistence.test.ts       # 32 unit test persistence & kalkulasi bisnis
│   └── deviceKey.test.ts         # 7 unit test kriptografi device key
├── docker-compose.yml            # Layanan container PostgreSQL lokal (port 5434)
├── package.json                  # Script root & dependensi npm
└── .env.example                  # Template konfigurasi variabel lingkungan
```

---

## ⚡ Panduan Instalasi & Menjalankan

### Prasyarat Sistem
1. [Bun](https://bun.sh/) (>= v1.2)
2. [Rust & Cargo](https://www.rust-lang.org/) (stable)
3. Dependensi Linux untuk Tauri v2 (khusus pengguna Linux):
   ```bash
   sudo apt update
   sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
   ```

### 1. Kloning & Instal Dependensi Root
```bash
git clone https://github.com/crediblemark-official/Kasir-POS.git sirka
cd sirka
bun install
```

### 2. Konfigurasi Lingkungan (`.env`)
Salin file template lingkungan:
```bash
cp .env.example .env
```
Isi variabel `DATABASE_URL` pada file `.env`:
```env
# Contoh PostgreSQL lokal Docker:
DATABASE_URL=postgresql://sirka_user:sirka_password@localhost:5434/sirka_db
```

### 3. Menjalankan Database PostgreSQL Lokal (Docker)
Jika ingin menggunakan database lokal:
```bash
docker compose up -d
bun run db:seed
```
*Port PostgreSQL lokal dipetakan ke port `5434` host.*

### 4. Menjalankan Aplikasi Desktop (Tauri Dev)
```bash
# Menjalankan frontend Vite dan jendela native desktop Tauri
bun run tauri dev
```

*Jika hanya ingin menguji tampilan UI di peramban web:*
```bash
bun run dev
```

### 5. Menjalankan Komponen Tambahan (Opsional)

#### Aplikasi Mobile Owner
```bash
bun run mobile:dev
```

#### API Cloudflare Worker
```bash
# Setup kredensial lokal worker
echo 'DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE' > worker/.dev.vars

# Jalankan worker secara lokal di port 8787
bun run worker:dev
```

---

## 🧪 Pengujian (Testing)

Proyek ini memiliki unit test otomatis yang terverifikasi untuk frontend dan backend Rust:

```bash
# 1. Menjalankan seluruh test frontend (39 pass di tests/persistence.test.ts & deviceKey.test.ts)
bun test

# 2. Menjalankan seluruh test backend Rust (21 pass di src-tauri/tests/)
bun run test:rust

# 3. Menjalankan seluruh rangkaian test frontend & Rust sekaligus
bun run test:all

# 4. Validasi type-checking TypeScript & build frontend
bun run build
```

---

## 📦 Build Distribusi Produksi

Untuk menghasilkan binary native desktop installer (AppImage, deb, exe, dll.):

```bash
bun run tauri build
```
Paket hasil build akan dihasilkan di folder `src-tauri/target/release/bundle/`.

---

## 🛡️ Catatan Keamanan

- Kredensial database tidak boleh dikomit ke repository. Gunakan Cloudflare Secret (`bun x wrangler secret put DATABASE_URL`) untuk lingkungan Worker.
- Akses ke endpoint Worker `/api/*` dilindungi token `OWNER_SECRET_KEY` dengan constant-time comparison.
- Kunci perangkat (*Device Key*) pada aplikasi mobile owner menggunakan private key ECDSA P-256 non-extractable di IndexedDB / Android Keystore.
- Lisensi desktop kasir divalidasi dengan tanda tangan digital asimetris Ed25519 dan salted SHA-256 HWID melalui infrastruktur **tertaut.com**.

---

## 🔐 Sistem Lisensi Tertaut (tertaut.com)

Aplikasi ini menggunakan infrastruktur lisensi dari **[tertaut.com](https://tertaut.com)** via official client SDK `@tertaut/sdk`:

- **Kriptografi Asimetris Ed25519**: Verifikasi digital signature secara matematis di sisi klien tanpa memerlukan rahasia server (secret key) pada binary aplikasi.
- **Hardware ID (HWID) Device Locking**: Lisensi terikat pada perangkat fisik menggunakan sidik jari mesin SHA-256 ter-salt untuk mencegah duplikasi atau pembajakan.
- **Offline-First Grace Token**: Mendukung kasir beroperasi penuh saat offline tanpa koneksi internet hingga 30 hari menggunakan token grace Ed25519.
- **Floating Seat Heartbeat**: Mendukung skenario lisensi multi-perangkat bergulir (floating lease) dengan keep-alive otomatis.
- **Antarmuka Manajemen Terintegrasi**: Akses modal lisensi melalui TitleBar, StatusBar, maupun menu Launcher untuk aktivasi kunci `TT-XXXX-XXXX-XXXX`, cek status kuota kursi, unbind perangkat, hingga pembelian via checkout MoR.

### Variabel Lingkungan (`.env`)
```bash
VITE_TERTAUT_API_KEY=tt_live_sirka
VITE_TERTAUT_APP_ID=app_sirka
VITE_TERTAUT_BASE_URL=https://tertaut.com
```
Pengaturan API juga dapat ditimpa atau dikonfigurasi langsung dari jendela **Lisensi Aplikasi -> Konfigurasi API Tertaut**.

