export interface CashierShift {
  id: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  startingCash: number;
  cashSales: number;
  nonCashSales: number;
  cashInflow?: number;         // Pemasukan non-penjualan (tip, infaq, donasi pelanggan)
  cashOutflow: number;         // Pengeluaran operasional / biaya kasir
  refundOutflow?: number;      // Total pengeluaran pengembalian dana (refund)
  expectedCash: number;
  actualCash?: number;
  discrepancy?: number;
  transferredToTreasury?: number; // Jumlah disetor ke bendahara
  retainedInDrawer?: number;      // Sisa modal di laci kasir untuk shift selanjutnya
  notes?: string;
  status: 'OPEN' | 'CLOSED';
  createdAt?: string;
}
