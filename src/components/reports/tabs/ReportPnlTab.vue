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
    <table class="table-explorer w-full min-w-[780px] whitespace-nowrap">
      <thead>
        <tr>
          <th class="w-12 text-center">NO</th>
          <th class="w-1/3 text-left">RINCIAN KEUNTUNGAN (LABA RUGI)</th>
          <th class="w-44 text-right">NOMINAL (RUPIAH)</th>
          <th class="w-36 text-right">PERSENTASE (%)</th>
          <th class="text-left">PENJELASAN</th>
        </tr>
      </thead>
      <tbody>
        <!-- 1. Pendapatan Penjualan -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">1</td>
          <td colspan="4" class="text-indigo-900 uppercase tracking-wider text-[11px]">
            1. PENDAPATAN DARI PENJUALAN
          </td>
        </tr>
        <tr class="hover:bg-blue-50/20">
          <td class="text-center font-mono text-gray-400">1.1</td>
          <td class="pl-6 font-semibold">Total Penjualan Kasir (Sebelum Diskon)</td>
          <td class="text-right font-mono font-bold">{{ formatRupiah(grossSales) }}</td>
          <td class="text-right font-mono text-gray-500">100.0%</td>
          <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_1_1') ? 'Klik untuk ciutkan' : 'Total seluruh belanja kasir sebelum dipotong diskon (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_1_1')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_1_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Total seluruh belanja kasir sebelum dipotong diskon
              </div>
            </div>
          </td>
        </tr>
        <tr class="hover:bg-blue-50/20 text-red-600">
          <td class="text-center font-mono text-gray-400">1.2</td>
          <td class="pl-6 font-semibold">Potongan Diskon &amp; Kupon Belanja</td>
          <td class="text-right font-mono font-bold">- {{ formatRupiah(totalDiscounts) }}</td>
          <td class="text-right font-mono text-gray-500">
            {{ grossSales > 0 ? ((totalDiscounts / grossSales) * 100).toFixed(1) : 0 }}%
          </td>
          <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_1_2') ? 'Klik untuk ciutkan' : 'Diskon kupon belanja, potongan harga promo, dan tukar poin loyalitas (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_1_2')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_1_2') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Diskon kupon belanja, potongan harga promo, dan tukar poin loyalitas
              </div>
            </div>
          </td>
        </tr>
        <tr class="bg-blue-50/40 font-bold border-t border-b border-blue-200">
          <td class="text-center font-mono text-blue-900">1.3</td>
          <td class="pl-6 text-blue-900 font-bold">TOTAL PENJUALAN BERSIH (UANG PENJUALAN RIIL)</td>
          <td class="text-right font-mono text-blue-900 text-sm font-extrabold">{{ formatRupiah(netSales) }}</td>
          <td class="text-right font-mono text-blue-900 font-bold">
            {{ grossSales > 0 ? ((netSales / grossSales) * 100).toFixed(1) : 0 }}%
          </td>
          <td class="text-blue-800 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_1_3') ? 'Klik untuk ciutkan' : 'Uang hasil penjualan toko setelah dikurangi diskon & promo (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_1_3')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_1_3') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Uang hasil penjualan toko setelah dikurangi diskon &amp; promo
              </div>
            </div>
          </td>
        </tr>

        <!-- 2. Harga Pokok Penjualan -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">2</td>
          <td colspan="4" class="text-indigo-900 uppercase tracking-wider text-[11px]">
            2. MODAL KULAKAN BARANG TERJUAL
          </td>
        </tr>
        <tr class="hover:bg-blue-50/20">
          <td class="text-center font-mono text-gray-400">2.1</td>
          <td class="pl-6 font-semibold">Modal Beli Barang yang Terjual (Kulakan)</td>
          <td class="text-right font-mono font-bold">{{ formatRupiah(totalCogs) }}</td>
          <td class="text-right font-mono text-gray-500">
            {{ netSales > 0 ? ((totalCogs / netSales) * 100).toFixed(1) : 0 }}%
          </td>
          <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_2_1') ? 'Klik untuk ciutkan' : 'Jumlah barang yang laku terjual × harga modal beli ke supplier (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_2_1')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_2_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Jumlah barang yang laku terjual &times; harga modal beli ke supplier
              </div>
            </div>
          </td>
        </tr>

        <!-- 3. Laba Kotor Operasional -->
        <tr class="bg-emerald-50/70 font-extrabold border-t-2 border-b-2 border-emerald-300">
          <td class="text-center font-mono text-emerald-900">3</td>
          <td class="text-emerald-900 uppercase tracking-wide">
            3. KEUNTUNGAN DARI PENJUALAN (LABA KOTOR)
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
              :title="isNoteExpanded('pnl_3') ? 'Klik untuk ciutkan' : 'Hasil penjualan bersih dikurangi modal kulakan barang (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_3')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_3') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Hasil penjualan bersih dikurangi modal kulakan barang
              </div>
            </div>
          </td>
        </tr>

        <!-- 4. Estimasi Pajak & Rekomendasi -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">4</td>
          <td colspan="4" class="text-purple-900 uppercase tracking-wider text-[11px]">
            4. PERKIRAAN PAJAK UMKM
          </td>
        </tr>
        <tr class="hover:bg-purple-50/20">
          <td class="text-center font-mono text-gray-400">4.1</td>
          <td class="pl-6 font-semibold">Perkiraan Pajak UMKM 0.5% (PP 55)</td>
          <td class="text-right font-mono font-bold text-purple-900">{{ formatRupiah(taxUmkmEstimated) }}</td>
          <td class="text-right font-mono text-gray-500">0.5%</td>
          <td class="text-gray-500 text-[11px] max-w-sm lg:max-w-xl xl:max-w-2xl">
            <div
              class="cursor-pointer select-none transition-colors"
              :title="isNoteExpanded('pnl_4_1') ? 'Klik untuk ciutkan' : 'Tarif 0.5% × total penjualan bersih bulanan (Klik untuk baca penuh)'"
              @click="toggleNote('pnl_4_1')"
            >
              <div
                class="hover:underline transition-colors"
                :class="isNoteExpanded('pnl_4_1') ? 'whitespace-normal break-words py-0.5' : 'truncate'"
              >
                Tarif 0.5% &times; total penjualan bersih bulanan
              </div>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
