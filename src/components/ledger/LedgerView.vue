<script setup lang="ts">
import { ref, computed } from 'vue';
import { useLedgerStore } from '../../stores/ledgerStore';
import { PaymentStatus, Transaction } from '../../types';
import {
  BookOpen,
  Search,
  Printer,
  Trash2,
  FileSpreadsheet
} from 'lucide-vue-next';

import { useBuyerStore } from '../../stores/buyerStore';
import { formatRupiah } from '../../utils/formatters';

const emit = defineEmits<{
  (e: 'view-receipt', tx: Transaction): void;
}>();

const ledgerStore = useLedgerStore();
const buyerStore = useBuyerStore();

const searchQuery = ref('');
const filterBuyer = ref<string>('Semua');
const filterStatus = ref<PaymentStatus | 'Semua'>('Semua');
const filterMarket = ref<'Semua' | 'B2B' | 'B2C'>('Semua');
const viewMode = ref<'transactions' | 'items'>('transactions');

const buyers = computed(() => ['Semua', ...buyerStore.buyers.map(b => b.name)]);

const filteredTransactions = computed(() => {
  return ledgerStore.transactions.filter(t => {
    const matchBuyer = filterBuyer.value === 'Semua' || t.buyer === filterBuyer.value;
    const matchStatus = filterStatus.value === 'Semua' || t.paymentStatus === filterStatus.value;
    const matchMarket = filterMarket.value === 'Semua' || (t.customerType || 'B2B') === filterMarket.value;
    const q = searchQuery.value.toLowerCase().trim();
    const matchSearch =
      !q ||
      t.invoiceNo.toLowerCase().includes(q) ||
      t.buyer.toLowerCase().includes(q) ||
      t.items.some(i => i.name.toLowerCase().includes(q));
    return matchBuyer && matchStatus && matchSearch && matchMarket;
  });
});

const filteredFlatRows = computed(() => {
  return ledgerStore.flatLedgerRows.filter(r => {
    const matchBuyer = filterBuyer.value === 'Semua' || r.buyer === filterBuyer.value;
    const matchStatus = filterStatus.value === 'Semua' || r.paymentStatus === filterStatus.value;
    const q = searchQuery.value.toLowerCase().trim();
    const matchSearch =
      !q ||
      r.invoiceNo.toLowerCase().includes(q) ||
      r.productName.toLowerCase().includes(q) ||
      r.buyer.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q);
    return matchBuyer && matchStatus && matchSearch;
  });
});

function handleToggleStatus(txId: string) {
  ledgerStore.togglePaymentStatus(txId);
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Top Header -->
    <div class="p-3 bg-white border-b border-[#dedbd6] flex items-center justify-between shadow-xs">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
          <BookOpen :size="18" />
        </div>
        <div>
          <h2 class="font-bold text-sm text-gray-900 leading-tight">
            Buku Besar Transaksi & Piutang Dinamis
          </h2>
          <p class="text-[11px] text-gray-500">
            Rekapitulasi penjualan pembeli, status tempo/lunas, dan margin laba bersih.
          </p>
        </div>
      </div>

      <button
        class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
        @click="ledgerStore.exportToExcel"
        title="Unduh Excel (.xlsx)"
      >
        <FileSpreadsheet :size="15" />
        <span>Ekspor ke Excel (.xlsx)</span>
      </button>
    </div>

    <!-- Summary KPI Cards -->
    <div class="p-3 grid grid-cols-4 gap-3 bg-[#f3f1ed] border-b border-[#dedbd6]">
      <div class="p-2.5 bg-white border border-gray-200 rounded-lg shadow-xs">
        <span class="text-[11px] font-semibold text-gray-500 block">Total Omset Penjualan</span>
        <span class="text-base font-black font-mono text-blue-700 block mt-0.5">
          Rp {{ formatRupiah(ledgerStore.totalRevenue) }}
        </span>
        <span class="text-[10px] text-gray-400 font-mono">{{ ledgerStore.transactions.length }} Nota Transaksi</span>
      </div>

      <div class="p-2.5 bg-white border border-gray-200 rounded-lg shadow-xs">
        <span class="text-[11px] font-semibold text-gray-500 block">Total Modal (HPP Nota)</span>
        <span class="text-base font-black font-mono text-gray-700 block mt-0.5">
          Rp {{ formatRupiah(ledgerStore.totalCost) }}
        </span>
        <span class="text-[10px] text-gray-400">Modal fisik supplier hulu</span>
      </div>

      <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg shadow-xs">
        <span class="text-[11px] font-semibold text-emerald-800 block">Total Laba Bersih</span>
        <span class="text-base font-black font-mono text-emerald-700 block mt-0.5">
          Rp {{ formatRupiah(ledgerStore.totalProfit) }}
        </span>
        <span class="text-[10px] text-emerald-600 font-semibold">
          Margin: {{ ledgerStore.totalCost > 0 ? ((ledgerStore.totalProfit / ledgerStore.totalCost) * 100).toFixed(1) : 0 }}%
        </span>
      </div>

      <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg shadow-xs">
        <span class="text-[11px] font-semibold text-amber-800 block">Total Piutang Belum Lunas</span>
        <span class="text-base font-black font-mono text-amber-700 block mt-0.5">
          Rp {{ formatRupiah(ledgerStore.totalReceivables) }}
        </span>
        <span class="text-[10px] text-amber-600 font-bold">
          {{ ledgerStore.transactions.filter(t => t.paymentStatus === 'TEMPO').length }} Nota Menunggu Pelunasan
        </span>
      </div>
    </div>

    <!-- Toolbar Filters -->
    <div class="px-3 py-2 bg-white border-b border-[#dedbd6] flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 flex-1">
        <div class="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 border border-gray-300 rounded w-64 shadow-inner">
          <Search :size="13" class="text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari nota, barang, pembeli..."
            class="bg-transparent outline-none text-xs w-full text-gray-700"
          />
        </div>

        <div class="flex items-center gap-1 text-xs">
          <span class="text-gray-500 font-semibold">Pembeli:</span>
          <select v-model="filterBuyer" class="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs outline-none">
            <option v-for="b in buyers" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>

        <div class="flex items-center gap-1 text-xs">
          <span class="text-gray-500 font-semibold">Status:</span>
          <select v-model="filterStatus" class="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs outline-none">
            <option value="Semua">Semua Status</option>
            <option value="LUNAS">Lunas</option>
            <option value="TEMPO">Tempo (Piutang)</option>
          </select>
        </div>

        <div class="flex items-center gap-1 text-xs">
          <span class="text-gray-500 font-semibold">Pasar:</span>
          <select v-model="filterMarket" class="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs outline-none">
            <option value="Semua">Semua Pasar</option>
            <option value="B2B">🏢 B2B (Grosir)</option>
            <option value="B2C">🛒 B2C (Eceran)</option>
          </select>
        </div>
      </div>

      <!-- Mode Switcher -->
      <div class="flex bg-gray-100 p-0.5 rounded border border-gray-300">
        <button
          class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all"
          :class="viewMode === 'transactions' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-black'"
          @click="viewMode = 'transactions'"
        >
          Per Nota Transaksi
        </button>
        <button
          class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all"
          :class="viewMode === 'items' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-black'"
          @click="viewMode = 'items'"
        >
          Per Baris Barang (Spreadsheet)
        </button>
      </div>
    </div>

    <!-- Main Content Table -->
    <div class="flex-1 overflow-y-auto p-3 bg-white">
      <div v-if="ledgerStore.transactions.length === 0" class="h-64 flex flex-col items-center justify-center text-gray-400 gap-2">
        <BookOpen :size="40" class="text-gray-300" />
        <span class="font-bold">Belum Ada Transaksi Tercatat</span>
        <span class="text-[11px]">Selesaikan penjualan di tab Kasir POS untuk mengisi buku besar.</span>
      </div>

      <!-- Mode 1: Per Nota Transaksi -->
      <table v-else-if="viewMode === 'transactions'" class="w-full text-xs text-left border border-gray-200 rounded">
        <thead class="bg-[#f7f5f2] border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
          <tr>
            <th class="p-2 w-44">NO. NOTA</th>
            <th class="p-2 w-28">TANGGAL</th>
            <th class="p-2 w-20 text-center">PASAR</th>
            <th class="p-2 w-40">PEMBELI</th>
            <th class="p-2">RINGKASAN BARANG</th>
            <th class="p-2 w-32 text-right">MODAL BELI</th>
            <th class="p-2 w-32 text-right">TAGIHAN JUAL</th>
            <th class="p-2 w-32 text-right">LABA BERSIH</th>
            <th class="p-2 w-28 text-center">STATUS BAYAR</th>
            <th class="p-2 w-24 text-center">AKSI</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="tx in filteredTransactions"
            :key="tx.id"
            class="border-b border-gray-100 hover:bg-[#faf9f7]"
          >
            <td class="p-2 font-mono font-bold text-blue-700">{{ tx.invoiceNo }}</td>
            <td class="p-2 font-mono text-gray-500">{{ tx.date }}</td>
            <td class="p-2 text-center">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-bold border"
                :class="tx.customerType === 'B2C' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-blue-50 text-blue-700 border-blue-300'"
              >
                {{ tx.customerType || 'B2B' }}
              </span>
            </td>
            <td class="p-2">
              <span class="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded font-semibold text-gray-800 text-[11px]">
                {{ tx.buyer }}
              </span>
            </td>
            <td class="p-2">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="it in tx.items.slice(0, 3)"
                  :key="it.id"
                  class="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10.5px]"
                >
                  {{ it.name }} ({{ it.qty }} {{ it.unit }})
                </span>
                <span v-if="tx.items.length > 3" class="text-[10px] text-gray-400 font-mono self-center">
                  +{{ tx.items.length - 3 }} lainnya
                </span>
              </div>
            </td>
            <td class="p-2 text-right font-mono text-gray-500">Rp {{ formatRupiah(tx.totalBuy) }}</td>
            <td class="p-2 text-right font-mono font-bold text-blue-700">Rp {{ formatRupiah(tx.totalSell) }}</td>
            <td class="p-2 text-right font-mono font-bold text-emerald-700">Rp {{ formatRupiah(tx.totalProfit) }}</td>
            <td class="p-2 text-center">
              <button
                class="px-2 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-all border"
                :class="tx.paymentStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'"
                title="Klik untuk mengubah Lunas / Tempo"
                @click="handleToggleStatus(tx.id)"
              >
                {{ tx.paymentStatus }}
              </button>
            </td>
            <td class="p-2 text-center">
              <div class="flex items-center justify-center gap-1">
                <button
                  class="p-1 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                  title="Cetak Ulang Nota"
                  @click="emit('view-receipt', tx)"
                >
                  <Printer :size="13" />
                </button>
                <button
                  class="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer"
                  title="Hapus Transaksi"
                  @click="ledgerStore.deleteTransaction(tx.id)"
                >
                  <Trash2 :size="13" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mode 2: Per Baris Barang (Spreadsheet) -->
      <table v-else class="w-full text-xs text-left border border-gray-200 rounded">
        <thead class="bg-[#f7f5f2] border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
          <tr>
            <th class="p-1.5 w-10 text-center">NO</th>
            <th class="p-1.5 w-24">TANGGAL</th>
            <th class="p-1.5 w-32">PEMBELI</th>
            <th class="p-1.5 w-28">VENDOR</th>
            <th class="p-1.5">NAMA BARANG</th>
            <th class="p-1.5 w-16 text-center">QTY</th>
            <th class="p-1.5 w-16 text-center">SATUAN</th>
            <th class="p-1.5 w-24 text-right">MODAL</th>
            <th class="p-1.5 w-28 text-right">HARGA JUAL</th>
            <th class="p-1.5 w-28 text-right">SUBTOTAL</th>
            <th class="p-1.5 w-24 text-right">LABA</th>
            <th class="p-1.5 w-36">NO. NOTA</th>
            <th class="p-1.5 w-20 text-center">STATUS</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, idx) in filteredFlatRows"
            :key="idx"
            class="border-b border-gray-100 hover:bg-[#faf9f7]"
          >
            <td class="p-1.5 text-center font-mono text-gray-400">{{ idx + 1 }}</td>
            <td class="p-1.5 font-mono text-gray-500">{{ row.date }}</td>
            <td class="p-1.5 font-medium text-gray-800">{{ row.buyer }}</td>
            <td class="p-1.5 text-gray-500">{{ row.category }}</td>
            <td class="p-1.5 font-semibold text-gray-900">{{ row.productName }}</td>
            <td class="p-1.5 text-center font-mono font-bold">{{ row.qty }}</td>
            <td class="p-1.5 text-center text-gray-500">{{ row.unit }}</td>
            <td class="p-1.5 text-right font-mono text-gray-500">Rp {{ formatRupiah(row.buyPrice) }}</td>
            <td class="p-1.5 text-right font-mono text-gray-700">Rp {{ formatRupiah(row.sellPrice) }}</td>
            <td class="p-1.5 text-right font-mono font-bold text-blue-700">Rp {{ formatRupiah(row.totalSell) }}</td>
            <td class="p-1.5 text-right font-mono font-bold text-emerald-700">Rp {{ formatRupiah(row.profit) }}</td>
            <td class="p-1.5 font-mono text-gray-400 text-[10.5px]">{{ row.invoiceNo }}</td>
            <td class="p-1.5 text-center">
              <span
                class="px-1.5 py-0.2 rounded font-bold text-[9.5px] border"
                :class="row.paymentStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300'"
              >
                {{ row.paymentStatus }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
