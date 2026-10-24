/**
 * Tertaut.com Licensing Service
 * Integrasi client SDK @tertaut/sdk untuk Universal Cryptographic Licensing,
 * offline Ed25519 verification, device seat locking, dan floating lease heartbeat.
 */

import {
  Tertaut,
  TertautError,
  SeatLimitExceededError,
  LicenseExpiredError,
  LicenseRevokedError,
  TertautRateLimitError,
  HeartbeatLeaseError,
  VersionFloorError,
  type LicenseActivateResult,
  type LicenseCheckResult,
  type LicenseValidateResult,
  type HeartbeatSession
} from '@tertaut/sdk';
import type { TertautApiConfig } from '../types/license';
import { safeParse } from '../utils/storage';

const CONFIG_STORAGE_KEY = 'kasir_citra_tertaut_config_v1';

function normalizeBaseUrl(rawUrl?: string): string {
  let url = (rawUrl || 'https://tertaut.com').trim().replace(/\/+$/, '');
  if (url.endsWith('/api/v1')) {
    url = url.slice(0, -7);
  }
  return url || 'https://tertaut.com';
}

/**
 * Mendapatkan konfigurasi API Tertaut aktif.
 * Prioritas: LocalStorage (kustom/pengaturan UI) -> import.meta.env -> Default.
 */
export function getTertautConfig(): TertautApiConfig {
  const envApiKey = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_TERTAUT_PUBLISHABLE_KEY || import.meta.env?.VITE_TERTAUT_API_KEY)) || '';
  const envAppId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TERTAUT_APP_ID) || '';
  const envBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TERTAUT_BASE_URL) || 'https://tertaut.com';


  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(CONFIG_STORAGE_KEY) : null;
  const parsed = safeParse<Partial<TertautApiConfig>>(saved, {}, 'TertautConfig');

  return {
    apiKey: parsed.apiKey || envApiKey || 'tt_live_936e7a6eb89a49ec1ba767b05bece657',
    appId: parsed.appId || envAppId || 'app_d3213dcb32c5',
    baseUrl: normalizeBaseUrl(parsed.baseUrl || envBaseUrl || 'https://tertaut.com')
  };
}

/**
 * Menyimpan konfigurasi API Tertaut baru ke local storage.
 */
export function saveTertautConfig(config: Partial<TertautApiConfig>): TertautApiConfig {
  const current = getTertautConfig();
  const updated: TertautApiConfig = {
    apiKey: (config.apiKey !== undefined ? config.apiKey : current.apiKey).trim(),
    appId: (config.appId !== undefined ? config.appId : current.appId).trim(),
    baseUrl: normalizeBaseUrl(config.baseUrl !== undefined ? config.baseUrl : current.baseUrl)
  };

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}


/**
 * Membuat atau mendapatkan instance client SDK Tertaut.
 */
export function createTertautClient(customConfig?: Partial<TertautApiConfig>): Tertaut {
  const config = { ...getTertautConfig(), ...customConfig };
  return new Tertaut({
    apiKey: config.apiKey,
    appId: config.appId,
    baseUrl: config.baseUrl,
    timeoutMs: 15000
  });
}

/**
 * Mengubah pesan error teknis menjadi pesan yang jelas dan ramah pengguna dalam Bahasa Indonesia.
 */
export function formatLicensingError(err: unknown): string {
  if (err instanceof SeatLimitExceededError) {
    return 'Batas kuota perangkat penuh. Lepas perangkat lain atau hubungi admin.';
  }
  if (err instanceof LicenseExpiredError) {
    return 'Masa berlaku lisensi telah berakhir.';
  }
  if (err instanceof LicenseRevokedError) {
    return 'Lisensi telah dicabut.';
  }
  if (err instanceof HeartbeatLeaseError) {
    return 'Sesi lisensi telah berakhir.';
  }
  if (err instanceof VersionFloorError) {
    const minVer = (err as any).details?.minVersion || 'terbaru';
    return `Aplikasi perlu diperbarui minimal ke versi ${minVer}.`;
  }
  if (err instanceof TertautRateLimitError) {
    return 'Terlalu banyak permintaan. Tunggu sebentar.';
  }
  if (err instanceof TertautError) {
    if (err.code === 'LICENSE_NOT_FOUND') {
      return 'Kode lisensi tidak ditemukan.';
    }
    if (err.code === 'APP_MISMATCH') {
      return 'Kode lisensi tidak cocok untuk aplikasi ini.';
    }
    if (err.code === 'HARDWARE_MISMATCH') {
      return 'Perangkat tidak cocok dengan data lisensi.';
    }
    return err.message || `Kesalahan Lisensi (${err.code || err.status || 'Unknown'})`;
  }
  if (err instanceof Error) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('fetch failed')) {
      return 'Gagal terhubung ke server lisensi.';
    }
    return err.message;
  }
  return String(err || 'Terjadi kesalahan sistem lisensi.');
}

export const licenseService = {
  /**
   * Mengaktivasi lisensi dan mengunci ke perangkat (HWID).
   */
  async activate(payload: {
    licenseKey: string;
    hwid: string;
    deviceName?: string;
    config?: Partial<TertautApiConfig>;
  }): Promise<LicenseActivateResult> {
    const client = createTertautClient(payload.config);
    return await client.licensing.activate({
      licenseKey: payload.licenseKey.trim(),
      hwid: payload.hwid,
      deviceName: payload.deviceName
    });
  },

  /**
   * Memeriksa status lisensi dengan dual-mode:
   * 1. Mencoba validasi online ke server Tertaut.
   * 2. Jika offline/gangguan jaringan dan ada offlineToken, verifikasi kriptografis Ed25519 lokal.
   */
  async check(payload: {
    licenseKey: string;
    hwid: string;
    offlineToken?: string | null;
    allowOfflineFallback?: boolean;
    appVersion?: string;
    config?: Partial<TertautApiConfig>;
  }): Promise<LicenseCheckResult> {
    const client = createTertautClient(payload.config);
    return await client.licensing.check({
      licenseKey: payload.licenseKey.trim(),
      hwid: payload.hwid,
      offlineToken: payload.offlineToken || undefined,
      allowOfflineFallback: payload.allowOfflineFallback !== false,
      appVersion: payload.appVersion || '0.1.0',
      platform: 'desktop'
    });
  },

  /**
   * Validasi online penuh untuk memperbarui token offline grace Ed25519 yang terotasi.
   */
  async validate(payload: {
    licenseKey: string;
    hwid: string;
    appVersion?: string;
    config?: Partial<TertautApiConfig>;
  }): Promise<LicenseValidateResult> {
    const client = createTertautClient(payload.config);
    return await client.licensing.validate({
      licenseKey: payload.licenseKey.trim(),
      hardwareId: payload.hwid,
      appVersion: payload.appVersion || '0.1.0',
      platform: 'desktop'
    });
  },

  /**
   * Melepas kursi perangkat (deactivate seat) agar kuota seat dapat dipakai di PC lain.
   */
  async deactivate(payload: {
    licenseKey: string;
    hwid: string;
    config?: Partial<TertautApiConfig>;
  }): Promise<boolean> {
    const client = createTertautClient(payload.config);
    const result = await client.licensing.deactivate({
      licenseKey: payload.licenseKey.trim(),
      hwid: payload.hwid
    });
    return result.success;
  },

  /**
   * Memulai sesi heartbeat berkala untuk lisensi tipe floating seat.
   */
  startHeartbeatSession(options: {
    licenseKey: string;
    hwid: string;
    leaseKey: string;
    intervalSeconds?: number;
    deviceName?: string;
    onSuccess?: (res: any) => void;
    onLeaseExpired?: (err: Error) => void;
    onError?: (err: Error) => void;
    config?: Partial<TertautApiConfig>;
  }): HeartbeatSession {
    const client = createTertautClient(options.config);
    return client.licensing.startHeartbeatSession({
      licenseKey: options.licenseKey,
      hwid: options.hwid,
      leaseKey: options.leaseKey,
      deviceName: options.deviceName,
      intervalSeconds: options.intervalSeconds || 60,
      autoReacquire: true,
      onSuccess: options.onSuccess,
      onLeaseExpired: options.onLeaseExpired,
      onError: options.onError
    });
  },

  /**
   * Mengambil URL checkout MoR (Merchant of Record) di Tertaut untuk pembelian/perpanjangan lisensi.
   */
  async createCheckout(options: {
    customerEmail: string;
    customerName?: string;
    amount?: number;
    redirectUrl?: string;
    config?: Partial<TertautApiConfig>;
  }) {
    const client = createTertautClient(options.config);
    return await client.checkout({
      customerEmail: options.customerEmail,
      customerName: options.customerName,
      amount: options.amount,
      redirectUrl: options.redirectUrl,
      autoRedirect: false
    });
  }
};
