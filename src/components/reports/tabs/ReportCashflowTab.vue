<script setup lang="ts">
import { CashAccountBalances, CashMutation } from '../../../types';
import { formatRupiah } from '../../../utils/formatters';

defineProps<{
  cashBalances: CashAccountBalances;
  totalPurchasesCost: number;
  operationalExpenses: number;
  netCashFlow: number;
  purchaseCount: number;
  periodMutations?: CashMutation[];
}>();
</script>

<template>
  <div class="flex-1 overflow-auto flex flex-col bg-white">
    <!-- Tabel Standar Arus Kas Operasional -->
    <table class="table-explorer w-full min-w-[780px] whitespace-nowrap">
      <thead>
        <tr>
          <th class="w-12 text-center">NO</th>
          <th class="w-1/3 text-left">ALIRAN UANG KAS (MASUK &amp; KELUAR)</th>
          <th class="w-44 text-right">KAS MASUK (RP)</th>
          <th class="w-44 text-right">KAS KELUAR (RP)</th>
          <th class="text-left">PENJELASAN</th>
        </tr>
      </thead>
      <tbody>
        <!-- 1. Arus Kas Masuk -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">1</td>
          <td colspan="4" class="text-emerald-900 uppercase tracking-wider text-[11px]">
            1. TOTAL UANG MASUK (HASIL PENJUALAN)
          </td>
        </tr>
        <tr class="hover:bg-emerald-50/20">
          <td class="text-center font-mono text-gray-400">1.1</td>
          <td class="pl-6 font-semibold">Penerimaan Uang Tunai di Kasir</td>
          <td class="text-right font-mono font-bold text-emerald-700">{{ formatRupiah(cashBalances.salesCash) }}</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-gray-500 text-[11px]">Uang fisik tunai yang masuk ke laci kasir</td>
        </tr>
        <tr class="hover:bg-emerald-50/20">
          <td class="text-center font-mono text-gray-400">1.2</td>
          <td class="pl-6 font-semibold">Penerimaan Masuk Rekening Bank</td>
          <td class="text-right font-mono font-bold text-blue-700">{{ formatRupiah(cashBalances.salesBank) }}</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-gray-500 text-[11px]">Uang penjualan masuk transfer rekening bank toko</td>
        </tr>
        <tr class="hover:bg-emerald-50/20">
          <td class="text-center font-mono text-gray-400">1.3</td>
          <td class="pl-6 font-semibold">Penerimaan QRIS Toko</td>
          <td class="text-right font-mono font-bold text-purple-700">{{ formatRupiah(cashBalances.salesQris) }}</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-gray-500 text-[11px]">Uang pembayaran scan QRIS pembeli</td>
        </tr>
        <tr class="bg-emerald-50/40 font-bold border-t border-b border-emerald-200">
          <td class="text-center font-mono text-emerald-900">1.4</td>
          <td class="pl-6 text-emerald-900 font-bold">TOTAL SEMUA UANG MASUK</td>
          <td class="text-right font-mono text-emerald-800 text-sm font-extrabold">
            {{ formatRupiah(cashBalances.salesCash + cashBalances.salesBank + cashBalances.salesQris) }}
          </td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-emerald-800 text-[11px] font-medium">Total seluruh uang penjualan yang diterima periode ini</td>
        </tr>

        <!-- 2. Arus Kas Keluar -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">2</td>
          <td colspan="4" class="text-amber-900 uppercase tracking-wider text-[11px]">
            2. TOTAL UANG KELUAR
          </td>
        </tr>
        <tr class="hover:bg-amber-50/20">
          <td class="text-center font-mono text-gray-400">2.1</td>
          <td class="pl-6 font-semibold">Belanja Kulakan Barang ke Supplier</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-right font-mono font-bold text-amber-800">{{ formatRupiah(totalPurchasesCost) }}</td>
          <td class="text-gray-500 text-[11px]">Total {{ purchaseCount }} faktur belanja kulakan stok barang dagang</td>
        </tr>
        <tr class="hover:bg-amber-50/20">
          <td class="text-center font-mono text-gray-400">2.2</td>
          <td class="pl-6 font-semibold">Biaya Operasional Toko &amp; Keperluan Kasir</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-right font-mono font-bold text-rose-700">{{ formatRupiah(operationalExpenses) }}</td>
          <td class="text-gray-500 text-[11px]">Biaya plastik, listrik, bensin, gaji, konsumsi, dll.</td>
        </tr>
        <tr class="bg-amber-50/40 font-bold border-t border-b border-amber-200">
          <td class="text-center font-mono text-amber-900">2.3</td>
          <td class="pl-6 text-amber-900 font-bold">TOTAL SEMUA UANG KELUAR</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-right font-mono text-rose-800 text-sm font-extrabold">
            {{ formatRupiah(totalPurchasesCost + operationalExpenses) }}
          </td>
          <td class="text-amber-800 text-[11px] font-medium">Total seluruh uang belanja dan biaya toko periode ini</td>
        </tr>

        <!-- 3. Net Cash Flow -->
        <tr class="bg-blue-50/70 font-extrabold border-t-2 border-b-2 border-blue-300">
          <td class="text-center font-mono text-blue-900">3</td>
          <td class="text-blue-900 uppercase tracking-wide">
            3. SISA UANG KAS BERSIH (NET CASH)
          </td>
          <td colspan="2" class="text-right font-mono text-blue-800 text-base font-extrabold">
            {{ netCashFlow >= 0 ? '+' : '' }} {{ formatRupiah(netCashFlow) }}
          </td>
          <td class="text-blue-800 text-[11px] font-semibold">
            Sisa uang riil (Total Uang Masuk dikurangi Total Uang Keluar)
          </td>
        </tr>

        <!-- 4. Rekonsiliasi Pemindahan Kas (Non-Beban) -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">4</td>
          <td colspan="4" class="text-indigo-900 uppercase tracking-wider text-[11px]">
            4. PINDAH SALDO ANTAR REKENING / KAS
          </td>
        </tr>
        <tr class="hover:bg-indigo-50/20">
          <td class="text-center font-mono text-gray-400">4.1</td>
          <td class="pl-6 font-semibold">Pencairan Saldo QRIS ke Rekening Bank</td>
          <td class="text-right font-mono font-bold text-indigo-700">{{ formatRupiah(cashBalances.settledQrisToBank) }}</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-gray-500 text-[11px]">Uang QRIS yang sudah cair dan masuk ke rekening bank</td>
        </tr>
        <tr class="hover:bg-indigo-50/20">
          <td class="text-center font-mono text-gray-400">4.2</td>
          <td class="pl-6 font-semibold">Setor Uang Tunai Kasir ke Rekening Bank</td>
          <td class="text-right font-mono font-bold text-indigo-700">{{ formatRupiah(cashBalances.transferOutCash) }}</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-gray-500 text-[11px]">Uang tunai dari laci kasir yang disetorkan ke bank</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
