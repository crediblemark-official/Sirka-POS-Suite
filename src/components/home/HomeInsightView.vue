<script setup lang="ts">
import { computed } from 'vue';
import { useLedgerStore } from '../../stores/ledgerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { formatRupiah, localTodayStr, localDateOffset } from '../../utils/formatters';
import type { ModuleTab } from '../explorer/AppLauncherTab.vue';
import {
  TrendingUp,
  Coins,
  Clock,
  Package,
  Users,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  BarChart3,
  CreditCard
} from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    searchQuery?: string;
  }>(),
  {
    searchQuery: ''
  }
);

const emit = defineEmits<{
  (e: 'open-tab', id: ModuleTab): void;
}>();

const ledgerStore = useLedgerStore();
const inventoryStore = useInventoryStore();
const shiftStore = useShiftStore();
const buyerStore = useBuyerStore();

// 1. Tanggal Lokal Hari Ini
const todayStr = localTodayStr();
const todayFormatted = computed(() => {
  const d = new Date();
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
});

// 2. Statistik Keuangan Hari Ini (Today's Sales)
const todayTransactions = computed(() => {
  return ledgerStore.transactions.filter(t => t.date === todayStr);
});

const todayRevenue = computed(() => {
  return todayTransactions.value.reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
});

const todayProfit = computed(() => {
  return todayTransactions.value.reduce((acc, t) => acc + (t.totalProfit ?? 0), 0);
});

const todayProfitMargin = computed(() => {
  if (todayRevenue.value <= 0) return 0;
  return Math.round((todayProfit.value / todayRevenue.value) * 100);
});

// 3. Piutang & Tempo
const totalReceivables = computed(() => ledgerStore.totalReceivables);
const tempoTransactions = computed(() => ledgerStore.transactions.filter(t => t.paymentStatus === 'TEMPO'));

// 4. Inventaris & Aset Fisik
const totalSkuCount = computed(() => inventoryStore.products.length);
const totalInventoryValuation = computed(() => {
  return inventoryStore.products.reduce((acc, p) => acc + (Math.max(0, p.stock) * (p.lastBuyPrice || 0)), 0);
});

// Produk Stok Menipis (Kritis <= 5)
const lowStockProducts = computed(() => {
  return inventoryStore.products
    .filter(p => p.stock <= 5)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10);
});

// 5. Top Produk Terlaris
const topProducts = computed(() => {
  const salesMap: Record<string, { name: string; qty: number; revenue: number; unit: string; category: string }> = {};
  ledgerStore.transactions.forEach(t => {
    (t.items || []).forEach(item => {
      if (!salesMap[item.productId]) {
        salesMap[item.productId] = {
          name: item.name,
          qty: 0,
          revenue: 0,
          unit: item.unit || 'PCS',
          category: item.category || 'Umum'
        };
      }
      salesMap[item.productId].qty += (item.qty || 0);
      salesMap[item.productId].revenue += (item.subtotalSell || 0);
    });
  });
  return Object.values(salesMap)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);
});

// 6. Tren Penjualan 7 Hari Terakhir
const last7DaysTrend = computed(() => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const dateStr = localDateOffset(i);
    const d = new Date(dateStr + 'T00:00:00');
    const dayShort = d.toLocaleDateString('id-ID', { weekday: 'short' });
    const dayLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

    const txs = ledgerStore.transactions.filter(t => t.date === dateStr);
    const rev = txs.reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
    const count = txs.length;

    days.push({
      dateStr,
      dayShort,
      dayLabel,
      revenue: rev,
      count
    });
  }
  const maxRev = Math.max(...days.map(d => d.revenue), 100000);
  return days.map(d => ({
    ...d,
    percent: Math.min(100, Math.max(8, Math.round((d.revenue / maxRev) * 100)))
  }));
});

// 7. Pembagian Metode Pembayaran
const paymentBreakdown = computed(() => {
  const txs = ledgerStore.transactions;
  const tunai = txs.filter(t => t.paymentMethod === 'Tunai / Kas' || t.isSplitPayment).length;
  const nonTunai = txs.filter(t => t.paymentMethod === 'Transfer Bank' || t.paymentMethod === 'QRIS').length;
  const tempo = txs.filter(t => t.paymentStatus === 'TEMPO').length;
  const total = txs.length || 1;
  return {
    tunaiCount: tunai,
    tunaiPercent: Math.round((tunai / total) * 100),
    nonTunaiCount: nonTunai,
    nonTunaiPercent: Math.round((nonTunai / total) * 100),
    tempoCount: tempo,
    tempoPercent: Math.round((tempo / total) * 100)
  };
});
</script>

<template>
  <div class="flex-1 w-full h-full flex flex-col bg-white overflow-hidden select-none text-xs">
    <!-- 1. TOP HEADER STRIP (Flat, Full Width, Dipisah Garis Border-B) -->
    <div class="h-10 px-4 flex items-center justify-between border-b border-gray-200 bg-gray-50/80 shrink-0">
      <!-- Kiri: Judul Halaman & Tanggal -->
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="font-bold text-gray-800 text-xs sm:text-sm tracking-tight">
          Selamat Datang, {{ shiftStore.currentShift?.cashierName }} 
        </span>
        <span class="text-gray-300 font-light">•</span>
        <span class="text-[11px] font-mono text-gray-600 shrink-0">
          {{ todayFormatted }}
        </span>
      </div>

      <!-- Kanan: Status Shift Kasir -->
      <div class="flex items-center gap-2.5 shrink-0">
        <div class="flex items-center gap-2 text-xs">
          <span
            class="w-2 h-2 rounded-full"
            :class="shiftStore.isShiftActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"
          ></span>
          <span class="font-medium text-gray-700">
            {{ shiftStore.isShiftActive ? `Shift: ${shiftStore.currentShift?.cashierName}` : 'Shift Belum Aktif' }}
          </span>
          <span v-if="shiftStore.isShiftActive" class="font-mono text-emerald-700 font-bold pl-1">
            • Laci: Rp {{ formatRupiah(shiftStore.currentShift?.expectedCash || 0) }}
          </span>
        </div>
        <button
          v-if="!shiftStore.isShiftActive"
          type="button"
          class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer transition-colors"
          @click="shiftStore.showOpenShiftModal = true"
        >
          Buka Shift
        </button>
      </div>
    </div>

    <!-- 2. METRIC KPI STRIP (5 Kolom Penuh, Divide-X, Border-B, Zero Round) -->
    <div class="grid grid-cols-2 md:grid-cols-5 divide-x divide-gray-200 border-b border-gray-200 bg-white shrink-0">
      <!-- Omset Hari Ini -->
      <div class="px-4 py-2.5 flex items-center gap-3 min-w-0">
        <div class="p-2 bg-emerald-50 text-emerald-600 shrink-0 border border-emerald-100">
          <Coins :size="16" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Omset Hari Ini</div>
          <div class="text-sm sm:text-base font-black font-mono text-emerald-700 truncate leading-tight mt-0.5">
            Rp {{ formatRupiah(todayRevenue) }}
          </div>
          <div class="text-[10px] text-gray-500 truncate">
            <span class="font-bold text-gray-700 font-mono">{{ todayTransactions.length }}</span> nota hari ini
          </div>
        </div>
      </div>

      <!-- Laba Bersih Hari Ini -->
      <div class="px-4 py-2.5 flex items-center gap-3 min-w-0">
        <div class="p-2 bg-blue-50 text-blue-600 shrink-0 border border-blue-100">
          <TrendingUp :size="16" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Laba Bersih Hari Ini</div>
          <div class="text-sm sm:text-base font-black font-mono text-blue-700 truncate leading-tight mt-0.5">
            Rp {{ formatRupiah(todayProfit) }}
          </div>
          <div class="text-[10px] text-gray-500 truncate">
            Margin: <strong class="text-gray-700 font-mono">{{ todayProfitMargin }}%</strong>
          </div>
        </div>
      </div>

      <!-- Piutang / Tempo -->
      <div class="px-4 py-2.5 flex items-center gap-3 min-w-0">
        <div class="p-2 bg-amber-50 text-amber-600 shrink-0 border border-amber-100">
          <Clock :size="16" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Piutang Tempo</div>
          <div class="text-sm sm:text-base font-black font-mono text-amber-700 truncate leading-tight mt-0.5">
            Rp {{ formatRupiah(totalReceivables) }}
          </div>
          <div class="text-[10px] text-gray-500 truncate">
            <span class="font-bold text-amber-800 font-mono">{{ tempoTransactions.length }}</span> transaksi belum lunas
          </div>
        </div>
      </div>

      <!-- Nilai Stok Fisik -->
      <div class="px-4 py-2.5 flex items-center gap-3 min-w-0">
        <div class="p-2 bg-purple-50 text-purple-600 shrink-0 border border-purple-100">
          <Package :size="16" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Aset Stok Fisik</div>
          <div class="text-sm sm:text-base font-black font-mono text-purple-700 truncate leading-tight mt-0.5">
            Rp {{ formatRupiah(totalInventoryValuation) }}
          </div>
          <div class="text-[10px] text-gray-500 truncate">
            Total: <span class="font-bold text-gray-700 font-mono">{{ totalSkuCount }}</span> SKU aktif
          </div>
        </div>
      </div>

      <!-- Pelanggan & Member -->
      <div class="px-4 py-2.5 flex items-center gap-3 min-w-0 col-span-2 md:col-span-1">
        <div class="p-2 bg-indigo-50 text-indigo-600 shrink-0 border border-indigo-100">
          <Users :size="16" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Pelanggan &amp; Member</div>
          <div class="text-sm sm:text-base font-black font-mono text-indigo-700 truncate leading-tight mt-0.5">
            {{ buyerStore.buyers.length }} Pelanggan
          </div>
          <div class="text-[10px] text-gray-500 truncate">
            <span class="font-bold text-indigo-800 font-mono">{{ buyerStore.memberBuyers.length }}</span> member aktif loyalty
          </div>
        </div>
      </div>
    </div>

    <!-- 3. MAIN WORKSPACE (Split 2 Kolom Penuh: Kiri Grafik & Metode, Kanan Produk & Stok) -->
    <div class="flex-1 flex flex-col lg:flex-row overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
      <!-- Kolom Kiri: Tren Penjualan 7 Hari & Komposisi Metode Pembayaran -->
      <div class="flex-1 lg:w-7/12 flex flex-col overflow-hidden">
        <!-- Sub-Header: Tren Penjualan -->
        <div class="h-8 px-4 flex items-center justify-between border-b border-gray-200 bg-gray-50 shrink-0 font-bold text-gray-700">
          <div class="flex items-center gap-2">
            <BarChart3 :size="14" class="text-blue-600" />
            <span>Tren Penjualan 7 Hari Terakhir</span>
          </div>
          <button
            type="button"
            class="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            @click="emit('open-tab', 'ledger')"
          >
            Lihat Buku Kas &rarr;
          </button>
        </div>

        <!-- Area Grafik Batang -->
        <div class="flex-1 p-4 flex flex-col justify-end overflow-hidden bg-white">
          <div class="flex-1 flex items-end justify-between gap-3 px-2 min-h-[140px]">
            <div
              v-for="day in last7DaysTrend"
              :key="day.dateStr"
              class="flex-1 flex flex-col items-center h-full justify-end group cursor-default"
            >
              <!-- Tooltip Nilai -->
              <div class="text-[10px] font-mono font-bold text-gray-700 opacity-80 group-hover:opacity-100 transition-opacity mb-1 whitespace-nowrap text-center">
                Rp {{ formatRupiah(day.revenue) }}
              </div>

              <!-- Bar -->
              <div class="w-full max-w-[50px] bg-gray-100 relative flex flex-col justify-end" style="height: 100%;">
                <div
                  class="w-full transition-all duration-300"
                  :style="{
                    height: `${day.percent}%`,
                    backgroundColor: day.dateStr === todayStr ? '#2563eb' : '#93c5fd'
                  }"
                ></div>
              </div>

              <!-- Label Bawah -->
              <div class="mt-2 text-center border-t border-gray-100 pt-1 w-full">
                <div class="text-[10.5px] font-bold text-gray-800">{{ day.dayShort }}</div>
                <div class="text-[9.5px] text-gray-500 font-mono">{{ day.dayLabel }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sub-Header: Komposisi Metode Pembayaran -->
        <div class="h-8 px-4 flex items-center justify-between border-t border-b border-gray-200 bg-gray-50 shrink-0 font-bold text-gray-700">
          <div class="flex items-center gap-2">
            <CreditCard :size="14" class="text-emerald-600" />
            <span>Komposisi Metode Pembayaran</span>
          </div>
          <span class="text-[11px] text-gray-500 font-normal">Total {{ ledgerStore.transactions.length }} Nota Transaksi</span>
        </div>

        <!-- Bar Komposisi Distribusi -->
        <div class="p-4 bg-white shrink-0 border-b lg:border-b-0 border-gray-200">
          <!-- Multi-segment Progress Bar -->
          <div class="h-3 w-full bg-gray-100 flex overflow-hidden mb-3">
            <div
              class="bg-emerald-500 transition-all duration-300"
              :style="{ width: `${paymentBreakdown.tunaiPercent}%` }"
              title="Tunai"
            ></div>
            <div
              class="bg-blue-500 transition-all duration-300"
              :style="{ width: `${paymentBreakdown.nonTunaiPercent}%` }"
              title="Non-Tunai / QRIS"
            ></div>
            <div
              class="bg-amber-500 transition-all duration-300"
              :style="{ width: `${paymentBreakdown.tempoPercent}%` }"
              title="Tempo"
            ></div>
          </div>

          <!-- Rincian 3 Kolom Dipisah Garis -->
          <div class="grid grid-cols-3 divide-x divide-gray-200 border border-gray-200 text-center">
            <div class="p-2.5">
              <div class="flex items-center justify-center gap-1.5 text-emerald-700 font-bold text-[10.5px]">
                <span class="w-2 h-2 bg-emerald-500"></span>
                <span>Tunai / Cash</span>
              </div>
              <div class="text-base font-black font-mono text-gray-900 mt-0.5">
                {{ paymentBreakdown.tunaiPercent }}%
              </div>
              <div class="text-[10px] text-gray-500 font-mono">
                {{ paymentBreakdown.tunaiCount }} transaksi
              </div>
            </div>

            <div class="p-2.5">
              <div class="flex items-center justify-center gap-1.5 text-blue-700 font-bold text-[10.5px]">
                <span class="w-2 h-2 bg-blue-500"></span>
                <span>Transfer / QRIS</span>
              </div>
              <div class="text-base font-black font-mono text-gray-900 mt-0.5">
                {{ paymentBreakdown.nonTunaiPercent }}%
              </div>
              <div class="text-[10px] text-gray-500 font-mono">
                {{ paymentBreakdown.nonTunaiCount }} transaksi
              </div>
            </div>

            <div class="p-2.5">
              <div class="flex items-center justify-center gap-1.5 text-amber-700 font-bold text-[10.5px]">
                <span class="w-2 h-2 bg-amber-500"></span>
                <span>Tempo / Piutang</span>
              </div>
              <div class="text-base font-black font-mono text-gray-900 mt-0.5">
                {{ paymentBreakdown.tempoPercent }}%
              </div>
              <div class="text-[10px] text-gray-500 font-mono">
                {{ paymentBreakdown.tempoCount }} transaksi
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Kolom Kanan: Produk Terlaris & Stok Kritis -->
      <div class="flex-1 lg:w-5/12 flex flex-col overflow-hidden bg-white">
        <!-- Sub-Header: Produk Terlaris -->
        <div class="h-8 px-4 flex items-center justify-between border-b border-gray-200 bg-gray-50 shrink-0 font-bold text-gray-700">
          <div class="flex items-center gap-2">
            <Sparkles :size="14" class="text-amber-500" />
            <span>Produk Terlaris</span>
          </div>
          <button
            type="button"
            class="text-[11px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
            @click="emit('open-tab', 'reports')"
          >
            Laporan Detail &rarr;
          </button>
        </div>

        <!-- Tabel Produk Terlaris -->
        <div class="flex-1 overflow-y-auto divide-y divide-gray-200 min-h-[140px]">
          <div v-if="topProducts.length === 0" class="p-6 text-center text-gray-400">
            Belum ada data penjualan tercatat.
          </div>
          <div
            v-for="(prod, i) in topProducts"
            :key="prod.name"
            class="px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <span
                class="w-5 h-5 flex items-center justify-center text-[10px] font-mono font-bold shrink-0 border"
                :class="i === 0 ? 'bg-amber-100 text-amber-900 border-amber-300' : (i === 1 ? 'bg-gray-200 text-gray-800 border-gray-300' : 'bg-gray-50 text-gray-600 border-gray-200')"
              >
                {{ i + 1 }}
              </span>
              <div class="min-w-0">
                <div class="font-bold text-gray-900 truncate text-[11px]">{{ prod.name }}</div>
                <div class="text-[10px] text-gray-500">{{ prod.category }}</div>
              </div>
            </div>
            <div class="text-right shrink-0">
              <div class="font-mono font-bold text-emerald-700 text-xs">
                {{ prod.qty }} {{ prod.unit }}
              </div>
              <div class="text-[10px] text-gray-500 font-mono">
                Rp {{ formatRupiah(prod.revenue) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Sub-Header: Peringatan Stok Kritis -->
        <div class="h-8 px-4 flex items-center justify-between border-t border-b border-gray-200 bg-gray-50 shrink-0 font-bold text-gray-700">
          <div class="flex items-center gap-2">
            <AlertTriangle :size="14" class="text-rose-500" />
            <span>Stok Kritis / Perlu Kulakan</span>
          </div>
          <button
            type="button"
            class="text-[11px] text-rose-600 hover:text-rose-800 font-medium cursor-pointer"
            @click="emit('open-tab', 'products')"
          >
            Kelola Stok &rarr;
          </button>
        </div>

        <!-- Tabel Stok Kritis -->
        <div class="flex-1 overflow-y-auto divide-y divide-gray-200 min-h-[140px]">
          <div v-if="lowStockProducts.length === 0" class="p-6 flex items-center justify-center gap-2 text-emerald-700 font-medium text-xs">
            <CheckCircle2 :size="16" class="text-emerald-500" />
            <span>Seluruh stok barang dalam batas aman.</span>
          </div>
          <div
            v-for="item in lowStockProducts"
            :key="item.id"
            class="px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div class="min-w-0">
              <div class="font-bold text-gray-900 truncate text-[11px]">{{ item.name }}</div>
              <div class="text-[10px] text-gray-500 font-mono">SKU: {{ item.code }}</div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="px-2 py-0.5 text-[10.5px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">
                Sisa {{ item.stock }} {{ item.unit }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
