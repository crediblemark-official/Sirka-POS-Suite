<script setup lang="ts">
import { ref, computed } from 'vue';
import { useCashStore } from '../../stores/cashStore';
import { CashAccountType, CashMutation, CashMutationType } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import AppEmptyState from '../common/AppEmptyState.vue';
import CashPocketCards from '../cash/CashPocketCards.vue';
import {
  ArrowDownRight,
  ArrowLeftRight,
  Trash2,
  Filter
} from 'lucide-vue-next';

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
  (e: 'open-expense', account?: CashAccountType): void;
  (e: 'open-transfer', fromAccount?: CashAccountType): void;
}>();

const cashStore = useCashStore();
const confirmDialog = useConfirmDialog();

const typeFilter = ref<'ALL' | CashMutationType>('ALL');

// Saldo riil per akun berdasarkan rentang tanggal
const cashBalances = computed(() => {
  return cashStore.calculateAccountBalances(props.filterStartDate, props.filterEndDate);
});

// Filter mutasi berdasarkan tipe, tanggal, dan search query
const filteredMutations = computed(() => {
  const q = (props.searchQuery || '').toLowerCase().trim();
  const start = props.filterStartDate;
  const end = props.filterEndDate;

  return cashStore.mutations.filter(m => {
    // Filter rentang tanggal
    if (start && m.date < start) return false;
    if (end && m.date > end) return false;

    // Filter tipe
    if (typeFilter.value !== 'ALL' && m.type !== typeFilter.value) return false;

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

const expenseCount = computed(() => {
  return cashStore.mutations.filter(m => {
    if (props.filterStartDate && m.date < props.filterStartDate) return false;
    if (props.filterEndDate && m.date > props.filterEndDate) return false;
    return m.type === 'EXPENSE';
  }).length;
});

const transferCount = computed(() => {
  return cashStore.mutations.filter(m => {
    if (props.filterStartDate && m.date < props.filterStartDate) return false;
    if (props.filterEndDate && m.date > props.filterEndDate) return false;
    return m.type === 'TRANSFER';
  }).length;
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
    <!-- 1. Top Section: 3 Kartu Saldo Kantong Kas (Real-Time) -->
    <div class="p-3.5 bg-gray-50/80 border-b border-gray-200 shrink-0">
      <div class="flex items-center justify-between mb-2.5">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-gray-800 uppercase tracking-wide">
            Posisi Saldo Kas &amp; Rekening Toko
          </span>
          <span class="text-[11px] text-gray-500 font-medium">
            (Riil Terpisah: Laci Kasir, Bank Operasional, QRIS Aggregator)
          </span>
        </div>

        <!-- Tombol Aksi Mutasi Kas -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            @click="emit('open-expense')"
          >
            <ArrowDownRight :size="13" />
            <span>+ Catat Uang Keluar (Beban)</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            @click="emit('open-transfer')"
          >
            <ArrowLeftRight :size="13" />
            <span>⇄ Pindah Kas / Cairkan QRIS</span>
          </button>
        </div>
      </div>

      <!-- 3 Kartu Saldo Kantong Kas (Reusable Component) -->
      <CashPocketCards
        :balances="cashBalances"
        @settle-qris="emit('open-transfer', 'QRIS')"
      />
    </div>

    <!-- 2. Sub-Ribbon Filter Pills -->
    <div class="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] font-semibold text-gray-500 flex items-center gap-1 mr-1">
          <Filter :size="12" />
          <span>Tipe Mutasi:</span>
        </span>

        <button
          type="button"
          class="px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
          :class="typeFilter === 'ALL' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'"
          @click="typeFilter = 'ALL'"
        >
          <span>Semua</span>
          <span class="text-[10px] px-1 rounded-full" :class="typeFilter === 'ALL' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-600'">
            {{ cashStore.mutations.length }}
          </span>
        </button>

        <button
          type="button"
          class="px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
          :class="typeFilter === 'EXPENSE' ? 'bg-rose-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'"
          @click="typeFilter = 'EXPENSE'"
        >
          <ArrowDownRight :size="12" />
          <span>Uang Keluar / Beban</span>
          <span class="text-[10px] px-1 rounded-full" :class="typeFilter === 'EXPENSE' ? 'bg-rose-700 text-white' : 'bg-gray-100 text-gray-600'">
            {{ expenseCount }}
          </span>
        </button>

        <button
          type="button"
          class="px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
          :class="typeFilter === 'TRANSFER' ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'"
          @click="typeFilter = 'TRANSFER'"
        >
          <ArrowLeftRight :size="12" />
          <span>Pindah Kas &amp; Pencairan</span>
          <span class="text-[10px] px-1 rounded-full" :class="typeFilter === 'TRANSFER' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'">
            {{ transferCount }}
          </span>
        </button>
      </div>

      <div class="text-[11px] text-gray-500 font-mono">
        Total: <span class="font-bold text-gray-800">{{ filteredMutations.length }}</span> Mutasi
      </div>
    </div>

    <!-- 3. Tabel Data Mutasi Kas -->
    <div class="flex-1 overflow-auto">
      <table class="table-explorer w-full">
        <thead>
          <tr>
            <th class="w-12 text-center">NO</th>
            <th class="w-28 text-left">TANGGAL</th>
            <th class="w-20 text-left">JAM</th>
            <th class="w-24 text-center">TIPE</th>
            <th class="w-32 text-left">DARI SUMBER</th>
            <th class="w-32 text-left">KE TUJUAN</th>
            <th class="w-36 text-left">KATEGORI</th>
            <th class="w-32 text-right">NOMINAL (RP)</th>
            <th class="text-left">KETERANGAN &amp; CATATAN</th>
            <th class="w-16 text-center">AKSI</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(mut, mIdx) in filteredMutations"
            :key="mut.id"
            class="hover:bg-gray-50/60"
          >
            <td class="text-center font-mono text-gray-400">{{ mIdx + 1 }}</td>
            <td class="font-mono text-[11px] text-gray-700">{{ mut.date }}</td>
            <td class="font-mono text-[11px] text-gray-500">{{ mut.time || '-' }}</td>
            <td class="text-center">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                :class="mut.type === 'EXPENSE' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'"
              >
                {{ mut.type === 'EXPENSE' ? 'Keluar' : 'Transfer' }}
              </span>
            </td>
            <td class="font-semibold text-gray-800">
              <span v-if="mut.fromAccount === 'TUNAI'">Kas Tunai</span>
              <span v-else-if="mut.fromAccount === 'BANK'">Rekening Bank</span>
              <span v-else class="text-purple-700">Saldo QRIS</span>
            </td>
            <td class="text-gray-600">
              <template v-if="mut.toAccount">
                <span v-if="mut.toAccount === 'TUNAI'" class="font-semibold text-emerald-700">Kas Tunai</span>
                <span v-else-if="mut.toAccount === 'BANK'" class="font-semibold text-blue-700">Rekening Bank</span>
                <span v-else class="font-semibold text-purple-700">Saldo QRIS</span>
              </template>
              <span v-else class="text-rose-700 italic">Beban Keluar</span>
            </td>
            <td class="font-medium text-gray-800">{{ mut.category }}</td>
            <td
              class="text-right font-mono font-bold"
              :class="mut.type === 'EXPENSE' ? 'text-rose-700' : 'text-blue-700'"
            >
              Rp {{ formatRupiah(mut.amount) }}
            </td>
            <td class="text-gray-600 text-[11px]">
              <span>{{ mut.notes || '-' }}</span>
              <span v-if="mut.referenceNo" class="text-gray-400 font-mono ml-1.5">({{ mut.referenceNo }})</span>
            </td>
            <td class="text-center">
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

          <!-- Empty State -->
          <tr v-if="filteredMutations.length === 0">
            <td colspan="10" class="p-12 text-center text-gray-400">
              <AppEmptyState
                title="Belum ada riwayat mutasi kas"
                description="Catat pengeluaran operasional (listrik, gaji, transport, konsumsi) atau pemindahan kas (setor tunai ke bank, cairkan QRIS ke bank)."
              />
              <div class="flex items-center justify-center gap-2 mt-3">
                <button
                  type="button"
                  class="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  @click="emit('open-expense')"
                >
                  <ArrowDownRight :size="13" />
                  <span>+ Catat Uang Keluar</span>
                </button>
                <button
                  type="button"
                  class="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                  @click="emit('open-transfer')"
                >
                  <ArrowLeftRight :size="13" />
                  <span>⇄ Pindah Kas</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
