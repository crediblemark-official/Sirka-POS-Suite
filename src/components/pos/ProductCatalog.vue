<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePosStore } from '../../stores/posStore';
import { SupplierCategory, Product } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { getCategoryTheme } from '../../utils/categoryColor';
import {
  Folder,
  ChevronLeft,
  ChevronRight,
  Barcode,
  Sparkles,
  Coins
} from 'lucide-vue-next';
import AppEmptyState from '../common/AppEmptyState.vue';
import CashInflowModal from './CashInflowModal.vue';
import { demoDataService } from '../../services/demoDataService';
import { useModalLock } from '../../composables/useModalLock';
import { useResponsive } from '../../composables/useResponsive';

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
const { isMobile, isTouchDevice } = useResponsive();

const selectedCategory = ref<SupplierCategory | 'Semua'>('Semua');
const selectedProductId = ref<string | null>(null);
const activeMultiplier = ref<number>(1);
const isLoadingDemo = ref(false);
const showCashInflowModal = ref(false);

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

// BUG-016 FIX: Barcode scanner engine (USB HID memaku sesuai "ketikan cepat diikuti Enter")
const scanBuffer = ref('');
const scanning = ref(false);          // status "sedang scan" untuk UI feedback
const scanFeedback = ref<'ok' | 'notfound' | null>(null);
const lastCharAt = ref(0);
const SCAN_GAP_MS = 80;               // gap antar karakter; lebih dari ini = manusia mengetik

function handleScanBuffer(e: KeyboardEvent) {
  const now = Date.now();
  if (now - lastCharAt.value > SCAN_GAP_MS) {
    scanBuffer.value = e.key;         // gap panjang → mulai buffer baru
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

  // 1. Cek barcode base product atau SKU
  for (const p of prods) {
    if ((p.barcode || '').trim() === key || p.code.trim().toUpperCase() === key.toUpperCase()) {
      return { product: p };
    }
    // 2. Cek barcode kemasan sekunder (misal scan barcode di kardus DUS)
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
  scanning.value = false;
  setTimeout(() => { scanFeedback.value = null; }, 1600);
}

// Category Scroll & Drag state
const categoryScrollRef = ref<HTMLDivElement | null>(null);
const isDraggingCategory = ref(false);
const startX = ref(0);
const scrollLeftStart = ref(0);

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
  return inventoryStore.products.filter(p => {
    const matchCat = selectedCategory.value === 'Semua' || p.category === selectedCategory.value;
    const q = (props.searchQuery || '').toLowerCase().trim();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q) ||
      (p.barcode || '').toLowerCase().includes(q);
    return matchCat && matchSearch;
  });
});

const selectedProduct = computed(() => {
  if (!selectedProductId.value) return null;
  return inventoryStore.products.find(p => p.id === selectedProductId.value) || null;
});

// Multiplier dinamis yang otomatis menyesuaikan satuan produk yang sedang dipilih kasir (Kiloan vs Satuan Bijian)
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
    { label: '+5', value: 5 },
    { label: '+10', value: 10 },
    { label: '+25', value: 25 },
    { label: '+50', value: 50 }
  ];
});

// BUG FIX: peta pengali shortcut Alt+N harus IKUT daftar di atas.
// Sebelumnya hard-coded {1:1, 2:5, 3:10, 4:25, 5:50} (daftar satuan bijian),
// sehingga untuk produk KG tombol "Alt+2" yang berlabel "½ kg" sebenarnya
// menambah 5 kg (10x lebih banyak dari yang dimaksud kasir).
const dynamicMultiplierMap = computed(() => {
  const map: Record<string, number> = {};
  dynamicMultipliers.value.forEach((m, idx) => {
    map[String(idx + 1)] = m.value;
  });
  return map;
});

// BUG FIX: Jaga agar selectedProductId selalu sinkron dengan filteredProducts.
// Begitu hasil pencarian atau filter kategori berubah, produk pertama langsung terpilih otomatis.
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

watch(selectedProductId, (newId) => {
  const unit = selectedProduct.value?.unit?.toUpperCase();
  const isMetric = unit === 'KG' || unit === 'LITER' || unit === 'LTR';
  // BUG FIX: pengali harus divalidasi ulang terhadap daftar pengali yang valid
  // untuk produk yang dipilih. Sebelumnya hanya di-reset bila nilainya < 1,
  // sehingga "+50" dari produk bijian masih aktif setelah pindah ke produk KG
  // (kasir menambah 50 kg) dan sebaliknya.
  const valid = dynamicMultipliers.value.map(m => m.value);
  if (!valid.includes(activeMultiplier.value)) {
    activeMultiplier.value = isMetric ? 1 : 1;
  }

  // Scroll otomatis produk yang terpilih ke viewport saat navigasi keyboard
  if (newId) {
    nextTick(() => {
      const el = document.querySelector(`[data-product-id="${newId}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
    });
  }
});

function handleProductClick(prod: Product) {
  selectedProductId.value = prod.id;
  if (isMobile.value || isTouchDevice.value) {
    posStore.addProductToCart(prod, activeMultiplier.value);
  }
}

function handleProductDoubleClick(prod: Product) {
  posStore.addProductToCart(prod, activeMultiplier.value);
}

function handleAddSelected() {
  if (!selectedProductId.value) return;
  // BUG FIX: Hanya ambil dari filteredProducts yang sedang tampil di layar
  const prod = filteredProducts.value.find(p => p.id === selectedProductId.value);
  if (prod) {
    posStore.addProductToCart(prod, activeMultiplier.value);
  }
}

function navigateProducts(direction: 'right' | 'left' | 'down' | 'up') {
  const prods = filteredProducts.value;
  if (prods.length === 0) return;

  const currentIndex = prods.findIndex(p => p.id === selectedProductId.value);
  const screenWidth = window.innerWidth;
  const cols = props.viewMode === 'list' ? 1 : (screenWidth >= 1280 ? 6 : screenWidth >= 1024 ? 5 : screenWidth >= 768 ? 4 : 3);

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

function selectNextProduct() {
  navigateProducts('right');
}

function selectPrevProduct() {
  navigateProducts('left');
}

function handleCategoryWheel(e: WheelEvent) {
  if (!categoryScrollRef.value) return;
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
  const walk = (x - startX.value) * 1.5;
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

function handleKeyDown(e: KeyboardEvent) {
  if (!props.isActive) return;
  // BUG FIX: jangan proses shortcut katalog ketika ada modal terbuka
  // (mis. modal pembayaran). Sebelumnya Enter untuk "selesaikan pembayaran"
  // ALSO menambah produk katalog terpilih ke keranjang -> pelanggan ditagih
  // barang yang tidak pernah diminta.
  if (isAnyModalOpen.value) return;
  const activeEl = document.activeElement;
  const isInputActive = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || activeEl instanceof HTMLSelectElement;
  if (isInputActive) {
    return;
  }

  const prods = filteredProducts.value;

  // --- BUG-016 FIX: Pipeline scanner barcode ---
  // 1) Karakter alfanumerik tunggal dari scanner ditaruh di buffer berkecepatan tinggi
  //    BUG FIX: Space (e.key === ' ') juga punya panjang 1 sehingga sebelumnya
  //    tertangkap buffer scanner dan shortcut "tambah barang" jadi tidak pernah jalan.
  if (e.key.length === 1 && e.key !== ' ' && !e.altKey && !e.ctrlKey && !e.metaKey) {
    handleScanBuffer(e);
    scanning.value = true;
    // scanning menangkap '1' (mis. nama barcode) tanpa mengganggu shortcut Alt+N
    return;
  }

  // 2) Enter di akhir sesi scanner (gap sangat kecil) = scan; selain itu = perilaku bawaan
  if (e.key === 'Enter') {
    const isScan = scanBuffer.value.length >= 2 && (Date.now() - lastCharAt.value) <= SCAN_GAP_MS;
    if (isScan) {
      e.preventDefault();
      commitScanBuffer();
      return;
    }
    scanBuffer.value = '';
    scanning.value = false;
    if (prods.length === 0) return;
    // bawaan: tambah barang terpilih
    e.preventDefault();
    handleAddSelected();
    return;
  }

  if (prods.length === 0) return;

  if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigateProducts('right');
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigateProducts('left');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    navigateProducts('down');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    navigateProducts('up');
  } else if (['1', '2', '3', '4', '5'].includes(e.key) && (e.altKey || (!e.ctrlKey && !e.metaKey))) {
    const multiplierMap = dynamicMultiplierMap.value;
    if (e.altKey && multiplierMap[e.key] !== undefined) {
      e.preventDefault();
      activeMultiplier.value = multiplierMap[e.key];
    }
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
  navigateProducts,
  selectNextProduct,
  selectPrevProduct
});
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-white select-none text-xs">
    <!-- Horizontal Category Filter Pills with Drag, Wheel, and Arrow Navigation -->
    <div
      class="catalog-ribbon relative flex items-center border-b px-2 py-1 select-none shrink-0 group"
      style="background-color: var(--surface-ribbon); border-color: var(--surface-ribbon-border);"
    >
      <!-- Left Arrow Button (Desktop only) -->
      <button
        type="button"
        class="catalog-nav-arrow hidden sm:flex p-1 bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-600 rounded border border-gray-300 shadow-2xs mr-1.5 shrink-0 cursor-pointer transition-colors"
        title="Geser ke kiri"
        @click="scrollCategory('left')"
      >
        <ChevronLeft :size="13" />
      </button>

      <span class="catalog-ribbon-label text-gray-500 font-bold text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1.5 sm:mr-2">
        <Folder :size="13" class="text-amber-600" />
        <span class="hidden xs:inline">Kategori:</span>
      </span>

      <!-- Scrollable & Draggable Container -->
      <div
        ref="categoryScrollRef"
        class="flex items-center gap-1.5 overflow-x-auto overflow-y-hidden no-scrollbar text-xs flex-1 scroll-smooth py-0.5 touch-pan-x"
        @wheel="handleCategoryWheel"
        @mousedown="handleCategoryMouseDown"
        @mousemove="handleCategoryMouseMove"
        @mouseup="handleCategoryMouseUp"
        @mouseleave="handleCategoryMouseUp"
      >
        <button
          type="button"
          class="catalog-category-btn px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none whitespace-nowrap"
          :class="selectedCategory === 'Semua' ? 'active text-white font-bold shadow-xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
          :style="selectedCategory === 'Semua' ? 'background-color: var(--brand-primary);' : ''"
          @click="selectCategory('Semua')"
        >
          Semua Barang ({{ inventoryStore.products.length }})
        </button>
        <button
          v-for="cat in categories"
          :key="cat"
          type="button"
          class="catalog-category-btn px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 flex items-center gap-1.5 select-none whitespace-nowrap"
          :class="selectedCategory === cat ? 'active text-white font-bold shadow-xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
          :style="selectedCategory === cat ? 'background-color: var(--brand-primary);' : ''"
          @click="selectCategory(cat)"
        >
          <span
            class="w-2 h-2 rounded-full shrink-0 shadow-2xs"
            :style="{ backgroundColor: getCategoryColorTheme(cat).hex }"
          ></span>
          <span>{{ cat }}</span>
          <span class="text-[10px] opacity-75 font-mono">({{ inventoryStore.products.filter(p => p.category === cat).length }})</span>
        </button>
      </div>

      <!-- Right Arrow Button (Desktop only) -->
      <button
        type="button"
        class="catalog-nav-arrow hidden sm:flex p-1 bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-600 rounded border border-gray-300 shadow-2xs ml-1.5 shrink-0 cursor-pointer transition-colors"
        title="Geser ke kanan"
        @click="scrollCategory('right')"
      >
        <ChevronRight :size="13" />
      </button>
    </div>

    <!-- Multiplier & Sub-Toolbar with Keyboard Controls Guide -->
    <div
      v-horizontal-scroll
      class="catalog-ribbon flex items-center justify-between px-3 py-1.5 border-b text-xs select-none overflow-x-auto no-scrollbar gap-2"
      style="background-color: var(--surface-ribbon); border-color: var(--surface-ribbon-border);"
    >
      <div class="flex items-center gap-3 shrink-0">
        <div class="flex items-center gap-1.5">
          <span class="catalog-ribbon-label text-gray-500 font-medium whitespace-nowrap">Beli Qty:</span>
          <div class="flex gap-1 shrink-0">
            <button
              v-for="(opt, i) in dynamicMultipliers"
              :key="opt.value"
              class="catalog-multiplier-btn px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center gap-0.5 shrink-0"
              :class="activeMultiplier === opt.value ? 'active text-white shadow-2xs' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
              :style="activeMultiplier === opt.value ? 'background-color: var(--brand-primary);' : ''"
              :title="`Pilih Qty ${opt.label} (Alt+${i+1})`"
              @click="activeMultiplier = opt.value"
            >
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>

      </div>

      <div class="flex items-center gap-2 shrink-0 ml-auto">
        <span
          v-if="scanFeedback"
          class="px-2 py-0.5 rounded text-[10.5px] font-bold border animate-in fade-in duration-150 shrink-0"
          :class="scanFeedback === 'ok'
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : 'bg-rose-100 text-rose-800 border-rose-300'"
        >
          {{ scanFeedback === 'ok' ? '✓ Barcode masuk keranjang' : '✗ Barcode tidak terdaftar' }}
        </span>
        <button
          type="button"
          class="catalog-inflow-btn px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
          title="Catat Infaq, Tip Kasir, atau Penerimaan Kas Non-Jual (Poin 9)"
          @click="showCashInflowModal = true"
        >
          <Coins :size="13" class="text-emerald-600" />
          <span>+ Infaq / Tip</span>
        </button>
        <button
          class="text-white px-3 py-1 rounded text-xs font-bold cursor-pointer disabled:opacity-40 flex items-center gap-1.5 shadow-2xs transition-colors hover:brightness-110 active:brightness-95"
          style="background-color: var(--brand-primary);"
          :disabled="!selectedProductId"
          title="Masukkan barang terpilih ke keranjang (Enter)"
          @click="handleAddSelected"
        >
          <span>+ Tambah (+{{ activeMultiplier }})</span>
          <kbd class="px-1 bg-black/20 text-white rounded text-[9.5px] font-mono font-normal">Enter</kbd>
        </button>
      </div>
    </div>

    <!-- Folder & File Tiles Grid -->
    <div class="flex-1 overflow-y-auto flex flex-col" :class="{ 'pb-28': isMobile }">
      <!-- Empty state when catalog has no products at all -->
      <AppEmptyState
        v-if="inventoryStore.products.length === 0"
        :icon="Sparkles"
        title="Katalog Produk Masih Kosong"
        description="Database belum memiliki data barang. Anda dapat menambah barang dari Master Barang atau muat data percontohan untuk mencoba kasir."
      >
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold text-xs shadow-xs cursor-pointer transition-all active:scale-95 disabled:opacity-50 mt-1 hover:brightness-110"
          style="background-color: var(--brand-primary);"
          :disabled="isLoadingDemo"
          @click="handleLoadDemo"
        >
          <Sparkles :size="14" :class="{ 'animate-spin': isLoadingDemo }" />
          <span>{{ isLoadingDemo ? 'Memuat Data Demo...' : 'Muat Data Demo Kasir' }}</span>
        </button>
      </AppEmptyState>


      <!-- Empty state when searching or filtering -->
      <AppEmptyState
        v-else-if="filteredProducts.length === 0"
        :icon="Folder"
        title="Tidak ada barang yang cocok dalam folder ini"
        description="Coba pilih kategori lain atau periksa kata kunci pencarian Anda"
      />

      <!-- Icon Grid View: Background Kotak Berwarna Sesuai Kategori, Bukan Garis Tebal -->
      <div
        v-else-if="viewMode === 'icons'"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 border-b border-r border-gray-200 bg-gray-50"
      >
        <div
          v-for="prod in filteredProducts"
          :key="prod.id"
          :data-product-id="prod.id"
          class="flex flex-col items-center justify-between p-3 border-t border-l border-gray-200/80 cursor-pointer transition-all select-none group relative overflow-hidden"
          :style="{
            backgroundColor: selectedProductId === prod.id ? getProductTheme(prod).badgeBg : (getProductTheme(prod).badgeBg || getProductTheme(prod).bgLightHex)
          }"
          :class="[
            selectedProductId === prod.id
              ? 'ring-2 ring-inset ring-black/30 z-10 font-bold shadow-xs'
              : 'hover:brightness-96 active:brightness-92'
          ]"
          @click="handleProductClick(prod)"
          @dblclick="handleProductDoubleClick(prod)"
        >
          <!-- Graphic Icon with Stock in Top Tab & Unit in Center Label -->
          <div class="relative w-16 h-14 flex items-center justify-center mb-1.5 mt-0.5 group-hover:scale-105 transition-transform">
            <div
              class="w-14 h-11 rounded-md shadow-2xs border flex flex-col justify-end p-1 transition-colors"
              :style="{
                background: `linear-gradient(to bottom, ${getProductTheme(prod).gradientFrom}, ${getProductTheme(prod).gradientTo})`,
                borderColor: getProductTheme(prod).borderHex
              }"
            >
              <div
                class="h-5 rounded-xs flex items-center justify-center text-[10px] font-bold truncate px-1 transition-colors"
                :style="{
                  backgroundColor: '#ffffff',
                  color: getProductTheme(prod).badgeText
                }"
              >
                {{ prod.unit }}
              </div>
            </div>

            <div
              class="absolute -top-0.5 left-2 min-w-7 px-1.5 h-3.5 rounded-t-sm border-t border-l border-r flex items-center justify-center text-[9px] font-bold font-mono tracking-tight shadow-2xs"
              :class="prod.stock <= 10 ? 'bg-red-500 text-white border-red-600' : 'bg-white text-gray-800'"
              :style="prod.stock > 10 ? { borderColor: getProductTheme(prod).borderHex } : {}"
              title="Sisa Stok Barang"
            >
              {{ prod.stock }}
            </div>
          </div>

          <!-- Name Label -->
          <span class="text-xs font-semibold text-center text-gray-900 line-clamp-2 leading-tight w-full mb-1.5">
            {{ prod.name }}
          </span>

          <!-- Price Label at Bottom -->
          <div class="mt-auto w-full flex justify-center items-center">
            <span class="text-xs font-bold text-gray-900 font-mono">
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
              :data-product-id="prod.id"
              class="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
              :class="selectedProductId === prod.id ? 'bg-blue-100 font-semibold' : ''"
              @click="handleProductClick(prod)"
              @dblclick="handleProductDoubleClick(prod)"
            >
              <td class="p-2 font-mono text-gray-500">{{ prod.code }}</td>
              <td class="p-2 font-medium flex items-center gap-1.5">
                <Folder
                  :size="14"
                  class="shrink-0"
                  :style="{ color: getProductTheme(prod).hex }"
                />
                <span>{{ prod.name }}</span>
                <span
                  v-if="prod.barcode"
                  class="p-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded shrink-0"
                  :title="`Scan kasir tersedia • Barcode: ${prod.barcode} (scan langsung masuk keranjang)`"
                >
                  <Barcode :size="12" class="text-amber-600" />
                </span>
              </td>
              <td class="p-2">
                <span
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold border"
                  :style="{
                    backgroundColor: getProductTheme(prod).bgLightHex,
                    color: getProductTheme(prod).badgeText,
                    borderColor: `${getProductTheme(prod).borderHex}30`
                  }"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full shrink-0"
                    :style="{ backgroundColor: getProductTheme(prod).hex }"
                  ></span>
                  <span>{{ prod.category }}</span>
                </span>
              </td>
              <td class="p-2 text-center">{{ prod.unit }}</td>
              <td class="p-2 text-right font-bold text-blue-600 font-mono">Rp {{ formatRupiah(prod.lastSellPrice) }}</td>
              <td class="p-2 text-center font-mono">{{ prod.stock }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Pemasukan Kas Non-Jual (Poin 9: Tip, Infaq, Donasi) -->
    <CashInflowModal
      :is-open="showCashInflowModal"
      @close="showCashInflowModal = false"
    />
  </div>
</template>
