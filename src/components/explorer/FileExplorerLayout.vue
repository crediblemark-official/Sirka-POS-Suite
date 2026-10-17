<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePosStore } from '../../stores/posStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useDiscountStore } from '../../stores/discountStore';
import { SupplierCategory, Product } from '../../types';
import PosCart from '../pos/PosCart.vue';
import SupplierReceiving from '../receiving/SupplierReceiving.vue';
import PreOrderMatrix from '../preorder/PreOrderMatrix.vue';
import LedgerView from '../ledger/LedgerView.vue';
import MasterProducts from '../master/MasterProducts.vue';
import MasterDiscountTab from '../master/MasterDiscountTab.vue';
import MasterMemberTab from '../master/MasterMemberTab.vue';
import ReceiptModal from '../pos/ReceiptModal.vue';
import { formatRupiah } from '../../utils/formatters';
import {
  Folder,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Settings,
  Search,
  LayoutGrid,
  List,
  Plus,
  X,
  ShoppingCart,
  Truck,
  Calendar,
  BookOpen,
  Tag,
  CreditCard
} from 'lucide-vue-next';

const inventoryStore = useInventoryStore();
const posStore = usePosStore();
const ledgerStore = useLedgerStore();
const settingsStore = useSettingsStore();
const buyerStore = useBuyerStore();
const discountStore = useDiscountStore();

// Active Module Tab & Dynamic Open Tabs
export type ModuleTab = 'pos' | 'discounts' | 'loyalty' | 'receiving' | 'preorder' | 'ledger' | 'master' | 'launcher';

export interface TabItem {
  id: ModuleTab;
  title: string;
  icon: any;
  color: string;
  badge?: () => number | string | undefined;
}

const availableMenuItems = [
  {
    id: 'pos' as ModuleTab,
    title: 'Kasir POS',
    description: 'Folder transaksi penjualan kasir, struk belanja, dan kasir eceran / B2B',
    folderColor: 'from-[#e8cf9b] to-[#cba366]',
    icon: ShoppingCart,
    iconColor: 'text-blue-600',
    fileCount: 41
  },
  {
    id: 'discounts' as ModuleTab,
    title: 'Diskon & Promo Kupon',
    description: 'Folder manajemen kupon promo, voucher diskon %, potongan harga, dan target pelanggan',
    folderColor: 'from-[#fecdd3] to-[#f43f5e]',
    icon: Tag,
    iconColor: 'text-rose-600',
    fileCount: 12
  },
  {
    id: 'loyalty' as ModuleTab,
    title: 'Loyalty & Kartu Member',
    description: 'Folder kartu member digital/fisik, saldo poin belanja, tier reward, dan cetak kartu',
    folderColor: 'from-[#fed7aa] to-[#f59e0b]',
    icon: CreditCard,
    iconColor: 'text-amber-600',
    fileCount: 18
  },
  {
    id: 'receiving' as ModuleTab,
    title: 'Penerimaan Supplier',
    description: 'Folder pencatatan stok masuk (nyetok) dari vendor & supplier pasar',
    folderColor: 'from-[#f5d799] to-[#d69f47]',
    icon: Truck,
    iconColor: 'text-amber-600',
    fileCount: 16
  },
  {
    id: 'preorder' as ModuleTab,
    title: 'Rekap Pre-Order',
    description: 'Folder jadwal pengiriman mingguan, matriks pesanan pembeli, dan export PO',
    folderColor: 'from-[#c2e4cb] to-[#78b889]',
    icon: Calendar,
    iconColor: 'text-emerald-600',
    fileCount: 8
  },
  {
    id: 'ledger' as ModuleTab,
    title: 'Buku Besar & Piutang',
    description: 'Folder mutasi kas, saldo toko, catatan tempo piutang buyer, dan tagihan',
    folderColor: 'from-[#d2d4f5] to-[#8d92db]',
    icon: BookOpen,
    iconColor: 'text-indigo-600',
    fileCount: 24
  },
  {
    id: 'master' as ModuleTab,
    title: 'Master SKU & Katalog',
    description: 'Folder katalog induk SKU, supplier vendor, pembeli, dan branding toko',
    folderColor: 'from-[#e7cbf2] to-[#b37ece]',
    icon: Settings,
    iconColor: 'text-purple-600',
    fileCount: 35
  }
];

// Open tabs initialized with only Kasir POS by default
const openTabIds = ref<ModuleTab[]>(['pos']);
const activeTab = ref<ModuleTab>('pos');

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

function openTab(tabId: ModuleTab) {
  if (!openTabIds.value.includes(tabId)) {
    openTabIds.value.push(tabId);
  }
  activeTab.value = tabId;
  const item = availableMenuItems.find(m => m.id === tabId);
  if (item) {
    currentPath.value = `Sistem Kasir / ${item.title}`;
  }
}

function openLauncherTab() {
  activeTab.value = 'launcher';
  currentPath.value = 'Sistem Kasir / Menu Aplikasi (New Tab)';
}

watch(activeTab, (newTab) => {
  if (newTab === 'launcher') {
    currentPath.value = 'Sistem Kasir / Menu Aplikasi (New Tab)';
  } else if (newTab === 'pos') {
    currentPath.value = selectedCategory.value === 'Semua' ? 'Katalog Barang / Semua Produk' : `Katalog Barang / ${selectedCategory.value}`;
  } else {
    const item = availableMenuItems.find(m => m.id === newTab);
    if (item) {
      currentPath.value = `Sistem Kasir / ${item.title}`;
    }
  }
});

// Split Pane Cart Drawer (File Manager Split View / F3)
const showCartDrawer = ref(true);

// File Manager Browsing Navigation
const currentPath = ref<string>('Katalog Barang / Semua Produk');
const selectedCategory = ref<SupplierCategory | 'Semua'>('Semua');
const viewMode = ref<'icons' | 'list'>('icons');
const searchQuery = ref<string>('');
const pathSearchInputRef = ref<HTMLInputElement | null>(null);
const selectedProductId = ref<string | null>(null);
const activeMultiplier = ref<number>(1);

// Dynamic categories from database
const categories = computed(() => inventoryStore.categoryMarkups.map(c => c.category));

function selectCategory(cat: SupplierCategory | 'Semua') {
  selectedCategory.value = cat;
  currentPath.value = cat === 'Semua' ? 'Katalog Barang / Semua Produk' : `Katalog Barang / ${cat}`;
}

const filteredProducts = computed(() => {
  return inventoryStore.products.filter(p => {
    const matchCat = selectedCategory.value === 'Semua' || p.category === selectedCategory.value;
    const q = searchQuery.value.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });
});

function handleProductClick(prod: Product) {
  selectedProductId.value = prod.id;
}

function handleProductDoubleClick(prod: Product) {
  posStore.addProductToCart(prod, activeMultiplier.value);
}

function handleAddSelected() {
  if (!selectedProductId.value) return;
  const prod = inventoryStore.products.find(p => p.id === selectedProductId.value);
  if (prod) {
    posStore.addProductToCart(prod, activeMultiplier.value);
  }
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

// Category Pills Horizontal Scroll & Drag with cursor
const categoryScrollRef = ref<HTMLDivElement | null>(null);
const isDraggingCategory = ref(false);
const startX = ref(0);
const scrollLeftStart = ref(0);

function handleCategoryWheel(e: WheelEvent) {
  if (!categoryScrollRef.value) return;
  // Convert vertical mouse wheel into horizontal scroll
  if (e.deltaY !== 0) {
    e.preventDefault();
    categoryScrollRef.value.scrollLeft += e.deltaY;
  }
}

function handleCategoryMouseDown(e: MouseEvent) {
  if (!categoryScrollRef.value) return;
  isDraggingCategory.value = true;
  startX.value = e.pageX - categoryScrollRef.value.offsetLeft;
  scrollLeftStart.value = categoryScrollRef.value.scrollLeft;
}

function handleCategoryMouseMove(e: MouseEvent) {
  if (!isDraggingCategory.value || !categoryScrollRef.value) return;
  e.preventDefault();
  const x = e.pageX - categoryScrollRef.value.offsetLeft;
  const walk = (x - startX.value) * 1.5; // Drag sensitivity
  categoryScrollRef.value.scrollLeft = scrollLeftStart.value - walk;
}

function handleCategoryMouseUp() {
  isDraggingCategory.value = false;
}

function scrollCategory(direction: 'left' | 'right') {
  if (!categoryScrollRef.value) return;
  const distance = 250;
  categoryScrollRef.value.scrollBy({
    left: direction === 'left' ? -distance : distance,
    behavior: 'smooth'
  });
}

function handleGlobalKeydown(e: KeyboardEvent) {
  // If user is inside an open modal or typing in a form input, don't hijack unless specific shortcuts
  const activeEl = document.activeElement;
  const isInputActive = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement;

  // Shortcut F2 or Ctrl+F: Focus search box instantly
  if (e.key === 'F2' || ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F'))) {
    e.preventDefault();
    pathSearchInputRef.value?.focus();
    pathSearchInputRef.value?.select();
    return;
  }

  // If focus is in search input
  if (activeEl === pathSearchInputRef.value) {
    if (e.key === 'Escape') {
      searchQuery.value = '';
      pathSearchInputRef.value?.blur();
      return;
    }
    // Pressing Enter or ArrowDown from search box navigates to the first product
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      if (filteredProducts.value.length > 0) {
        e.preventDefault();
        pathSearchInputRef.value?.blur();
        if (!selectedProductId.value || !filteredProducts.value.some(p => p.id === selectedProductId.value)) {
          selectedProductId.value = filteredProducts.value[0].id;
        } else if (e.key === 'Enter') {
          handleAddSelected();
        }
      }
      return;
    }
    return;
  }

  // Ignore navigation shortcuts if typing in any other input
  if (isInputActive) return;

  // Only run grid navigation on POS tab
  if (activeTab.value !== 'pos') return;

  const prods = filteredProducts.value;
  if (prods.length === 0) return;

  const currentIndex = prods.findIndex(p => p.id === selectedProductId.value);
  // Estimate columns per row: standard 6 on lg/xl, 4 on md, 3 on sm, 2 on xs
  const screenWidth = window.innerWidth;
  const cols = screenWidth >= 1280 ? 6 : screenWidth >= 1024 ? 5 : screenWidth >= 768 ? 4 : 3;

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    const nextIdx = currentIndex < prods.length - 1 ? currentIndex + 1 : 0;
    selectedProductId.value = prods[nextIdx].id;
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    const prevIdx = currentIndex > 0 ? currentIndex - 1 : prods.length - 1;
    selectedProductId.value = prods[prevIdx].id;
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    const downIdx = currentIndex + cols < prods.length ? currentIndex + cols : currentIndex;
    selectedProductId.value = prods[downIdx].id;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const upIdx = currentIndex - cols >= 0 ? currentIndex - cols : currentIndex;
    selectedProductId.value = prods[upIdx].id;
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleAddSelected();
  } else if (['1', '2', '3', '4', '5'].includes(e.key) && (e.altKey || !e.ctrlKey && !e.metaKey)) {
    // Quick multiplier numbers when in grid
    const multiplierMap: Record<string, number> = { '1': 1, '2': 5, '3': 10, '4': 25, '5': 50 };
    if (e.altKey && multiplierMap[e.key]) {
      e.preventDefault();
      activeMultiplier.value = multiplierMap[e.key];
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  // Pre-select first item if available
  if (filteredProducts.value.length > 0 && !selectedProductId.value) {
    selectedProductId.value = filteredProducts.value[0].id;
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div class="flex flex-col h-screen w-screen bg-[#ecebe9] text-[#2e2b28] font-sans select-none overflow-hidden text-sm">
    <!-- Top Action / Toolbar (Nemo/Caja style) -->
    <header class="explorer-header flex items-center gap-2 px-3 py-1.5 bg-[#dfddd9] border-b border-[#c8c5c0] shadow-xs transition-colors">
      <div class="flex items-center gap-2">
        <span
          class="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/10"
          :style="{ backgroundColor: settingsStore.primaryColor }"
          :title="`Warna Tema: ${settingsStore.primaryColor}`"
        ></span>
        <span class="font-bold text-xs text-gray-800 pr-2 border-r border-[#c8c5c0] tracking-tight">
          {{ settingsStore.storeName }}
        </span>
      </div>

      <!-- Back / Forward -->
      <div class="flex items-center gap-1 text-[#5c5752]">
        <button class="p-1 hover:bg-[#d0cdc8] rounded cursor-pointer disabled:opacity-30" disabled>
          <ChevronLeft :size="17" />
        </button>
        <button class="p-1 hover:bg-[#d0cdc8] rounded cursor-pointer disabled:opacity-30" disabled>
          <ChevronRight :size="17" />
        </button>
      </div>

      <!-- View Modes -->
      <div class="flex items-center bg-[#d0cdc8] p-0.5 rounded border border-[#b8b5af]">
        <button
          class="p-1 rounded cursor-pointer"
          :class="viewMode === 'icons' ? 'bg-white shadow-xs text-[#2e2b28]' : 'text-[#6b655f] hover:text-black'"
          title="Icon View"
          @click="viewMode = 'icons'"
        >
          <LayoutGrid :size="15" />
        </button>
        <button
          class="p-1 rounded cursor-pointer"
          :class="viewMode === 'list' ? 'bg-white shadow-xs text-[#2e2b28]' : 'text-[#6b655f] hover:text-black'"
          title="Compact List View"
          @click="viewMode = 'list'"
        >
          <List :size="15" />
        </button>
      </div>

      <!-- Address / Path Bar (Search on Left + Breadcrumb Path on Right) -->
      <div class="flex-1 flex items-center bg-white border border-[#b8b5af] rounded px-2.5 py-1 shadow-inner gap-2">
        <!-- Search Input on Left (Shortcut F2) -->
        <div class="flex items-center gap-1.5 pr-2.5 border-r border-gray-200 shrink-0">
          <Search :size="13" class="text-gray-400" />
          <input
            ref="pathSearchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Cari SKU / Barang..."
            class="outline-none text-xs text-gray-700 w-44 bg-transparent placeholder-gray-400"
          />
          <kbd class="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono text-[9px] border border-gray-200" title="Tekan F2 untuk cari langsung">
            F2
          </kbd>
          <button
            v-if="searchQuery"
            type="button"
            class="text-gray-400 hover:text-gray-600 cursor-pointer ml-0.5"
            title="Bersihkan pencarian (Esc)"
            @click="searchQuery = ''"
          >
            <X :size="12" />
          </button>
        </div>

        <!-- Breadcrumb / Path on Right -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <FolderOpen :size="16" class="text-[#c29858] shrink-0" />
          <span class="font-mono text-xs text-[#4a4641] font-medium truncate flex-1">
            {{ currentPath }}
          </span>
        </div>
      </div>

      <!-- Right Action Tools -->
      <div class="flex items-center gap-1 text-[#5c5752]">
        <button
          class="p-1.5 hover:bg-[#d0cdc8] rounded cursor-pointer"
          title="Reload Data dari PostgreSQL"
          @click="inventoryStore.fetchFromDb"
        >
          <RotateCw :size="16" />
        </button>

        <!-- Toggle Split Cart / Keranjang Kasir Button (F3) -->
        <button
          class="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors"
          :class="showCartDrawer ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'"
          title="Buka / Tutup Keranjang Belanja Kasir (F3)"
          @click="showCartDrawer = !showCartDrawer"
        >
          <ShoppingCart :size="14" />
          <span>Cart ({{ posStore.cartItems.length }})</span>
        </button>

        <button
          class="p-1.5 hover:bg-[#d0cdc8] rounded cursor-pointer"
          title="Pengaturan"
          @click="activeTab = 'master'"
        >
          <Settings :size="16" />
        </button>
      </div>
    </header>

    <!-- Tab Bar (File Explorer Tabs like Nemo/PCManFM) -->
    <div class="flex items-center bg-[#d6d4cf] px-2 pt-1 border-b border-[#c2beba] gap-1 overflow-x-auto overflow-y-hidden">
      <!-- Add New Tab Button (+) -->
      <button
        class="p-1 text-gray-700 hover:text-black hover:bg-[#c6c2bd] rounded mb-1 cursor-pointer transition-colors"
        title="Buka Menu Baru / New Tab (+)"
        @click="openLauncherTab"
      >
        <Plus :size="15" />
      </button>

      <!-- Dynamic Open Tabs -->
      <div
        v-for="tabId in openTabIds"
        :key="tabId"
        class="group flex items-center gap-1.5 px-3 py-1 rounded-t border-t border-l border-r cursor-pointer text-xs font-medium transition-all shrink-0 select-none"
        :class="activeTab === tabId ? 'bg-[#ecebe9] border-[#b0aca5] text-black font-semibold shadow-xs' : 'bg-[#cac6c0] border-transparent text-gray-600 hover:bg-[#d0cdc8]'"
        @click="openTab(tabId)"
      >
        <!-- Icon & Label per tab -->
        <template v-if="tabId === 'pos'">
          <ShoppingCart :size="13" class="text-blue-600 shrink-0" />
          <span>Kasir POS ({{ posStore.selectedBuyer }})</span>
          <span v-if="posStore.cartItems.length > 0" class="bg-blue-600 text-white rounded-full px-1.5 text-[10px] font-bold">
            {{ posStore.cartItems.length }}
          </span>
        </template>
        <template v-else-if="tabId === 'discounts'">
          <Tag :size="13" class="text-rose-600 shrink-0" />
          <span>Diskon & Promo Kupon</span>
        </template>
        <template v-else-if="tabId === 'loyalty'">
          <CreditCard :size="13" class="text-amber-600 shrink-0" />
          <span>Loyalty & Kartu Member</span>
        </template>
        <template v-else-if="tabId === 'receiving'">
          <Truck :size="13" class="text-amber-600 shrink-0" />
          <span>Penerimaan Supplier (Nyetok)</span>
        </template>
        <template v-else-if="tabId === 'preorder'">
          <Calendar :size="13" class="text-emerald-600 shrink-0" />
          <span>Rekap Pre-Order Mingguan</span>
        </template>
        <template v-else-if="tabId === 'ledger'">
          <BookOpen :size="13" class="text-indigo-600 shrink-0" />
          <span>Buku Besar & Piutang</span>
          <span v-if="ledgerStore.totalReceivables > 0" class="bg-amber-500 text-black font-bold px-1 rounded text-[10px]">
            Tempo
          </span>
        </template>
        <template v-else-if="tabId === 'master'">
          <Settings :size="13" class="text-purple-600 shrink-0" />
          <span>Master SKU & Katalog</span>
        </template>

        <!-- Close Tab Button (x) -->
        <button
          type="button"
          class="hover:bg-gray-300 active:bg-gray-400 rounded p-0.5 ml-1 text-gray-500 hover:text-black cursor-pointer transition-colors"
          :title="`Tutup Tab ${tabId}`"
          @click="closeTab(tabId, $event)"
        >
          <X :size="11" />
        </button>
      </div>

      <!-- New Tab / Launcher Tab indicator if active -->
      <div
        v-if="activeTab === 'launcher'"
        class="flex items-center gap-1.5 px-3 py-1 rounded-t border-t border-l border-r bg-[#ecebe9] border-[#b0aca5] text-black font-semibold text-xs shadow-xs shrink-0 select-none"
      >
        <LayoutGrid :size="13" class="text-blue-600" />
        <span>Menu Aplikasi (Tab Baru)</span>
        <button
          type="button"
          class="hover:bg-gray-300 rounded p-0.5 ml-1 text-gray-500 hover:text-black cursor-pointer"
          title="Tutup"
          @click="activeTab = openTabIds[0] || 'pos'"
        >
          <X :size="11" />
        </button>
      </div>
    </div>

    <!-- Main File Manager Workspace (Center Content + Right Cart Drawer) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Center Content Area: Switched by Tab -->
      <main class="flex-1 flex flex-col bg-white overflow-hidden">
        <!-- 1. KASIR POS VIEW: Folder & File Explorer Tiles -->
        <div v-show="activeTab === 'pos'" class="flex-1 flex overflow-hidden">
          <!-- Center: Products Grid (Folder & Items) -->
          <div class="flex-1 flex flex-col overflow-hidden">
            <!-- Horizontal Category Filter Pills with Drag, Wheel, and Arrow Navigation -->
            <div class="relative flex items-center bg-[#f6f5f2] border-b border-gray-200 px-2 py-1 select-none shrink-0 group">
              <!-- Left Arrow Button -->
              <button
                type="button"
                class="p-1 bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-600 rounded border border-gray-300 shadow-2xs mr-1.5 shrink-0 cursor-pointer transition-colors"
                title="Geser ke kiri"
                @click="scrollCategory('left')"
              >
                <ChevronLeft :size="13" />
              </button>

              <span class="text-gray-500 font-bold text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-2">
                <Folder :size="13" class="text-amber-600" />
                <span>Kategori:</span>
              </span>

              <!-- Scrollable & Draggable Container (Scrollbar Hidden, Wheel & Buttons Active) -->
              <div
                ref="categoryScrollRef"
                class="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar text-xs flex-1 scroll-smooth py-0.5"
                @wheel="handleCategoryWheel"
                @mousedown="handleCategoryMouseDown"
                @mousemove="handleCategoryMouseMove"
                @mouseup="handleCategoryMouseUp"
                @mouseleave="handleCategoryMouseUp"
              >
                <button
                  type="button"
                  class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none"
                  :class="selectedCategory === 'Semua' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
                  @click="selectCategory('Semua')"
                >
                  Semua Barang ({{ inventoryStore.products.length }})
                </button>
                <button
                  v-for="cat in categories"
                  :key="cat"
                  type="button"
                  class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 flex items-center gap-1 select-none"
                  :class="selectedCategory === cat ? 'bg-blue-600 text-white font-bold shadow-xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
                  @click="selectCategory(cat)"
                >
                  <span>{{ cat }}</span>
                  <span class="text-[10px] opacity-75 font-mono">({{ inventoryStore.products.filter(p => p.category === cat).length }})</span>
                </button>
              </div>

              <!-- Right Arrow Button -->
              <button
                type="button"
                class="p-1 bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-600 rounded border border-gray-300 shadow-2xs ml-1.5 shrink-0 cursor-pointer transition-colors"
                title="Geser ke kanan"
                @click="scrollCategory('right')"
              >
                <ChevronRight :size="13" />
              </button>
            </div>

            <!-- Multiplier & Sub-Toolbar with Keyboard Controls Guide -->
            <div class="flex items-center justify-between px-3 py-1.5 bg-[#faf9f7] border-b border-gray-200 text-xs select-none">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5">
                  <span class="text-gray-500 font-medium">Beli Qty:</span>
                  <div class="flex gap-1">
                    <button
                      v-for="(m, i) in [1, 5, 10, 25, 50]"
                      :key="m"
                      class="px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center gap-0.5"
                      :class="activeMultiplier === m ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
                      :title="`Pilih Qty ${m} (Alt+${i+1})`"
                      @click="activeMultiplier = m"
                    >
                      <span>+{{ m }}</span>
                    </button>
                  </div>
                </div>

                <!-- Keyboard Nav Hints -->
                <div class="hidden lg:flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 border border-gray-200 rounded px-2 py-0.5 font-mono">
                  <span class="text-gray-400">Navigasi:</span>
                  <kbd class="px-1 bg-white border border-gray-300 rounded text-[10px] font-bold">↑</kbd>
                  <kbd class="px-1 bg-white border border-gray-300 rounded text-[10px] font-bold">↓</kbd>
                  <kbd class="px-1 bg-white border border-gray-300 rounded text-[10px] font-bold">←</kbd>
                  <kbd class="px-1 bg-white border border-gray-300 rounded text-[10px] font-bold">→</kbd>
                  <span class="text-gray-400 ml-1">Pilih | Masukkan:</span>
                  <kbd class="px-1.5 bg-blue-50 text-blue-700 border border-blue-300 rounded text-[10px] font-bold">Enter ↵</kbd>
                </div>
              </div>

              <div class="flex items-center gap-2">
                <button
                  class="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-1 rounded text-xs font-bold cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shadow-2xs transition-colors"
                  :disabled="!selectedProductId"
                  title="Masukkan barang terpilih ke keranjang (Enter)"
                  @click="handleAddSelected"
                >
                  <span>+ Tambah (+{{ activeMultiplier }})</span>
                  <kbd class="px-1 bg-blue-700 text-blue-100 rounded text-[9.5px] font-mono font-normal">Enter</kbd>
                </button>
              </div>
            </div>

            <!-- Folder & File Tiles Grid: Seamless Table-like Grid Cells (No outer padding, shared border lines) -->
            <div class="flex-1 overflow-y-auto">
              <!-- Empty state -->
              <div v-if="filteredProducts.length === 0" class="h-64 flex flex-col items-center justify-center text-gray-400 gap-2">
                <Folder :size="48" class="text-gray-300" />
                <p>Tidak ada barang yang cocok dalam folder ini.</p>
              </div>

              <!-- Icon Grid View: Seamless Table-Like Grid Cells (Garis Kotak Rapat Sambung Menyambung) -->
              <div
                v-else-if="viewMode === 'icons'"
                class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 border-b border-r border-[#d4d1cb] bg-white"
              >
                <div
                  v-for="prod in filteredProducts"
                  :key="prod.id"
                  class="flex flex-col items-center justify-between p-3 border-t border-l border-[#d4d1cb] bg-white hover:bg-blue-50/70 cursor-pointer transition-colors select-none group relative"
                  :class="selectedProductId === prod.id ? 'bg-[#ebf2ff] ring-2 ring-inset ring-blue-500 z-10 font-semibold' : ''"
                  @click="handleProductClick(prod)"
                  @dblclick="handleProductDoubleClick(prod)"
                >
                  <!-- File / Folder Graphic Icon with Stock in Top Tab & Unit in Center Label -->
                  <div class="relative w-16 h-14 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                    <!-- Folder Body -->
                    <div class="w-14 h-11 bg-gradient-to-b from-[#e8cf9b] to-[#cba366] rounded-md shadow-2xs border border-[#b89154] flex flex-col justify-end p-1">
                      <div
                        class="bg-[#f7eedc] h-5 rounded-xs flex items-center justify-center text-[10px] font-bold text-amber-950 truncate px-1"
                      >
                        {{ prod.unit }}
                      </div>
                    </div>

                    <!-- Folder Top Tab with Stock Number (Clean Paper Tab with Generous Height) -->
                    <div
                      class="absolute -top-0.5 left-2 min-w-7 px-1.5 h-3.5 rounded-t-sm border-t border-l border-r flex items-center justify-center text-[9px] font-bold font-mono tracking-tight shadow-2xs"
                      :class="prod.stock <= 10 ? 'bg-red-500 text-white border-red-600' : 'bg-white text-gray-800 border-[#b89154]'"
                      title="Sisa Stok Barang"
                    >
                      {{ prod.stock }}
                    </div>
                  </div>

                  <!-- Name Label -->
                  <span class="text-xs font-semibold text-center text-gray-800 line-clamp-2 leading-tight w-full mb-1.5">
                    {{ prod.name }}
                  </span>

                  <!-- Price Label at Bottom -->
                  <div class="mt-auto w-full flex justify-center items-center">
                    <span class="text-xs font-bold text-blue-600 font-mono">
                      Rp {{ formatRupiah(prod.lastSellPrice) }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- List Details View -->
              <div v-else class="border border-gray-200 rounded overflow-hidden">
                <table class="w-full text-xs text-left">
                  <thead class="bg-[#f0ede8] border-b border-gray-200 text-gray-600 font-semibold">
                    <tr>
                      <th class="p-2 w-20">KODE</th>
                      <th class="p-2">NAMA BARANG</th>
                      <th class="p-2 w-32">VENDOR</th>
                      <th class="p-2 w-20 text-center">SATUAN</th>
                      <th class="p-2 w-28 text-right">HARGA JUAL</th>
                      <th class="p-2 w-24 text-center">STOK</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="prod in filteredProducts"
                      :key="prod.id"
                      class="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
                      :class="selectedProductId === prod.id ? 'bg-blue-100 font-semibold' : ''"
                      @click="handleProductClick(prod)"
                      @dblclick="handleProductDoubleClick(prod)"
                    >
                      <td class="p-2 font-mono text-gray-500">{{ prod.code }}</td>
                      <td class="p-2 font-medium flex items-center gap-1.5">
                        <Folder :size="14" class="text-amber-500 shrink-0" />
                        <span>{{ prod.name }}</span>
                      </td>
                      <td class="p-2 text-gray-500">{{ prod.category }}</td>
                      <td class="p-2 text-center">{{ prod.unit }}</td>
                      <td class="p-2 text-right font-bold text-blue-600 font-mono">Rp {{ formatRupiah(prod.lastSellPrice) }}</td>
                      <td class="p-2 text-center font-mono">{{ prod.stock }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Right Struk Kasir (POS Cart Panel) -->
          <div
            v-if="showCartDrawer"
            class="w-[420px] border-l border-gray-300 bg-white flex flex-col shrink-0 shadow-lg"
          >
            <PosCart @show-receipt="handleShowReceipt" />
          </div>
        </div>

        <!-- 2. DISKON & PROMO VIEW -->
        <div v-if="activeTab === 'discounts'" class="flex-1 h-full overflow-y-auto bg-[#f8f7f5] p-4">
          <MasterDiscountTab />
        </div>

        <!-- 3. LOYALTY & MEMBER VIEW -->
        <div v-if="activeTab === 'loyalty'" class="flex-1 h-full overflow-y-auto bg-[#f8f7f5] p-4">
          <MasterMemberTab />
        </div>

        <!-- 4. PENERIMAAN SUPPLIER VIEW (Nyetok Inbound) -->
        <div v-if="activeTab === 'receiving'" class="flex-1 overflow-hidden">
          <SupplierReceiving />
        </div>

        <!-- 5. REKAP PRE-ORDER VIEW -->
        <div v-if="activeTab === 'preorder'" class="flex-1 overflow-hidden">
          <PreOrderMatrix @switch-to-pos="activeTab = 'pos'" />
        </div>

        <!-- 6. BUKU BESAR & PIUTANG VIEW -->
        <div v-if="activeTab === 'ledger'" class="flex-1 overflow-hidden">
          <LedgerView @view-receipt="handleViewReceiptFromLedger" />
        </div>

        <!-- 7. MASTER & MARKUP VIEW -->
        <div v-if="activeTab === 'master'" class="flex-1 overflow-hidden">
          <MasterProducts />
        </div>

        <!-- 6. LAUNCHER VIEW: Folder Tiles like Nemo/PCManFM (Gambar 2) -->
        <div v-if="activeTab === 'launcher'" class="flex-1 flex flex-col bg-[#fdfdfc] overflow-y-auto p-8 select-none">
          <div class="max-w-5xl mx-auto w-full space-y-6">
            <!-- Header Section -->
            <div class="border-b border-gray-200 pb-4">
              <h2 class="text-base font-bold text-gray-800 flex items-center gap-2">
                <FolderOpen :size="20" class="text-amber-600" />
                <span>Pilih Menu untuk Dibuka di Tab</span>
              </h2>
              <p class="text-xs text-gray-500 mt-1">
                Klik pada folder menu di bawah ini untuk membuka halaman dalam tab kerja kasir.
              </p>
            </div>

            <!-- Folder Tiles Grid (Mirip Gambar 2) -->
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
              <div
                v-for="menu in availableMenuItems"
                :key="menu.id"
                class="flex flex-col items-center p-3 rounded-lg hover:bg-[#edf2fd] hover:shadow-xs border border-transparent hover:border-blue-300 cursor-pointer transition-all group"
                @click="openTab(menu.id)"
              >
                <!-- Folder Graphic Icon (Gambar 2) -->
                <div class="relative w-20 h-16 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                  <!-- Folder Back & Front with Realistic Shadow -->
                  <div
                    class="w-16 h-13 bg-gradient-to-b rounded-md shadow-xs border border-[#b89154]/80 flex flex-col justify-end p-1.5"
                    :class="menu.folderColor"
                  >
                    <!-- Inner Paper sheet peeking -->
                    <div class="bg-white/95 h-6 rounded-xs flex items-center justify-center shadow-2xs">
                      <component :is="menu.icon" :size="14" :class="menu.iconColor" />
                    </div>
                  </div>
                  <!-- Folder Top Ear Tab -->
                  <div
                    class="absolute top-1 left-2.5 w-7 h-2.5 rounded-t border-t border-l border-r border-[#b89154]/80"
                    :class="menu.folderColor"
                  ></div>

                  <!-- Status Badge if tab is already open -->
                  <span
                    v-if="openTabIds.includes(menu.id)"
                    class="absolute -top-1 -right-1 px-1.5 py-0.2 bg-blue-600 text-white rounded-full text-[9px] font-bold shadow-2xs"
                    title="Sudah terbuka di tab"
                  >
                    Terbuka
                  </span>
                </div>

                <!-- Folder Name -->
                <span class="text-xs font-bold text-center text-gray-800 group-hover:text-blue-700 leading-tight">
                  {{ menu.title }}
                </span>

                <!-- Description -->
                <span class="text-[10px] text-gray-400 text-center line-clamp-2 mt-1 leading-snug">
                  {{ menu.description }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Bottom Status Bar (Desktop File Manager style) -->
    <footer class="flex items-center justify-between px-3 py-1 bg-[#dfddd9] border-t border-[#c8c5c0] text-[11px] text-[#5c5752] shrink-0 font-mono">
      <div class="flex items-center gap-3">
        <template v-if="activeTab === 'loyalty'">
          <span>{{ buyerStore.memberBuyers.length }} member terdaftar</span>
        </template>
        <template v-else-if="activeTab === 'discounts'">
          <span>{{ discountStore.discounts.length }} kupon promo ({{ discountStore.activeDiscounts.length }} aktif)</span>
        </template>
        <template v-else>
          <span>{{ filteredProducts.length }} barang ({{ selectedProductId ? '1 dipilih' : '0 dipilih' }})</span>
        </template>
      </div>

      <div class="flex items-center gap-4">
        <template v-if="activeTab === 'loyalty'">
          <span class="text-amber-800 font-bold">Program Loyalitas & Kartu ID-1 ISO 7810</span>
        </template>
        <template v-else-if="activeTab === 'discounts'">
          <span class="text-rose-700 font-bold">Manajemen Diskon & Kupon Promosi</span>
        </template>
        <template v-else>
          <span>Pembeli: <strong>{{ posStore.selectedBuyer }}</strong></span>
          <span class="text-blue-700 font-bold text-xs">
            Total Struk: Rp {{ formatRupiah(posStore.totalSell) }}
          </span>
        </template>
      </div>
    </footer>

    <!-- Invoice Receipt Modal -->
    <ReceiptModal
      v-if="activeModalTransaction"
      :transaction="activeModalTransaction"
      @close="activeModalTransaction = null"
    />
  </div>
</template>
