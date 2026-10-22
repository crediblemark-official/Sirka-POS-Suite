<script setup lang="ts">
import { LayoutDashboard, FileSpreadsheet, ArrowLeftRight, Clock, Landmark } from 'lucide-vue-next';
import type { ActiveTab } from '../types';

defineProps<{
  activeTab: ActiveTab;
}>();

const emit = defineEmits<{
  (e: 'update:activeTab', tab: ActiveTab): void;
}>();

const tabs = [
  { id: 'reports', label: 'Laporan', icon: LayoutDashboard },
  { id: 'income_statement', label: 'Laba Rugi', icon: FileSpreadsheet },
  { id: 'cash_flow', label: 'Arus Kas', icon: ArrowLeftRight },
  { id: 'receivables', label: 'Piutang', icon: Clock },
  { id: 'inventory_asset', label: 'Aset Stok', icon: Landmark },
] as const;
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 z-40 explorer-tab-bar border-t border-[#b0aca5] shadow-lg pb-safe select-none">
    <!-- Desktop Explorer Tab Bar Container (Full Edge) -->
    <div class="flex items-end h-12 w-full px-0.5 pt-0.5 gap-0.5 overflow-x-auto no-scrollbar">
      <button
        v-for="t in tabs"
        :key="t.id"
        @click="emit('update:activeTab', t.id as ActiveTab)"
        class="flex flex-col items-center justify-center flex-1 min-w-[48px] h-full pt-1 pb-1 rounded-t transition-all cursor-pointer border-t border-l border-r"
        :class="activeTab === t.id
          ? 'bg-[#ecebe9] border-[#b0aca5] border-t-2 border-t-[#2563eb] text-[#2563eb] font-bold shadow-xs -mb-[1px] z-10'
          : 'bg-[#cac6c0] border-transparent text-[#6b655f] hover:bg-[#d0cdc7] hover:text-[#2e2b28]'"
      >
        <component :is="t.icon" class="w-3.5 h-3.5 mb-0.5 shrink-0" :class="activeTab === t.id ? 'text-[#2563eb]' : 'text-[#6b655f]'" />
        <span class="text-[9px] sm:text-[10px] leading-none tracking-tight truncate max-w-[56px]">
          {{ t.label }}
        </span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
