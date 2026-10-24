<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCashStore } from '../../stores/cashStore';
import { CashAccountType, CashMutation } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import AppEmptyState from '../common/AppEmptyState.vue';
import CashPocketCards from '../cash/CashPocketCards.vue';
import {
  Plus,
  Trash2,
  Coins,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next';

type MutationSortField = 'date' | 'time' | 'type' | 'fromAccount' | 'toAccount' | 'category' | 'amount' | 'notes';
type SortDirection = 'asc' | 'desc';

const props = withDefaults(defineProps<{
  filterStartDate?: string;
  filterEndDate?: string;
  searchQuery?: string;
}>(), {
  filterStartDate: '',
  filterEndDate: '',
  searchQuery: ''
});

const emit = defineEmits<{
  (e: 'open-mutation', account?: CashAccountType): void;
  (e: 'open-expense', account?: CashAccountType): void;
  (e: 'open-transfer', fromAccount?: CashAccountType): void;
}>();

const cashStore = useCashStore();
const confirmDialog = useConfirmDialog();

// Sorting state (default: tanggal transaksi terbaru di atas)
const sortField = ref<MutationSortField>('date');
const sortDirection = ref<SortDirection>('desc');

function toggleSort(field: MutationSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = (field === 'amount' || field === 'date' || field === 'time') ? 'desc' : 'asc';
  }
}

// Saldo riil per akun berdasarkan rentang tanggal
const cashBalances = computed(() => {
  return cashStore.calculateAccountBalances(props.filterStartDate, props.filterEndDate);
});

// Filter mutasi berdasarkan tanggal dan search query
const filteredMutations = computed(() => {
  const q = (props.searchQuery || '').toLowerCase().trim();
  const start = props.filterStartDate;
  const end = props.filterEndDate;

  return cashStore.mutations.filter(m => {
    // Filter rentang tanggal
    if (start && m.date < start) return false;
    if (end && m.date > end) return false;

    // Search query
    if (q) {
      const matchCat = m.category.toLowerCase().includes(q);
      const matchNotes = (m.notes || '').toLowerCase().includes(q);
      const matchRef = (m.referenceNo || '').toLowerCase().includes(q);
      const matchFrom = m.fromAccount.toLowerCase().includes(q);
      const matchTo = (m.toAccount || '').toLowerCase().includes(q);
      if (!matchCat && !matchNotes && !matchRef && !matchFrom && !matchTo) {
        return false;
      }
    }

    return true;
  });
});

// Mutasi yang telah disortir berdasarkan kolom aktif
const sortedMutations = computed(() => {
  const list = [...filteredMutations.value];
  const dir = sortDirection.value === 'asc' ? 1 : -1;
  const field = sortField.value;

  return list.sort((a, b) => {
    if (field === 'date') {
      const dateTimeA = `${a.date} ${a.time || ''}`;
      const dateTimeB = `${b.date} ${b.time || ''}`;
      return dateTimeA.localeCompare(dateTimeB) * dir;
    }
    if (field === 'time') {
      return (a.time || '').localeCompare(b.time || '') * dir;
    }
    if (field === 'amount') {
      return (a.amount - b.amount) * dir;
    }
    if (field === 'type') {
      return a.type.localeCompare(b.type) * dir;
    }
    if (field === 'fromAccount') {
      return a.fromAccount.localeCompare(b.fromAccount) * dir;
    }
    if (field === 'toAccount') {
      const toA = a.toAccount || '';
      const toB = b.toAccount || '';
      return toA.localeCompare(toB) * dir;
    }
    if (field === 'category') {
      return a.category.localeCompare(b.category) * dir;
    }
    if (field === 'notes') {
      return (a.notes || '').localeCompare(b.notes || '') * dir;
    }
    return 0;
  });
});

async function handleDelete(mut: CashMutation) {
  const confirmed = await confirmDialog.confirm({
    title: 'Hapus Catatan Mutasi Kas?',
    message: `Yakin ingin menghapus mutasi "${mut.category}" sebesar Rp ${formatRupiah(mut.amount)}? Tindakan ini akan mengembalikan perhitungan saldo akun kas terkait.`,
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger'
  });

  if (confirmed) {
    cashStore.deleteMutation(mut.id);
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-white">
    <!-- 1. Top Section: Reusable MetricStatsStrip Saldo Kas & Bank -->
    <CashPocketCards
      :balances="cashBalances"
      @settle-qris="emit('open-transfer', 'QRIS')"
    />


    <!-- 2. Main Table Area -->
    <div class="flex-1 overflow-auto flex flex-col bg-white">
      <!-- Empty State Standard -->
      <AppEmptyState
        v-if="sortedMutations.length === 0"
        :icon="Coins"
        title="Belum Ada Riwayat Mutasi Kas"
        description="Catat pengeluaran operasional (listrik, gaji, transport, konsumsi) atau pemindahan kas (setor tunai ke bank, cairkan QRIS ke bank)."
      >
        <button
          type="button"
          class="px-3.5 py-1.5 rounded bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors mx-auto"
          @click="emit('open-mutation')"
        >
          <Plus :size="13" />
          <span>Catat Mutasi Kas</span>
        </button>
      </AppEmptyState>

      <!-- Tabel Data Mutasi Kas -->
      <table v-else class="table-explorer w-full min-w-[960px] whitespace-nowrap">
        <thead>
          <tr>
            <th class="w-12 text-center select-none">NO</th>

            <th
              class="is-sortable w-28 text-left"
              :class="{ 'is-sorted': sortField === 'date' }"
              title="Klik untuk mengurutkan tanggal"
              @click="toggleSort('date')"
            >
              <div class="flex items-center gap-1">
                <span>TANGGAL</span>
                <ArrowUp v-if="sortField === 'date' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'date' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-20 text-left"
              :class="{ 'is-sorted': sortField === 'time' }"
              title="Klik untuk mengurutkan jam"
              @click="toggleSort('time')"
            >
              <div class="flex items-center gap-1">
                <span>JAM</span>
                <ArrowUp v-if="sortField === 'time' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'time' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-24 text-center"
              :class="{ 'is-sorted': sortField === 'type' }"
              title="Klik untuk mengurutkan tipe mutasi"
              @click="toggleSort('type')"
            >
              <div class="flex items-center justify-center gap-1">
                <span>TIPE</span>
                <ArrowUp v-if="sortField === 'type' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'type' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-32 text-left"
              :class="{ 'is-sorted': sortField === 'fromAccount' }"
              title="Klik untuk mengurutkan akun sumber"
              @click="toggleSort('fromAccount')"
            >
              <div class="flex items-center gap-1">
                <span>DARI SUMBER</span>
                <ArrowUp v-if="sortField === 'fromAccount' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'fromAccount' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-32 text-left"
              :class="{ 'is-sorted': sortField === 'toAccount' }"
              title="Klik untuk mengurutkan akun tujuan"
              @click="toggleSort('toAccount')"
            >
              <div class="flex items-center gap-1">
                <span>KE TUJUAN</span>
                <ArrowUp v-if="sortField === 'toAccount' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'toAccount' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-36 text-left"
              :class="{ 'is-sorted': sortField === 'category' }"
              title="Klik untuk mengurutkan kategori"
              @click="toggleSort('category')"
            >
              <div class="flex items-center gap-1">
                <span>KATEGORI</span>
                <ArrowUp v-if="sortField === 'category' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'category' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable w-32 text-right"
              :class="{ 'is-sorted': sortField === 'amount' }"
              title="Klik untuk mengurutkan nominal"
              @click="toggleSort('amount')"
            >
              <div class="flex items-center justify-end gap-1">
                <span>NOMINAL (RP)</span>
                <ArrowUp v-if="sortField === 'amount' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'amount' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th
              class="is-sortable text-left"
              :class="{ 'is-sorted': sortField === 'notes' }"
              title="Klik untuk mengurutkan keterangan"
              @click="toggleSort('notes')"
            >
              <div class="flex items-center gap-1">
                <span>KETERANGAN &amp; CATATAN</span>
                <ArrowUp v-if="sortField === 'notes' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
                <ArrowDown v-else-if="sortField === 'notes' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
              </div>
            </th>

            <th class="w-16 text-center select-none">AKSI</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(mut, mIdx) in sortedMutations"
            :key="mut.id"
            class="hover:bg-gray-50/60 whitespace-nowrap"
          >
            <td class="text-center font-mono text-gray-400 whitespace-nowrap">{{ mIdx + 1 }}</td>
            <td class="font-mono text-[11px] text-gray-700 whitespace-nowrap">{{ mut.date }}</td>
            <td class="font-mono text-[11px] text-gray-500 whitespace-nowrap">{{ mut.time || '-' }}</td>
            <td class="text-center whitespace-nowrap">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap"
                :class="mut.type === 'EXPENSE' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'"
              >
                {{ mut.type === 'EXPENSE' ? 'Keluar' : 'Transfer' }}
              </span>
            </td>
            <td class="font-semibold text-gray-800 whitespace-nowrap">
              <span v-if="mut.fromAccount === 'TUNAI'">Kas Tunai</span>
              <span v-else-if="mut.fromAccount === 'BANK'">Rekening Bank</span>
              <span v-else class="text-purple-700">Saldo QRIS</span>
            </td>
            <td class="text-gray-600 whitespace-nowrap">
              <template v-if="mut.toAccount">
                <span v-if="mut.toAccount === 'TUNAI'" class="font-semibold text-emerald-700">Kas Tunai</span>
                <span v-else-if="mut.toAccount === 'BANK'" class="font-semibold text-blue-700">Rekening Bank</span>
                <span v-else class="font-semibold text-purple-700">Saldo QRIS</span>
              </template>
              <span v-else class="text-rose-700 italic">Beban Keluar</span>
            </td>
            <td class="font-medium text-gray-800 whitespace-nowrap">{{ mut.category }}</td>
            <td
              class="text-right font-mono font-bold whitespace-nowrap"
              :class="mut.type === 'EXPENSE' ? 'text-rose-700' : 'text-blue-700'"
            >
              Rp {{ formatRupiah(mut.amount) }}
            </td>
            <td class="text-gray-600 text-[11px] whitespace-nowrap truncate max-w-sm">
              <span>{{ mut.notes || '-' }}</span>
              <span v-if="mut.referenceNo" class="text-gray-400 font-mono ml-1.5">({{ mut.referenceNo }})</span>
            </td>
            <td class="text-center whitespace-nowrap">
              <button
                type="button"
                class="p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer transition-colors"
                title="Hapus catatan mutasi kas"
                @click="handleDelete(mut)"
              >
                <Trash2 :size="13" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
