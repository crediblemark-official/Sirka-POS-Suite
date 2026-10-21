<script setup lang="ts">
import { ref, computed } from 'vue';
import { useReturnStore } from '../../stores/returnStore';
import { formatRupiah } from '../../utils/formatters';
import type { WasteReason } from '../../types';
import AppEmptyState from '../common/AppEmptyState.vue';
import MetricStatsStrip, { type MetricStatItem } from '../common/MetricStatsStrip.vue';
import {
  Trash2,
  Flame,
  CalendarX,
  Scale,
  Search,
  Plus,
  AlertTriangle
} from 'lucide-vue-next';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const returnStore = useReturnStore();

const selectedReason = ref<WasteReason | 'ALL'>('ALL');
const localSearch = ref('');

const filteredRecords = computed(() => {
  const query = (props.searchQuery || localSearch.value || '').toLowerCase().trim();

  return returnStore.wasteRecords.filter(w => {
    if (selectedReason.value !== 'ALL' && w.reason !== selectedReason.value) {
      return false;
    }

    if (query) {
      const matchProd = w.productName.toLowerCase().includes(query);
      const matchNotes = (w.notes || '').toLowerCase().includes(query);
      const matchActor = w.recordedBy.toLowerCase().includes(query);
      if (!matchProd && !matchNotes && !matchActor) {
        return false;
      }
    }

    return true;
  });
});

const totalItems = computed(() => returnStore.wasteRecords.length);
const totalLoss = computed(() =>
  returnStore.wasteRecords.reduce((sum, w) => sum + (w.estimatedLoss || 0), 0)
);

const expiredLoss = computed(() =>
  returnStore.wasteRecords
    .filter(w => w.reason === 'EXPIRED')
    .reduce((sum, w) => sum + (w.estimatedLoss || 0), 0)
);

const busukLoss = computed(() =>
  returnStore.wasteRecords
    .filter(w => w.reason === 'BUSUK' || w.reason === 'RUSAK_FISIK')
    .reduce((sum, w) => sum + (w.estimatedLoss || 0), 0)
);

const metricStats = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Kasus Susut/Rusak',
    value: `${totalItems.value} Catatan`,
    icon: Trash2,
    iconBoxClass: 'bg-amber-50 text-amber-700',
    valClass: 'text-gray-900 font-bold'
  },
  {
    label: 'Total Beban Kerugian HPP',
    value: `Rp ${formatRupiah(totalLoss.value)}`,
    icon: AlertTriangle,
    iconBoxClass: 'bg-rose-100 text-rose-800',
    valClass: 'text-rose-700 font-black'
  },
  {
    label: 'Kerugian Expired / Kedaluwarsa',
    value: `Rp ${formatRupiah(expiredLoss.value)}`,
    icon: CalendarX,
    iconBoxClass: 'bg-purple-50 text-purple-700',
    valClass: 'text-purple-800'
  },
  {
    label: 'Kerugian Busuk & Rusak Fisik',
    value: `Rp ${formatRupiah(busukLoss.value)}`,
    icon: Flame,
    iconBoxClass: 'bg-orange-50 text-orange-700',
    valClass: 'text-orange-800'
  }
]);

function formatDateTime(iso: string) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-[#f8f7f5] overflow-hidden select-none text-xs">
    <!-- Top Metric Strip -->
    <MetricStatsStrip :items="metricStats" />

    <!-- Action & Filter Bar -->
    <div class="h-10 px-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between gap-3 shrink-0">
      <!-- Sisi Kiri: Filter Alasan Susut -->
      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div class="flex bg-gray-200/90 p-0.5 rounded border border-gray-300 shrink-0">
          <button
            type="button"
            class="px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all"
            :class="selectedReason === 'ALL' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedReason = 'ALL'"
          >
            Semua Alasan ({{ returnStore.wasteRecords.length }})
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1"
            :class="selectedReason === 'BUSUK' ? 'bg-orange-600 text-white shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedReason = 'BUSUK'"
          >
            <Flame :size="11" />
            <span>Busuk / Basi</span>
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1"
            :class="selectedReason === 'EXPIRED' ? 'bg-purple-600 text-white shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedReason = 'EXPIRED'"
          >
            <CalendarX :size="11" />
            <span>Expired</span>
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1"
            :class="selectedReason === 'RUSAK_FISIK' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedReason = 'RUSAK_FISIK'"
          >
            <Trash2 :size="11" />
            <span>Pecah / Rusak Fisik</span>
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1"
            :class="selectedReason === 'SUSUT_TIMBANGAN' ? 'bg-teal-600 text-white shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedReason = 'SUSUT_TIMBANGAN'"
          >
            <Scale :size="11" />
            <span>Susut Timbangan</span>
          </button>
        </div>
      </div>

      <!-- Sisi Kanan: Pencarian + Tombol Catat Susut -->
      <div class="flex items-center gap-2 shrink-0">
        <div class="relative w-44">
          <Search :size="12" class="absolute left-2.5 top-2 text-gray-400" />
          <input
            v-model="localSearch"
            type="text"
            placeholder="Cari nama barang..."
            class="w-full pl-7 pr-2 py-1 bg-white border border-gray-300 rounded text-[11px] focus:outline-none focus:border-amber-500 shadow-2xs"
          />
        </div>

        <button
          type="button"
          class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
          @click="returnStore.openWasteModal()"
        >
          <Plus :size="13" />
          <span>+ Catat Barang Rusak</span>
        </button>
      </div>
    </div>

    <!-- Main Table Area -->
    <div class="flex-1 overflow-auto bg-white">
      <AppEmptyState
        v-if="filteredRecords.length === 0"
        :icon="Trash2"
        title="Belum Ada Catatan Barang Rusak / Susut"
        description="Barang afkir, telur pecah, atau buah busuk yang dicatat akan muncul di tabel audit ini."
      >
        <button
          type="button"
          class="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          @click="returnStore.openWasteModal()"
        >
          <Plus :size="14" />
          <span>Catat Barang Rusak Pertama</span>
        </button>
      </AppEmptyState>

      <table v-else class="w-full text-left border-collapse text-xs">
        <thead class="sticky top-0 z-20 bg-[#f4f2ee] border-b border-gray-300 text-gray-700 font-bold text-[11px] shadow-2xs uppercase tracking-wider">
          <tr>
            <th class="py-2.5 px-3 text-center w-12">NO</th>
            <th class="py-2.5 px-3 w-40">WAKTU & TANGGAL</th>
            <th class="py-2.5 px-3 min-w-[200px]">NAMA BARANG</th>
            <th class="py-2.5 px-3 text-center w-32">KATEGORI</th>
            <th class="py-2.5 px-3 text-center w-36">ALASAN SUSUT</th>
            <th class="py-2.5 px-3 text-center w-28">JUMLAH SUSUT</th>
            <th class="py-2.5 px-3 min-w-[180px]">CATATAN KERUSAKAN</th>
            <th class="py-2.5 px-3 w-32">DICATAT OLEH</th>
            <th class="py-2.5 px-3 text-right w-36">ESTIMASI KERUGIAN</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr
            v-for="(w, idx) in filteredRecords"
            :key="w.id"
            class="hover:bg-amber-50/40 transition-colors"
          >
            <td class="py-2.5 px-3 text-center font-mono text-[11px] text-gray-400">
              {{ idx + 1 }}
            </td>

            <td class="py-2.5 px-3 font-mono text-[11px] text-gray-700">
              {{ formatDateTime(w.createdAt) }}
            </td>

            <td class="py-2.5 px-3 font-bold text-gray-900">
              {{ w.productName }}
            </td>

            <td class="py-2.5 px-3 text-center">
              <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                {{ w.category }}
              </span>
            </td>

            <td class="py-2.5 px-3 text-center">
              <span
                class="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold"
                :class="{
                  'bg-orange-100 text-orange-800 border border-orange-200': w.reason === 'BUSUK',
                  'bg-purple-100 text-purple-800 border border-purple-200': w.reason === 'EXPIRED',
                  'bg-rose-100 text-rose-800 border border-rose-200': w.reason === 'RUSAK_FISIK',
                  'bg-teal-100 text-teal-800 border border-teal-200': w.reason === 'SUSUT_TIMBANGAN',
                  'bg-gray-100 text-gray-800': w.reason === 'LAINNYA'
                }"
              >
                {{ w.reason === 'BUSUK' ? 'Busuk / Basi' : w.reason === 'EXPIRED' ? 'Kedaluwarsa' : w.reason === 'RUSAK_FISIK' ? 'Pecah / Rusak' : w.reason === 'SUSUT_TIMBANGAN' ? 'Susut Timbang' : w.reason }}
              </span>
            </td>

            <td class="py-2.5 px-3 text-center font-mono font-bold text-rose-700">
              -{{ w.qty }} {{ w.unit }}
            </td>

            <td class="py-2.5 px-3 text-gray-600 italic">
              {{ w.notes || '-' }}
            </td>

            <td class="py-2.5 px-3 text-gray-800 font-medium">
              {{ w.recordedBy }}
            </td>

            <td class="py-2.5 px-3 text-right font-mono font-black text-rose-700">
              -Rp {{ formatRupiah(w.estimatedLoss) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
