<script setup lang="ts">
import { ref, computed } from 'vue';
import { useReturnStore } from '../../stores/returnStore';
import { formatRupiah } from '../../utils/formatters';
import type { WasteReason } from '../../types';
import AppTableContainer from '../common/AppTableContainer.vue';
import MetricStatsStrip, { type MetricStatItem } from '../common/MetricStatsStrip.vue';
import {
  Trash2,
  Flame,
  CalendarX,
  Scale,
  Search,
  Plus,
  AlertTriangle,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next';

type WasteSortField = 'createdAt' | 'productName' | 'category' | 'reason' | 'qty' | 'notes' | 'recordedBy' | 'estimatedLoss';
type SortDirection = 'asc' | 'desc';

const sortField = ref<WasteSortField>('createdAt');
const sortDirection = ref<SortDirection>('desc');

function toggleSort(field: WasteSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = ['createdAt', 'qty', 'estimatedLoss'].includes(field) ? 'desc' : 'asc';
  }
}

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

const sortedRecords = computed(() => {
  const list = [...filteredRecords.value];
  const field = sortField.value;
  const dir = sortDirection.value === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    switch (field) {
      case 'createdAt':
        return dir * (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      case 'productName':
        return dir * (a.productName || '').localeCompare(b.productName || '');
      case 'category':
        return dir * (a.category || '').localeCompare(b.category || '');
      case 'reason':
        return dir * (a.reason || '').localeCompare(b.reason || '');
      case 'qty':
        return dir * ((a.qty || 0) - (b.qty || 0));
      case 'notes':
        return dir * (a.notes || '').localeCompare(b.notes || '');
      case 'recordedBy':
        return dir * (a.recordedBy || '').localeCompare(b.recordedBy || '');
      case 'estimatedLoss':
        return dir * ((a.estimatedLoss || 0) - (b.estimatedLoss || 0));
      default:
        return 0;
    }
  });

  return list;
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
    value: totalItems.value,
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
    <div
      v-horizontal-scroll
      class="h-10 px-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between gap-3 shrink-0 overflow-x-auto no-scrollbar"
    >
      <!-- Sisi Kiri: Filter Alasan Susut -->
      <div class="flex items-center gap-2 shrink-0">
        <div class="flex bg-gray-200/90 p-0.5 rounded border border-gray-300 shrink-0">
          <button
            type="button"
            class="px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all shrink-0 whitespace-nowrap"
            :class="selectedReason === 'ALL' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedReason = 'ALL'"
          >
            Semua Alasan ({{ returnStore.wasteRecords.length }})
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
            :class="selectedReason === 'BUSUK' ? 'bg-orange-600 text-white shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedReason = 'BUSUK'"
          >
            <Flame :size="11" />
            <span>Busuk / Basi</span>
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
            :class="selectedReason === 'EXPIRED' ? 'bg-purple-600 text-white shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedReason = 'EXPIRED'"
          >
            <CalendarX :size="11" />
            <span>Expired</span>
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
            :class="selectedReason === 'RUSAK_FISIK' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedReason = 'RUSAK_FISIK'"
          >
            <Trash2 :size="11" />
            <span>Pecah / Rusak Fisik</span>
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
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
    <AppTableContainer
      :is-empty="filteredRecords.length === 0"
      :empty-icon="Trash2"
      empty-title="Belum Ada Catatan Barang Rusak / Susut"
      empty-description="Barang afkir, telur pecah, atau buah busuk yang dicatat akan muncul di tabel audit ini."
    >
      <template #empty-action>
        <button
          type="button"
          class="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
          @click="returnStore.openWasteModal()"
        >
          <Plus :size="14" />
          <span>Catat Barang Rusak Pertama</span>
        </button>
      </template>

      <table class="table-explorer whitespace-nowrap min-w-[880px]">
        <thead class="sticky top-0 z-20 bg-[#f4f2ee] border-b border-gray-300 text-gray-700 font-bold text-[11px] shadow-2xs uppercase tracking-wider">
          <tr>
            <th class="py-2.5 px-3 text-center w-12 whitespace-nowrap">NO</th>
            <th
              class="py-2.5 px-3 w-40 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'createdAt' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan waktu & tanggal"
              @click="toggleSort('createdAt')"
            >
              <div class="flex items-center gap-1.5">
                <span>WAKTU & TANGGAL</span>
                <ArrowUp v-if="sortField === 'createdAt' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'createdAt' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 min-w-[200px] cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'productName' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan nama barang"
              @click="toggleSort('productName')"
            >
              <div class="flex items-center gap-1.5">
                <span>NAMA BARANG</span>
                <ArrowUp v-if="sortField === 'productName' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'productName' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 text-center w-32 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'category' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan kategori"
              @click="toggleSort('category')"
            >
              <div class="flex items-center justify-center gap-1.5">
                <span>KATEGORI</span>
                <ArrowUp v-if="sortField === 'category' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'category' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 text-center w-36 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'reason' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan alasan susut"
              @click="toggleSort('reason')"
            >
              <div class="flex items-center justify-center gap-1.5">
                <span>ALASAN SUSUT</span>
                <ArrowUp v-if="sortField === 'reason' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'reason' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 text-center w-28 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'qty' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan jumlah susut"
              @click="toggleSort('qty')"
            >
              <div class="flex items-center justify-center gap-1.5">
                <span>JUMLAH SUSUT</span>
                <ArrowUp v-if="sortField === 'qty' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'qty' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 min-w-[180px] cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'notes' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan catatan kerusakan"
              @click="toggleSort('notes')"
            >
              <div class="flex items-center gap-1.5">
                <span>CATATAN KERUSAKAN</span>
                <ArrowUp v-if="sortField === 'notes' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'notes' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 w-32 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'recordedBy' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan pencatat"
              @click="toggleSort('recordedBy')"
            >
              <div class="flex items-center gap-1.5">
                <span>DICATAT OLEH</span>
                <ArrowUp v-if="sortField === 'recordedBy' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'recordedBy' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 text-right w-36 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'estimatedLoss' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan estimasi kerugian"
              @click="toggleSort('estimatedLoss')"
            >
              <div class="flex items-center justify-end gap-1.5">
                <span>ESTIMASI KERUGIAN</span>
                <ArrowUp v-if="sortField === 'estimatedLoss' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'estimatedLoss' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr
            v-for="(w, idx) in sortedRecords"
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
    </AppTableContainer>
  </div>
</template>
