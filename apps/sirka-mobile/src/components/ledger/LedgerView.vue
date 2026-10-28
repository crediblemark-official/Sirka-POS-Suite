<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useLedgerStore } from '../../stores/ledgerStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { PaymentStatus, Transaction } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  BookOpen,
  FileText,
  TrendingUp,
  PackageCheck,
  Coins,
  Clock,
  Users,
  Plus
} from 'lucide-vue-next';

import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import { SelectOption } from '../common/SearchableSelect.vue';
import LedgerRibbon from './LedgerRibbon.vue';
import LedgerTransactionsTable from './LedgerTransactionsTable.vue';
import LedgerItemsTable from './LedgerItemsTable.vue';
import LedgerStatusModal from './LedgerStatusModal.vue';
import RefundModal from '../returns/RefundModal.vue';
import RefundHistoryTable from '../returns/RefundHistoryTable.vue';
import LedgerMutationsTable from './LedgerMutationsTable.vue';
import CashMutationModal from '../cash/CashMutationModal.vue';
import { useReturnStore } from '../../stores/returnStore';
import { useCashStore } from '../../stores/cashStore';
import { CashAccountType } from '../../types';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

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
const returnStore = useReturnStore();
const cashStore = useCashStore();

// 1. Reactive Filters & View State
const filterBuyer = ref<string>('Semua');
const filterStatus = ref<PaymentStatus | 'Semua'>('Semua');
const filterMethod = ref<string>('Semua');
const filterMarket = ref<'Semua' | 'B2B' | 'B2C'>('Semua');
const filterStartDate = ref<string>('');
const filterEndDate = ref<string>('');
const displayLimit = ref<number>(50);
const viewMode = ref<'transactions' | 'items' | 'refunds' | 'mutations'>('transactions');
const expandedTxIds = ref<Set<string>>(new Set());

// Modal Catat Uang Keluar & Pemindahan Kas
const cashModalState = ref<{
  isOpen: boolean;
  tab: 'EXPENSE' | 'TRANSFER';
  fromAccount?: CashAccountType;
}>({
  isOpen: false,
  tab: 'EXPENSE',
  fromAccount: 'TUNAI'
});

function openMutationModal(account?: CashAccountType) {
  cashModalState.value = {
    isOpen: true,
    tab: 'EXPENSE',
    fromAccount: account || 'TUNAI'
  };
}

function openExpenseModal(account?: CashAccountType) {
  cashModalState.value = {
    isOpen: true,
    tab: 'EXPENSE',
    fromAccount: account || 'TUNAI'
  };
}

function openTransferModal(fromAccount?: CashAccountType) {
  cashModalState.value = {
    isOpen: true,
    tab: 'TRANSFER',
    fromAccount: fromAccount || 'QRIS'
  };
}

// 2. Buyer select options
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
  return (
    filterStatus.value !== 'Semua' ||
    filterMethod.value !== 'Semua' ||
    filterMarket.value !== 'Semua' ||
    filterBuyer.value !== 'Semua' ||
    !!filterStartDate.value ||
    !!filterEndDate.value
  );
});

function resetFilters() {
  filterStatus.value = 'Semua';
  filterMethod.value = 'Semua';
  filterMarket.value = 'Semua';
  filterBuyer.value = 'Semua';
  filterStartDate.value = '';
  filterEndDate.value = '';
  displayLimit.value = 50;
}

// 3. Ribbon Counts
const lunasCount = computed(() => ledgerStore.transactions.filter(t => t.paymentStatus === 'LUNAS').length);
const tempoCount = computed(() => ledgerStore.transactions.filter(t => t.paymentStatus === 'TEMPO').length);
const tunaiCount = computed(() => ledgerStore.transactions.filter(t => t.paymentMethod === 'Tunai / Kas' || (t.paymentMethod as string) === 'Tunai').length);
const transferCount = computed(() => ledgerStore.transactions.filter(t => t.paymentMethod === 'Transfer Bank').length);
const qrisCount = computed(() => ledgerStore.transactions.filter(t => t.paymentMethod === 'QRIS').length);
const notaTempoCount = computed(() => ledgerStore.transactions.filter(t => t.paymentMethod === 'Nota Tempo' || (t.paymentMethod as string) === 'TEMPO').length);
const b2bCount = computed(() => ledgerStore.transactions.filter(t => (t.customerType || 'B2B') === 'B2B').length);
const b2cCount = computed(() => ledgerStore.transactions.filter(t => t.customerType === 'B2C').length);

// 4. Filtered Data (DRY Helper)
function matchesCommonFilters(date: string, buyer: string, status: PaymentStatus, customerType?: string, paymentMethod?: string): boolean {
  if (filterStartDate.value && date < filterStartDate.value) return false;
  if (filterEndDate.value && date > filterEndDate.value) return false;
  const matchBuyer = filterBuyer.value === 'Semua' || buyer === filterBuyer.value;
  const matchStatus = filterStatus.value === 'Semua' || status === filterStatus.value;
  const matchMarket = filterMarket.value === 'Semua' || (customerType || 'B2B') === filterMarket.value;
  const matchMethod = filterMethod.value === 'Semua' || (paymentMethod || 'Transfer Bank') === filterMethod.value;
  return matchBuyer && matchStatus && matchMarket && matchMethod;
}

const filteredTransactions = computed(() => {
  const q = (props.searchQuery || '').toLowerCase().trim();
  return ledgerStore.transactions.filter(t => {
    if (!matchesCommonFilters(t.date, t.buyer, t.paymentStatus, t.customerType, t.paymentMethod)) return false;
    if (!q) return true;
    return (
      t.invoiceNo.toLowerCase().includes(q) ||
      t.buyer.toLowerCase().includes(q) ||
      (t.paymentMethod || '').toLowerCase().includes(q) ||
      t.items.some(i => i.name.toLowerCase().includes(q))
    );
  });
});

const filteredFlatRows = computed(() => {
  const q = (props.searchQuery || '').toLowerCase().trim();
  return ledgerStore.flatLedgerRows.filter(r => {
    if (!matchesCommonFilters(r.date, r.buyer, r.paymentStatus, r.customerType, r.paymentMethod)) return false;
    if (!q) return true;
    return (
      r.invoiceNo.toLowerCase().includes(q) ||
      r.productName.toLowerCase().includes(q) ||
      r.buyer.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.paymentMethod || '').toLowerCase().includes(q)
    );
  });
});

// 5. Progressive Loading & Displayed Slices
const displayedTransactions = computed(() => {
  return filteredTransactions.value.slice(0, displayLimit.value);
});

const displayedFlatRows = computed(() => {
  return filteredFlatRows.value.slice(0, displayLimit.value);
});

const hasMoreTransactions = computed(() => {
  return filteredTransactions.value.length > displayLimit.value;
});

const hasMoreFlatRows = computed(() => {
  return filteredFlatRows.value.length > displayLimit.value;
});

function loadMore() {
  displayLimit.value += 50;
}

function showAll() {
  displayLimit.value = Math.max(filteredTransactions.value.length, filteredFlatRows.value.length);
}

// Reset limit ketika filter atau query pencarian berubah
watch([filterBuyer, filterStatus, filterMethod, filterMarket, filterStartDate, filterEndDate, () => props.searchQuery, viewMode], () => {
  displayLimit.value = 50;
});

// 6. Expand state management
const isAllExpanded = computed(() => {
  return displayedTransactions.value.length > 0 && displayedTransactions.value.every(tx => expandedTxIds.value.has(tx.id));
});

function toggleTxExpand(id: string) {
  if (expandedTxIds.value.has(id)) {
    expandedTxIds.value.delete(id);
  } else {
    expandedTxIds.value.add(id);
  }
}

function toggleExpandAll() {
  if (isAllExpanded.value) {
    expandedTxIds.value.clear();
  } else {
    displayedTransactions.value.forEach(tx => expandedTxIds.value.add(tx.id));
  }
}

// 6. Metric Stats Strip Configuration (DRY)
const metricStats = computed<MetricStatItem[]>(() => {
  const totalRev = filteredTransactions.value.reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
  const totalBuy = filteredTransactions.value.reduce((acc, t) => acc + (t.totalBuy || 0), 0);
  const totalProfit = filteredTransactions.value.reduce((acc, t) => acc + (t.totalProfit || 0), 0);
  const marginPct = totalBuy === 0 ? 0 : Number(((totalProfit / totalBuy) * 100).toFixed(1));
  const totalReceivables = filteredTransactions.value
    .filter(t => t.paymentStatus === 'TEMPO')
    .reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0);
  const uniqueBuyers = new Set(filteredTransactions.value.map(t => t.buyer)).size;

  return [
    {
      label: 'Total Transaksi',
      value: filteredTransactions.value.length,
      icon: FileText,
      iconBoxClass: 'bg-indigo-50 text-indigo-700',
      valClass: 'text-gray-800'
    },
    {
      label: 'Total Omzet Penjualan',
      value: `Rp ${formatRupiah(totalRev)}`,
      icon: TrendingUp,
      iconBoxClass: 'bg-blue-50 text-blue-700',
      valClass: 'text-blue-700'
    },
    {
      label: 'Modal Barang (HPP)',
      value: `Rp ${formatRupiah(totalBuy)}`,
      icon: PackageCheck,
      iconBoxClass: 'bg-emerald-50 text-emerald-700',
      valClass: 'text-emerald-700'
    },
    {
      label: 'Untung Bersih (Laba)',
      value: `+Rp ${formatRupiah(totalProfit)}`,
      icon: Coins,
      iconBoxClass: 'bg-teal-50 text-teal-700',
      valClass: 'text-teal-800'
    },
    {
      label: 'Piutang / Bon Tempo',
      value: `Rp ${formatRupiah(totalReceivables)}`,
      icon: Clock,
      iconBoxClass: 'bg-amber-50 text-amber-700',
      valClass: 'text-amber-900'
    },
    {
      label: 'Pelanggan Aktif',
      value: uniqueBuyers,
      icon: Users,
      iconBoxClass: 'bg-purple-50 text-purple-700',
      valClass: 'text-purple-900'
    }
  ];
});

// 7. Status Confirmation Modal State & Handlers
const statusConfirmModal = ref<{
  isOpen: boolean;
  tx: Transaction | null;
  targetStatus: PaymentStatus;
}>({
  isOpen: false,
  tx: null,
  targetStatus: 'TEMPO'
});

function handleOpenStatusConfirm(tx: Transaction) {
  statusConfirmModal.value = {
    isOpen: true,
    tx,
    targetStatus: tx.paymentStatus === 'LUNAS' ? 'TEMPO' : 'LUNAS'
  };
}

function handleConfirmStatusChange() {
  if (statusConfirmModal.value.tx) {
    ledgerStore.togglePaymentStatus(statusConfirmModal.value.tx.id);
  }
  statusConfirmModal.value.isOpen = false;
  statusConfirmModal.value.tx = null;
}

function handleCancelStatusConfirm() {
  statusConfirmModal.value.isOpen = false;
  statusConfirmModal.value.tx = null;
}

const { confirm: showConfirm } = useConfirmDialog();

// 8. Delete transaction handler
async function handleDeleteTransaction(id: string) {
  const isConfirmed = await showConfirm({
    title: 'Hapus Catatan Transaksi',
    message: 'Yakin ingin menghapus catatan transaksi ini?',
    details: 'Stok barang dan poin member akan dikembalikan otomatis sesuai transaksi yang dihapus.',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger'
  });
  if (!isConfirmed) return;
  try {
    await ledgerStore.deleteTransaction(id);
  } catch (error) {
    console.error(`Gagal menghapus transaksi:`, error);
  }
}
function handleRefundViewReceipt(invoiceNo: string) {
  const tx = ledgerStore.transactions.find(t => t.invoiceNo === invoiceNo);
  if (tx) {
    emit('view-receipt', tx);
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- 1. Top Filter Ribbon (Modular Component) -->
    <LedgerRibbon
      v-model:filter-status="filterStatus"
      v-model:filter-method="filterMethod"
      v-model:filter-market="filterMarket"
      v-model:filter-buyer="filterBuyer"
      v-model:filter-start-date="filterStartDate"
      v-model:filter-end-date="filterEndDate"
      v-model:view-mode="viewMode"
      :search-query="props.searchQuery"
      :total-transactions-count="ledgerStore.transactions.length"
      :lunas-count="lunasCount"
      :tempo-count="tempoCount"
      :tunai-count="tunaiCount"
      :transfer-count="transferCount"
      :qris-count="qrisCount"
      :nota-tempo-count="notaTempoCount"
      :b2b-count="b2bCount"
      :b2c-count="b2cCount"
      :refunds-count="returnStore.refunds.length"
      :mutations-count="cashStore.mutations.length"
      :buyer-options="buyerOptions"
      :has-active-filter="hasActiveFilter"
      @open-mutation="openMutationModal"
      @open-expense="openExpenseModal"
      @open-transfer="openTransferModal"
      @reset-filters="resetFilters"
    />

    <!-- 2. Reusable MetricStatsStrip (DRY) -->
    <MetricStatsStrip v-if="viewMode !== 'refunds' && viewMode !== 'mutations'" :items="metricStats" />

    <!-- 3. Main Workspace: Edge-to-Edge Table (Modular & DRY) -->
    <div class="flex-1 flex flex-col overflow-hidden bg-white">
      <div class="flex-1 overflow-auto flex flex-col">
        <!-- Reusable Empty State -->

        <AppEmptyState
          v-if="viewMode !== 'refunds' && viewMode !== 'mutations' && ledgerStore.transactions.length === 0"
          :icon="BookOpen"
          title="Belum Ada Transaksi Tercatat"
          description="Selesaikan transaksi penjualan di tab Kasir POS untuk mengisi buku besar."
        />

        <!-- Mode 1: Per Nota Transaksi (Modular Table) -->
        <LedgerTransactionsTable
          v-else-if="viewMode === 'transactions'"
          :transactions="displayedTransactions"
          :expanded-tx-ids="expandedTxIds"
          :is-all-expanded="isAllExpanded"
          @toggle-expand="toggleTxExpand"
          @toggle-expand-all="toggleExpandAll"
          @open-status-confirm="handleOpenStatusConfirm"
          @view-receipt="emit('view-receipt', $event)"
          @delete-transaction="handleDeleteTransaction"
        />

        <!-- Mode 2: Per Baris Barang Spreadsheet (Modular Table) -->
        <LedgerItemsTable
          v-else-if="viewMode === 'items'"
          :rows="displayedFlatRows"
        />

        <!-- Mode 3: Riwayat Retur & Refund (Poin 8) -->
        <RefundHistoryTable
          v-else-if="viewMode === 'refunds'"
          :search-query="props.searchQuery"
          @view-receipt="handleRefundViewReceipt"
        />

        <!-- Mode 4: Mutasi Kas, Uang Keluar & Pemindahan Akun -->
        <LedgerMutationsTable
          v-else-if="viewMode === 'mutations'"
          :filter-start-date="filterStartDate"
          :filter-end-date="filterEndDate"
          :search-query="props.searchQuery"
          @open-mutation="openMutationModal"
          @open-expense="openExpenseModal"
          @open-transfer="openTransferModal"
        />
      </div>

      <!-- Toolbar Pagination / Load More Bar -->
      <div
        v-if="(viewMode === 'transactions' && hasMoreTransactions) || (viewMode === 'items' && hasMoreFlatRows)"
        class="shrink-0 bg-[#faf9f6] border-t border-gray-200 px-4 py-2 flex items-center justify-between text-xs text-gray-600 shadow-2xs select-none"
      >
        <div class="flex items-center gap-2 font-medium">
          <span class="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
          <span>
            Menampilkan
            <strong class="text-gray-900 font-mono">
              {{ viewMode === 'transactions' ? displayedTransactions.length : displayedFlatRows.length }}
            </strong>
            dari
            <strong class="text-gray-900 font-mono">
              {{ viewMode === 'transactions' ? filteredTransactions.length : filteredFlatRows.length }}
            </strong>
            {{ viewMode === 'transactions' ? 'nota transaksi' : 'baris rincian barang' }}
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer transition-colors shadow-2xs"
            @click="loadMore"
          >
            + Muat 50 Lagi
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-semibold text-xs cursor-pointer transition-colors"
            @click="showAll"
          >
            Tampilkan Semua
          </button>
        </div>
      </div>
    </div>

    <!-- 4. Modal Konfirmasi Status Bayar (Modular Component) -->
    <LedgerStatusModal
      :is-open="statusConfirmModal.isOpen"
      :transaction="statusConfirmModal.tx"
      :target-status="statusConfirmModal.targetStatus"
      @confirm="handleConfirmStatusChange"
      @cancel="handleCancelStatusConfirm"
    />

    <!-- 5. Modal Retur Transaksi Nota -->
    <RefundModal />

    <!-- 6. Modal Catat Uang Keluar & Pemindahan Kas -->
    <CashMutationModal
      :is-open="cashModalState.isOpen"
      :initial-tab="cashModalState.tab"
      :initial-from-account="cashModalState.fromAccount"
      @close="cashModalState.isOpen = false"
    />

    <!-- Floating Action Button: Catat Mutasi Kas -->
    <button
      type="button"
      class="fixed right-4 bottom-20 z-30 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
      title="Catat Mutasi Kas / Uang Keluar"
      @click="openMutationModal('TUNAI')"
    >
      <Plus :size="18" />
      <span>Mutasi Kas</span>
    </button>
  </div>
</template>
