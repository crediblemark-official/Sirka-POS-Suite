<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePosStore } from '../../stores/posStore';
import { SupplierCategory, Product } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { getCategoryTheme } from '../../utils/categoryColor';
import {
  Folder,
  Sparkles,
  Coins,
  Plus,
  Minus,
  LayoutGrid,
  List,
  Layers,
  AlertCircle
} from 'lucide-vue-next';
import AppEmptyState from '../common/AppEmptyState.vue';
import CashInflowModal from './CashInflowModal.vue';
import { demoDataService } from '../../services/demoDataService';
import { useModalLock } from '../../composables/useModalLock';

const props = withDefaults(defineProps<{
  searchQuery?: string;
  viewMode?: 'icons' | 'list';
  isActive?: boolean;
}>(), {
  searchQuery: '',
  viewMode: 'icons',
  isActive: true
});

const emit = defineEmits<{
  (e: 'category-changed', cat: SupplierCategory | 'Semua'): void;
}>();

const inventoryStore = useInventoryStore();
const posStore = usePosStore();
const { isAnyModalOpen } = useModalLock();

// State
const selectedCategory = ref<SupplierCategory | 'Semua'>('Semua');
const selectedProductId = ref<string | null>(null);
const activeMultiplier = ref<number>(1);
const isLoadingDemo = ref(false);
const showCashInflowModal = ref(false);
const currentViewMode = ref<'icons' | 'list'>(props.viewMode || 'icons');

// Toggle View Mode
function toggleViewMode() {
  currentViewMode.value = currentViewMode.value === 'icons' ? 'list' : 'icons';
}

async function handleLoadDemo() {
  isLoadingDemo.value = true;
  try {
    await demoDataService.loadDemoData();
  } catch (err) {
    console.error('Failed to load demo:', err);
  } finally {
    isLoadingDemo.value = false;
  }
}

// Barcode scanner USB HID engine
const scanBuffer = ref('');
const scanFeedback = ref<'ok' | 'notfound' | null>(null);
const lastCharAt = ref(0);
const SCAN_GAP_MS = 80;

function handleScanBuffer(e: KeyboardEvent) {
  const now = Date.now();
  if (now - lastCharAt.value > SCAN_GAP_MS) {
    scanBuffer.value = e.key;
  } else {
    scanBuffer.value += e.key;
  }
  lastCharAt.value = now;
}

interface ScanResult {
  product: Product;
  unitName?: string;
}

function lookupByBarcode(buffer: string): ScanResult | undefined {
  const key = buffer.trim();
  if (!key) return undefined;
  const prods = inventoryStore.products;

  for (const p of prods) {
    if ((p.barcode || '').trim() === key || p.code.trim().toUpperCase() === key.toUpperCase()) {
      return { product: p };
    }
    if (p.units && Array.isArray(p.units)) {
      const matchUnit = p.units.find(u => (u.barcode || '').trim() === key);
      if (matchUnit) {
        return { product: p, unitName: matchUnit.unitName };
      }
    }
  }
  return undefined;
}

function commitScanBuffer() {
  const buffer = scanBuffer.value;
  scanBuffer.value = '';
  if (!buffer) return;
  const match = lookupByBarcode(buffer);
  if (match) {
    posStore.addProductToCart(match.product, 1, match.unitName);
    selectedProductId.value = match.product.id;
    scanFeedback.value = 'ok';
  } else {
    scanFeedback.value = 'notfound';
  }
  setTimeout(() => { scanFeedback.value = null; }, 1600);
}

const categoryScrollRef = ref<HTMLDivElement | null>(null);
const categories = computed(() => inventoryStore.categoryMarkups.map(c => c.category));

function getProductTheme(prod: Product) {
  const customColor = inventoryStore.getCategoryColor(prod.category);
  return getCategoryTheme(prod.category, customColor);
}

function getCategoryColorTheme(cat: SupplierCategory) {
  const customColor = inventoryStore.getCategoryColor(cat);
  return getCategoryTheme(cat, customColor);
}

function selectCategory(cat: SupplierCategory | 'Semua') {
  selectedCategory.value = cat;
  emit('category-changed', cat);
}

const filteredProducts = computed(() => {
  const q = (props.searchQuery || '').trim().toLowerCase();
  return inventoryStore.products.filter(p => {
    const matchCat = selectedCategory.value === 'Semua' || p.category === selectedCategory.value;
    if (!q) return matchCat;
    const matchSearch =
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });
});

const selectedProduct = computed(() => {
  if (!selectedProductId.value) return null;
  return inventoryStore.products.find(p => p.id === selectedProductId.value) || null;
});

// Dynamic Multiplier options
const dynamicMultipliers = computed(() => {
  const prod = selectedProduct.value;
  const unit = prod?.unit?.toUpperCase() || '';

  if (unit === 'KG' || unit === 'LITER' || unit === 'LTR') {
    return [
      { label: '¼ kg', value: 0.25 },
      { label: '½ kg', value: 0.5 },
      { label: '1 kg', value: 1 },
      { label: '2 kg', value: 2 },
      { label: '5 kg', value: 5 }
    ];
  }

  return [
    { label: '+1', value: 1 },
    { label: '+2', value: 2 },
    { label: '+5', value: 5 },
    { label: '+10', value: 10 }
  ];
});

watch(filteredProducts, (newProds) => {
  if (newProds.length > 0) {
    const isStillInList = newProds.some(p => p.id === selectedProductId.value);
    if (!isStillInList) {
      selectedProductId.value = newProds[0].id;
    }
  } else {
    selectedProductId.value = '';
  }
}, { immediate: true });

// Cek kuantiti barang di keranjang saat ini
function getCartItemQty(productId: string): number {
  const item = posStore.cartItems.find(i => i.productId === productId);
  return item ? item.qty : 0;
}

// Tambah produk ke keranjang langsung (One-Tap Touch)
function handleAddProductDirect(prod: Product, e?: Event) {
  if (e) e.stopPropagation();
  selectedProductId.value = prod.id;
  posStore.addProductToCart(prod, activeMultiplier.value);
}

// Kurangi kuantiti langsung dari kartu
function handleReduceProductDirect(prod: Product, e?: Event) {
  if (e) e.stopPropagation();
  const item = posStore.cartItems.find(i => i.productId === prod.id);
  if (item) {
    const step = (prod.unit === 'KG' || prod.unit === 'LITER') ? 0.25 : 1;
    const newQty = item.qty - step;
    if (newQty <= 0) {
      posStore.removeItem(item.id);
    } else {
      posStore.updateItemQty(item.id, newQty);
    }
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (!props.isActive || isAnyModalOpen.value) return;
  const target = e.target as HTMLElement | null;
  const inInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

  if (e.key === 'Enter') {
    if (scanBuffer.value.length >= 3) {
      commitScanBuffer();
      e.preventDefault();
      return;
    }
    if (!inInput && selectedProductId.value) {
      const prod = filteredProducts.value.find(p => p.id === selectedProductId.value);
      if (prod) {
        posStore.addProductToCart(prod, activeMultiplier.value);
        e.preventDefault();
      }
    }
    return;
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey && !inInput) {
    handleScanBuffer(e);
  }
}

function handleAddSelected() {
  if (!selectedProductId.value) return;
  const prod = filteredProducts.value.find(p => p.id === selectedProductId.value);
  if (prod) {
    posStore.addProductToCart(prod, activeMultiplier.value);
  }
}

function navigateProducts(direction: 'right' | 'left' | 'down' | 'up') {
  const prods = filteredProducts.value;
  if (prods.length === 0) return;

  const currentIndex = prods.findIndex(p => p.id === selectedProductId.value);
  const cols = 2; // mobile catalog 2 columns
  let targetIdx = currentIndex;

  if (direction === 'right') {
    targetIdx = currentIndex < prods.length - 1 ? currentIndex + 1 : 0;
  } else if (direction === 'left') {
    targetIdx = currentIndex > 0 ? currentIndex - 1 : prods.length - 1;
  } else if (direction === 'down') {
    if (currentIndex + cols < prods.length) {
      targetIdx = currentIndex + cols;
    } else if (currentIndex < prods.length - 1) {
      targetIdx = currentIndex + 1;
    } else {
      targetIdx = 0;
    }
  } else if (direction === 'up') {
    if (currentIndex - cols >= 0) {
      targetIdx = currentIndex - cols;
    } else if (currentIndex > 0) {
      targetIdx = currentIndex - 1;
    } else {
      targetIdx = prods.length - 1;
    }
  }

  if (targetIdx >= 0 && targetIdx < prods.length) {
    selectedProductId.value = prods[targetIdx].id;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

defineExpose({
  selectCategory,
  handleAddSelected,
  navigateProducts
});
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-slate-50 select-none text-xs">
    <!-- 1. Mobile Category Filter Chips (Horizontal Smooth Momentum Scroll) -->
    <div class="bg-white border-b border-slate-200 px-3 py-2 shrink-0 shadow-2xs">
      <div
        ref="categoryScrollRef"
        class="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x"
      >
        <!-- Chip: Semua Barang -->
        <button
          type="button"
          class="px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95 flex items-center gap-1.5"
          :class="selectedCategory === 'Semua'
            ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'"
          @click="selectCategory('Semua')"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>Semua ({{ inventoryStore.products.length }})</span>
        </button>

        <!-- Chip: Kategori Dinamis -->
        <button
          v-for="cat in categories"
          :key="cat"
          type="button"
          class="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95 flex items-center gap-1.5 border"
          :class="selectedCategory === cat
            ? 'bg-slate-900 text-white shadow-sm border-slate-900 ring-2 ring-slate-400'
            : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'"
          @click="selectCategory(cat)"
        >
          <span
            class="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
            :style="{ backgroundColor: getCategoryColorTheme(cat).hex }"
          ></span>
          <span>{{ cat }}</span>
          <span class="text-[10px] opacity-70 font-mono">
            ({{ inventoryStore.products.filter(p => p.category === cat).length }})
          </span>
        </button>
      </div>
    </div>

    <!-- 2. Mobile Quick Sub-Toolbar (Multiplier & Fast Tip/Infaq) -->
    <div class="bg-slate-100/90 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
      <!-- Quick Multiplier Selector -->
      <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Qty:</span>
        <div class="flex items-center gap-1 shrink-0">
          <button
            v-for="opt in dynamicMultipliers"
            :key="opt.value"
            type="button"
            class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-95"
            :class="activeMultiplier === opt.value
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'"
            @click="activeMultiplier = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Right Actions: Infaq/Tip & Grid/List Switcher -->
      <div class="flex items-center gap-1.5 shrink-0 ml-auto">
        <!-- Scan Feedback Toast -->
        <span
          v-if="scanFeedback"
          class="px-2 py-0.5 rounded text-[10px] font-bold animate-in fade-in duration-150"
          :class="scanFeedback === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'"
        >
          {{ scanFeedback === 'ok' ? '✓ Masuk' : '✗ Tidak ada' }}
        </span>

        <!-- Catat Infaq / Tip -->
        <button
          type="button"
          class="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
          @click="showCashInflowModal = true"
          title="Catat Infaq / Kas Masuk Non-Jual"
        >
          <Coins class="w-3.5 h-3.5 text-emerald-600" />
          <span class="hidden xs:inline">+ Tip</span>
        </button>

        <!-- Toggle View Mode (Grid Card vs List Table) -->
        <button
          type="button"
          class="p-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer active:scale-95 shadow-2xs"
          :title="currentViewMode === 'icons' ? 'Beralih ke Tabel' : 'Beralih ke Kartu Grid'"
          @click="toggleViewMode"
        >
          <List v-if="currentViewMode === 'icons'" class="w-4 h-4 text-slate-600" />
          <LayoutGrid v-else class="w-4 h-4 text-slate-600" />
        </button>
      </div>
    </div>

    <!-- 3. Main Catalog View Area (Full Edge-to-Edge) -->
    <div class="flex-1 overflow-y-auto touch-pan-y pb-28">
      <!-- Empty State: Katalog Kosong -->
      <div v-if="inventoryStore.products.length === 0" class="p-4">
        <AppEmptyState
          :icon="Sparkles"
          title="Katalog Produk Masih Kosong"
          description="Database belum memiliki data barang. Anda dapat memuat data percontohan untuk langsung mencoba transaksi kasir mobile."
        >
          <button
            type="button"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-lg bg-blue-600 hover:bg-blue-700 cursor-pointer transition-all active:scale-95 disabled:opacity-50 mt-2"
            :disabled="isLoadingDemo"
            @click="handleLoadDemo"
          >
            <Sparkles class="w-4 h-4" :class="{ 'animate-spin': isLoadingDemo }" />
            <span>{{ isLoadingDemo ? 'Memuat Data Demo...' : 'Muat Data Demo Kasir' }}</span>
          </button>
        </AppEmptyState>
      </div>

      <!-- Empty State: Filter Tidak Cocok -->
      <div v-else-if="filteredProducts.length === 0" class="p-4">
        <AppEmptyState
          :icon="Folder"
          title="Tidak ada barang yang cocok"
          description="Coba pilih kategori lain atau periksa kata kunci pencarian Anda"
        />
      </div>

      <!-- A. DESKTOP-STYLE BORDER GRID VIEW (Full Edge-to-Edge) -->
      <div
        v-else-if="currentViewMode === 'icons'"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 bg-white w-full border-t border-b border-slate-200"
      >
        <div
          v-for="prod in filteredProducts"
          :key="prod.id"
          :data-product-id="prod.id"
          class="flex flex-col items-center justify-between p-2.5 sm:p-3 border-b border-r border-slate-200 cursor-pointer transition-all select-none relative overflow-hidden group active:scale-[0.98] active:brightness-92 min-h-[145px]"
          :style="{
            backgroundColor: selectedProductId === prod.id
              ? (getProductTheme(prod).badgeBg || '#e0f2fe')
              : (getProductTheme(prod).bgLightHex || '#ffffff')
          }"
          :class="[
            selectedProductId === prod.id
              ? 'ring-2 ring-inset ring-blue-600 z-10 font-bold'
              : 'hover:brightness-96'
          ]"
          @click="handleAddProductDirect(prod)"
        >
          <!-- Graphic Icon with Stock in Top Tab & Unit in Center Label (Desktop Parity) -->
          <div class="relative w-16 h-13 flex items-center justify-center mb-1.5 mt-0.5 group-hover:scale-105 transition-transform shrink-0">
            <!-- Folder Body with Category Gradient -->
            <div
              class="w-14 h-11 rounded-lg shadow-2xs border flex flex-col justify-end p-1 transition-colors"
              :style="{
                background: `linear-gradient(to bottom, ${getProductTheme(prod).gradientFrom}, ${getProductTheme(prod).gradientTo})`,
                borderColor: getProductTheme(prod).borderHex
              }"
            >
              <!-- Center Unit Label inside Folder -->
              <div
                class="h-5 rounded-xs flex items-center justify-center text-[10px] font-extrabold truncate px-1 transition-colors uppercase tracking-tight"
                :style="{
                  backgroundColor: '#ffffff',
                  color: getProductTheme(prod).badgeText
                }"
              >
                {{ prod.unit }}
              </div>
            </div>

            <!-- Top Tab with Stock Number -->
            <div
              class="absolute -top-1 left-2 min-w-7 px-1.5 h-4 rounded-t-sm border-t border-l border-r flex items-center justify-center text-[9px] font-bold font-mono tracking-tight shadow-2xs"
              :class="prod.stock <= 5 ? 'bg-red-500 text-white border-red-600' : 'bg-white text-gray-800'"
              :style="prod.stock > 5 ? { borderColor: getProductTheme(prod).borderHex } : {}"
              title="Sisa Stok Barang"
            >
              {{ prod.stock }}
            </div>
          </div>

          <!-- Product Name -->
          <span class="text-xs font-bold text-center text-slate-900 line-clamp-2 leading-tight w-full mb-1">
            {{ prod.name }}
          </span>

          <!-- Price & In-Cart Count at Bottom (e.g. "Rp 52.500 x 3") -->
          <div class="mt-auto w-full flex justify-center items-center gap-1.5 pt-0.5 flex-wrap">
            <span class="text-sm font-black text-slate-900 font-mono tracking-tight">
              Rp {{ formatRupiah(prod.lastSellPrice) }}
            </span>
            <span
              v-if="getCartItemQty(prod.id) > 0"
              class="text-xs font-black font-mono text-blue-700 bg-blue-100/90 px-1.5 py-0.5 rounded-md border border-blue-300 shadow-2xs animate-scale-in inline-flex items-center"
            >
              x {{ getCartItemQty(prod.id) }}
            </span>
          </div>
        </div>
      </div>

      <!-- B. LIST TABLE VIEW (Struktur Data Tabel Utuh 100% Sesuai Instruksi) -->
      <div v-else class="bg-white border-t border-b border-slate-200 shadow-xs overflow-hidden">
        <div class="overflow-x-auto no-scrollbar">
          <table class="w-full text-xs text-left">
            <thead class="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10.5px]">
              <tr>
                <th class="p-2.5 w-24">KODE</th>
                <th class="p-2.5">NAMA BARANG</th>
                <th class="p-2.5 w-28">KATEGORI</th>
                <th class="p-2.5 w-20 text-center">SATUAN</th>
                <th class="p-2.5 w-28 text-right">HARGA JUAL</th>
                <th class="p-2.5 w-20 text-center">STOK</th>
                <th class="p-2.5 w-16 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="prod in filteredProducts"
                :key="prod.id"
                :data-product-id="prod.id"
                class="hover:bg-blue-50/50 cursor-pointer transition-colors"
                :class="selectedProductId === prod.id ? 'bg-blue-50/70 font-semibold' : ''"
                @click="handleAddProductDirect(prod)"
              >
                <td class="p-2.5 font-mono text-slate-500 font-bold text-[11px]">{{ prod.code }}</td>
                <td class="p-2.5 font-bold text-slate-800">{{ prod.name }}</td>
                <td class="p-2.5 text-slate-600 truncate max-w-[120px]">{{ prod.category }}</td>
                <td class="p-2.5 text-center">
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                    {{ prod.unit }}
                  </span>
                </td>
                <td class="p-2.5 text-right font-mono font-bold text-slate-900">
                  <div class="inline-flex items-center justify-end gap-1.5">
                    <span>Rp {{ formatRupiah(prod.lastSellPrice) }}</span>
                    <span
                      v-if="getCartItemQty(prod.id) > 0"
                      class="text-[10.5px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-md border border-blue-300 shadow-2xs"
                    >
                      x{{ getCartItemQty(prod.id) }}
                    </span>
                  </div>
                </td>
                <td class="p-2.5 text-center font-mono">
                  <span
                    class="px-2 py-0.5 rounded text-[10.5px] font-bold"
                    :class="prod.stock <= 5 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'"
                  >
                    {{ prod.stock }}
                  </span>
                </td>
                <td class="p-2.5 text-center" @click.stop>
                  <button
                    type="button"
                    class="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 active:scale-95 transition cursor-pointer"
                    @click="handleAddProductDirect(prod)"
                  >
                    + Beli
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Cash Inflow Tip / Non-Sales Modal -->
    <CashInflowModal
      :is-open="showCashInflowModal"
      @close="showCashInflowModal = false"
    />
  </div>
</template>
