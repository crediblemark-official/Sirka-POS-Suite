<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLedgerStore } from '../../stores/ledgerStore';
import { PaymentStatus, Transaction } from '../../types';
import {
  BookOpen,
  Printer,
  Trash2,
  Building,
  UserCheck,
  FileText,
  TrendingUp,
  PackageCheck,
  Coins,
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  RotateCcw
} from 'lucide-vue-next';

import { useBuyerStore } from '../../stores/buyerStore';
import { formatRupiah } from '../../utils/formatters';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const emit = defineEmits<{
  (e: 'view-receipt', tx: Transaction): void;
}>();

const ledgerStore = useLedgerStore();
const buyerStore = useBuyerStore();

const localSearchQuery = ref('');
const filterBuyer = ref<string>('Semua');
const filterStatus = ref<PaymentStatus | 'Semua'>('Semua');
const filterMarket = ref<'Semua' | 'B2B' | 'B2C'>('Semua');
const viewMode = ref<'transactions' | 'items'>('transactions');

const expandedTxIds = ref<Set<string>>(new Set());

function toggleTxExpand(id: string) {
  if (expandedTxIds.value.has(id)) {
    expandedTxIds.value.delete(id);
  } else {
    expandedTxIds.value.add(id);
  }
}

type LedgerFilterType = 'status' | 'market' | 'buyer';
const activeFilterType = ref<LedgerFilterType>('status');

const buyers = computed(() => ['Semua', ...buyerStore.buyers.map(b => b.name)]);

function getBuyerCount(b: string) {
  if (b === 'Semua') return ledgerStore.transactions.length;
  return ledgerStore.transactions.filter(t => t.buyer === b).length;
}

const buyerOptions = computed<SelectOption[]>(() => {
  return buyers.value.map(b => ({
    value: b,
    label: b === 'Semua' ? 'Semua Pelanggan' : b,
    badge: `${getBuyerCount(b)} nota`
  }));
});

const hasActiveFilter = computed(() => {
  return filterStatus.value !== 'Semua' || filterMarket.value !== 'Semua' || filterBuyer.value !== 'Semua';
});

function resetFilters() {
  filterStatus.value = 'Semua';
  filterMarket.value = 'Semua';
  filterBuyer.value = 'Semua';
}

// Counts for filter ribbon
const lunasCount = computed(() => ledgerStore.transactions.filter(t => t.paymentStatus === 'LUNAS').length);
const tempoCount = computed(() => ledgerStore.transactions.filter(t => t.paymentStatus === 'TEMPO').length);
const b2bCount = computed(() => ledgerStore.transactions.filter(t => (t.customerType || 'B2B') === 'B2B').length);
const b2cCount = computed(() => ledgerStore.transactions.filter(t => t.customerType === 'B2C').length);

const filteredTransactions = computed(() => {
  return ledgerStore.transactions.filter(t => {
    const matchBuyer = filterBuyer.value === 'Semua' || t.buyer === filterBuyer.value;
    const matchStatus = filterStatus.value === 'Semua' || t.paymentStatus === filterStatus.value;
    const matchMarket = filterMarket.value === 'Semua' || (t.customerType || 'B2B') === filterMarket.value;
    const q = (props.searchQuery || localSearchQuery.value).toLowerCase().trim();
    const matchSearch =
      !q ||
      t.invoiceNo.toLowerCase().includes(q) ||
      t.buyer.toLowerCase().includes(q) ||
      t.items.some(i => i.name.toLowerCase().includes(q));
    return matchBuyer && matchStatus && matchSearch && matchMarket;
  });
});

const isAllExpanded = computed(() => {
  return filteredTransactions.value.length > 0 && filteredTransactions.value.every(tx => expandedTxIds.value.has(tx.id));
});

function toggleExpandAll() {
  if (isAllExpanded.value) {
    expandedTxIds.value.clear();
  } else {
    filteredTransactions.value.forEach(tx => expandedTxIds.value.add(tx.id));
  }
}

// 6 Metrik Keuangan Lengkap
const totalRevenueFiltered = computed(() => {
  return filteredTransactions.value.reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
});

const totalBuyFiltered = computed(() => {
  return filteredTransactions.value.reduce((acc, t) => acc + (t.totalBuy || 0), 0);
});

const totalProfitFiltered = computed(() => {
  return filteredTransactions.value.reduce((acc, t) => acc + (t.totalProfit || 0), 0);
});

const profitMarginPercent = computed(() => {
  if (totalBuyFiltered.value === 0) return 0;
  return Number(((totalProfitFiltered.value / totalBuyFiltered.value) * 100).toFixed(1));
});

const totalReceivablesFiltered = computed(() => {
  return filteredTransactions.value
    .filter(t => t.paymentStatus === 'TEMPO')
    .reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
});

const uniqueBuyersCount = computed(() => {
  const set = new Set(filteredTransactions.value.map(t => t.buyer));
  return set.size;
});

const filteredFlatRows = computed(() => {
  return ledgerStore.flatLedgerRows.filter(r => {
    const matchBuyer = filterBuyer.value === 'Semua' || r.buyer === filterBuyer.value;
    const matchStatus = filterStatus.value === 'Semua' || r.paymentStatus === filterStatus.value;
    const q = (props.searchQuery || localSearchQuery.value).toLowerCase().trim();
    const matchSearch =
      !q ||
      r.invoiceNo.toLowerCase().includes(q) ||
      r.productName.toLowerCase().includes(q) ||
      r.buyer.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q);
    return matchBuyer && matchStatus && matchSearch;
  });
});

function handleToggleStatus(txId: string) {
  ledgerStore.togglePaymentStatus(txId);
}

// DRY Metric Stats configuration
const metricStats = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Transaksi',
    value: `${filteredTransactions.value.length} Nota`,
    icon: FileText,
    iconBoxClass: 'bg-indigo-50 text-indigo-700',
    valClass: 'text-gray-800'
  },
  {
    label: 'Total Omzet Penjualan',
    value: `Rp ${formatRupiah(totalRevenueFiltered.value)}`,
    icon: TrendingUp,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-blue-700'
  },
  {
    label: 'Modal Barang (HPP)',
    value: `Rp ${formatRupiah(totalBuyFiltered.value)}`,
    icon: PackageCheck,
    iconBoxClass: 'bg-emerald-50 text-emerald-700',
    valClass: 'text-emerald-700'
  },
  {
    label: 'Untung Bersih (Laba)',
    value: `+Rp ${formatRupiah(totalProfitFiltered.value)}`,
    sublabel: `(+${profitMarginPercent.value}%)`,
    icon: Coins,
    iconBoxClass: 'bg-teal-50 text-teal-700',
    valClass: 'text-teal-800',
    sublabelClass: 'text-emerald-600 font-semibold font-mono'
  },
  {
    label: 'Piutang / Bon Tempo',
    value: `Rp ${formatRupiah(totalReceivablesFiltered.value)}`,
    icon: Clock,
    iconBoxClass: 'bg-amber-50 text-amber-700',
    valClass: 'text-amber-900'
  },
  {
    label: 'Pelanggan Aktif',
    value: `${uniqueBuyersCount.value} Pembeli`,
    icon: Users,
    iconBoxClass: 'bg-purple-50 text-purple-700',
    valClass: 'text-purple-900'
  }
]);
async function handleDeleteTransaction(id: string) {
  if (!confirm('Hapus catatan transaksi ini? Penghapusan catatan tidak membatalkan stok atau poin penjualan.')) return;
  try { await ledgerStore.deleteTransaction(id); } catch (error) { alert(`Gagal menghapus transaksi: ${error}`); }
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- 1. Top Ribbon: Tab Jenis Filter & Horizontal Options -->
    <div class="relative z-30 flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 py-1.5 select-none shrink-0 gap-2">
      <!-- Sisi Kiri: Switcher Tab Jenis Filter + Pill Opsi -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Tab Pilihan Jenis Filter -->
        <div class="flex bg-gray-200/90 p-0.5 rounded border border-gray-300 shrink-0">
          <button
            type="button"
            class="px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
            :class="activeFilterType === 'status' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeFilterType = 'status'"
          >
            <Clock :size="12" />
            <span>Status</span>
            <span v-if="filterStatus !== 'Semua'" class="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
          </button>

          <button
            type="button"
            class="px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
            :class="activeFilterType === 'market' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeFilterType = 'market'"
          >
            <Building :size="12" />
            <span>Pasar</span>
            <span v-if="filterMarket !== 'Semua'" class="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
          </button>

          <button
            type="button"
            class="px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
            :class="activeFilterType === 'buyer' ? 'bg-white text-indigo-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeFilterType = 'buyer'"
          >
            <Users :size="12" />
            <span>Pelanggan</span>
            <span v-if="filterBuyer !== 'Semua'" class="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
          </button>
        </div>

        <div class="h-4 w-px bg-gray-300 shrink-0"></div>

        <!-- 1.1 Pill Options: Status Pembayaran -->
        <div v-if="activeFilterType === 'status'" class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
            :class="filterStatus === 'Semua' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="filterStatus = 'Semua'"
          >
            <span>Semua Status</span>
            <span class="text-[10px] px-1 rounded-full" :class="filterStatus === 'Semua' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-600'">
              {{ ledgerStore.transactions.length }}
            </span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
            :class="filterStatus === 'LUNAS' ? 'bg-emerald-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="filterStatus = 'LUNAS'"
          >
            <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            <span>Lunas</span>
            <span class="text-[10px] px-1 rounded-full" :class="filterStatus === 'LUNAS' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'">
              {{ lunasCount }}
            </span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
            :class="filterStatus === 'TEMPO' ? 'bg-amber-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="filterStatus = 'TEMPO'"
          >
            <span class="w-2 h-2 rounded-full bg-amber-300 inline-block"></span>
            <span>Bon / Utang (Tempo)</span>
            <span class="text-[10px] px-1 rounded-full" :class="filterStatus === 'TEMPO' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-900 border border-amber-200 font-bold'">
              {{ tempoCount }}
            </span>
          </button>
        </div>

        <!-- 1.2 Pill Options: Jenis Pasar -->
        <div v-else-if="activeFilterType === 'market'" class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
            :class="filterMarket === 'Semua' ? 'bg-gray-800 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="filterMarket = 'Semua'"
          >
            <span>Semua Transaksi</span>
            <span class="text-[10px] px-1 rounded-full" :class="filterMarket === 'Semua' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'">
              {{ ledgerStore.transactions.length }}
            </span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
            :class="filterMarket === 'B2B' ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="filterMarket = 'B2B'"
          >
            <Building :size="11" />
            <span>Grosir (B2B)</span>
            <span class="text-[10px] px-1 rounded-full" :class="filterMarket === 'B2B' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'">
              {{ b2bCount }}
            </span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
            :class="filterMarket === 'B2C' ? 'bg-teal-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="filterMarket = 'B2C'"
          >
            <UserCheck :size="11" />
            <span>Eceran (B2C)</span>
            <span class="text-[10px] px-1 rounded-full" :class="filterMarket === 'B2C' ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600'">
              {{ b2cCount }}
            </span>
          </button>
        </div>

        <!-- 1.3 SearchableSelect: Pelanggan -->
        <div v-else-if="activeFilterType === 'buyer'" class="w-64 shrink-0 relative z-40">
          <SearchableSelect
            v-model="filterBuyer"
            :options="buyerOptions"
            placeholder="Cari / Pilih Pelanggan..."
            search-placeholder="Ketik nama pelanggan..."
            size="sm"
          />
        </div>
      </div>

      <!-- Sisi Kanan: Reset, Search, Mode Switcher & Ekspor Excel -->
      <div class="flex items-center gap-2 shrink-0">
        <button
          v-if="hasActiveFilter"
          type="button"
          class="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer transition-colors"
          title="Reset semua filter"
          @click="resetFilters"
        >
          <RotateCcw :size="11" />
          <span>Reset Filter</span>
        </button>

        <span v-if="props.searchQuery" class="text-[11px] text-indigo-700 font-medium bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
          Cari: "{{ props.searchQuery }}"
        </span>

        <!-- View Mode Switcher -->
        <div class="flex bg-gray-200/80 p-0.5 rounded border border-gray-300">
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all"
            :class="viewMode === 'transactions' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="viewMode = 'transactions'"
          >
            Nota
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all"
            :class="viewMode === 'items' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="viewMode = 'items'"
          >
            Rincian Barang
          </button>
        </div>
      </div>
    </div>

    <!-- 2. Reusable MetricStatsStrip (DRY) -->
    <MetricStatsStrip :items="metricStats" />

    <!-- 3. Main Workspace: Edge-to-Edge Table (Modular & DRY) -->
    <div class="flex-1 flex flex-col overflow-hidden bg-white">
      <div class="flex-1 overflow-auto">
        <!-- Reusable Empty State -->
        <AppEmptyState
          v-if="ledgerStore.transactions.length === 0"
          :icon="BookOpen"
          title="Belum Ada Transaksi Tercatat"
          description="Selesaikan transaksi penjualan di tab Kasir POS untuk mengisi buku besar."
        />

        <!-- Mode 1: Per Nota Transaksi (Standar Identik SupplierReceiving) -->
        <table
          v-else-if="viewMode === 'transactions'"
          class="table-explorer min-w-[1050px]"
        >
          <thead>
            <tr>
              <th class="w-12 text-center">
                <button
                  type="button"
                  class="p-1 hover:bg-black/10 rounded cursor-pointer transition-colors"
                  :title="isAllExpanded ? 'Tutup semua rincian nota' : 'Buka semua rincian nota'"
                  @click="toggleExpandAll"
                >
                  <ChevronsDownUp v-if="isAllExpanded" :size="14" class="text-indigo-800" />
                  <ChevronsUpDown v-else :size="14" class="text-gray-600" />
                </button>
              </th>
              <th class="w-48">NO. NOTA</th>
              <th class="w-24 text-center">TANGGAL</th>
              <th class="w-16 text-center">JENIS</th>
              <th class="w-40">PELANGGAN</th>
              <th class="w-24 text-center">TOTAL ITEM</th>
              <th class="w-32 text-right">MODAL (HPP)</th>
              <th class="w-32 text-right">TOTAL NOTA</th>
              <th class="w-32 text-right">UNTUNG BERSIH</th>
              <th class="w-28 text-center">STATUS BAYAR</th>
              <!-- Sticky Action Header -->
              <th class="th-action-sticky w-20">AKSI</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="tx in filteredTransactions" :key="tx.id">
              <tr
                class="cursor-pointer"
                :class="{ 'bg-[#fefcf8]': expandedTxIds.has(tx.id) }"
                @click="toggleTxExpand(tx.id)"
              >
                <td class="text-center text-gray-400">
                  <ChevronUp v-if="expandedTxIds.has(tx.id)" :size="14" class="inline text-indigo-700" />
                  <ChevronDown v-else :size="14" class="inline" />
                </td>
                <td class="font-mono font-bold text-blue-700 whitespace-nowrap" :title="tx.invoiceNo">{{ tx.invoiceNo }}</td>
                <td class="font-mono text-gray-500 text-center whitespace-nowrap">{{ tx.date }}</td>
                <td class="text-center whitespace-nowrap">
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    :class="tx.customerType === 'B2C' ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'"
                  >
                    {{ tx.customerType || 'B2B' }}
                  </span>
                </td>
                <td class="whitespace-nowrap" :title="tx.buyer">
                  <span class="px-2 py-0.5 bg-gray-100 rounded font-semibold text-gray-800 text-[11px] inline-block truncate max-w-[170px]">
                    {{ tx.buyer }}
                  </span>
                </td>
                <td class="text-center font-mono font-semibold text-gray-700 whitespace-nowrap" :title="`${tx.items.length} item barang terjual (Klik baris untuk rincian)`">
                  {{ tx.items.length }} Item
                </td>
                <td class="text-right font-mono text-gray-600 whitespace-nowrap">Rp {{ formatRupiah(tx.totalBuy) }}</td>
                <td class="text-right font-mono font-bold text-blue-700 whitespace-nowrap">Rp {{ formatRupiah(tx.finalTotal ?? tx.totalSell) }}</td>
                <td class="text-right font-mono font-bold text-emerald-700 whitespace-nowrap">Rp {{ formatRupiah(tx.totalProfit) }}</td>
                <td class="text-center whitespace-nowrap" @click.stop>
                  <button
                    type="button"
                    class="px-2.5 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-all border"
                    :class="tx.paymentStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'"
                    title="Klik untuk mengubah Lunas / Tempo"
                    @click="handleToggleStatus(tx.id)"
                  >
                    {{ tx.paymentStatus }}
                  </button>
                </td>
                <!-- Sticky Action Cell (Right Anchor) -->
                <td class="td-action-sticky whitespace-nowrap" @click.stop>
                  <div class="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      class="p-1 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                      title="Cetak Ulang Nota"
                      @click="emit('view-receipt', tx)"
                    >
                      <Printer :size="13" />
                    </button>
                    <button
                      type="button"
                      class="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                      title="Hapus Transaksi"
                      @click="handleDeleteTransaction(tx.id)"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </div>
                </td>
              </tr>

              <!-- EXPANDED DETAIL SUBTABLE -->
              <tr v-if="expandedTxIds.has(tx.id)" class="subtable-row border-b border-indigo-200">
                <td colspan="11" class="p-0!">
                  <div class="bg-white overflow-hidden border-y border-indigo-200/80">
                    <div class="px-4 py-2 bg-[#f6f4ee] border-b border-indigo-200/80 font-bold text-gray-700 flex items-center justify-between text-[11px] whitespace-nowrap">
                      <div class="flex items-center gap-2">
                        <FileText :size="13" class="text-indigo-800" />
                        <span>Rincian Transaksi Faktur: <span class="font-mono text-blue-700">{{ tx.invoiceNo }}</span></span>
                        <span class="text-gray-300">|</span>
                        <span class="text-gray-600 font-normal">Pelanggan: <strong class="text-gray-800">{{ tx.buyer }}</strong> ({{ tx.customerType || 'B2B' }})</span>
                        <span class="text-gray-300">|</span>
                        <span class="text-gray-500 font-mono font-normal">Tgl: {{ tx.date }}</span>
                      </div>
                      <div class="flex items-center gap-3">
                        <span class="text-gray-600 font-normal">Total: <strong>{{ tx.items.length }} barang</strong></span>
                        <span class="text-gray-300">|</span>
                        <span class="font-mono text-gray-600 font-normal">Modal: Rp {{ formatRupiah(tx.totalBuy) }}</span>
                        <span class="text-gray-300">|</span>
                        <span class="font-mono font-bold text-blue-700">Total Nota: Rp {{ formatRupiah(tx.finalTotal ?? tx.totalSell) }}</span>
                        <span class="text-gray-300">|</span>
                        <span class="font-mono font-bold text-emerald-700">Untung: Rp {{ formatRupiah(tx.totalProfit) }}</span>
                      </div>
                    </div>

                    <table class="w-full text-xs text-left border-collapse">
                      <thead class="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold text-[10.5px]">
                        <tr class="h-7">
                          <th class="px-4 py-1.5 text-center w-10">NO</th>
                          <th class="px-3 py-1.5">NAMA BARANG</th>
                          <th class="px-3 py-1.5 text-center w-20">QTY</th>
                          <th class="px-3 py-1.5 text-center w-20">SATUAN</th>
                          <th class="px-3 py-1.5 text-right w-28 whitespace-nowrap">MODAL (HPP)</th>
                          <th class="px-3 py-1.5 text-right w-32 whitespace-nowrap">HARGA JUAL</th>
                          <th class="px-3 py-1.5 text-right w-32 whitespace-nowrap">SUBTOTAL</th>
                          <th class="px-4 py-1.5 text-right w-32 whitespace-nowrap pr-4">LABA ITEM</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        <tr
                          v-for="(it, iIdx) in tx.items"
                          :key="it.id"
                          class="hover:bg-indigo-50/30 transition-colors"
                        >
                          <td class="px-4 py-1.5 text-center text-gray-400 font-mono">{{ iIdx + 1 }}</td>
                          <td class="px-3 py-1.5 font-semibold text-gray-800" :title="it.name">{{ it.name }}</td>
                          <td class="px-3 py-1.5 text-center font-mono font-bold text-gray-900">{{ it.qty }}</td>
                          <td class="px-3 py-1.5 text-center text-gray-500 font-mono">{{ it.unit }}</td>
                          <td class="px-3 py-1.5 text-right font-mono text-gray-600 whitespace-nowrap">Rp {{ formatRupiah(it.buyPrice) }}</td>
                          <td class="px-3 py-1.5 text-right font-mono text-blue-700 whitespace-nowrap">Rp {{ formatRupiah(it.sellPrice) }}</td>
                          <td class="px-3 py-1.5 text-right font-mono font-bold text-gray-900 whitespace-nowrap">Rp {{ formatRupiah(it.subtotalSell) }}</td>
                          <td class="px-4 py-1.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap pr-4">Rp {{ formatRupiah(it.profit) }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>

        <!-- Mode 2: Per Baris Barang (Spreadsheet) -->
        <table
          v-else
          class="table-explorer min-w-[1100px]"
        >
          <thead>
            <tr>
              <th class="w-12 text-center">NO</th>
              <th class="w-24 text-center">TANGGAL</th>
              <th class="w-36">PEMBELI</th>
              <th class="w-28">VENDOR</th>
              <th class="min-w-[200px]">NAMA BARANG</th>
              <th class="w-14 text-center">QTY</th>
              <th class="w-16 text-center">SATUAN</th>
              <th class="w-28 text-right">MODAL</th>
              <th class="w-28 text-right">HARGA JUAL</th>
              <th class="w-32 text-right">SUBTOTAL</th>
              <th class="w-28 text-right">LABA</th>
              <th class="w-44">NO. NOTA</th>
              <th class="th-action-sticky w-24">STATUS</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in filteredFlatRows"
              :key="idx"
            >
              <td class="text-center font-mono text-gray-400 whitespace-nowrap">{{ idx + 1 }}</td>
              <td class="font-mono text-gray-500 text-center whitespace-nowrap">{{ row.date }}</td>
              <td class="font-medium text-gray-800" :title="row.buyer">{{ row.buyer }}</td>
              <td class="text-gray-500 truncate" :title="row.category">{{ row.category }}</td>
              <td class="font-semibold text-gray-900" :title="row.productName">{{ row.productName }}</td>
              <td class="text-center font-mono font-bold whitespace-nowrap">{{ row.qty }}</td>
              <td class="text-center text-gray-500 whitespace-nowrap">{{ row.unit }}</td>
              <td class="text-right font-mono text-gray-500 whitespace-nowrap">Rp {{ formatRupiah(row.buyPrice) }}</td>
              <td class="text-right font-mono text-gray-700 whitespace-nowrap">Rp {{ formatRupiah(row.sellPrice) }}</td>
              <td class="text-right font-mono font-bold text-blue-700 whitespace-nowrap">Rp {{ formatRupiah(row.totalSell) }}</td>
              <td class="text-right font-mono font-bold text-emerald-700 whitespace-nowrap">Rp {{ formatRupiah(row.profit) }}</td>
              <td class="font-mono text-blue-700 text-xs whitespace-nowrap" :title="row.invoiceNo">{{ row.invoiceNo }}</td>
              <td class="td-action-sticky whitespace-nowrap">
                <span
                  class="px-2 py-0.5 rounded font-bold text-[10px] inline-block border"
                  :class="row.paymentStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'"
                >
                  {{ row.paymentStatus }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
