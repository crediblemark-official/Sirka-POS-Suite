<script setup lang="ts">
import { ref } from 'vue';
import {
  Clock,
  Building,
  Users,
  UserCheck,
  RotateCcw
} from 'lucide-vue-next';
import { PaymentStatus } from '../../types';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';

type LedgerFilterType = 'status' | 'market' | 'buyer';

const props = defineProps<{
  filterStatus: PaymentStatus | 'Semua';
  filterMarket: 'Semua' | 'B2B' | 'B2C';
  filterBuyer: string;
  viewMode: 'transactions' | 'items' | 'refunds';
  searchQuery?: string;
  totalTransactionsCount: number;
  lunasCount: number;
  tempoCount: number;
  b2bCount: number;
  b2cCount: number;
  refundsCount?: number;
  buyerOptions: SelectOption[];
  hasActiveFilter: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:filterStatus', value: PaymentStatus | 'Semua'): void;
  (e: 'update:filterMarket', value: 'Semua' | 'B2B' | 'B2C'): void;
  (e: 'update:filterBuyer', value: string): void;
  (e: 'update:viewMode', value: 'transactions' | 'items' | 'refunds'): void;
  (e: 'reset-filters'): void;
}>();

const activeFilterType = ref<LedgerFilterType>('status');

function onBuyerChange(val: string | number) {
  emit('update:filterBuyer', String(val));
}
</script>

<template>
  <div
    v-horizontal-scroll
    class="h-10 relative z-30 flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 select-none shrink-0 gap-2 overflow-x-auto no-scrollbar"
  >
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
          @click="emit('update:filterStatus', 'Semua')"
        >
          <span>Semua Status</span>
          <span class="text-[10px] px-1 rounded-full" :class="filterStatus === 'Semua' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-600'">
            {{ totalTransactionsCount }}
          </span>
        </button>

        <button
          type="button"
          class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
          :class="filterStatus === 'LUNAS' ? 'bg-emerald-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
          @click="emit('update:filterStatus', 'LUNAS')"
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
          @click="emit('update:filterStatus', 'TEMPO')"
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
          @click="emit('update:filterMarket', 'Semua')"
        >
          <span>Semua Transaksi</span>
          <span class="text-[10px] px-1 rounded-full" :class="filterMarket === 'Semua' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'">
            {{ totalTransactionsCount }}
          </span>
        </button>

        <button
          type="button"
          class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
          :class="filterMarket === 'B2B' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
          @click="emit('update:filterMarket', 'B2B')"
        >
          <Building :size="11" />
          <span>Grosir (B2B)</span>
          <span class="text-[10px] px-1 rounded-full" :class="filterMarket === 'B2B' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-600'">
            {{ b2bCount }}
          </span>
        </button>

        <button
          type="button"
          class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
          :class="filterMarket === 'B2C' ? 'bg-teal-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
          @click="emit('update:filterMarket', 'B2C')"
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
          :model-value="filterBuyer"
          :options="buyerOptions"
          placeholder="Cari / Pilih Pelanggan..."
          search-placeholder="Ketik nama pelanggan..."
          size="sm"
          @update:model-value="onBuyerChange"
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
        @click="emit('reset-filters')"
      >
        <RotateCcw :size="11" />
        <span>Reset Filter</span>
      </button>

      <span v-if="searchQuery" class="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium">
        Cari: "<span class="font-bold text-gray-800">{{ searchQuery }}</span>"
      </span>

      <!-- View Mode Switcher -->
      <div class="flex bg-gray-200/80 p-0.5 rounded border border-gray-300">
        <button
          type="button"
          class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all"
          :class="viewMode === 'transactions' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
          @click="emit('update:viewMode', 'transactions')"
        >
          Nota
        </button>
        <button
          type="button"
          class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all"
          :class="viewMode === 'items' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
          @click="emit('update:viewMode', 'items')"
        >
          Rincian Barang
        </button>
        <button
          type="button"
          class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1"
          :class="viewMode === 'refunds' ? 'bg-white text-rose-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
          @click="emit('update:viewMode', 'refunds')"
        >
          <span>Retur & Refund</span>
          <span
            v-if="(refundsCount || 0) > 0"
            class="px-1.5 py-0.2 rounded-full text-[9.5px] font-mono font-bold"
            :class="viewMode === 'refunds' ? 'bg-rose-100 text-rose-700' : 'bg-gray-300 text-gray-700'"
          >
            {{ refundsCount }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
