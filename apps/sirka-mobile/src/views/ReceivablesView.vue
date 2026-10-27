<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { SaleTransaction, ReceivablesAgingReport } from '../types';
import { ownerApi } from '../services/api';
import { formatRupiah } from '../utils/formatters';
import HeaderBar from '../components/HeaderBar.vue';
import { Search, Clock, ChevronRight, X, FileText, CheckCircle2, AlertOctagon, AlertTriangle, ShieldCheck } from 'lucide-vue-next';

const loading = ref(false);
const errorMessage = ref('');
const sales = ref<SaleTransaction[]>([]);
const agingData = ref<ReceivablesAgingReport>({
  totalPending: 0,
  totalInvoices: 0,
  bucket0_7: 0,
  bucket8_14: 0,
  bucket15_30: 0,
  bucketOver30: 0,
  items: [],
});
const searchQuery = ref('');
const statusFilter = ref<'Tempo' | 'Semua' | 'Macet' | 'Lunas'>('Tempo');
const selectedTx = ref<SaleTransaction | null>(null);

async function loadData() {
  loading.value = true;
  errorMessage.value = '';
  try {
    // BUG FIX: `Promise.all` menolak kalau salah satu request gagal sehingga
    // hasil request yang BERHASIL ikut dibuang dan halaman menampilkan
    // "0 nota" seolah-olah tidak ada data (padahal server error).
    const [salesRes, agingRes] = await Promise.allSettled([
      ownerApi.getSales(),
      ownerApi.getReceivablesAging(),
    ]);
    if (salesRes.status === 'fulfilled') sales.value = salesRes.value;
    else errorMessage.value = 'Gagal memuat daftar penjualan dari server.';

    if (agingRes.status === 'fulfilled') {
      agingData.value = {
        ...agingData.value,
        ...agingRes.value,
        // BUG FIX: response parsial (tanpa `items`) membuat `for...of undefined`
        // melempar TypeError dan seluruh view gagal dirender.
        items: Array.isArray(agingRes.value?.items) ? agingRes.value.items : [],
      };
    } else {
      errorMessage.value = errorMessage.value || 'Gagal memuat data aging piutang dari server.';
    }
  } finally {
    loading.value = false;
  }
}

// Map invoice age from agingData
const invoiceAgeMap = computed(() => {
  const map: Record<string, { ageDays: number; bucket: string }> = {};
  for (const it of agingData.value.items || []) {
    map[it.id] = { ageDays: it.ageDays, bucket: it.agingBucket };
    if (it.invoiceNo) map[it.invoiceNo] = { ageDays: it.ageDays, bucket: it.agingBucket };
  }
  return map;
});

/**
 * BUG FIX: nilai `paymentStatus` dari API adalah 'LUNAS' / 'TEMPO' (upper case).
 * Perbandingan lama `isTempo(tx)` selalu false sehingga tab
 * "Piutang Tempo" (tab default) selalu kosong meski ada piutang.
 */
function isTempo(tx: { paymentStatus?: string }): boolean {
  return (tx.paymentStatus || '').toUpperCase() === 'TEMPO';
}

function isLunas(tx: { paymentStatus?: string }): boolean {
  return (tx.paymentStatus || '').toUpperCase() === 'LUNAS';
}

const filteredSales = computed(() => {
  return sales.value.filter(tx => {
    const matchSearch =
      (tx.buyer || '').toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (tx.invoiceNo || '').toLowerCase().includes(searchQuery.value.toLowerCase());

    if (!matchSearch) return false;

    if (statusFilter.value === 'Semua') return true;
    if (statusFilter.value === 'Lunas') return isLunas(tx);
    if (statusFilter.value === 'Tempo') return isTempo(tx);
    if (statusFilter.value === 'Macet') {
      const ageInfo = invoiceAgeMap.value[tx.id] || invoiceAgeMap.value[tx.invoiceNo];
      return isTempo(tx) && !!ageInfo && ageInfo.ageDays > 30;
    }

    return true;
  });
});

const totalPending = computed(() => {
  // BUG FIX: `||` menggantikan nilai 0 yang sah dengan perhitungan lain yang
  // berbeda basis-nya. Gunakan `??` supaya 0 tetap berarti 0.
  const fromApi = agingData.value.totalPending;
  if (fromApi !== null && fromApi !== undefined) return fromApi;
  return sales.value
    .filter(tx => isTempo(tx))
    .reduce((acc, tx) => acc + (tx.totalAmount || 0), 0);
});

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="min-h-screen bg-[#ecebe9] pb-20 text-[#2e2b28] font-sans flex flex-col">
    <!-- Header Bar (Full Edge) -->
    <HeaderBar
      title="Buku Piutang &amp; Aging"
      subtitle="Buku Kas &gt; Tagihan Tempo &amp; Umur Nota"
      :loading="loading"
      @refresh="loadData"
    />

    <!-- Main Content (Full Edge) -->
    <!-- BUG FIX: tampilkan pesan error server (sebelumnya halaman menampilkan
         "tidak ada data" padahal sebenarnya request-nya gagal) -->
    <div v-if="errorMessage" class="w-full bg-rose-50 border-b border-rose-300 px-4 py-2 text-[11px] text-rose-800 flex items-start gap-2">
      <AlertTriangle :size="14" class="shrink-0 mt-0.5" />
      <span>{{ errorMessage }}</span>
    </div>
    <main class="w-full flex-1 flex flex-col">
      <!-- 1. Horizontal Scrollable Aging Metric Stats Strip -->
      <div class="w-full bg-white border-b border-[#c8c5c0] overflow-x-auto flex items-center divide-x divide-[#e5e3de] select-none no-scrollbar">
        <!-- Metric 1: Total Piutang Tempo -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0 flex items-center justify-center shadow-2xs">
            <Clock class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Total Piutang
            </div>
            <div class="text-sm font-extrabold font-mono text-[#b45309] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(totalPending) }}
            </div>
          </div>
        </div>

        <!-- Metric 2: Macet (> 30 Hari) -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap bg-red-50/40">
          <div class="w-8 h-8 rounded bg-red-100 text-red-700 border border-red-300 shrink-0 flex items-center justify-center shadow-2xs">
            <AlertOctagon class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-red-700 uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Macet (&gt; 30 Hari)
            </div>
            <div class="text-sm font-extrabold font-mono text-red-700 whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(agingData.bucketOver30) }}
            </div>
          </div>
        </div>

        <!-- Metric 3: Peringatan (15 - 30 Hari) -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-yellow-50 text-yellow-800 border border-yellow-200 shrink-0 flex items-center justify-center shadow-2xs">
            <AlertTriangle class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Peringatan (15-30 Hari)
            </div>
            <div class="text-sm font-extrabold font-mono text-yellow-800 whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(agingData.bucket15_30) }}
            </div>
          </div>
        </div>

        <!-- Metric 4: Lancar (0 - 14 Hari) -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 flex items-center justify-center shadow-2xs">
            <ShieldCheck class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Lancar (0-14 Hari)
            </div>
            <div class="text-sm font-extrabold font-mono text-emerald-700 whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(agingData.bucket0_7 + agingData.bucket8_14) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Full-Cell Search Input Row -->
      <div class="w-full bg-white border-b border-[#c8c5c0] flex items-center h-9 px-3 gap-2">
        <Search class="w-3.5 h-3.5 text-[#6b655f] shrink-0" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari nama pelanggan atau nomor nota..."
          class="flex-1 bg-transparent border-0 outline-none text-xs text-[#2e2b28] placeholder-[#6b655f] h-full"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="text-[#6b655f] hover:text-[#2e2b28] cursor-pointer p-1"
        >
          <X class="w-3.5 h-3.5" />
        </button>
        <span class="text-[10.5px] text-[#6b655f] font-mono shrink-0 pl-1.5 border-l border-[#e5e3de]">
          {{ filteredSales.length }} nota
        </span>
      </div>

      <!-- Full-Cell Filter Segmented Bar -->
      <div class="w-full bg-[#dfddd9] border-b border-[#c8c5c0] flex divide-x divide-[#c8c5c0] text-xs font-semibold select-none">
        <button
          v-for="st in (['Tempo', 'Macet', 'Semua', 'Lunas'] as const)"
          :key="st"
          @click="statusFilter = st"
          class="flex-1 py-1.5 text-center transition-all cursor-pointer"
          :class="statusFilter === st
            ? (st === 'Macet' ? 'bg-red-600 text-white font-bold shadow-xs' : 'bg-[#ecebe9] text-[#2563eb] font-bold shadow-xs')
            : 'text-[#6b655f] hover:bg-[#d6d4cf] hover:text-[#2e2b28]'"
        >
          {{ st === 'Tempo' ? 'Piutang Tempo' : (st === 'Macet' ? 'Macet (>30 HARI)' : st) }}
        </button>
      </div>

      <!-- 3. Full-Edge Desktop Explorer Table (No Wrap) -->
      <div class="w-full bg-white border-b border-[#c8c5c0] overflow-x-auto">
        <table class="table-explorer whitespace-nowrap min-w-full">
          <thead>
            <tr>
              <th class="whitespace-nowrap px-3 py-2 text-left">No. Nota</th>
              <th class="whitespace-nowrap px-3 py-2 text-left">Pelanggan</th>
              <th class="whitespace-nowrap px-3 py-2 text-left">Tanggal</th>
              <th class="whitespace-nowrap px-3 py-2 text-center">Umur Tagihan</th>
              <th class="whitespace-nowrap px-3 py-2 text-center">Status</th>
              <th class="whitespace-nowrap px-3 py-2 text-right">Nominal Tagihan</th>
              <th class="whitespace-nowrap px-2 py-2 text-center"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tx in filteredSales"
              :key="tx.id"
              @click="selectedTx = tx"
              class="cursor-pointer hover:bg-[#faf9f7] transition-colors"
            >
              <td class="whitespace-nowrap font-mono font-semibold text-[#2563eb] text-[11px] px-3 py-2">
                {{ tx.invoiceNo }}
              </td>
              <td class="whitespace-nowrap font-bold text-[#2e2b28] text-xs px-3 py-2">
                {{ tx.buyer }}
              </td>
              <td class="whitespace-nowrap text-[11px] text-[#6b655f] font-mono px-3 py-2">
                {{ tx.date }}
              </td>
              <td class="whitespace-nowrap text-center px-3 py-2">
                <span
                  v-if="isTempo(tx)"
                  class="inline-block px-1.5 py-0.5 rounded-xs text-[9.5px] font-mono font-bold border"
                  :class="{
                    'bg-red-100 text-red-800 border-red-300': (invoiceAgeMap[tx.id]?.ageDays || 0) > 30,
                    'bg-yellow-100 text-yellow-800 border-yellow-300': (invoiceAgeMap[tx.id]?.ageDays || 0) > 14 && (invoiceAgeMap[tx.id]?.ageDays || 0) <= 30,
                    'bg-blue-100 text-blue-800 border-blue-200': (invoiceAgeMap[tx.id]?.ageDays || 0) > 7 && (invoiceAgeMap[tx.id]?.ageDays || 0) <= 14,
                    'bg-emerald-100 text-emerald-800 border-emerald-200': (invoiceAgeMap[tx.id]?.ageDays || 0) <= 7,
                  }"
                >
                  {{ invoiceAgeMap[tx.id]?.ageDays ?? 0 }} Hari
                </span>
                <span v-else class="text-[#6b655f] text-[10px] font-mono">-</span>
              </td>
              <td class="whitespace-nowrap text-center px-3 py-2">
                <span
                  class="inline-block px-1.5 py-0.5 rounded-xs text-[9.5px] font-bold border"
                  :class="isTempo(tx)
                    ? 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]'
                    : 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]'"
                >
                  {{ tx.paymentStatus }}
                </span>
              </td>
              <td class="whitespace-nowrap text-right font-bold font-mono text-[#2e2b28] text-xs px-3 py-2">
                {{ formatRupiah(tx.totalAmount) }}
              </td>
              <td class="whitespace-nowrap text-center text-[#6b655f] px-2 py-2">
                <ChevronRight class="w-3.5 h-3.5 inline" />
              </td>
            </tr>

            <tr v-if="filteredSales.length === 0">
              <td colspan="5" class="text-center py-10 text-[#6b655f] text-xs">
                Tidak ada data nota atau piutang yang cocok.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <!-- Detail Invoice Dialog Overlay -->
    <div
      v-if="selectedTx"
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-3 select-none"
    >
      <div class="w-full max-w-sm bg-[#ecebe9] border border-[#b8b5af] rounded-xs shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
        <!-- Titlebar -->
        <div class="h-8 px-3 flex items-center justify-between bg-[#dfddd9] border-b border-[#c8c5c0] text-xs shrink-0">
          <div class="flex items-center gap-1.5 font-bold text-[#2e2b28]">
            <FileText class="w-3.5 h-3.5 text-[#2563eb]" />
            <span>Faktur: {{ selectedTx.invoiceNo }}</span>
          </div>
          <button @click="selectedTx = null" class="text-[#6b655f] hover:text-[#2e2b28] cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-3 bg-white flex-1 overflow-y-auto space-y-3 text-xs">
          <div class="flex justify-between items-start pb-2 border-b border-[#e5e3de]">
            <div>
              <div class="text-[10px] text-[#6b655f] uppercase font-bold">Pelanggan:</div>
              <div class="font-bold text-sm text-[#2e2b28]">{{ selectedTx.buyer }}</div>
              <div class="text-[10.5px] text-[#6b655f] font-mono mt-0.5">{{ selectedTx.date }}</div>
            </div>
            <span
              class="px-2 py-0.5 rounded-xs text-[10px] font-bold border"
              :class="selectedTx.paymentStatus === 'Tempo'
                ? 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]'
                : 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]'"
            >
              {{ selectedTx.paymentStatus }}
            </span>
          </div>

          <!-- Items Table -->
          <div class="border border-[#c8c5c0]">
            <table class="table-explorer">
              <thead>
                <tr>
                  <th>Barang</th>
                  <th class="w-12 text-center">Qty</th>
                  <th class="w-24 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(it, idx) in selectedTx.items" :key="idx">
                  <td class="font-medium text-[#2e2b28]">{{ it.name }}</td>
                  <td class="text-center font-mono">{{ it.qty }}</td>
                  <td class="text-right font-mono font-bold">{{ formatRupiah(it.subtotalSell ?? it.subtotal ?? 0) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Totals -->
          <div class="pt-2 border-t border-[#e5e3de] space-y-1">
            <div class="flex justify-between text-[#6b655f]">
              <span>Metode Bayar</span>
              <span class="font-bold font-mono text-[#2e2b28]">{{ selectedTx.paymentMethod }}</span>
            </div>
            <div class="flex justify-between font-extrabold text-sm text-[#2563eb] pt-1 border-t border-[#f0ede8]">
              <span>Total Tagihan</span>
              <span class="font-mono">{{ formatRupiah(selectedTx.totalAmount) }}</span>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="p-2 bg-[#dfddd9] border-t border-[#c8c5c0] flex justify-end shrink-0">
          <button
            @click="selectedTx = null"
            class="explorer-btn px-4 py-1 text-xs font-bold rounded-xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
