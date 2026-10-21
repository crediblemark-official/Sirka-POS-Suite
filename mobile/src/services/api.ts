import type { 
  FinancialReport, 
  SaleTransaction, 
  StockValuationItem, 
  PurchaseReceipt,
  ProductsIntelligenceReport,
  SalesPatternsReport,
  ReceivablesAgingReport
} from '../types';

export const DEFAULT_API_URL = 'https://sirka-owner-api.irudsa.workers.dev';

function getBaseApiUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sirka_owner_api_url');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  }
  return DEFAULT_API_URL;
}

export const ownerApi = {
  async getMetrics(): Promise<any> {
    const report = await this.getFinancialReport('today');
    return {
      todaySales: report.netSales,
      todayProfit: report.grossProfit,
      todayOrders: report.totalTransactions,
      monthSales: report.netSales,
      monthProfit: report.grossProfit,
      pendingReceivables: report.pendingReceivables,
    };
  },

  async getStockAlerts(): Promise<any> {
    return this.getInventoryValuation();
  },

  async getFinancialReport(period: 'today' | 'week' | 'month' | 'year' = 'month'): Promise<FinancialReport> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/financial-report?period=${period}` : `/api/owner/financial-report?period=${period}`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat laporan keuangan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getSales(filter?: { dateRange?: string; status?: string }): Promise<SaleTransaction[]> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/sales` : `/api/owner/sales`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat transaksi penjualan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getInventoryValuation(): Promise<StockValuationItem[]> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/inventory-valuation` : `/api/owner/inventory-valuation`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat valuasi persediaan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getPurchases(): Promise<PurchaseReceipt[]> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/purchases` : `/api/owner/purchases`;
    const res = await fetch(endpoint);
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
      const res = await fetch(endpoint);
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
    const res = await fetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat intelijen produk: ${res.statusText}`);
    }
    return await res.json();
  },

  async getSalesPatterns(): Promise<SalesPatternsReport> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/analytics/sales-patterns` : `/api/owner/analytics/sales-patterns`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat pola penjualan: ${res.statusText}`);
    }
    return await res.json();
  },

  async getReceivablesAging(): Promise<ReceivablesAgingReport> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/analytics/receivables-aging` : `/api/owner/analytics/receivables-aging`;
    const res = await fetch(endpoint);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Gagal memuat aging piutang: ${res.statusText}`);
    }
    return await res.json();
  },

  async getShifts(): Promise<any[]> {
    const base = getBaseApiUrl();
    const endpoint = base ? `${base}/api/shifts` : `/api/owner/shifts`;
    const res = await fetch(endpoint);
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
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      return {
        success: res.ok && data.success !== false,
        message: data.message || (res.ok ? 'Terhubung dengan sukses ke API Worker' : (data.error || 'Gagal koneksi')),
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Gagal menghubungi server API' };
    }
  }
};

