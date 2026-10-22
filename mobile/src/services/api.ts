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

export const DEFAULT_API_URL = 'https://sirka-owner-api.irudsa.workers.dev';

const TOKEN_STORAGE_KEY = 'sirka_owner_api_token';

function getBaseApiUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sirka_owner_api_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  return DEFAULT_API_URL;
}

/**
 * Token akses Worker (`OWNER_SECRET_KEY`).
 *
 * BUG FIX (SEC-3): Worker sekarang MENEGAKKAN token akses. Tanpa header ini
 * semua endpoint /api/* akan membalas 401. Token disimpan **terenkripsi**
 * (AES-GCM memakai kunci kripto privat perangkat) sehingga tidak ada token
 * plaintext di localStorage.
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
    // BUG FIX: `monthSales`/`monthProfit` sebelumnya memakai hasil laporan
    // HARI INI (periode 'today') sehingga angka bulanan di dashboard sama
    // persis dengan angka harian. Sekarang laporan bulan diambil terpisah.
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
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/financial-report?period=${period}` : `/api/owner/financial-report?period=${period}`;
    const res = await apiFetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat laporan keuangan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getSales(filter?: { dateRange?: string; dateTo?: string; status?: string }): Promise<SaleTransaction[]> {
    const base = getBaseApiUrl();
    // BUG FIX: filter (rentang tanggal & status) sebelumnya diabaikan sehingga
    // halaman "Penjualan" selalu menampilkan seluruh data.
    const params = new URLSearchParams();
    if (filter?.dateRange) params.set('dateRange', filter.dateRange);
    if (filter?.dateTo) params.set('dateTo', filter.dateTo);
    if (filter?.status) params.set('status', filter.status);
    const qs = params.toString();
    const endpoint = base
      ? `${base}/api/sales${qs ? `?${qs}` : ''}`
      : `/api/owner/sales${qs ? `?${qs}` : ''}`;
    const res = await apiFetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat transaksi penjualan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getInventoryValuation(): Promise<StockValuationItem[]> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/inventory-valuation` : `/api/owner/inventory-valuation`;
    const res = await apiFetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat valuasi persediaan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getPurchases(): Promise<PurchaseReceipt[]> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/purchases` : `/api/owner/purchases`;
    const res = await apiFetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat data kulakan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getSettings(): Promise<Record<string, string>> {
    try {
      const base = getBaseApiUrl();
      const endpoint = base ? `${base}/api/settings` : `/api/owner/settings`;
      const res = await apiFetch(endpoint);
      if (!res.ok) {
        return {};
      }
      return await res.json();
    } catch {
      return {};
    }
  },

  async getProductsIntelligence(): Promise<ProductsIntelligenceReport> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/analytics/products-intelligence` : `/api/owner/analytics/products-intelligence`;
    const res = await apiFetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat intelijen produk: ${res.statusText}`);
    }
    return await res.json();
  },

  async getSalesPatterns(): Promise<SalesPatternsReport> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/analytics/sales-patterns` : `/api/owner/analytics/sales-patterns`;
    const res = await apiFetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat pola penjualan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getReceivablesAging(): Promise<ReceivablesAgingReport> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/analytics/receivables-aging` : `/api/owner/analytics/receivables-aging`;
    const res = await apiFetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat aging piutang: ${res.statusText}`);
    }
    return await res.json();
  },

  async getShifts(): Promise<any[]> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/shifts` : `/api/owner/shifts`;
    const res = await apiFetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat rekap shift kasir: ${res.statusText}`);
    }
    return await res.json();
  },

  async testDbConnection(apiUrl?: string): Promise<{ success: boolean; message: string }> {
    const base = (apiUrl || getBaseApiUrl()).replace(/\/+$/, '');
    const endpoint = base ? `${base}/api/test-connection` : `/api/owner/test-connection`;
    try {
      const res = await apiFetch(endpoint, { method: 'POST' });
      const data = await res.json();
      return {
        success: res.ok && data.success !== false,
        message: data.message || (res.ok ? 'Terhubung dengan sukses ke API Worker' : (data.error || 'Gagal koneksi')),
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Gagal menghubungi server API' };
    }
  },

  /**
   * Cek apakah proteksi token Worker aktif.
   * BUG FIX: aplikasi mobile perlu memberi tahu owner kalau endpoint-nya
   * masih terbuka (OWNER_SECRET_KEY belum diset di Worker).
   */
  async checkAuthMode(): Promise<{ authEnabled: boolean; reachable: boolean }> {
    const base = getBaseApiUrl();
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

