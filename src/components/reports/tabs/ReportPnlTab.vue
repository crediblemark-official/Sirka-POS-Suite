<script setup lang="ts">
import { ref } from 'vue';
import { formatRupiah } from '../../../utils/formatters';

defineProps<{
  grossSales: number;
  totalDiscounts: number;
  netSales: number;
  totalCogs: number;
  grossProfit: number;
  marginPercent: number;
  taxUmkmEstimated: number;
}>();

// Catatan Keuangan: Inline Expand / Collapse saat diklik
const expandedNotes = ref<Set<string>>(new Set());

function toggleNote(key: string) {
  if (expandedNotes.value.has(key)) {
    expandedNotes.value.delete(key);
  } else {
    expandedNotes.value.add(key);
  }
}

function isNoteExpanded(key: string): boolean {
  return expandedNotes.value.has(key);
}
</script>

<template>
  <div class="flex-1 overflow-auto">
    <table class="table-explorer w-full">
      <thead>
        <tr>
          <th class="w-12 text-center">NO</th>
          <th class="w-1/3 text-left">KOMPONEN LAPORAN LABA RUGI (SAK EMKM)</th>
          <th class="w-44 text-right">NOMINAL (RUPIAH)</th>
          <th class="w-36 text-right">PERSENTASE (%)</th>
          <th class="text-left">CATATAN KEUANGAN</th>
        </tr>
      </thead>
      <tbody>
        <!-- 1. Pendapatan Penjualan -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">1</td>
          <td colspan="4" class="text-indigo-900 uppercase tracking-wider text-[11px]">
            PENDAPATAN USAHA (REVENUE)
          </td>
        </tr>
        <tr class="hover:bg-blue-50/20">
          <td class="text-center font-mono text-gray-400">1.1</td>
          <td class="pl-6 font-semibold">Penjualan Kotor (Gross Sales)</td>
          <td class="text-right font-mono font-bold">{{ formatRupiah(grossSales) }}</td>
          <td class="text-right font-mono text-gray-500">100.0%</td>
          <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_1_1') ? 'Klik untuk ciutkan' : 'Akumulasi nilai transaksi kasir sebelum diskon (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_1_1')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_1_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Akumulasi nilai transaksi kasir sebelum diskon
              </div>
            </div>
          </td>
        </tr>
        <tr class="hover:bg-blue-50/20 text-red-600">
          <td class="text-center font-mono text-gray-400">1.2</td>
          <td class="pl-6 font-semibold">Potongan &amp; Diskon Promo Penjualan</td>
          <td class="text-right font-mono font-bold">- {{ formatRupiah(totalDiscounts) }}</td>
          <td class="text-right font-mono text-gray-500">
            {{ grossSales > 0 ? ((totalDiscounts / grossSales) * 100).toFixed(1) : 0 }}%
          </td>
          <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_1_2') ? 'Klik untuk ciutkan' : 'Voucher diskon kupon belanja, potongan harga, dan penukaran poin loyalitas (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_1_2')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_1_2') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Voucher diskon kupon belanja, potongan harga, dan penukaran poin loyalitas
              </div>
            </div>
          </td>
        </tr>
        <tr class="bg-blue-50/40 font-bold border-t border-b border-blue-200">
          <td class="text-center font-mono text-blue-900">1.3</td>
          <td class="pl-6 text-blue-900">TOTAL PENJUALAN BERSIH (NET SALES)</td>
          <td class="text-right font-mono text-blue-900 text-sm font-extrabold">{{ formatRupiah(netSales) }}</td>
          <td class="text-right font-mono text-blue-900 font-bold">
            {{ grossSales > 0 ? ((netSales / grossSales) * 100).toFixed(1) : 0 }}%
          </td>
          <td class="text-blue-800 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_1_3') ? 'Klik untuk ciutkan' : 'Basis perhitungan omzet riil toko (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_1_3')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_1_3') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Basis perhitungan omzet riil toko
              </div>
            </div>
          </td>
        </tr>

        <!-- 2. Harga Pokok Penjualan -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">2</td>
          <td colspan="4" class="text-indigo-900 uppercase tracking-wider text-[11px]">
            HARGA POKOK PENJUALAN (HPP)
          </td>
        </tr>
        <tr class="hover:bg-blue-50/20">
          <td class="text-center font-mono text-gray-400">2.1</td>
          <td class="pl-6 font-semibold">Beban Modal Pembelian Barang Terjual (COGS)</td>
          <td class="text-right font-mono font-bold">{{ formatRupiah(totalCogs) }}</td>
          <td class="text-right font-mono text-gray-500">
            {{ netSales > 0 ? ((totalCogs / netSales) * 100).toFixed(1) : 0 }}%
          </td>
          <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_2_1') ? 'Klik untuk ciutkan' : 'Stok terjual × HPP kulakan terakhir supplier (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_2_1')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_2_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Stok terjual &times; HPP kulakan terakhir supplier
              </div>
            </div>
          </td>
        </tr>

        <!-- 3. Laba Kotor Operasional -->
        <tr class="bg-emerald-50/70 font-extrabold border-t-2 border-b-2 border-emerald-300">
          <td class="text-center font-mono text-emerald-900">3</td>
          <td class="text-emerald-900 uppercase tracking-wide">
            LABA KOTOR OPERASIONAL (GROSS PROFIT)
          </td>
          <td class="text-right font-mono text-emerald-800 text-base font-extrabold">
            + {{ formatRupiah(grossProfit) }}
          </td>
          <td class="text-right font-mono text-emerald-800 text-sm font-extrabold">
            {{ marginPercent.toFixed(1) }}%
          </td>
          <td class="text-emerald-800 text-[11px] font-semibold max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_3') ? 'Klik untuk ciutkan' : 'Margin kotor terhadap omzet penjualan (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_3')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_3') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Margin kotor terhadap omzet penjualan
              </div>
            </div>
          </td>
        </tr>

        <!-- 4. Estimasi Pajak & Rekomendasi -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">4</td>
          <td colspan="4" class="text-purple-900 uppercase tracking-wider text-[11px]">
            KEWAJIBAN PERPAJAKAN USAHA
          </td>
        </tr>
        <tr class="hover:bg-purple-50/20">
          <td class="text-center font-mono text-gray-400">4.1</td>
          <td class="pl-6 font-semibold">Estimasi PPh Final UMKM 0.5% (PP No. 55 / 2022)</td>
          <td class="text-right font-mono font-bold text-purple-900">{{ formatRupiah(taxUmkmEstimated) }}</td>
          <td class="text-right font-mono text-gray-500">0.5%</td>
          <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_4_1') ? 'Klik untuk ciutkan' : 'Tarif 0.5% × Omzet Bruto bulanan toko (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_4_1')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_4_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Tarif 0.5% &times; Omzet Bruto bulanan toko
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
