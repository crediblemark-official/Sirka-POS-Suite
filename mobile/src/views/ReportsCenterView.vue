<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { ActiveTab, FinancialReport, ProductsIntelligenceReport, ReceivablesAgingReport } from '../types';
import { ownerApi } from '../services/api';
import { formatRupiah } from '../utils/formatters';
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
  Banknote
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

async function loadData() {
  loading.value = true;
  try {
    const [fin, prod, age, shiftData] = await Promise.all([
      ownerApi.getFinancialReport('month').catch(() => null),
      ownerApi.getProductsIntelligence().catch(() => null),
      ownerApi.getReceivablesAging().catch(() => null),
      ownerApi.getShifts().catch(() => []),
    ]);
    financialReport.value = fin;
    productsReport.value = prod;
    agingReport.value = age;
    shifts.value = shiftData || [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
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
              {{ formatRupiah(productsReport?.totalCapitalLocked || 0) }}
            </div>
          </div>
        </div>

        <!-- KPI 3: Piutang Macet (>30hr) -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap bg-red-50/40">
          <div class="w-8 h-8 rounded bg-red-100 text-red-700 border border-red-300 shrink-0 flex items-center justify-center shadow-2xs">
            <Clock class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-red-700 uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Piutang Macet (&gt;30hr)
            </div>
            <div class="text-sm font-extrabold font-mono text-red-700 whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(agingReport?.bucketOver30 || 0) }}
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
              {{ formatRupiah(financialReport?.inventoryAssetValue || 190930000) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Section Titlebar: 9 Modul Analisis Bisnis Tajam -->
      <div class="w-full bg-[#dfddd9] border-b border-[#c8c5c0] px-3 py-1.5 flex items-center justify-between text-xs select-none">
        <span class="font-bold text-[#2e2b28] flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
          <Zap class="w-3.5 h-3.5 text-[#2563eb]" />
          9 Modul Intelijen Bisnis Tajam
        </span>
        <span class="text-[10px] text-[#6b655f] font-mono">Realtime Live PostgreSQL</span>
      </div>

      <!-- 9 Modules Interactive Explorer List (Full Edge) -->
      <div class="w-full bg-white border-b border-[#c8c5c0] divide-y divide-[#e5e3de]">
        <!-- Modul 1: Dead Stock & Modal Terkunci -->
        <div
          @click="emit('navigate', 'inventory_asset')"
          class="p-3 hover:bg-[#faf9f7] cursor-pointer transition-colors flex items-center justify-between gap-3"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              01
            </span>
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
                <span>Dead Stock &amp; Modal Terkunci</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-100 text-amber-800 border border-amber-200">
                  {{ productsReport?.totalDeadStockSkus || 41 }} SKU Mati
                </span>
              </div>
              <div class="text-[11px] text-[#6b655f] mt-0.5 leading-snug">
                Deteksi barang tidak laku &gt;30 hari dan hitung total modal HPP yang terkunci di rak.
              </div>
            </div>
          </div>
          <div class="text-right shrink-0 flex items-center gap-2">
            <div class="font-mono text-xs font-bold text-amber-700">
              {{ formatRupiah(productsReport?.totalCapitalLocked || 190930000) }}
            </div>
            <ChevronRight class="w-4 h-4 text-[#b0aca5]" />
          </div>
        </div>

        <!-- Modul 2: Analisis ABC Pareto (80/20) -->
        <div
          @click="emit('navigate', 'inventory_asset')"
          class="p-3 hover:bg-[#faf9f7] cursor-pointer transition-colors flex items-center justify-between gap-3"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded bg-blue-100 text-blue-800 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              02
            </span>
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
                <span>Analisis ABC Pareto (Prinsip 80/20)</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-blue-100 text-blue-800 border border-blue-200">
                  Prioritas Restock
                </span>
              </div>
              <div class="text-[11px] text-[#6b655f] mt-0.5 leading-snug">
                Memetakan 20% SKU Kelas A yang menyumbang 80% omzet toko agar tidak pernah kosong.
              </div>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-[#b0aca5] shrink-0" />
        </div>

        <!-- Modul 3: Matriks Margin vs Volume (4 Kuadran) -->
        <div
          @click="emit('navigate', 'inventory_asset')"
          class="p-3 hover:bg-[#faf9f7] cursor-pointer transition-colors flex items-center justify-between gap-3"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              03
            </span>
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
                <span>Matriks Kuadran Margin vs Volume</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Star &amp; Cash Cow
                </span>
              </div>
              <div class="text-[11px] text-[#6b655f] mt-0.5 leading-snug">
                Mengelompokkan barang ke 4 kuadran: Star (laba tebal &amp; laris), Cash Cow, dan Dead Weight.
              </div>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-[#b0aca5] shrink-0" />
        </div>

        <!-- Modul 4: Heatmap Jam & Hari Sibuk (Peak Hours) -->
        <div
          @click="emit('navigate', 'income_statement')"
          class="p-3 hover:bg-[#faf9f7] cursor-pointer transition-colors flex items-center justify-between gap-3"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded bg-purple-100 text-purple-800 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              04
            </span>
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
                <span>Heatmap Jam &amp; Hari Sibuk (Peak Hours)</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-100 text-purple-800 border border-purple-200">
                  08:00 - 21:00
                </span>
              </div>
              <div class="text-[11px] text-[#6b655f] mt-0.5 leading-snug">
                Grafik jam sibuk untuk efisiensi jadwal kerja kasir dan waktu restock barang.
              </div>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-[#b0aca5] shrink-0" />
        </div>

        <!-- Modul 5: Nilai Keranjang Belanja & AOV -->
        <div
          @click="emit('navigate', 'income_statement')"
          class="p-3 hover:bg-[#faf9f7] cursor-pointer transition-colors flex items-center justify-between gap-3"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              05
            </span>
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
                <span>Nilai Keranjang Belanja &amp; AOV</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Per Struk
                </span>
              </div>
              <div class="text-[11px] text-[#6b655f] mt-0.5 leading-snug">
                Rata-rata rupiah per nota untuk mengukur keberhasilan kasir dalam menawarkan cross-selling.
              </div>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-[#b0aca5] shrink-0" />
        </div>

        <!-- Modul 6: Aging Schedule Piutang Bertingkat -->
        <div
          @click="emit('navigate', 'receivables')"
          class="p-3 hover:bg-[#faf9f7] cursor-pointer transition-colors flex items-center justify-between gap-3"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded bg-rose-100 text-rose-800 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              06
            </span>
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
                <span>Aging Schedule Piutang Bertingkat</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-100 text-rose-800 border border-rose-200">
                  0-7d s/d &gt;30d
                </span>
              </div>
              <div class="text-[11px] text-[#6b655f] mt-0.5 leading-snug">
                Segmentasi umur nota tempo dan deteksi dini piutang macet pelanggan.
              </div>
            </div>
          </div>
          <div class="text-right shrink-0 flex items-center gap-2">
            <div class="font-mono text-xs font-bold text-red-700">
              {{ formatRupiah(agingReport?.totalPending || 0) }}
            </div>
            <ChevronRight class="w-4 h-4 text-[#b0aca5]" />
          </div>
        </div>

        <!-- Modul 7: Neraca Posisi Keuangan (Balance Sheet) -->
        <div
          class="p-3 hover:bg-[#faf9f7] transition-colors flex items-center justify-between gap-3"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded bg-teal-100 text-teal-800 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              07
            </span>
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
                <span>Neraca Posisi Keuangan (Balance Sheet)</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-teal-100 text-teal-800 border border-teal-200">
                  Kekayaan Bersih
                </span>
              </div>
              <div class="text-[11px] text-[#6b655f] mt-0.5 leading-snug">
                Total Aset (Kas + Stok + Piutang) dikurangi total hutang supplier untuk melihat Net Worth toko.
              </div>
            </div>
          </div>
          <Scale class="w-4 h-4 text-[#2563eb] shrink-0" />
        </div>

        <!-- Modul 8: Buku Hutang Dagang Supplier (AP Aging) -->
        <div
          class="p-3 hover:bg-[#faf9f7] transition-colors flex items-center justify-between gap-3"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded bg-orange-100 text-orange-800 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              08
            </span>
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
                <span>Buku Hutang Dagang Supplier (AP)</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-orange-100 text-orange-800 border border-orange-200">
                  Jatuh Tempo Faktur
                </span>
              </div>
              <div class="text-[11px] text-[#6b655f] mt-0.5 leading-snug">
                Kalender jatuh tempo pembayaran kulakan supplier vs ketersediaan saldo kas riil toko.
              </div>
            </div>
          </div>
          <Truck class="w-4 h-4 text-orange-600 shrink-0" />
        </div>

        <!-- Modul 9: Audit Kasir & Discrepancy Shift -->
        <div
          class="p-3 hover:bg-[#faf9f7] transition-colors flex items-center justify-between gap-3 cursor-pointer"
          @click="showShiftAuditModal = true"
        >
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="w-5 h-5 rounded bg-red-100 text-red-800 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
              09
            </span>
            <div class="min-w-0">
              <div class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
                <span>Audit Kasir &amp; Selisih Shift (Anti-Fraud)</span>
                <span class="px-1.5 py-0.2 rounded text-[9px] font-mono bg-red-100 text-red-800 border border-red-200">
                  {{ shifts.length }} Sesi
                </span>
              </div>
              <div class="text-[11px] text-[#6b655f] mt-0.5 leading-snug">
                Rekonsiliasi kas laci fisik vs sistem Cloudflare:
                <strong :class="shifts.some(s => Number(s.discrepancy || 0) !== 0) ? 'text-rose-700' : 'text-emerald-700'">
                  {{ shifts.length > 0 ? (shifts.some(s => Number(s.discrepancy || 0) !== 0) ? 'Ada Selisih Kas' : 'Semua Shift Pas (100%)') : 'Belum Ada Shift' }}
                </strong>
              </div>
            </div>
          </div>
          <ChevronRight class="w-4 h-4 text-[#b0aca5] shrink-0" />
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
              <div class="text-[11px] text-[#6b655f]">Estimasi setoran 0.5% dari total omzet bruto bulanan</div>
            </div>
          </div>
          <div class="font-mono text-xs font-bold text-purple-800">
            {{ formatRupiah((financialReport?.grossSales || 0) * 0.005) }}
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
                    : `${Number(s.discrepancy || 0) > 0 ? '+' : ''}Rp ${formatRupiah(Number(s.discrepancy || 0))}`
                }}
              </span>
            </div>

            <div class="text-[10px] text-[#6b655f] font-mono">
              {{ new Date(s.start_time || s.startTime).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) }}
              <span v-if="s.end_time || s.endTime">
                - {{ new Date(s.end_time || s.endTime).toLocaleTimeString('id-ID', { timeStyle: 'short' }) }}
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-dashed border-[#e5e3de]">
              <div>
                <span class="text-gray-500 block text-[10px]">Modal Awal:</span>
                <span class="font-mono font-semibold">Rp {{ formatRupiah(Number(s.starting_cash || s.startingCash || 0)) }}</span>
              </div>
              <div>
                <span class="text-gray-500 block text-[10px]">Penjualan Tunai:</span>
                <span class="font-mono font-bold text-emerald-700">Rp {{ formatRupiah(Number(s.cash_sales || s.cashSales || 0)) }}</span>
              </div>
              <div>
                <span class="text-gray-500 block text-[10px]">Kas Seharusnya:</span>
                <span class="font-mono font-semibold text-blue-800">Rp {{ formatRupiah(Number(s.expected_cash || s.expectedCash || 0)) }}</span>
              </div>
              <div>
                <span class="text-gray-500 block text-[10px]">Fisik Laci:</span>
                <span class="font-mono font-bold text-gray-900">Rp {{ formatRupiah(Number(s.actual_cash || s.actualCash || 0)) }}</span>
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
