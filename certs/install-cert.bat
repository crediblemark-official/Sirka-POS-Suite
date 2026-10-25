@echo off
:: Batch script untuk memasang Sertifikat Digital Sirka ke Trusted Root Authorities
title Pemasangan Sertifikat Digital Sirka - Crediblemark
echo ========================================================
echo   Pemasangan Sertifikat Digital Sirka (Crediblemark)
echo ========================================================
echo.

net session >nul 2>&1
if %errorLevel% == 0 (
    echo [INFO] Menambahkan sertifikat ke Trusted Root Certification Authorities...
    certutil -addstore -f "Root" "%~dp0Sirka_CodeSigning.cer"
    echo.
    echo ========================================================
    echo [SUKSES] Sertifikat resmi berhasil dipasang!
    echo Sekarang installer dan aplikasi Sirka akan berstatus
    echo "Verified Publisher" dan tidak akan dicegat SmartScreen.
    echo ========================================================
) else (
    echo [PERHATIAN] Akses Administrator Diperlukan!
    echo Silakan klik kanan file ini dan pilih:
    echo "Run as administrator" (Jalankan sebagai administrator)
)

echo.
pause
