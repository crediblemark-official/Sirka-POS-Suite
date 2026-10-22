<script setup lang="ts">
import { Wallet, Building, QrCode } from 'lucide-vue-next';
import { CashAccountBalances } from '../../types';
import { formatRupiah } from '../../utils/formatters';

const props = withDefaults(defineProps<{
  balances: CashAccountBalances;
  readOnly?: boolean;
  size?: 'lg' | 'xl';
}>(), {
  readOnly: false,
  size: 'xl'
});

const emit = defineEmits<{
  (e: 'settle-qris'): void;
}>();
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
    <!-- 1. Kas Tunai Laci Kasir -->
    <div class="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-bold text-emerald-900 uppercase">1. Kas Tunai (Laci Fisik)</span>
        <Wallet :size="15" class="text-emerald-700" />
      </div>
      <div
        class="my-1.5 font-mono font-extrabold text-emerald-900"
        :class="props.size === 'lg' ? 'text-lg' : 'text-xl'"
      >
        Rp {{ formatRupiah(balances.netCashDrawer) }}
      </div>
      <div class="text-[10px] text-emerald-800 flex items-center justify-between pt-1 border-t border-emerald-200/60 font-medium">
        <span>Omzet Tunai: Rp {{ formatRupiah(balances.salesCash) }}</span>
        <span class="text-rose-700">Keluar: -Rp {{ formatRupiah(balances.expenseCash + balances.transferOutCash) }}</span>
      </div>
    </div>

    <!-- 2. Rekening Bank Toko -->
    <div class="p-3 rounded-lg border border-blue-200 bg-blue-50/50 flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-bold text-blue-900 uppercase">2. Rekening Bank Toko</span>
        <Building :size="15" class="text-blue-700" />
      </div>
      <div
        class="my-1.5 font-mono font-extrabold text-blue-900"
        :class="props.size === 'lg' ? 'text-lg' : 'text-xl'"
      >
        Rp {{ formatRupiah(balances.netBankBalance) }}
      </div>
      <div class="text-[10px] text-blue-800 flex items-center justify-between pt-1 border-t border-blue-200/60 font-medium">
        <span>Masuk: Rp {{ formatRupiah(balances.salesBank + balances.transferInBank) }}</span>
        <span class="text-rose-700">Keluar/Kulakan: -Rp {{ formatRupiah(balances.purchasesCostBank + balances.expenseBank) }}</span>
      </div>
    </div>

    <!-- 3. Saldo QRIS Menunggu Pencairan -->
    <div class="p-3 rounded-lg border border-purple-200 bg-purple-50/50 flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-bold text-purple-900 uppercase">3. Saldo QRIS (Belum Cair)</span>
        <QrCode :size="15" class="text-purple-700" />
      </div>
      <div
        class="my-1.5 font-mono font-extrabold text-purple-900 flex items-baseline justify-between"
        :class="props.size === 'lg' ? 'text-lg' : 'text-xl'"
      >
        <span>Rp {{ formatRupiah(balances.pendingQrisSettlement) }}</span>
        <button
          v-if="!props.readOnly && balances.pendingQrisSettlement > 0"
          type="button"
          class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white cursor-pointer shadow-2xs transition-colors"
          title="Cairkan saldo QRIS masuk ke rekening bank"
          @click="emit('settle-qris')"
        >
          ⚡ Cairkan ke Bank
        </button>
      </div>
      <div class="text-[10px] text-purple-800 flex items-center justify-between pt-1 border-t border-purple-200/60 font-medium">
        <span>Total QRIS: Rp {{ formatRupiah(balances.salesQris) }}</span>
        <span class="text-emerald-700">Sudah Cair: Rp {{ formatRupiah(balances.settledQrisToBank) }}</span>
      </div>
    </div>
  </div>
</template>
