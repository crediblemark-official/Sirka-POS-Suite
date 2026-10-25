# Sertifikat Digital & Penandatanganan Aplikasi (Sirka Code Signing)

Direktori ini berisi sertifikat digital resmi untuk penandatanganan aplikasi **Sirka** (Desktop Windows & Mobile Android) yang diterbitkan oleh **Crediblemark**.

---

## 🪟 1. Windows Code Signing (Desktop)

### Berkas yang Tersedia:
- **`Sirka_CodeSigning.cer`**: Sertifikat publik biner (DER format) untuk dipasang di komputer Windows kasir/klien.
- **`Sirka_CodeSigning.crt`**: Sertifikat publik standar (PEM format).
- **`Sirka_CodeSigning.pfx`**: Kunci privat & sertifikat gabungan (PKCS#12) untuk menandatangani file `.exe` dan `.msi` (Password: `Sirka2026!`).
- **`install-cert.bat`**: Skrip otomatis 1-klik untuk memasang sertifikat ke *Trusted Root Certification Authorities*.

### Informasi Sertifikat:
- **Publisher (CN)**: `Sirka by Crediblemark`
- **Organization (O)**: `Crediblemark`
- **Unit (OU)**: `Sirka Development Team`
- **Thumbprint (SHA-1)**: `BCBE5A68ACC01117B20CA483B18535FF74EF67BD`
- **Masa Berlaku**: 10 Tahun (hingga 2036)

### Cara Pemasangan di PC / Laptop Windows Kasir:
1. Klik kanan pada file **`install-cert.bat`** lalu pilih **"Run as administrator"**.
2. Selesai! Setelah dipasang, semua installer dan aplikasi Sirka akan otomatis diakui sebagai **Verified Publisher** oleh Windows Defender dan SmartScreen.

---

## 📱 2. Android Keystore (Sirka Owner Mobile)

### Berkas yang Tersedia:
- **`sirka-release.keystore`**: Android Keystore format PKCS#12 untuk signing APK produksi.
- **Alias**: `sirka`
- **Keystore Password**: `Sirka2026!`
- **Key Password**: `Sirka2026!`
- **Masa Berlaku**: 10.000 Hari (~27 Tahun)
