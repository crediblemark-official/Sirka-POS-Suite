<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useSupplierStore } from '../../stores/supplierStore';
import { useDiscountStore } from '../../stores/discountStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
import type { ModuleTab } from '../explorer/AppLauncherTab.vue';
import {
  Search,
  X,
  Clock,
  Package,
  Users,
  Truck,
  TicketPercent,
  CreditCard,
  Calendar,
  FileText,
  BarChart3,
  Layers,
  Store,
  LayoutGrid
} from 'lucide-vue-next';

const props = withDefaults(defineProps<{
  activeTab?: ModuleTab;
  activeTabTitle?: string;
  searchQuery: string;
}>(), {
  activeTab: 'pos',
  activeTabTitle: 'Kasir'
});

const emit = defineEmits<{
  (e: 'update:searchQuery', val: string): void;
  (e: 'open-shift-modal'): void;
}>();

const settingsStore = useSettingsStore();
const shiftStore = useShiftStore();
const inventoryStore = useInventoryStore();
const buyerStore = useBuyerStore();
const supplierStore = useSupplierStore();
const discountStore = useDiscountStore();
const preOrderStore = usePreOrderStore();

const isSearchOpen = ref(false);

function toggleSearch() {
  isSearchOpen.value = !isSearchOpen.value;
  if (!isSearchOpen.value) {
    emit('update:searchQuery', '');
  }
}

const currentModuleConfig = computed(() => {
  switch (props.activeTab) {
    case 'products':
    case 'master':
      return {
        title: 'Katalog Barang (SKU)',
        badge: `${inventoryStore.products.length} SKU`,
        icon: Package,
        iconBg: 'bg-purple-500/20 text-purple-300 border border-purple-400/30',
        badgeClass: 'bg-purple-900/60 text-purple-200 border-purple-700/60'
      };
    case 'buyers':
      return {
        title: 'Data Pelanggan & Mitra',
        badge: `${buyerStore.buyers.length}`,
        icon: Users,
        iconBg: 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30',
        badgeClass: 'bg-indigo-900/60 text-indigo-200 border-indigo-700/60'
      };
    case 'suppliers':
      return {
        title: 'Mitra Supplier Kulakan',
        badge: `${supplierStore.suppliers.length} Mitra`,
        icon: Truck,
        iconBg: 'bg-rose-500/20 text-rose-300 border border-rose-400/30',
        badgeClass: 'bg-rose-900/60 text-rose-200 border-rose-700/60'
      };
    case 'discounts':
      return {
        title: 'Kupon Promo & Diskon',
        badge: `${discountStore.discounts.length} Kupon`,
        icon: TicketPercent,
        iconBg: 'bg-rose-500/20 text-rose-300 border border-rose-400/30',
        badgeClass: 'bg-rose-900/60 text-rose-200 border-rose-700/60'
      };
    case 'loyalty':
      return {
        title: 'Member Loyalty & Poin',
        badge: `${buyerStore.memberBuyers.length} Member`,
        icon: CreditCard,
        iconBg: 'bg-amber-500/20 text-amber-300 border border-amber-400/30',
        badgeClass: 'bg-amber-900/60 text-amber-200 border-amber-700/60'
      };
    case 'preorder':
      return {
        title: 'Jadwal Pesanan & PO',
        badge: `${preOrderStore.schedules.length} PO`,
        icon: Calendar,
        iconBg: 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30',
        badgeClass: 'bg-emerald-900/60 text-emerald-200 border-emerald-700/60'
      };
    case 'ledger':
    case 'returns':
      return {
        title: 'Buku Kas & Transaksi',
        badge: '',
        icon: FileText,
        iconBg: 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30',
        badgeClass: 'bg-indigo-900/60 text-indigo-200 border-indigo-700/60'
      };
    case 'reports':
      return {
        title: 'Laporan Keuangan',
        badge: '',
        icon: BarChart3,
        iconBg: 'bg-teal-500/20 text-teal-300 border border-teal-400/30',
        badgeClass: 'bg-teal-900/60 text-teal-200 border-teal-700/60'
      };
    case 'vendors':
      return {
        title: 'Kategori & Satuan Barang',
        badge: '',
        icon: Layers,
        iconBg: 'bg-purple-500/20 text-purple-300 border border-purple-400/30',
        badgeClass: 'bg-purple-900/60 text-purple-200 border-purple-700/60'
      };
    case 'branding':
      return {
        title: 'Profil Toko & Branding',
        badge: '',
        icon: Store,
        iconBg: 'bg-slate-500/20 text-slate-300 border border-slate-400/30',
        badgeClass: 'bg-slate-800 text-slate-200 border-slate-700'
      };
    case 'launcher':
      return {
        title: 'Menu Navigasi',
        badge: '',
        icon: LayoutGrid,
        iconBg: 'bg-slate-500/20 text-slate-300 border border-slate-400/30',
        badgeClass: 'bg-slate-800 text-slate-200 border-slate-700'
      };
    default:
      return null;
  }
});
</script>

<template>
  <header class="bg-[#1e293b] text-white border-b border-slate-700 shadow-md select-none shrink-0 z-30 pt-safe">
    <!-- Main Top Bar -->
    <div class="h-12 px-3 flex items-center justify-between gap-2">
      <!-- Left: Logo & Store Info (Saat di POS / Kasir / Home) -->
      <div v-if="!currentModuleConfig" class="flex items-center gap-2 min-w-0">
        <img
          :src="settingsStore.storeLogo || '/logo.png'"
          alt="Logo"
          class="w-7 h-7 rounded object-contain bg-white/10 p-0.5 shrink-0"
        />
        <div class="flex items-center gap-1.5 leading-tight min-w-0">
          <span class="font-bold text-sm text-slate-100 truncate max-w-[120px] sm:max-w-[160px]">
            {{ settingsStore.storeName }}
          </span>
          <!-- Business Type Badge -->
          <span
            class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 uppercase tracking-wider"
            :class="settingsStore.currentBusinessConfig.badgeColor"
          >
            {{ settingsStore.currentBusinessConfig.title.split(' ')[0] }}
          </span>
        </div>
      </div>

      <!-- Left: Module Header (Saat di Tab Modul: Katalog Barang, Pelanggan, Supplier, Diskon, Member, PO, dll.) -->
      <div v-else class="flex items-center gap-2 min-w-0">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs" :class="currentModuleConfig.iconBg">
          <component :is="currentModuleConfig.icon" :size="15" />
        </div>
        <div class="flex items-center gap-1.5 leading-tight min-w-0">
          <span class="font-bold text-sm text-slate-100 truncate">
            {{ currentModuleConfig.title }}
          </span>
          <span
            v-if="currentModuleConfig.badge"
            class="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full border shrink-0"
            :class="currentModuleConfig.badgeClass"
          >
            {{ currentModuleConfig.badge }}
          </span>
        </div>
      </div>

      <!-- Right: Shift Status & Search Action -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Shift Status Pill -->
        <button
          @click="emit('open-shift-modal')"
          class="flex items-center gap-1 px-2 py-1 rounded text-xs transition cursor-pointer"
          :class="shiftStore.isShiftActive
            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
            : 'bg-rose-950/80 text-rose-300 border border-rose-800/80'"
        >
          <Clock class="w-3.5 h-3.5 shrink-0" />
          <span class="text-[10px] font-medium hidden xs:inline">
            {{ shiftStore.isShiftActive ? 'Shift Buka' : 'Shift Tutup' }}
          </span>
        </button>

        <!-- Search Icon Toggle Button -->
        <button
          @click="toggleSearch"
          class="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
          :aria-label="isSearchOpen ? 'Tutup Pencarian' : 'Buka Pencarian'"
        >
          <X v-if="isSearchOpen" class="w-4 h-4 text-rose-400" />
          <Search v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Expandable Search Input Row (Smooth Mobile Slide) -->
    <div
      v-if="isSearchOpen"
      class="px-3 pb-2.5 pt-0.5 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2 animate-fade-in"
    >
      <div class="relative flex-1">
        <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          :value="searchQuery"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="Cari produk, SKU, nota, pelanggan..."
          class="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-800 text-white rounded border border-slate-700 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
          autofocus
        />
        <button
          v-if="searchQuery"
          @click="$emit('update:searchQuery', '')"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
</style>
