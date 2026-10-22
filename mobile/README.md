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
   * **Kunci Perangkat (Device Key)** — aplikasi terkunci saat dibuka memakai kunci
     kripto privat milik perangkat ini (ECDSA P-256, **non-extractable** — private
     key tidak pernah bisa dibaca JavaScript mana pun, termasuk skrip berbahaya).
     Bila perangkat mendukung kredensial platform (Android: sidik jari / pattern /
     PIN layar kunci), konfirmasi perangkat juga diminta — ini persis "kunci
     bawaan HP".
   * **Token akses Worker dienkripsi** (ECDH + AES-GCM memakai kunci perangkat),
     sehingga tidak ada rahasia plaintext di `localStorage`.
   * PIN lama masih tersedia sebagai **fallback** untuk perangkat tanpa Web Crypto,
     dan **dihapus otomatis** (bersama token plaintext) setelah Kunci Perangkat aktif.
   * Pengaturan URL server PostgreSQL cloud dengan tombol uji koneksi langsung.

### Cara Kerja Keamanan (ringkas)

| Yang disimpan | Di mana | Bentuk |
| --- | --- | --- |
| Private key (ECDSA P-256) | IndexedDB (sandbox privat app) | **Non-extractable** — tidak bisa diekspor |
| Public key + Device ID | localStorage | Publik (aman) |
| Token Worker | localStorage | **Terenkripsi AES-GCM** (kunci ECDH perangkat) |
| PIN Owner | localStorage | Fallback saja; dihapus setelah device key aktif |

> **Catatan:** kunci di IndexedDB bersifat *software-backed* (bukan hardware
> TPM/StrongBox). Untuk **true hardware backing + biometrik asli**, pasang plugin
> Android Keystore:
>
> ```bash
> # 1. Generate project Android (butuh Android SDK + NDK)
> cd mobile && npx tauri android init
>
> # 2. Pasang plugin (idempoten, aman diulang)
> node scripts/install-android-keystore.mjs
>
> # 3. Build APK
> npx tauri android build --apk
> ```
>
> Plugin memakai `KeyGenParameterSpec` (ECDSA P-256 di Android Keystore) +
> `BiometricPrompt`, sehingga **private key tidak pernah keluar dari HP** dan
> Unlock memakai sidik jari/pattern/PIN layar kunci. Bila plugin tidak terpasang,
> aplikasi otomatis jatuh ke Web Crypto (tetap aman, hanya tidak hardware-backed).
>
> Proteksi yang **benar-benar** melindungi data keuangan adalah **token akses
> Worker** (SEC-2) — device key hanya mengunci tampilan di perangkat.

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
