<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Printer,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  FileText,
  RotateCcw,
  Banknote,
  Landmark,
  QrCode,
  Package,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next';
import { Transaction } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useReturnStore } from '../../stores/returnStore';

type TxSortField = 'invoiceNo' | 'date' | 'customerType' | 'buyer' | 'itemsCount' | 'totalBuy' | 'finalTotal' | 'totalProfit' | 'paymentStatus' | 'paymentMethod';
type SortDirection = 'asc' | 'desc';

const returnStore = useReturnStore();

const props = defineProps<{
  transactions: Transaction[];
  expandedTxIds: Set<string>;
  isAllExpanded: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-expand', txId: string): void;
  (e: 'toggle-expand-all'): void;
  (e: 'open-status-confirm', tx: Transaction): void;
  (e: 'view-receipt', tx: Transaction): void;
  (e: 'delete-transaction', id: string): void;
}>();

const sortField = ref<TxSortField>('date');
const sortDirection = ref<SortDirection>('desc');

function toggleSort(field: TxSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = (field === 'date' || field === 'finalTotal' || field === 'totalProfit' || field === 'totalBuy' || field === 'itemsCount') ? 'desc' : 'asc';
  }
}

const sortedTransactions = computed(() => {
  const list = [...props.transactions];
  const dir = sortDirection.value === 'asc' ? 1 : -1;
  const field = sortField.value;

  return list.sort((a, b) => {
    if (field === 'date') {
      const dtA = a.createdAt || a.date;
      const dtB = b.createdAt || b.date;
      return dtA.localeCompare(dtB) * dir;
    }
    if (field === 'invoiceNo') {
      return a.invoiceNo.localeCompare(b.invoiceNo) * dir;
    }
    if (field === 'customerType') {
      return (a.customerType || 'B2B').localeCompare(b.customerType || 'B2B') * dir;
    }
    if (field === 'buyer') {
      return a.buyer.localeCompare(b.buyer) * dir;
    }
    if (field === 'itemsCount') {
      return (a.items.length - b.items.length) * dir;
    }
    if (field === 'totalBuy') {
      return ((a.totalBuy || 0) - (b.totalBuy || 0)) * dir;
    }
    if (field === 'finalTotal') {
      return ((a.finalTotal ?? a.totalSell) - (b.finalTotal ?? b.totalSell)) * dir;
    }
    if (field === 'totalProfit') {
      return ((a.totalProfit || 0) - (b.totalProfit || 0)) * dir;
    }
    if (field === 'paymentStatus') {
      return a.paymentStatus.localeCompare(b.paymentStatus) * dir;
    }
    if (field === 'paymentMethod') {
      return (a.paymentMethod || '').localeCompare(b.paymentMethod || '') * dir;
    }
    return 0;
  });
});
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-slate-50 select-none text-xs overflow-hidden">
    <!-- Mobile Sort & Control Ribbon -->
    <div class="px-3 py-2 bg-white border-b border-gray-200 flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-1.5 text-[11px] text-gray-600">
        <span class="font-medium">Urut:</span>
        <select
          :value="sortField"
          class="bg-gray-50 border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-800 font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          @change="e => sortField = (e.target as HTMLSelectElement).value as any"
        >
          <option value="date">Waktu Transaksi</option>
          <option value="invoiceNo">No. Nota</option>
          <option value="finalTotal">Total Nota</option>
          <option value="totalProfit">Untung Bersih</option>
          <option value="buyer">Nama Pelanggan</option>
          <option value="paymentStatus">Status Bayar</option>
        </select>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          type="button"
          class="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 active:bg-gray-100"
          @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
        >
          <span>{{ sortDirection === 'asc' ? 'Naik' : 'Turun' }}</span>
          <ArrowUp v-if="sortDirection === 'asc'" :size="12" class="text-indigo-600" />
          <ArrowDown v-else :size="12" class="text-indigo-600" />
        </button>

        <button
          type="button"
          class="p-1 bg-white border border-gray-300 rounded text-gray-600 hover:text-indigo-700 active:bg-gray-100"
          :title="isAllExpanded ? 'Tutup semua rincian' : 'Buka semua rincian'"
          @click="emit('toggle-expand-all')"
        >
          <ChevronsDownUp v-if="isAllExpanded" :size="14" class="text-indigo-800" />
          <ChevronsUpDown v-else :size="14" class="text-gray-600" />
        </button>
      </div>
    </div>

    <!-- Mobile Transaction Cards List -->
    <div class="flex-1 overflow-y-auto p-3 space-y-3 pb-20">
      <div
        v-if="sortedTransactions.length === 0"
        class="flex flex-col items-center justify-center p-8 text-center text-gray-500"
      >
        <Package :size="40" class="text-gray-300 mb-2" />
        <p class="font-bold text-gray-700 text-sm">Belum Ada Transaksi</p>
        <p class="text-xs text-gray-500 max-w-xs mt-1">Tidak ada transaksi pada filter tanggal atau pencarian saat ini.</p>
      </div>

      <div
        v-for="tx in sortedTransactions"
        :key="tx.id"
        class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden transition-all"
        :class="expandedTxIds.has(tx.id) ? 'ring-1 ring-indigo-400' : ''"
      >
        <!-- Card Header: Invoice, Status Bayar & Retur -->
        <div class="p-3 border-b border-gray-100 flex items-center justify-between gap-2 bg-gray-50/50">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-mono font-bold text-sm text-blue-700">
              {{ tx.invoiceNo }}
            </span>
            <span
              v-if="tx.refundStatus"
              class="px-1.5 py-0.5 rounded text-[10px] font-bold"
              :class="tx.refundStatus === 'FULL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'"
            >
              {{ tx.refundStatus === 'FULL' ? 'RETUR PENUH' : 'RETUR SEBAGIAN' }}
            </span>
          </div>

          <!-- Status Bayar (Clickable) -->
          <button
            type="button"
            class="px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-all active:scale-95"
            :class="tx.paymentStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'"
            title="Klik untuk mengubah status Lunas / Tempo"
            @click="emit('open-status-confirm', tx)"
          >
            {{ tx.paymentStatus }}
          </button>
        </div>

        <!-- Card Meta: Pelanggan, Waktu, Metode Bayar -->
        <div class="px-3 pt-2.5 pb-2 flex items-center justify-between text-xs text-gray-600 gap-2 flex-wrap">
          <div class="flex items-center gap-1.5">
            <span
              class="px-1.5 py-0.5 rounded text-[10px] font-bold"
              :class="tx.customerType === 'B2C' ? 'bg-teal-100 text-teal-800' : 'bg-indigo-100 text-indigo-800'"
            >
              {{ tx.customerType || 'B2B' }}
            </span>
            <span class="font-semibold text-gray-800">{{ tx.buyer }}</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[11px] text-gray-500 font-mono">{{ tx.date }}</span>
            <span
              class="px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 border"
              :class="{
                'bg-emerald-50 text-emerald-800 border-emerald-200': tx.paymentMethod === 'Tunai / Kas' || (tx.paymentMethod as string) === 'Tunai',
                'bg-blue-50 text-blue-800 border-blue-200': tx.paymentMethod === 'Transfer Bank',
                'bg-purple-50 text-purple-800 border-purple-200': tx.paymentMethod === 'QRIS',
                'bg-amber-50 text-amber-800 border-amber-200': tx.paymentMethod === 'Nota Tempo' || (tx.paymentMethod as string) === 'TEMPO'
              }"
            >
              <Banknote v-if="tx.paymentMethod === 'Tunai / Kas' || (tx.paymentMethod as string) === 'Tunai'" :size="11" />
              <Landmark v-else-if="tx.paymentMethod === 'Transfer Bank'" :size="11" />
              <QrCode v-else-if="tx.paymentMethod === 'QRIS'" :size="11" />
              <FileText v-else-if="tx.paymentMethod === 'Nota Tempo' || (tx.paymentMethod as string) === 'TEMPO'" :size="11" />
              <span>{{ tx.paymentMethod || 'Transfer Bank' }}</span>
            </span>
          </div>
        </div>

        <!-- Financial Breakdown Strip -->
        <div class="mx-3 mb-2.5 grid grid-cols-2 gap-2 bg-slate-50 rounded-lg p-2.5 border border-slate-100">
          <div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Item & Modal</div>
            <div class="text-xs text-gray-700 font-medium">{{ tx.items.length }} Item (HPP Rp {{ formatRupiah(tx.totalBuy) }})</div>
          </div>
          <div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Total Transaksi</div>
            <div class="text-sm font-mono font-bold text-blue-700">
              Rp {{ formatRupiah(tx.finalTotal ?? tx.totalSell) }}
              <span v-if="tx.refundTotal" class="text-[10px] text-rose-600 font-normal block">
                -Rp {{ formatRupiah(tx.refundTotal) }} (Retur)
              </span>
            </div>
          </div>
          <div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Untung Bersih</div>
            <div class="text-xs font-mono font-bold text-emerald-700">Rp {{ formatRupiah(tx.totalProfit) }}</div>
          </div>
          <div class="flex items-end justify-end">
            <button
              type="button"
              class="text-[11px] font-bold text-indigo-700 flex items-center gap-1 active:underline"
              @click="emit('toggle-expand', tx.id)"
            >
              <span>{{ expandedTxIds.has(tx.id) ? 'Tutup Rincian' : 'Lihat ' + tx.items.length + ' Barang' }}</span>
              <ChevronUp v-if="expandedTxIds.has(tx.id)" :size="13" />
              <ChevronDown v-else :size="13" />
            </button>
          </div>
        </div>

        <!-- Expanded Item Details -->
        <div v-if="expandedTxIds.has(tx.id)" class="border-t border-indigo-100 bg-indigo-50/20 p-3 space-y-2">
          <!-- Notes & Metadata -->
          <div class="flex flex-wrap gap-1.5 text-[11px]">
            <span v-if="tx.picName" class="px-2 py-0.5 bg-white rounded border border-gray-200 text-gray-700">
              Kasir: <strong>{{ tx.picName }}</strong>
            </span>
            <span v-if="tx.notes" class="px-2 py-0.5 bg-amber-50 rounded border border-amber-200 text-amber-800 italic">
              Catatan: "{{ tx.notes }}"
            </span>
            <span v-if="tx.discountAmount && tx.discountAmount > 0" class="px-2 py-0.5 bg-rose-50 rounded border border-rose-200 text-rose-700 font-semibold">
              Diskon: -Rp {{ formatRupiah(tx.discountAmount) }} {{ tx.discountCode ? '(' + tx.discountCode + ')' : '' }}
            </span>
            <span v-if="tx.pointsDiscount && tx.pointsDiscount > 0" class="px-2 py-0.5 bg-amber-50 rounded border border-amber-200 text-amber-800">
              Poin: -Rp {{ formatRupiah(tx.pointsDiscount) }} ({{ tx.pointsUsed || 0 }} pt)
            </span>
            <span v-if="tx.infaqAmount && tx.infaqAmount > 0" class="px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200 text-emerald-800">
              Infaq: Rp {{ formatRupiah(tx.infaqAmount) }}
            </span>
          </div>

          <!-- Items list -->
          <div class="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            <div
              v-for="(it, iIdx) in tx.items"
              :key="it.id"
              class="p-2 flex items-center justify-between gap-2 text-xs"
            >
              <div class="min-w-0 flex-1">
                <div class="font-semibold text-gray-900 truncate">{{ iIdx + 1 }}. {{ it.name }}</div>
                <div class="text-[11px] text-gray-500 font-mono">
                  {{ it.qty }} {{ it.unit }} × Rp {{ formatRupiah(it.sellPrice) }}
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="font-mono font-bold text-gray-900">Rp {{ formatRupiah(it.subtotalSell) }}</div>
                <div class="text-[10px] text-emerald-600 font-mono">Laba: Rp {{ formatRupiah(it.profit) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action Bar: Thumb Friendly -->
        <div class="p-2.5 border-t border-gray-100 flex items-center justify-between gap-2 bg-gray-50/70">
          <div class="flex items-center gap-1.5 flex-1">
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-white active:bg-blue-50 text-blue-700 font-semibold rounded-lg text-xs border border-blue-200 shadow-2xs transition-colors"
              title="Cetak Struk Transaksi"
              @click="emit('view-receipt', tx)"
            >
              <Printer :size="13" />
              <span>Cetak Nota</span>
            </button>

            <button
              type="button"
              class="flex items-center justify-center gap-1 py-1.5 px-2.5 bg-white active:bg-rose-50 text-rose-700 font-medium rounded-lg text-xs border border-rose-200 shadow-2xs transition-colors"
              title="Retur / Koreksi Transaksi"
              @click="returnStore.openRefundModal(tx)"
            >
              <RotateCcw :size="13" />
              <span>Retur</span>
            </button>
          </div>

          <button
            type="button"
            class="p-2 text-gray-400 active:text-rose-600 active:bg-rose-50 rounded-lg border border-gray-200 transition-colors"
            title="Hapus Transaksi"
            @click="emit('delete-transaction', tx.id)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
