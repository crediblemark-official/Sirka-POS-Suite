#!/usr/bin/env node
/**
 * Skrip penandatanganan resmi APK Android Sirka Owner Mobile.
 * 
 * Melakukan zipalign 4-byte dan signing menggunakan apksigner
 * (mendukung APK Signature Scheme v1, v2, dan v3).
 * 
 * Skrip ini menggantikan jarsigner konvensional agar APK kompatibel penuh
 * dengan Android 11+ (API 30+) dan tidak mengalami error "masalah parsing paket".
 *
 * Usage:
 *   node scripts/sign-apk.mjs [path-ke-file.apk]
 */

import { existsSync, readdirSync, statSync, unlinkSync, renameSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOBILE_DIR = resolve(__dirname, '..');
const ROOT_DIR = [
  resolve(MOBILE_DIR, '../..'),
  resolve(MOBILE_DIR, '..'),
  process.cwd()
].find(dir => existsSync(join(dir, 'certs', 'sirka-release.keystore'))) || resolve(MOBILE_DIR, '../..');

const KEYSTORE_PATH = join(ROOT_DIR, 'certs', 'sirka-release.keystore');
const KEYSTORE_PASS = 'Sirka2026!';
const KEYSTORE_ALIAS = 'sirka';

function log(msg) { console.log(msg); }
function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// 1. Validasi Keystore
if (!existsSync(KEYSTORE_PATH)) {
  fail(`Keystore tidak ditemukan di: ${KEYSTORE_PATH}`);
}

// 2. Temukan tool apksigner dan zipalign
function findTool(toolName) {
  // Cek PATH terlebih dahulu
  try {
    const which = execSync(`which ${toolName} 2>/dev/null`, { encoding: 'utf-8' }).trim();
    if (which && existsSync(which)) return which;
  } catch {}

  // Cek ANDROID_HOME / ANDROID_SDK_ROOT
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(process.env.HOME || '', 'android-sdk'),
    join(process.env.HOME || '', 'Android', 'Sdk'),
  ].filter(Boolean);

  for (const root of sdkRoots) {
    const buildToolsDir = join(root, 'build-tools');
    if (existsSync(buildToolsDir)) {
      const versions = readdirSync(buildToolsDir)
        .filter(v => statSync(join(buildToolsDir, v)).isDirectory())
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

      for (const ver of versions) {
        const candidate = join(buildToolsDir, ver, toolName);
        if (existsSync(candidate)) return candidate;
      }
    }
  }

  // Fallback: jika di Linux / Ubuntu runner, pasang via apt jika sudo tersedia
  if (process.platform === 'linux') {
    try {
      log(`Mengunduh ${toolName} via apt...`);
      execSync(`sudo apt-get update -y && sudo apt-get install -y ${toolName}`, { stdio: 'ignore' });
      const which = execSync(`which ${toolName} 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (which && existsSync(which)) return which;
    } catch {}
  }

  return null;
}

const apksigner = findTool('apksigner');
const zipalign = findTool('zipalign');

if (!apksigner) {
  fail('apksigner tidak ditemukan. Pastikan Android SDK Build-Tools terpasang.');
}
if (!zipalign) {
  fail('zipalign tidak ditemukan. Pastikan Android SDK Build-Tools terpasang.');
}

log(`✓ apksigner: ${apksigner}`);
log(`✓ zipalign : ${zipalign}`);

// 3. Cari target APK
let targetApk = process.argv[2];
if (!targetApk) {
  const apkDir = join(MOBILE_DIR, 'src-tauri', 'gen', 'android', 'app', 'build', 'outputs', 'apk');
  if (existsSync(apkDir)) {
    function findApkRecursive(dir) {
      const files = readdirSync(dir);
      for (const f of files) {
        const full = join(dir, f);
        if (statSync(full).isDirectory()) {
          const found = findApkRecursive(full);
          if (found) return found;
        } else if (f.endsWith('.apk') && !f.includes('-aligned') && !f.includes('-signed')) {
          return full;
        }
      }
      return null;
    }
    targetApk = findApkRecursive(apkDir);
  }
}

if (!targetApk || !existsSync(targetApk)) {
  fail(`Tidak ada file APK yang ditemukan untuk ditandatangani. Berikan path file: node scripts/sign-apk.mjs [path-ke-file.apk]`);
}

log(`\n📦 Memproses APK: ${targetApk}`);

// 4. Hapus signature lama jika ada
try {
  execSync(`zip -d "${targetApk}" "META-INF/*.SF" "META-INF/*.RSA" "META-INF/*.MF" 2>/dev/null`, { stdio: 'ignore' });
} catch {}

// 5. Jalankan zipalign 4-byte
const alignedApk = `${targetApk}.aligned.apk`;
try {
  log('⚡ Menjalankan zipalign (4-byte alignment)...');
  execSync(`"${zipalign}" -f -p 4 "${targetApk}" "${alignedApk}"`, { stdio: 'inherit' });
  renameSync(alignedApk, targetApk);
  log('✓ Zipalign selesai.');
} catch (e) {
  if (existsSync(alignedApk)) unlinkSync(alignedApk);
  fail(`Zipalign gagal: ${e.message}`);
}

// 6. Jalankan apksigner (v1, v2, v3)
try {
  log('🔑 Menandatangani APK dengan apksigner (v1, v2, v3)...');
  execSync(
    `"${apksigner}" sign ` +
    `--ks "${KEYSTORE_PATH}" ` +
    `--ks-key-alias "${KEYSTORE_ALIAS}" ` +
    `--ks-pass pass:${KEYSTORE_PASS} ` +
    `--key-pass pass:${KEYSTORE_PASS} ` +
    `--v1-signing-enabled true ` +
    `--v2-signing-enabled true ` +
    `--v3-signing-enabled true ` +
    `"${targetApk}"`,
    { stdio: 'inherit' }
  );
  log('✓ Signing berhasil.');
} catch (e) {
  fail(`Signing gagal: ${e.message}`);
}

// 7. Verifikasi hasil akhir
try {
  log('\n🔍 Verifikasi integritas tanda tangan APK...');
  const verifyOut = execSync(`"${apksigner}" verify --verbose "${targetApk}"`, { encoding: 'utf-8' });
  log(verifyOut);
  log(`🎉 Sukses! APK siap dipasang di semua perangkat Android:\n   ${targetApk}\n`);
} catch (e) {
  fail(`Verifikasi APK gagal: ${e.message}`);
}
