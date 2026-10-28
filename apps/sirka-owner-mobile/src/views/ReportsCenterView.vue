<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { ActiveTab, FinancialReport, ProductsIntelligenceReport, ReceivablesAgingReport } from '../types';
import { ownerApi } from '../services/api';
import { formatRupiah, formatShiftDateTime, formatShiftTime } from '../utils/formatters';
import HeaderBar from '../components/HeaderBar.vue';
import {
  FileSpreadsheet,
  ArrowLeftRight,
  Clock,
  Landmark,
  TrendingUp,
  AlertTriangle,
  Zap,
  ShoppingBag,
  Building,
  Scale,
  Truck,
  ShieldAlert,
  ChevronRight,
  CheckCircle2,
  Calendar,
  Percent,
  UserCheck,
  X,
  Banknote,
  ArrowRight,
  Sparkles
} from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'navigate', tab: ActiveTab): void;
}>();

const loading = ref(false);
const financialReport = ref<FinancialReport | null>(null);
const productsReport = ref<ProductsIntelligenceReport | null>(null);
const agingReport = ref<ReceivablesAgingReport | null>(null);
const shifts = ref<any[]>([]);
const showShiftAuditModal = ref(false);
const errorMessage = ref('');
const expandedModule = ref<number | null>(null);

function toggleModule(id: number) {
  expandedModule.value = expandedModule.value === id ? null : id;
}

// Insight Cerdas Otomatis Toko (Smart Business Insights)
const smartInsights = computed(() => {
  const items: Array<{
    id: string;
    title: string;
    desc: string;
    type: 'warning' | 'info' | 'success';
    badge: string;
    actionTab?: ActiveTab;
    actionLabel?: string;
  }> = [];

  // 1. Insight Modal Terkunci (Dead Stock)
  const lockedCapital = productsReport.value?.totalCapitalLocked ?? 0;
  const deadSkus = productsReport.value?.totalDeadStockSkus ?? 0;
  if (lockedCapital > 0 || deadSkus > 0) {
    items.push({
      id: 'dead-stock',
      title: 'Modal Tertahan di Rak Barang',
      desc: `Ada ${deadSkus} SKU yang tidak bergerak >30 hari dengan nilai modal HPP ${formatRupiah(lockedCapital)}. Pertimbangkan diskon clearance atau bundling.`,
      type: 'warning',
      badge: `${deadSkus} SKU Macet`,
      actionTab: 'inventory_asset',
      actionLabel: 'Audit Stok Mati'
    });
  }

  // 2. Insight Piutang Jatuh Tempo (>30 Hari)
  const badDebt = agingReport.value?.bucketOver30 ?? 0;
  const totalPending = agingReport.value?.totalPending ?? 0;
  if (badDebt > 0) {
    items.push({
      id: 'bad-debt',
      title: 'Perhatian Piutang Jatuh Tempo',
      desc: `Terdapat piutang macet >30 hari sebesar ${formatRupiah(badDebt)} dari total tagihan berjalan ${formatRupiah(totalPending)}. Segera hubungi pelanggan.`,
      type: 'warning',
      badge: 'Tempo Kritis',
      actionTab: 'receivables',
      actionLabel: 'Buka Buku Piutang'
    });
  } else if (totalPending > 0) {
    items.push({
      id: 'active-receivables',
      title: 'Piutang Berjalan Terkendali',
      desc: `Total piutang berjalan saat ini ${formatRupiah(totalPending)} dan seluruhnya masih dalam rentang tempo wajar (<30 hari).`,
      type: 'info',
      badge: 'Piutang Lancar',
      actionTab: 'receivables',
      actionLabel: 'Jadwal Tagihan'
    });
  }

  // 3. Insight Profitabilitas & Arus Kas
  const netSales = financialReport.value?.netSales ?? 0;
  const grossProfit = financialReport.value?.grossProfit ?? 0;
  const marginPct = financialReport.value?.profitMarginPercent ?? 0;
  if (netSales > 0) {
    items.push({
      id: 'profitability',
      title: `Estimasi Margin Laba: ${marginPct}%`,
      desc: `Omzet penjualan tercatat ${formatRupiah(netSales)} dengan estimasi laba kotor ${formatRupiah(grossProfit)}.`,
      type: marginPct >= 20 ? 'success' : 'info',
      badge: marginPct >= 20 ? 'Margin Prima' : 'Margin Wajar',
      actionTab: 'income_statement',
      actionLabel: 'Rincian Laba Rugi'
    });
  }

  // 4. Insight Rekonsiliasi Kasir & Shift
  if (shifts.value.length > 0) {
    const hasDiscrepancy = reconciledShifts.value.some((s: any) => Number(s.discrepancy || 0) !== 0);
    if (hasDiscrepancy) {
      items.push({
        id: 'shift-discrepancy',
        title: 'Deteksi Selisih Kasir Terbuka',
        desc: 'Terdapat ketidakcocokan saldo kas fisik laci kasir vs hitungan sistem pada shift terakhir.',
        type: 'warning',
        badge: 'Selisih Kas',
        actionLabel: 'Periksa Audit Shift'
      });
    } else if (reconciledShifts.value.length > 0) {
      items.push({
        id: 'shift-clean',
        title: 'Integritas Kasir 100% Pas',
        desc: `Semua ${reconciledShifts.value.length} sesi shift yang ditutup terekonsiliasi seimbang antara laci fisik dan sistem nota.`,
        type: 'success',
        badge: 'Shift Akurat',
        actionLabel: 'Riwayat Shift'
      });
    }
  }

  // Fallback info bila transaksi awal
  if (items.length === 0) {
    items.push({
      id: 'system-ready',
      title: 'Sistem Terhubung & Siap Monitoring',
      desc: 'Database PostgreSQL Cloud terhubung. Rekomendasi bisnis otomatis akan dianalisis saat transaksi kasir berjalan.',
      type: 'info',
      badge: 'Aktif',
      actionTab: 'income_statement',
      actionLabel: 'Pantau Transaksi'
    });
  }

  return items;
});

async function loadData() {
  loading.value = true;
  errorMessage.value = '';
  try {
    // BUG FIX: `Promise.all` menolak saat satu request gagal sehingga hasil
    // request yang BERHASIL ikut dibuang dan semua angka menjadi 0 (user
    // mengira tidak ada data). Sekarang `allSettled` per request.
    const [fin, prod, age, shiftData] = await Promise.allSettled([
      ownerApi.getFinancialReport('month'),
      ownerApi.getProductsIntelligence(),
      ownerApi.getReceivablesAging(),
      ownerApi.getShifts(),
    ]);
    financialReport.value = fin.status === 'fulfilled' ? fin.value : null;
    productsReport.value = prod.status === 'fulfilled' ? prod.value : null;
    agingReport.value = age.status === 'fulfilled' ? age.value : null;
    shifts.value = shiftData.status === 'fulfilled' ? (shiftData.value || []) : [];
    const rejections = [fin, prod, age, shiftData]
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (rejections.length > 0) {
      const errDetail = rejections[0].reason?.message || String(rejections[0].reason || '');
      errorMessage.value = `Sebagian data gagal dimuat (${errDetail}). Periksa koneksi internet / URL API.`;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});

/**
 * BUG FIX: shift yang belum direkonsiliasi (status != 'CLOSED') tidak boleh
 * dihitung sebagai "PAS". Kolom `discrepancy` bernilai 0 pada shift yang masih
 * terbuka sehingga metrik anti-fraud menjadi palsu.
 */
/**
 * BUG FIX: syarat sebelumnya menuntut `actual_cash` DAN `actualCash` sekaligus
 * ada. API `/api/shifts` hanya mengirim camelCase (`actualCash`) -> syaratnya
 * selalu false -> `reconciledShifts` selalu kosong -> audit anti-fraud tidak
 * pernah bisa melaporkan "100% pas".
 * Sekarang menerima salah satu format (snake_case ATAU camelCase).
 */
function shiftActualCash(s: any): number | null {
  const raw = s?.actualCash ?? s?.actual_cash;
  if (raw === null || raw === undefined || raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

const reconciledShifts = computed(() =>
  shifts.value.filter(
    (s: any) => String(s.status || '').toUpperCase() === 'CLOSED'
      && shiftActualCash(s) !== null
  )
);

const shiftAuditLabel = computed(() => {
  if (shifts.value.length === 0) return 'Belum Ada Shift';
  if (reconciledShifts.value.length === 0) return 'Belum Ada Shift Terekonsiliasi';
  const bad = reconciledShifts.value.filter((s: any) => Number(s.discrepancy || 0) !== 0);
  if (bad.length > 0) return `Ada Selisih Kas (${bad.length} dari ${reconciledShifts.value.length} Shift)`;
  return `Semua ${reconciledShifts.value.length} Shift Terekonsiliasi Pas (100%)`;
});
</script>

<template>
  <div class="min-h-screen bg-[#ecebe9] pb-20 text-[#2e2b28] font-sans flex flex-col">
    <!-- Header Bar (Full Edge) -->
    <HeaderBar
      title="Pusat Laporan &amp; Analisis"
      subtitle="Executive Cockpit &gt; 9 Modul Analisis Bisnis"
      :loading="loading"
      @refresh="loadData"
    />

    <!-- Main Content (Full Edge to Edge) -->
    <main class="w-full flex-1 flex flex-col">
      <!-- BUG FIX: tampilkan pesan error server (sebelumnya halaman menampilkan
           "0" seolah-olah tidak ada data, padahal request-nya gagal). -->
      <div v-if="errorMessage" class="w-full bg-rose-50 border-b border-rose-300 px-4 py-2 text-[11px] text-rose-800 flex items-start gap-2">
        <AlertTriangle :size="14" class="shrink-0 mt-0.5" />
        <span>{{ errorMessage }}</span>
      </div>
      <!-- 1. Executive Headline Metric Strip (Horizontal Scrollable) -->
      <div class="w-full bg-white border-b border-[#c8c5c0] overflow-x-auto flex items-center divide-x divide-[#e5e3de] select-none no-scrollbar">
        <!-- KPI 1: Omzet Bersih Bulan Ini -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0 flex items-center justify-center shadow-2xs">
            <TrendingUp class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Omzet Bersih
            </div>
            <div class="text-sm font-extrabold font-mono text-[#2563eb] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(financialReport?.netSales || 0) }}
            </div>
          </div>
        </div>

        <!-- KPI 2: Modal Terkunci (Dead Stock) -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap bg-amber-50/40">
          <div class="w-8 h-8 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0 flex items-center justify-center shadow-2xs">
            <AlertTriangle class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-amber-800 uppercase tracking-wider font-bold whitespace-nowrap leading-tight flex items-center gap-1">
              <span>Modal Terkunci (Dead Stock)</span>
            </div>
            <div class="text-sm font-extrabold font-mono text-amber-700 whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(productsReport?.totalCapitalLocked ?? 0) }}
            </div>
          </div>
        </div>

        <!-- KPI 3: Piutang Macet (>30 HARI) -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap bg-red-50/40">
          <div class="w-8 h-8 rounded bg-red-100 text-red-700 border border-red-300 shrink-0 flex items-center justify-center shadow-2xs">
            <Clock class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-red-700 uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Piutang Macet (&gt;30 HARI)
            </div>
            <div class="text-sm font-extrabold font-mono text-red-700 whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(agingReport?.bucketOver30 ?? 0) }}
            </div>
          </div>
        </div>

        <!-- KPI 4: Nilai Aset Stok Toko -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 flex items-center justify-center shadow-2xs">
            <Landmark class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Valuasi Aset Stok
            </div>
            <div class="text-sm font-extrabold font-mono text-[#2e2b28] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(financialReport?.inventoryAssetValue ?? 0) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Smart Insight Bisnis Section (Full Edge, Minimalist) -->
      <div class="w-full bg-[#dfddd9] border-b border-[#c8c5c0] px-3 py-1.5 flex items-center justify-between text-xs select-none">
        <span class="font-bold text-[#2e2b28] flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
          <Sparkles class="w-3.5 h-3.5 text-[#2563eb]" />
          Insight &amp; Analisis Otomatis
        </span>
        <span class="text-[10px] text-[#6b655f] font-mono font-medium">Realtime Evaluasi</span>
      </div>

      <div class="w-full bg-white border-b border-[#c8c5c0] divide-y divide-[#e5e3de]">
        <div
          v-for="item in smartInsights"
          :key="item.id"
          class="p-3 hover:bg-[#faf9f7] transition-colors flex items-start gap-3"
        >
          <!-- Status Indicator Dot -->
          <div
            class="w-2 h-2 rounded-full mt-1.5 shrink-0"
            :class="{
              'bg-amber-500 ring-4 ring-amber-100': item.type === 'warning',
              'bg-[#2563eb] ring-4 ring-blue-100': item.type === 'info',
              'bg-emerald-500 ring-4 ring-emerald-100': item.type === 'success'
            }"
          />

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-[#2e2b28] truncate">
                {{ item.title }}
              </span>
              <span
                class="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 border"
                :class="{
                  'bg-amber-50 text-amber-800 border-amber-200': item.type === 'warning',
                  'bg-blue-50 text-blue-800 border-blue-200': item.type === 'info',
                  'bg-emerald-50 text-emerald-800 border-emerald-200': item.type === 'success'
                }"
              >
                {{ item.badge }}
              </span>
            </div>

            <p class="text-[11.5px] text-[#6b655f] mt-1 leading-snug">
              {{ item.desc }}
            </p>

            <div v-if="item.actionLabel" class="mt-2 flex items-center justify-end">
              <button
                type="button"
                @click="item.actionTab ? emit('navigate', item.actionTab) : (showShiftAuditModal = true)"
                class="text-[11px] font-bold text-[#2563eb] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{{ item.actionLabel }}</span>
                <ArrowRight class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Section Titlebar: 9 Modul Intelijen Bisnis Tajam -->
      <div class="w-full bg-[#dfddd9] border-b border-[#c8c5c0] px-3 py-1.5 flex items-center justify-between text-xs select-none">
        <span class="font-bold text-[#2e2b28] flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
          <Zap class="w-3.5 h-3.5 text-[#2563eb]" />
          9 Modul Intelijen Bisnis Tajam
        </span>
        <span class="text-[10px] text-[#6b655f] font-mono">Realtime Live PostgreSQL</span>
      </div>

      <!-- 9 Modules Interactive Explorer List (Full Edge Expandable) -->
      <div class="w-full bg-white border-b border-[#c8c5c0] divide-y divide-[#e5e3de]">
        <!-- Modul 1: Dead Stock & Modal Terkunci -->
        <div class="transition-colors">
          <div
            @click="toggleModule(1)"
            class="px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#faf9f7] select-none"
            :class="expandedModule === 1 ? 'bg-[#f7f6f4]' : ''"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-5 h-5 rounded bg-[#e8e6e1] text-[#4a4640] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                01
              </span>
              <span class="text-xs font-semibold text-[#2e2b28] truncate">
                Dead Stock &amp; Modal Terkunci
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span v-if="productsReport?.totalCapitalLocked" class="font-mono text-xs font-bold text-amber-700">
                {{ formatRupiah(productsReport?.totalCapitalLocked ?? 0) }}
              </span>
              <ChevronRight
                class="w-4 h-4 text-[#a8a49e] transition-transform duration-200"
                :class="expandedModule === 1 ? 'rotate-90 text-[#2563eb]' : ''"
              />
            </div>
          </div>
          <div
            v-if="expandedModule === 1"
            class="px-3 pb-3 pt-1 bg-[#f7f6f4] border-t border-[#f0ede8] text-xs text-[#524e48] animate-fade-in space-y-2"
          >
            <p class="text-[11.5px] leading-relaxed text-[#6b655f]">
              Deteksi barang tidak laku &gt;30 hari dan hitung total modal HPP yang terkunci di rak toko.
            </p>
            <div class="flex items-center justify-between pt-1">
              <span class="text-[10.5px] font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                {{ productsReport?.totalDeadStockSkus ?? 0 }} SKU Mati / Tertahan
              </span>
              <button
                @click.stop="emit('navigate', 'inventory_asset')"
                class="text-xs text-[#2563eb] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Lihat Detail Aset Stok
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Modul 2: Analisis ABC Pareto (80/20) -->
        <div class="transition-colors">
          <div
            @click="toggleModule(2)"
            class="px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#faf9f7] select-none"
            :class="expandedModule === 2 ? 'bg-[#f7f6f4]' : ''"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-5 h-5 rounded bg-[#e8e6e1] text-[#4a4640] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                02
              </span>
              <span class="text-xs font-semibold text-[#2e2b28] truncate">
                Analisis ABC Pareto (80/20)
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[11px] font-medium text-[#6b655f]">Prioritas Restock</span>
              <ChevronRight
                class="w-4 h-4 text-[#a8a49e] transition-transform duration-200"
                :class="expandedModule === 2 ? 'rotate-90 text-[#2563eb]' : ''"
              />
            </div>
          </div>
          <div
            v-if="expandedModule === 2"
            class="px-3 pb-3 pt-1 bg-[#f7f6f4] border-t border-[#f0ede8] text-xs text-[#524e48] animate-fade-in space-y-2"
          >
            <p class="text-[11.5px] leading-relaxed text-[#6b655f]">
              Memetakan 20% SKU Kelas A yang menyumbang 80% omzet toko agar ketersediaan stok tidak pernah kosong.
            </p>
            <div class="flex items-center justify-end pt-1">
              <button
                @click.stop="emit('navigate', 'inventory_asset')"
                class="text-xs text-[#2563eb] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Buka Matriks Stok Pareto
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Modul 3: Matriks Margin vs Volume (4 Kuadran) -->
        <div class="transition-colors">
          <div
            @click="toggleModule(3)"
            class="px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#faf9f7] select-none"
            :class="expandedModule === 3 ? 'bg-[#f7f6f4]' : ''"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-5 h-5 rounded bg-[#e8e6e1] text-[#4a4640] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                03
              </span>
              <span class="text-xs font-semibold text-[#2e2b28] truncate">
                Matriks Kuadran Margin vs Volume
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <ChevronRight
                class="w-4 h-4 text-[#a8a49e] transition-transform duration-200"
                :class="expandedModule === 3 ? 'rotate-90 text-[#2563eb]' : ''"
              />
            </div>
          </div>
          <div
            v-if="expandedModule === 3"
            class="px-3 pb-3 pt-1 bg-[#f7f6f4] border-t border-[#f0ede8] text-xs text-[#524e48] animate-fade-in space-y-2"
          >
            <p class="text-[11.5px] leading-relaxed text-[#6b655f]">
              Mengelompokkan barang ke 4 kuadran: <strong>Star</strong> (laba tebal &amp; laris), <strong>Cash Cow</strong> (omzet tinggi), <strong>Puzzle</strong> (laba tinggi tapi lambat), dan <strong>Dead Weight</strong>.
            </p>
            <div class="flex items-center justify-end pt-1">
              <button
                @click.stop="emit('navigate', 'inventory_asset')"
                class="text-xs text-[#2563eb] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Lihat Kuadran Produk
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Modul 4: Heatmap Jam & Hari Sibuk (Peak Hours) -->
        <div class="transition-colors">
          <div
            @click="toggleModule(4)"
            class="px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#faf9f7] select-none"
            :class="expandedModule === 4 ? 'bg-[#f7f6f4]' : ''"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-5 h-5 rounded bg-[#e8e6e1] text-[#4a4640] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                04
              </span>
              <span class="text-xs font-semibold text-[#2e2b28] truncate">
                Heatmap Jam &amp; Hari Sibuk
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[11px] font-mono text-[#6b655f]">08:00 - 21:00</span>
              <ChevronRight
                class="w-4 h-4 text-[#a8a49e] transition-transform duration-200"
                :class="expandedModule === 4 ? 'rotate-90 text-[#2563eb]' : ''"
              />
            </div>
          </div>
          <div
            v-if="expandedModule === 4"
            class="px-3 pb-3 pt-1 bg-[#f7f6f4] border-t border-[#f0ede8] text-xs text-[#524e48] animate-fade-in space-y-2"
          >
            <p class="text-[11.5px] leading-relaxed text-[#6b655f]">
              Grafik jam sibuk untuk efisiensi jadwal kerja kasir dan waktu restock barang toko.
            </p>
            <div class="flex items-center justify-end pt-1">
              <button
                @click.stop="emit('navigate', 'income_statement')"
                class="text-xs text-[#2563eb] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Buka Pola Transaksi
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Modul 5: Nilai Keranjang Belanja & AOV -->
        <div class="transition-colors">
          <div
            @click="toggleModule(5)"
            class="px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#faf9f7] select-none"
            :class="expandedModule === 5 ? 'bg-[#f7f6f4]' : ''"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-5 h-5 rounded bg-[#e8e6e1] text-[#4a4640] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                05
              </span>
              <span class="text-xs font-semibold text-[#2e2b28] truncate">
                Nilai Keranjang Belanja &amp; AOV
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <ChevronRight
                class="w-4 h-4 text-[#a8a49e] transition-transform duration-200"
                :class="expandedModule === 5 ? 'rotate-90 text-[#2563eb]' : ''"
              />
            </div>
          </div>
          <div
            v-if="expandedModule === 5"
            class="px-3 pb-3 pt-1 bg-[#f7f6f4] border-t border-[#f0ede8] text-xs text-[#524e48] animate-fade-in space-y-2"
          >
            <p class="text-[11.5px] leading-relaxed text-[#6b655f]">
              Rata-rata rupiah per nota (*Average Order Value*) untuk mengukur keberhasilan kasir dalam menawarkan barang rekomendasi (*cross-selling*).
            </p>
            <div class="flex items-center justify-end pt-1">
              <button
                @click.stop="emit('navigate', 'income_statement')"
                class="text-xs text-[#2563eb] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Lihat Laporan Penjualan
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Modul 6: Aging Schedule Piutang Bertingkat -->
        <div class="transition-colors">
          <div
            @click="toggleModule(6)"
            class="px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#faf9f7] select-none"
            :class="expandedModule === 6 ? 'bg-[#f7f6f4]' : ''"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-5 h-5 rounded bg-[#e8e6e1] text-[#4a4640] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                06
              </span>
              <span class="text-xs font-semibold text-[#2e2b28] truncate">
                Aging Schedule Piutang
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="font-mono text-xs font-bold" :class="(agingReport?.totalPending || 0) > 0 ? 'text-red-700' : 'text-[#6b655f]'">
                {{ formatRupiah(agingReport?.totalPending || 0) }}
              </span>
              <ChevronRight
                class="w-4 h-4 text-[#a8a49e] transition-transform duration-200"
                :class="expandedModule === 6 ? 'rotate-90 text-[#2563eb]' : ''"
              />
            </div>
          </div>
          <div
            v-if="expandedModule === 6"
            class="px-3 pb-3 pt-1 bg-[#f7f6f4] border-t border-[#f0ede8] text-xs text-[#524e48] animate-fade-in space-y-2"
          >
            <p class="text-[11.5px] leading-relaxed text-[#6b655f]">
              Segmentasi umur nota tempo (0-7 hari s/d &gt;30 hari) dan deteksi dini piutang macet pelanggan.
            </p>
            <div class="flex items-center justify-between pt-1">
              <span class="text-[10.5px] font-mono text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {{ agingReport?.totalInvoices || 0 }} Faktur Belum Lunas
              </span>
              <button
                @click.stop="emit('navigate', 'receivables')"
                class="text-xs text-[#2563eb] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Buka Buku Piutang
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- Modul 7: Neraca Posisi Keuangan (Balance Sheet) -->
        <div class="transition-colors">
          <div
            @click="toggleModule(7)"
            class="px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#faf9f7] select-none"
            :class="expandedModule === 7 ? 'bg-[#f7f6f4]' : ''"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-5 h-5 rounded bg-[#e8e6e1] text-[#4a4640] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                07
              </span>
              <span class="text-xs font-semibold text-[#2e2b28] truncate">
                Neraca Posisi Keuangan (Balance Sheet)
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <ChevronRight
                class="w-4 h-4 text-[#a8a49e] transition-transform duration-200"
                :class="expandedModule === 7 ? 'rotate-90 text-[#2563eb]' : ''"
              />
            </div>
          </div>
          <div
            v-if="expandedModule === 7"
            class="px-3 pb-3 pt-1 bg-[#f7f6f4] border-t border-[#f0ede8] text-xs text-[#524e48] animate-fade-in space-y-2"
          >
            <p class="text-[11.5px] leading-relaxed text-[#6b655f]">
              Total Aset (Kas + Stok Fisik + Piutang) dikurangi total hutang supplier untuk melihat Nilai Bersih (*Net Worth*) toko.
            </p>
          </div>
        </div>

        <!-- Modul 8: Buku Hutang Dagang Supplier (AP Aging) -->
        <div class="transition-colors">
          <div
            @click="toggleModule(8)"
            class="px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#faf9f7] select-none"
            :class="expandedModule === 8 ? 'bg-[#f7f6f4]' : ''"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-5 h-5 rounded bg-[#e8e6e1] text-[#4a4640] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                08
              </span>
              <span class="text-xs font-semibold text-[#2e2b28] truncate">
                Buku Hutang Dagang Supplier (AP)
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <ChevronRight
                class="w-4 h-4 text-[#a8a49e] transition-transform duration-200"
                :class="expandedModule === 8 ? 'rotate-90 text-[#2563eb]' : ''"
              />
            </div>
          </div>
          <div
            v-if="expandedModule === 8"
            class="px-3 pb-3 pt-1 bg-[#f7f6f4] border-t border-[#f0ede8] text-xs text-[#524e48] animate-fade-in space-y-2"
          >
            <p class="text-[11.5px] leading-relaxed text-[#6b655f]">
              Kalender jatuh tempo pembayaran faktur kulakan supplier vs ketersediaan saldo kas riil toko.
            </p>
          </div>
        </div>

        <!-- Modul 9: Audit Kasir & Selisih Shift -->
        <div class="transition-colors">
          <div
            @click="toggleModule(9)"
            class="px-3 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-[#faf9f7] select-none"
            :class="expandedModule === 9 ? 'bg-[#f7f6f4]' : ''"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="w-5 h-5 rounded bg-[#e8e6e1] text-[#4a4640] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                09
              </span>
              <span class="text-xs font-semibold text-[#2e2b28] truncate">
                Audit Kasir &amp; Selisih Shift
              </span>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span
                class="text-[11px] font-bold"
                :class="reconciledShifts.some(s => Number(s.discrepancy || 0) !== 0) ? 'text-rose-700' : 'text-emerald-700'"
              >
                {{ shiftAuditLabel }}
              </span>
              <ChevronRight
                class="w-4 h-4 text-[#a8a49e] transition-transform duration-200"
                :class="expandedModule === 9 ? 'rotate-90 text-[#2563eb]' : ''"
              />
            </div>
          </div>
          <div
            v-if="expandedModule === 9"
            class="px-3 pb-3 pt-1 bg-[#f7f6f4] border-t border-[#f0ede8] text-xs text-[#524e48] animate-fade-in space-y-2"
          >
            <p class="text-[11.5px] leading-relaxed text-[#6b655f]">
              Rekonsiliasi kas laci fisik vs sistem Cloudflare untuk deteksi selisih uang kasir secara objektif.
            </p>
            <div class="flex items-center justify-between pt-1">
              <span class="text-[10.5px] font-mono text-[#6b655f] bg-[#ecebe9] px-2 py-0.5 rounded border border-[#d6d4cf]">
                {{ shifts.length }} Sesi Shift
              </span>
              <button
                @click.stop="showShiftAuditModal = true"
                class="text-xs text-[#2563eb] font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                Buka Audit Shift Kasir
                <ArrowRight class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Section Titlebar: Laporan Keuangan Lengkap (Termasuk Selain Buku Kas) -->
      <div class="w-full bg-[#dfddd9] border-b border-[#c8c5c0] px-3 py-1.5 flex items-center justify-between text-xs select-none mt-2">
        <span class="font-bold text-[#2e2b28] flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
          <FileSpreadsheet class="w-3.5 h-3.5 text-[#16a34a]" />
          Laporan Keuangan Standar (Selain Buku Kas)
        </span>
        <span class="text-[10px] text-[#6b655f] font-mono">Standar Akuntansi</span>
      </div>

      <!-- Financial Reports Matrix (Full Edge) -->
      <div class="w-full bg-white border-b border-[#c8c5c0] divide-y divide-[#e5e3de]">
        <!-- 1. Laba Rugi Komprehensif -->
        <div
          @click="emit('navigate', 'income_statement')"
          class="p-3 hover:bg-[#faf9f7] cursor-pointer transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-2.5">
            <FileSpreadsheet class="w-4 h-4 text-[#16a34a]" />
            <div>
              <div class="text-xs font-bold text-[#2e2b28]">Laporan Laba Rugi Komprehensif (P&amp;L)</div>
              <div class="text-[11px] text-[#6b655f]">Pendapatan Kotor, HPP, Laba Kotor, dan Margin (%)</div>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-[#b0aca5]" />
        </div>

        <!-- 2. Arus Kas (Buku Kas Masuk vs Keluar) -->
        <div
          @click="emit('navigate', 'cash_flow')"
          class="p-3 hover:bg-[#faf9f7] cursor-pointer transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-2.5">
            <ArrowLeftRight class="w-4 h-4 text-[#2563eb]" />
            <div>
              <div class="text-xs font-bold text-[#2e2b28]">Laporan Arus Kas Operasional (Buku Kas)</div>
              <div class="text-[11px] text-[#6b655f]">Pergerakan kas masuk tunai/transfer vs kas keluar kulakan</div>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-[#b0aca5]" />
        </div>

        <!-- 3. Buku Piutang & Tagihan Pelanggan -->
        <div
          @click="emit('navigate', 'receivables')"
          class="p-3 hover:bg-[#faf9f7] cursor-pointer transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-2.5">
            <Clock class="w-4 h-4 text-[#b45309]" />
            <div>
              <div class="text-xs font-bold text-[#2e2b28]">Buku Piutang &amp; Tagihan Pelanggan (AR)</div>
              <div class="text-[11px] text-[#6b655f]">Daftar faktur tempo pelanggan dan status pelunasan</div>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-[#b0aca5]" />
        </div>

        <!-- 4. Valuasi Nilai Aset Stok -->
        <div
          @click="emit('navigate', 'inventory_asset')"
          class="p-3 hover:bg-[#faf9f7] cursor-pointer transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-2.5">
            <Landmark class="w-4 h-4 text-indigo-700" />
            <div>
              <div class="text-xs font-bold text-[#2e2b28]">Laporan Valuasi Nilai Aset Persediaan</div>
              <div class="text-[11px] text-[#6b655f]">Modal tertanam HPP barang di rak vs estimasi nilai jual</div>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-[#b0aca5]" />
        </div>

        <!-- 5. Rekapitulasi Pajak PPh Final UMKM 0.5% -->
        <div
          class="p-3 hover:bg-[#faf9f7] transition-colors flex items-center justify-between"
        >
          <div class="flex items-center gap-2.5">
            <Percent class="w-4 h-4 text-purple-700" />
            <div>
              <div class="text-xs font-bold text-[#2e2b28]">Rekapitulasi Pajak PPh Final UMKM (PP 55)</div>
              <div class="text-[11px] text-[#6b655f]">Estimasi setoran 0.5% dari penjualan bersih periode berjalan</div>
            </div>
          </div>
          <div class="font-mono text-xs font-bold text-purple-800">
            <!-- BUG FIX: dasar perhitungan pajak sebelumnya `grossSales` sehingga
                 mobile dan desktop menampilkan nominal berbeda untuk store yang
                 sama (desktop memakai penjualan bersih). -->
            {{ formatRupiah((financialReport?.netSales ?? 0) * 0.005) }}
          </div>
        </div>
      </div>
    </main>

    <!-- Modal Audit Shift Kasir (Mobile Bottom Sheet) -->
    <div
      v-if="showShiftAuditModal"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      @click.self="showShiftAuditModal = false"
    >
      <div
        class="bg-white rounded-t-xl sm:rounded-xl shadow-2xl border border-gray-300 w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
      >
        <!-- Modal Header -->
        <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <UserCheck class="w-4 h-4 text-blue-700" />
            <h3 class="text-xs font-bold text-[#2e2b28]">Audit Kasir &amp; Rekonsiliasi Shift</h3>
          </div>
          <button
            type="button"
            class="p-1 text-gray-400 hover:text-gray-600 rounded cursor-pointer"
            @click="showShiftAuditModal = false"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Modal Body (Shift List) -->
        <div class="p-3 overflow-y-auto space-y-2.5 text-xs">
          <div v-if="shifts.length === 0" class="text-center py-8 text-gray-400">
            Belum ada rekap shift kasir tersimpan di database
          </div>

          <div
            v-for="s in shifts"
            :key="s.id"
            class="p-3 bg-[#faf9f7] border border-[#e5e3de] rounded-lg space-y-1.5"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-[#2e2b28]">{{ s.cashier_name || s.cashierName }}</span>
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold"
                :class="
                  Number(s.discrepancy || 0) === 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : Number(s.discrepancy || 0) < 0
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                "
              >
                {{
                  Number(s.discrepancy || 0) === 0
                    ? 'PAS (Rp 0)'
                    : `${Number(s.discrepancy || 0) > 0 ? '+' : ''}${formatRupiah(Number(s.discrepancy || 0))}`
                }}
              </span>
            </div>

            <div class="text-[10px] text-[#6b655f] font-mono">
              {{ formatShiftDateTime(s.start_time || s.startTime) }}
              <span v-if="s.end_time || s.endTime">
                - {{ formatShiftTime(s.end_time || s.endTime) }}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-dashed border-[#e5e3de]">
              <div>
                <span class="text-gray-500 block text-[10px]">Modal Awal:</span>
                <span class="font-mono font-semibold">{{ formatRupiah(Number(s.starting_cash || s.startingCash || 0)) }}</span>
              </div>
              <div>
                <span class="text-gray-500 block text-[10px]">Penjualan Tunai:</span>
                <span class="font-mono font-bold text-emerald-700">{{ formatRupiah(Number(s.cash_sales || s.cashSales || 0)) }}</span>
              </div>
              <div>
                <span class="text-gray-500 block text-[10px]">Kas Seharusnya:</span>
                <span class="font-mono font-semibold text-blue-800">{{ formatRupiah(Number(s.expected_cash || s.expectedCash || 0)) }}</span>
              </div>
              <div>
                <span class="text-gray-500 block text-[10px]">Fisik Laci:</span>
                <span class="font-mono font-bold text-gray-900">{{ formatRupiah(Number(s.actual_cash || s.actualCash || 0)) }}</span>
              </div>
            </div>

            <div v-if="s.notes" class="text-[10px] text-gray-500 italic pt-1 border-t border-dashed border-[#e5e3de]">
              Catatan: {{ s.notes }}
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="p-3 bg-[#f6f5f2] border-t border-gray-200">
          <button
            type="button"
            class="w-full py-2 bg-gray-800 text-white rounded text-xs font-bold cursor-pointer"
            @click="showShiftAuditModal = false"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
