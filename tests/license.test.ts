import { describe, expect, test, beforeEach } from 'bun:test';
import { setActivePinia, createPinia } from 'pinia';
import {
  getOrCreateHwid,
  getDeviceName,
  setDeviceName,
  getTertautConfig,
  saveTertautConfig,
  formatLicensingError,
  useLicenseStore
} from '@sirka/shared-core';
import {
  SeatLimitExceededError,
  LicenseExpiredError,
  LicenseRevokedError,
  TertautRateLimitError,
  TertautError
} from '@tertaut/sdk';
import type { LicenseStatus } from '@sirka/shared-types';


const licenseStorageKeys = [
  'kasir_citra_hwid_v1',
  'kasir_citra_device_name_v1',
  'kasir_citra_machine_seed',
  'kasir_citra_license_data_v1',
  'kasir_citra_tertaut_config_v1'
];

function resetStorage() {
  if (typeof localStorage !== 'undefined') {
    if (typeof localStorage.clear === 'function') {
      try {
        localStorage.clear();
      } catch {}
    }
    for (const k of licenseStorageKeys) {
      localStorage.removeItem(k);
    }
  }
}

if (typeof globalThis.localStorage === 'undefined') {
  const map = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => map.set(key, value),
      removeItem: (key: string) => map.delete(key),
      clear: () => map.clear(),
    },
    configurable: true
  });
}

describe('Sistem Lisensi Tertaut.com - HWID & Device Binding', () => {
  beforeEach(() => {
    resetStorage();
  });



  test('getOrCreateHwid menghasilkan HWID dengan format HWID-XXXX-XXXX-XXXX-XXXX', async () => {
    const hwid = await getOrCreateHwid();
    expect(hwid).toMatch(/^HWID-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  test('getOrCreateHwid konsisten dan idempoten pada pemanggilan berulang', async () => {
    const hwid1 = await getOrCreateHwid();
    const hwid2 = await getOrCreateHwid();
    expect(hwid1).toBe(hwid2);
  });

  test('getDeviceName dan setDeviceName mengelola nama perangkat kustom', () => {
    const initial = getDeviceName();
    expect(initial).toContain('Kasir');

    setDeviceName('POS Kasir 02 - Meja Depan');
    expect(getDeviceName()).toBe('POS Kasir 02 - Meja Depan');
  });
});

describe('Sistem Lisensi Tertaut.com - Konfigurasi & Error Mapping', () => {
  beforeEach(() => {
    resetStorage();
  });

  test('getTertautConfig membaca nilai default/env dan saveTertautConfig menyimpannya', () => {

    const config = getTertautConfig();
    expect(config.baseUrl).toContain('tertaut.com');
    expect(config.appId).toBeDefined();

    saveTertautConfig({
      appId: 'app_test_citra',
      apiKey: 'tt_test_sample_key',
      baseUrl: 'https://tertaut.com/'
    });

    const updated = getTertautConfig();
    expect(updated.appId).toBe('app_test_citra');
    expect(updated.apiKey).toBe('tt_test_sample_key');
    expect(updated.baseUrl).toBe('https://tertaut.com'); // trailing slash removed
  });

  test('formatLicensingError menerjemahkan error SDK ke Bahasa Indonesia yang ramah', () => {
    const seatErr = new SeatLimitExceededError('seats full', { reason: 'SEAT_FULL' });
    expect(formatLicensingError(seatErr)).toContain('kuota perangkat');

    const expErr = new LicenseExpiredError('expired', { reason: 'EXPIRED' });
    expect(formatLicensingError(expErr)).toContain('Masa berlaku');

    const revErr = new LicenseRevokedError('revoked', { reason: 'REVOKED' });
    expect(formatLicensingError(revErr)).toContain('dicabut');

    const rateErr = new TertautRateLimitError('rate limit', { retryAfter: 60, reason: 'RATE_LIMIT_EXCEEDED' });
    expect(formatLicensingError(rateErr)).toContain('Terlalu banyak permintaan');

    const customErr = new TertautError('App mismatch', { code: 'APP_MISMATCH', status: 400 });
    expect(formatLicensingError(customErr)).toContain('tidak cocok');
  });


});

describe('Sistem Lisensi Tertaut.com - Pinia LicenseStore', () => {
  beforeEach(() => {
    resetStorage();
    setActivePinia(createPinia());
  });



  test('initial state adalah UNREGISTERED dengan isLicensed bernilai false', () => {
    const store = useLicenseStore();
    expect(store.status).toBe('UNREGISTERED');
    expect(store.isLicensed).toBe(false);
    expect(store.licenseKey).toBe('');
    expect(store.maskedLicenseKey).toBe('-');
  });

  test('maskedLicenseKey menyamarkan bagian tengah kunci lisensi', () => {
    const store = useLicenseStore();
    store.licenseKey = 'TT-ABCD-EFGH-1234';
    expect(store.maskedLicenseKey).toBe('TT-••••-••••-1234');
  });

  test('deactivate mereset status lisensi lokal ke UNREGISTERED', async () => {
    const store = useLicenseStore();
    store.licenseKey = 'TT-ABCD-EFGH-1234';
    store.status = 'ACTIVE';
    store.isValid = true;
    store.offlineToken = 'mock_offline_token_jwt';

    expect(store.isLicensed).toBe(true);

    const res = await store.deactivate();
    expect(res.success).toBe(true);
    expect<LicenseStatus>(store.status).toBe('UNREGISTERED');
    expect(store.isValid).toBe(false);
    expect(store.licenseKey).toBe('');
    expect(store.offlineToken).toBeNull();

  });

  test('statusLabel dan statusBadgeClass menyesuaikan dengan mode offline/online', () => {
    const store = useLicenseStore();

    store.status = 'ACTIVE';
    store.isValid = true;
    store.source = 'online';
    expect(store.statusLabel).toContain('Online');

    store.source = 'offline';
    expect(store.statusLabel).toContain('Offline');

    store.status = 'EXPIRED';
    expect(store.statusLabel).toContain('Berakhir');
  });

  test('penguncian fitur saat belum berlisensi (openLicenseModal dengan alasan)', () => {
    const store = useLicenseStore();
    store.isValid = false;
    store.status = 'UNREGISTERED';

    expect(store.isLicensed).toBe(false);
    expect(store.showModal).toBe(false);

    store.openLicenseModal('Fitur terkunci. Harap aktivasi lisensi.');
    expect(store.showModal).toBe(true);
    expect(store.errorMessage).toBe('Fitur terkunci. Harap aktivasi lisensi.');

    store.closeLicenseModal();
    expect(store.showModal).toBe(false);
  });
});
