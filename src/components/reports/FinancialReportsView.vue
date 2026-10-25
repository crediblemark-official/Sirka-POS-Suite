<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLedgerStore } from '../../stores/ledgerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useCashStore } from '../../stores/cashStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatRupiah, localTodayStr, localPreviousMonthStr, parseLocalDate } from '../../utils/formatters';
import { dbService } from '../../services/dbService';
import MetricStatsStrip, { type MetricStatItem } from '../common/MetricStatsStrip.vue';
import DateRangePicker from '../common/DateRangePicker.vue';

// Subtab Components (Modular Architecture)
import ReportPnlTab from './tabs/ReportPnlTab.vue';
import ReportCashflowTab from './tabs/ReportCashflowTab.vue';
import ReportBalanceSheetTab from './tabs/ReportBalanceSheetTab.vue';
import ReportReceivablesTab from './tabs/ReportReceivablesTab.vue';
import ReportAnalyticsTab from './tabs/ReportAnalyticsTab.vue';
import ReportShiftsTab from './tabs/ReportShiftsTab.vue';

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
  Wallet,
  Building,
  QrCode
} from 'lucide-vue-next';
import * as XLSX from 'xlsx';

withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const ledgerStore = useLedgerStore();
const inventoryStore = useInventoryStore();
const purchaseStore = usePurchaseStore();
const shiftStore = useShiftStore();
const cashStore = useCashStore();
const settingsStore = useSettingsStore();

type ReportSubTab = 'pnl' | 'cashflow' | 'balance_sheet' | 'receivables' | 'analytics' | 'shifts';
const activeSubTab = ref<ReportSubTab>('pnl');

type DatePeriod = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';
const selectedPeriod = ref<DatePeriod>('month');
const customStartDate = ref<string>(localPreviousMonthStr());
const customEndDate = ref<string>(localTodayStr());

const cashBalances = computed(() => {
  return cashStore.calculateAccountBalances(customStartDate.value, customEndDate.value);
});

const operationalExpenses = computed(() => {
  return cashStore.mutations
    .filter(m => {
      if (m.type !== 'EXPENSE') return false;
      if (customStartDate.value && m.date < customStartDate.value) return false;
      if (customEndDate.value && m.date > customEndDate.value) return false;
      return true;
    })
    .reduce((acc, m) => acc + m.amount, 0);
});

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
const totalDiscounts = computed(() => periodTransactions.value.reduce(
  (acc, t) => acc + (t.discountAmount || 0) + (t.pointsDiscount || 0), 0
));
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
    .filter(t => t.paymentStatus === 'LUNAS')
    .reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
});

const nonCashInflow = computed(() => {
  return periodTransactions.value
    .filter(t => (t.paymentMethod as string) !== 'Tunai / Kas' && (t.paymentMethod as string) !== 'Tunai' && t.paymentStatus === 'LUNAS')
    .reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
});

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

const netCashFlow = computed(() => (cashInflow.value + nonCashInflow.value) - totalPurchasesCost.value - operationalExpenses.value);

// 4. Balance Sheet Metrics (Neraca Posisi Keuangan)
const totalInventoryAssetValuation = computed(() => {
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

// 5. Receivables Aging Schedule (Using DRY centralized parseLocalDate)
const agingReceivables = computed(() => {
  const tempos = ledgerStore.transactions.filter(t => t.paymentStatus === 'TEMPO');
  const now = new Date();

  return tempos.map(t => {
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

const bucket0_7 = computed(() => agingReceivables.value.filter(t => t.bucket === '0-7').reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));
const bucket8_14 = computed(() => agingReceivables.value.filter(t => t.bucket === '8-14').reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));
const bucket15_30 = computed(() => agingReceivables.value.filter(t => t.bucket === '15-30').reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));
const bucketOver30 = computed(() => agingReceivables.value.filter(t => t.bucket === '>30').reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));

// 6. Dead Stock & Product Intelligence
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
        label: 'Total Penjualan Bersih',
        value: `Rp ${formatRupiah(netSales.value)}`,
        sublabel: `${periodTransactions.value.length} Nota`,
        icon: TrendingUp,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-700'
      },
      {
        label: 'Modal Barang Terjual',
        value: `Rp ${formatRupiah(totalCogs.value)}`,
        icon: PackageCheck,
        iconBoxClass: 'bg-emerald-50 text-emerald-700',
        valClass: 'text-gray-800'
      },
      {
        label: 'Keuntungan Penjualan (Laba)',
        value: `+Rp ${formatRupiah(grossProfit.value)}`,
        sublabel: `(+${marginPercent.value.toFixed(1)}%)`,
        icon: Coins,
        iconBoxClass: 'bg-teal-50 text-teal-700',
        valClass: 'text-emerald-700',
        sublabelClass: 'text-emerald-600 font-bold font-mono'
      },
      {
        label: 'Perkiraan Pajak UMKM (0.5%)',
        value: `Rp ${formatRupiah(taxUmkmEstimated.value)}`,
        icon: Percent,
        iconBoxClass: 'bg-purple-50 text-purple-700',
        valClass: 'text-purple-800'
      },
      {
        label: 'Rata-rata Belanja per Pembeli',
        value: `Rp ${formatRupiah(avgTicketSize.value)}`,
        icon: ShoppingBag,
        iconBoxClass: 'bg-indigo-50 text-indigo-700',
        valClass: 'text-indigo-900'
      }
    ];
  } else if (activeSubTab.value === 'cashflow') {
    return [
      {
        label: 'Kas Tunai (Laci)',
        value: `Rp ${formatRupiah(cashBalances.value.netCashDrawer)}`,
        sublabel: 'Laci Kasir',
        tooltip: `Omzet Tunai: Rp ${formatRupiah(cashBalances.value.salesCash)} | Keluar: -Rp ${formatRupiah(cashBalances.value.expenseCash + cashBalances.value.transferOutCash)}`,
        icon: Wallet,
        iconBoxClass: 'bg-emerald-50 text-emerald-700',
        valClass: 'text-emerald-700'
      },
      {
        label: 'Rekening Bank',
        value: `Rp ${formatRupiah(cashBalances.value.netBankBalance)}`,
        sublabel: 'Bank Toko',
        tooltip: `Masuk: Rp ${formatRupiah(cashBalances.value.salesBank + cashBalances.value.transferInBank)} | Keluar: -Rp ${formatRupiah(cashBalances.value.purchasesCostBank + cashBalances.value.expenseBank)}`,
        icon: Building,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-700'
      },
      {
        label: 'Saldo QRIS',
        value: `Rp ${formatRupiah(cashBalances.value.pendingQrisSettlement)}`,
        sublabel: 'Belum Cair',
        tooltip: `Total QRIS: Rp ${formatRupiah(cashBalances.value.salesQris)} | Sudah Cair: Rp ${formatRupiah(cashBalances.value.settledQrisToBank)}`,
        icon: QrCode,
        iconBoxClass: 'bg-purple-50 text-purple-700',
        valClass: 'text-purple-700'
      },
      {
        label: 'Kas Keluar (Kulakan)',
        value: `Rp ${formatRupiah(totalPurchasesCost.value + operationalExpenses.value)}`,
        sublabel: `${purchaseStore.purchaseHistory.length} Faktur`,
        tooltip: `Kulakan: Rp ${formatRupiah(totalPurchasesCost.value)} | Beban: Rp ${formatRupiah(operationalExpenses.value)}`,
        icon: Truck,
        iconBoxClass: 'bg-amber-50 text-amber-700',
        valClass: 'text-amber-800'
      },
      {
        label: 'Arus Kas Bersih',
        value: `${netCashFlow.value >= 0 ? '+' : ''}Rp ${formatRupiah(netCashFlow.value)}`,
        sublabel: 'Sisa Kas Bersih',
        tooltip: 'Total Inflow dikurangi Total Outflow',
        icon: ArrowLeftRight,
        iconBoxClass: netCashFlow.value >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700',
        valClass: netCashFlow.value >= 0 ? 'text-teal-800' : 'text-red-700'
      }
    ];
  } else if (activeSubTab.value === 'balance_sheet') {
    return [
      {
        label: 'Uang Kas & Bank Toko',
        value: `Rp ${formatRupiah(estimatedCashBalance.value)}`,
        icon: Coins,
        iconBoxClass: 'bg-emerald-50 text-emerald-700',
        valClass: 'text-emerald-700'
      },
      {
        label: 'Total Bon Belum Dibayar',
        value: `Rp ${formatRupiah(totalReceivables.value)}`,
        icon: Clock,
        iconBoxClass: 'bg-amber-50 text-amber-700',
        valClass: 'text-amber-800'
      },
      {
        label: 'Modal Stok Barang Toko',
        value: `Rp ${formatRupiah(totalInventoryAssetValuation.value)}`,
        sublabel: `${inventoryStore.products.length} SKU`,
        icon: PackageCheck,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-700'
      },
      {
        label: 'Total Semua Harta Toko',
        value: `Rp ${formatRupiah(totalCurrentAssets.value)}`,
        icon: Scale,
        iconBoxClass: 'bg-indigo-50 text-indigo-700',
        valClass: 'text-indigo-900 font-bold'
      },
      {
        label: 'Modal Bersih Toko',
        value: `Rp ${formatRupiah(netWorthEquity.value)}`,
        icon: CheckCircle2,
        iconBoxClass: 'bg-teal-50 text-teal-700',
        valClass: 'text-teal-800 font-bold'
      }
    ];
  } else if (activeSubTab.value === 'receivables') {
    return [
      {
        label: 'Total Bon Belum Lunas',
        value: `Rp ${formatRupiah(totalReceivables.value)}`,
        sublabel: `${agingReceivables.value.length} Nota Bon`,
        icon: Clock,
        iconBoxClass: 'bg-amber-50 text-amber-700',
        valClass: 'text-amber-800'
      },
      {
        label: 'Lancar (0 - 7 Hari)',
        value: `Rp ${formatRupiah(bucket0_7.value)}`,
        icon: CheckCircle2,
        iconBoxClass: 'bg-emerald-50 text-emerald-700',
        valClass: 'text-emerald-700'
      },
      {
        label: 'Normal (8 - 14 Hari)',
        value: `Rp ${formatRupiah(bucket8_14.value)}`,
        icon: Clock,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-700'
      },
      {
        label: 'Perlu Ditagih (15 - 30 Hari)',
        value: `Rp ${formatRupiah(bucket15_30.value)}`,
        icon: AlertTriangle,
        iconBoxClass: 'bg-yellow-50 text-yellow-800',
        valClass: 'text-yellow-800'
      },
      {
        label: 'Tunggakan Macet (>30 Hari)',
        value: `Rp ${formatRupiah(bucketOver30.value)}`,
        icon: AlertTriangle,
        iconBoxClass: 'bg-red-50 text-red-700',
        valClass: 'text-red-700 font-bold'
      }
    ];
  } else if (activeSubTab.value === 'shifts') {
    const totalCashSalesAllShifts =
      shiftStore.shiftHistory.reduce((acc, s) => acc + (s.cashSales || 0), 0)
      + (shiftStore.isShiftActive ? (shiftStore.currentShift?.cashSales || 0) : 0);
    const totalDiscrepancyAllShifts = shiftStore.shiftHistory.reduce((acc, s) => acc + (s.discrepancy || 0), 0);
    const reconciledShifts = shiftStore.shiftHistory.filter(
      s => s.status === 'CLOSED' && s.actualCash !== undefined && s.actualCash !== null
    );
    const balanceRate = reconciledShifts.length > 0
      ? (reconciledShifts.filter(s => (s.discrepancy || 0) === 0).length / reconciledShifts.length) * 100
      : 0;

    return [
      {
        label: 'Total Riwayat Kerja Kasir',
        value: `${shiftStore.shiftHistory.length} Sesi`,
        sublabel: shiftStore.isShiftActive ? `1 Aktif (${shiftStore.currentShift?.cashierName})` : 'Shift Tutup',
        icon: UserCheck,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-900',
        sublabelClass: shiftStore.isShiftActive ? 'text-emerald-600 font-bold' : 'text-gray-500'
      },
      {
        label: 'Total Penjualan Tunai di Kasir',
        value: `Rp ${formatRupiah(totalCashSalesAllShifts)}`,
        icon: Coins,
        iconBoxClass: 'bg-emerald-50 text-emerald-700',
        valClass: 'text-emerald-700'
      },
      {
        label: 'Kecocokan Uang Laci (Pas)',
        value: `${balanceRate.toFixed(0)}%`,
        sublabel: `${reconciledShifts.filter(s => (s.discrepancy || 0) === 0).length} dari ${reconciledShifts.length} Shift Cocok Pas`,
        icon: CheckCircle2,
        iconBoxClass: 'bg-teal-50 text-teal-700',
        valClass: 'text-teal-800'
      },
      {
        label: 'Total Selisih Kas Laci',
        value: `${totalDiscrepancyAllShifts >= 0 ? '+' : ''}Rp ${formatRupiah(totalDiscrepancyAllShifts)}`,
        sublabel: totalDiscrepancyAllShifts === 0 ? 'Kas Seimbang (Pas)' : totalDiscrepancyAllShifts < 0 ? 'Total Tekor Kas' : 'Total Kelebihan Kas',
        icon: AlertTriangle,
        iconBoxClass: totalDiscrepancyAllShifts === 0 ? 'bg-emerald-50 text-emerald-700' : totalDiscrepancyAllShifts < 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700',
        valClass: totalDiscrepancyAllShifts === 0 ? 'text-emerald-700' : totalDiscrepancyAllShifts < 0 ? 'text-rose-700 font-bold' : 'text-amber-700 font-bold',
        sublabelClass: totalDiscrepancyAllShifts < 0 ? 'text-rose-600 font-semibold' : 'text-gray-500'
      }
    ];
  } else {
    // Analytics (Ringkasan Analisis Toko)
    return [
      {
        label: 'Modal Macet di Barang Tidak Laku',
        value: `Rp ${formatRupiah(totalDeadStockCapital.value)}`,
        sublabel: `${deadStockItems.value.length} Jenis Barang Macet`,
        icon: AlertTriangle,
        iconBoxClass: 'bg-amber-50 text-amber-700',
        valClass: 'text-amber-800 font-bold'
      },
      {
        label: 'Total Modal Stok Barang di Toko',
        value: `Rp ${formatRupiah(totalInventoryAssetValuation.value)}`,
        icon: PackageCheck,
        iconBoxClass: 'bg-blue-50 text-blue-700',
        valClass: 'text-blue-700'
      },
      {
        label: 'Rata-rata Belanja per Pembeli',
        value: `Rp ${formatRupiah(avgTicketSize.value)}`,
        icon: ShoppingBag,
        iconBoxClass: 'bg-indigo-50 text-indigo-700',
        valClass: 'text-indigo-900'
      },
      {
        label: 'Jumlah Nota Belanja',
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
    [`LAPORAN KEUANGAN & LABA RUGI - ${settingsStore.storeName.toUpperCase()}`],
    ['Periode', selectedPeriod.value === 'custom' ? `${customStartDate.value || '...'} s/d ${customEndDate.value || '...'}` : selectedPeriod.value.toUpperCase()],
    ['Tanggal Cetak', new Date().toLocaleString('id-ID')],
    [],
    ['KOMPONEN', 'NOMINAL (RP)'],
    ['Total Penjualan Kasir (Sebelum Diskon)', grossSales.value],
    ['Potongan Diskon & Kupon Belanja', totalDiscounts.value],
    ['Total Penjualan Bersih (Omzet Riil)', netSales.value],
    ['Modal Beli Barang Terjual (Kulakan)', totalCogs.value],
    ['Keuntungan Penjualan (Laba Kotor)', grossProfit.value],
    ['Persentase Keuntungan (%)', `${marginPercent.value.toFixed(1)}%`],
    ['Perkiraan Pajak UMKM 0.5% (PP 55)', taxUmkmEstimated.value],
    [],
    ['ALIRAN UANG KAS (MASUK & KELUAR)'],
    ['Penerimaan Uang Tunai di Kasir', cashInflow.value],
    ['Penerimaan Transfer Bank & QRIS', nonCashInflow.value],
    ['Belanja Kulakan Barang ke Supplier', totalPurchasesCost.value],
    ['Sisa Uang Kas Bersih (Net Cash)', netCashFlow.value]
  ];
  const wsPnl = XLSX.utils.aoa_to_sheet(pnlData);
  XLSX.utils.book_append_sheet(wb, wsPnl, 'Laba Rugi & Kas');

  // Sheet 2: Kekayaan & Modal Toko
  const bsData = [
    [`LAPORAN KEKAYAAN & MODAL TOKO - ${settingsStore.storeName.toUpperCase()}`],
    ['Tanggal Potret', new Date().toLocaleDateString('id-ID')],
    [],
    ['HARTA & KEKAYAAN TOKO (ASET)', 'NOMINAL (RP)'],
    ['Uang Kas & Rekening Bank', estimatedCashBalance.value],
    ['Tagihan Bon / Piutang Pelanggan', totalReceivables.value],
    ['Nilai Modal Stok Barang di Toko', totalInventoryAssetValuation.value],
    ['TOTAL SEMUA HARTA TOKO', totalCurrentAssets.value],
    [],
    ['KEWAJIBAN (HUTANG) & MODAL BERSIH'],
    ['Hutang Kulakan Tempo ke Supplier', totalSupplierPayables.value],
    ['TOTAL MODAL BERSIH TOKO (HARTA MINUS HUTANG)', netWorthEquity.value]
  ];
  const wsBs = XLSX.utils.aoa_to_sheet(bsData);
  XLSX.utils.book_append_sheet(wb, wsBs, 'Kekayaan & Modal Toko');

  // Sheet 3: Catatan Bon Pelanggan
  const arData = [
    [`CATATAN BON & PIUTANG PELANGGAN - ${settingsStore.storeName.toUpperCase()}`],
    ['No. Faktur', 'Nama Pelanggan', 'Tanggal Nota', 'Lama Bon (Hari)', 'Status Kelancaran', 'Total Bon (Rp)'],
    ...agingReceivables.value.map(t => [
      t.invoiceNo,
      t.buyer,
      t.date,
      t.ageDays,
      t.bucket === '>30' ? 'MACET (>30 HARI)' : (t.bucket === '15-30' ? 'PERLU DITAGIH' : (t.bucket === '8-14' ? 'NORMAL' : 'LANCAR')),
      t.finalTotal || t.totalSell
    ])
  ];
  const wsAr = XLSX.utils.aoa_to_sheet(arData);
  XLSX.utils.book_append_sheet(wb, wsAr, 'Catatan Bon Pelanggan');

  const filename = `Laporan_Keuangan_Citra_${localTodayStr()}.xlsx`;
  try {
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const msg = await dbService.saveExportFile(filename, Array.from(new Uint8Array(buffer)));
    if (msg) alert(msg);
  } catch (e: any) {
    const errStr = String(e?.message || e);
    if (errStr.includes('CANCELLED')) return;
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
            <span>Laba Rugi (Keuntungan)</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            :class="activeSubTab === 'cashflow' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeSubTab = 'cashflow'"
          >
            <ArrowLeftRight :size="13" />
            <span>Arus Kas (Uang Masuk/Keluar)</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            :class="activeSubTab === 'balance_sheet' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeSubTab = 'balance_sheet'"
          >
            <Scale :size="13" />
            <span>Kekayaan &amp; Modal Toko</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            :class="activeSubTab === 'receivables' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeSubTab = 'receivables'"
          >
            <Clock :size="13" />
            <span>Catatan Bon / Piutang Pelanggan</span>
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
            <span>Ringkasan Analisis Toko</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
            :class="activeSubTab === 'shifts' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeSubTab = 'shifts'"
          >
            <UserCheck :size="13" />
            <span>Pergantian Kasir (Shift)</span>
            <span v-if="shiftStore.isShiftActive" class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>
        </div>
      </div>

      <!-- Sisi Kanan: Date Range Picker & Export Button -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Reusable Modern Date Range Picker Popover -->
        <DateRangePicker
          v-model:start-date="customStartDate"
          v-model:end-date="customEndDate"
        />

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

    <!-- 3. Main Workspace: Modular Subtab Views -->
    <div class="flex-1 flex flex-col overflow-hidden bg-white">
      <!-- SUB-TAB 1: LABA RUGI (P&L) -->
      <ReportPnlTab
        v-if="activeSubTab === 'pnl'"
        :gross-sales="grossSales"
        :total-discounts="totalDiscounts"
        :net-sales="netSales"
        :total-cogs="totalCogs"
        :gross-profit="grossProfit"
        :margin-percent="marginPercent"
        :tax-umkm-estimated="taxUmkmEstimated"
      />

      <!-- SUB-TAB 2: ARUS KAS (CASH FLOW) -->
      <ReportCashflowTab
        v-else-if="activeSubTab === 'cashflow'"
        :cash-balances="cashBalances"
        :total-purchases-cost="totalPurchasesCost"
        :operational-expenses="operationalExpenses"
        :net-cash-flow="netCashFlow"
        :purchase-count="purchaseStore.purchaseHistory.length"
      />

      <!-- SUB-TAB 3: NERACA POSISI KEUANGAN -->
      <ReportBalanceSheetTab
        v-else-if="activeSubTab === 'balance_sheet'"
        :estimated-cash-balance="estimatedCashBalance"
        :total-receivables="totalReceivables"
        :total-inventory-asset-valuation="totalInventoryAssetValuation"
        :total-current-assets="totalCurrentAssets"
        :total-supplier-payables="totalSupplierPayables"
        :net-worth-equity="netWorthEquity"
      />

      <!-- SUB-TAB 4: BUKU PIUTANG & AGING -->
      <ReportReceivablesTab
        v-else-if="activeSubTab === 'receivables'"
        :aging-receivables="agingReceivables"
      />

      <!-- SUB-TAB 5: 9 MODUL ANALISIS BISNIS -->
      <ReportAnalyticsTab
        v-else-if="activeSubTab === 'analytics'"
        :total-dead-stock-capital="totalDeadStockCapital"
        :dead-stock-count="deadStockItems.length"
        :margin-percent="marginPercent"
        :avg-ticket-size="avgTicketSize"
        :bucket-over30="bucketOver30"
        :net-worth-equity="netWorthEquity"
        :purchase-count="purchaseStore.purchaseHistory.length"
        :shift-count="shiftStore.shiftHistory.length"
        @navigate-tab="activeSubTab = $event"
        @export-report="exportComprehensiveReport"
      />

      <!-- SUB-TAB 6: AUDIT SHIFT KASIR -->
      <ReportShiftsTab
        v-else-if="activeSubTab === 'shifts'"
      />
    </div>
  </div>
</template>
