<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { FinancialReport } from '../types';
import { ownerApi } from '../services/api';
import { formatRupiah } from '../utils/formatters';
import HeaderBar from '../components/HeaderBar.vue';
import { ArrowDownLeft, ArrowUpRight, Wallet, Banknote, Truck, Calendar, Coins, Scale, AlertTriangle } from 'lucide-vue-next';

const period = ref<'today' | 'week' | 'month' | 'year'>('month');
const loading = ref(false);
const errorMessage = ref('');
const report = ref<FinancialReport | null>(null);

async function loadReport() {
  loading.value = true;
  errorMessage.value = '';
  try {
    report.value = await ownerApi.getFinancialReport(period.value);
  } catch (e: any) {
    // BUG FIX: error tidak lagi dibiarkan diam-diam -> user tahu data tidak
    // termuat, bukan mengira saldo kas kosong.
    errorMessage.value = 'Gagal memuat laporan arus kas: ' + (e?.message || e);
  } finally {
    loading.value = false;
  }
}

function changePeriod(p: 'today' | 'week' | 'month' | 'year') {
  period.value = p;
  loadReport();
}

onMounted(() => {
  loadReport();
});
</script>

<template>
  <div class="min-h-screen bg-[#ecebe9] pb-24 text-[#2e2b28] font-sans flex flex-col select-none">
    <!-- Header Bar -->
    <HeaderBar
      title="Buku Arus Kas"
      :loading="loading"
      @refresh="loadReport"
    />

    <!-- Main Content -->
    <!-- BUG FIX: tampilkan pesan error server (sebelumnya halaman menampilkan
         "tidak ada data" padahal sebenarnya request-nya gagal) -->
    <div v-if="errorMessage" class="w-full bg-rose-50 border-b border-rose-300 px-4 py-2 text-[11px] text-rose-800 flex items-start gap-2">
      <AlertTriangle :size="14" class="shrink-0 mt-0.5" />
      <span>{{ errorMessage }}</span>
    </div>
    <main class="w-full flex-1 flex flex-col" v-if="report">
      <!-- 1. Desktop Ribbon: Period Selector -->
      <div class="w-full bg-[#dfddd9] border-b border-[#c8c5c0] px-3 py-1.5 flex items-center justify-between text-xs">
        <div class="flex items-center gap-1.5 text-[11px] font-bold text-[#6b655f]">
          <Calendar class="w-3.5 h-3.5 text-[#2563eb]" />
          <span>Periode:</span>
        </div>
        <div class="flex items-center gap-1">
          <button
            v-for="p in ([{ id: 'today', l: 'Hari Ini' }, { id: 'week', l: '7 Hari' }, { id: 'month', l: 'Bulan' }, { id: 'year', l: 'Tahun' }] as const)"
            :key="p.id"
            @click="changePeriod(p.id)"
            class="px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer rounded-xs"
            :class="period === p.id
              ? 'bg-[#ecebe9] text-[#2563eb] border border-[#b0aca5] shadow-xs font-bold'
              : 'text-[#6b655f] hover:text-[#2e2b28] hover:bg-[#d6d4cf]'"
          >
            {{ p.l }}
          </button>
        </div>
      </div>

      <!-- 2. Horizontal Scrollable Desktop Metric Stats Strip -->
      <div class="w-full bg-white border-b border-[#c8c5c0] overflow-x-auto flex items-center divide-x divide-[#e5e3de] select-none no-scrollbar">
        <!-- Metric 1: Arus Kas Bersih -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div
            class="w-8 h-8 rounded shrink-0 flex items-center justify-center border shadow-2xs"
            :class="report.netCashFlow >= 0
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-rose-50 text-rose-700 border-rose-200'"
          >
            <Coins class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Arus Kas Bersih
            </div>
            <div
              class="text-sm font-extrabold font-mono whitespace-nowrap leading-snug mt-0.5"
              :class="report.netCashFlow >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'"
            >
              {{ formatRupiah(report.netCashFlow) }}
            </div>
          </div>
        </div>

        <!-- Metric 2: Kas Masuk -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0 flex items-center justify-center shadow-2xs">
            <ArrowDownLeft class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Total Kas Masuk
            </div>
            <div class="text-sm font-extrabold font-mono text-[#2563eb] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(report.cashInflow + report.transferInflow) }}
            </div>
          </div>
        </div>

        <!-- Metric 3: Pengeluaran Kulakan -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0 flex items-center justify-center shadow-2xs">
            <Truck class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Pengeluaran Kulakan
            </div>
            <div class="text-sm font-extrabold font-mono text-[#dc2626] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(report.cashOutflowPurchases) }}
            </div>
          </div>
        </div>

        <!-- Metric 4: Posisi Likuiditas -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-[#f0ede8] text-[#6b655f] border border-[#e5e3de] shrink-0 flex items-center justify-center shadow-2xs">
            <Scale class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Status Likuiditas
            </div>
            <div class="text-xs font-bold font-mono text-[#2e2b28] whitespace-nowrap leading-snug mt-0.5">
              {{ report.netCashFlow >= 0 ? 'Surplus Operasional' : 'Defisit Kas' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Section Inflow (Penerimaan Kas) -->
      <div class="w-full bg-white border-b border-[#c8c5c0]">
        <!-- Pane Header -->
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between text-xs">
          <span class="font-bold text-[#166534] flex items-center gap-1.5">
            <ArrowDownLeft class="w-3.5 h-3.5 text-[#16a34a]" />
            1. Penerimaan Kas Masuk (Inflow)
          </span>
          <span class="font-bold font-mono text-[#166534]">
            {{ formatRupiah(report.cashInflow + report.transferInflow) }}
          </span>
        </div>

        <!-- Item Rows -->
        <div class="divide-y divide-[#f0ede8] text-xs">
          <div class="px-3 py-2 flex items-center justify-between hover:bg-[#faf9f7] transition-colors">
            <div class="flex items-center gap-2 min-w-0">
              <Banknote class="w-4 h-4 text-[#6b655f] shrink-0" />
              <div class="min-w-0">
                <span class="font-bold text-[#2e2b28] block truncate">Penerimaan Kas Tunai</span>
                <span class="text-[10px] text-[#6b655f] font-mono block">Laci kasir toko fisik</span>
              </div>
            </div>
            <span class="font-mono font-bold text-[#2e2b28] shrink-0 ml-2">
              {{ formatRupiah(report.cashInflow) }}
            </span>
          </div>

          <div class="px-3 py-2 flex items-center justify-between hover:bg-[#faf9f7] transition-colors">
            <div class="flex items-center gap-2 min-w-0">
              <Wallet class="w-4 h-4 text-[#6b655f] shrink-0" />
              <div class="min-w-0">
                <span class="font-bold text-[#2e2b28] block truncate">Transfer Bank / QRIS / Non-Tunai</span>
                <span class="text-[10px] text-[#6b655f] font-mono block">Rekening bank penampung</span>
              </div>
            </div>
            <span class="font-mono font-bold text-[#2e2b28] shrink-0 ml-2">
              {{ formatRupiah(report.transferInflow) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 4. Section Outflow (Pengeluaran Kas) -->
      <div class="w-full bg-white border-b border-[#c8c5c0]">
        <!-- Pane Header -->
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between text-xs">
          <span class="font-bold text-[#dc2626] flex items-center gap-1.5">
            <ArrowUpRight class="w-3.5 h-3.5 text-[#dc2626]" />
            2. Pengeluaran Kas Keluar (Outflow)
          </span>
          <span class="font-bold font-mono text-[#dc2626]">
            - {{ formatRupiah(report.cashOutflowPurchases) }}
          </span>
        </div>

        <!-- Item Rows -->
        <div class="divide-y divide-[#f0ede8] text-xs">
          <div class="px-3 py-2 flex items-center justify-between hover:bg-[#faf9f7] transition-colors">
            <div class="flex items-center gap-2 min-w-0">
              <Truck class="w-4 h-4 text-[#6b655f] shrink-0" />
              <div class="min-w-0">
                <span class="font-bold text-[#2e2b28] block truncate">Pembelian Kulakan Supplier</span>
                <span class="text-[10px] text-[#6b655f] font-mono block">Faktur barang masuk lunas</span>
              </div>
            </div>
            <span class="font-mono font-bold text-[#dc2626] shrink-0 ml-2">
              - {{ formatRupiah(report.cashOutflowPurchases) }}
            </span>
          </div>
        </div>
      </div>

      <!-- 5. Section Rekapitulasi Arus Kas (Desktop Accounting Summary) -->
      <div class="w-full bg-white border-b border-[#c8c5c0]">
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between text-xs">
          <span class="font-bold text-[#2e2b28]">
            3. Ringkasan Posisi Kas Akhir
          </span>
          <span class="text-[10px] text-[#6b655f] font-mono">{{ report.periodLabel }}</span>
        </div>

        <div class="p-3 text-xs space-y-1.5">
          <div class="flex justify-between items-center text-[#6b655f]">
            <span>Total Penerimaan Bersih</span>
            <span class="font-mono text-[#16a34a] font-bold">+ {{ formatRupiah(report.cashInflow + report.transferInflow) }}</span>
          </div>
          <div class="flex justify-between items-center text-[#6b655f]">
            <span>Total Pengeluaran Kulakan</span>
            <span class="font-mono text-[#dc2626] font-bold">- {{ formatRupiah(report.cashOutflowPurchases) }}</span>
          </div>
          <div class="pt-2 border-t border-[#e5e3de] flex justify-between items-center">
            <span class="font-extrabold text-[#2e2b28]">Arus Kas Bersih (Net Cash Flow)</span>
            <span
              class="font-mono text-base font-extrabold"
              :class="report.netCashFlow >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'"
            >
              {{ formatRupiah(report.netCashFlow) }}
            </span>
          </div>
        </div>
      </div>
    </main>

    <!-- Skeleton Loading -->
    <div v-else class="w-full p-3 space-y-2">
      <div class="h-8 bg-[#dfddd9] animate-pulse w-full"></div>
      <div class="h-20 bg-white border border-[#c8c5c0] animate-pulse w-full"></div>
      <div class="h-32 bg-white border border-[#c8c5c0] animate-pulse w-full"></div>
    </div>
  </div>
</template>
