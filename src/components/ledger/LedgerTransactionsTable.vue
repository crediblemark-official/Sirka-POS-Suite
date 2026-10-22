<script setup lang="ts">
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
  Package
} from 'lucide-vue-next';
import { Transaction } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useReturnStore } from '../../stores/returnStore';

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
</script>

<template>
  <table class="table-explorer min-w-[1150px]">
    <thead>
      <tr>
        <th class="w-12 text-center">
          <button
            type="button"
            class="p-1 hover:bg-black/10 rounded cursor-pointer transition-colors"
            :title="isAllExpanded ? 'Tutup semua rincian nota' : 'Buka semua rincian nota'"
            @click="emit('toggle-expand-all')"
          >
            <ChevronsDownUp v-if="isAllExpanded" :size="14" class="text-indigo-800" />
            <ChevronsUpDown v-else :size="14" class="text-gray-600" />
          </button>
        </th>
        <th class="w-48">NO. NOTA</th>
        <th class="w-24 text-center">TANGGAL</th>
        <th class="w-16 text-center">JENIS</th>
        <th class="w-40">PELANGGAN</th>
        <th class="w-24 text-center">TOTAL ITEM</th>
        <th class="w-32 text-right">MODAL (HPP)</th>
        <th class="w-32 text-right">TOTAL NOTA</th>
        <th class="w-32 text-right">UNTUNG BERSIH</th>
        <th class="w-28 text-center">STATUS BAYAR</th>
        <th class="w-32 text-center">METODE BAYAR</th>
        <!-- Sticky Action Header -->
        <th class="th-action-sticky w-20">AKSI</th>
      </tr>
    </thead>
    <tbody>
      <template v-for="tx in transactions" :key="tx.id">
        <tr
          class="cursor-pointer"
          :class="{ 'bg-[#fefcf8]': expandedTxIds.has(tx.id) }"
          @click="emit('toggle-expand', tx.id)"
        >
          <td class="text-center text-gray-400">
            <ChevronUp v-if="expandedTxIds.has(tx.id)" :size="14" class="inline text-indigo-700" />
            <ChevronDown v-else :size="14" class="inline" />
          </td>
          <td class="font-mono font-bold text-blue-700 whitespace-nowrap" :title="tx.invoiceNo">
            <div>{{ tx.invoiceNo }}</div>
            <div v-if="tx.refundStatus" class="mt-0.5">
              <span
                class="px-1.5 py-0.2 rounded text-[9.5px] font-sans font-bold"
                :class="tx.refundStatus === 'FULL' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'"
              >
                {{ tx.refundStatus === 'FULL' ? 'RETUR PENUH' : 'RETUR SEBAGIAN' }}
              </span>
            </div>
          </td>
          <td class="font-mono text-gray-500 text-center whitespace-nowrap">{{ tx.date }}</td>
          <td class="text-center whitespace-nowrap">
            <span
              class="px-1.5 py-0.5 rounded text-[10px] font-bold"
              :class="tx.customerType === 'B2C' ? 'bg-teal-100 text-teal-800' : 'bg-indigo-100 text-indigo-800'"
            >
              {{ tx.customerType || 'B2B' }}
            </span>
          </td>
          <td class="whitespace-nowrap" :title="tx.buyer">
            <span class="px-2 py-0.5 bg-gray-100 rounded font-semibold text-gray-800 text-[11px] inline-block truncate max-w-[170px]">
              {{ tx.buyer }}
            </span>
          </td>
          <td class="text-center font-mono font-semibold text-gray-700 whitespace-nowrap" :title="`${tx.items.length} item barang terjual (Klik baris untuk rincian)`">
            {{ tx.items.length }} Item
          </td>
          <td class="text-right font-mono text-gray-600 whitespace-nowrap">Rp {{ formatRupiah(tx.totalBuy) }}</td>
          <td class="text-right font-mono font-bold text-blue-700 whitespace-nowrap">
            <div>Rp {{ formatRupiah(tx.finalTotal ?? tx.totalSell) }}</div>
            <div v-if="tx.refundTotal" class="text-[10px] text-rose-600 font-normal">
              -Rp {{ formatRupiah(tx.refundTotal) }}
            </div>
          </td>
          <td class="text-right font-mono font-bold text-emerald-700 whitespace-nowrap">Rp {{ formatRupiah(tx.totalProfit) }}</td>
          <td class="text-center whitespace-nowrap" @click.stop>
            <button
              type="button"
              class="px-2.5 py-0.5 rounded text-[10.5px] font-bold cursor-pointer transition-all"
              :class="tx.paymentStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'"
              title="Klik untuk mengubah Lunas / Tempo"
              @click="emit('open-status-confirm', tx)"
            >
              {{ tx.paymentStatus }}
            </button>
          </td>
          <td class="text-center whitespace-nowrap">
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
          </td>
          <!-- Sticky Action Cell (Right Anchor) -->
          <td class="td-action-sticky whitespace-nowrap" @click.stop>
            <div class="flex items-center justify-center gap-1">
              <button
                type="button"
                class="p-1 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                title="Retur / Koreksi Nota Ini"
                @click="returnStore.openRefundModal(tx)"
              >
                <RotateCcw :size="13" />
              </button>
              <button
                type="button"
                class="p-1 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                title="Cetak Ulang Nota"
                @click="emit('view-receipt', tx)"
              >
                <Printer :size="13" />
              </button>
              <button
                type="button"
                class="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                title="Hapus Transaksi"
                @click="emit('delete-transaction', tx.id)"
              >
                <Trash2 :size="13" />
              </button>
            </div>
          </td>
        </tr>

        <!-- EXPANDED DETAIL SUBTABLE -->
        <tr v-if="expandedTxIds.has(tx.id)" class="subtable-row border-b border-indigo-200">
          <td colspan="12" class="p-0!">
            <div class="bg-white overflow-hidden border-y border-indigo-200/80">
              <!-- SUBTABLE HEADER (Hanya data komplementer / non-duplikat) -->
              <div class="px-4 py-1.5 bg-[#f6f4ee] border-b border-indigo-200/80 text-[11px] flex items-center justify-between">
                <!-- Sisi Kiri: Label & Info Tambahan Khusus Nota (Kasir, Catatan, Diskon, Split) -->
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold text-gray-800 flex items-center gap-1.5">
                    <Package :size="13" class="text-indigo-800" />
                    <span>Rincian Barang Terjual:</span>
                  </span>

                  <!-- Kasir / PIC -->
                  <template v-if="tx.picName">
                    <span class="text-gray-600">Kasir: <strong class="text-gray-800">{{ tx.picName }}</strong></span>
                    <span class="text-gray-300">|</span>
                  </template>

                  <!-- Catatan Faktur -->
                  <template v-if="tx.notes">
                    <span class="text-gray-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/80 font-medium italic">
                      Catatan: "{{ tx.notes }}"
                    </span>
                    <span class="text-gray-300">|</span>
                  </template>

                  <!-- Rincian Diskon Kupon -->
                  <template v-if="tx.discountAmount && tx.discountAmount > 0">
                    <span class="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 font-medium">
                      Diskon Kupon: -Rp {{ formatRupiah(tx.discountAmount) }} <strong v-if="tx.discountCode">({{ tx.discountCode }})</strong>
                    </span>
                    <span class="text-gray-300">|</span>
                  </template>

                  <!-- Rincian Loyalty Poin -->
                  <template v-if="tx.pointsDiscount && tx.pointsDiscount > 0">
                    <span class="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                      Poin Digunakan: {{ tx.pointsUsed || 0 }} pt (-Rp {{ formatRupiah(tx.pointsDiscount) }})
                    </span>
                    <span class="text-gray-300">|</span>
                  </template>
                  <template v-if="tx.pointsEarned && tx.pointsEarned > 0">
                    <span class="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">
                      +{{ tx.pointsEarned }} Poin Didapat
                    </span>
                    <span class="text-gray-300">|</span>
                  </template>

                  <!-- Rincian Split Payment -->
                  <template v-if="tx.isSplitPayment">
                    <span class="text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-medium">
                      Bayar Campur: Tunai Rp {{ formatRupiah(tx.cashAmount || 0) }} + {{ tx.nonCashMethod || 'Non-Tunai' }} Rp {{ formatRupiah(tx.nonCashAmount || 0) }}
                    </span>
                    <span class="text-gray-300">|</span>
                  </template>

                  <!-- Infaq Kasir -->
                  <template v-if="tx.infaqAmount && tx.infaqAmount > 0">
                    <span class="text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">
                      Infaq: Rp {{ formatRupiah(tx.infaqAmount) }}
                    </span>
                  </template>
                </div>

                <!-- Sisi Kanan: Aksi Cepat Retur / Koreksi -->
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-bold text-[10.5px] flex items-center gap-1 cursor-pointer transition-colors"
                    title="Retur atau koreksi barang pada nota ini"
                    @click="returnStore.openRefundModal(tx)"
                  >
                    <RotateCcw :size="11" />
                    <span>Retur / Koreksi Nota</span>
                  </button>
                </div>
              </div>

              <table class="w-full text-xs text-left border-collapse">
                <thead class="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold text-[10.5px]">
                  <tr class="h-7">
                    <th class="px-4 py-1.5 text-center w-10">NO</th>
                    <th class="px-3 py-1.5">NAMA BARANG</th>
                    <th class="px-3 py-1.5 text-center w-20">QTY</th>
                    <th class="px-3 py-1.5 text-center w-20">SATUAN</th>
                    <th class="px-3 py-1.5 text-right w-28 whitespace-nowrap">MODAL (HPP)</th>
                    <th class="px-3 py-1.5 text-right w-32 whitespace-nowrap">HARGA JUAL</th>
                    <th class="px-3 py-1.5 text-right w-32 whitespace-nowrap">SUBTOTAL</th>
                    <th class="px-4 py-1.5 text-right w-32 whitespace-nowrap pr-4">LABA ITEM</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr
                    v-for="(it, iIdx) in tx.items"
                    :key="it.id"
                    class="hover:bg-indigo-50/30 transition-colors"
                  >
                    <td class="px-4 py-1.5 text-center text-gray-400 font-mono">{{ iIdx + 1 }}</td>
                    <td class="px-3 py-1.5 font-semibold text-gray-800" :title="it.name">{{ it.name }}</td>
                    <td class="px-3 py-1.5 text-center font-mono font-bold text-gray-900">{{ it.qty }}</td>
                    <td class="px-3 py-1.5 text-center text-gray-500 font-mono">{{ it.unit }}</td>
                    <td class="px-3 py-1.5 text-right font-mono text-gray-600 whitespace-nowrap">Rp {{ formatRupiah(it.buyPrice) }}</td>
                    <td class="px-3 py-1.5 text-right font-mono text-blue-700 whitespace-nowrap">Rp {{ formatRupiah(it.sellPrice) }}</td>
                    <td class="px-3 py-1.5 text-right font-mono font-bold text-gray-900 whitespace-nowrap">Rp {{ formatRupiah(it.subtotalSell) }}</td>
                    <td class="px-4 py-1.5 text-right font-mono font-bold text-emerald-700 whitespace-nowrap pr-4">Rp {{ formatRupiah(it.profit) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      </template>
    </tbody>
  </table>
</template>
