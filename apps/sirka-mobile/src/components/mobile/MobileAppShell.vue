<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useLicenseStore } from '../../stores/licenseStore';
import type { ModuleTab } from '../explorer/AppLauncherTab.vue';
import type { Product } from '@sirka/shared-types';
import { formatRupiah } from '../../utils/formatters';

// Icons
import {
  ShoppingCart,
  ChevronRight,
  Camera
} from 'lucide-vue-next';

// Mobile Chrome Components
import MobileHeaderBar from '../common/MobileHeaderBar.vue';
import MobileBottomNav from '../common/MobileBottomNav.vue';
import AppConfirmModal from '../common/AppConfirmModal.vue';

// Primary POS Components
import ProductCatalog from '../pos/ProductCatalog.vue';
import PosCart from '../pos/PosCart.vue';

// Lazy-loaded Views (Full POS Suite Modules)
const HomeInsightView = defineAsyncComponent(() => import('../home/HomeInsightView.vue'));
const MasterProducts = defineAsyncComponent(() => import('../master/MasterProducts.vue'));
const LedgerView = defineAsyncComponent(() => import('../ledger/LedgerView.vue'));
const PreOrderMatrix = defineAsyncComponent(() => import('../preorder/PreOrderMatrix.vue'));
const FinancialReportsView = defineAsyncComponent(() => import('../reports/FinancialReportsView.vue'));
const MasterDiscountTab = defineAsyncComponent(() => import('../master/MasterDiscountTab.vue'));
const MasterMemberTab = defineAsyncComponent(() => import('../master/MasterMemberTab.vue'));
const MasterBuyerTab = defineAsyncComponent(() => import('../master/MasterBuyerTab.vue'));
const MasterSupplierTab = defineAsyncComponent(() => import('../master/MasterSupplierTab.vue'));
const MasterVendorTab = defineAsyncComponent(() => import('../master/MasterVendorTab.vue'));
const MasterBrandingTab = defineAsyncComponent(() => import('../master/MasterBrandingTab.vue'));
const ServerConfigTab = defineAsyncComponent(() => import('../server/ServerConfigTab.vue'));


// On-Demand Modals
const ReceiptModal = defineAsyncComponent(() => import('../pos/ReceiptModal.vue'));
const OpenShiftModal = defineAsyncComponent(() => import('../pos/OpenShiftModal.vue'));
const CloseShiftModal = defineAsyncComponent(() => import('../pos/CloseShiftModal.vue'));
const ShiftSummaryModal = defineAsyncComponent(() => import('../pos/ShiftSummaryModal.vue'));
const WasteModal = defineAsyncComponent(() => import('../returns/WasteModal.vue'));
const LicenseModal = defineAsyncComponent(() => import('../common/LicenseModal.vue'));
const QuickBarcodeScannerModal = defineAsyncComponent(() => import('../common/QuickBarcodeScannerModal.vue'));

// PiP continuous scanner untuk scan barcode berturut-turut seperti kasir swalayan
import PosScannerPiP from '../pos/PosScannerPiP.vue';

const posStore = usePosStore();
const inventoryStore = useInventoryStore();
const shiftStore = useShiftStore();
const licenseStore = useLicenseStore();

// State
const activeTab = ref<ModuleTab>('pos');
const searchQuery = ref<string>('');
const showMobileCartModal = ref(false);
const showCameraScanner = ref(false);
const showPiPScanner = ref(false);
const activeModalTransaction = ref<any>(null);

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
  branding: 'Profil Toko',
  server: 'Server',
  master: 'Inventaris',
  home: 'Beranda',

  launcher: 'Menu',
  license: 'Lisensi'
};

const activeTabTitle = computed(() => tabTitles[activeTab.value] || 'Kasir');

function handleNavigate(tabId: ModuleTab) {
  if (tabId === 'license') {
    licenseStore.openLicenseModal();
    return;
  }
  if (!licenseStore.isLicensed && tabId !== 'home') {
    licenseStore.openLicenseModal('Fitur terkunci. Harap aktivasi lisensi.');
    return;
  }
  activeTab.value = tabId;
  searchQuery.value = '';
}

function handleOpenShift() {
  if (shiftStore.isShiftActive) {
    shiftStore.showCloseShiftModal = true;
  } else {
    shiftStore.showOpenShiftModal = true;
  }
}

function handleShowReceipt() {
  if (posStore.lastProcessedTransaction) {
    activeModalTransaction.value = posStore.lastProcessedTransaction;
  }
}

function handleBarcodeScanned(code: string) {
  showCameraScanner.value = false;
  if (!code) return;

  if (activeTab.value === 'pos') {
    // Cari produk di inventori dan langsung tambahkan ke keranjang
    const found = inventoryStore.products.find(
      (p: Product) => p.code?.toLowerCase() === code.toLowerCase() || p.barcode?.toLowerCase() === code.toLowerCase()
    );
    if (found) {
      posStore.addProductToCart(found);
      return;
    }
  }

  // Fallback: isi kotak pencarian dengan hasil scan
  searchQuery.value = code;
}

onMounted(() => {
  licenseStore.init();
});
</script>

<template>
  <div class="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden select-none font-sans">
    <!-- 1. Mobile Header Bar -->
    <MobileHeaderBar
      :active-tab="activeTab"
      :active-tab-title="activeTabTitle"
      v-model:search-query="searchQuery"
      @open-shift-modal="handleOpenShift"
    />

    <!-- 2. Main Mobile Content View -->
    <main class="flex-1 flex flex-col overflow-hidden relative pb-16">
      <!-- 0. BERANDA / HOME INSIGHT -->
      <div v-show="activeTab === 'home'" class="flex-1 overflow-y-auto">
        <HomeInsightView
          :search-query="searchQuery"
          @open-tab="handleNavigate"
        />
      </div>

      <!-- 1. KASIR / POS UTAMA -->
      <div v-show="activeTab === 'pos'" class="flex-1 flex flex-col overflow-hidden relative">
        <ProductCatalog
          :search-query="searchQuery"
          view-mode="icons"
          :is-active="activeTab === 'pos'"
          class="flex-1 min-h-0"
        />

        <!-- Floating Cart Bar (Bottom Sticky Pill) -->
        <div
          v-if="posStore.cartItems.length > 0"
          class="fixed bottom-18 inset-x-3 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <button
            type="button"
            @click="showMobileCartModal = true"
            class="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-xl rounded-xl px-4 py-3 flex items-center justify-between font-semibold transition cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <div class="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                <ShoppingCart class="w-3.5 h-3.5" />
                <span>{{ posStore.totalItemsCount }} item</span>
              </div>
              <span class="text-sm font-bold tracking-tight">Rp {{ formatRupiah(posStore.finalTotal) }}</span>
            </div>
            <div class="flex items-center gap-1 text-xs font-bold text-blue-100">
              <span>Checkout</span>
              <ChevronRight class="w-4 h-4 text-white" />
            </div>
          </button>
        </div>

        <!-- Fullscreen Mobile Cart & Payment Bottom Sheet -->
        <div
          v-if="showMobileCartModal"
          class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150"
        >
          <div class="bg-white w-full h-[92vh] rounded-t-2xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div class="h-11 px-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-1.5 shrink-0">
              <div class="flex items-center gap-1.5 min-w-0">
                <ShoppingCart class="w-4 h-4 text-blue-600 shrink-0" />
                <span class="font-bold text-xs text-slate-800 truncate">Keranjang Kasir ({{ posStore.totalItemsCount }} Item)</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <input
                  v-model="posStore.transactionDate"
                  type="date"
                  class="h-7 w-[105px] bg-white border border-gray-300 rounded-lg px-1 text-[10px] font-mono text-slate-900 outline-none focus:border-blue-500 shadow-2xs"
                  title="Pilih Tanggal Transaksi"
                />
                <button
                  type="button"
                  @click="showMobileCartModal = false"
                  class="text-xs font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-md bg-slate-200 hover:bg-slate-300 transition cursor-pointer shrink-0"
                >
                  ✕ Selesai
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

      <!-- 2. INVENTARIS / PRODUK SKU -->
      <div v-if="activeTab === 'products' || activeTab === 'master'" class="flex-1 overflow-hidden">
        <MasterProducts :search-query="searchQuery" />
      </div>

      <!-- 3. BUKU KAS / TRANSAKSI LEDGER -->
      <div v-if="activeTab === 'ledger' || activeTab === 'returns'" class="flex-1 overflow-hidden">
        <LedgerView :search-query="searchQuery" />
      </div>

      <!-- 4. PESANAN / PRE-ORDER MATRIX -->
      <div v-if="activeTab === 'preorder'" class="flex-1 overflow-hidden">
        <PreOrderMatrix :search-query="searchQuery" @switch-to-pos="activeTab = 'pos'" />
      </div>

      <!-- 5. LAPORAN KEUANGAN -->
      <div v-if="activeTab === 'reports'" class="flex-1 overflow-hidden">
        <FinancialReportsView />
      </div>

      <!-- 6. DISKON & PROMO -->
      <div v-if="activeTab === 'discounts'" class="flex-1 overflow-hidden">
        <MasterDiscountTab :search-query="searchQuery" />
      </div>

      <!-- 7. MEMBER LOYALTY -->
      <div v-if="activeTab === 'loyalty'" class="flex-1 overflow-hidden">
        <MasterMemberTab :search-query="searchQuery" />
      </div>

      <!-- 8. PELANGGAN -->
      <div v-if="activeTab === 'buyers'" class="flex-1 overflow-hidden">
        <MasterBuyerTab :search-query="searchQuery" />
      </div>

      <!-- 9. SUPPLIER -->
      <div v-if="activeTab === 'suppliers'" class="flex-1 overflow-hidden">
        <MasterSupplierTab :search-query="searchQuery" />
      </div>

      <!-- 10. KATEGORI & VENDOR -->
      <div v-if="activeTab === 'vendors'" class="flex-1 overflow-hidden">
        <MasterVendorTab :search-query="searchQuery" />
      </div>

      <!-- 11. PROFIL TOKO & BRANDING -->
      <div v-if="activeTab === 'branding'" class="flex-1 overflow-hidden">
        <MasterBrandingTab :search-query="searchQuery" />
      </div>

      <!-- 12. PENGATURAN SERVER & DATABASE CLOUD -->
      <div v-if="activeTab === 'server'" class="flex-1 overflow-hidden">
        <ServerConfigTab />
      </div>
    </main>


    <!-- Floating Quick Camera Barcode Scan Button (Hanya di Kasir/POS untuk scan barang ke keranjang) -->
    <button
      v-if="activeTab === 'pos'"
      type="button"
      @click="showPiPScanner = !showPiPScanner"
      class="fixed right-4 z-30 w-12 h-12 rounded-full shadow-xl flex items-center justify-center active:scale-95 transition-all cursor-pointer border-2"
      :class="[
        posStore.cartItems.length > 0 ? 'bottom-34' : 'bottom-20',
        showPiPScanner
          ? 'bg-amber-500 text-slate-900 border-amber-300 hover:bg-amber-400'
          : 'bg-slate-900 text-white border-white/20 hover:bg-slate-800'
      ]"
      :title="showPiPScanner ? 'Tutup Scanner Kamera' : 'Buka Scanner Kamera (Continuous)'"
    >
      <Camera class="w-6 h-6" :class="showPiPScanner ? 'text-slate-900' : 'text-amber-400'" />
    </button>

    <!-- PiP Continuous Barcode Scanner (Scan berturut-turut seperti kasir swalayan) -->
    <PosScannerPiP
      :is-open="showPiPScanner && activeTab === 'pos'"
      @close="showPiPScanner = false"
    />

    <!-- 3. Mobile Bottom Navigation Bar -->
    <MobileBottomNav
      :active-tab="activeTab"
      @navigate="handleNavigate"
    />

    <!-- Global Operational Modals -->
    <ReceiptModal
      v-if="activeModalTransaction"
      :transaction="activeModalTransaction"
      @close="activeModalTransaction = null"
    />

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

    <WasteModal />

    <LicenseModal />

    <QuickBarcodeScannerModal
      v-if="showCameraScanner"
      @scanned="handleBarcodeScanned"
      @close="showCameraScanner = false"
    />

    <AppConfirmModal />
  </div>
</template>

<style>
/* Safe Area insets for modern mobile displays (Notch & Home Bar) with minimum ergonomic clearance */
.pb-safe {
  padding-bottom: max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 0.75rem));
}
</style>
