#!/usr/bin/env bun
/**
 * CLI Manajemen Lisensi Tertaut.com (Server-to-Server / S2S)
 * Menggunakan Secret Key untuk menerbitkan, memeriksa, dan mengelola lisensi Sirka POS Suite.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Muat variabel lingkungan dari .env jika belum ada di process.env
function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const SECRET_KEY = process.env.TERTAUT_SECRET_KEY || 'tt_secret_c460f87d06c593ba7cb95ef66d6b4a2b1d55799b7fb27a71';
const APP_ID = process.env.TERTAUT_APP_ID || process.env.VITE_TERTAUT_APP_ID || 'app_c0d2fecb36dd';
const BASE_URL = (process.env.TERTAUT_BASE_URL || 'https://tertaut.com').replace(/\/+$/, '');

if (!SECRET_KEY || !SECRET_KEY.startsWith('tt_secret_')) {
  console.error('❌ Error: TERTAUT_SECRET_KEY belum diisi di file .env atau tidak diawali dengan tt_secret_');
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${SECRET_KEY}`,
  'Content-Type': 'application/json'
};

async function listLicenses(appId: string = APP_ID) {
  console.log(`🔍 Mengambil daftar lisensi untuk App: ${appId} ...`);
  const url = `${BASE_URL}/api/v1/s2s/licenses?appId=${encodeURIComponent(appId)}&limit=100`;
  const res = await fetch(url, { headers });
  const data = await res.json() as any;

  if (!res.ok) {
    console.error('❌ Gagal mengambil lisensi:', data);
    return;
  }

  const licenses = data.licenses || [];
  console.log(`\n✅ Ditemukan ${licenses.length} lisensi:\n`);
  console.table(licenses.map((l: any) => ({
    Key: l.licenseKey,
    Email: l.customerEmail,
    Status: l.status,
    Seats: l.maxSeats,
    Platform: l.platform,
    Expires: l.expiresAt ? new Date(l.expiresAt).toLocaleDateString('id-ID') : 'Permanen',
    ID: l.id
  })));
}

async function issueLicense(email: string, grantDays: number = 365, maxSeats: number = 3) {
  console.log(`📝 Menerbitkan lisensi baru untuk: ${email} (${grantDays} hari, ${maxSeats} seats)...`);
  const url = `${BASE_URL}/api/v1/s2s/licenses/issue`;
  const body = {
    appId: APP_ID,
    customerEmail: email,
    grantDays,
    maxSeats,
    platform: 'desktop',
    features: {
      pos_unlimited: true,
      reports_full: true,
      cloud_sync: true
    },
    licenseVersion: 1
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json() as any;

  if (!res.ok || !data.success) {
    console.error('❌ Gagal menerbitkan lisensi:', data);
    return;
  }

  const lic = data.license;
  console.log('\n🎉 LISENSI BERHASIL DITERBITKAN:');
  console.log('----------------------------------------------------');
  console.log(`  🔑 License Key : ${lic.licenseKey}`);
  console.log(`  📧 Email       : ${lic.customerEmail}`);
  console.log(`  💻 Max Seats   : ${lic.maxSeats}`);
  console.log(`  📅 Berlaku s/d : ${lic.expiresAt}`);
  console.log(`  🏷️ App ID      : ${lic.appId}`);
  console.log('----------------------------------------------------\n');
}

async function revokeLicense(licenseKey: string, reason: string = 'Dicabut oleh administrator') {
  console.log(`⚠️ Mencabut lisensi: ${licenseKey} (Alasan: ${reason})...`);
  const url = `${BASE_URL}/api/v1/s2s/licenses/revoke`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ licenseKey, reason })
  });
  const data = await res.json() as any;

  if (!res.ok) {
    console.error('❌ Gagal mencabut lisensi:', data);
    return;
  }
  console.log(`✅ Lisensi ${licenseKey} berhasil dicabut.`);
}

async function releaseSeat(licenseKey: string, hwid: string) {
  console.log(`🔓 Melepas seat perangkat (${hwid}) dari lisensi: ${licenseKey}...`);
  const url = `${BASE_URL}/api/v1/s2s/licenses/seat/release`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ licenseKey, hwid })
  });
  const data = await res.json() as any;

  if (!res.ok) {
    console.error('❌ Gagal melepas seat:', data);
    return;
  }
  console.log(`✅ Perangkat ${hwid} berhasil dilepaskan dari lisensi ${licenseKey}.`);
}

// CLI Arg Parsing
const [,, command, ...args] = process.argv;

switch (command) {
  case 'list':
    await listLicenses(args[0] || APP_ID);
    break;
  case 'issue':
    if (!args[0]) {
      console.log('Usage: bun run scripts/tertaut-s2s.ts issue <customerEmail> [grantDays] [maxSeats]');
      process.exit(1);
    }
    await issueLicense(args[0], Number(args[1]) || 365, Number(args[2]) || 3);
    break;
  case 'revoke':
    if (!args[0]) {
      console.log('Usage: bun run scripts/tertaut-s2s.ts revoke <licenseKey> [reason]');
      process.exit(1);
    }
    await revokeLicense(args[0], args[1]);
    break;
  case 'release':
    if (!args[0] || !args[1]) {
      console.log('Usage: bun run scripts/tertaut-s2s.ts release <licenseKey> <hwid>');
      process.exit(1);
    }
    await releaseSeat(args[0], args[1]);
    break;
  default:
    console.log(`
🛠️  Sirka POS Suite - Tertaut.com S2S License Manager CLI
-----------------------------------------------------------
Command:
  list                          Melihat semua lisensi aktif
  issue <email> [days] [seats]  Menerbitkan lisensi baru
  revoke <key> [reason]         Mencabut lisensi
  release <key> <hwid>          Melepaskan seat perangkat pelanggan

Contoh:
  bun run scripts/tertaut-s2s.ts list
  bun run scripts/tertaut-s2s.ts issue toko@example.com 365 3
`);
}
