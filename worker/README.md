# Sirka Owner API (Cloudflare Worker)

Backend REST API serverless yang aman dan cepat untuk melayani aplikasi Android Owner dari PostgreSQL cloud.

---

## Fitur
1. **Keamanan Maksimal:**
   * Kredensial PostgreSQL tersimpan di Cloudflare Secrets, tidak bocor di APK Android.
   * Mendukung CORS untuk aplikasi mobile dan proteksi token.
2. **Koneksi Tahan Banting (Stateless HTTP/HTTPS):**
   * Menggunakan HTTP REST API yang tahan terhadap perubahan jaringan seluler HP (4G/5G/Wi-Fi).
3. **Endpoint Lengkap:**
   * `GET /api/financial-report?period=today|week|month|year`: Laporan Laba Rugi & Arus Kas.
   * `GET /api/inventory-valuation`: Valuasi Modal Tertanam Persediaan Barang (41 produk riil).
   * `GET /api/sales`: Buku Nota & Piutang Tempo Pelanggan.
   * `GET /api/purchases`: Riwayat Kulakan Supplier.
   * `POST /api/test-connection`: Uji status koneksi ke PostgreSQL.

---

## Cara Menjalankan Secara Lokal (Development)

```bash
cd worker
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
*(Browser akan terbuka untuk konfirmasi otorisasi akun Cloudflare Anda).*

### 2. Set Secret Database URL (Sangat Aman)
```bash
bun x wrangler secret put DATABASE_URL
```
Masukkan connection string PostgreSQL Anda saat diminta:
`postgresql://ubjMYAl9vhpXpajHQ.jkt_001:aad2354f32977874bd6a646b@pgsql-dbas-jkt-001.sumobase.my.id:6432/dbd17904386f2e55b4`

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
