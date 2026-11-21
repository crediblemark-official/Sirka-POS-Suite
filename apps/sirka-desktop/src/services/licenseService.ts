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

const CONFIG_STORAGE_KEY = 'sirka_pos_tertaut_config_v2';
export const DEFAULT_TERTAUT_APP_ID = 'app_2ee4f785d508';
export const DEFAULT_TERTAUT_PUBLISHABLE_KEY = 'tt_live_b708848eca167fd14d403c5dda7a42a5';
export const DEFAULT_TERTAUT_SECRET_KEY = 'tt_secret_7844a376ab63eea279d88d6db63d2f6b80befee7de7213a4';
export const DEFAULT_TERTAUT_SLUG = 'kasir-sirka-pos-suite';
export const DEFAULT_TERTAUT_PRICE = 135000;
export const DEFAULT_TERTAUT_BASE_URL = 'https://tertaut.com';

function normalizeBaseUrl(rawUrl?: string): string {
  let url = (rawUrl || DEFAULT_TERTAUT_BASE_URL).trim().replace(/\/+$/, '');
  if (url.endsWith('/api/v1')) {
    url = url.slice(0, -7);
  }
  return url || DEFAULT_TERTAUT_BASE_URL;
}

/**
 * Mendapatkan konfigurasi API Tertaut aktif.
 * Di mode produksi (build CI/CD): murni menggunakan nilai dari env variables.
 * Di mode dev: localStorage dapat digunakan untuk pengujian kustom.
 */
export function getTertautConfig(): TertautApiConfig {
  const envApiKey = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_TERTAUT_PUBLISHABLE_KEY || import.meta.env?.VITE_TERTAUT_API_KEY)) || DEFAULT_TERTAUT_PUBLISHABLE_KEY;
  const envSecretKey = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_TERTAUT_SECRET_KEY || import.meta.env?.TERTAUT_SECRET_KEY)) || DEFAULT_TERTAUT_SECRET_KEY;
  const envAppId = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TERTAUT_APP_ID) || DEFAULT_TERTAUT_APP_ID;
  const envBaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TERTAUT_BASE_URL) || DEFAULT_TERTAUT_BASE_URL;
  const envSlug = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TERTAUT_SLUG) || DEFAULT_TERTAUT_SLUG;
  const envPrice = Number(typeof import.meta !== 'undefined' && import.meta.env?.VITE_TERTAUT_PRICE) || DEFAULT_TERTAUT_PRICE;

  // Di mode produksi, selalu gunakan konfigurasi murni dari env (disuntikkan saat build CI/CD)
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    return {
      apiKey: envApiKey,
      secretKey: envSecretKey,
      appId: envAppId,
      baseUrl: normalizeBaseUrl(envBaseUrl),
      slug: envSlug,
      targetPrice: envPrice
    };
  }

  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(CONFIG_STORAGE_KEY) : null;
  const parsed = safeParse<Partial<TertautApiConfig>>(saved, {}, 'TertautConfig');

  return {
    apiKey: parsed.apiKey || envApiKey,
    secretKey: parsed.secretKey || envSecretKey,
    appId: parsed.appId || envAppId,
    baseUrl: normalizeBaseUrl(parsed.baseUrl || envBaseUrl),
    slug: parsed.slug || envSlug,
    targetPrice: parsed.targetPrice || envPrice
  };
}

/**
 * Menyimpan konfigurasi API Tertaut baru ke local storage.
 */
export function saveTertautConfig(config: Partial<TertautApiConfig>): TertautApiConfig {
  const current = getTertautConfig();
  const updated: TertautApiConfig = {
    apiKey: (config.apiKey !== undefined ? config.apiKey : current.apiKey).trim(),
    secretKey: (config.secretKey !== undefined ? config.secretKey : current.secretKey)?.trim(),
    appId: (config.appId !== undefined ? config.appId : current.appId).trim(),
    baseUrl: normalizeBaseUrl(config.baseUrl !== undefined ? config.baseUrl : current.baseUrl),
    slug: (config.slug !== undefined ? config.slug : current.slug)?.trim() || DEFAULT_TERTAUT_SLUG,
    targetPrice: config.targetPrice !== undefined ? config.targetPrice : current.targetPrice
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

  if ((!config.apiKey || !config.appId) && typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    console.warn('[Tertaut Licensing] Peringatan: VITE_TERTAUT_PUBLISHABLE_KEY atau VITE_TERTAUT_APP_ID belum diisi di file .env');
  }

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

function detectPlatform(): 'android' | 'desktop' {
  if (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)) {
    return 'android';
  }
  return 'desktop';
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
    platform?: 'android' | 'desktop';
    config?: Partial<TertautApiConfig>;
  }): Promise<LicenseCheckResult> {
    const client = createTertautClient(payload.config);
    return await client.licensing.check({
      licenseKey: payload.licenseKey.trim(),
      hwid: payload.hwid,
      offlineToken: payload.offlineToken || undefined,
      allowOfflineFallback: payload.allowOfflineFallback !== false,
      appVersion: payload.appVersion || '0.2.7',
      platform: payload.platform || detectPlatform()
    });
  },

  /**
   * Validasi online penuh untuk memperbarui token offline grace Ed25519 yang terotasi.
   */
  async validate(payload: {
    licenseKey: string;
    hwid: string;
    appVersion?: string;
    platform?: 'android' | 'desktop';
    config?: Partial<TertautApiConfig>;
  }): Promise<LicenseValidateResult> {
    const client = createTertautClient(payload.config);
    return await client.licensing.validate({
      licenseKey: payload.licenseKey.trim(),
      hardwareId: payload.hwid,
      appVersion: payload.appVersion || '0.2.7',
      platform: payload.platform || detectPlatform()
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
   * Mengambil URL checkout resmi Tertaut (https://tertaut.com/pay/:slug).
   */
  getOfficialCheckoutUrl(slug?: string): string {
    const config = getTertautConfig();
    const appSlug = slug || config.slug || DEFAULT_TERTAUT_SLUG;
    return `${config.baseUrl}/pay/${appSlug}`;
  },

  /**
   * Mengambil URL checkout MoR (Merchant of Record) di Tertaut untuk pembelian/perpanjangan lisensi.
   * Mendukung S2S session creation untuk produk dengan mode "Harga: Dinamis S2S" via secret key.
   */
  async createCheckout(options: {
    customerEmail?: string;
    customerName?: string;
    amount?: number;
    paymentRail?: string;
    preferredPaymentChannel?: string;
    vaBank?: string;
    redirectUrl?: string;
    hwid?: string;
    config?: Partial<TertautApiConfig>;
  }): Promise<{
    success: boolean;
    transactionId: string;
    ticket?: string;
    checkoutUrl: string;
    hostedPayUrl?: string;
    amount?: number;
    qrDataUrl?: string;
    paymentCode?: string;
    paymentRail?: string;
    vaBank?: string;
    expiresAt?: string;
    status?: string;
  }> {
    const config = { ...getTertautConfig(), ...options.config };
    const amount = options.amount ?? config.targetPrice ?? DEFAULT_TERTAUT_PRICE;
    const email = (options.customerEmail || 'pos-kasir@sirkapos.com').trim();
    const name = (options.customerName || 'Kasir Sirka POS').trim();
    const secretKey = config.secretKey || DEFAULT_TERTAUT_SECRET_KEY;
    const rail = options.paymentRail || options.preferredPaymentChannel || 'qris';

    // Jika secretKey tersedia, gunakan inisiasi sesi S2S terpercaya (diperlukan untuk produk bertipe Harga Dinamis S2S)
    if (secretKey && secretKey.startsWith('tt_secret_')) {
      const endpoint = `${config.baseUrl}/api/v1/checkout/session`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secretKey}`
        },
        body: JSON.stringify({
          appId: config.appId,
          amount,
          customerEmail: email,
          buyerEmail: email,
          customerName: name,
          paymentRail: rail,
          preferredPaymentChannel: rail,
          vaBank: options.vaBank,
          bank: options.vaBank,
          redirectUrl: options.redirectUrl,
          grantDays: 365,
          metadata: {
            hwid: options.hwid,
            source: 'desktop_pos_client'
          }
        })
      });

      const data = await response.json() as any;
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Gagal membuat sesi pembayaran dinamis via S2S');
      }

      return {
        success: true,
        transactionId: data.transactionId || data.data?.sessionId,
        ticket: data.ticket || data.data?.ticket,
        checkoutUrl: data.checkoutUrl || data.data?.checkoutUrl,
        hostedPayUrl: data.hostedPayUrl || data.data?.hostedPayUrl,
        amount: data.amount || amount,
        qrDataUrl: data.qrDataUrl || data.data?.qrDataUrl,
        paymentCode: data.paymentCode || data.data?.paymentCode,
        paymentRail: data.paymentRail || data.data?.paymentRail || rail,
        vaBank: data.vaBank || data.data?.vaBank || options.vaBank,
        expiresAt: data.expiresAt || data.data?.expiresAt,
        status: 'PENDING'
      };
    }

    // Fallback: Gunakan SDK bawaan untuk produk bertipe harga tetap di dashboard
    const client = createTertautClient(options.config);
    const res = await client.checkout({
      customerEmail: email,
      customerName: name,
      amount,
      paymentRail: rail as any,
      preferredPaymentChannel: rail as any,
      vaBank: options.vaBank,
      redirectUrl: options.redirectUrl,
      autoRedirect: false
    });

    return {
      success: true,
      transactionId: res.transactionId,
      ticket: res.ticket,
      checkoutUrl: res.checkoutUrl,
      hostedPayUrl: (res as any).hostedPayUrl,
      amount: res.amount,
      qrDataUrl: res.qrDataUrl,
      paymentCode: res.paymentCode,
      paymentRail: rail,
      status: 'PENDING'
    };
  },

  /**
   * Mengecek status pembayaran transaksi MoR Checkout di Tertaut.
   */
  async getPaymentStatus(
    transactionId: string,
    ticket?: string,
    config?: Partial<TertautApiConfig>
  ) {
    const client = createTertautClient(config);
    return await client.getPaymentStatus(transactionId, ticket);
  }
};
