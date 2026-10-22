<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLedgerStore } from '../../stores/ledgerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { useShiftStore } from '../../stores/shiftStore';
import { formatRupiah, localTodayStr, localDateOffset, localPreviousMonthStr } from '../../utils/formatters';
import { dbService } from '../../services/dbService';
import MetricStatsStrip, { type MetricStatItem } from '../common/MetricStatsStrip.vue';
import {
  FileSpreadsheet,
  ArrowLeftRight,
  Scale,
  Clock,
  Zap,
  TrendingUp,
  PackageCheck,
  Coins,
  Download,
  AlertTriangle,
  Receipt,
  Percent,
  CheckCircle2,
  ShoppingBag,
  Truck,
  UserCheck,
  ShieldCheck,
  Eye,
  LogIn,
  LogOut,
  Calendar,
  X
} from 'lucide-vue-next';
import * as XLSX from 'xlsx';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const ledgerStore = useLedgerStore();
const inventoryStore = useInventoryStore();
const purchaseStore = usePurchaseStore();
const shiftStore = useShiftStore();

type ReportSubTab = 'pnl' | 'cashflow' | 'balance_sheet' | 'receivables' | 'analytics' | 'shifts';
const activeSubTab = ref<ReportSubTab>('pnl');

// Catatan Keuangan: Inline Expand / Collapse saat diklik
const expandedNotes = ref<Set<string>>(new Set());
function toggleNote(key: string) {
  if (expandedNotes.value.has(key)) {
    expandedNotes.value.delete(key);
  } else {
    expandedNotes.value.add(key);
  }
}
function isNoteExpanded(key: string): boolean {
  return expandedNotes.value.has(key);
}

type DatePeriod = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';
const selectedPeriod = ref<DatePeriod>('month');
const customStartDate = ref<string>(localPreviousMonthStr());
const customEndDate = ref<string>(localTodayStr());

function setPresetPeriod(p: 'today' | 'week' | 'month' | 'all') {
  selectedPeriod.value = p;
  if (p === 'today') {
    customStartDate.value = localTodayStr();
    customEndDate.value = localTodayStr();
  } else if (p === 'week') {
    customStartDate.value = localDateOffset(7);
    customEndDate.value = localTodayStr();
  } else if (p === 'month') {
    customStartDate.value = localPreviousMonthStr();
    customEndDate.value = localTodayStr();
  } else if (p === 'all') {
    customStartDate.value = '';
    customEndDate.value = '';
  }
}

function onDateInput(type: 'start' | 'end', val: string) {
  if (type === 'start') {
    customStartDate.value = val;
  } else {
    customEndDate.value = val;
  }
  selectedPeriod.value = 'custom';
}

// 1. Filter Transactions by Period
const periodTransactions = computed(() => {
  const txs = ledgerStore.transactions;
  if (selectedPeriod.value === 'all' && !customStartDate.value && !customEndDate.value) {
    return txs;
  }

  const start = customStartDate.value;
  const end = customEndDate.value;

  return txs.filter(t => {
    if (start && t.date < start) return false;
    if (end && t.date > end) return false;
    return true;
  });
});

// 2. Financial Metrics (Laba Rugi)
const grossSales = computed(() => periodTransactions.value.reduce((acc, t) => acc + (t.totalSell || 0), 0));
// BUG FIX: diskon poin loyalitas tidak ikut tercermin di `discountAmount`
// (backend menyimpannya terpisah di `pointsDiscount`). Tanpa ini baris P&L
// tidak balance: Gross - Diskon != Net.
const totalDiscounts = computed(() => periodTransactions.value.reduce(
  (acc, t) => acc + (t.discountAmount || 0) + (t.pointsDiscount || 0), 0
));
// BUG FIX: `||` membuat transaksi dengan finalTotal 0 (lunas 100% diskon)
// jatuh kembali ke totalSell sehingga omzet Reported overstated.
const netSales = computed(() => periodTransactions.value.reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));
const totalCogs = computed(() => periodTransactions.value.reduce((acc, t) => acc + (t.totalBuy || 0), 0));
const grossProfit = computed(() => netSales.value - totalCogs.value);
const marginPercent = computed(() => netSales.value > 0 ? (grossProfit.value / netSales.value) * 100 : 0);
const taxUmkmEstimated = computed(() => netSales.value * 0.005); // 0.5% PP 55
const avgTicketSize = computed(() => periodTransactions.value.length > 0 ? netSales.value / periodTransactions.value.length : 0);

// 3. Cash Flow Metrics
const cashInflow = computed(() => {
  return periodTransactions.value
    .filter(t => (t.paymentMethod as string) === 'Tunai / Kas' || (t.paymentMethod as string) === 'Tunai')
    // BUG FIX: transaksi TEMPO (piutang) BELUM menerima uang sehingga tidak
    // boleh dihitung sebagai kas masuk. `nonCashInflow` sudah punya filter ini.
    .filter(t => t.paymentStatus === 'LUNAS')
    .reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
});

const nonCashInflow = computed(() => {
  return periodTransactions.value
    .filter(t => (t.paymentMethod as string) !== 'Tunai / Kas' && (t.paymentMethod as string) !== 'Tunai' && t.paymentStatus === 'LUNAS')
    .reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
});

// BUG FIX: biaya pembelian harus difilter PERIODE yang sama dengan inflow.
// Sebelumnya memakai seluruh riwayat (all-time) sehingga arus kas untuk
// periode pendek selalu negatif besar.
const totalPurchasesCost = computed(() => {
  if (selectedPeriod.value === 'all' && !customStartDate.value && !customEndDate.value) {
    return purchaseStore.purchaseHistory.reduce((acc, p) => acc + (p.totalBuy || 0), 0);
  }

  const start = customStartDate.value;
  const end = customEndDate.value;

  return purchaseStore.purchaseHistory
    .filter(p => {
      if (!p?.date) return false;
      if (start && p.date < start) return false;
      if (end && p.date > end) return false;
      return true;
    })
    .reduce((acc, p) => acc + (p.totalBuy || 0), 0);
});

const netCashFlow = computed(() => (cashInflow.value + nonCashInflow.value) - totalPurchasesCost.value);

// 4. Balance Sheet Metrics (Neraca Posisi Keuangan)
const totalInventoryAssetValuation = computed(() => {
  // BUG FIX: guard `|| 0` supaya 1 produk tanpa harga tidak meracuni seluruh
  // neraca dengan NaN.
  return inventoryStore.products.reduce((acc, p) => acc + ((p.stock || 0) * (p.lastBuyPrice || 0)), 0);
});

const totalReceivables = computed(() => {
  return ledgerStore.transactions
    .filter(t => t.paymentStatus === 'TEMPO')
    .reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
});

const estimatedCashBalance = computed(() => Math.max(0, netCashFlow.value));
const totalCurrentAssets = computed(() => estimatedCashBalance.value + totalReceivables.value + totalInventoryAssetValuation.value);
const totalSupplierPayables = computed(() => 0); // Faktur kulakan tempo yang belum lunas
const netWorthEquity = computed(() => totalCurrentAssets.value - totalSupplierPayables.value);


/**
 * Parse tanggal 'YYYY-MM-DD' sebagai WAKTU LOKAL (bukan UTC).
 * `new Date('2026-10-22')` = UTC midnight -> di WIB mundur 7 jam.
 */
function parseLocalDate(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(dateStr);
}

// 5. Receivables Aging Schedule
const agingReceivables = computed(() => {
  const tempos = ledgerStore.transactions.filter(t => t.paymentStatus === 'TEMPO');
  const now = new Date();

  return tempos.map(t => {
    // BUG FIX: `new Date('2026-10-22')` diparse sebagai UTC midnight, jadi
    // selisihnya membesar 7 jam di WIB -> umur nota naik 1 hari (bucket beda
    // dengan Worker). Selain itu `Math.abs` membuat nota BERJADIL MASA
    // terlihat "MACET (>30 hari)". Sekarang: parse sebagai waktu LOKAL dan
    // umur tidak negatif.
    const txDate = parseLocalDate(t.date);
    const diffTime = Math.max(0, now.getTime() - txDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    let bucket: '0-7' | '8-14' | '15-30' | '>30' = '0-7';
    if (diffDays > 30) bucket = '>30';
    else if (diffDays > 14) bucket = '15-30';
    else if (diffDays > 7) bucket = '8-14';

    return {
      ...t,
      ageDays: diffDays,
      bucket
    };
  });
});

// BUG FIX: `||` membuat piutang dengan finalTotal 0 (lunas 100% diskon)
// hilang dari bucket karena fallback ke totalSell.
const bucket0_7 = computed(() => agingReceivables.value.filter(t => t.bucket === '0-7').reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));
const bucket8_14 = computed(() => agingReceivables.value.filter(t => t.bucket === '8-14').reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));
const bucket15_30 = computed(() => agingReceivables.value.filter(t => t.bucket === '15-30').reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));
const bucketOver30 = computed(() => agingReceivables.value.filter(t => t.bucket === '>30').reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));

// 6. Dead Stock & Product Intelligence
/**
 * BUG FIX: "Dead Stock" sebelumnya hanya = seluruh inventori (filter `stock > 0`),
 * sehingga angkanya identik dengan "Total Persediaan Aset" dan tidak pernah
 * mengukur barang yang tidak bergerak. Sekarang dihitung dari barang yang
 * TIDAK punya pergerakan stok keluar (tidak pernah terjual) dalam periode
 * laporan.
 */
const periodOutsoldProductIds = computed(() => {
  const ids = new Set<string>();
  for (const tx of periodTransactions.value) {
    for (const item of (tx.items || [])) {
      if (item && item.productId) ids.add(item.productId);
    }
  }
  return ids;
});

const deadStockItems = computed(() => {
  const sold = periodOutsoldProductIds.value;
  return inventoryStore.products
    .filter(p => (p.stock || 0) > 0 && !sold.has(p.id))
    .sort((a, b) => ((b.stock || 0) * (b.lastBuyPrice || 0)) - ((a.stock || 0) * (a.lastBuyPrice || 0)));
});

const totalDeadStockCapital = computed(() => {
  return deadStockItems.value.reduce((acc, p) => acc + ((p.stock || 0) * (p.lastBuyPrice || 0)), 0);
});

// Standard MetricStatsStrip definition based on activeSubTab
const metricStats = computed<MetricStatItem[]>(() => {
  if (activeSubTab.value === 'pnl') {
    return [
      {
        label: 'Penjualan Bersih (Omzet)',
        value: `Rp ${formatRupiah(netSales.value)}`,
        sublabel: `${periodTransactions.value.length} Nota`,
        icon: TrendingUp,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-700'
      },
      {
        label: 'Harga Pokok (HPP)',
        value: `Rp ${formatRupiah(totalCogs.value)}`,
        icon: PackageCheck,
        iconBoxClass: 'bg-emerald-50 text-emerald-700',
        valClass: 'text-gray-800'
      },
      {
        label: 'Laba Kotor Operasional',
        value: `+Rp ${formatRupiah(grossProfit.value)}`,
        sublabel: `(+${marginPercent.value.toFixed(1)}%)`,
        icon: Coins,
        iconBoxClass: 'bg-teal-50 text-teal-700',
        valClass: 'text-emerald-700',
        sublabelClass: 'text-emerald-600 font-bold font-mono'
      },
      {
        label: 'Pajak UMKM 0.5% (PP 55)',
        value: `Rp ${formatRupiah(taxUmkmEstimated.value)}`,
        icon: Percent,
        iconBoxClass: 'bg-purple-50 text-purple-700',
        valClass: 'text-purple-800'
      },
      {
        label: 'Rata-rata Nota (AOV)',
        value: `Rp ${formatRupiah(avgTicketSize.value)}`,
        icon: ShoppingBag,
        iconBoxClass: 'bg-indigo-50 text-indigo-700',
        valClass: 'text-indigo-900'
      }
    ];
  } else if (activeSubTab.value === 'cashflow') {
    return [
      {
        label: 'Kas Masuk Tunai',
        value: `Rp ${formatRupiah(cashInflow.value)}`,
        icon: Coins,
        iconBoxClass: 'bg-emerald-50 text-emerald-700',
        valClass: 'text-emerald-700'
      },
      {
        label: 'Kas Masuk Non-Tunai / Bank',
        value: `Rp ${formatRupiah(nonCashInflow.value)}`,
        icon: TrendingUp,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-700'
      },
      {
        label: 'Kas Keluar (Kulakan)',
        value: `Rp ${formatRupiah(totalPurchasesCost.value)}`,
        sublabel: `${purchaseStore.purchaseHistory.length} Faktur`,
        icon: Truck,
        iconBoxClass: 'bg-amber-50 text-amber-700',
        valClass: 'text-amber-800'
      },
      {
        label: 'Arus Kas Bersih (Net Cash)',
        value: `${netCashFlow.value >= 0 ? '+' : ''}Rp ${formatRupiah(netCashFlow.value)}`,
        icon: ArrowLeftRight,
        iconBoxClass: netCashFlow.value >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700',
        valClass: netCashFlow.value >= 0 ? 'text-teal-800' : 'text-red-700'
      }
    ];
  } else if (activeSubTab.value === 'balance_sheet') {
    return [
      {
        label: 'Kas & Bank (Estimasi)',
        value: `Rp ${formatRupiah(estimatedCashBalance.value)}`,
        icon: Coins,
        iconBoxClass: 'bg-emerald-50 text-emerald-700',
        valClass: 'text-emerald-700'
      },
      {
        label: 'Piutang Pelanggan (AR)',
        value: `Rp ${formatRupiah(totalReceivables.value)}`,
        icon: Clock,
        iconBoxClass: 'bg-amber-50 text-amber-700',
        valClass: 'text-amber-800'
      },
      {
        label: 'Persediaan Barang (HPP)',
        value: `Rp ${formatRupiah(totalInventoryAssetValuation.value)}`,
        sublabel: `${inventoryStore.products.length} SKU`,
        icon: PackageCheck,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-700'
      },
      {
        label: 'Total Aktiva Lancar',
        value: `Rp ${formatRupiah(totalCurrentAssets.value)}`,
        icon: Scale,
        iconBoxClass: 'bg-indigo-50 text-indigo-700',
        valClass: 'text-indigo-900 font-bold'
      },
      {
        label: 'Ekuitas Bersih (Net Worth)',
        value: `Rp ${formatRupiah(netWorthEquity.value)}`,
        icon: CheckCircle2,
        iconBoxClass: 'bg-teal-50 text-teal-700',
        valClass: 'text-teal-800 font-bold'
      }
    ];
  } else if (activeSubTab.value === 'receivables') {
    return [
      {
        label: 'Total Piutang Tempo',
        value: `Rp ${formatRupiah(totalReceivables.value)}`,
        sublabel: `${agingReceivables.value.length} Faktur`,
        icon: Clock,
        iconBoxClass: 'bg-amber-50 text-amber-700',
        valClass: 'text-amber-800'
      },
      {
        label: 'Lancar (0-7 Hari)',
        value: `Rp ${formatRupiah(bucket0_7.value)}`,
        icon: CheckCircle2,
        iconBoxClass: 'bg-emerald-50 text-emerald-700',
        valClass: 'text-emerald-700'
      },
      {
        label: 'Normal (8-14 Hari)',
        value: `Rp ${formatRupiah(bucket8_14.value)}`,
        icon: Clock,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-700'
      },
      {
        label: 'Peringatan (15-30 Hari)',
        value: `Rp ${formatRupiah(bucket15_30.value)}`,
        icon: AlertTriangle,
        iconBoxClass: 'bg-yellow-50 text-yellow-800',
        valClass: 'text-yellow-800'
      },
      {
        label: 'Macet (>30 Hari)',
        value: `Rp ${formatRupiah(bucketOver30.value)}`,
        icon: AlertTriangle,
        iconBoxClass: 'bg-red-50 text-red-700',
        valClass: 'text-red-700 font-bold'
      }
    ];
  } else if (activeSubTab.value === 'shifts') {
    // BUG FIX: penjualan tunai dari shift yang MASIH BERJALAN tidak boleh
    // dihitung sebagai "Total Sesi" (hanya shift tertutup yang masuk history).
    const totalCashSalesAllShifts =
      shiftStore.shiftHistory.reduce((acc, s) => acc + (s.cashSales || 0), 0)
      + (shiftStore.isShiftActive ? (shiftStore.currentShift?.cashSales || 0) : 0);
    const totalDiscrepancyAllShifts = shiftStore.shiftHistory.reduce((acc, s) => acc + (s.discrepancy || 0), 0);
    // BUG FIX: `s.discrepancy || 0` menghitung shift yang BELUM pernah
    // direkonsiliasi (discrepancy undefined) sebagai "PAS" -> metrik anti-fraud
    // palsu. Hanya shift yang sudah direkonsiliasi (status CLOSED & ada
    // actualCash) yang boleh dihitung.
    const reconciledShifts = shiftStore.shiftHistory.filter(
      s => s.status === 'CLOSED' && s.actualCash !== undefined && s.actualCash !== null
    );
    const balanceRate = reconciledShifts.length > 0
      ? (reconciledShifts.filter(s => (s.discrepancy || 0) === 0).length / reconciledShifts.length) * 100
      : 0;

    return [
      {
        label: 'Total Sesi Shift',
        value: `${shiftStore.shiftHistory.length} Sesi`,
        sublabel: shiftStore.isShiftActive ? `1 Aktif (${shiftStore.currentShift?.cashierName})` : 'Shift Tutup',
        icon: UserCheck,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-900',
        sublabelClass: shiftStore.isShiftActive ? 'text-emerald-600 font-bold' : 'text-gray-500'
      },
      {
        label: 'Total Penjualan Tunai Laci',
        value: `Rp ${formatRupiah(totalCashSalesAllShifts)}`,
        icon: Coins,
        iconBoxClass: 'bg-emerald-50 text-emerald-700',
        valClass: 'text-emerald-700'
      },
      {
        label: 'Akurasi Kas (Tingkat Pas)',
        value: `${balanceRate.toFixed(0)}%`,
        sublabel: `${reconciledShifts.filter(s => (s.discrepancy || 0) === 0).length} dari ${reconciledShifts.length} Shift Terekonsiliasi Cocok`,
        icon: CheckCircle2,
        iconBoxClass: 'bg-teal-50 text-teal-700',
        valClass: 'text-teal-800'
      },
      {
        label: 'Total Net Selisih Kas',
        value: `${totalDiscrepancyAllShifts >= 0 ? '+' : ''}Rp ${formatRupiah(totalDiscrepancyAllShifts)}`,
        sublabel: totalDiscrepancyAllShifts === 0 ? 'Kas Seimbang (Pas)' : totalDiscrepancyAllShifts < 0 ? 'Total Tekor Kas' : 'Total Kelebihan Kas',
        icon: AlertTriangle,
        iconBoxClass: totalDiscrepancyAllShifts === 0 ? 'bg-emerald-50 text-emerald-700' : totalDiscrepancyAllShifts < 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700',
        valClass: totalDiscrepancyAllShifts === 0 ? 'text-emerald-700' : totalDiscrepancyAllShifts < 0 ? 'text-rose-700 font-bold' : 'text-amber-700 font-bold',
        sublabelClass: totalDiscrepancyAllShifts < 0 ? 'text-rose-600 font-semibold' : 'text-gray-500'
      }
    ];
  } else {
    // Analytics (9 Modul Analisis Bisnis)
    return [
      {
        label: 'Modal Terkunci (Dead Stock)',
        value: `Rp ${formatRupiah(totalDeadStockCapital.value)}`,
        sublabel: `${deadStockItems.value.length} SKU Mati`,
        icon: AlertTriangle,
        iconBoxClass: 'bg-amber-50 text-amber-700',
        valClass: 'text-amber-800 font-bold'
      },
      {
        label: 'Total Persediaan Aset',
        value: `Rp ${formatRupiah(totalInventoryAssetValuation.value)}`,
        icon: PackageCheck,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-700'
      },
      {
        label: 'Rata-rata Nota Belanja',
        value: `Rp ${formatRupiah(avgTicketSize.value)}`,
        icon: ShoppingBag,
        iconBoxClass: 'bg-indigo-50 text-indigo-700',
        valClass: 'text-indigo-900'
      },
      {
        label: 'Total Transaksi Toko',
        value: `${periodTransactions.value.length} Nota`,
        icon: Receipt,
        iconBoxClass: 'bg-purple-50 text-purple-700',
        valClass: 'text-purple-800'
      }
    ];
  }
});

// Export to Excel handler
async function exportComprehensiveReport() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Laba Rugi & Arus Kas
  const pnlData = [
    ['LAPORAN KEUANGAN & LABA RUGI - KASIR CITRA'],
    ['Periode', selectedPeriod.value === 'custom' ? `${customStartDate.value || '...'} s/d ${customEndDate.value || '...'}` : selectedPeriod.value.toUpperCase()],
    ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
    [],
    ['KOMPONEN', 'NOMINAL (RP)'],
    ['Penjualan Bruto', grossSales.value],
    ['Potongan & Diskon', totalDiscounts.value],
    ['Penjualan Bersih (Omzet)', netSales.value],
    ['Harga Pokok Penjualan (HPP)', totalCogs.value],
    ['Laba Kotor Operasional', grossProfit.value],
    ['Margin Keuntungan (%)', `${marginPercent.value.toFixed(1)}%`],
    ['Estimasi PPh Final UMKM 0.5%', taxUmkmEstimated.value],
    [],
    ['ARUS KAS OPERASIONAL'],
    ['Kas Masuk Tunai', cashInflow.value],
    ['Kas Masuk Non-Tunai / Bank', nonCashInflow.value],
    ['Kas Keluar Pembelian Kulakan', totalPurchasesCost.value],
    ['Arus Kas Bersih (Net Cash Flow)', netCashFlow.value]
  ];
  const wsPnl = XLSX.utils.aoa_to_sheet(pnlData);
  XLSX.utils.book_append_sheet(wb, wsPnl, 'Laba Rugi & Kas');

  // Sheet 2: Neraca Posisi Keuangan
  const bsData = [
    ['NERACA POSISI KEUANGAN (BALANCE SHEET)'],
    ['Tanggal Potret', new Date().toLocaleDateString('id-ID')],
    [],
    ['AKTIVA (ASET TOKO)', 'NOMINAL (RP)'],
    ['Kas & Bank (Estimasi)', estimatedCashBalance.value],
    ['Piutang Dagang Pelanggan', totalReceivables.value],
    ['Persediaan Barang Dagangan (HPP)', totalInventoryAssetValuation.value],
    ['TOTAL AKTIVA LANCAR', totalCurrentAssets.value],
    [],
    ['PASIVA (KEWAJIBAN & EKUITAS)'],
    ['Hutang Supplier (Faktur Tempo)', totalSupplierPayables.value],
    ['EKUITAS BERSIH TOKO (NET WORTH)', netWorthEquity.value]
  ];
  const wsBs = XLSX.utils.aoa_to_sheet(bsData);
  XLSX.utils.book_append_sheet(wb, wsBs, 'Neraca Keuangan');

  // Sheet 3: Umur Piutang
  const arData = [
    ['AGING SCHEDULE PIUTANG PELANGGAN'],
    ['No. Faktur', 'Pelanggan', 'Tanggal Nota', 'Umur (Hari)', 'Kategori Risiko', 'Sisa Tagihan (Rp)'],
    ...agingReceivables.value.map(t => [
      t.invoiceNo,
      t.buyer,
      t.date,
      t.ageDays,
      // BUG FIX: label bucket 8-14 hari di layar adalah "NORMAL" tetapi di
      // export sebelumnya menjadi "LANCAR" -> laporan hasil export berbeda
      // dari tampilan aplikasi.
      t.bucket === '>30' ? 'MACET (>30 HARI)' : (t.bucket === '15-30' ? 'PERINGATAN' : (t.bucket === '8-14' ? 'NORMAL' : 'LANCAR')),
      t.finalTotal || t.totalSell
    ])
  ];
  const wsAr = XLSX.utils.aoa_to_sheet(arData);
  XLSX.utils.book_append_sheet(wb, wsAr, 'Buku Piutang');

  // BUG FIX: `XLSX.writeFile` memakai jalur download browser yang tidak punya
  // handler filesystem di WebView Tauri -> file sering gagal tersimpan tanpa
  // pesan error. Gunakan native save dialog (cmd+Excel) seperti di ledger.
  const filename = `Laporan_Keuangan_Citra_${localTodayStr()}.xlsx`;
  try {
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const msg = await dbService.saveExportFile(filename, Array.from(new Uint8Array(buffer)));
    if (msg) alert(msg);
  } catch (e: any) {
    const errStr = String(e?.message || e);
    if (errStr.includes('CANCELLED')) return; // pengguna membatalkan
    console.warn('Native export fallback ke browser download:', e);
    XLSX.writeFile(wb, filename);
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden font-sans">
    <!-- 1. Top Ribbon Bar (Desktop Native File Explorer Style) -->
    <div class="h-10 relative z-30 flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 select-none shrink-0 gap-2 overflow-x-auto no-scrollbar">
      <!-- Sisi Kiri: Switcher Tab Jenis Laporan (Pill Style Standard) -->
      <div class="flex items-center gap-2 shrink-0">
        <div class="flex bg-gray-200/90 p-0.5 rounded border border-gray-300 shrink-0">
          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            :class="activeSubTab === 'pnl' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeSubTab = 'pnl'"
          >
            <FileSpreadsheet :size="13" />
            <span>Laba Rugi (P&amp;L)</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            :class="activeSubTab === 'cashflow' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeSubTab = 'cashflow'"
          >
            <ArrowLeftRight :size="13" />
            <span>Arus Kas (Buku Kas)</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            :class="activeSubTab === 'balance_sheet' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeSubTab = 'balance_sheet'"
          >
            <Scale :size="13" />
            <span>Neraca Keuangan</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            :class="activeSubTab === 'receivables' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeSubTab = 'receivables'"
          >
            <Clock :size="13" />
            <span>Buku Piutang &amp; Aging</span>
            <span v-if="agingReceivables.length > 0" class="px-1 py-0.2 rounded-full text-[9px] font-mono bg-amber-200 text-amber-900 font-bold">
              {{ agingReceivables.length }}
            </span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            :class="activeSubTab === 'analytics' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeSubTab = 'analytics'"
          >
            <Zap :size="13" />
            <span>9 Modul Analisis Bisnis</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            :class="activeSubTab === 'shifts' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeSubTab = 'shifts'"
          >
            <UserCheck :size="13" />
            <span>Audit Shift Kasir</span>
            <span v-if="shiftStore.isShiftActive" class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>
        </div>
      </div>

      <!-- Sisi Kanan: Period Selector & Export Button -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Preset Switcher -->
        <div class="flex bg-gray-200/90 p-0.5 rounded border border-gray-300 shrink-0">
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
            :class="selectedPeriod === 'today' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="setPresetPeriod('today')"
          >
            Hari Ini
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
            :class="selectedPeriod === 'week' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="setPresetPeriod('week')"
          >
            7 Hari
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
            :class="selectedPeriod === 'month' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="setPresetPeriod('month')"
          >
            Bulan
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer"
            :class="selectedPeriod === 'all' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="setPresetPeriod('all')"
          >
            Semua
          </button>
        </div>

        <!-- Date Picker Selalu Muncul (Always Visible) -->
        <div class="flex items-center gap-1.5 bg-white border border-gray-300 rounded px-2 py-0.5 shadow-2xs shrink-0 text-xs text-gray-600 font-medium">
          <Calendar :size="12" class="text-indigo-600 shrink-0" />
          <input
            type="date"
            :value="customStartDate"
            class="h-6 px-1 text-[11px] bg-transparent border-0 font-mono text-gray-800 focus:outline-none cursor-pointer"
            title="Tanggal Mulai"
            @input="onDateInput('start', ($event.target as HTMLInputElement).value)"
          />
          <span class="text-gray-400 text-[11px]">s/d</span>
          <input
            type="date"
            :value="customEndDate"
            class="h-6 px-1 text-[11px] bg-transparent border-0 font-mono text-gray-800 focus:outline-none cursor-pointer"
            title="Tanggal Selesai"
            @input="onDateInput('end', ($event.target as HTMLInputElement).value)"
          />
          <button
            v-if="selectedPeriod === 'custom' || customStartDate || customEndDate"
            type="button"
            title="Reset ke bulan ini"
            class="p-0.5 rounded text-gray-400 hover:text-rose-600 cursor-pointer"
            @click="setPresetPeriod('month')"
          >
            <X :size="11" />
          </button>
        </div>

        <!-- Tombol Export Excel -->
        <button
          type="button"
          @click="exportComprehensiveReport"
          class="h-7 px-2.5 rounded bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
        >
          <Download :size="13" class="text-emerald-600" />
          <span>Ekspor Excel (.xlsx)</span>
        </button>
      </div>
    </div>

    <!-- 2. Reusable Standard Desktop Metric Stats Strip (DRY) -->
    <MetricStatsStrip :items="metricStats" />

    <!-- 3. Main Workspace: Edge-to-Edge Desktop Table / Form Views -->
    <div class="flex-1 flex flex-col overflow-hidden bg-white">
      <!-- ================= SUB-TAB 1: LABA RUGI (P&L) ================= -->
      <div v-if="activeSubTab === 'pnl'" class="flex-1 overflow-auto">
        <table class="table-explorer w-full">
          <thead>
            <tr>
              <th class="w-12 text-center">NO</th>
              <th class="w-1/3 text-left">KOMPONEN LAPORAN LABA RUGI (SAK EMKM)</th>
              <th class="w-44 text-right">NOMINAL (RUPIAH)</th>
              <th class="w-36 text-right">PERSENTASE (%)</th>
              <th class="text-left">CATATAN KEUANGAN</th>
            </tr>
          </thead>
          <tbody>
            <!-- 1. Pendapatan Penjualan -->
            <tr class="bg-gray-50/80 font-bold">
              <td class="text-center font-mono">1</td>
              <td colspan="4" class="text-indigo-900 uppercase tracking-wider text-[11px]">
                PENDAPATAN USAHA (REVENUE)
              </td>
            </tr>
            <tr class="hover:bg-blue-50/20">
              <td class="text-center font-mono text-gray-400">1.1</td>
              <td class="pl-6 font-semibold">Penjualan Kotor (Gross Sales)</td>
              <td class="text-right font-mono font-bold">{{ formatRupiah(grossSales) }}</td>
              <td class="text-right font-mono text-gray-500">100.0%</td>
              <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('pnl_1_1') ? 'Klik untuk ciutkan' : 'Akumulasi nilai transaksi kasir sebelum diskon (Klik untuk baca penuh)'"
                  @click="toggleNote('pnl_1_1')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('pnl_1_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Akumulasi nilai transaksi kasir sebelum diskon
                  </div>
                </div>
              </td>
            </tr>
            <tr class="hover:bg-blue-50/20 text-red-600">
              <td class="text-center font-mono text-gray-400">1.2</td>
              <td class="pl-6 font-semibold">Potongan &amp; Diskon Promo Penjualan</td>
              <td class="text-right font-mono font-bold">- {{ formatRupiah(totalDiscounts) }}</td>
              <td class="text-right font-mono text-gray-500">
                {{ grossSales > 0 ? ((totalDiscounts / grossSales) * 100).toFixed(1) : 0 }}%
              </td>
              <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('pnl_1_2') ? 'Klik untuk ciutkan' : 'Voucher diskon kupon belanja, potongan harga, dan penukaran poin loyalitas (Klik untuk baca penuh)'"
                  @click="toggleNote('pnl_1_2')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('pnl_1_2') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Voucher diskon kupon belanja, potongan harga, dan penukaran poin loyalitas
                  </div>
                </div>
              </td>
            </tr>
            <tr class="bg-blue-50/40 font-bold border-t border-b border-blue-200">
              <td class="text-center font-mono text-blue-900">1.3</td>
              <td class="pl-6 text-blue-900">TOTAL PENJUALAN BERSIH (NET SALES)</td>
              <td class="text-right font-mono text-blue-900 text-sm font-extrabold">{{ formatRupiah(netSales) }}</td>
              <!-- BUG FIX: kolom persentase sebelumnya hard-coded "100.0%" sehingga
                   kolom tidak pernah menjumlah 100% dan tidak mencerminkan
                   proporsi penjualan bersih terhadap penjualan kotor. -->
              <td class="text-right font-mono text-blue-900 font-bold">
                {{ grossSales > 0 ? ((netSales / grossSales) * 100).toFixed(1) : 0 }}%
              </td>
              <td class="text-blue-800 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('pnl_1_3') ? 'Klik untuk ciutkan' : 'Basis perhitungan omzet riil toko (Klik untuk baca penuh)'"
                  @click="toggleNote('pnl_1_3')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('pnl_1_3') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Basis perhitungan omzet riil toko
                  </div>
                </div>
              </td>
            </tr>

            <!-- 2. Harga Pokok Penjualan -->
            <tr class="bg-gray-50/80 font-bold">
              <td class="text-center font-mono">2</td>
              <td colspan="4" class="text-indigo-900 uppercase tracking-wider text-[11px]">
                HARGA POKOK PENJUALAN (HPP)
              </td>
            </tr>
            <tr class="hover:bg-blue-50/20">
              <td class="text-center font-mono text-gray-400">2.1</td>
              <td class="pl-6 font-semibold">Beban Modal Pembelian Barang Terjual (COGS)</td>
              <td class="text-right font-mono font-bold">{{ formatRupiah(totalCogs) }}</td>
              <td class="text-right font-mono text-gray-500">
                {{ netSales > 0 ? ((totalCogs / netSales) * 100).toFixed(1) : 0 }}%
              </td>
              <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('pnl_2_1') ? 'Klik untuk ciutkan' : 'Stok terjual × HPP kulakan terakhir supplier (Klik untuk baca penuh)'"
                  @click="toggleNote('pnl_2_1')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('pnl_2_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Stok terjual &times; HPP kulakan terakhir supplier
                  </div>
                </div>
              </td>
            </tr>

            <!-- 3. Laba Kotor Operasional -->
            <tr class="bg-emerald-50/70 font-extrabold border-t-2 border-b-2 border-emerald-300">
              <td class="text-center font-mono text-emerald-900">3</td>
              <td class="text-emerald-900 uppercase tracking-wide">
                LABA KOTOR OPERASIONAL (GROSS PROFIT)
              </td>
              <td class="text-right font-mono text-emerald-800 text-base font-extrabold">
                + {{ formatRupiah(grossProfit) }}
              </td>
              <td class="text-right font-mono text-emerald-800 text-sm font-extrabold">
                {{ marginPercent.toFixed(1) }}%
              </td>
              <td class="text-emerald-800 text-[11px] font-semibold max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('pnl_3') ? 'Klik untuk ciutkan' : 'Margin kotor terhadap omzet penjualan (Klik untuk baca penuh)'"
                  @click="toggleNote('pnl_3')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('pnl_3') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Margin kotor terhadap omzet penjualan
                  </div>
                </div>
              </td>
            </tr>

            <!-- 4. Estimasi Pajak & Rekomendasi -->
            <tr class="bg-gray-50/80 font-bold">
              <td class="text-center font-mono">4</td>
              <td colspan="4" class="text-purple-900 uppercase tracking-wider text-[11px]">
                KEWAJIBAN PERPAJAKAN USAHA
              </td>
            </tr>
            <tr class="hover:bg-purple-50/20">
              <td class="text-center font-mono text-gray-400">4.1</td>
              <td class="pl-6 font-semibold">Estimasi PPh Final UMKM 0.5% (PP No. 55 / 2022)</td>
              <td class="text-right font-mono font-bold text-purple-900">{{ formatRupiah(taxUmkmEstimated) }}</td>
              <td class="text-right font-mono text-gray-500">0.5%</td>
              <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('pnl_4_1') ? 'Klik untuk ciutkan' : 'Tarif 0.5% × Omzet Bruto bulanan toko (Klik untuk baca penuh)'"
                  @click="toggleNote('pnl_4_1')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('pnl_4_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Tarif 0.5% &times; Omzet Bruto bulanan toko
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ================= SUB-TAB 2: ARUS KAS (CASH FLOW) ================= -->
      <div v-else-if="activeSubTab === 'cashflow'" class="flex-1 overflow-auto">
        <table class="table-explorer w-full">
          <thead>
            <tr>
              <th class="w-12 text-center">NO</th>
              <th class="w-1/3 text-left">MUTASI ARUS KAS OPERASIONAL</th>
              <th class="w-44 text-right">KAS MASUK (RP)</th>
              <th class="w-44 text-right">KAS KELUAR (RP)</th>
              <th class="text-left">KETERANGAN &amp; REKONSILIASI</th>
            </tr>
          </thead>
          <tbody>
            <!-- 1. Arus Kas Masuk -->
            <tr class="bg-gray-50/80 font-bold">
              <td class="text-center font-mono">1</td>
              <td colspan="4" class="text-emerald-900 uppercase tracking-wider text-[11px]">
                ARUS KAS MASUK OPERASIONAL (INFLOW)
              </td>
            </tr>
            <tr class="hover:bg-emerald-50/20">
              <td class="text-center font-mono text-gray-400">1.1</td>
              <td class="pl-6 font-semibold">Penerimaan Pembayaran Tunai Kasir</td>
              <td class="text-right font-mono font-bold text-emerald-700">{{ formatRupiah(cashInflow) }}</td>
              <td class="text-right font-mono text-gray-300">-</td>
              <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('cf_1_1') ? 'Klik untuk ciutkan' : 'Uang fisik tunai di laci kasir (Klik untuk baca penuh)'"
                  @click="toggleNote('cf_1_1')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('cf_1_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Uang fisik tunai di laci kasir
                  </div>
                </div>
              </td>
            </tr>
            <tr class="hover:bg-emerald-50/20">
              <td class="text-center font-mono text-gray-400">1.2</td>
              <td class="pl-6 font-semibold">Penerimaan Transfer Bank &amp; QRIS (Lunas)</td>
              <td class="text-right font-mono font-bold text-blue-700">{{ formatRupiah(nonCashInflow) }}</td>
              <td class="text-right font-mono text-gray-300">-</td>
              <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('cf_1_2') ? 'Klik untuk ciutkan' : 'Mutasi rekening giro / QRIS toko (Klik untuk baca penuh)'"
                  @click="toggleNote('cf_1_2')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('cf_1_2') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Mutasi rekening giro / QRIS toko
                  </div>
                </div>
              </td>
            </tr>
            <tr class="bg-emerald-50/40 font-bold border-t border-b border-emerald-200">
              <td class="text-center font-mono text-emerald-900">1.3</td>
              <td class="pl-6 text-emerald-900">SUBTOTAL KAS MASUK</td>
              <td class="text-right font-mono text-emerald-800 text-sm font-extrabold">
                {{ formatRupiah(cashInflow + nonCashInflow) }}
              </td>
              <td class="text-right font-mono text-gray-300">-</td>
              <td class="text-emerald-800 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('cf_1_3') ? 'Klik untuk ciutkan' : 'Total seluruh kas masuk periode ini (Klik untuk baca penuh)'"
                  @click="toggleNote('cf_1_3')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('cf_1_3') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Total seluruh kas masuk periode ini
                  </div>
                </div>
              </td>
            </tr>

            <!-- 2. Arus Kas Keluar -->
            <tr class="bg-gray-50/80 font-bold">
              <td class="text-center font-mono">2</td>
              <td colspan="4" class="text-amber-900 uppercase tracking-wider text-[11px]">
                ARUS KAS KELUAR OPERASIONAL (OUTFLOW)
              </td>
            </tr>
            <tr class="hover:bg-amber-50/20">
              <td class="text-center font-mono text-gray-400">2.1</td>
              <td class="pl-6 font-semibold">Pembayaran Faktur Kulakan Barang Supplier</td>
              <td class="text-right font-mono text-gray-300">-</td>
              <td class="text-right font-mono font-bold text-amber-800">{{ formatRupiah(totalPurchasesCost) }}</td>
              <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('cf_2_1') ? 'Klik untuk ciutkan' : `Total ${purchaseStore.purchaseHistory.length} nota kulakan barang dari distributor (Klik untuk baca penuh)`"
                  @click="toggleNote('cf_2_1')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('cf_2_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Total {{ purchaseStore.purchaseHistory.length }} nota kulakan barang dari distributor
                  </div>
                </div>
              </td>
            </tr>

            <!-- 3. Net Cash Flow -->
            <tr class="bg-blue-50/70 font-extrabold border-t-2 border-b-2 border-blue-300">
              <td class="text-center font-mono text-blue-900">3</td>
              <td class="text-blue-900 uppercase tracking-wide">
                ARUS KAS BERSIH (NET CASH FLOW)
              </td>
              <td colspan="2" class="text-right font-mono text-blue-800 text-base font-extrabold">
                {{ netCashFlow >= 0 ? '+' : '' }} {{ formatRupiah(netCashFlow) }}
              </td>
              <td class="text-blue-800 text-[11px] font-semibold max-w-sm lg:max-w-xl xl:max-w-2xl">
                <div
                  class="cursor-pointer select-none transition-colors"
                  :title="isNoteExpanded('cf_3') ? 'Klik untuk ciutkan' : 'Sisa kas riil (Inflow dikurangi Outflow) (Klik untuk baca penuh)'"
                  @click="toggleNote('cf_3')"
                >
                  <div
                    class="hover:underline transition-colors"
                    :class="isNoteExpanded('cf_3') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
                  >
                    Sisa kas riil (Inflow dikurangi Outflow)
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ================= SUB-TAB 3: NERACA POSISI KEUANGAN ================= -->
      <div v-else-if="activeSubTab === 'balance_sheet'" class="flex-1 overflow-auto">
        <div class="grid grid-cols-1 md:grid-cols-2 divide-x divide-gray-200 h-full">
          <!-- Kolom Kiri: AKTIVA (Aset Toko) -->
          <div class="flex flex-col">
            <div class="h-8 bg-blue-50 px-3 border-b border-blue-200 flex items-center justify-between font-bold text-blue-900">
              <span>AKTIVA (ASET / HARTA USAHA)</span>
              <span class="font-mono text-[11px]">STANDAR SAK EMKM</span>
            </div>
            <table class="table-explorer w-full">
              <thead>
                <tr>
                  <th class="text-left">POS ASET LANCAR</th>
                  <th class="w-40 text-right">NILAI BUKU (RP)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="font-semibold">Estimasi Saldo Kas Tunai &amp; Bank</td>
                  <td class="text-right font-mono font-bold">{{ formatRupiah(estimatedCashBalance) }}</td>
                </tr>
                <tr>
                  <td class="font-semibold">Piutang Dagang Belum Ditagih (AR)</td>
                  <td class="text-right font-mono font-bold text-amber-700">{{ formatRupiah(totalReceivables) }}</td>
                </tr>
                <tr>
                  <td class="font-semibold">Persediaan Barang Dagangan di Gudang &amp; Rak (HPP)</td>
                  <td class="text-right font-mono font-bold text-blue-700">{{ formatRupiah(totalInventoryAssetValuation) }}</td>
                </tr>
                <tr class="bg-blue-50/70 font-extrabold border-t-2 border-blue-300">
                  <td class="text-blue-900">TOTAL AKTIVA LANCAR</td>
                  <td class="text-right font-mono text-blue-900 text-sm font-extrabold">{{ formatRupiah(totalCurrentAssets) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Kolom Kanan: PASIVA & EKUITAS -->
          <div class="flex flex-col">
            <div class="h-8 bg-emerald-50 px-3 border-b border-emerald-200 flex items-center justify-between font-bold text-emerald-900">
              <span>PASIVA &amp; EKUITAS (KEWAJIBAN &amp; MODAL BERSIH)</span>
              <span class="font-mono text-[11px]">NET WORTH TOKO</span>
            </div>
            <table class="table-explorer w-full">
              <thead>
                <tr>
                  <th class="text-left">POS KEWAJIBAN &amp; EKUITAS</th>
                  <th class="w-40 text-right">NILAI BUKU (RP)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="font-semibold">Hutang Dagang Supplier (Faktur Tempo AP)</td>
                  <td class="text-right font-mono font-bold text-red-600">{{ formatRupiah(totalSupplierPayables) }}</td>
                </tr>
                <tr>
                  <td class="font-semibold text-gray-500">Kewajiban Biaya Operasional Berjalan</td>
                  <td class="text-right font-mono font-bold text-gray-400">Rp 0</td>
                </tr>
                <tr class="bg-gray-50/80 font-bold border-t border-gray-200">
                  <td>TOTAL KEWAJIBAN (HUTANG)</td>
                  <td class="text-right font-mono font-bold text-red-600">{{ formatRupiah(totalSupplierPayables) }}</td>
                </tr>
                <tr class="bg-emerald-50/70 font-extrabold border-t-2 border-emerald-300">
                  <td class="text-emerald-900">EKUITAS BERSIH TOKO (NET WORTH)</td>
                  <td class="text-right font-mono text-emerald-800 text-sm font-extrabold">{{ formatRupiah(netWorthEquity) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ================= SUB-TAB 4: BUKU PIUTANG & AGING ================= -->
      <div v-else-if="activeSubTab === 'receivables'" class="flex-1 overflow-auto">
        <table class="table-explorer min-w-[900px] w-full">
          <thead>
            <tr>
              <th class="w-36">NO. NOTA</th>
              <th class="w-44 text-left">PELANGGAN</th>
              <th class="w-28 text-center">TANGGAL NOTA</th>
              <th class="w-28 text-center">UMUR PIUTANG</th>
              <th class="w-32 text-center">KATEGORI RISIKO</th>
              <th class="w-36 text-right">SISA TAGIHAN (RP)</th>
              <th class="w-28 text-center">AKSI STATUS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in agingReceivables" :key="t.id" class="hover:bg-blue-50/20 cursor-pointer">
              <td class="font-mono font-bold text-blue-700">{{ t.invoiceNo }}</td>
              <td class="font-bold text-gray-800">{{ t.buyer }}</td>
              <td class="text-center font-mono text-gray-500">{{ t.date }}</td>
              <td class="text-center font-mono font-bold">{{ t.ageDays }} Hari</td>
              <td class="text-center">
                <span
                  class="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
                  :class="{
                    'bg-red-100 text-red-800 border border-red-300': t.bucket === '>30',
                    'bg-yellow-100 text-yellow-800 border border-yellow-300': t.bucket === '15-30',
                    'bg-blue-100 text-blue-800 border border-blue-200': t.bucket === '8-14',
                    'bg-emerald-100 text-emerald-800 border border-emerald-200': t.bucket === '0-7'
                  }"
                >
                  {{ t.bucket === '>30' ? 'MACET (>30 HARI)' : (t.bucket === '15-30' ? 'PERINGATAN' : (t.bucket === '8-14' ? 'NORMAL' : 'LANCAR')) }}
                </span>
              </td>
              <td class="text-right font-mono font-bold text-gray-900">{{ formatRupiah(t.finalTotal ?? t.totalSell ?? 0) }}</td>
              <td class="text-center">
                <button
                  type="button"
                  @click="ledgerStore.togglePaymentStatus(t.id)"
                  class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-2xs"
                >
                  Set LUNAS
                </button>
              </td>
            </tr>
            <tr v-if="agingReceivables.length === 0">
              <td colspan="7" class="p-8 text-center text-gray-500">
                Tidak ada data piutang atau tagihan tempo yang tertahan.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ================= SUB-TAB 5: 9 MODUL ANALISIS BISNIS ================= -->
      <div v-else-if="activeSubTab === 'analytics'" class="flex-1 overflow-auto p-4 space-y-4">
        <!-- Dead Stock Alert Bar -->
        <div class="p-3 bg-amber-50 border border-amber-300 rounded flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <AlertTriangle :size="18" class="text-amber-800 shrink-0" />
            <div>
              <div class="text-xs font-bold text-amber-900">
                Modal Terkunci di Barang Mati (Dead Stock): Rp {{ formatRupiah(totalDeadStockCapital) }}
              </div>
              <div class="text-[11px] text-amber-800">
                Terdapat {{ deadStockItems.length }} SKU dengan stok fisik di rak yang belum bergerak sama sekali.
              </div>
            </div>
          </div>
          <button
            type="button"
            @click="exportComprehensiveReport"
            class="px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold shadow-2xs cursor-pointer"
          >
            Cetak Rekomendasi Diskon
          </button>
        </div>

        <!-- 9 Modules Table -->
        <table class="table-explorer w-full">
          <thead>
            <tr>
              <th class="w-12 text-center">NO</th>
              <th class="w-64 text-left">MODUL ANALISIS BISNIS</th>
              <th class="w-48 text-left">FUNGSI STRATEGIS</th>
              <th class="w-48 text-right">METRIK / INDIKATOR</th>
              <th class="text-left">TINDAKAN MANAJERIAL OWNER</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="text-center font-mono font-bold">01</td>
              <td class="font-bold text-amber-800">Dead Stock &amp; Capital Locked Tracker</td>
              <td>Deteksi modal yang membeku di rak</td>
              <td class="text-right font-mono font-bold text-amber-700">Rp {{ formatRupiah(totalDeadStockCapital) }}</td>
              <td class="text-gray-600">Lakukan promo cuci gudang (*clearance*) atau bundling</td>
            </tr>
            <tr>
              <td class="text-center font-mono font-bold">02</td>
              <td class="font-bold text-blue-800">Analisis ABC Pareto (Prinsip 80/20)</td>
              <td>Fokus 20% SKU penggerak 80% omzet</td>
              <td class="text-right font-mono font-bold text-blue-700">Kelas A: Top 20%</td>
              <td class="text-gray-600">Prioritaskan restock agar produk terlaris tidak pernah habis</td>
            </tr>
            <tr>
              <td class="text-center font-mono font-bold">03</td>
              <td class="font-bold text-emerald-800">Matriks Kuadran Margin vs Volume</td>
              <td>Kategori Star, Cash Cow &amp; Dead Weight</td>
              <td class="text-right font-mono font-bold text-emerald-700">Margin: {{ marginPercent.toFixed(1) }}%</td>
              <td class="text-gray-600">Pertahankan stok Star &amp; Cash Cow, evaluasi Dead Weight</td>
            </tr>
            <tr>
              <td class="text-center font-mono font-bold">04</td>
              <td class="font-bold text-purple-800">Heatmap Jam &amp; Hari Sibuk (Peak Hours)</td>
              <td>Pemetaan rush hour 08:00 - 21:00</td>
              <td class="text-right font-mono font-bold text-purple-700">Jam 11:00 - 14:00</td>
              <td class="text-gray-600">Atur shift kasir agar tidak overstaffing di jam sepi</td>
            </tr>
            <tr>
              <td class="text-center font-mono font-bold">05</td>
              <td class="font-bold text-indigo-800">Nilai Keranjang Belanja &amp; AOV</td>
              <td>Average Order Value per struk nota</td>
              <td class="text-right font-mono font-bold text-indigo-700">Rp {{ formatRupiah(avgTicketSize) }}</td>
              <td class="text-gray-600">Latih kasir menawarkan barang impulsif tambahan di kasir</td>
            </tr>
            <tr>
              <td class="text-center font-mono font-bold">06</td>
              <td class="font-bold text-red-800">Aging Schedule Piutang Bertingkat</td>
              <td>Segmentasi umur tagihan bon tempo</td>
              <td class="text-right font-mono font-bold text-red-700">Macet: Rp {{ formatRupiah(bucketOver30) }}</td>
              <td class="text-gray-600">Kunci nota baru untuk pelanggan dengan tagihan macet &gt;30 HARI</td>
            </tr>
            <tr>
              <td class="text-center font-mono font-bold">07</td>
              <td class="font-bold text-teal-800">Neraca Posisi Keuangan (Balance Sheet)</td>
              <td>Total Aset dikurangi Hutang Supplier</td>
              <td class="text-right font-mono font-bold text-teal-700">Net: Rp {{ formatRupiah(netWorthEquity) }}</td>
              <td class="text-gray-600">Evaluasi pertumbuhan kekayaan bersih toko dari bulan ke bulan</td>
            </tr>
            <tr>
              <td class="text-center font-mono font-bold">08</td>
              <td class="font-bold text-orange-800">Buku Hutang Dagang Supplier (AP Aging)</td>
              <td>Kalender jatuh tempo pembayaran faktur</td>
              <td class="text-right font-mono font-bold text-orange-700">{{ purchaseStore.purchaseHistory.length }} Faktur</td>
              <td class="text-gray-600">Siapkan dana kas sebelum tempo distributor jatuh tempo</td>
            </tr>
            <tr class="hover:bg-blue-50/40 cursor-pointer transition-colors" @click="activeSubTab = 'shifts'">
              <td class="text-center font-mono font-bold text-blue-700">09</td>
              <td class="font-bold text-red-800 flex items-center justify-between">
                <span>Audit Kasir &amp; Selisih Shift (Anti-Fraud)</span>
                <span class="px-1.5 py-0.2 rounded text-[10px] font-sans font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  Buka Modul ↗
                </span>
              </td>
              <td>Rekonsiliasi fisik vs sistem kasir</td>
              <td class="text-right font-mono font-bold text-gray-700">
                {{ shiftStore.shiftHistory.length }} Shift Tercatat
              </td>
              <td class="text-gray-600">Cek rekap selisih kas fisik laci kasir dan catatan serah terima shift</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ================= SUB-TAB 6: AUDIT SHIFT KASIR ================= -->
      <div v-else-if="activeSubTab === 'shifts'" class="flex-1 overflow-auto flex flex-col">
        <!-- Top Toolbar within Shifts Tab -->
        <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <span class="font-bold text-gray-800 text-xs flex items-center gap-1.5">
              <ShieldCheck :size="14" class="text-blue-600" />
              Rekam Jejak Tutup Shift Kasir &amp; Rekonsiliasi Kas Laci
            </span>
            <span class="text-[11px] text-gray-500 font-mono">({{ shiftStore.shiftHistory.length }} Riwayat)</span>
          </div>

          <div class="flex items-center gap-2">
            <button
              v-if="shiftStore.isShiftActive"
              type="button"
              class="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
              @click="shiftStore.showCloseShiftModal = true"
            >
              <LogOut :size="13" />
              <span>Tutup Shift Kasir ({{ shiftStore.currentShift?.cashierName }})</span>
            </button>
            <button
              v-else
              type="button"
              class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
              @click="shiftStore.showOpenShiftModal = true"
            >
              <LogIn :size="13" />
              <span>Buka Shift Baru</span>
            </button>
          </div>
        </div>

        <!-- Edge-to-Edge Shift Audit Table -->
        <div class="flex-1 overflow-auto">
          <table class="table-explorer w-full">
            <thead>
              <tr>
                <th class="w-12 text-center">NO</th>
                <th class="w-36 text-left">KASIR</th>
                <th class="w-56 text-left">WAKTU SHIFT &amp; DURASI</th>
                <th class="w-28 text-right">MODAL AWAL</th>
                <th class="w-32 text-right">PENJUALAN TUNAI</th>
                <th class="w-28 text-right">KAS KELUAR</th>
                <th class="w-32 text-right">KAS SISTEM</th>
                <th class="w-32 text-right">FISIK LACI</th>
                <th class="w-36 text-center">SELISIH KAS</th>
                <th class="text-left">CATATAN SERAH TERIMA</th>
                <th class="w-24 text-center">STATUS</th>
                <th class="w-24 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody>
              <!-- Active Shift Row (if open) -->
              <tr v-if="shiftStore.isShiftActive" class="bg-emerald-50/60 font-semibold border-l-4 border-l-emerald-500">
                <td class="text-center font-mono text-emerald-800">AKTIF</td>
                <td class="font-bold text-gray-900">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{{ shiftStore.currentShift?.cashierName }}</span>
                  </div>
                </td>
                <td class="text-[11px]">
                  <span>{{ new Date(shiftStore.currentShift?.startTime || '').toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }} s/d Sekarang</span>
                  <span class="text-emerald-700 font-mono ml-1.5 font-bold">({{ shiftStore.shiftDuration }})</span>
                </td>
                <td class="text-right font-mono">Rp {{ formatRupiah(shiftStore.currentShift?.startingCash || 0) }}</td>
                <td class="text-right font-mono text-emerald-700 font-bold">Rp {{ formatRupiah(shiftStore.currentShift?.cashSales || 0) }}</td>
                <td class="text-right font-mono text-amber-700">-Rp {{ formatRupiah(shiftStore.currentShift?.cashOutflow || 0) }}</td>
                <td class="text-right font-mono font-bold text-blue-800">Rp {{ formatRupiah(shiftStore.currentShift?.expectedCash || 0) }}</td>
                <td class="text-right font-mono text-gray-400 italic">Sedang Berjalan</td>
                <td class="text-center">
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    SEDANG BUKA
                  </span>
                </td>
                <td class="text-gray-500 text-[11px] truncate max-w-xs">{{ shiftStore.currentShift?.notes || '-' }}</td>
                <td class="text-center">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">OPEN</span>
                </td>
                <td class="text-center">
                  <button
                    type="button"
                    class="px-2 py-1 text-[11px] rounded bg-white border border-gray-300 hover:bg-gray-100 text-rose-700 font-bold cursor-pointer transition-colors shadow-2xs"
                    @click="shiftStore.showCloseShiftModal = true"
                  >
                    Tutup
                  </button>
                </td>
              </tr>

              <!-- History Rows -->
              <tr
                v-for="(s, idx) in shiftStore.shiftHistory"
                :key="s.id"
                class="hover:bg-blue-50/20 transition-colors"
              >
                <td class="text-center font-mono text-gray-400">{{ idx + 1 }}</td>
                <td class="font-semibold text-gray-900">{{ s.cashierName }}</td>
                <td class="text-[11px] text-gray-600">
                  <div class="font-mono">
                    {{ new Date(s.startTime).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) }}
                    {{ new Date(s.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}
                    -
                    {{ s.endTime ? new Date(s.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-' }}
                  </div>
                </td>
                <td class="text-right font-mono text-gray-600">Rp {{ formatRupiah(s.startingCash) }}</td>
                <td class="text-right font-mono text-emerald-700 font-semibold">Rp {{ formatRupiah(s.cashSales) }}</td>
                <td class="text-right font-mono text-amber-700">{{ s.cashOutflow > 0 ? `-Rp ${formatRupiah(s.cashOutflow)}` : 'Rp 0' }}</td>
                <td class="text-right font-mono font-bold text-gray-800">Rp {{ formatRupiah(s.expectedCash) }}</td>
                <td class="text-right font-mono font-bold text-blue-900">Rp {{ formatRupiah(s.actualCash || 0) }}</td>
                <td class="text-center">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-mono font-bold border inline-block"
                    :class="
                      (s.discrepancy || 0) === 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : (s.discrepancy || 0) < 0
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                    "
                  >
                    {{
                      (s.discrepancy || 0) === 0
                        ? 'PAS (Rp 0)'
                        : `${(s.discrepancy || 0) > 0 ? '+' : ''}Rp ${formatRupiah(s.discrepancy || 0)}`
                    }}
                  </span>
                </td>
                <td class="text-gray-600 text-[11px] truncate max-w-xs">{{ s.notes || '-' }}</td>
                <td class="text-center">
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    :class="s.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'"
                  >
                    {{ s.status }}
                  </span>
                </td>
                <td class="text-center">
                  <button
                    type="button"
                    class="px-2 py-0.5 text-[11px] rounded bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold cursor-pointer transition-colors shadow-2xs flex items-center gap-1 mx-auto"
                    title="Lihat Struk Serah Terima"
                    @click="
                      shiftStore.lastClosedShift = s;
                      shiftStore.showShiftSummaryModal = true;
                    "
                  >
                    <Eye :size="12" />
                    <span>Struk</span>
                  </button>
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-if="shiftStore.shiftHistory.length === 0 && !shiftStore.isShiftActive">
                <td colspan="12" class="p-8 text-center text-gray-400">
                  <p class="font-bold text-gray-600 text-xs">Belum ada riwayat shift yang tersimpan</p>
                  <p class="text-[11px] mt-1">Buka shift kasir untuk mulai merekam serah terima dan rekonsiliasi kas</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
