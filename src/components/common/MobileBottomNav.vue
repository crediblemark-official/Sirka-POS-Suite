<script setup lang="ts">
import { computed } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { ModuleTab } from '../explorer/AppLauncherTab.vue';
import {
  ShoppingCart,
  CalendarDays,
  UtensilsCrossed,
  Package,
  BookOpen,
  LayoutGrid
} from 'lucide-vue-next';

const props = defineProps<{
  activeTab: ModuleTab;
}>();

const emit = defineEmits<{
  (e: 'navigate', tabId: ModuleTab): void;
}>();

const posStore = usePosStore();
const settingsStore = useSettingsStore();

const cartCount = computed(() => posStore.cartItems.reduce((acc, i) => acc + i.qty, 0));

// Label dan icon dinamis berdasarkan jenis bisnis
const orderTabConfig = computed(() => {
  if (settingsStore.isFnb) {
    return { label: 'Meja & PO', icon: UtensilsCrossed };
  }
  return { label: 'Pesanan', icon: CalendarDays };
});

const inventoryLabel = computed(() => {
  if (settingsStore.isFnb) return 'Menu';
  if (settingsStore.isService) return 'Layanan';
  return 'Barang';
});
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-xl pb-safe select-none">
    <div class="flex items-center justify-around h-13 px-1">
      <!-- 1. KASIR -->
      <button
        @click="emit('navigate', 'pos')"
        class="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition cursor-pointer relative"
        :class="activeTab === 'pos' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'"
      >
        <div class="relative">
          <ShoppingCart class="w-5 h-5 mb-0.5" />
          <!-- Cart Badge -->
          <span
            v-if="cartCount > 0"
            class="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-xs animate-scale-in"
          >
            {{ cartCount }}
          </span>
        </div>
        <span class="text-[10px] leading-tight tracking-tight">Kasir</span>
      </button>

      <!-- 2. PESANAN / MEJA -->
      <button
        @click="emit('navigate', 'preorder')"
        class="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition cursor-pointer"
        :class="activeTab === 'preorder' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'"
      >
        <component :is="orderTabConfig.icon" class="w-5 h-5 mb-0.5" />
        <span class="text-[10px] leading-tight tracking-tight">{{ orderTabConfig.label }}</span>
      </button>

      <!-- 3. INVENTARIS / MENU / LAYANAN -->
      <button
        @click="emit('navigate', 'products')"
        class="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition cursor-pointer"
        :class="activeTab === 'products' || activeTab === 'master' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'"
      >
        <Package class="w-5 h-5 mb-0.5" />
        <span class="text-[10px] leading-tight tracking-tight">{{ inventoryLabel }}</span>
      </button>

      <!-- 4. BUKU KAS / TRANSAKSI -->
      <button
        @click="emit('navigate', 'ledger')"
        class="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition cursor-pointer"
        :class="activeTab === 'ledger' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'"
      >
        <BookOpen class="w-5 h-5 mb-0.5" />
        <span class="text-[10px] leading-tight tracking-tight">Buku Kas</span>
      </button>

      <!-- 5. MENU LENGKAP (LAUNCHER) -->
      <button
        @click="emit('navigate', 'launcher')"
        class="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition cursor-pointer"
        :class="activeTab === 'launcher' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'"
      >
        <LayoutGrid class="w-5 h-5 mb-0.5" />
        <span class="text-[10px] leading-tight tracking-tight">Menu</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
