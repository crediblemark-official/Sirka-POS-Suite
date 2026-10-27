<script setup lang="ts">
import { computed } from 'vue';
import { Wallet, Building, QrCode, Coins } from 'lucide-vue-next';
import { CashAccountBalances } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import MetricStatsStrip, { type MetricStatItem } from '../common/MetricStatsStrip.vue';

const props = withDefaults(defineProps<{
  balances: CashAccountBalances;
  readOnly?: boolean;
}>(), {
  readOnly: false
});

const emit = defineEmits<{
  (e: 'settle-qris'): void;
}>();

const metricStats = computed<MetricStatItem[]>(() => {
  const totalLikuiditas = props.balances.netCashDrawer + props.balances.netBankBalance + props.balances.pendingQrisSettlement;

  return [
    {
      label: '1. Kas Tunai (Laci Fisik)',
      value: `Rp ${formatRupiah(props.balances.netCashDrawer)}`,
      tooltip: `Kas Tunai di Laci Kasir | Omzet Tunai: Rp ${formatRupiah(props.balances.salesCash)} | Keluar: -Rp ${formatRupiah(props.balances.expenseCash + props.balances.transferOutCash)}`,
      icon: Wallet,
      iconBoxClass: 'bg-emerald-50 text-emerald-700',
      valClass: 'text-emerald-700'
    },
    {
      label: '2. Rekening Bank Toko',
      value: `Rp ${formatRupiah(props.balances.netBankBalance)}`,
      tooltip: `Rekening Bank Toko | Masuk: Rp ${formatRupiah(props.balances.salesBank + props.balances.transferInBank)} | Keluar/Kulakan: -Rp ${formatRupiah(props.balances.purchasesCostBank + props.balances.expenseBank)}`,
      icon: Building,
      iconBoxClass: 'bg-blue-50 text-blue-700',
      valClass: 'text-blue-700'
    },
    {
      label: '3. Saldo QRIS (Belum Cair)',
      value: `Rp ${formatRupiah(props.balances.pendingQrisSettlement)}`,
      tooltip: `Saldo QRIS Menunggu Pencairan ke Bank | Total QRIS: Rp ${formatRupiah(props.balances.salesQris)} | Sudah Cair: Rp ${formatRupiah(props.balances.settledQrisToBank)}`,
      icon: QrCode,
      iconBoxClass: 'bg-purple-50 text-purple-700',
      valClass: 'text-purple-700',
      actionLabel: (!props.readOnly && props.balances.pendingQrisSettlement > 0) ? '⚡ Cairkan' : undefined,
      actionFn: (!props.readOnly && props.balances.pendingQrisSettlement > 0) ? () => emit('settle-qris') : undefined,
      actionClass: 'bg-purple-600 hover:bg-purple-700 text-white'
    },
    {
      label: 'Total Saldo Kas & Bank',
      value: `Rp ${formatRupiah(totalLikuiditas)}`,
      tooltip: 'Total seluruh saldo likuiditas toko yang tersedia di laci kasir, bank, dan QRIS',
      icon: Coins,
      iconBoxClass: 'bg-indigo-50 text-indigo-700',
      valClass: 'text-indigo-900'
    }
  ];
});
</script>

<template>
  <MetricStatsStrip :items="metricStats" />
</template>
