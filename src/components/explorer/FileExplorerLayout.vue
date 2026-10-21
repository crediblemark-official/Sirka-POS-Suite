<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { SupplierCategory } from '../../types';
import type { ModuleTab } from './AppLauncherTab.vue';

// Modular Layout Components
import AppTitleBar from '../common/AppTitleBar.vue';
import ExplorerToolbar from './ExplorerToolbar.vue';
import ExplorerTabBar from './ExplorerTabBar.vue';
import ExplorerStatusBar from './ExplorerStatusBar.vue';
import AppLauncherTab from './AppLauncherTab.vue';

// View Modules
import ProductCatalog from '../pos/ProductCatalog.vue';
import PosCart from '../pos/PosCart.vue';
import PreOrderMatrix from '../preorder/PreOrderMatrix.vue';
import LedgerView from '../ledger/LedgerView.vue';
import FinancialReportsView from '../reports/FinancialReportsView.vue';
import MasterProducts from '../master/MasterProducts.vue';
import MasterVendorTab from '../master/MasterVendorTab.vue';
import MasterSupplierTab from '../master/MasterSupplierTab.vue';
import MasterBuyerTab from '../master/MasterBuyerTab.vue';
import MasterBrandingTab from '../master/MasterBrandingTab.vue';
import MasterDiscountTab from '../master/MasterDiscountTab.vue';
import MasterMemberTab from '../master/MasterMemberTab.vue';
import ReceiptModal from '../pos/ReceiptModal.vue';
import AppConfirmModal from '../common/AppConfirmModal.vue';
import OpenShiftModal from '../pos/OpenShiftModal.vue';
import CloseShiftModal from '../pos/CloseShiftModal.vue';
import ShiftSummaryModal from '../pos/ShiftSummaryModal.vue';
import WasteModal from '../returns/WasteModal.vue';
import { useShiftStore } from '../../stores/shiftStore';

const posStore = usePosStore();
const shiftStore = useShiftStore();

// Open tabs initialized with Kasir POS & Pusat Inventaris by default, and persisted in localStorage
const savedOpenTabs = localStorage.getItem('kasir_citra_open_tabs_v1');
const rawInitialTabs: ModuleTab[] = savedOpenTabs ? JSON.parse(savedOpenTabs) : ['pos', 'products'];
// Map old merged tabs ('receiving' -> 'products', 'returns' -> 'ledger')
const normalizedTabs = rawInitialTabs.map(t => (t === 'receiving' ? 'products' : (t === 'returns' ? 'ledger' : t)));
const openTabIds = ref<ModuleTab[]>([...new Set(normalizedTabs)]);

const savedActiveTab = localStorage.getItem('kasir_citra_active_tab_v1') as ModuleTab | null;
const initialActive = savedActiveTab === 'receiving' ? 'products' : (savedActiveTab === 'returns' ? 'ledger' : (savedActiveTab || 'products'));
const activeTab = ref<ModuleTab>(initialActive);

watch(activeTab, (val) => {
  localStorage.setItem('kasir_citra_active_tab_v1', val);
});

watch(openTabIds, (val) => {
  localStorage.setItem('kasir_citra_open_tabs_v1', JSON.stringify(val));
}, { deep: true });

function closeTab(tabId: ModuleTab, e?: MouseEvent) {
  if (e) e.stopPropagation();
  const idx = openTabIds.value.indexOf(tabId);
  if (idx !== -1) {
    openTabIds.value.splice(idx, 1);
  }
  // If the active tab was closed, switch to another tab or to launcher
  if (activeTab.value === tabId) {
    if (openTabIds.value.length > 0) {
      activeTab.value = openTabIds.value[Math.max(0, idx - 1)];
    } else {
      activeTab.value = 'launcher';
    }
  }
}

const tabTitles: Record<ModuleTab, string> = {
  pos: 'Kasir & Penjualan',
  receiving: 'Kulakan & Barang Masuk',
  products: 'Pusat Inventaris & Audit Stok',
  vendors: 'Satuan & Kategori',
  suppliers: 'Mitra Supplier (Pemasok)',
  buyers: 'Data Pelanggan & Mitra',
  discounts: 'Diskon & Kupon Promo',
  loyalty: 'Member & Poin Belanja',
  preorder: 'Rekap Pesanan Mingguan',
  ledger: 'Buku Kas & Piutang',
  reports: 'Pusat Laporan Keuangan',
  returns: 'Buku Kas & Piutang',
  branding: 'Profil Toko & Struk',
  master: 'Pusat Inventaris & Audit Stok',
  launcher: 'Menu Aplikasi (New Tab)'
};

function openTab(tabId: ModuleTab) {
  // Map old/merged tabs to their single homes
  const targetId = tabId === 'receiving' ? 'products' : (tabId === 'returns' ? 'ledger' : tabId);
  if (!openTabIds.value.includes(targetId)) {
    openTabIds.value.push(targetId);
  }
  activeTab.value = targetId;
  currentPath.value = `Sistem Kasir / ${tabTitles[targetId] || targetId}`;
}

function openLauncherTab() {
  activeTab.value = 'launcher';
  currentPath.value = 'Sistem Kasir / Menu Aplikasi (New Tab)';
}

// Split Pane Cart Drawer (File Manager Split View / F3)
const showCartDrawer = ref(true);

// File Manager Browsing Navigation
const currentPath = ref<string>('Katalog Barang / Semua Produk');
const selectedCategory = ref<SupplierCategory | 'Semua'>('Semua');
const viewMode = ref<'icons' | 'list'>('icons');
const searchQuery = ref<string>('');
const toolbarRef = ref<InstanceType<typeof ExplorerToolbar> | null>(null);

watch(activeTab, (newTab) => {
  searchQuery.value = '';
  if (newTab === 'launcher') {
    currentPath.value = 'Sistem Kasir / Menu Aplikasi (New Tab)';
  } else if (newTab === 'pos') {
    currentPath.value = selectedCategory.value === 'Semua' ? 'Katalog Barang / Semua Produk' : `Katalog Barang / ${selectedCategory.value}`;
  } else {
    currentPath.value = `Sistem Kasir / ${tabTitles[newTab] || newTab}`;
  }
});

// Dynamic search placeholder based on active workspace tab
const searchPlaceholder = computed(() => {
  switch (activeTab.value) {
    case 'pos':
      return 'Cari barang / SKU / barcode...';
    case 'products':
    case 'master':
      return 'Cari nama barang, kode SKU, kategori...';
    case 'vendors':
      return 'Cari nama satuan, kemasan, kategori...';
    case 'suppliers':
      return 'Cari nama supplier, kontak sales, telepon...';
    case 'buyers':
      return 'Cari nama pelanggan, kontak WA, alamat...';
    case 'branding':
      return 'Cari pengaturan profil toko, tema UI...';
    case 'ledger':
      return 'Cari nota, nama barang, pembeli...';
    case 'reports':
      return 'Cari laporan keuangan, laba rugi, neraca...';
    case 'returns':
      return 'Cari riwayat retur nota, barang rusak...';
    case 'preorder':
      return 'Cari pesanan barang atau pelanggan...';
    case 'discounts':
      return 'Cari kode diskon, promo, syarat...';
    case 'loyalty':
      return 'Cari nomor kartu member, nama, kontak...';
    case 'receiving':
      return 'Cari no. faktur, nama vendor, catatan...';
    case 'launcher':
      return 'Cari menu aplikasi...';
    default:
      return 'Cari data...';
  }
});

function onCatalogCategoryChanged(cat: SupplierCategory | 'Semua') {
  selectedCategory.value = cat;
  currentPath.value = cat === 'Semua' ? 'Katalog Barang / Semua Produk' : `Katalog Barang / ${cat}`;
}

// Modals
const activeModalTransaction = ref<any>(null);
function handleShowReceipt() {
  if (posStore.lastProcessedTransaction) {
    activeModalTransaction.value = posStore.lastProcessedTransaction;
  }
}
function handleViewReceiptFromLedger(tx: any) {
  activeModalTransaction.value = tx;
}

function handleGlobalKeydown(e: KeyboardEvent) {
  // Shortcut F2 or Ctrl+F: Focus search box instantly
  if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F'))) {
    e.preventDefault();
    toolbarRef.value?.focusSearch();
    return;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div class="flex flex-col h-screen w-screen font-sans select-none overflow-hidden text-sm" style="background-color: var(--surface-body); color: var(--surface-text);">
    <!-- Custom Desktop Window Title Bar -->
    <AppTitleBar />

    <!-- Explorer Action / Toolbar (Modular Component) -->
    <ExplorerToolbar
      ref="toolbarRef"
      :active-tab="activeTab"
      :current-path="currentPath"
      :search-placeholder="searchPlaceholder"
      v-model:view-mode="viewMode"
      v-model:search-query="searchQuery"
      v-model:show-cart-drawer="showCartDrawer"
      @open-tab="openTab"
    />

    <!-- Tab Bar (Modular Component) -->
    <ExplorerTabBar
      :open-tab-ids="openTabIds"
      :active-tab="activeTab"
      @select-tab="openTab"
      @close-tab="closeTab"
      @open-launcher="openLauncherTab"
    />

    <!-- Main File Manager Workspace (Center Content + Right Cart Drawer) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Center Content Area: Switched by Tab -->
      <main class="flex-1 flex flex-col bg-white overflow-hidden">
        <!-- 1. KASIR POS VIEW -->
        <div v-show="activeTab === 'pos'" class="flex-1 flex overflow-hidden">
          <ProductCatalog
            :search-query="searchQuery"
            :view-mode="viewMode"
            :is-active="activeTab === 'pos'"
            @category-changed="onCatalogCategoryChanged"
          />

          <!-- Right Struk Kasir (POS Cart Panel) -->
          <div
            v-if="showCartDrawer"
            class="w-[380px] lg:w-[420px] border-l border-gray-300 bg-white flex flex-col shrink-0 shadow-lg"
          >
            <PosCart @show-receipt="handleShowReceipt" @close="showCartDrawer = false" />
          </div>
        </div>

        <!-- 2. DISKON & PROMO VIEW -->
        <div v-if="activeTab === 'discounts'" class="flex-1 overflow-hidden">
          <MasterDiscountTab :search-query="searchQuery" />
        </div>

        <!-- 3. LOYALTY & MEMBER VIEW -->
        <div v-if="activeTab === 'loyalty'" class="flex-1 overflow-hidden">
          <MasterMemberTab :search-query="searchQuery" />
        </div>

        <!-- 5. REKAP PRE-ORDER VIEW -->
        <div v-if="activeTab === 'preorder'" class="flex-1 overflow-hidden">
          <PreOrderMatrix :search-query="searchQuery" @switch-to-pos="activeTab = 'pos'" />
        </div>

        <!-- 6. BUKU BESAR & PIUTANG VIEW -->
        <div v-if="activeTab === 'ledger'" class="flex-1 overflow-hidden">
          <LedgerView :search-query="searchQuery" @view-receipt="handleViewReceiptFromLedger" />
        </div>

        <!-- PUSAT LAPORAN KEUANGAN VIEW -->
        <div v-if="activeTab === 'reports'" class="flex-1 overflow-hidden">
          <FinancialReportsView :search-query="searchQuery" />
        </div>

        <!-- 7. DAFTAR BARANG (SKU) VIEW -->
        <div v-if="activeTab === 'products' || activeTab === 'master'" class="flex-1 overflow-hidden">
          <MasterProducts :search-query="searchQuery" />
        </div>

        <!-- 8. KATEGORI BARANG VIEW -->
        <div v-if="activeTab === 'vendors'" class="flex-1 overflow-hidden">
          <MasterVendorTab :search-query="searchQuery" />
        </div>

        <!-- MITRA SUPPLIER (PEMASOK) VIEW -->
        <div v-if="activeTab === 'suppliers'" class="flex-1 overflow-hidden">
          <MasterSupplierTab :search-query="searchQuery" />
        </div>

        <!-- 9. DATA PELANGGAN & MITRA VIEW -->
        <div v-if="activeTab === 'buyers'" class="flex-1 overflow-hidden">
          <MasterBuyerTab :search-query="searchQuery" />
        </div>

        <!-- 10. PROFIL TOKO & STRUK VIEW -->
        <div v-if="activeTab === 'branding'" class="flex-1 overflow-hidden">
          <MasterBrandingTab />
        </div>

        <!-- 11. LAUNCHER VIEW (Modular Component) -->
        <AppLauncherTab
          v-if="activeTab === 'launcher'"
          :open-tab-ids="openTabIds"
          :search-query="searchQuery"
          @open-tab="openTab"
        />
      </main>
    </div>

    <!-- Bottom Status Bar (Modular Component) -->
    <ExplorerStatusBar :active-tab="activeTab" />

    <!-- Invoice Receipt Modal -->
    <ReceiptModal
      v-if="activeModalTransaction"
      :transaction="activeModalTransaction"
      @close="activeModalTransaction = null"
    />

    <!-- Global App Confirmation Modal -->
    <AppConfirmModal />

    <!-- Cashier Shift Management Modals -->
    <OpenShiftModal
      :is-open="shiftStore.showOpenShiftModal"
      @close="shiftStore.showOpenShiftModal = false"
    />
    <CloseShiftModal
      :is-open="shiftStore.showCloseShiftModal"
      @close="shiftStore.showCloseShiftModal = false"
    />
    <ShiftSummaryModal
      :is-open="shiftStore.showShiftSummaryModal"
      @close="shiftStore.showShiftSummaryModal = false"
    />

    <!-- Modal Pencatatan Barang Rusak / Susut (Waste) -->
    <WasteModal />
  </div>
</template>
