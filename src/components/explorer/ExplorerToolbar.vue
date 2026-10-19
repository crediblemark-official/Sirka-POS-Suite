<script setup lang="ts">
import { ref } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePosStore } from '../../stores/posStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { useDiscountStore } from '../../stores/discountStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
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
  PackagePlus,
  Calendar,
  Tag,
  CreditCard,
  Package,
  Percent,
  Users,
  FileSpreadsheet,
  Settings
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
const purchaseStore = usePurchaseStore();
const discountStore = useDiscountStore();
const buyerStore = useBuyerStore();
const ledgerStore = useLedgerStore();
const preOrderStore = usePreOrderStore();

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
// Scanner USB/HID mengetik cepat lalu Enter; jika teks persis sama dengan barcode/SKU
// suatu barang DAN tab aktif adalah Kasir, Enter memasukkan barang itu ke keranjang.
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
    // Deteksi scanner: karakter terakhir baru masuk < gap scanner (bukan ketikan manusia)
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
  <header class="explorer-header flex items-center gap-2 px-3 py-1.5 border-b shadow-xs transition-colors select-none text-xs">
    <!-- Back / Forward (File manager navigation) -->
    <div class="flex items-center gap-1" style="color: var(--surface-text-muted);">
      <button class="p-1 hover:bg-black/10 rounded cursor-pointer disabled:opacity-30" disabled>
        <ChevronLeft :size="17" />
      </button>
      <button class="p-1 hover:bg-black/10 rounded cursor-pointer disabled:opacity-30" disabled>
        <ChevronRight :size="17" />
      </button>
    </div>

    <!-- View Modes (Icons vs List) - Only functional in POS Catalog -->
    <div
      v-if="activeTab === 'pos'"
      class="flex items-center p-0.5 rounded border"
      style="background-color: var(--surface-tab-bar); border-color: var(--surface-tab-border);"
    >
      <button
        type="button"
        class="p-1 rounded cursor-pointer transition-colors"
        :class="viewMode === 'icons' ? 'bg-white shadow-xs text-[#2e2b28]' : 'hover:opacity-80'"
        :style="viewMode === 'icons' ? { backgroundColor: 'var(--surface-card)', color: 'var(--surface-text)' } : { color: 'var(--surface-text-muted)' }"
        title="Icon Grid View"
        @click="emit('update:viewMode', 'icons')"
      >
        <LayoutGrid :size="15" />
      </button>
      <button
        type="button"
        class="p-1 rounded cursor-pointer transition-colors"
        :class="viewMode === 'list' ? 'bg-white shadow-xs text-[#2e2b28]' : 'hover:opacity-80'"
        :style="viewMode === 'list' ? { backgroundColor: 'var(--surface-card)', color: 'var(--surface-text)' } : { color: 'var(--surface-text-muted)' }"
        title="Compact List View"
        @click="emit('update:viewMode', 'list')"
      >
        <List :size="15" />
      </button>
    </div>

    <!-- Address / Path Bar (Breadcrumb on Left + Search on Right) -->
    <div
      class="flex-1 flex items-center border rounded px-2.5 py-1 shadow-inner gap-2"
      style="background-color: var(--surface-card); border-color: var(--surface-border);"
    >
      <!-- Breadcrumb / Path on Left -->
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <FolderOpen :size="16" class="text-[#c29858] shrink-0" />
        <span class="font-mono text-xs font-medium truncate flex-1" style="color: var(--surface-text);">
          {{ currentPath }}
        </span>
      </div>

      <!-- Search Input on Right (Shortcut F2) -->
      <div class="flex items-center gap-1.5 pl-2.5 border-l border-gray-200 shrink-0">
        <Search :size="13" class="text-gray-400" />
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
          class="text-gray-400 hover:text-gray-600 cursor-pointer ml-0.5"
          title="Bersihkan pencarian (Esc)"
          @click="clearSearch"
        >
          <X :size="12" />
        </button>
      </div>
    </div>

    <!-- Right Action Tools -->
    <div class="flex items-center gap-1" style="color: var(--surface-text-muted);">
      <button
        class="p-1.5 hover:bg-black/10 rounded cursor-pointer"
        title="Reload Data dari PostgreSQL"
        @click="inventoryStore.fetchFromDb"
      >
        <RotateCw :size="16" />
      </button>

      <!-- 1. Menu Kasir (POS): Buka/Tutup Keranjang Struk Kasir (F3) -->
      <button
        v-if="activeTab === 'pos'"
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors shadow-2xs"
        :class="showCartDrawer ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
        :style="showCartDrawer ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Keranjang Belanja Kasir (F3)"
        @click="emit('update:showCartDrawer', !showCartDrawer)"
      >
        <ShoppingCart :size="14" />
        <span>Cart ({{ posStore.cartItems.length }})</span>
      </button>

      <!-- 2. Menu Kulakan (Receiving): Buka/Tutup Form Input Kulakan -->
      <button
        v-else-if="activeTab === 'receiving'"
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors shadow-2xs"
        :class="purchaseStore.showHistoryDrawer ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
        :style="purchaseStore.showHistoryDrawer ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Input Kulakan (Sidebar)"
        @click="purchaseStore.showHistoryDrawer = !purchaseStore.showHistoryDrawer"
      >
        <PackagePlus :size="14" />
        <span>Kulakan ({{ purchaseStore.receivingItems.length }})</span>
      </button>

      <!-- 2.5 Menu Pesanan (Pre-Order): Tambah Pesanan -->
      <button
        v-else-if="activeTab === 'preorder'"
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors shadow-2xs"
        :class="preOrderStore.showPreOrderSidebar ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
        :style="preOrderStore.showPreOrderSidebar ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Input Pesanan PO (Sidebar)"
        @click="handleTogglePreOrderSidebar"
      >
        <Calendar :size="14" />
        <span>Pesanan ({{ preOrderStore.schedules.length }})</span>
      </button>

      <!-- 3. Menu Diskon: Buka/Tutup Form Input Diskon -->
      <button
        v-else-if="activeTab === 'discounts'"
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors shadow-2xs"
        :class="discountStore.showFormSidebar ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
        :style="discountStore.showFormSidebar ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Input Diskon (Sidebar)"
        @click="discountStore.showFormSidebar = !discountStore.showFormSidebar"
      >
        <Tag :size="14" />
        <span>Diskon ({{ discountStore.discounts.length }})</span>
      </button>

      <!-- 4. Menu Member & Poin: Buka/Tutup Drawer Kartu Member & Poin -->
      <button
        v-else-if="activeTab === 'loyalty'"
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors shadow-2xs"
        :class="buyerStore.showMemberDrawer ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
        :style="buyerStore.showMemberDrawer ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Panel Member & Poin"
        @click="buyerStore.showMemberDrawer = !buyerStore.showMemberDrawer"
      >
        <CreditCard :size="14" />
        <span>Member</span>
      </button>

      <!-- 5. Menu Produk: Tambah Barang -->
      <button
        v-else-if="activeTab === 'products' || activeTab === 'master'"
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors shadow-2xs"
        :class="inventoryStore.showProductSidebar ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
        :style="inventoryStore.showProductSidebar ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Input Barang (Sidebar)"
        @click="inventoryStore.showProductSidebar = !inventoryStore.showProductSidebar"
      >
        <Package :size="14" />
        <span>Barang ({{ inventoryStore.products.length }})</span>
      </button>

      <!-- 6. Menu Supplier: Tambah Supplier -->
      <button
        v-else-if="activeTab === 'vendors'"
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors shadow-2xs"
        :class="inventoryStore.showVendorSidebar ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
        :style="inventoryStore.showVendorSidebar ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Tambah Supplier (Sidebar)"
        @click="inventoryStore.showVendorSidebar = !inventoryStore.showVendorSidebar"
      >
        <Percent :size="14" />
        <span>Supplier ({{ inventoryStore.categoryMarkups.length }})</span>
      </button>

      <!-- 7. Menu Pelanggan: Tambah Pelanggan -->
      <button
        v-else-if="activeTab === 'buyers'"
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors shadow-2xs"
        :class="buyerStore.showBuyerSidebar ? 'text-white' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
        :style="buyerStore.showBuyerSidebar ? { backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' } : {}"
        title="Buka / Tutup Form Tambah Pelanggan (Sidebar)"
        @click="buyerStore.showBuyerSidebar = !buyerStore.showBuyerSidebar"
      >
        <Users :size="14" />
        <span>Pelanggan ({{ buyerStore.buyers.length }})</span>
      </button>

      <!-- 8. Menu Buku Kas: Unduh Laporan Excel -->
      <button
        v-else-if="activeTab === 'ledger'"
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors shadow-2xs bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border-emerald-600"
        title="Unduh Laporan Excel (.xlsx)"
        @click="ledgerStore.exportToExcel"
      >
        <FileSpreadsheet :size="14" />
        <span>Excel</span>
      </button>

      <button
        class="p-1.5 hover:bg-[#d0cdc8] rounded cursor-pointer"
        title="Profil Toko & Pengaturan"
        @click="emit('open-tab', 'branding')"
      >
        <Settings :size="16" />
      </button>
    </div>
  </header>
</template>
