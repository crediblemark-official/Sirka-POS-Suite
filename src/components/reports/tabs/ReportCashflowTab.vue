<script setup lang="ts">
import { CashAccountBalances, CashMutation } from '../../../types';
import { formatRupiah } from '../../../utils/formatters';
import CashPocketCards from '../../cash/CashPocketCards.vue';

defineProps<{
  cashBalances: CashAccountBalances;
  totalPurchasesCost: number;
  operationalExpenses: number;
  netCashFlow: number;
  purchaseCount: number;
  periodMutations: CashMutation[];
}>();
</script>

<template>
  <div class="flex-1 overflow-auto flex flex-col bg-white">
    <!-- 1. Kartu Posisi Saldo Kas & Rekonsiliasi Real-Time (3 Kantong Kas) -->
    <div class="p-3.5 bg-gray-50/70 border-b border-gray-200 shrink-0">
      <div class="flex items-center justify-between mb-2.5">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-gray-800 uppercase tracking-wide">
            Posisi Saldo Kas &amp; Rekonsiliasi Akun
          </span>
          <span class="text-[11px] text-gray-500 font-medium">
            (Riil terpisah: Kas Fisik, Rekening Bank, Saldo QRIS)
          </span>
        </div>
      </div>

      <!-- 3 Kartu Saldo Kantong Kas (Read-Only Reusable Component) -->
      <CashPocketCards :balances="cashBalances" :read-only="true" size="lg" />
    </div>

    <!-- 2. Tabel Standar Arus Kas Operasional -->
    <table class="table-explorer w-full">
      <thead>
        <tr>
          <th class="w-12 text-center">NO</th>
          <th class="w-1/3 text-left">MUTASI ARUS KAS OPERASIONAL</th>
          <th class="w-44 text-right">KAS MASUK (RP)</th>
          <th class="w-44 text-right">KAS KELUAR (RP)</th>
          <th class="text-left">KETERANGAN &amp; REKONSILIASI</th>
        </tr>
      </thead>
      <tbody>
        <!-- 1. Arus Kas Masuk -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">1</td>
          <td colspan="4" class="text-emerald-900 uppercase tracking-wider text-[11px]">
            ARUS KAS MASUK OPERASIONAL (INFLOW)
          </td>
        </tr>
        <tr class="hover:bg-emerald-50/20">
          <td class="text-center font-mono text-gray-400">1.1</td>
          <td class="pl-6 font-semibold">Penerimaan Pembayaran Tunai Kasir</td>
          <td class="text-right font-mono font-bold text-emerald-700">{{ formatRupiah(cashBalances.salesCash) }}</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-gray-500 text-[11px]">Uang fisik tunai di laci kasir</td>
        </tr>
        <tr class="hover:bg-emerald-50/20">
          <td class="text-center font-mono text-gray-400">1.2</td>
          <td class="pl-6 font-semibold">Penerimaan Transfer Bank (Lunas)</td>
          <td class="text-right font-mono font-bold text-blue-700">{{ formatRupiah(cashBalances.salesBank) }}</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-gray-500 text-[11px]">Mutasi rekening bank operasional</td>
        </tr>
        <tr class="hover:bg-emerald-50/20">
          <td class="text-center font-mono text-gray-400">1.3</td>
          <td class="pl-6 font-semibold">Penerimaan QRIS Toko (Lunas)</td>
          <td class="text-right font-mono font-bold text-purple-700">{{ formatRupiah(cashBalances.salesQris) }}</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-gray-500 text-[11px]">Scan QRIS masuk saldo merchant aggregator</td>
        </tr>
        <tr class="bg-emerald-50/40 font-bold border-t border-b border-emerald-200">
          <td class="text-center font-mono text-emerald-900">1.4</td>
          <td class="pl-6 text-emerald-900 font-bold">SUBTOTAL KAS MASUK PENJUALAN</td>
          <td class="text-right font-mono text-emerald-800 text-sm font-extrabold">
            {{ formatRupiah(cashBalances.salesCash + cashBalances.salesBank + cashBalances.salesQris) }}
          </td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-emerald-800 text-[11px] font-medium">Total seluruh penerimaan omzet penjualan periode ini</td>
        </tr>

        <!-- 2. Arus Kas Keluar -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">2</td>
          <td colspan="4" class="text-amber-900 uppercase tracking-wider text-[11px]">
            ARUS KAS KELUAR OPERASIONAL (OUTFLOW)
          </td>
        </tr>
        <tr class="hover:bg-amber-50/20">
          <td class="text-center font-mono text-gray-400">2.1</td>
          <td class="pl-6 font-semibold">Pembayaran Faktur Kulakan Barang Supplier</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-right font-mono font-bold text-amber-800">{{ formatRupiah(totalPurchasesCost) }}</td>
          <td class="text-gray-500 text-[11px]">Total {{ purchaseCount }} faktur pembelian barang dagang</td>
        </tr>
        <tr class="hover:bg-amber-50/20">
          <td class="text-center font-mono text-gray-400">2.2</td>
          <td class="pl-6 font-semibold">Beban &amp; Pengeluaran Kas Toko (Operasional/Prive)</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-right font-mono font-bold text-rose-700">{{ formatRupiah(operationalExpenses) }}</td>
          <td class="text-gray-500 text-[11px]">Plastik, listrik, bensin, gaji, konsumsi, dll.</td>
        </tr>
        <tr class="bg-amber-50/40 font-bold border-t border-b border-amber-200">
          <td class="text-center font-mono text-amber-900">2.3</td>
          <td class="pl-6 text-amber-900 font-bold">SUBTOTAL KAS KELUAR OPERASIONAL</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-right font-mono text-rose-800 text-sm font-extrabold">
            {{ formatRupiah(totalPurchasesCost + operationalExpenses) }}
          </td>
          <td class="text-amber-800 text-[11px] font-medium">Total seluruh pengeluaran uang periode ini</td>
        </tr>

        <!-- 3. Net Cash Flow -->
        <tr class="bg-blue-50/70 font-extrabold border-t-2 border-b-2 border-blue-300">
          <td class="text-center font-mono text-blue-900">3</td>
          <td class="text-blue-900 uppercase tracking-wide">
            ARUS KAS BERSIH (NET CASH FLOW)
          </td>
          <td colspan="2" class="text-right font-mono text-blue-800 text-base font-extrabold">
            {{ netCashFlow >= 0 ? '+' : '' }} {{ formatRupiah(netCashFlow) }}
          </td>
          <td class="text-blue-800 text-[11px] font-semibold">
            Sisa kas riil (Total Inflow dikurangi Total Outflow)
          </td>
        </tr>

        <!-- 4. Rekonsiliasi Pemindahan Kas (Non-Beban) -->
        <tr class="bg-gray-50/80 font-bold">
          <td class="text-center font-mono">4</td>
          <td colspan="4" class="text-indigo-900 uppercase tracking-wider text-[11px]">
            REKONSILIASI &amp; MUTASI PEMINDAHAN ANTAR AKUN
          </td>
        </tr>
        <tr class="hover:bg-indigo-50/20">
          <td class="text-center font-mono text-gray-400">4.1</td>
          <td class="pl-6 font-semibold">Pencairan / Settlement QRIS Masuk Rekening Bank</td>
          <td class="text-right font-mono font-bold text-indigo-700">{{ formatRupiah(cashBalances.settledQrisToBank) }}</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-gray-500 text-[11px]">Dana QRIS yang telah dipindah/cair ke rekening</td>
        </tr>
        <tr class="hover:bg-indigo-50/20">
          <td class="text-center font-mono text-gray-400">4.2</td>
          <td class="pl-6 font-semibold">Setor Kas Fisik Tunai ke Rekening Bank</td>
          <td class="text-right font-mono font-bold text-indigo-700">{{ formatRupiah(cashBalances.transferOutCash) }}</td>
          <td class="text-right font-mono text-gray-300">-</td>
          <td class="text-gray-500 text-[11px]">Uang fisik kasir yang disetor ke bank</td>
        </tr>
      </tbody>
    </table>

    <!-- 3. Tabel Riwayat Catatan Pengeluaran & Mutasi Kas Lengkap (Read-Only) -->
    <div class="border-t-2 border-gray-200 mt-4 bg-white flex flex-col">
      <div class="px-4 py-2.5 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-bold text-xs text-gray-800 uppercase tracking-wide">
            Riwayat Catatan Pengeluaran &amp; Mutasi Kas
          </span>
          <span class="px-2 py-0.2 rounded-full bg-gray-200 text-gray-700 font-mono text-[10px] font-bold">
            {{ periodMutations.length }} Catatan
          </span>
        </div>
        <span class="text-[11px] text-gray-500 font-medium">
          (Pencatatan kas dikelola melalui menu Buku Kas)
        </span>
      </div>

      <table class="table-explorer w-full">
        <thead>
          <tr>
            <th class="w-12 text-center">NO</th>
            <th class="w-28 text-left">TANGGAL</th>
            <th class="w-24 text-center">TIPE</th>
            <th class="w-32 text-left">DARI SUMBER</th>
            <th class="w-32 text-left">KE TUJUAN</th>
            <th class="w-36 text-left">KATEGORI</th>
            <th class="w-32 text-right">NOMINAL (RP)</th>
            <th class="text-left">KETERANGAN &amp; CATATAN</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(mut, mIdx) in periodMutations"
            :key="mut.id"
            class="hover:bg-gray-50/60"
          >
            <td class="text-center font-mono text-gray-400">{{ mIdx + 1 }}</td>
            <td class="font-mono text-[11px] text-gray-700">{{ mut.date }}</td>
            <td class="text-center">
              <span
                class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                :class="mut.type === 'EXPENSE' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'"
              >
                {{ mut.type === 'EXPENSE' ? 'Keluar' : 'Transfer' }}
              </span>
            </td>
            <td class="font-semibold text-gray-800">
              <span v-if="mut.fromAccount === 'TUNAI'">Kas Tunai</span>
              <span v-else-if="mut.fromAccount === 'BANK'">Rekening Bank</span>
              <span v-else>Saldo QRIS</span>
            </td>
            <td class="text-gray-600">
              <template v-if="mut.toAccount">
                <span v-if="mut.toAccount === 'TUNAI'" class="font-semibold text-emerald-700">Kas Tunai</span>
                <span v-else-if="mut.toAccount === 'BANK'" class="font-semibold text-blue-700">Rekening Bank</span>
                <span v-else class="font-semibold text-purple-700">Saldo QRIS</span>
              </template>
              <span v-else class="text-gray-300">-</span>
            </td>
            <td class="font-medium text-gray-800">{{ mut.category }}</td>
            <td
              class="text-right font-mono font-bold"
              :class="mut.type === 'EXPENSE' ? 'text-rose-700' : 'text-blue-700'"
            >
              Rp {{ formatRupiah(mut.amount) }}
            </td>
            <td class="text-gray-600 text-[11px]">
              <span>{{ mut.notes || '-' }}</span>
              <span v-if="mut.referenceNo" class="text-gray-400 font-mono ml-1.5">({{ mut.referenceNo }})</span>
            </td>
          </tr>

          <tr v-if="periodMutations.length === 0">
            <td colspan="8" class="p-6 text-center text-gray-400">
              <p class="font-semibold text-xs text-gray-600">Belum ada catatan pengeluaran kas atau mutasi transfer</p>
              <p class="text-[11px] mt-0.5">Catatan pengeluaran dan mutasi kas dicatat melalui menu Buku Kas.</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
