# Sirka Owner Mobile (APK)

Aplikasi Android khusus **Owner Toko** untuk monitoring penjualan, buku kas/ledger, stok kritis, dan laporan kulakan secara real-time langsung dari PostgreSQL Cloud.

Aplikasi ini dikelola terpisah di dalam direktori `mobile/` dan **tidak memuat kode desktop** (tidak ada kasir POS, scanner barcode USB/kamera lokal, printer struk thermal, atau SQLite lokal).

---

## Fitur Utama
1. **Dashboard Eksekutif**:
   * Omzet hari ini & estimasi laba kotor.
   * Total nota transaksi yang diproses.
   * Total piutang tempo yang belum lunas.
   * Akumulasi omzet & laba bulan berjalan.
2. **Laporan Penjualan (Ledger)**:
   * Riwayat nota penjualan terbaru.
   * Filter status pembayaran (Semua, Lunas, Tempo).
   * Pencarian nama pelanggan atau nomor nota.
   * Detail rincian barang belanjaan per nota (modal bottom sheet).
3. **Peringatan Stok Kritis**:
   * Pantau barang dengan stok menipis (<= 10 unit).
   * Badge indikator merah/kuning untuk prioritas restock/kulakan.
4. **Laporan Kulakan**:
   * Riwayat faktur penerimaan barang dari supplier.
5. **Keamanan & Setelan**:
   * Proteksi Kunci PIN aplikasi untuk menjaga privasi laporan keuangan saat HP dipinjam.
   * Pengaturan URL server PostgreSQL cloud dengan tombol uji koneksi langsung.

---

## Cara Menjalankan (Development)

### 1. Install Dependencies
```bash
cd mobile
bun install
```

### 2. Preview UI Mobile di Browser / HP (via Wi-Fi)
```bash
cd mobile
bun run dev
```
Buka URL lokal (misal `http://localhost:1422`) di browser komputer atau di browser HP melalui alamat IP LAN (misal `http://192.168.1.xxx:1422`).

---

## Cara Build APK Android

### Prasyarat:
- Android Studio & Android SDK / NDK terpasang.
- Target Rust Android sudah ditambahkan:
  ```bash
  rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
  ```

### Inisialisasi Android (Hanya 1x Pertama Kali):
```bash
cd mobile
bun run tauri android init
```
*Perintah ini akan men-generate folder `mobile/src-tauri/gen/android`.*

### Menjalankan di Emulator / HP Android via USB Debugging:
```bash
cd mobile
bun run tauri android dev
```

### Mem-build APK Release:
```bash
cd mobile
bun run tauri android build --apk
```
File APK yang dihasilkan akan berada di:
`mobile/src-tauri/gen/android/app/build/outputs/apk/release/`
