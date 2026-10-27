<script setup lang="ts">
import { formatRupiah } from '../../../utils/formatters';

defineProps<{
  estimatedCashBalance: number;
  totalReceivables: number;
  totalInventoryAssetValuation: number;
  totalCurrentAssets: number;
  totalSupplierPayables: number;
  netWorthEquity: number;
}>();
</script>

<template>
  <div class="flex-1 overflow-auto">
    <div class="grid grid-cols-1 md:grid-cols-2 divide-x divide-gray-200 h-full">
      <!-- Kolom Kiri: Harta / Aset Toko -->
      <div class="flex flex-col overflow-x-auto">
        <div class="h-8 bg-blue-50 px-3 border-b border-blue-200 flex items-center justify-between font-bold text-blue-900 whitespace-nowrap">
          <span>1. HARTA &amp; KEKAYAAN TOKO (ASET)</span>
          <span class="font-mono text-[11px] font-semibold text-blue-700">SEMUA MILIK TOKO</span>
        </div>
        <table class="table-explorer w-full min-w-[340px] whitespace-nowrap">
          <thead>
            <tr>
              <th class="text-left">JENIS HARTA / KEKAYAAN</th>
              <th class="w-40 text-right">NILAI RIIL (RP)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-semibold">Uang Kas Tunai di Toko &amp; Rekening Bank</td>
              <td class="text-right font-mono font-bold">{{ formatRupiah(estimatedCashBalance) }}</td>
            </tr>
            <tr>
              <td class="font-semibold">Tagihan Bon / Piutang Pelanggan Belum Bayar</td>
              <td class="text-right font-mono font-bold text-amber-700">{{ formatRupiah(totalReceivables) }}</td>
            </tr>
            <tr>
              <td class="font-semibold">Total Nilai Modal Barang Dagangan di Toko (Stok)</td>
              <td class="text-right font-mono font-bold text-blue-700">{{ formatRupiah(totalInventoryAssetValuation) }}</td>
            </tr>
            <tr class="bg-blue-50/70 font-extrabold border-t-2 border-blue-300">
              <td class="text-blue-900">TOTAL SELURUH HARTA TOKO</td>
              <td class="text-right font-mono text-blue-900 text-sm font-extrabold">{{ formatRupiah(totalCurrentAssets) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Kolom Kanan: Hutang & Modal Bersih -->
      <div class="flex flex-col overflow-x-auto">
        <div class="h-8 bg-emerald-50 px-3 border-b border-emerald-200 flex items-center justify-between font-bold text-emerald-900 whitespace-nowrap">
          <span>2. KEWAJIBAN (HUTANG) &amp; MODAL BERSIH</span>
          <span class="font-mono text-[11px] font-semibold text-emerald-700">KEKAYAAN BERSIH</span>
        </div>
        <table class="table-explorer w-full min-w-[340px] whitespace-nowrap">
          <thead>
            <tr>
              <th class="text-left">RINCIAN HUTANG &amp; MODAL</th>
              <th class="w-40 text-right">NILAI RIIL (RP)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-semibold">Hutang Kulakan Tempo ke Supplier</td>
              <td class="text-right font-mono font-bold text-red-600">{{ formatRupiah(totalSupplierPayables) }}</td>
            </tr>
            <tr>
              <td class="font-semibold text-gray-500">Tanggungan Biaya Operasional Berjalan</td>
              <td class="text-right font-mono font-bold text-gray-400">Rp 0</td>
            </tr>
            <tr class="bg-gray-50/80 font-bold border-t border-gray-200">
              <td>TOTAL HUTANG TOKO</td>
              <td class="text-right font-mono font-bold text-red-600">{{ formatRupiah(totalSupplierPayables) }}</td>
            </tr>
            <tr class="bg-emerald-50/70 font-extrabold border-t-2 border-emerald-300">
              <td class="text-emerald-900">TOTAL MODAL BERSIH TOKO (HARTA MINUS HUTANG)</td>
              <td class="text-right font-mono text-emerald-800 text-sm font-extrabold">{{ formatRupiah(netWorthEquity) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
