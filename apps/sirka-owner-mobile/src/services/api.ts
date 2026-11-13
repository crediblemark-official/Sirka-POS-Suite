import { invoke } from '@tauri-apps/api/core';
import type {
  FinancialReport,
  SaleTransaction,
  StockValuationItem,
  PurchaseReceipt,
  ProductsIntelligenceReport,
  SalesPatternsReport,
  ReceivablesAgingReport
} from '../types';
import { getApiTokenSecure, saveApiTokenSecure } from '../composables/useDeviceAuth';

export const DEFAULT_API_URL = '';

const TOKEN_STORAGE_KEY = 'sirka_owner_api_token';

export function isPostgresUrl(url: string): boolean {
  return /^postgres(ql)?:\/\//i.test((url || '').trim());
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function getBaseApiUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sirka_owner_api_url');
    if (saved && saved.trim()) {
      const trimmed = saved.trim();
      return isPostgresUrl(trimmed) ? trimmed : trimmed.replace(/\/+$/, '');
    }
  }
  return DEFAULT_API_URL;
}

function requireBaseUrl(): string {
  const base = getBaseApiUrl();
  if (!base) {
    throw new Error(
      'URL Server belum diatur. Buka tab "Setelan" lalu isi URL Cloudflare Worker (https://...) atau URL PostgreSQL (postgresql://...).'
    );
  }
  return base;
}

function assertTauriForDirectPg(): void {
  if (!isTauriRuntime()) {
    throw new Error(
      'Koneksi PostgreSQL langsung (postgresql://) hanya berjalan di aplikasi native (Android APK / Desktop). Untuk akses via browser web, gunakan URL Cloudflare Worker (https://...).'
    );
  }
}

/**
 * Token akses Worker (`OWNER_SECRET_KEY`).
 * Disimpan terenkripsi (AES-GCM memakai kunci kripto privat perangkat).
 */
async function getApiToken(): Promise<string> {
  try {
    return await getApiTokenSecure();
  } catch {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
  }
}

/** Header standar untuk semua request ke Worker. */
async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await getApiToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/**
 * Wrapper fetch yang menambahkan header autentikasi & memberi pesan error
 * yang jelas (termasuk 401 Unauthorized).
 */
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(await authHeaders()), ...(init.headers || {}) },
  });
  if (res.status === 401) {
    throw new Error(
      'Akses ditolak (401). Token API belum benar — buka tab "Setelan" dan isi ' +
      'Token Akses Worker (OWNER_SECRET_KEY).'
    );
  }
  return res;
}

export const ownerApi = {
  async getMetrics(): Promise<any> {
    const [today, month] = await Promise.all([
      this.getFinancialReport('today'),
      this.getFinancialReport('month'),
    ]);
    return {
      todaySales: today.netSales,
      todayProfit: today.grossProfit,
      todayOrders: today.totalTransactions,
      monthSales: month.netSales,
      monthProfit: month.grossProfit,
      pendingReceivables: today.pendingReceivables,
    };
  },

  async getStockAlerts(): Promise<any> {
    return this.getInventoryValuation();
  },

  async getFinancialReport(period: 'today' | 'week' | 'month' | 'year' = 'month'): Promise<FinancialReport> {
    const base = requireBaseUrl();
    if (isPostgresUrl(base)) {
      assertTauriForDirectPg();
      return await invoke<FinancialReport>('get_owner_financial_report', { period, url: base });
    }
    const res = await apiFetch(`${base}/api/financial-report?period=${period}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat laporan keuangan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getSales(filter?: { dateRange?: string; dateTo?: string; status?: string }): Promise<SaleTransaction[]> {
    const base = requireBaseUrl();
    if (isPostgresUrl(base)) {
      assertTauriForDirectPg();
      return await invoke<SaleTransaction[]>('get_owner_sales', { filter: filter || {}, url: base });
    }
    const params = new URLSearchParams();
    if (filter?.dateRange) params.set('dateRange', filter.dateRange);
    if (filter?.dateTo) params.set('dateTo', filter.dateTo);
    if (filter?.status) params.set('status', filter.status);
    const qs = params.toString();
    const res = await apiFetch(`${base}/api/sales${qs ? `?${qs}` : ''}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat transaksi penjualan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getInventoryValuation(): Promise<StockValuationItem[]> {
    const base = requireBaseUrl();
    if (isPostgresUrl(base)) {
      assertTauriForDirectPg();
      return await invoke<StockValuationItem[]>('get_owner_inventory_valuation', { url: base });
    }
    const res = await apiFetch(`${base}/api/inventory-valuation`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat valuasi persediaan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getPurchases(): Promise<PurchaseReceipt[]> {
    const base = requireBaseUrl();
    if (isPostgresUrl(base)) {
      assertTauriForDirectPg();
      return await invoke<PurchaseReceipt[]>('get_owner_purchases', { url: base });
    }
    const res = await apiFetch(`${base}/api/purchases`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat data kulakan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getSettings(): Promise<Record<string, string>> {
    try {
      const base = getBaseApiUrl();
      if (!base) return {};
      if (isPostgresUrl(base)) {
        if (!isTauriRuntime()) return {};
        return await invoke<Record<string, string>>('get_owner_settings', { url: base });
      }
      const res = await apiFetch(`${base}/api/settings`);
      if (!res.ok) {
        return {};
      }
      return await res.json();
    } catch {
      return {};
    }
  },

  async getProductsIntelligence(): Promise<ProductsIntelligenceReport> {
    const base = requireBaseUrl();
    if (isPostgresUrl(base)) {
      assertTauriForDirectPg();
      return await invoke<ProductsIntelligenceReport>('get_owner_products_intelligence', { url: base });
    }
    const res = await apiFetch(`${base}/api/analytics/products-intelligence`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat intelijen produk: ${res.statusText}`);
    }
    return await res.json();
  },

  async getSalesPatterns(): Promise<SalesPatternsReport> {
    const base = requireBaseUrl();
    if (isPostgresUrl(base)) {
      assertTauriForDirectPg();
      return await invoke<SalesPatternsReport>('get_owner_sales_patterns', { url: base });
    }
    const res = await apiFetch(`${base}/api/analytics/sales-patterns`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat pola penjualan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getReceivablesAging(): Promise<ReceivablesAgingReport> {
    const base = requireBaseUrl();
    if (isPostgresUrl(base)) {
      assertTauriForDirectPg();
      return await invoke<ReceivablesAgingReport>('get_owner_receivables_aging', { url: base });
    }
    const res = await apiFetch(`${base}/api/analytics/receivables-aging`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat aging piutang: ${res.statusText}`);
    }
    return await res.json();
  },

  async getShifts(): Promise<any[]> {
    const base = requireBaseUrl();
    if (isPostgresUrl(base)) {
      assertTauriForDirectPg();
      return await invoke<any[]>('get_owner_shifts', { url: base });
    }
    const res = await apiFetch(`${base}/api/shifts`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat rekap shift kasir: ${res.statusText}`);
    }
    return await res.json();
  },

  async testDbConnection(apiUrl?: string): Promise<{ success: boolean; message: string }> {
    const raw = (apiUrl ?? getBaseApiUrl()).trim();
    if (!raw) {
      return {
        success: false,
        message: 'Isi URL Cloudflare Worker (https://...) atau URL PostgreSQL (postgresql://...) terlebih dahulu.',
      };
    }

    if (isPostgresUrl(raw)) {
      if (!isTauriRuntime()) {
        return {
          success: false,
          message:
            'Koneksi PostgreSQL langsung hanya didukung di aplikasi native (APK/Desktop). Di browser web, gunakan URL Cloudflare Worker.',
        };
      }
      try {
        return await invoke<{ success: boolean; message: string }>('test_owner_db_connection', { url: raw });
      } catch (e: any) {
        return { success: false, message: e?.message || String(e) || 'Gagal menghubungi PostgreSQL' };
      }
    }

    const base = raw.replace(/\/+$/, '');
    try {
      const res = await apiFetch(`${base}/api/test-connection`, { method: 'POST' });
      const data = await res.json();
      return {
        success: res.ok && data.success !== false,
        message: data.message || (res.ok ? 'Terhubung dengan sukses ke API Worker' : (data.error || 'Gagal koneksi')),
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Gagal menghubungi server API Worker' };
    }
  },

  async checkAuthMode(): Promise<{ authEnabled: boolean; reachable: boolean }> {
    const base = getBaseApiUrl();
    if (!base) return { authEnabled: false, reachable: false };
    if (isPostgresUrl(base)) {
      return { authEnabled: true, reachable: isTauriRuntime() };
    }
    try {
      const res = await fetch(`${base}/health`);
      if (!res.ok) return { authEnabled: false, reachable: false };
      const data = await res.json();
      return { authEnabled: Boolean(data?.authEnabled), reachable: true };
    } catch {
      return { authEnabled: false, reachable: false };
    }
  },

  /** Simpan token akses Worker di device (terenkripsi bila kunci perangkat aktif). */
  async saveApiToken(token: string): Promise<void> {
    const clean = (token || '').trim();
    if (!clean) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      await saveApiTokenSecure('');
      return;
    }
    await saveApiTokenSecure(clean);
  },

  async getApiToken(): Promise<string> {
    return getApiToken();
  }
};
