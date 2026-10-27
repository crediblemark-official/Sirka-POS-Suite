<script setup lang="ts">
import { ref, computed } from 'vue';
import { useReturnStore } from '../../stores/returnStore';
import { formatRupiah } from '../../utils/formatters';
import type { RefundType } from '../../types';
import AppEmptyState from '../common/AppEmptyState.vue';
import MetricStatsStrip, { type MetricStatItem } from '../common/MetricStatsStrip.vue';
import {
  RotateCcw,
  Receipt,
  PackageCheck,
  PackageX,
  CreditCard,
  Banknote,
  Search,
  User,
  Layers,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next';

type RefundSortField = 'createdAt' | 'invoiceNo' | 'refundType' | 'cashierName' | 'reason' | 'refundPaymentMethod' | 'totalRefundAmount';
type SortDirection = 'asc' | 'desc';

const sortField = ref<RefundSortField>('createdAt');
const sortDirection = ref<SortDirection>('desc');

function toggleSort(field: RefundSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = ['createdAt', 'totalRefundAmount'].includes(field) ? 'desc' : 'asc';
  }
}

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const emit = defineEmits<{
  (e: 'view-receipt', invoiceNo: string): void;
}>();

const returnStore = useReturnStore();

// Filter States
const selectedType = ref<RefundType | 'ALL'>('ALL');
const selectedMethod = ref<'ALL' | 'TUNAI' | 'TRANSFER'>('ALL');
const localSearch = ref('');

// Filtered refunds
const filteredRefunds = computed(() => {
  const query = (props.searchQuery || localSearch.value || '').toLowerCase().trim();

  return returnStore.refunds.filter(r => {
    // Filter Type
    if (selectedType.value !== 'ALL' && r.refundType !== selectedType.value) {
      return false;
    }

    // Filter Method
    if (selectedMethod.value !== 'ALL' && r.refundPaymentMethod !== selectedMethod.value) {
      return false;
    }

    // Search query
    if (query) {
      const matchInvoice = r.invoiceNo.toLowerCase().includes(query);
      const matchReason = r.reason.toLowerCase().includes(query);
      const matchCashier = r.cashierName.toLowerCase().includes(query);
      const matchItems = r.items.some(it => it.productName.toLowerCase().includes(query));
      if (!matchInvoice && !matchReason && !matchCashier && !matchItems) {
        return false;
      }
    }

    return true;
  });
});

const sortedRefunds = computed(() => {
  const list = [...filteredRefunds.value];
  const field = sortField.value;
  const dir = sortDirection.value === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    switch (field) {
      case 'createdAt':
        return dir * (new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      case 'invoiceNo':
        return dir * (a.invoiceNo || '').localeCompare(b.invoiceNo || '');
      case 'refundType':
        return dir * (a.refundType || '').localeCompare(b.refundType || '');
      case 'cashierName':
        return dir * (a.cashierName || '').localeCompare(b.cashierName || '');
      case 'reason':
        return dir * (a.reason || '').localeCompare(b.reason || '');
      case 'refundPaymentMethod':
        return dir * (a.refundPaymentMethod || '').localeCompare(b.refundPaymentMethod || '');
      case 'totalRefundAmount':
        return dir * ((a.totalRefundAmount || 0) - (b.totalRefundAmount || 0));
      default:
        return 0;
    }
  });

  return list;
});

// Metric Stats Calculations
const totalRefundCount = computed(() => returnStore.refunds.length);
const totalRefundMoney = computed(() =>
  returnStore.refunds.reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0)
);

const totalCashRefund = computed(() =>
  returnStore.refunds
    .filter(r => r.refundPaymentMethod === 'TUNAI')
    .reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0)
);

const totalTransferRefund = computed(() =>
  returnStore.refunds
    .filter(r => r.refundPaymentMethod === 'TRANSFER')
    .reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0)
);

const damagedCount = computed(() =>
  returnStore.refunds.filter(r => r.refundType === 'DAMAGED_GOODS').length
);

const restockCount = computed(() =>
  returnStore.refunds.filter(r => r.refundType === 'RESTOCK').length
);

const metricStats = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Kasus Retur',
    value: `${totalRefundCount.value} Nota`,
    icon: RotateCcw,
    iconBoxClass: 'bg-rose-50 text-rose-700',
    valClass: 'text-gray-900 font-bold'
  },
  {
    label: 'Total Dana Dikembalikan',
    value: `Rp ${formatRupiah(totalRefundMoney.value)}`,
    icon: Banknote,
    iconBoxClass: 'bg-rose-100 text-rose-800',
    valClass: 'text-rose-700 font-black'
  },
  {
    label: 'Refund Tunai (Laci)',
    value: `Rp ${formatRupiah(totalCashRefund.value)}`,
    icon: Banknote,
    iconBoxClass: 'bg-amber-50 text-amber-700',
    valClass: 'text-amber-800'
  },
  {
    label: 'Refund Transfer Bank',
    value: `Rp ${formatRupiah(totalTransferRefund.value)}`,
    icon: CreditCard,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-blue-800'
  },
  {
    label: 'Barang Rusak vs Restock',
    value: `${damagedCount.value} Rusak • ${restockCount.value} Masuk Rak`,
    icon: Layers,
    iconBoxClass: 'bg-purple-50 text-purple-700',
    valClass: 'text-purple-800'
  }
]);

function handleRowReceiptClick(invoiceNo: string) {
  emit('view-receipt', invoiceNo);
}

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
      <!-- Sisi Kiri: Filter Jenis Retur & Metode -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Jenis Retur Buttons -->
        <div class="flex bg-gray-200/90 p-0.5 rounded border border-gray-300 shrink-0">
          <button
            type="button"
            class="px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all shrink-0 whitespace-nowrap"
            :class="selectedType === 'ALL' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedType = 'ALL'"
          >
            Semua Jenis ({{ returnStore.refunds.length }})
          </button>
          <button
            type="button"
            class="px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
            :class="selectedType === 'DAMAGED_GOODS' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedType = 'DAMAGED_GOODS'"
          >
            <PackageX :size="11" />
            <span>Barang Rusak</span>
          </button>
          <button
            type="button"
            class="px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
            :class="selectedType === 'RESTOCK' ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedType = 'RESTOCK'"
          >
            <PackageCheck :size="11" />
            <span>Kembali ke Stok</span>
          </button>
          <button
            type="button"
            class="px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
            :class="selectedType === 'CORRECTION' ? 'bg-blue-600 text-white shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="selectedType = 'CORRECTION'"
          >
            <RotateCcw :size="11" />
            <span>Koreksi Input</span>
          </button>
        </div>

        <div class="h-4 w-px bg-gray-300 shrink-0"></div>

        <!-- Metode Pengembalian -->
        <div class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all shrink-0 whitespace-nowrap"
            :class="selectedMethod === 'ALL' ? 'bg-gray-300 text-gray-900 font-bold' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'"
            @click="selectedMethod = 'ALL'"
          >
            Semua Metode
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
            :class="selectedMethod === 'TUNAI' ? 'bg-amber-600 text-white font-bold' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="selectedMethod = 'TUNAI'"
          >
            <Banknote :size="11" />
            <span>Tunai</span>
          </button>
          <button
            type="button"
            class="px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
            :class="selectedMethod === 'TRANSFER' ? 'bg-blue-600 text-white font-bold' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
            @click="selectedMethod = 'TRANSFER'"
          >
            <CreditCard :size="11" />
            <span>Transfer</span>
          </button>
        </div>
      </div>

      <!-- Sisi Kanan: Pencarian Lokal Tambahan -->
      <div class="flex items-center gap-2 shrink-0">
        <div class="relative w-48">
          <Search :size="12" class="absolute left-2.5 top-2 text-gray-400" />
          <input
            v-model="localSearch"
            type="text"
            placeholder="Cari nota, barang, alasan..."
            class="w-full pl-7 pr-2 py-1 bg-white border border-gray-300 rounded text-[11px] focus:outline-none focus:border-rose-500 shadow-2xs"
          />
        </div>
      </div>
    </div>

    <!-- Main Table Area -->
    <div class="flex-1 overflow-auto bg-white">
      <AppEmptyState
        v-if="filteredRefunds.length === 0"
        :icon="RotateCcw"
        title="Belum Ada Riwayat Retur & Refund"
        description="Belum ada transaksi refund yang dicatat atau tidak ada data yang cocok dengan filter yang dipilih."
      />

      <table v-else class="w-full text-left border-collapse text-xs whitespace-nowrap">
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
                <ArrowUp v-if="sortField === 'createdAt' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'createdAt' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 w-44 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'invoiceNo' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan no. nota"
              @click="toggleSort('invoiceNo')"
            >
              <div class="flex items-center gap-1.5">
                <span>NO. NOTA TRANSAKSI</span>
                <ArrowUp v-if="sortField === 'invoiceNo' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'invoiceNo' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 w-36 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'refundType' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan jenis retur"
              @click="toggleSort('refundType')"
            >
              <div class="flex items-center gap-1.5">
                <span>JENIS RETUR</span>
                <ArrowUp v-if="sortField === 'refundType' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'refundType' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 w-32 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'cashierName' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan kasir/petugas"
              @click="toggleSort('cashierName')"
            >
              <div class="flex items-center gap-1.5">
                <span>KASIR / PETUGAS</span>
                <ArrowUp v-if="sortField === 'cashierName' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'cashierName' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
              </div>
            </th>
            <th class="py-2.5 px-3 min-w-[240px] whitespace-nowrap">RINCIAN BARANG DIRETUR</th>
            <th
              class="py-2.5 px-3 min-w-[160px] cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'reason' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan alasan retur"
              @click="toggleSort('reason')"
            >
              <div class="flex items-center gap-1.5">
                <span>ALASAN RETUR</span>
                <ArrowUp v-if="sortField === 'reason' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'reason' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 text-center w-28 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'refundPaymentMethod' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan metode bayar"
              @click="toggleSort('refundPaymentMethod')"
            >
              <div class="flex items-center justify-center gap-1.5">
                <span>METODE</span>
                <ArrowUp v-if="sortField === 'refundPaymentMethod' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'refundPaymentMethod' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
              </div>
            </th>
            <th
              class="py-2.5 px-3 text-right w-36 cursor-pointer select-none transition-colors whitespace-nowrap"
              :class="sortField === 'totalRefundAmount' ? 'bg-[#dfdbd4] text-gray-900' : 'hover:bg-[#eae7e1]'"
              title="Klik untuk mengurutkan total refund"
              @click="toggleSort('totalRefundAmount')"
            >
              <div class="flex items-center justify-end gap-1.5">
                <span>TOTAL REFUND</span>
                <ArrowUp v-if="sortField === 'totalRefundAmount' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'totalRefundAmount' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <tr
            v-for="(r, idx) in sortedRefunds"
            :key="r.id"
            class="hover:bg-rose-50/40 transition-colors"
          >
            <!-- No -->
            <td class="py-2.5 px-3 text-center font-mono text-[11px] text-gray-400">
              {{ idx + 1 }}
            </td>

            <!-- Waktu -->
            <td class="py-2.5 px-3">
              <div class="font-mono text-[11px] text-gray-800 font-medium">
                {{ formatDateTime(r.createdAt) }}
              </div>
              <div class="text-[10px] text-gray-400 font-mono">
                ID: {{ r.id }}
              </div>
            </td>

            <!-- No. Nota Transaksi -->
            <td class="py-2.5 px-3">
              <button
                type="button"
                class="font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                title="Buka Struk Transaksi Ini"
                @click="handleRowReceiptClick(r.invoiceNo)"
              >
                <Receipt :size="12" class="text-blue-600 shrink-0" />
                <span>{{ r.invoiceNo }}</span>
              </button>
            </td>

            <!-- Jenis Retur Badge -->
            <td class="py-2.5 px-3">
              <span
                v-if="r.refundType === 'DAMAGED_GOODS'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-100 text-rose-800 border border-rose-200"
              >
                <PackageX :size="11" />
                <span>Barang Rusak</span>
              </span>
              <span
                v-else-if="r.refundType === 'RESTOCK'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200"
              >
                <PackageCheck :size="11" />
                <span>Masuk Stok</span>
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200"
              >
                <RotateCcw :size="11" />
                <span>Koreksi Input</span>
              </span>
            </td>

            <!-- Kasir / Petugas -->
            <td class="py-2.5 px-3">
              <div class="flex items-center gap-1.5 text-gray-800 font-semibold">
                <User :size="12" class="text-gray-400" />
                <span class="truncate">{{ r.cashierName || 'Kasir' }}</span>
              </div>
            </td>

            <!-- Rincian Barang Diretur -->
            <td class="py-2.5 px-3">
              <div class="space-y-1">
                <div
                  v-for="item in r.items"
                  :key="item.productId"
                  class="flex items-center justify-between gap-2 p-1 bg-gray-50 rounded border border-gray-100 text-[11px]"
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span
                      class="w-1.5 h-1.5 rounded-full shrink-0"
                      :class="item.returnToStock ? 'bg-emerald-500' : 'bg-rose-500'"
                    ></span>
                    <span class="font-bold text-gray-900 truncate">{{ item.productName }}</span>
                    <span class="text-gray-500 font-mono text-[10px]">
                      ({{ item.qty }} {{ item.unit }})
                    </span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span
                      class="text-[9.5px] px-1 rounded font-bold"
                      :class="item.returnToStock ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
                    >
                      {{ item.returnToStock ? 'Masuk Rak' : 'Afkir' }}
                    </span>
                    <span class="font-mono font-bold text-gray-700">
                      Rp {{ formatRupiah(item.refundAmount) }}
                    </span>
                  </div>
                </div>
              </div>
            </td>

            <!-- Alasan -->
            <td class="py-2.5 px-3">
              <p class="text-gray-700 text-[11px] leading-snug line-clamp-2 italic">
                "{{ r.reason || 'Tidak ada catatan' }}"
              </p>
            </td>

            <!-- Metode Pembayaran -->
            <td class="py-2.5 px-3 text-center">
              <span
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold font-mono"
                :class="r.refundPaymentMethod === 'TUNAI'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-blue-100 text-blue-900 border border-blue-300'"
              >
                <Banknote v-if="r.refundPaymentMethod === 'TUNAI'" :size="11" />
                <CreditCard v-else :size="11" />
                <span>{{ r.refundPaymentMethod }}</span>
              </span>
            </td>

            <!-- Total Refund -->
            <td class="py-2.5 px-3 text-right">
              <span class="font-mono font-black text-rose-700 text-xs">
                -Rp {{ formatRupiah(r.totalRefundAmount) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
