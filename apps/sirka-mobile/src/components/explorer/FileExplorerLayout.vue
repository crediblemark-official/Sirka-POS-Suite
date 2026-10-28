<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { SupplierCategory } from '../../types';
import type { ModuleTab } from './AppLauncherTab.vue';

// Modular Layout Components (Core Shell)
import AppTitleBar from '../common/AppTitleBar.vue';
import ExplorerToolbar from './ExplorerToolbar.vue';
import ExplorerTabBar from './ExplorerTabBar.vue';
import ExplorerStatusBar from './ExplorerStatusBar.vue';
import AppLauncherTab from './AppLauncherTab.vue';
import HomeInsightView from '../home/HomeInsightView.vue';
import AppConfirmModal from '../common/AppConfirmModal.vue';
import MobileHeaderBar from '../common/MobileHeaderBar.vue';
import MobileBottomNav from '../common/MobileBottomNav.vue';
import { useResponsive } from '../../composables/useResponsive';
import { formatRupiah } from '../../utils/formatters';
import { ChevronRight, ShoppingCart } from 'lucide-vue-next';

// Primary POS View Modules (Loaded eagerly for rapid cashier responsiveness)
import ProductCatalog from '../pos/ProductCatalog.vue';
import PosCart from '../pos/PosCart.vue';

// Secondary View Modules (Lazy-loaded on tab activation)
const PreOrderMatrix = defineAsyncComponent(() => import('../preorder/PreOrderMatrix.vue'));
const LedgerView = defineAsyncComponent(() => import('../ledger/LedgerView.vue'));
const FinancialReportsView = defineAsyncComponent(() => import('../reports/FinancialReportsView.vue'));
const MasterProducts = defineAsyncComponent(() => import('../master/MasterProducts.vue'));
const MasterVendorTab = defineAsyncComponent(() => import('../master/MasterVendorTab.vue'));
const MasterSupplierTab = defineAsyncComponent(() => import('../master/MasterSupplierTab.vue'));
const MasterBuyerTab = defineAsyncComponent(() => import('../master/MasterBuyerTab.vue'));
const MasterBrandingTab = defineAsyncComponent(() => import('../master/MasterBrandingTab.vue'));
const MasterDiscountTab = defineAsyncComponent(() => import('../master/MasterDiscountTab.vue'));
const MasterMemberTab = defineAsyncComponent(() => import('../master/MasterMemberTab.vue'));
const ServerConfigTab = defineAsyncComponent(() => import('../server/ServerConfigTab.vue'));


// On-Demand Modals (Lazy-loaded when triggered)
const ReceiptModal = defineAsyncComponent(() => import('../pos/ReceiptModal.vue'));
const OpenShiftModal = defineAsyncComponent(() => import('../pos/OpenShiftModal.vue'));
const CloseShiftModal = defineAsyncComponent(() => import('../pos/CloseShiftModal.vue'));
const ShiftSummaryModal = defineAsyncComponent(() => import('../pos/ShiftSummaryModal.vue'));
const WasteModal = defineAsyncComponent(() => import('../returns/WasteModal.vue'));
const LicenseModal = defineAsyncComponent(() => import('../common/LicenseModal.vue'));

import { useShiftStore } from '../../stores/shiftStore';
import { useLicenseStore } from '../../stores/licenseStore';
import { syncService } from '../../services/syncService';

const posStore = usePosStore();
const shiftStore = useShiftStore();
const licenseStore = useLicenseStore();
const { isMobile } = useResponsive();
const showMobileCartModal = ref(false);


// Setiap aplikasi baru dibuka: tidak ada tab aktif, dan default memunculkan Home
const openTabIds = ref<ModuleTab[]>([]);
const activeTab = ref<ModuleTab>('home');

function closeTab(tabId: ModuleTab, e?: MouseEvent) {
  if (e) e.stopPropagation();
  const idx = openTabIds.value.indexOf(tabId);
  if (idx !== -1) {
    openTabIds.value.splice(idx, 1);
  }
  // If the active tab was closed, switch to another tab or fallback to home insight
  if (activeTab.value === tabId) {
    if (openTabIds.value.length > 0) {
      activeTab.value = openTabIds.value[Math.max(0, idx - 1)];
    } else {
      activeTab.value = 'home';
    }
  }
}

const tabTitles: Record<ModuleTab, string> = {
  pos: 'Kasir',
  receiving: 'Kulakan',
  products: 'Inventaris',
  vendors: 'Kategori',
  suppliers: 'Supplier',
  buyers: 'Pelanggan',
  discounts: 'Diskon',
  loyalty: 'Member',
  preorder: 'Pesanan',
  ledger: 'Buku Kas',
  reports: 'Laporan',
  returns: 'Buku Kas',
  branding: 'Profil',
  server: 'Server',
  master: 'Inventaris',
  home: 'Home',

  launcher: 'Menu',
  license: 'Lisensi'
};

function openTab(tabId: ModuleTab) {
  if (tabId === 'license') {
    licenseStore.openLicenseModal();
    return;
  }
  if (tabId === 'home') {
    activeTab.value = 'home';
    currentPath.value = 'Sistem Kasir / Home';
    return;
  }
  if (!licenseStore.isLicensed) {
    licenseStore.openLicenseModal('Fitur terkunci. Harap aktivasi lisensi.');
    return;
  }
  // Map old/merged tabs to their single homes
  const targetId = tabId === 'receiving' ? 'products' : (tabId === 'returns' ? 'ledger' : tabId);
  if (!openTabIds.value.includes(targetId)) {
    openTabIds.value.push(targetId);
  }
  activeTab.value = targetId;
  currentPath.value = `Sistem Kasir / ${tabTitles[targetId] || targetId}`;
}

function openLauncherTab() {
  if (!licenseStore.isLicensed) {
    licenseStore.openLicenseModal('Fitur terkunci. Harap aktivasi lisensi.');
    return;
  }
  activeTab.value = 'launcher';
  currentPath.value = 'Sistem Kasir / Menu';
}

// Split Pane Cart Drawer (File Manager Split View / F3)
const showCartDrawer = ref(true);

// File Manager Browsing Navigation
const currentPath = ref<string>('Sistem Kasir / Home');
const selectedCategory = ref<SupplierCategory | 'Semua'>('Semua');
const viewMode = ref<'icons' | 'list'>('icons');
const searchQuery = ref<string>('');
const toolbarRef = ref<InstanceType<typeof ExplorerToolbar> | null>(null);
const productCatalogRef = ref<InstanceType<typeof ProductCatalog> | null>(null);

function handleSearchNavigate(direction: 'right' | 'left' | 'down' | 'up') {
  if (activeTab.value === 'pos' && productCatalogRef.value) {
    productCatalogRef.value.navigateProducts(direction);
  }
}

function handleSearchSubmit() {
  if (activeTab.value === 'pos' && productCatalogRef.value) {
    productCatalogRef.value.handleAddSelected();
    showCartDrawer.value = true;
    searchQuery.value = '';
  }
}

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
    case 'home':
      return 'Cari fitur, modul usaha, atau data insight...';
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
  // Shortcut Ctrl+Tab / Ctrl+Shift+Tab: Kontrol ganti tab dinamis
  if (e.ctrlKey && e.key === 'Tab') {
    e.preventDefault();
    if (openTabIds.value.length === 0) {
      activeTab.value = 'home';
      return;
    }
    const currIdx = openTabIds.value.indexOf(activeTab.value);
    if (e.shiftKey) {
      // Mundur ke tab sebelumnya (wrap ke tab terakhir)
      if (currIdx === -1) {
        activeTab.value = openTabIds.value[openTabIds.value.length - 1];
      } else {
        const prevIdx = (currIdx - 1 + openTabIds.value.length) % openTabIds.value.length;
        activeTab.value = openTabIds.value[prevIdx];
      }
    } else {
      // Maju ke tab berikutnya (wrap ke tab awal)
      if (currIdx === -1) {
        activeTab.value = openTabIds.value[0];
      } else {
        const nextIdx = (currIdx + 1) % openTabIds.value.length;
        activeTab.value = openTabIds.value[nextIdx];
      }
    }
    return;
  }

  // Dukung juga Ctrl+PageDown (Next Tab) & Ctrl+PageUp (Prev Tab)
  if (e.ctrlKey && e.key === 'PageDown') {
    e.preventDefault();
    if (openTabIds.value.length > 0) {
      const currIdx = openTabIds.value.indexOf(activeTab.value);
      const nextIdx = currIdx === -1 ? 0 : (currIdx + 1) % openTabIds.value.length;
      activeTab.value = openTabIds.value[nextIdx];
    }
    return;
  }
  if (e.ctrlKey && e.key === 'PageUp') {
    e.preventDefault();
    if (openTabIds.value.length > 0) {
      const currIdx = openTabIds.value.indexOf(activeTab.value);
      const prevIdx = currIdx === -1 ? openTabIds.value.length - 1 : (currIdx - 1 + openTabIds.value.length) % openTabIds.value.length;
      activeTab.value = openTabIds.value[prevIdx];
    }
    return;
  }

  // Shortcut Ctrl+W: Tutup tab aktif
  if (e.ctrlKey && (e.key === 'w' || e.key === 'W')) {
    e.preventDefault();
    if (activeTab.value !== 'home' && activeTab.value !== 'launcher') {
      closeTab(activeTab.value);
    }
    return;
  }

  // Shortcut Ctrl+T / Ctrl+N: Buka Menu Baru (New Tab / Launcher)
  if (e.ctrlKey && (e.key === 't' || e.key === 'T' || e.key === 'n' || e.key === 'N')) {
    e.preventDefault();
    openLauncherTab();
    return;
  }

  // Shortcut F3, F2 or Ctrl+F: Focus search box instantly
  if (e.key === 'F3' || e.key === 'F2' || ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F'))) {
    e.preventDefault();
    toolbarRef.value?.focusSearch();
    return;
  }
}

onMounted(() => {
  // Bersihkan cache tab sesi sebelumnya agar aplikasi baru dibuka selalu bersih di Home tanpa tab aktif
  localStorage.removeItem('kasir_citra_open_tabs_v1');
  localStorage.removeItem('kasir_citra_active_tab_v1');
  openTabIds.value = [];
  activeTab.value = 'home';
  window.addEventListener('keydown', handleGlobalKeydown);
  licenseStore.init();
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  syncService.stopPolling();
});
</script>

<template>
  <div class="flex flex-col h-screen w-screen font-sans select-none overflow-hidden text-sm" style="background-color: var(--surface-body); color: var(--surface-text);">
    <!-- Custom Desktop Window Title Bar & Ribbon (Desktop only) -->
    <template v-if="!isMobile">
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
        @open-launcher="openLauncherTab"
        @search-navigate="handleSearchNavigate"
        @search-submit="handleSearchSubmit"
      />

      <!-- Tab Bar (Modular Component): Sembunyikan bila tidak ada tab terbuka -->
      <ExplorerTabBar
        v-if="openTabIds.length > 0"
        :open-tab-ids="openTabIds"
        :active-tab="activeTab"
        @select-tab="openTab"
        @close-tab="closeTab"
        @open-launcher="openLauncherTab"
      />
    </template>

    <!-- Mobile Header Bar (Mobile / Android) -->
    <template v-else>
      <MobileHeaderBar
        :active-tab="activeTab"
        :active-tab-title="tabTitles[activeTab] || 'Kasir'"
        v-model:search-query="searchQuery"
        @open-shift-modal="shiftStore.showOpenShiftModal = true"
      />
    </template>

    <!-- Main File Manager Workspace (Center Content + Right Cart Drawer) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Center Content Area: Switched by Tab -->
      <main class="flex-1 flex flex-col bg-white overflow-hidden" :class="{ 'pb-13': isMobile }">
        <!-- 0. BERANDA & INSIGHT STATISTIK BISNIS -->
        <div v-show="activeTab === 'home'" class="flex-1 flex overflow-hidden">
          <HomeInsightView
            :search-query="searchQuery"
            @open-tab="openTab"
          />
        </div>

        <!-- 1. KASIR POS VIEW -->
        <div v-show="activeTab === 'pos'" class="flex-1 flex overflow-hidden relative">
          <ProductCatalog
            ref="productCatalogRef"
            :search-query="searchQuery"
            :view-mode="viewMode"
            :is-active="activeTab === 'pos'"
            @category-changed="onCatalogCategoryChanged"
          />

          <!-- Right Struk Kasir (POS Cart Panel) for Desktop -->
          <div
            v-if="!isMobile && showCartDrawer"
            class="w-[380px] lg:w-[420px] border-l border-gray-300 bg-white flex flex-col shrink-0 shadow-lg"
          >
            <PosCart @show-receipt="handleShowReceipt" @close="showCartDrawer = false" />
          </div>

          <!-- Mobile Floating Sticky Cart Bar (Trigger Bottom Sheet) -->
          <div
            v-if="isMobile && posStore.cartItems.length > 0"
            class="fixed bottom-15 inset-x-3 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200"
          >
            <button
              @click="showMobileCartModal = true"
              class="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white shadow-xl rounded-xl px-4 py-3 flex items-center justify-between font-semibold transition cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <div class="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                  <ShoppingCart class="w-3 h-3" />
                  <span>{{ posStore.totalItemsCount }}</span>
                </div>
                <span class="text-sm font-bold">Rp {{ formatRupiah(posStore.finalTotal) }}</span>
              </div>
              <div class="flex items-center gap-1 text-xs font-bold text-blue-100">
                <span>Lihat Keranjang & Bayar</span>
                <ChevronRight class="w-4 h-4 text-white" />
              </div>
            </button>
          </div>

          <!-- Mobile Full Cart Bottom-Sheet Modal -->
          <div
            v-if="isMobile && showMobileCartModal"
            class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150"
          >
            <div class="bg-white w-full h-[94vh] rounded-t-2xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
              <div class="h-10 px-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-1.5 shrink-0">
                <span class="font-bold text-xs text-slate-800 truncate">Keranjang Kasir & Pembayaran</span>
                <div class="flex items-center gap-1.5 shrink-0">
                  <input
                    v-model="posStore.transactionDate"
                    type="date"
                    class="h-7 w-[105px] bg-white border border-gray-300 rounded-lg px-1 text-[10px] font-mono text-slate-900 outline-none focus:border-blue-500 shadow-2xs"
                    title="Pilih Tanggal Transaksi"
                  />
                  <button
                    @click="showMobileCartModal = false"
                    class="text-xs font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-md bg-slate-200 hover:bg-slate-300 transition cursor-pointer shrink-0"
                  >
                    ✕ Tutup
                  </button>
                </div>
              </div>
              <div class="flex-1 overflow-hidden flex flex-col">
                <PosCart
                  @show-receipt="handleShowReceipt(); showMobileCartModal = false;"
                  @close="showMobileCartModal = false"
                />
              </div>
            </div>
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

        <!-- 11. PENGATURAN SERVER & DATABASE CLOUD VIEW -->
        <div v-if="activeTab === 'server'" class="flex-1 overflow-hidden">
          <ServerConfigTab />
        </div>

        <!-- 12. LAUNCHER VIEW (Modular Component) -->

        <AppLauncherTab
          v-if="activeTab === 'launcher'"
          :open-tab-ids="openTabIds"
          :search-query="searchQuery"
          @open-tab="openTab"
        />
      </main>
    </div>

    <!-- Bottom Status Bar on Desktop, MobileBottomNav on Mobile -->
    <ExplorerStatusBar v-if="!isMobile" :active-tab="activeTab" @open-tab="openTab" />

    <MobileBottomNav
      v-else
      :active-tab="activeTab"
      :open-tab-ids="openTabIds"
      @navigate="openTab"
      @close-tab="closeTab"
    />

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

    <!-- Modal Manajemen Lisensi (Tertaut.com) -->
    <LicenseModal />
  </div>
</template>

