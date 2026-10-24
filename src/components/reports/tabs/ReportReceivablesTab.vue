<script setup lang="ts">
import { ref, computed } from 'vue';
import { ArrowUp, ArrowDown } from 'lucide-vue-next';
import { useLedgerStore } from '../../../stores/ledgerStore';
import { formatRupiah } from '../../../utils/formatters';

export interface AgingReceivableItem {
  id: string;
  invoiceNo: string;
  buyer: string;
  date: string;
  ageDays: number;
  bucket: '0-7' | '8-14' | '15-30' | '>30';
  finalTotal?: number;
  totalSell?: number;
}

type ReceivableSortField = 'invoiceNo' | 'buyer' | 'date' | 'ageDays' | 'bucket' | 'total';
type SortDirection = 'asc' | 'desc';

const props = defineProps<{
  agingReceivables: AgingReceivableItem[];
}>();

const ledgerStore = useLedgerStore();

const sortField = ref<ReceivableSortField>('ageDays');
const sortDirection = ref<SortDirection>('desc');

function toggleSort(field: ReceivableSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = (field === 'ageDays' || field === 'total' || field === 'date') ? 'desc' : 'asc';
  }
}

const sortedReceivables = computed(() => {
  const list = [...props.agingReceivables];
  const dir = sortDirection.value === 'asc' ? 1 : -1;
  const field = sortField.value;

  return list.sort((a, b) => {
    if (field === 'invoiceNo') return a.invoiceNo.localeCompare(b.invoiceNo) * dir;
    if (field === 'buyer') return a.buyer.localeCompare(b.buyer) * dir;
    if (field === 'date') return a.date.localeCompare(b.date) * dir;
    if (field === 'ageDays') return (a.ageDays - b.ageDays) * dir;
    if (field === 'bucket') {
      const rank = { '0-7': 1, '8-14': 2, '15-30': 3, '>30': 4 };
      return (rank[a.bucket] - rank[b.bucket]) * dir;
    }
    if (field === 'total') {
      const totalA = a.finalTotal ?? a.totalSell ?? 0;
      const totalB = b.finalTotal ?? b.totalSell ?? 0;
      return (totalA - totalB) * dir;
    }
    return 0;
  });
});
</script>

<template>
  <div class="flex-1 overflow-auto">
    <table class="table-explorer min-w-[900px] w-full whitespace-nowrap">
      <thead>
        <tr>
          <th
            class="is-sortable w-36"
            :class="{ 'is-sorted': sortField === 'invoiceNo' }"
            title="Klik untuk mengurutkan no. nota"
            @click="toggleSort('invoiceNo')"
          >
            <div class="flex items-center gap-1">
              <span>NO. NOTA</span>
              <ArrowUp v-if="sortField === 'invoiceNo' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <ArrowDown v-else-if="sortField === 'invoiceNo' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            </div>
          </th>

          <th
            class="is-sortable w-44 text-left"
            :class="{ 'is-sorted': sortField === 'buyer' }"
            title="Klik untuk mengurutkan nama pelanggan"
            @click="toggleSort('buyer')"
          >
            <div class="flex items-center gap-1">
              <span>NAMA PELANGGAN</span>
              <ArrowUp v-if="sortField === 'buyer' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <ArrowDown v-else-if="sortField === 'buyer' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            </div>
          </th>

          <th
            class="is-sortable w-28 text-center"
            :class="{ 'is-sorted': sortField === 'date' }"
            title="Klik untuk mengurutkan tanggal nota"
            @click="toggleSort('date')"
          >
            <div class="flex items-center justify-center gap-1">
              <span>TANGGAL NOTA</span>
              <ArrowUp v-if="sortField === 'date' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <ArrowDown v-else-if="sortField === 'date' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            </div>
          </th>

          <th
            class="is-sortable w-28 text-center"
            :class="{ 'is-sorted': sortField === 'ageDays' }"
            title="Klik untuk mengurutkan umur/lama bon"
            @click="toggleSort('ageDays')"
          >
            <div class="flex items-center justify-center gap-1">
              <span>LAMA BON</span>
              <ArrowUp v-if="sortField === 'ageDays' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <ArrowDown v-else-if="sortField === 'ageDays' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            </div>
          </th>

          <th
            class="is-sortable w-32 text-center"
            :class="{ 'is-sorted': sortField === 'bucket' }"
            title="Klik untuk mengurutkan kelancaran bon"
            @click="toggleSort('bucket')"
          >
            <div class="flex items-center justify-center gap-1">
              <span>STATUS KELANCARAN</span>
              <ArrowUp v-if="sortField === 'bucket' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <ArrowDown v-else-if="sortField === 'bucket' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            </div>
          </th>

          <th
            class="is-sortable w-36 text-right"
            :class="{ 'is-sorted': sortField === 'total' }"
            title="Klik untuk mengurutkan total bon"
            @click="toggleSort('total')"
          >
            <div class="flex items-center justify-end gap-1">
              <span>TOTAL BON (RP)</span>
              <ArrowUp v-if="sortField === 'total' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              <ArrowDown v-else-if="sortField === 'total' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            </div>
          </th>

          <th class="w-28 text-center select-none">UBAH STATUS</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in sortedReceivables" :key="t.id" class="hover:bg-blue-50/20 cursor-pointer whitespace-nowrap">
          <td class="font-mono font-bold text-blue-700 whitespace-nowrap">{{ t.invoiceNo }}</td>
          <td class="font-bold text-gray-800 whitespace-nowrap">{{ t.buyer }}</td>
          <td class="text-center font-mono text-gray-500 whitespace-nowrap">{{ t.date }}</td>
          <td class="text-center font-mono font-bold whitespace-nowrap">{{ t.ageDays }} Hari</td>
          <td class="text-center whitespace-nowrap">
            <span
              class="px-2 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap"
              :class="{
                'bg-red-100 text-red-800 border border-red-300': t.bucket === '>30',
                'bg-yellow-100 text-yellow-800 border border-yellow-300': t.bucket === '15-30',
                'bg-blue-100 text-blue-800 border border-blue-200': t.bucket === '8-14',
                'bg-emerald-100 text-emerald-800 border border-emerald-200': t.bucket === '0-7'
              }"
            >
              {{ t.bucket === '>30' ? 'MACET (>30 HARI)' : (t.bucket === '15-30' ? 'PERLU DITAGIH' : (t.bucket === '8-14' ? 'NORMAL' : 'LANCAR')) }}
            </span>
          </td>
          <td class="text-right font-mono font-bold text-gray-900 whitespace-nowrap">{{ formatRupiah(t.finalTotal ?? t.totalSell ?? 0) }}</td>
          <td class="text-center whitespace-nowrap">
            <button
              type="button"
              @click="ledgerStore.togglePaymentStatus(t.id)"
              class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-2xs"
            >
              Set LUNAS
            </button>
          </td>
        </tr>
        <tr v-if="agingReceivables.length === 0">
          <td colspan="7" class="p-8 text-center text-gray-500">
            Tidak ada data bon atau tagihan piutang pelanggan yang belum lunas.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
