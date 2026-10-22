# Sirka Owner API (Cloudflare Worker)

Backend REST API serverless yang aman dan cepat untuk melayani aplikasi Android Owner dari PostgreSQL cloud.

---

## Fitur
1. **Keamanan:**
   * Kredensial PostgreSQL **hanya** disimpan sebagai Cloudflare Secret (`wrangler secret put DATABASE_URL`) — tidak pernah ditulis literal di source code, `wrangler.toml`, maupun README.
   * ⚠️ **PENTING**: Kredensial database produksi pernah bocor ke dalam riwayat repository ini (termasuk di dalam binary APK). **Password database wajib dirotasi** di sisi provider sebelum aplikasi dipakai ulang. Lihat `../.env.example` untuk format nilainya.
   * Proteksi token **AKTIF**: setiap request ke `/api/*` wajib menyertakan `Authorization: Bearer <OWNER_SECRET_KEY>`. Bandingkan token secara *constant-time*. Lihat bagian "Autentikasi" di bawah.
2. **Koneksi Tahan Banting (Stateless HTTP/HTTPS):**
   * Menggunakan HTTP REST API yang tahan terhadap perubahan jaringan seluler HP (4G/5G/Wi-Fi).
3. **Endpoint Lengkap:**
   * `GET /api/financial-report?period=today|week|month|year`: Laporan Laba Rugi & Arus Kas.
   * `GET /api/inventory-valuation`: Valuasi Modal Tertanam Persediaan Barang (41 produk riil).
   * `GET /api/sales`: Buku Nota & Piutang Tempo Pelanggan.
   * `GET /api/purchases`: Riwayat Kulakan Supplier.
   * `GET /api/shifts`: Rekap shift kasir & rekonsiliasi kas laci.
   * `GET /api/analytics/*`: Modul analisis bisnis.
   * `POST /api/test-connection`: Uji status koneksi ke PostgreSQL.
   * `POST /api/shifts`: Sinkronisasi shift kasir dari aplikasi kasir.

---

## Autentikasi

**Sudah DITEGAKKAN.** Setiap request ke `/api/*` wajib menyertakan token:

```
Authorization: Bearer <OWNER_SECRET_KEY>
```

Alternatif: header `x-owner-pin: <OWNER_SECRET_KEY>`.

Perbandingan token memakai *constant-time comparison* sehingga tidak bisa
ditebak lewat timing attack. Tanpa header yang benar, Worker membalas **401**
dengan pesan yang jelas.

Bila `OWNER_SECRET_KEY` **tidak** diset, proteksi dimatikan (mode pengembangan)
dan aplikasi mobile menampilkan peringatan "Proteksi token belum aktif".

### Mengaktifkan proteksi

```bash
cd worker
bun x wrangler secret put OWNER_SECRET_KEY
```

Lalu masukkan token yang sama di aplikasi:
- **Mobile**: tab *Setelan* → field **Token Akses Worker**
- **Desktop (kasir)**: *Branding & Toko* → field **Token Akses Worker**

> Catatan: token disimpan **hanya di perangkat** (localStorage), tidak pernah
> ikut ter-sinkron ke database cloud.

---

## Cara Menjalankan Secara Lokal (Development)

```bash
cd worker

# 1. Buat file .dev.vars (sudah di-ignore git) berisi kredensial lokal:
echo 'DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE' > .dev.vars

# 2. Jalankan
bun run dev
```

Worker akan berjalan di `http://localhost:8787`.

---

## Cara Deploy ke Cloudflare (Gratis)

### 1. Login ke Akun Cloudflare
```bash
cd worker
bun x wrangler login
```
*(Browser akan terbuka untuk konfirmasi otorisasi akun Cloudflare Anda.)*

### 2. Set Secret Database URL (Sangat Aman)
```bash
bun x wrangler secret put DATABASE_URL
```
Masukkan connection string PostgreSQL Anda saat diminta, contoh:
`postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

### 3. Deploy ke Internet
```bash
bun run deploy
```
Wrangler akan memberikan URL publik HTTPS gratis, misalnya:
`https://sirka-owner-api.[subdomain-anda].workers.dev`

---

## Menghubungkan ke Aplikasi Mobile (Android)
Buka aplikasi mobile di HP atau browser pada tab **Setelan**, lalu masukkan URL Cloudflare Worker yang didapatkan:
`https://sirka-owner-api.[subdomain-anda].workers.dev`
