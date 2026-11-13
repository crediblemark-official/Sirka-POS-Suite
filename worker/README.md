# Panduan Mudah Menghubungkan Sirka POS & Sirka Owner ke Cloud (Untuk Pemula / Non-Teknis)

Panduan ini membantu Anda menghubungkan **Sirka POS (Kasir)** dan **Sirka Owner (HP Pemilik)** agar data penjualan, stok, dan laporan keuangan otomatis sinkron lewat internet.

> **Kabar baik:** Anda **tidak harus** jago coding. Pilih saja salah satu dari 2 cara di bawah ini.

---

## Cara 1: Paling Mudah — Langsung Pakai Database Gratis (Tanpa Cloudflare Worker)

**Cocok untuk:** Anda yang memakai aplikasi **Windows (`.exe`)** dan **Android APK (`Sirka_POS.apk` & `Sirka_Owner.apk`)** dan ingin cara tercepat tanpa ribet terminal/perintah teks.

### Langkah 1: Buat Database Gratis di Neon
1. Buka website **https://neon.tech** di browser, lalu daftar akun gratis (bisa login dengan Google).
2. Setelah masuk, klik **Create Project** (buat proyek baru, beri nama misalnya `toko-saya`).
3. Di menu sebelah kiri, klik **SQL Editor**.
4. Buka file `db/schema.sql` (dari dalam file ZIP rilis) menggunakan Notepad, salin (**Ctrl+A** lalu **Ctrl+C**) seluruh isinya, tempel (**Ctrl+V**) ke kolom **SQL Editor** di Neon, lalu klik tombol **Run**.
   *(Langkah ini hanya dilakukan 1 kali saja untuk menyiapkan tabel database toko Anda.)*

### Langkah 2: Salin Alamat Database
1. Kembali ke halaman **Dashboard** Neon Anda.
2. Cari kotak bertuliskan **Connection String** (atau klik tombol **Connect**).
3. Salin alamatnya yang berawalan `postgresql://...` (pastikan password ikut tersalin, bukan masih bertuliskan `***`).

### Langkah 3: Tempel ke Aplikasi Sirka
1. **Di Aplikasi Kasir (`Sirka POS`):**
   Buka menu **Pengaturan Server / Database Cloud** → tempel alamat `postgresql://...` tadi → klik **Simpan**.
2. **Di Aplikasi Owner (`Sirka Owner Mobile` APK):**
   Buka tab **Setelan** → pada kolom **URL Cloudflare Worker atau PostgreSQL**, langsung tempel alamat `postgresql://...` yang sama → klik **Uji Koneksi Server** → klik **Simpan**.

Selesai! Data kasir dan HP Owner sudah terhubung.

---

## Cara 2: Pakai Cloudflare Worker (Untuk Akses Web & Koneksi HP Lebih Stabil)

**Cocok untuk:** Anda yang ingin memantau laporan lewat browser web, atau ingin koneksi HP tetap stabil meski sinyal berganti-ganti, serta ingin password database tidak disimpan di HP.

### Persiapan Awal (Cukup 1 Kali)
1. Selesaikan **Langkah 1 & Langkah 2** pada **Cara 1** di atas terlebih dahulu (Anda tetap butuh alamat `postgresql://...` dari Neon/Supabase).
2. Pasang **Node.js** di laptop/PC Anda: unduh dari **https://nodejs.org** (pilih tombol **LTS**), lalu install seperti biasa (*Next → Next → Finish*).
3. Buat akun gratis di **https://dash.cloudflare.com**.
4. Ekstrak file `sirka-owner-worker-deploy.zip` dari halaman rilis GitHub ke sebuah folder, misalnya di `Desktop`.

### Langkah Upload ke Cloudflare
1. Buka folder hasil ekstrak tadi, lalu masuk ke dalam folder **`worker`**.
2. Klik kanan di area kosong dalam folder `worker`, lalu pilih **Open in Terminal** (atau di Windows ketik `cmd` pada kolom alamat folder lalu tekan **Enter**).
3. Ketik perintah berikut satu per satu (tekan **Enter** setiap selesai mengetik 1 baris):

   **a. Unduh kelengkapan sistem (tunggu hingga selesai):**
   ```bash
   npm install
   ```

   **b. Login ke akun Cloudflare Anda:**
   ```bash
   npx wrangler login
   ```
   *(Browser akan terbuka otomatis. Klik tombol **Allow** / Izinkan, lalu kembali ke layar terminal.)*

   **c. Masukkan alamat database Neon Anda:**
   ```bash
   npx wrangler secret put DATABASE_URL
   ```
   *(Saat muncul tulisan `Enter a secret value:`, klik kanan untuk menempel alamat `postgresql://...` Anda, lalu tekan **Enter**. Karakter memang tidak terlihat di layar demi keamanan.)*

   **d. Buat password akses untuk HP Owner (bebas Anda tentukan sendiri):**
   ```bash
   npx wrangler secret put OWNER_SECRET_KEY
   ```
   *(Ketik password rahasia Anda, misalnya `TokoBerkah2026`, lalu tekan **Enter**. Catat password ini baik-baik.)*

   **e. Aktifkan server ke internet:**
   ```bash
   npm run deploy
   ```
   *(Di bagian akhir akan muncul alamat website Anda, contohnya:*
   `https://sirka-owner-api.namaanda.workers.dev`*)*

### Hubungkan ke Aplikasi Sirka Owner
1. Buka **Sirka Owner Mobile** → masuk ke tab **Setelan**.
2. Pada kolom **URL Cloudflare Worker atau PostgreSQL**, masukkan alamat `https://sirka-owner-api.namaanda.workers.dev` yang muncul tadi.
3. Pada kolom **Token Akses Worker (`OWNER_SECRET_KEY`)**, masukkan password rahasia yang Anda buat di langkah **d**.
4. Klik **Uji Koneksi Server** → jika berhasil, klik **Simpan**.

---

## Ringkasan Masalah Umum
- **Tulisan "URL Server belum diatur"**: Buka tab **Setelan** di Sirka Owner, pastikan kolom URL sudah diisi dan tombol **Simpan** sudah diklik.
- **Error `401 Akses ditolak`**: Password di kolom **Token Akses Worker** belum sama dengan `OWNER_SECRET_KEY` yang Anda ketik saat deploy.
- **Data belum muncul setelah baru isi `schema.sql`**: Pastikan aplikasi kasir (`Sirka POS`) sudah diisi URL database yang sama dan sudah melakukan minimal 1 kali sinkronisasi/transaksi.
