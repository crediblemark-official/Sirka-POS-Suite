<script setup lang="ts">
import { useLedgerStore } from '../../../stores/ledgerStore';
import { formatRupiah } from '../../../utils/formatters';

export interface AgingReceivableItem {
  id: string;
  invoiceNo: string;
  buyer: string;
  date: string;
  ageDays: number;
  bucket: '0-7' | '8-14' | '15-30' | '>30';
  finalTotal?: number;
  totalSell?: number;
}

defineProps<{
  agingReceivables: AgingReceivableItem[];
}>();

const ledgerStore = useLedgerStore();
</script>

<template>
  <div class="flex-1 overflow-auto">
    <table class="table-explorer min-w-[900px] w-full">
      <thead>
        <tr>
          <th class="w-36">NO. NOTA</th>
          <th class="w-44 text-left">PELANGGAN</th>
          <th class="w-28 text-center">TANGGAL NOTA</th>
          <th class="w-28 text-center">UMUR PIUTANG</th>
          <th class="w-32 text-center">KATEGORI RISIKO</th>
          <th class="w-36 text-right">SISA TAGIHAN (RP)</th>
          <th class="w-28 text-center">AKSI STATUS</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in agingReceivables" :key="t.id" class="hover:bg-blue-50/20 cursor-pointer">
          <td class="font-mono font-bold text-blue-700">{{ t.invoiceNo }}</td>
          <td class="font-bold text-gray-800">{{ t.buyer }}</td>
          <td class="text-center font-mono text-gray-500">{{ t.date }}</td>
          <td class="text-center font-mono font-bold">{{ t.ageDays }} Hari</td>
          <td class="text-center">
            <span
              class="px-2 py-0.5 rounded text-[10px] font-mono font-bold"
              :class="{
                'bg-red-100 text-red-800 border border-red-300': t.bucket === '>30',
                'bg-yellow-100 text-yellow-800 border border-yellow-300': t.bucket === '15-30',
                'bg-blue-100 text-blue-800 border border-blue-200': t.bucket === '8-14',
                'bg-emerald-100 text-emerald-800 border border-emerald-200': t.bucket === '0-7'
              }"
            >
              {{ t.bucket === '>30' ? 'MACET (>30 HARI)' : (t.bucket === '15-30' ? 'PERINGATAN' : (t.bucket === '8-14' ? 'NORMAL' : 'LANCAR')) }}
            </span>
          </td>
          <td class="text-right font-mono font-bold text-gray-900">{{ formatRupiah(t.finalTotal ?? t.totalSell ?? 0) }}</td>
          <td class="text-center">
            <button
              type="button"
              @click="ledgerStore.togglePaymentStatus(t.id)"
              class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer shadow-2xs"
            >
              Set LUNAS
            </button>
          </td>
        </tr>
        <tr v-if="agingReceivables.length === 0">
          <td colspan="7" class="p-8 text-center text-gray-500">
            Tidak ada data piutang atau tagihan tempo yang tertahan.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
