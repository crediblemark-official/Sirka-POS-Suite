<script setup lang="ts">
import { ref } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePosStore } from '../../stores/posStore';
import { useDiscountStore } from '../../stores/discountStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useSupplierStore } from '../../stores/supplierStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { useShiftStore } from '../../stores/shiftStore';
import type { ModuleTab } from './AppLauncherTab.vue';
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  FolderOpen,
  Search,
  X,
  RotateCw,
  ShoppingCart,
  Calendar,
  Tag,
  CreditCard,
  Users,
  FileSpreadsheet,
  Settings,
  LogIn,
  LogOut,
  Truck,
  Plus,
  Scale
} from 'lucide-vue-next';

const props = defineProps<{
  activeTab: ModuleTab;
  currentPath: string;
  searchPlaceholder: string;
  viewMode: 'icons' | 'list';
  searchQuery: string;
  showCartDrawer: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:viewMode', mode: 'icons' | 'list'): void;
  (e: 'update:searchQuery', q: string): void;
  (e: 'update:showCartDrawer', show: boolean): void;
  (e: 'open-tab', tab: ModuleTab): void;
}>();

const inventoryStore = useInventoryStore();
const posStore = usePosStore();
const discountStore = useDiscountStore();
const buyerStore = useBuyerStore();
const supplierStore = useSupplierStore();
const ledgerStore = useLedgerStore();
const preOrderStore = usePreOrderStore();
const shiftStore = useShiftStore();

function handleToggleProductSidebar() {
  if (!inventoryStore.showProductSidebar) {
    inventoryStore.activeProductForSidebar = null;
    inventoryStore.showProductSidebar = true;
  } else {
    inventoryStore.showProductSidebar = false;
  }
}

function handleTogglePreOrderSidebar() {
  if (!preOrderStore.showPreOrderSidebar) {
    preOrderStore.activeScheduleForSidebar = null;
    preOrderStore.showPreOrderSidebar = true;
  } else {
    preOrderStore.showPreOrderSidebar = false;
  }
}

const searchInputRef = ref<HTMLInputElement | null>(null);

function focusSearch() {
  searchInputRef.value?.focus();
  searchInputRef.value?.select();
}

function clearSearch() {
  emit('update:searchQuery', '');
  searchInputRef.value?.blur();
}

// BUG-016 FIX: Scan barcode saat kursor sedang di kotak pencarian.
const SCAN_GAP_MS = 80;
let lastSearchCharAt = 0;
let lastSearchInterval = 0;

function handleSearchKeydown(e: KeyboardEvent) {
  if (props.activeTab !== 'pos') return;
  const now = Date.now();
  if (e.key.length === 1) {
    lastSearchInterval = now - lastSearchCharAt;
    lastSearchCharAt = now;
    return;
  }
  if (e.key === 'Enter') {
    const query = props.searchQuery.trim();
    if (!query) return;
    // Deteksi scanner: karakter terakhir baru masuk < gap scanner
    if (lastSearchInterval > SCAN_GAP_MS) return;
    const prods = inventoryStore.products;
    const found =
      prods.find(p => (p.barcode || '').trim() === query) ||
      prods.find(p => p.code.trim().toUpperCase() === query.toUpperCase());
    if (found) {
      posStore.addProductToCart(found, 1);
      emit('update:searchQuery', '');
      emit('update:showCartDrawer', true);
    }
  }
}

defineExpose({
  focusSearch
});
</script>

<template>
  <!-- Toolbar Header: Full Cell Height (h-8.5 items-stretch), sama persis seperti tab bar -->
  <header class="explorer-header flex items-stretch h-8.5 border-b shadow-2xs transition-colors select-none text-xs">
    <!-- Back / Forward (File manager navigation) -->
    <div class="flex items-stretch shrink-0" style="color: var(--surface-text-muted);">
      <button
        class="h-full px-2.5 flex items-center justify-center hover:bg-black/5 active:bg-black/10 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        disabled
        title="Kembali (Alt+Left)"
      >
        <ChevronLeft :size="16" />
      </button>
      <button
        class="h-full px-2.5 flex items-center justify-center hover:bg-black/5 active:bg-black/10 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        disabled
        title="Maju (Alt+Right)"
      >
        <ChevronRight :size="16" />
      </button>
    </div>

    <!-- View Modes (Icons vs List) - Hanya di POS Catalog -->
    <div
      v-if="activeTab === 'pos'"
      class="flex items-stretch shrink-0 border-r"
      style="border-color: var(--surface-header-border, #c8c5c0);"
    >
      <button
        type="button"
        class="h-full px-2.5 flex items-center justify-center cursor-pointer transition-colors"
        :class="viewMode === 'icons' ? 'bg-white text-gray-900 font-semibold' : 'text-gray-500 hover:bg-black/5'"
        title="Icon Grid View"
        @click="emit('update:viewMode', 'icons')"
      >
        <LayoutGrid :size="14" />
      </button>
      <button
        type="button"
        class="h-full px-2.5 flex items-center justify-center cursor-pointer transition-colors"
        :class="viewMode === 'list' ? 'bg-white text-gray-900 font-semibold' : 'text-gray-500 hover:bg-black/5'"
        title="Compact List View"
        @click="emit('update:viewMode', 'list')"
      >
        <List :size="14" />
      </button>
    </div>

    <!-- Address / Path Bar (Full Cell: Breadcrumb di Kiri + Search di Kanan, Mengisi 100% Tinggi Header) -->
    <div
      class="flex-1 flex items-stretch h-full bg-white border-r min-w-0"
      style="background-color: var(--surface-card, #ffffff); border-color: var(--surface-header-border, #c8c5c0);"
    >
      <!-- Breadcrumb / Path di Kiri -->
      <div class="flex items-center gap-2 px-3 flex-1 min-w-0">
        <FolderOpen :size="15" class="text-[#c29858] shrink-0" />
        <span class="font-mono text-xs font-medium truncate flex-1" style="color: var(--surface-text);">
          {{ currentPath }}
        </span>
      </div>

      <!-- Search Input di Kanan (Shortcut F2) -->
      <div class="flex items-center gap-1.5 px-3 border-l border-gray-200 shrink-0 h-full bg-white">
        <Search :size="13" class="text-gray-400 shrink-0" />
        <input
          ref="searchInputRef"
          :value="searchQuery"
          @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          @keydown="handleSearchKeydown"
          type="text"
          :placeholder="searchPlaceholder"
          class="outline-none text-xs w-56 sm:w-72 md:w-80 bg-transparent placeholder-gray-400 focus:placeholder-gray-300 transition-all"
          style="color: var(--surface-text);"
        />
        <kbd class="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono text-[9px] border border-gray-200" title="Tekan F2 untuk cari langsung">
          F2
        </kbd>
        <button
          v-if="searchQuery"
          type="button"
          class="text-gray-400 hover:text-gray-600 cursor-pointer ml-0.5 p-0.5"
          title="Bersihkan pencarian (Esc)"
          @click="clearSearch"
        >
          <X :size="12" />
        </button>
      </div>
    </div>

    <!-- Right Action Tools (Full Cell: Setiap tombol membentang penuh 100% tinggi bar) -->
    <div class="flex items-stretch shrink-0" style="color: var(--surface-text-muted);">
      <!-- Reload Data PostgreSQL -->
      <button
        class="h-full px-2.5 flex items-center justify-center hover:bg-black/5 active:bg-black/10 cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        title="Reload Data dari PostgreSQL"
        @click="inventoryStore.fetchFromDb"
      >
        <RotateCw :size="15" />
      </button>

      <!-- Shift Kasir Status & Toggle Button -->
      <button
        v-if="shiftStore.isShiftActive"
        type="button"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        title="Shift Kasir Sedang Aktif • Klik untuk Tutup Shift & Rekonsiliasi Kas"
        @click="shiftStore.showCloseShiftModal = true"
      >
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>Shift: {{ shiftStore.currentShift?.cashierName }}</span>
        <LogOut :size="13" class="text-emerald-700 ml-0.5" />
      </button>

      <button
        v-else-if="activeTab === 'pos'"
        type="button"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r bg-amber-50 text-amber-900 hover:bg-amber-100"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        title="Shift Kasir Belum Dibuka • Klik untuk Buka Shift Baru"
        @click="shiftStore.showOpenShiftModal = true"
      >
        <LogIn :size="13" class="text-amber-700" />
        <span>Buka Shift</span>
      </button>

      <!-- 1. Menu Kasir (POS): Buka/Tutup Keranjang Struk Kasir (F3) -->
      <button
        v-if="activeTab === 'pos'"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="showCartDrawer ? 'text-white' : 'bg-white/70 text-gray-700 hover:bg-white'"
        :style="showCartDrawer ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Keranjang Belanja Kasir (F3)"
        @click="emit('update:showCartDrawer', !showCartDrawer)"
      >
        <ShoppingCart :size="14" />
        <span>Cart ({{ posStore.cartItems.length }})</span>
      </button>

      <!-- 2.5 Menu Pesanan (Pre-Order): Tambah Pesanan -->
      <button
        v-else-if="activeTab === 'preorder'"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="preOrderStore.showPreOrderSidebar ? 'text-white' : 'bg-white/70 text-gray-700 hover:bg-white'"
        :style="preOrderStore.showPreOrderSidebar ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Input Pesanan PO (Sidebar)"
        @click="handleTogglePreOrderSidebar"
      >
        <Calendar :size="14" />
        <span>Pesanan ({{ preOrderStore.schedules.length }})</span>
      </button>

      <!-- 3. Menu Diskon: Buka/Tutup Form Input Diskon -->
      <button
        v-else-if="activeTab === 'discounts'"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="discountStore.showFormSidebar ? 'text-white' : 'bg-white/70 text-gray-700 hover:bg-white'"
        :style="discountStore.showFormSidebar ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Input Diskon (Sidebar)"
        @click="discountStore.showFormSidebar = !discountStore.showFormSidebar"
      >
        <Tag :size="14" />
        <span>Diskon ({{ discountStore.discounts.length }})</span>
      </button>

      <!-- 4. Menu Member & Poin: Buka/Tutup Drawer Kartu Member & Poin -->
      <button
        v-else-if="activeTab === 'loyalty'"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="buyerStore.showMemberDrawer ? 'text-white' : 'bg-white/70 text-gray-700 hover:bg-white'"
        :style="buyerStore.showMemberDrawer ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Panel Member & Poin"
        @click="buyerStore.showMemberDrawer = !buyerStore.showMemberDrawer"
      >
        <CreditCard :size="14" />
        <span>Member</span>
      </button>

      <!-- 5. Menu Produk & Inventaris: Tombol Tunggal Buka Sidebar Terpadu -->
      <button
        v-else-if="activeTab === 'products' || activeTab === 'master'"
        type="button"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-bold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="inventoryStore.showProductSidebar ? 'text-white' : 'bg-white/70 text-gray-700 hover:bg-white'"
        :style="inventoryStore.showProductSidebar ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Kulakan & Tambah Barang (Sidebar Kanan)"
        @click="handleToggleProductSidebar"
      >
        <Plus :size="13" />
        <span>Kulakan & Barang ({{ inventoryStore.products.length }})</span>
      </button>

      <!-- 6. Menu Satuan & Kategori -->
      <button
        v-else-if="activeTab === 'vendors'"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="inventoryStore.showVendorSidebar ? 'text-white' : 'bg-white/70 text-gray-700 hover:bg-white'"
        :style="inventoryStore.showVendorSidebar ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Tambah Satuan & Kategori (Sidebar)"
        @click="inventoryStore.showVendorSidebar = !inventoryStore.showVendorSidebar"
      >
        <Scale :size="14" />
        <span>Satuan & Kategori</span>
      </button>

      <!-- Menu Supplier: Tambah Supplier -->
      <button
        v-else-if="activeTab === 'suppliers'"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="supplierStore.showSupplierDrawer ? 'text-white' : 'bg-white/70 text-gray-700 hover:bg-white'"
        :style="supplierStore.showSupplierDrawer ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Tambah Supplier (Sidebar)"
        @click="supplierStore.showSupplierDrawer = !supplierStore.showSupplierDrawer"
      >
        <Truck :size="14" />
        <span>Supplier ({{ supplierStore.suppliers.length }})</span>
      </button>

      <!-- 7. Menu Pelanggan: Tambah Pelanggan -->
      <button
        v-else-if="activeTab === 'buyers'"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="buyerStore.showBuyerSidebar ? 'text-white' : 'bg-white/70 text-gray-700 hover:bg-white'"
        :style="buyerStore.showBuyerSidebar ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Tambah Pelanggan (Sidebar)"
        @click="buyerStore.showBuyerSidebar = !buyerStore.showBuyerSidebar"
      >
        <Users :size="14" />
        <span>Pelanggan ({{ buyerStore.buyers.length }})</span>
      </button>

      <!-- 8. Menu Buku Kas: Unduh Laporan Excel -->
      <button
        v-else-if="activeTab === 'ledger'"
        class="h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        title="Unduh Laporan Excel (.xlsx)"
        @click="ledgerStore.exportToExcel"
      >
        <FileSpreadsheet :size="14" />
        <span>Excel</span>
      </button>

      <!-- Profil Toko & Pengaturan -->
      <button
        class="h-full px-2.5 flex items-center justify-center hover:bg-black/5 active:bg-black/10 cursor-pointer transition-colors"
        title="Profil Toko & Pengaturan"
        @click="emit('open-tab', 'branding')"
      >
        <Settings :size="15" />
      </button>
    </div>
  </header>
</template>
