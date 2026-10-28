<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
import type { ModuleTab } from '../explorer/AppLauncherTab.vue';
import {
  ShoppingCart,
  CalendarDays,
  UtensilsCrossed,
  Package,
  BookOpen,
  LayoutGrid,
  Layers,
  X,
  LayoutDashboard,
  Tag,
  CreditCard,
  Truck,
  Store,
  Scale,
  Users,
  FileSpreadsheet,
  Server
} from 'lucide-vue-next';


const props = withDefaults(
  defineProps<{
    activeTab: ModuleTab;
    openTabIds?: ModuleTab[];
  }>(),
  {
    openTabIds: () => []
  }
);

const emit = defineEmits<{
  (e: 'navigate', tabId: ModuleTab): void;
  (e: 'close-tab', tabId: ModuleTab, event: MouseEvent): void;
}>();

const posStore = usePosStore();
const settingsStore = useSettingsStore();
const ledgerStore = useLedgerStore();
const inventoryStore = useInventoryStore();
const preOrderStore = usePreOrderStore();

const isMenuOpen = ref(false);

const cartCount = computed(() => posStore.cartItems.reduce((acc: number, i: { qty: number }) => acc + i.qty, 0));

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

// Definisi 12 Modul Aplikasi Lengkap
const allModules = computed(() => [
  { id: 'home' as ModuleTab, title: 'Beranda', icon: LayoutDashboard, color: '#4f46e5' },
  { id: 'pos' as ModuleTab, title: 'Kasir', icon: ShoppingCart, color: '#2563eb' },
  { id: 'preorder' as ModuleTab, title: orderTabConfig.value.label, icon: orderTabConfig.value.icon, color: '#0d9488' },
  { id: 'products' as ModuleTab, title: inventoryLabel.value, icon: Package, color: '#7c3aed' },
  { id: 'ledger' as ModuleTab, title: 'Buku Kas', icon: BookOpen, color: '#0891b2' },
  { id: 'reports' as ModuleTab, title: 'Laporan', icon: FileSpreadsheet, color: '#16a34a' },
  { id: 'discounts' as ModuleTab, title: 'Diskon', icon: Tag, color: '#dc2626' },
  { id: 'loyalty' as ModuleTab, title: 'Member', icon: CreditCard, color: '#d97706' },
  { id: 'buyers' as ModuleTab, title: 'Pelanggan', icon: Users, color: '#0284c7' },
  { id: 'suppliers' as ModuleTab, title: 'Supplier', icon: Truck, color: '#db2777' },
  { id: 'vendors' as ModuleTab, title: 'Kategori', icon: Scale, color: '#ea580c' },
  { id: 'branding' as ModuleTab, title: 'Profil Toko', icon: Store, color: '#475569' },
  { id: 'server' as ModuleTab, title: 'Server', icon: Server, color: '#0284c7' }
]);


function getModuleInfo(tabId: ModuleTab) {
  const found = allModules.value.find((m: { id: ModuleTab }) => m.id === tabId);
  if (found) return found;
  return { id: tabId, title: tabId, icon: LayoutGrid, color: '#2563eb' };
}

function getTabBadge(tabId: ModuleTab): string | null {
  if (tabId === 'pos' && cartCount.value > 0) return `${cartCount.value}`;
  if (tabId === 'preorder' && preOrderStore.schedules.length > 0) return `${preOrderStore.schedules.length}`;
  if (tabId === 'ledger') {
    const tempo = ledgerStore.transactions.filter((t: { paymentStatus?: string }) => t.paymentStatus === 'TEMPO').length;
    if (tempo > 0) return `${tempo}`;
  }
  if ((tabId === 'products' || tabId === 'master') && inventoryStore.products.length > 0) {
    return `${inventoryStore.products.length}`;
  }
  return null;
}

// Daftar tab aktif yang sedang terbuka
const openTabsList = computed(() => {
  const list: { id: ModuleTab; title: string; icon: any; color: string; badge: string | null }[] = [];
  
  // Selalu sertakan Beranda ('home') di awal
  const homeInfo = getModuleInfo('home');
  list.push({ ...homeInfo, badge: null });

  for (const tid of props.openTabIds) {
    if (tid !== 'home') {
      const info = getModuleInfo(tid);
      list.push({ ...info, badge: getTabBadge(tid) });
    }
  }

  return list;
});

function handleTabClick(tabId: ModuleTab) {
  isMenuOpen.value = false;
  emit('navigate', tabId);
}

function handleCloseTab(tabId: ModuleTab, e: MouseEvent) {
  emit('close-tab', tabId, e);
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}
</script>

<template>
  <nav class="fixed bottom-0 inset-x-0 z-40 select-none">
    <!-- Backdrop Gelap Transparan saat Tab Menu Terbuka -->
    <div
      v-if="isMenuOpen"
      class="fixed inset-0 bg-black/40 backdrop-blur-2xs z-30 animate-in fade-in duration-150"
      @click="isMenuOpen = false"
    ></div>

    <!-- Sheet Menu Tab & Modul (Tepat Di Atas Bottom Nav Bar) -->
    <div
      v-if="isMenuOpen"
      class="relative z-40 bg-white rounded-t-2xl shadow-2xl border-t border-slate-200 max-h-[78vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
    >
      <!-- Header Sheet -->
      <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <div class="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
            <Layers class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-xs font-bold text-slate-800 leading-tight">Daftar Tab & Menu</h3>
            <p class="text-[10px] text-slate-500">Pilih tab yang sedang terbuka atau buka modul lain</p>
          </div>
        </div>
        <button
          type="button"
          @click="isMenuOpen = false"
          class="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Bagian 1: Tab yang Sedang Terbuka (Open Tabs Strip) -->
      <div class="p-3 border-b border-slate-100 bg-slate-50/50">
        <div class="flex items-center justify-between mb-2 px-1">
          <span class="text-[10.5px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <span>Tab Terbuka</span>
            <span class="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 font-mono text-[9.5px]">
              {{ openTabsList.length }}
            </span>
          </span>
          <span class="text-[10px] text-slate-400">Geser untuk melihat semua</span>
        </div>

        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <div
            v-for="t in openTabsList"
            :key="t.id"
            @click="handleTabClick(t.id)"
            class="flex items-center gap-2 px-3 py-2 rounded-xl border transition cursor-pointer shrink-0 select-none shadow-2xs group"
            :class="activeTab === t.id ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20 shadow-md' : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300'"
          >
            <component
              :is="t.icon"
              class="w-4 h-4 shrink-0"
              :class="activeTab === t.id ? 'text-white' : 'text-slate-500'"
            />
            <span class="text-xs font-semibold whitespace-nowrap">{{ t.title }}</span>
            <span
              v-if="t.badge"
              class="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full"
              :class="activeTab === t.id ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'"
            >
              {{ t.badge }}
            </span>
            <!-- Tombol Tutup Tab (✕) -->
            <button
              v-if="t.id !== 'home' && openTabsList.length > 1"
              type="button"
              class="ml-1 p-0.5 rounded-full hover:bg-black/15 transition cursor-pointer"
              :class="activeTab === t.id ? 'text-white hover:text-rose-200' : 'text-slate-400 hover:text-rose-600'"
              title="Tutup Tab"
              @click.stop="handleCloseTab(t.id, $event)"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Bagian 2: Semua Modul Aplikasi (Grid 4 Kolom) -->
      <div class="p-3.5 overflow-y-auto flex-1 max-h-[46vh]">
        <div class="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2 px-1">
          Semua Modul
        </div>
        <div class="grid grid-cols-4 gap-2 text-center">
          <button
            v-for="mod in allModules"
            :key="mod.id"
            type="button"
            @click="handleTabClick(mod.id)"
            class="flex flex-col items-center justify-center p-2 rounded-xl border transition cursor-pointer group active:scale-95"
            :class="activeTab === mod.id ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'"
          >
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center mb-1 shadow-2xs transition-transform group-hover:scale-105"
              :style="`background-color: ${mod.color}15; color: ${mod.color}`"
            >
              <component :is="mod.icon" class="w-4.5 h-4.5" />
            </div>
            <span class="text-[10.5px] font-medium text-slate-700 leading-tight group-hover:text-blue-600 line-clamp-1">
              {{ mod.title }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Bar Navigasi Bawah (Bottom Navigation Bar) -->
    <div class="relative z-40 bg-white border-t border-slate-200 shadow-xl pb-safe">
      <div class="flex items-center justify-around h-13 px-1">
        <!-- 1. KASIR -->
        <button
          @click="handleTabClick('pos')"
          class="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition cursor-pointer relative"
          :class="activeTab === 'pos' && !isMenuOpen ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'"
        >
          <div class="relative">
            <ShoppingCart class="w-5 h-5 mb-0.5" />
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
          @click="handleTabClick('preorder')"
          class="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition cursor-pointer"
          :class="activeTab === 'preorder' && !isMenuOpen ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'"
        >
          <component :is="orderTabConfig.icon" class="w-5 h-5 mb-0.5" />
          <span class="text-[10px] leading-tight tracking-tight">{{ orderTabConfig.label }}</span>
        </button>

        <!-- 3. INVENTARIS / MENU / LAYANAN -->
        <button
          @click="handleTabClick('products')"
          class="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition cursor-pointer"
          :class="(activeTab === 'products' || activeTab === 'master') && !isMenuOpen ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'"
        >
          <Package class="w-5 h-5 mb-0.5" />
          <span class="text-[10px] leading-tight tracking-tight">{{ inventoryLabel }}</span>
        </button>

        <!-- 4. BUKU KAS / TRANSAKSI -->
        <button
          @click="handleTabClick('ledger')"
          class="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition cursor-pointer"
          :class="activeTab === 'ledger' && !isMenuOpen ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800'"
        >
          <BookOpen class="w-5 h-5 mb-0.5" />
          <span class="text-[10px] leading-tight tracking-tight">Buku Kas</span>
        </button>

        <!-- 5. MENU / TAB (TOGGLE SHEET DI ATASNYA) -->
        <button
          @click="toggleMenu"
          class="flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition cursor-pointer relative"
          :class="isMenuOpen ? 'text-blue-600 font-bold bg-blue-50/60 rounded-xl' : (activeTab === 'launcher' ? 'text-blue-600 font-semibold' : 'text-slate-500 hover:text-slate-800')"
        >
          <LayoutGrid class="w-5 h-5 mb-0.5 transition-transform" :class="{ 'scale-110 text-blue-600': isMenuOpen }" />
          <span class="text-[10px] leading-tight tracking-tight">{{ isMenuOpen ? 'Tutup' : 'Menu' }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
