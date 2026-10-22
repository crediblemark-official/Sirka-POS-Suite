export interface DashboardMetrics {
  todaySales: number;
  todayProfit: number;
  todayOrders: number;
  monthSales: number;
  monthProfit: number;
  pendingReceivables: number;
}

export interface StockAlertItem {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  buyPrice: number;
  sellPrice: number;
}

export interface FinancialReport {
  periodLabel: string;
  // Pendapatan Penjualan
  grossSales: number;
  discounts: number;
  netSales: number;
  
  // Harga Pokok Penjualan (HPP)
  cogs: number;
  
  // Laba Kotor
  grossProfit: number;
  profitMarginPercent: number;
  
  // Arus Kas Operasional (Cash Flow)
  cashInflow: number;
  transferInflow: number;
  cashOutflowPurchases: number;
  netCashFlow: number;

  // Posisi Keuangan (Neraca Ringkas)
  pendingReceivables: number; // Piutang Tempo belum cair
  inventoryAssetValue: number; // Nilai Aset Stok Barang di Toko
  
  // Statistik Operasional
  totalTransactions: number;
  averageTicketSize: number;
}

export interface SaleItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  sellPrice: number;
  /**
   * BUG FIX: nama field di database adalah `subtotalSell`
   * (src/types/index.ts — CartItem.subtotalSell). Sebelumnya mobile memakai
   * `subtotal` yang tidak pernah ada -> setiap baris faktur menampilkan Rp 0.
   */
  subtotalSell?: number;
  subtotal?: number;
}

export interface SaleTransaction {
  id: string;
  invoiceNo: string;
  date: string;
  time: string;
  buyer: string;
  market: 'B2C' | 'B2B';
  totalAmount: number;
  cogs: number;
  profit: number;
  paymentMethod: string;
  /** BUG FIX: nilai di database adalah 'LUNAS' / 'TEMPO' (upper case). */
  paymentStatus: 'LUNAS' | 'TEMPO' | 'Batal' | string;
  itemsCount: number;
  items?: SaleItem[];
}

export interface StockValuationItem {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  assetValue: number; // stock * buyPrice
}

export interface PurchaseReceipt {
  id: string;
  invoiceNo: string;
  date: string;
  supplier: string;
  totalBuy: number;
  itemCount: number;
}

export interface ProductIntelligenceItem {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  buyPrice: number;
  sellPrice: number;
  capitalLocked: number;
  sold30d: number;
  revenue30d: number;
  profit30d: number;
  marginPct: number;
  velocityStatus: 'DEAD_STOCK' | 'FAST_MOVING' | 'SLOW_MOVING';
}

export interface ProductsIntelligenceReport {
  totalCapitalLocked: number;
  totalDeadStockSkus: number;
  fastMovingSkus: number;
  items: ProductIntelligenceItem[];
}

export interface SalesPatternHourly {
  hour: number;
  txCount: number;
  revenue: number;
  aov: number;
}

export interface SalesPatternDay {
  dayName: string;
  dow: number;
  txCount: number;
  revenue: number;
}

export interface SalesPatternsReport {
  totalTransactions: number;
  totalSales: number;
  averageTicket: number;
  hourly: SalesPatternHourly[];
  days: SalesPatternDay[];
}

export interface ReceivablesAgingItem {
  id: string;
  invoiceNo: string;
  buyer: string;
  date: string;
  amount: number;
  ageDays: number;
  agingBucket: '0_7_DAYS' | '8_14_DAYS' | '15_30_DAYS' | 'OVER_30_DAYS';
}

export interface ReceivablesAgingReport {
  totalPending: number;
  totalInvoices: number;
  bucket0_7: number;
  bucket8_14: number;
  bucket15_30: number;
  bucketOver30: number;
  items: ReceivablesAgingItem[];
}

export type ActiveTab = 'reports' | 'income_statement' | 'cash_flow' | 'receivables' | 'inventory_asset' | 'settings';

