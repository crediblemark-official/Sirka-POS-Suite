#!/usr/bin/env node
/**
 * Pemasang Plugin Android Keystore untuk aplikasi Sirka Owner.
 *
 * Plugin Android Keystore memberi kunci kripto **hardware-backed** milik
 * perangkat (private key tidak pernah keluar dari Android Keystore) plus
 * konfirmasi biometrik / kredensial layar kunci.
 *
 * Plugin ini butuh project Android yang sudah di-generate:
 *   cd mobile && npx tauri android init
 * (butuh Android NDK — pasang lewat Android Studio atau sdkmanager).
 *
 * Usage:
 *   node scripts/install-android-keystore.mjs            # install/update plugin
 *   node scripts/install-android-keystore.mjs --check    # hanya cek status
 *
 * Script ini idempoten — aman dijalankan berkali-kali.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOBILE_DIR = resolve(__dirname, '..');
const PLUGIN_SRC = join(MOBILE_DIR, 'src-tauri', 'plugins', 'android-keystore', 'AndroidKeystorePlugin.kt');
const ANDROID_DIR = join(MOBILE_DIR, 'src-tauri', 'gen', 'android');
const APP_SRC_DIR = join(ANDROID_DIR, 'app', 'src', 'main', 'java', 'com', 'sirka', 'owner');
const MAIN_ACTIVITY = join(APP_SRC_DIR, 'MainActivity.kt');
const MANIFEST = join(ANDROID_DIR, 'app', 'src', 'main', 'AndroidManifest.xml');
const BUILD_GRADLE = join(ANDROID_DIR, 'app', 'build.gradle.kts');
const PACKAGE = 'com.sirka.owner';

function log(msg) { console.log(msg); }
function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exitCode = 1;
}

const checkOnly = process.argv.includes('--check');

if (!existsSync(PLUGIN_SRC)) {
  fail(`File plugin tidak ditemukan: ${PLUGIN_SRC}`);
  process.exit(1);
}

// --- 1. Cek project Android sudah di-generate -------------------------------
if (!existsSync(ANDROID_DIR)) {
  fail(
    `Project Android belum di-generate.\n` +
    `   Jalankan dulu:\n     cd mobile && npx tauri android init\n` +
    `   (memerlukan Android SDK + NDK yang terpasang)`
  );
  process.exit(1);
}

if (checkOnly) {
  const installed = existsSync(join(APP_SRC_DIR, 'AndroidKeystorePlugin.kt'));
  const registered = existsSync(MAIN_ACTIVITY) &&
    readFileSync(MAIN_ACTIVITY, 'utf-8').includes('AndroidKeystorePlugin');
  log(`Plugin Kotlin : ${installed ? 'terpasang' : 'BELUM terpasang'}`);
  log(`Terdaftar    : ${registered ? 'ya' : 'BELUM'}`);
  log(`Manifest     : ${existsSync(MANIFEST) ? 'ada' : 'tidak ada'}`);
  process.exit(0);
}

// --- 2. Salin file plugin ke source set aplikasi -----------------------------
mkdirSync(APP_SRC_DIR, { recursive: true });
const dest = join(APP_SRC_DIR, 'AndroidKeystorePlugin.kt');
copyFileSync(PLUGIN_SRC, dest);
log(`✓ Plugin disalin ke ${dest}`);

// --- 3. Daftarkan plugin di MainActivity.kt ---------------------------------
if (existsSync(MAIN_ACTIVITY)) {
  let main = readFileSync(MAIN_ACTIVITY, 'utf-8');

  if (!main.includes('AndroidKeystorePlugin')) {
    // Tambah import
    if (!main.includes(`import ${PACKAGE}.AndroidKeystorePlugin`)) {
      main = main.replace(
        /import\s+([\w.]+)\s*\n/,
        (m, imp) => `import ${imp}\nimport ${PACKAGE}.AndroidKeystorePlugin\n`
      );
    }
    // Tambah registrasi plugin di dalam onCreate
    if (!main.includes('registerPlugin(AndroidKeystorePlugin(this))')) {
      main = main.replace(
        /(onCreate\([^)]*\)\s*\{)/,
        `$1\n            // Plugin Android Keystore (SEC-3): kunci hardware-backed + biometrik\n            registerPlugin(AndroidKeystorePlugin(this))`
      );
    }
    writeFileSync(MAIN_ACTIVITY, main, 'utf-8');
    log('✓ Plugin didaftarkan di MainActivity.kt');
  } else {
    log('• Plugin sudah terdaftar di MainActivity.kt');
  }
} else {
  fail(`MainActivity.kt tidak ditemukan di ${MAIN_ACTIVITY}`);
}

// --- 4. Tambahkan permission & dependency -----------------------------------
if (existsSync(MANIFEST)) {
  let manifest = readFileSync(MANIFEST, 'utf-8');
  const needed = [
    'android.permission.USE_BIOMETRIC',
    'android.permission.USE_FINGERPRINT',
  ];
  let changed = false;
  for (const perm of needed) {
    if (!manifest.includes(perm)) {
      manifest = manifest.replace(
        /<manifest([^>]*)>/,
        `<manifest$1>\n    <uses-permission android:name="${perm}" />`
      );
      changed = true;
    }
  }
  // Cegah backup app (mengandung data keuangan)
  if (!manifest.includes('android:allowBackup="false"')) {
    manifest = manifest.replace(
      /<application([^>]*?)>/,
      '<application$1 android:allowBackup="false" android:fullBackupContent="false">'
    );
    changed = true;
  }
  if (changed) {
    writeFileSync(MANIFEST, manifest, 'utf-8');
    log('✓ AndroidManifest.xml diperbarui (permission biometrik + allowBackup=false)');
  } else {
    log('• Manifest sudah benar');
  }
}

if (existsSync(BUILD_GRADLE)) {
  let gradle = readFileSync(BUILD_GRADLE, 'utf-8');
  if (!gradle.includes('androidx.biometric')) {
    gradle = gradle.replace(
      /(dependencies\s*\{)/,
      `$1\n    implementation("androidx.biometric:biometric:1.1.0")`
    );
    writeFileSync(BUILD_GRADLE, gradle, 'utf-8');
    log('✓ build.gradle.kts: androidx.biometric ditambahkan');
  } else {
    log('• androidx.biometric sudah ada');
  }
}

log('\n🎉 Plugin Android Keystore siap. Build APK dengan:');
log('   cd mobile && npx tauri android build --apk\n');
