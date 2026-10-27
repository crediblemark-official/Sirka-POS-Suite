<script setup lang="ts">
import { computed } from 'vue';
import { useLicenseStore } from '../../stores/licenseStore';
import { Shield, ShieldCheck, ShieldAlert, KeyRound } from 'lucide-vue-next';

const licenseStore = useLicenseStore();

defineProps<{
  size?: 'sm' | 'md';
  showLabel?: boolean;
}>();

const statusTextColorClass = computed(() => {
  switch (licenseStore.status) {
    case 'ACTIVE':
      return licenseStore.isOfflineVerification ? 'text-blue-600' : 'text-emerald-700';
    case 'OFFLINE_GRACE':
      return 'text-amber-700';
    case 'EXPIRED':
    case 'REVOKED':
      return 'text-rose-600';
    case 'SEAT_FULL':
    case 'LEASE_EXPIRED':
      return 'text-orange-700';
    case 'CHECKING':
      return 'text-blue-600';
    case 'UNREGISTERED':
    default:
      return 'text-amber-700';
  }
});
</script>

<template>
  <button
    type="button"
    class="flex items-center gap-1.5 px-1 py-0.5 text-[10.5px] font-medium transition-all cursor-pointer hover:opacity-80 active:scale-95 select-none bg-transparent border-0"
    :class="statusTextColorClass"
    :title="`Status: ${licenseStore.statusLabel}`"
    @click="licenseStore.openLicenseModal()"
  >
    <!-- Dot Indikator -->
    <span
      class="w-1.5 h-1.5 rounded-full shrink-0"
      :class="{
        'bg-emerald-500': licenseStore.isLicensed && !licenseStore.isOfflineVerification,
        'bg-blue-500': licenseStore.isLicensed && licenseStore.isOfflineVerification,
        'bg-amber-500 animate-pulse': licenseStore.status === 'OFFLINE_GRACE' || licenseStore.status === 'UNREGISTERED',
        'bg-red-500': licenseStore.status === 'EXPIRED' || licenseStore.status === 'REVOKED',
        'bg-indigo-500 animate-spin': licenseStore.isChecking || licenseStore.isActivating
      }"
    ></span>

    <!-- Icon -->
    <ShieldCheck v-if="licenseStore.isLicensed && !licenseStore.isOfflineVerification" :size="12" class="text-emerald-600 shrink-0" />
    <Shield v-else-if="licenseStore.isLicensed && licenseStore.isOfflineVerification" :size="12" class="text-blue-600 shrink-0" />
    <ShieldAlert v-else-if="licenseStore.status === 'EXPIRED' || licenseStore.status === 'REVOKED'" :size="12" class="text-rose-600 shrink-0" />
    <KeyRound v-else :size="12" class="text-amber-700 shrink-0" />

    <!-- Label -->
    <span class="font-mono">
      <template v-if="licenseStore.isLicensed">
        <span v-if="licenseStore.isOfflineVerification">Offline</span>
        <span v-else>Aktif</span>
        <span v-if="licenseStore.daysRemaining !== null && licenseStore.daysRemaining <= 30" class="ml-1 opacity-75">
          ({{ licenseStore.daysRemaining }}h)
        </span>
      </template>
      <template v-else-if="licenseStore.status === 'EXPIRED'">
        <span>Kedaluwarsa</span>
      </template>
      <template v-else-if="licenseStore.status === 'REVOKED'">
        <span>Dicabut</span>
      </template>
      <template v-else>
        <span>Belum Diaktivasi</span>
      </template>
    </span>
  </button>
</template>
