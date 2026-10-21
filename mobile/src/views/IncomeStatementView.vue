<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { FinancialReport, SalesPatternsReport } from '../types';
import { ownerApi } from '../services/api';
import { formatRupiah } from '../utils/formatters';
import HeaderBar from '../components/HeaderBar.vue';
import { ShoppingBag, Receipt, FolderCheck, Calendar, Coins, TrendingUp, Truck, Clock, BarChart3 } from 'lucide-vue-next';

const period = ref<'today' | 'week' | 'month' | 'year'>('month');
const loading = ref(false);
const report = ref<FinancialReport | null>(null);
const patterns = ref<SalesPatternsReport | null>(null);

async function loadReport() {
  loading.value = true;
  try {
    const [reportRes, patternsRes] = await Promise.all([
      ownerApi.getFinancialReport(period.value),
      ownerApi.getSalesPatterns().catch(() => null),
    ]);
    report.value = reportRes;
    patterns.value = patternsRes;
  } finally {
    loading.value = false;
  }
}

function changePeriod(p: 'today' | 'week' | 'month' | 'year') {
  period.value = p;
  loadReport();
}

// Compute peak hour slot
const peakHour = computed(() => {
  if (!patterns.value || patterns.value.hourly.length === 0) return null;
  return [...patterns.value.hourly].sort((a, b) => b.txCount - a.txCount)[0];
});

// Max transaction count in hourly for relative bar height
const maxHourlyTx = computed(() => {
  if (!patterns.value || patterns.value.hourly.length === 0) return 1;
  return Math.max(...patterns.value.hourly.map(h => h.txCount), 1);
});

onMounted(() => {
  loadReport();
});
</script>

<template>
  <div class="min-h-screen bg-[#ecebe9] pb-20 text-[#2e2b28] font-sans flex flex-col">
    <!-- Header Bar (Full Edge) -->
    <HeaderBar
      title="Buku Laba Rugi &amp; Pola Trafik"
      subtitle="Keuangan &gt; Laba Rugi &amp; Jam Sibuk"
      :loading="loading"
      @refresh="loadReport"
    />

    <!-- Main Content (Full Edge to Edge) -->
    <main class="w-full flex-1 flex flex-col" v-if="report">
      <!-- 1. Full-Edge Desktop Period Ribbon -->
      <div class="w-full bg-[#dfddd9] border-b border-[#c8c5c0] px-3 py-1.5 flex items-center justify-between text-xs select-none">
        <span class="text-[11px] font-semibold text-[#6b655f] flex items-center gap-1.5">
          <Calendar class="w-3.5 h-3.5 text-[#2563eb]" />
          Periode:
        </span>
        <div class="flex items-center gap-1">
          <button
            v-for="p in ([{ id: 'today', l: 'Hari Ini' }, { id: 'week', l: '7 Hari' }, { id: 'month', l: 'Bulan' }, { id: 'year', l: 'Tahun' }] as const)"
            :key="p.id"
            @click="changePeriod(p.id)"
            class="px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer rounded-xs"
            :class="period === p.id
              ? 'bg-[#ecebe9] text-[#2563eb] border border-[#b0aca5] shadow-xs'
              : 'text-[#6b655f] hover:text-[#2e2b28] hover:bg-[#d6d4cf]'"
          >
            {{ p.l }}
          </button>
        </div>
      </div>

      <!-- 2. Horizontal Scrollable Desktop Metric Stats Strip -->
      <div class="w-full bg-white border-b border-[#c8c5c0] overflow-x-auto flex items-center divide-x divide-[#e5e3de] select-none no-scrollbar">
        <!-- Metric 1: Laba Kotor -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 flex items-center justify-center shadow-2xs">
            <Coins class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Laba Kotor ({{ report.profitMarginPercent.toFixed(1) }}%)
            </div>
            <div class="text-sm font-extrabold font-mono text-[#16a34a] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(report.grossProfit) }}
            </div>
          </div>
        </div>

        <!-- Metric 2: Penjualan Bersih -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0 flex items-center justify-center shadow-2xs">
            <TrendingUp class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Penjualan Bersih (Omzet)
            </div>
            <div class="text-sm font-extrabold font-mono text-[#2563eb] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(report.netSales) }}
            </div>
          </div>
        </div>

        <!-- Metric 3: Beban Pokok (HPP) -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-[#f0ede8] text-[#6b655f] border border-[#e5e3de] shrink-0 flex items-center justify-center shadow-2xs">
            <Truck class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Modal Barang (HPP)
            </div>
            <div class="text-sm font-extrabold font-mono text-[#2e2b28] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(report.cogs) }}
            </div>
          </div>
        </div>

        <!-- Metric 4: Rata-rata Struk (AOV) -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-purple-50 text-purple-700 border border-purple-200 shrink-0 flex items-center justify-center shadow-2xs">
            <ShoppingBag class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Rata-rata Nota (AOV)
            </div>
            <div class="text-xs font-bold font-mono text-[#2e2b28] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(report.averageTicketSize) }} ({{ report.totalTransactions }} Nota)
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Full-Edge Accounting Breakdown (P&L Ledger) -->
      <div class="w-full bg-white border-b border-[#c8c5c0]">
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between">
          <span class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
            <FolderCheck class="w-4 h-4 text-[#2563eb]" />
            Rincian Laporan Laba Rugi
          </span>
          <span class="text-[10px] text-[#6b655f] font-mono">Buku Kas &gt; P&amp;L</span>
        </div>

        <div class="divide-y divide-[#e5e3de] text-xs">
          <!-- 1. Penjualan -->
          <div class="p-3 space-y-1.5">
            <div class="font-bold text-[#2e2b28] text-xs">
              1. Pendapatan Penjualan
            </div>
            <div class="flex items-center justify-between pl-3 text-[#6b655f]">
              <span>Penjualan Bruto (Gross Sales)</span>
              <span class="font-mono text-[#2e2b28]">{{ formatRupiah(report.grossSales) }}</span>
            </div>
            <div class="flex items-center justify-between pl-3 text-[#dc2626]">
              <span>Potongan &amp; Diskon Penjualan</span>
              <span class="font-mono">- {{ formatRupiah(report.discounts) }}</span>
            </div>
            <div class="flex items-center justify-between pt-1 pl-1 font-bold text-[#2e2b28] border-t border-[#f0ede8]">
              <span>Total Penjualan Bersih</span>
              <span class="font-mono text-[#2563eb]">{{ formatRupiah(report.netSales) }}</span>
            </div>
          </div>

          <!-- 2. HPP -->
          <div class="p-3 space-y-1.5 bg-[#faf9f7]">
            <div class="font-bold text-[#2e2b28] text-xs">
              2. Harga Pokok Penjualan (HPP)
            </div>
            <div class="flex items-center justify-between pl-3 text-[#6b655f]">
              <span>Modal Pembelian Barang Terjual</span>
              <span class="font-mono text-[#2e2b28]">{{ formatRupiah(report.cogs) }}</span>
            </div>
            <div class="flex items-center justify-between pt-1 pl-1 font-bold text-[#2e2b28] border-t border-[#e5e3de]">
              <span>Total Beban Pokok (HPP)</span>
              <span class="font-mono text-[#2e2b28]">{{ formatRupiah(report.cogs) }}</span>
            </div>
          </div>

          <!-- 3. Hasil Laba Kotor -->
          <div class="p-3 bg-[#f0fdf4] border-t border-[#bbf7d0]">
            <div class="flex items-center justify-between font-extrabold text-sm text-[#166534]">
              <span>Laba Kotor Operasional</span>
              <span class="font-mono text-base">{{ formatRupiah(report.grossProfit) }}</span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-[#15803d] font-semibold mt-1">
              <span>Margin Keuntungan terhadap Omzet</span>
              <span class="font-mono font-bold">{{ report.profitMarginPercent.toFixed(1) }} %</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Pola Jam Sibuk & Trafik Kasir (Heatmap & Peak Hours) -->
      <div class="w-full bg-white border-b border-[#c8c5c0] mt-0">
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between">
          <span class="text-xs font-bold text-[#2e2b28] flex items-center gap-1.5">
            <Clock class="w-4 h-4 text-[#2563eb]" />
            Analisis Jam Sibuk Toko (Peak Hours)
          </span>
          <span v-if="peakHour" class="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-mono font-bold">
            Puncak: Jam {{ String(peakHour.hour).padStart(2, '0') }}:00
          </span>
          <span v-else class="text-[10px] text-[#6b655f] font-mono">30 Hari Terakhir</span>
        </div>

        <div class="p-3">
          <div v-if="patterns && patterns.hourly.length > 0" class="space-y-2">
            <div class="text-[11px] text-[#6b655f] flex items-center justify-between">
              <span>Distribusi Transaksi per Jam Operasional (08:00 - 21:00):</span>
              <span class="font-mono font-bold text-[#2e2b28]">{{ patterns.totalTransactions }} Transaksi Terdata</span>
            </div>

            <!-- Horizontal Hourly Bar Chart -->
            <div class="space-y-1.5 pt-1">
              <div
                v-for="h in patterns.hourly"
                :key="h.hour"
                class="flex items-center gap-2 text-xs"
              >
                <span class="w-12 text-[11px] font-mono text-[#6b655f] shrink-0">
                  {{ String(h.hour).padStart(2, '0') }}:00
                </span>
                <div class="flex-1 bg-[#f0ede8] rounded-xs h-4 overflow-hidden flex items-center">
                  <div
                    class="bg-[#2563eb] h-full rounded-xs transition-all duration-300"
                    :style="{ width: `${Math.max(8, (h.txCount / maxHourlyTx) * 100)}%` }"
                  ></div>
                </div>
                <span class="w-14 text-right text-[11px] font-mono font-bold text-[#2e2b28] shrink-0">
                  {{ h.txCount }} nota
                </span>
              </div>
            </div>
          </div>

          <div v-else class="text-center py-6 text-xs text-[#6b655f]">
            <BarChart3 class="w-6 h-6 mx-auto mb-1.5 text-[#b0aca5]" />
            <span>Belum ada cukup data histori transaksi untuk memetakan jam sibuk.</span>
          </div>
        </div>
      </div>

      <!-- 5. Full-Edge Operational Metrics Strip -->
      <div class="w-full grid grid-cols-2 divide-x divide-[#c8c5c0] bg-white border-b border-[#c8c5c0] text-xs">
        <div class="p-3 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-[#6b655f] uppercase font-bold">Rata-rata Nota (AOV)</div>
            <div class="text-sm font-bold text-[#2e2b28] font-mono mt-0.5">
              {{ formatRupiah(report.averageTicketSize) }}
            </div>
          </div>
          <ShoppingBag class="w-4 h-4 text-[#2563eb] shrink-0" />
        </div>

        <div class="p-3 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-[#6b655f] uppercase font-bold">Total Struk</div>
            <div class="text-sm font-bold text-[#2e2b28] font-mono mt-0.5">
              {{ report.totalTransactions }} transaksi
            </div>
          </div>
          <Receipt class="w-4 h-4 text-[#16a34a] shrink-0" />
        </div>
      </div>
    </main>

    <!-- Loading Skeleton (Full Edge) -->
    <div v-else class="w-full p-4 space-y-3">
      <div class="h-8 bg-[#dfddd9] animate-pulse w-full"></div>
      <div class="h-24 bg-white border border-[#c8c5c0] animate-pulse w-full"></div>
      <div class="h-48 bg-white border border-[#c8c5c0] animate-pulse w-full"></div>
    </div>
  </div>
</template>
