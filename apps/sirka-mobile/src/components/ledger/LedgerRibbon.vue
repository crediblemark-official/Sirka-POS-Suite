<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Clock,
  Building,
  Users,
  UserCheck,
  RotateCcw,
  CreditCard,
  Banknote,
  Landmark,
  QrCode,
  FileText,
  Plus,
  SlidersHorizontal,
  X
} from 'lucide-vue-next';
import { PaymentStatus } from '../../types';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import DateRangePicker from '../common/DateRangePicker.vue';
import AppFilterDrawer from '../common/AppFilterDrawer.vue';

const props = defineProps<{
  filterStatus: PaymentStatus | 'Semua';
  filterMethod?: string;
  filterMarket: 'Semua' | 'B2B' | 'B2C';
  filterBuyer: string;
  filterStartDate?: string;
  filterEndDate?: string;
  viewMode: 'transactions' | 'items' | 'refunds' | 'mutations';
  searchQuery?: string;
  totalTransactionsCount: number;
  lunasCount: number;
  tempoCount: number;
  tunaiCount?: number;
  transferCount?: number;
  qrisCount?: number;
  notaTempoCount?: number;
  b2bCount: number;
  b2cCount: number;
  refundsCount?: number;
  mutationsCount?: number;
  buyerOptions: SelectOption[];
  hasActiveFilter: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:filterStatus', value: PaymentStatus | 'Semua'): void;
  (e: 'update:filterMethod', value: string): void;
  (e: 'update:filterMarket', value: 'Semua' | 'B2B' | 'B2C'): void;
  (e: 'update:filterBuyer', value: string): void;
  (e: 'update:filterStartDate', value: string): void;
  (e: 'update:filterEndDate', value: string): void;
  (e: 'update:viewMode', value: 'transactions' | 'items' | 'refunds' | 'mutations'): void;
  (e: 'open-mutation'): void;
  (e: 'open-expense'): void;
  (e: 'open-transfer'): void;
  (e: 'reset-filters'): void;
}>();

const showFilterDrawer = ref(false);

const activeFiltersCount = computed(() => {
  let count = 0;
  if (props.filterStatus !== 'Semua') count++;
  if (props.filterMethod && props.filterMethod !== 'Semua') count++;
  if (props.filterMarket !== 'Semua') count++;
  if (props.filterBuyer !== 'Semua') count++;
  return count;
});

function onBuyerChange(val: string | number) {
  emit('update:filterBuyer', String(val));
}
</script>

<template>
  <div class="relative z-30 flex flex-col bg-[#f6f5f2] border-b border-gray-200 select-none shrink-0 shadow-2xs">
    <!-- Baris 1: Mode Switcher (Nota, Rincian, Retur, Mutasi Kas) + Tombol Aksi (+ Mutasi, Reset) -->
    <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-200/60 overflow-x-auto no-scrollbar">
      <!-- Mode View Tabs: Nota | Rincian | Retur | Mutasi Kas -->
      <div class="flex bg-gray-200/90 p-0.5 rounded-lg border border-gray-300 shrink-0">
        <button type="button" class="px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all shrink-0 whitespace-nowrap"
          :class="viewMode === 'transactions' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-600 hover:text-black'"
          @click="emit('update:viewMode', 'transactions')">
          Nota
        </button>
        <button type="button" class="px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all shrink-0 whitespace-nowrap"
          :class="viewMode === 'items' ? 'bg-white text-gray-900 shadow-xs font-bold' : 'text-gray-600 hover:text-black'"
          @click="emit('update:viewMode', 'items')">
          Rincian Barang
        </button>
        <button type="button"
          class="px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
          :class="viewMode === 'refunds' ? 'bg-white text-rose-900 shadow-xs font-bold' : 'text-gray-600 hover:text-black'"
          @click="emit('update:viewMode', 'refunds')">
          <span>Retur</span>
          <span v-if="(refundsCount || 0) > 0" class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold"
            :class="viewMode === 'refunds' ? 'bg-rose-100 text-rose-700' : 'bg-gray-300 text-gray-700'">
            {{ refundsCount }}
          </span>
        </button>

        <button type="button"
          class="px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
          :class="viewMode === 'mutations' ? 'bg-white text-indigo-900 shadow-xs font-bold' : 'text-gray-600 hover:text-black'"
          @click="emit('update:viewMode', 'mutations')">
          <span>Mutasi Kas</span>
          <span v-if="(mutationsCount || 0) > 0" class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold"
            :class="viewMode === 'mutations' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-300 text-gray-700'">
            {{ mutationsCount }}
          </span>
        </button>
      </div>

      <!-- Sisi Kanan: Reset Filter & Quick Action + Mutasi -->
      <div class="flex items-center gap-1.5 shrink-0">
        <button v-if="hasActiveFilter" type="button"
          class="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md cursor-pointer transition-colors shrink-0"
          title="Reset semua filter" @click="emit('reset-filters')">
          <RotateCcw :size="12" />
          <span>Reset</span>
        </button>

        <span v-if="searchQuery"
          class="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium shrink-0">
          Cari: "<span class="font-bold text-gray-800">{{ searchQuery }}</span>"
        </span>
      </div>
    </div>

    <!-- Baris 2: Marketplace-Style Filter Drawer Trigger, DateRangePicker & Active Filter Chips -->
    <div v-horizontal-scroll class="flex items-center gap-2 px-3 py-1.5 overflow-x-auto no-scrollbar">
      <!-- Tombol Trigger Filter Drawer -->
      <button
        type="button"
        @click="showFilterDrawer = true"
        class="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 shadow-xs whitespace-nowrap active:scale-95"
        :class="activeFiltersCount > 0
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-500/20'
          : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'"
      >
        <SlidersHorizontal :size="13" />
        <span>Filter</span>
        <span
          v-if="activeFiltersCount > 0"
          class="px-1.5 py-0.2 rounded-full bg-white text-indigo-700 font-mono text-[10px] font-bold"
        >
          {{ activeFiltersCount }}
        </span>
      </button>

      <!-- Tombol Filter Tanggal (DateRangePicker) di LUAR drawer -->
      <DateRangePicker
        :start-date="filterStartDate"
        :end-date="filterEndDate"
        @update:start-date="emit('update:filterStartDate', $event)"
        @update:end-date="emit('update:filterEndDate', $event)"
      />

      <!-- Tombol Reset Filter jika ada filter aktif -->
      <button
        v-if="hasActiveFilter"
        type="button"
        class="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors shrink-0 whitespace-nowrap"
        title="Reset semua filter"
        @click="emit('reset-filters')"
      >
        <RotateCcw :size="11" />
        <span>Reset</span>
      </button>

      <div class="h-4 w-px bg-gray-300 shrink-0"></div>

      <!-- Quick Filter Pill: Semua Transaksi -->
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none shadow-2xs"
        :class="filterStatus === 'Semua' && (!filterMethod || filterMethod === 'Semua') && filterMarket === 'Semua'
          ? 'bg-indigo-600 text-white font-bold'
          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="emit('reset-filters')"
      >
        Semua Nota
      </button>

      <!-- Quick Filter Pill: Lunas -->
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none shadow-2xs"
        :class="filterStatus === 'LUNAS'
          ? 'bg-emerald-600 text-white font-bold'
          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="emit('update:filterStatus', filterStatus === 'LUNAS' ? 'Semua' : 'LUNAS')"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block mr-1"></span>
        <span>Lunas</span>
        <span class="text-[10px] ml-1 opacity-80">({{ lunasCount }})</span>
      </button>

      <!-- Quick Filter Pill: Tempo -->
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none shadow-2xs"
        :class="filterStatus === 'TEMPO'
          ? 'bg-amber-500 text-slate-950 font-bold'
          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="emit('update:filterStatus', filterStatus === 'TEMPO' ? 'Semua' : 'TEMPO')"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block mr-1"></span>
        <span>Tempo (Piutang)</span>
        <span class="text-[10px] ml-1 opacity-80">({{ tempoCount }})</span>
      </button>

      <!-- Quick Filter Pill: Tunai -->
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none shadow-2xs"
        :class="filterMethod === 'TUNAI'
          ? 'bg-teal-600 text-white font-bold'
          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="emit('update:filterMethod', filterMethod === 'TUNAI' ? 'Semua' : 'TUNAI')"
      >
        <span>Tunai</span>
        <span class="text-[10px] ml-1 opacity-80">({{ tunaiCount || 0 }})</span>
      </button>

      <!-- Quick Filter Pill: QRIS -->
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none shadow-2xs"
        :class="filterMethod === 'QRIS'
          ? 'bg-rose-600 text-white font-bold'
          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="emit('update:filterMethod', filterMethod === 'QRIS' ? 'Semua' : 'QRIS')"
      >
        <span>QRIS</span>
        <span class="text-[10px] ml-1 opacity-80">({{ qrisCount }})</span>
      </button>

      <!-- Quick Filter Pill: Transfer Bank -->
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none shadow-2xs"
        :class="filterMethod === 'TRANSFER'
          ? 'bg-blue-600 text-white font-bold'
          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="emit('update:filterMethod', filterMethod === 'TRANSFER' ? 'Semua' : 'TRANSFER')"
      >
        <span>Transfer Bank</span>
        <span class="text-[10px] ml-1 opacity-80">({{ transferCount }})</span>
      </button>

      <!-- Quick Filter Pill: Grosir B2B -->
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none shadow-2xs"
        :class="filterMarket === 'B2B'
          ? 'bg-indigo-600 text-white font-bold'
          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="emit('update:filterMarket', filterMarket === 'B2B' ? 'Semua' : 'B2B')"
      >
        <span>Grosir (B2B)</span>
        <span class="text-[10px] ml-1 opacity-80">({{ b2bCount }})</span>
      </button>

      <!-- Quick Filter Pill: Eceran B2C -->
      <button
        type="button"
        class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none shadow-2xs"
        :class="filterMarket === 'B2C'
          ? 'bg-purple-600 text-white font-bold'
          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="emit('update:filterMarket', filterMarket === 'B2C' ? 'Semua' : 'B2C')"
      >
        <span>Eceran (B2C)</span>
        <span class="text-[10px] ml-1 opacity-80">({{ b2cCount }})</span>
      </button>

      <!-- Active Filter Chip: Pelanggan (jika dipilih dari Drawer) -->
      <div
        v-if="filterBuyer !== 'Semua'"
        class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-lg shrink-0 whitespace-nowrap"
      >
        <span>Pelanggan: <strong>{{ filterBuyer }}</strong></span>
        <button
          type="button"
          class="p-0.5 hover:bg-amber-200 rounded-full cursor-pointer ml-0.5"
          @click="emit('update:filterBuyer', 'Semua')"
        >
          <X :size="11" />
        </button>
      </div>

      <!-- Active Filter Chip: Tanggal (jika dipilih dari Drawer) -->
      <div
        v-if="filterStartDate || filterEndDate"
        class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-lg shrink-0 whitespace-nowrap"
      >
        <span>Tgl: <strong>{{ filterStartDate || 'Awal' }} s/d {{ filterEndDate || 'Kini' }}</strong></span>
        <button
          type="button"
          class="p-0.5 hover:bg-indigo-200 rounded-full cursor-pointer ml-0.5"
          @click="emit('update:filterStartDate', ''); emit('update:filterEndDate', '')"
        >
          <X :size="11" />
        </button>
      </div>
    </div>

    <!-- Marketplace Filter Drawer Component untuk Buku Kas -->
    <AppFilterDrawer
      :is-open="showFilterDrawer"
      title="Filter Buku Kas & Transaksi"
      subtitle="Saring transaksi berdasarkan kriteria lengkap"
      :active-filters-count="activeFiltersCount"
      :result-count="totalTransactionsCount"
      result-label="Nota"
      apply-button-color="bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800"
      @close="showFilterDrawer = false"
      @reset="emit('reset-filters')"
      @apply="showFilterDrawer = false"
    >
      <!-- Seksi 1: Status Pembayaran -->
      <div class="space-y-2">
        <label class="font-bold text-gray-800 text-xs flex items-center gap-1.5">
          <Clock :size="13" class="text-indigo-600" />
          <span>Status Pembayaran</span>
        </label>
        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            class="px-2.5 py-2 rounded-lg text-xs font-semibold border flex flex-col items-center justify-center cursor-pointer transition-all"
            :class="filterStatus === 'Semua'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterStatus', 'Semua')"
          >
            <span>Semua</span>
            <span class="text-[10px] opacity-80">({{ totalTransactionsCount }})</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-2 rounded-lg text-xs font-semibold border flex flex-col items-center justify-center cursor-pointer transition-all"
            :class="filterStatus === 'LUNAS'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterStatus', 'LUNAS')"
          >
            <span>Lunas</span>
            <span class="text-[10px] opacity-80">({{ lunasCount }})</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-2 rounded-lg text-xs font-semibold border flex flex-col items-center justify-center cursor-pointer transition-all"
            :class="filterStatus === 'TEMPO'
              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterStatus', 'TEMPO')"
          >
            <span>Bon / Tempo</span>
            <span class="text-[10px] opacity-80">({{ tempoCount }})</span>
          </button>
        </div>
      </div>

      <!-- Seksi 2: Metode Pembayaran -->
      <div class="pt-3 space-y-2">
        <label class="font-bold text-gray-800 text-xs flex items-center gap-1.5">
          <CreditCard :size="13" class="text-blue-600" />
          <span>Metode Pembayaran</span>
        </label>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between cursor-pointer transition-all"
            :class="filterMethod === 'Semua'
              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterMethod', 'Semua')"
          >
            <span>Semua Metode</span>
            <span class="text-[10px] font-mono opacity-80">
              {{ (tunaiCount ?? 0) + (transferCount ?? 0) + (qrisCount ?? 0) + (notaTempoCount ?? 0) }}
            </span>
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between cursor-pointer transition-all"
            :class="filterMethod === 'Tunai / Kas'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterMethod', 'Tunai / Kas')"
          >
            <div class="flex items-center gap-1.5">
              <Banknote :size="13" />
              <span>Tunai</span>
            </div>
            <span class="text-[10px] font-mono opacity-80">{{ tunaiCount ?? 0 }}</span>
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between cursor-pointer transition-all"
            :class="filterMethod === 'Transfer Bank'
              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterMethod', 'Transfer Bank')"
          >
            <div class="flex items-center gap-1.5">
              <Landmark :size="13" />
              <span>Transfer</span>
            </div>
            <span class="text-[10px] font-mono opacity-80">{{ transferCount ?? 0 }}</span>
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between cursor-pointer transition-all"
            :class="filterMethod === 'QRIS'
              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterMethod', 'QRIS')"
          >
            <div class="flex items-center gap-1.5">
              <QrCode :size="13" />
              <span>QRIS</span>
            </div>
            <span class="text-[10px] font-mono opacity-80">{{ qrisCount ?? 0 }}</span>
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between cursor-pointer transition-all col-span-2"
            :class="filterMethod === 'Nota Tempo'
              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterMethod', 'Nota Tempo')"
          >
            <div class="flex items-center gap-1.5">
              <FileText :size="13" />
              <span>Nota Tempo / Piutang Belum Lunas</span>
            </div>
            <span class="text-[10px] font-mono opacity-80">{{ notaTempoCount ?? 0 }}</span>
          </button>
        </div>
      </div>

      <!-- Seksi 3: Segmentasi Pasar (B2B / B2C) -->
      <div class="pt-3 space-y-2">
        <label class="font-bold text-gray-800 text-xs flex items-center gap-1.5">
          <Building :size="13" class="text-purple-600" />
          <span>Segmentasi Pasar</span>
        </label>
        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            class="px-2.5 py-2 rounded-lg text-xs font-semibold border flex flex-col items-center justify-center cursor-pointer transition-all"
            :class="filterMarket === 'Semua'
              ? 'bg-slate-800 text-white border-slate-800 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterMarket', 'Semua')"
          >
            <span>Semua</span>
            <span class="text-[10px] opacity-80">({{ b2bCount + b2cCount }})</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-2 rounded-lg text-xs font-semibold border flex flex-col items-center justify-center cursor-pointer transition-all"
            :class="filterMarket === 'B2B'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterMarket', 'B2B')"
          >
            <span>Grosir (B2B)</span>
            <span class="text-[10px] opacity-80">({{ b2bCount }})</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-2 rounded-lg text-xs font-semibold border flex flex-col items-center justify-center cursor-pointer transition-all"
            :class="filterMarket === 'B2C'
              ? 'bg-teal-600 text-white border-teal-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="emit('update:filterMarket', 'B2C')"
          >
            <span>Eceran (B2C)</span>
            <span class="text-[10px] opacity-80">({{ b2cCount }})</span>
          </button>
        </div>
      </div>

      <!-- Seksi 4: Filter Pelanggan Spesifik -->
      <div class="pt-3 space-y-2">
        <label class="font-bold text-gray-800 text-xs flex items-center gap-1.5">
          <Users :size="13" class="text-amber-600" />
          <span>Pilih Pelanggan / Pembeli</span>
        </label>
        <SearchableSelect
          :model-value="filterBuyer"
          :options="buyerOptions"
          placeholder="Cari / Pilih Pelanggan..."
          search-placeholder="Ketik nama pelanggan..."
          @update:model-value="onBuyerChange"
        />
      </div>
    </AppFilterDrawer>
  </div>
</template>
