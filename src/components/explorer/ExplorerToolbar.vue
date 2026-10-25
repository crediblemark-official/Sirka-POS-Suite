<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePosStore } from '../../stores/posStore';
import { useDiscountStore } from '../../stores/discountStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useSupplierStore } from '../../stores/supplierStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useLicenseStore } from '../../stores/licenseStore';
import type { ModuleTab } from './AppLauncherTab.vue';
import {
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
  Scale,
  Home,
  Lock
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
  (e: 'open-launcher'): void;
  (e: 'search-navigate', direction: 'right' | 'left' | 'down' | 'up'): void;
  (e: 'search-submit'): void;
}>();

const inventoryStore = useInventoryStore();
const posStore = usePosStore();
const discountStore = useDiscountStore();
const buyerStore = useBuyerStore();
const supplierStore = useSupplierStore();
const ledgerStore = useLedgerStore();
const preOrderStore = usePreOrderStore();
const shiftStore = useShiftStore();
const licenseStore = useLicenseStore();

function handleOpenLauncher() {
  if (!licenseStore.isLicensed) {
    licenseStore.openLicenseModal('Fitur terkunci. Harap aktivasi lisensi.');
    return;
  }
  emit('open-launcher');
}

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
const isSearchHovered = ref(false);
const isSearchFocused = ref(false);
const isSearchForced = ref(false);
const idleShowSearch = ref(false);

// Animasi berganti berkala antara Breadcrumb dan Search saat idle (setiap 4.5 detik)
let idleSwapTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  idleSwapTimer = setInterval(() => {
    // Hanya berganti jika tidak sedang di-hover, tidak fokus, dan tidak ada teks pencarian
    if (!isSearchHovered.value && !isSearchFocused.value && !isSearchForced.value && !props.searchQuery) {
      idleShowSearch.value = !idleShowSearch.value;
    }
  }, 4500);
});

onUnmounted(() => {
  if (idleSwapTimer) clearInterval(idleSwapTimer);
});

const isSearchMode = computed(() => {
  if (isSearchHovered.value || isSearchFocused.value || isSearchForced.value || Boolean(props.searchQuery)) {
    return true;
  }
  return idleShowSearch.value;
});

async function focusSearch() {
  isSearchForced.value = true;
  await nextTick();
  searchInputRef.value?.focus();
  searchInputRef.value?.select();
}

function handleSearchFocus() {
  isSearchFocused.value = true;
}

function handleSearchBlur() {
  isSearchFocused.value = false;
  isSearchForced.value = false;
}

function clearSearch() {
  emit('update:searchQuery', '');
  isSearchFocused.value = false;
  isSearchForced.value = false;
  searchInputRef.value?.blur();
}

// BUG-016 FIX: Scan barcode saat kursor sedang di kotak pencarian.
const SCAN_GAP_MS = 80;
// BUG FIX: nilai awal 0 membuat selisih karakter pertama sangat besar
// (> SCAN_GAP_MS) sehingga barcode 1 karakter tidak pernah dikenali.
let lastSearchCharAt = Date.now();
let lastSearchInterval = 0;

function handleSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    clearSearch();
    return;
  }
  if (props.activeTab !== 'pos') return;

  // Navigasi cepat produk 4 arah (Kanan, Kiri, Bawah, Atas) saat di kotak pencarian
  if (!e.shiftKey) {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      emit('search-navigate', 'right');
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      emit('search-navigate', 'left');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      emit('search-navigate', 'down');
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      emit('search-navigate', 'up');
      return;
    }
  }

  const now = Date.now();
  if (e.key.length === 1 && e.key !== ' ') {
    lastSearchInterval = now - lastSearchCharAt;
    lastSearchCharAt = now;
    return;
  }
  if (e.key === 'Enter') {
    const query = props.searchQuery.trim();
    if (!query) return;

    // Deteksi scanner: karakter terakhir baru masuk < gap scanner
    if (lastSearchInterval <= SCAN_GAP_MS) {
      const prods = inventoryStore.products;
      // BUG FIX: barcode SATUAN KEMASAN (product.units[].barcode) ikut
      // dicari. Sebelumnya hanya barcode produk & SKU yang dicari sehingga
      // barcode DUS yang valid di katalog kasir diabaikan di kotak pencarian.
      let found = prods.find(p => (p.barcode || '').trim() === query);
      let foundUnit: string | undefined;
      if (!found) {
        for (const p of prods) {
          const unit = (p.units || []).find(u => (u.barcode || '').trim() === query);
          if (unit) {
            found = p;
            foundUnit = unit.unitName;
            break;
          }
        }
      }
      if (!found) {
        found = prods.find(p => (p.code || '').trim().toUpperCase() === query.toUpperCase());
      }
      if (found) {
        // Barcode satuan kemasan -> masukkan keranjang memakai satuan tersebut
        if (foundUnit) {
          posStore.addProductToCart(found, 1, foundUnit);
        } else {
          posStore.addProductToCart(found, 1);
        }
        emit('update:searchQuery', '');
        emit('update:showCartDrawer', true);
        return;
      }
    }

    // Ketikan manual kasir (Enter = masukkan produk yang sedang terpilih ke keranjang)
    e.preventDefault();
    emit('search-submit');
  }
}

defineExpose({
  focusSearch
});
</script>

<template>
  <!-- Toolbar Header: Full Cell Height (h-8.5 items-stretch), sama persis seperti tab bar -->
  <header class="explorer-header flex items-stretch h-8.5 border-b shadow-2xs transition-colors select-none text-xs">
    <!-- Home & Add New Tab Navigation -->
    <div class="flex items-stretch shrink-0" style="color: var(--surface-text-muted);">
      <button
        type="button"
        class="h-full px-2.5 flex items-center justify-center hover:bg-black/5 active:bg-black/10 cursor-pointer transition-colors"
        :class="activeTab === 'home' ? 'text-blue-600 bg-black/5 font-bold' : ''"
        title="Beranda & Insight Bisnis (Home)"
        @click="emit('open-tab', 'home')"
      >
        <Home :size="15" />
      </button>
      <button
        type="button"
        class="h-full px-2.5 flex items-center justify-center hover:bg-black/5 active:bg-black/10 cursor-pointer transition-colors border-r"
        :class="[
          activeTab === 'launcher' ? 'text-blue-600 bg-black/5 font-bold' : '',
          !licenseStore.isLicensed ? 'text-amber-600 hover:text-amber-700' : ''
        ]"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :title="licenseStore.isLicensed ? 'Buka Menu Baru (+)' : 'Fitur Terkunci (+)'"
        @click="handleOpenLauncher"
      >
        <div v-if="!licenseStore.isLicensed" class="relative flex items-center justify-center">
          <Plus :size="15" class="opacity-40" />
          <Lock :size="10" class="absolute -bottom-1 -right-1 text-amber-600" />
        </div>
        <Plus v-else :size="15" />
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
        class="toolbar-toggle-btn h-full px-2.5 flex items-center justify-center cursor-pointer transition-colors"
        :class="viewMode === 'icons' ? 'active bg-white text-gray-900 font-semibold shadow-2xs' : 'inactive text-gray-500 hover:bg-black/5'"
        title="Icon Grid View"
        @click="emit('update:viewMode', 'icons')"
      >
        <LayoutGrid :size="14" />
      </button>
      <button
        type="button"
        class="toolbar-toggle-btn h-full px-2.5 flex items-center justify-center cursor-pointer transition-colors"
        :class="viewMode === 'list' ? 'active bg-white text-gray-900 font-semibold shadow-2xs' : 'inactive text-gray-500 hover:bg-black/5'"
        title="Compact List View"
        @click="emit('update:viewMode', 'list')"
      >
        <List :size="14" />
      </button>
    </div>

    <!-- Address / Path Bar (Unified: Breadcrumb <-> Search, Mengisi 100% Tinggi Header) -->
    <div
      class="flex-1 flex items-stretch h-full bg-white border-r min-w-0 relative group/address cursor-pointer transition-colors overflow-hidden"
      style="background-color: var(--surface-card, #ffffff); border-color: var(--surface-header-border, #c8c5c0);"
      @mouseenter="isSearchHovered = true"
      @mouseleave="isSearchHovered = false"
      @click="focusSearch"
    >
      <Transition name="toolbar-swap" mode="out-in">
        <!-- Mode 1: Search Active (Ketika di-hover, input fokus, shortcut F3, atau sedang ada teks pencarian / fase rotasi) -->
        <div
          v-if="isSearchMode"
          key="search"
          class="flex items-center gap-2 px-3 w-full h-full"
        >
          <Search :size="13" class="text-indigo-600 shrink-0" />
          <input
            ref="searchInputRef"
            :value="searchQuery"
            @input="emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
            @keydown="handleSearchKeydown"
            @focus="handleSearchFocus"
            @blur="handleSearchBlur"
            type="text"
            :placeholder="searchPlaceholder"
            class="outline-none text-xs w-full bg-transparent placeholder-gray-400 focus:placeholder-gray-300 font-sans"
            style="color: var(--surface-text);"
          />
          <kbd class="address-kbd px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono text-[9px] border border-gray-200 shrink-0 select-none" title="Tekan F3 untuk cari langsung">
            F3
          </kbd>
          <button
            v-if="searchQuery"
            type="button"
            class="text-gray-400 hover:text-gray-600 cursor-pointer p-0.5 shrink-0"
            title="Bersihkan pencarian (Esc)"
            @click.stop="clearSearch"
          >
            <X :size="12" />
          </button>
        </div>

        <!-- Mode 2: Breadcrumb / Path (Ketika tidak di-hover dan sedang di fase rotasi breadcrumb) -->
        <div
          v-else
          key="breadcrumb"
          class="flex items-center justify-between gap-2 px-3 w-full h-full select-none"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <FolderOpen :size="15" class="text-[#c29858] shrink-0" />
            <span class="font-mono text-xs font-medium truncate flex-1" style="color: var(--surface-text);">
              {{ currentPath }}
            </span>
          </div>
          <div class="flex items-center gap-1.5 text-gray-400 shrink-0 opacity-60 group-hover/address:opacity-100 transition-opacity">
            <Search :size="12" />
            <kbd class="address-kbd px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono text-[9px] border border-gray-200" title="Arahkan kursor atau tekan F3 untuk mencari">
              F3
            </kbd>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Right Action Tools (Full Cell: Setiap tombol membentang penuh 100% tinggi bar) -->
    <div class="flex items-stretch shrink-0" style="color: var(--surface-text-muted);">
      <!-- Reload Data PostgreSQL -->
      <button
        class="h-full px-2.5 flex items-center justify-center hover:bg-black/5 active:bg-black/10 cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        title="Muat Ulang Data dari Cloud"
        @click="inventoryStore.fetchFromDb"
      >
        <RotateCw :size="15" />
      </button>

      <!-- Shift Kasir Status & Toggle Button -->
      <button
        v-if="shiftStore.isShiftActive"
        type="button"
        class="btn-shift-active h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
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
        class="btn-shift-open h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r bg-amber-50 text-amber-900 hover:bg-amber-100"
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
        class="toolbar-drawer-btn h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="showCartDrawer ? 'active text-white' : 'inactive bg-white/70 text-gray-700 hover:bg-white'"
        :style="showCartDrawer ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Keranjang Belanja Kasir"
        @click="emit('update:showCartDrawer', !showCartDrawer)"
      >
        <ShoppingCart :size="14" />
        <span>Cart ({{ posStore.cartItems.length }})</span>
      </button>

      <!-- 2.5 Menu Pesanan (Pre-Order): Tambah Pesanan -->
      <button
        v-else-if="activeTab === 'preorder'"
        class="toolbar-drawer-btn h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="preOrderStore.showPreOrderSidebar ? 'active text-white' : 'inactive bg-white/70 text-gray-700 hover:bg-white'"
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
        class="toolbar-drawer-btn h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="discountStore.showFormSidebar ? 'active text-white' : 'inactive bg-white/70 text-gray-700 hover:bg-white'"
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
        class="toolbar-drawer-btn h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="buyerStore.showMemberDrawer ? 'active text-white' : 'inactive bg-white/70 text-gray-700 hover:bg-white'"
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
        class="toolbar-drawer-btn h-full flex items-center gap-1.5 px-3 text-xs font-bold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="inventoryStore.showProductSidebar ? 'active text-white' : 'inactive bg-white/70 text-gray-700 hover:bg-white'"
        :style="inventoryStore.showProductSidebar ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Kulakan & Tambah Barang (Sidebar Kanan)"
        @click="handleToggleProductSidebar"
      >
        <Plus :size="13" />
        <span>Kulakan ({{ inventoryStore.products.length }})</span>
      </button>

      <!-- 6. Menu Kategori -->
      <button
        v-else-if="activeTab === 'vendors'"
        class="toolbar-drawer-btn h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="inventoryStore.showVendorSidebar ? 'active text-white' : 'inactive bg-white/70 text-gray-700 hover:bg-white'"
        :style="inventoryStore.showVendorSidebar ? { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Tambah Satuan & Kategori (Sidebar)"
        @click="inventoryStore.showVendorSidebar = !inventoryStore.showVendorSidebar"
      >
        <Scale :size="14" />
        <span>Kategori</span>
      </button>

      <!-- Menu Supplier: Tambah Supplier -->
      <button
        v-else-if="activeTab === 'suppliers'"
        class="toolbar-drawer-btn h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="supplierStore.showSupplierDrawer ? 'active text-white' : 'inactive bg-white/70 text-gray-700 hover:bg-white'"
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
        class="toolbar-drawer-btn h-full flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer transition-colors border-r"
        style="border-color: var(--surface-header-border, #c8c5c0);"
        :class="buyerStore.showBuyerSidebar ? 'active text-white' : 'inactive bg-white/70 text-gray-700 hover:bg-white'"
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

<style scoped>
.toolbar-swap-enter-active,
.toolbar-swap-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.toolbar-swap-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.toolbar-swap-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
