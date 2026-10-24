<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Banknote,
  Landmark,
  QrCode,
  FileText,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next';
import { PaymentStatus } from '../../types';
import { formatRupiah } from '../../utils/formatters';

export interface FlatLedgerItemRow {
  txId: string;
  invoiceNo: string;
  date: string;
  buyer: string;
  customerType?: 'B2B' | 'B2C';
  category: string;
  productName: string;
  qty: number;
  unit: string;
  buyPrice: number;
  totalBuy: number;
  sellPrice: number;
  totalSell: number;
  profit: number;
  /** Diskon transaksi (kupon + poin) yang dialokasikan ke baris item ini. */
  discountAmount?: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
}

type ItemSortField = 'date' | 'buyer' | 'category' | 'productName' | 'qty' | 'buyPrice' | 'sellPrice' | 'totalSell' | 'discountAmount' | 'profit' | 'invoiceNo' | 'paymentMethod' | 'paymentStatus';
type SortDirection = 'asc' | 'desc';

const props = defineProps<{
  rows: FlatLedgerItemRow[];
}>();

const sortField = ref<ItemSortField>('date');
const sortDirection = ref<SortDirection>('desc');

function toggleSort(field: ItemSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = (field === 'date' || field === 'qty' || field === 'totalSell' || field === 'profit' || field === 'sellPrice' || field === 'buyPrice' || field === 'discountAmount') ? 'desc' : 'asc';
  }
}

const sortedRows = computed(() => {
  const list = [...props.rows];
  const dir = sortDirection.value === 'asc' ? 1 : -1;
  const field = sortField.value;

  return list.sort((a, b) => {
    if (field === 'date') return a.date.localeCompare(b.date) * dir;
    if (field === 'buyer') return a.buyer.localeCompare(b.buyer) * dir;
    if (field === 'category') return a.category.localeCompare(b.category) * dir;
    if (field === 'productName') return a.productName.localeCompare(b.productName) * dir;
    if (field === 'qty') return (a.qty - b.qty) * dir;
    if (field === 'buyPrice') return (a.buyPrice - b.buyPrice) * dir;
    if (field === 'sellPrice') return (a.sellPrice - b.sellPrice) * dir;
    if (field === 'totalSell') return (a.totalSell - b.totalSell) * dir;
    if (field === 'discountAmount') return ((a.discountAmount || 0) - (b.discountAmount || 0)) * dir;
    if (field === 'profit') return (a.profit - b.profit) * dir;
    if (field === 'invoiceNo') return a.invoiceNo.localeCompare(b.invoiceNo) * dir;
    if (field === 'paymentMethod') return a.paymentMethod.localeCompare(b.paymentMethod) * dir;
    if (field === 'paymentStatus') return a.paymentStatus.localeCompare(b.paymentStatus) * dir;
    return 0;
  });
});
</script>

<template>
  <table class="table-explorer min-w-[1360px] whitespace-nowrap">
    <thead>
      <tr>
        <th class="w-12 text-center select-none">NO</th>

        <th
          class="is-sortable w-24 text-center"
          :class="{ 'is-sorted': sortField === 'date' }"
          title="Klik untuk mengurutkan tanggal"
          @click="toggleSort('date')"
        >
          <div class="flex items-center justify-center gap-1">
            <span>TANGGAL</span>
            <ArrowUp v-if="sortField === 'date' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'date' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable w-44 whitespace-nowrap"
          :class="{ 'is-sorted': sortField === 'buyer' }"
          title="Klik untuk mengurutkan pembeli"
          @click="toggleSort('buyer')"
        >
          <div class="flex items-center gap-1">
            <span>PEMBELI</span>
            <ArrowUp v-if="sortField === 'buyer' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'buyer' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable w-36 whitespace-nowrap"
          :class="{ 'is-sorted': sortField === 'category' }"
          title="Klik untuk mengurutkan vendor / kategori"
          @click="toggleSort('category')"
        >
          <div class="flex items-center gap-1">
            <span>VENDOR</span>
            <ArrowUp v-if="sortField === 'category' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'category' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable min-w-[240px] whitespace-nowrap"
          :class="{ 'is-sorted': sortField === 'productName' }"
          title="Klik untuk mengurutkan nama barang"
          @click="toggleSort('productName')"
        >
          <div class="flex items-center gap-1">
            <span>NAMA BARANG</span>
            <ArrowUp v-if="sortField === 'productName' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'productName' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable w-14 text-center"
          :class="{ 'is-sorted': sortField === 'qty' }"
          title="Klik untuk mengurutkan kuantiti"
          @click="toggleSort('qty')"
        >
          <div class="flex items-center justify-center gap-1">
            <span>QTY</span>
            <ArrowUp v-if="sortField === 'qty' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'qty' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th class="w-16 text-center select-none">SATUAN</th>

        <th
          class="is-sortable w-28 text-right"
          :class="{ 'is-sorted': sortField === 'buyPrice' }"
          title="Klik untuk mengurutkan modal beli"
          @click="toggleSort('buyPrice')"
        >
          <div class="flex items-center justify-end gap-1">
            <span>MODAL</span>
            <ArrowUp v-if="sortField === 'buyPrice' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'buyPrice' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable w-28 text-right"
          :class="{ 'is-sorted': sortField === 'sellPrice' }"
          title="Klik untuk mengurutkan harga jual"
          @click="toggleSort('sellPrice')"
        >
          <div class="flex items-center justify-end gap-1">
            <span>HARGA JUAL</span>
            <ArrowUp v-if="sortField === 'sellPrice' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'sellPrice' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable w-32 text-right"
          :class="{ 'is-sorted': sortField === 'totalSell' }"
          title="Klik untuk mengurutkan subtotal omzet"
          @click="toggleSort('totalSell')"
        >
          <div class="flex items-center justify-end gap-1">
            <span>SUBTOTAL</span>
            <ArrowUp v-if="sortField === 'totalSell' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'totalSell' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable w-24 text-right"
          :class="{ 'is-sorted': sortField === 'discountAmount' }"
          title="Klik untuk mengurutkan diskon"
          @click="toggleSort('discountAmount')"
        >
          <div class="flex items-center justify-end gap-1">
            <span>DISKON</span>
            <ArrowUp v-if="sortField === 'discountAmount' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'discountAmount' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable w-28 text-right"
          :class="{ 'is-sorted': sortField === 'profit' }"
          title="Klik untuk mengurutkan laba bersih"
          @click="toggleSort('profit')"
        >
          <div class="flex items-center justify-end gap-1">
            <span>LABA</span>
            <ArrowUp v-if="sortField === 'profit' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'profit' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable w-44"
          :class="{ 'is-sorted': sortField === 'invoiceNo' }"
          title="Klik untuk mengurutkan nomor nota"
          @click="toggleSort('invoiceNo')"
        >
          <div class="flex items-center gap-1">
            <span>NO. NOTA</span>
            <ArrowUp v-if="sortField === 'invoiceNo' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'invoiceNo' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable w-32 text-center"
          :class="{ 'is-sorted': sortField === 'paymentMethod' }"
          title="Klik untuk mengurutkan metode bayar"
          @click="toggleSort('paymentMethod')"
        >
          <div class="flex items-center justify-center gap-1">
            <span>METODE BAYAR</span>
            <ArrowUp v-if="sortField === 'paymentMethod' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'paymentMethod' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>

        <th
          class="is-sortable th-action-sticky w-24 text-center"
          :class="{ 'is-sorted': sortField === 'paymentStatus' }"
          title="Klik untuk mengurutkan status bayar"
          @click="toggleSort('paymentStatus')"
        >
          <div class="flex items-center justify-center gap-1">
            <span>STATUS</span>
            <ArrowUp v-if="sortField === 'paymentStatus' && sortDirection === 'asc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <ArrowDown v-else-if="sortField === 'paymentStatus' && sortDirection === 'desc'" :size="12" class="text-indigo-600 dark:text-indigo-400 shrink-0" />
          </div>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(row, idx) in sortedRows"
        :key="row.txId + '-' + idx"
      >
        <td class="text-center font-mono text-gray-400 whitespace-nowrap">{{ idx + 1 }}</td>
        <td class="font-mono text-gray-500 text-center whitespace-nowrap">{{ row.date }}</td>
        <td class="font-medium text-gray-800 whitespace-nowrap" :title="row.buyer">{{ row.buyer }}</td>
        <td class="text-gray-500 whitespace-nowrap" :title="row.category">{{ row.category }}</td>
        <td class="font-semibold text-gray-900 whitespace-nowrap" :title="row.productName">{{ row.productName }}</td>
        <td class="text-center font-mono font-bold whitespace-nowrap">{{ row.qty }}</td>
        <td class="text-center text-gray-500 whitespace-nowrap">{{ row.unit }}</td>
        <td class="text-right font-mono text-gray-500 whitespace-nowrap">Rp {{ formatRupiah(row.buyPrice) }}</td>
        <td class="text-right font-mono text-gray-700 whitespace-nowrap">Rp {{ formatRupiah(row.sellPrice) }}</td>
        <td class="text-right font-mono font-bold text-blue-700 whitespace-nowrap">Rp {{ formatRupiah(row.totalSell) }}</td>
        <!--
          BUG FIX: kolom DISKON ditambahkan. Sebelumnya LABA sudah setelah diskon
          sedangkan SUBTOTAL belum -> LABA tidak sama dengan SUBTOTAL - MODAL
          sehingga selisihnya tidak bisa dijelaskan user.
        -->
        <td class="text-right font-mono text-rose-600 whitespace-nowrap">Rp {{ formatRupiah(row.discountAmount || 0) }}</td>
        <td class="text-right font-mono font-bold text-emerald-700 whitespace-nowrap">Rp {{ formatRupiah(row.profit) }}</td>
        <td class="font-mono text-blue-700 text-xs whitespace-nowrap" :title="row.invoiceNo">{{ row.invoiceNo }}</td>
        <td class="text-center whitespace-nowrap">
          <span
            class="px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 border"
            :class="{
              'bg-emerald-50 text-emerald-800 border-emerald-200': row.paymentMethod === 'Tunai / Kas' || row.paymentMethod === 'Tunai',
              'bg-blue-50 text-blue-800 border-blue-200': row.paymentMethod === 'Transfer Bank',
              'bg-purple-50 text-purple-800 border-purple-200': row.paymentMethod === 'QRIS',
              'bg-amber-50 text-amber-800 border-amber-200': row.paymentMethod === 'Nota Tempo'
            }"
          >
            <Banknote v-if="row.paymentMethod === 'Tunai / Kas' || row.paymentMethod === 'Tunai'" :size="11" />
            <Landmark v-else-if="row.paymentMethod === 'Transfer Bank'" :size="11" />
            <QrCode v-else-if="row.paymentMethod === 'QRIS'" :size="11" />
            <FileText v-else-if="row.paymentMethod === 'Nota Tempo'" :size="11" />
            <!--
              BUG FIX: `paymentMethod || 'Transfer Bank'` menampilkan data
              palsu untuk transaksi tanpa metode bayar. Dan 'TEMPO' adalah
              STATUS bayar, bukan metode -> badge tidak cocok.
            -->
            <span>{{ row.paymentMethod || '—' }}</span>
          </span>
        </td>
        <td class="td-action-sticky whitespace-nowrap">
          <span
            class="px-2 py-0.5 rounded font-bold text-[10px] inline-block"
            :class="row.paymentStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
          >
            {{ row.paymentStatus }}
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
