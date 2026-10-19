<script setup lang="ts">
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
  paymentStatus: PaymentStatus;
  paymentMethod: string;
}

const props = defineProps<{
  rows: FlatLedgerItemRow[];
}>();
</script>

<template>
  <table class="table-explorer min-w-[1100px]">
    <thead>
      <tr>
        <th class="w-12 text-center">NO</th>
        <th class="w-24 text-center">TANGGAL</th>
        <th class="w-36">PEMBELI</th>
        <th class="w-28">VENDOR</th>
        <th class="min-w-[200px]">NAMA BARANG</th>
        <th class="w-14 text-center">QTY</th>
        <th class="w-16 text-center">SATUAN</th>
        <th class="w-28 text-right">MODAL</th>
        <th class="w-28 text-right">HARGA JUAL</th>
        <th class="w-32 text-right">SUBTOTAL</th>
        <th class="w-28 text-right">LABA</th>
        <th class="w-44">NO. NOTA</th>
        <th class="th-action-sticky w-24">STATUS</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(row, idx) in rows"
        :key="idx"
      >
        <td class="text-center font-mono text-gray-400 whitespace-nowrap">{{ idx + 1 }}</td>
        <td class="font-mono text-gray-500 text-center whitespace-nowrap">{{ row.date }}</td>
        <td class="font-medium text-gray-800" :title="row.buyer">{{ row.buyer }}</td>
        <td class="text-gray-500 truncate" :title="row.category">{{ row.category }}</td>
        <td class="font-semibold text-gray-900" :title="row.productName">{{ row.productName }}</td>
        <td class="text-center font-mono font-bold whitespace-nowrap">{{ row.qty }}</td>
        <td class="text-center text-gray-500 whitespace-nowrap">{{ row.unit }}</td>
        <td class="text-right font-mono text-gray-500 whitespace-nowrap">Rp {{ formatRupiah(row.buyPrice) }}</td>
        <td class="text-right font-mono text-gray-700 whitespace-nowrap">Rp {{ formatRupiah(row.sellPrice) }}</td>
        <td class="text-right font-mono font-bold text-blue-700 whitespace-nowrap">Rp {{ formatRupiah(row.totalSell) }}</td>
        <td class="text-right font-mono font-bold text-emerald-700 whitespace-nowrap">Rp {{ formatRupiah(row.profit) }}</td>
        <td class="font-mono text-blue-700 text-xs whitespace-nowrap" :title="row.invoiceNo">{{ row.invoiceNo }}</td>
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
