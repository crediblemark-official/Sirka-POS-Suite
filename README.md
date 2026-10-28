# 🛒 Sirka

**Sistem Kasir (POS) & Distribusi Hibrida (B2B Grosir SPPG & B2C Eceran)**

Sirka adalah sistem kasir *point-of-sale*, manajemen inventaris, dan distribusi hibrida terintegrasi yang dibangun untuk operasional bisnis ganda (*Dual Market Engine*):

1. **B2B (Grosir & Distribusi Institusi):** Agregator pengadaan Dapur SPPG (*Satuan Pelayanan Pemenuhan Gizi*), katering, dan mitra toko (Pre-Order terjadwal, penerimaan nota supplier harian, kalkulasi markup dinamis, harga grosir bertingkat, penerbitan Surat Jalan pengiriman bertanda tangan, dan pencatatan piutang tempo).
2. **B2C (Eceran & Pelayanan Toko):** Kasir cepat (*fast checkout*), scan barcode, manajemen shift & kas laci, program poin member, kupon promo bertingkat, split payment, pencatatan pesanan menu & tiket dapur (KOT), layanan jasa tanpa pemotongan stok fisik, dan cetak struk thermal ESC/POS 80mm/58mm.

---

## 🏗️ Arsitektur Sistem

Aplikasi ini menggunakan pendekatan **Local-First (Offline-First)** untuk memastikan kasir di toko fisik tetap beroperasi lancar walau jaringan internet terputus:

```text
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
[ Mobile App (apps/sirka-mobile/) — Android Handheld & Monitoring ]
```

---

## 📁 Struktur Monorepo (Bun Workspaces)

Proyek ini disusun dalam struktur **Monorepo Modular** menggunakan **Bun Workspaces** yang memisahkan pustaka logika bersama (*packages*) dari aplikasi pengguna (*apps*):

```text
Sirka-POS-Suite/
├── packages/                      # 📦 Pustaka Bersama (Shared Packages)
│   ├── shared-types/              # @sirka/shared-types (Tipe TypeScript & antarmuka data)
│   ├── shared-utils/              # @sirka/shared-utils (Format mata uang, tanggal, kripto HWID)
│   ├── shared-core/               # @sirka/shared-core (Pinia stores, dbService SQLite & sinkronisasi)
│   └── shared-ui/                 # @sirka/shared-ui (Komponen UI tabel & modal bersama)
│
├── apps/                          # 🚀 Aplikasi Pengguna
│   ├── sirka-desktop/             # 🖥️ PC/Laptop POS (Tauri v2 Desktop + Windows Explorer Shell)
│   │   ├── src-tauri/             # Rust desktop backend (SQLite WAL, printer ESC/POS, laci RJ11)
│   │   └── src/                   # UI Desktop (Katalog produk, kasir split-screen, master data)
│   │
│   └── sirka-mobile/              # 📱 Android Handheld POS & Monitoring (Tauri v2 Android)
│       ├── src-tauri/             # Rust Android backend (Bluetooth thermal, Android Keystore)
│       └── src/                   # UI Mobile-first (Katalog mobile, bottom-sheet keranjang)
│
├── certs/                         # 🔐 Sertifikat Code Signing Windows (.pfx) & Android Keystore
├── db/                            # 🗄️ Skema Database PostgreSQL, Migrasi & Seeder
├── worker/                        # ☁️ Cloudflare Workers + Hono REST API Sync Engine
├── tests/                         # 🧪 Test Suite Monorepo
└── .github/workflows/             # 🤖 CI/CD Otomatis (Rilis Windows Desktop & Android APK)
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

### 1. Kloning & Instal Dependensi
```bash
git clone https://github.com/crediblemark-official/Sirka.git sirka
cd sirka
bun install
```

### 2. Konfigurasi Lingkungan (`.env`)
Salin berkas template lingkungan:
```bash
cp .env.example .env
```
Isi variabel `DATABASE_URL` pada berkas `.env`:
```env
DATABASE_URL=postgresql://sirka_user:sirka_password@localhost:5434/sirka_db
```

### 3. Menjalankan Database PostgreSQL Lokal (Docker)
Jika menggunakan database lokal:
```bash
docker compose up -d
bun run db:seed
```
*Port PostgreSQL lokal dipetakan ke port `5434` host.*

### 4. Menjalankan Aplikasi

#### Desktop POS
```bash
# Menjalankan frontend Vite Desktop (Web dev preview)
bun run dev:desktop

# Menjalankan jendela native Desktop Tauri
bun run tauri:desktop
```

#### Android Mobile
```bash
# Menjalankan frontend Vite Mobile
bun run dev:mobile

# Menjalankan aplikasi Android native via Tauri CLI
bun run tauri:android
```

#### API Cloudflare Worker
```bash
# Setup kredensial lokal worker
echo 'DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE' > worker/.dev.vars

# Jalankan worker secara lokal di port 8787
bun run worker:dev
```

---

## 📦 Modul Aplikasi Desktop

Antarmuka desktop dirancang modular menyerupai tata letak File Explorer terintegrasi dengan tab bar dinamis, toolbar, dan status bar sinkronisasi:

| Modul | Nama Tab | Komponen Utama | Deskripsi Fungsional |
|---|---|---|---|
| **Dashboard** | `Home` | `HomeInsightView.vue` | Metrik omzet, estimasi laba kotor, grafik performa harian, dan ringkasan transaksi. |
| **Kasir** | `Kasir` | `ProductCatalog.vue`, `PosCart.vue` | Kasir cepat, tahan keranjang (*held carts*), penyesuaian diskon, dan pembayaran tunai/non-tunai/tempo. |
| **Shift Kasir** | — | `OpenShiftModal.vue`, `CloseShiftModal.vue`, `ShiftSummaryModal.vue` | Modal awal kasir, kas masuk (*cash inflow*), dan rekonsiliasi kas laci saat tutup shift. |
| **Pesanan** | `Pesanan` | `PreOrderMatrix.vue`, `PreOrderFormDrawer.vue` | Rekap PO harian untuk Dapur SPPG, penentuan tanggal kirim, dan pemuatan langsung ke kasir. |
| **Kulakan** | `Kulakan` | `ProductReceivingDrawer.vue` | Penerimaan barang dari supplier, penyesuaian harga beli aktual nota fisik, dan update stok delta otomatis. |
| **Inventaris** | `Inventaris` | `MasterProducts.vue`, `MasterSkuTab.vue` | Katalog SKU, multi-satuan (*baseQty*), penyesuaian opname stok fisik, dan kartu riwayat stok. |
| **Kategori** | `Kategori` | `MasterVendorTab.vue` | Manajemen kategori produk, palet warna visual, dan aturan persentase markup margin per kategori. |
| **Supplier** | `Supplier` | `MasterSupplierTab.vue` | Master data supplier bahan pangan dan kebutuhan operasional toko. |
| **Pelanggan** | `Pelanggan` | `MasterBuyerTab.vue` | Master pembeli institusi (Dapur SPPG) dan pelanggan umum beserta riwayat tempo/piutang. |
| **Diskon & Promo** | `Diskon` | `MasterDiscountTab.vue` | Kupon promosi belanja, kupon tipe pelanggan, dan batas pemakaian. |
| **Member** | `Member` | `MasterMemberTab.vue` | Program poin loyalitas, tier member, pencetakan kartu anggota ber-barcode, dan riwayat poin. |
| **Buku Kas** | `Buku Kas` | `LedgerView.vue`, `LedgerMutationsTable.vue` | Buku besar penjualan, pelunasan piutang tempo, dan mutasi kas masuk/keluar harian. |
| **Laporan** | `Laporan` | `FinancialReportsView.vue` | Laporan Laba Rugi (PnL), Neraca, Arus Kas, Rekap Shift, Rekonsiliasi QRIS, dan Piutang Belum Lunas. |
| **Retur & Rusak** | — | `RefundModal.vue`, `WasteModal.vue` | Retur penjualan pembeli dan pencatatan barang rusak/waste (otomatis mengembalikan stok dan poin transaksi). |
| **Branding Toko** | `Profil` | `MasterBrandingTab.vue`, `PrinterConfigModal.vue` | Profil toko, alamat, logo, token akses Cloudflare Worker, dan konfigurasi printer thermal. |

---

## 🧾 Format Dokumen Transaksi Kasir

Pada modal transaksi kasir (`ReceiptModal.vue`), kasir dapat menerbitkan dokumen sesuai kebutuhan operasional:

1. **Struk Penjualan / Faktur Kasir:**
   - Rincian belanja, diskon, poin member, metode bayar (Tunai, QRIS, Transfer, Tempo), kembalian, dan infaq.
   - Barcode faktur (Code 128) untuk pelacakan transaksi dan retur.
2. **Tiket Dapur / Bar (KOT - Kitchen Order Ticket):**
   - Rincian nomor meja, nama pelanggan, kuantitas menu, catatan koki, dan varian pesanan tanpa nominal harga.
3. **Surat Jalan Pengiriman (DO - Delivery Order):**
   - Rincian nomor DO, nomor faktur acuan, penerima, alamat/PIC, kuantitas per satuan barang fisik, dan kolom tanda tangan supir & penerima toko tanpa membuka informasi margin harga.

Dokumen dapat dicetak via printer thermal ESC/POS (USB/Bluetooth 58mm & 80mm), dialog printer sistem OS, maupun disalin langsung ke format teks WhatsApp.

---

## 🧪 Pengujian (Testing)

Proyek ini memiliki unit test otomatis yang mencakup lapisan logika bisnis frontend dan backend Rust:

```bash
# 1. Menjalankan seluruh test frontend (54 pass di Pinia stores, lisensi, kalkulasi, & alur bisnis)
bun test

# 2. Menjalankan seluruh test backend Rust (24 pass di SQLite local_db & cetak struk ESC/POS)
bun run test:rust

# 3. Menjalankan seluruh rangkaian test frontend & Rust sekaligus
bun run test:all

# 4. Validasi type-checking TypeScript & build produksi frontend
bun run build:desktop
bun run build:mobile
```

---

## 🤖 Otomatisasi Rilis (GitHub Actions)

Alur kerja CI/CD di folder [`.github/workflows`](file:///media/rasyiqi/7653717A1C07B131/Sirka%20POS%20Suite/.github/workflows) dikonfigurasi untuk membangun rilis resmi:

1. **Windows Desktop Installer ([`release.yml`](file:///media/rasyiqi/7653717A1C07B131/Sirka%20POS%20Suite/.github/workflows/release.yml)):**
   - Berjalan pada runner `windows-latest`.
   - Menandatangani file dengan sertifikat resmi [`certs/Sirka_CodeSigning.pfx`](file:///media/rasyiqi/7653717A1C07B131/Sirka%20POS%20Suite/certs/Sirka_CodeSigning.pfx).
   - Menghasilkan installer `.exe` (NSIS) dan paket `.msi`.
2. **Android APK Release ([`build-android.yml`](file:///media/rasyiqi/7653717A1C07B131/Sirka%20POS%20Suite/.github/workflows/build-android.yml)):**
   - Berjalan pada runner `ubuntu-24.04` dengan Java 17 dan Android NDK r26d.
   - Menandatangani file APK menggunakan [`certs/sirka-release.keystore`](file:///media/rasyiqi/7653717A1C07B131/Sirka%20POS%20Suite/certs/sirka-release.keystore).
   - Menghasilkan file APK resmi bertanda tangan (`Sirka_Owner_<versi>.apk`) dan otomatis diunggah ke GitHub Releases.

Pemicu rilis: Buat tag git berawalan `v*` (contoh: `git tag v0.2.3 && git push origin v0.2.3`) atau jalankan secara manual melalui menu **Actions -> Run workflow** di GitHub.

---

## 🔐 Sistem Lisensi Tertaut (tertaut.com)

Aplikasi ini menggunakan infrastruktur lisensi dari **[tertaut.com](https://tertaut.com)** via official client SDK `@tertaut/sdk`:

- **Kriptografi Asimetris Ed25519**: Verifikasi digital signature secara matematis di sisi klien tanpa memerlukan rahasia server (*secret key*) pada binary aplikasi.
- **Hardware ID (HWID) Device Locking**: Lisensi terikat pada perangkat fisik menggunakan sidik jari mesin SHA-256 ter-salt (`HWID-XXXX-XXXX-XXXX-XXXX`) untuk mencegah penggandaan tanpa izin.
- **Offline-First Grace Token**: Mendukung kasir beroperasi penuh saat offline tanpa koneksi internet hingga 30 hari menggunakan token grace Ed25519 tervalidasi.
- **Floating Seat Lease**: Mendukung skenario lisensi multi-perangkat kasir bergulir dengan keep-alive otomatis.
- **Antarmuka Manajemen Terpadu**: Akses modal lisensi melalui TitleBar atau StatusBar untuk aktivasi lisensi `TT-XXXX-XXXX-XXXX`, cek kuota perangkat, hingga unbind mesin.

### Variabel Lingkungan (`.env`)
```bash
VITE_TERTAUT_API_KEY=tt_live_sirka
VITE_TERTAUT_APP_ID=app_sirka
VITE_TERTAUT_BASE_URL=https://tertaut.com
```

---

## 📄 Lisensi & Hak Cipta

Perangkat lunak ini dilindungi oleh hak cipta dan lisensi komersial kepemilikan. Seluruh hak cipta kode sumber dan kekayaan intelektual dimiliki sepenuhnya oleh **Crediblemark** (Developer: **Rasyiqi**).

Informasi lengkap mengenai hak pakai, pembatasan penjualan kembali, dan lisensi penggunaan internal dapat dilihat pada berkas [LICENSE](file:///media/rasyiqi/7653717A1C07B131/Sirka%20POS%20Suite/LICENSE).
