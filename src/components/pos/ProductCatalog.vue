<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePosStore } from '../../stores/posStore';
import { SupplierCategory, Product } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  Folder,
  ChevronLeft,
  ChevronRight,
  Barcode
} from 'lucide-vue-next';
import AppEmptyState from '../common/AppEmptyState.vue';

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

const selectedCategory = ref<SupplierCategory | 'Semua'>('Semua');
const selectedProductId = ref<string | null>(null);
const activeMultiplier = ref<number>(1);

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

function lookupByBarcode(buffer: string): Product | undefined {
  const key = buffer.trim();
  if (!key) return undefined;
  const prods = inventoryStore.products;
  return (
    prods.find(p => (p.barcode || '').trim() === key) ||
    prods.find(p => p.code.trim().toUpperCase() === key.toUpperCase())
  );
}

function commitScanBuffer() {
  const buffer = scanBuffer.value;
  scanBuffer.value = '';
  if (!buffer) return;
  const prod = lookupByBarcode(buffer);
  if (prod) {
    posStore.addProductToCart(prod, 1);
    selectedProductId.value = prod.id;
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
  const activeEl = document.activeElement;
  const isInputActive = activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement || activeEl instanceof HTMLSelectElement;
  if (isInputActive) {
    return;
  }

  const prods = filteredProducts.value;

  // --- BUG-016 FIX: Pipeline scanner barcode ---
  // 1) Karakter alfanumerik tunggal dari scanner ditaruh di buffer berkecepatan tinggi
  if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
    handleScanBuffer(e);
    scanning.value = true;
    // scanning menangkap '1' (mis. nama barcode) tanpa mengganggu shortcut Alt+N
    return;
  }

  // 2) Enter di akhir sesi scanner (gap sangat kecil) = scan; selain itu = perilaku bawaan
  if (e.key === 'Enter') {
    const isScan = scanBuffer.value.length >= 6 && (Date.now() - lastCharAt.value) <= SCAN_GAP_MS;
    scanBuffer.value = '';
    scanning.value = false;
    if (isScan) {
      e.preventDefault();
      commitScanBuffer();
      return;
    }
    if (prods.length === 0) return;
    // bawaan: tambah barang terpilih
    e.preventDefault();
    handleAddSelected();
    return;
  }

  if (prods.length === 0) return;

  const currentIndex = prods.findIndex(p => p.id === selectedProductId.value);
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
  } else if (['1', '2', '3', '4', '5'].includes(e.key) && (e.altKey || (!e.ctrlKey && !e.metaKey))) {
    const multiplierMap: Record<string, number> = { '1': 1, '2': 5, '3': 10, '4': 25, '5': 50 };
    if (e.altKey && multiplierMap[e.key]) {
      e.preventDefault();
      activeMultiplier.value = multiplierMap[e.key];
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  if (filteredProducts.value.length > 0 && !selectedProductId.value) {
    selectedProductId.value = filteredProducts.value[0].id;
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

defineExpose({
  selectCategory,
  handleAddSelected
});
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden bg-white select-none text-xs">
    <!-- Horizontal Category Filter Pills with Drag, Wheel, and Arrow Navigation -->
    <div
      class="relative flex items-center border-b px-2 py-1 select-none shrink-0 group"
      style="background-color: var(--surface-ribbon); border-color: var(--surface-ribbon-border);"
    >
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

      <!-- Scrollable & Draggable Container -->
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
          :class="selectedCategory === 'Semua' ? 'text-white font-bold shadow-xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
          :style="selectedCategory === 'Semua' ? 'background-color: var(--brand-primary);' : ''"
          @click="selectCategory('Semua')"
        >
          Semua Barang ({{ inventoryStore.products.length }})
        </button>
        <button
          v-for="cat in categories"
          :key="cat"
          type="button"
          class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 flex items-center gap-1 select-none"
          :class="selectedCategory === cat ? 'text-white font-bold shadow-xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
          :style="selectedCategory === cat ? 'background-color: var(--brand-primary);' : ''"
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
    <div
      class="flex items-center justify-between px-3 py-1.5 border-b text-xs select-none"
      style="background-color: var(--surface-ribbon); border-color: var(--surface-ribbon-border);"
    >
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-1.5">
          <span class="text-gray-500 font-medium">Beli Qty:</span>
          <div class="flex gap-1">
            <button
              v-for="(m, i) in [1, 5, 10, 25, 50]"
              :key="m"
              class="px-2 py-0.5 rounded text-xs font-semibold cursor-pointer transition-colors flex items-center gap-0.5"
              :class="activeMultiplier === m ? 'text-white shadow-2xs' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
              :style="activeMultiplier === m ? 'background-color: var(--brand-primary);' : ''"
              :title="`Pilih Qty ${m} (Alt+${i+1})`"
              @click="activeMultiplier = m"
            >
              <span>+{{ m }}</span>
            </button>
          </div>
        </div>

        <!-- Keyboard Nav Hints + Scan Barcode Status (BUG-016 FIX) -->
        <div class="hidden lg:flex items-center gap-1 text-[11px] text-gray-500 bg-gray-100 border border-gray-200 rounded px-2 py-0.5 font-mono">
          <span class="text-gray-400">Navigasi:</span>
          <kbd class="px-1 bg-white border border-gray-300 rounded text-[10px] font-bold">↑</kbd>
          <kbd class="px-1 bg-white border border-gray-300 rounded text-[10px] font-bold">↓</kbd>
          <kbd class="px-1 bg-white border border-gray-300 rounded text-[10px] font-bold">←</kbd>
          <kbd class="px-1 bg-white border border-gray-300 rounded text-[10px] font-bold">→</kbd>
          <span class="text-gray-400 ml-1">Pilih | Masukkan:</span>
          <kbd class="px-1.5 bg-blue-50 text-blue-700 border border-blue-300 rounded text-[10px] font-bold">Enter ↵</kbd>
          <span
            class="ml-1.5 flex items-center gap-1 text-[10px]"
            :class="scanning ? 'text-blue-700 font-bold' : 'text-gray-400'"
          >
            💠 Scanner: {{ scanning ? 'menerima…' : 'siap' }} — scan langsung masuk keranjang
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span
          v-if="scanFeedback"
          class="px-2 py-0.5 rounded text-[10.5px] font-bold border animate-in fade-in duration-150"
          :class="scanFeedback === 'ok'
            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
            : 'bg-rose-100 text-rose-800 border-rose-300'"
        >
          {{ scanFeedback === 'ok' ? '✓ Barcode masuk keranjang' : '✗ Barcode tidak terdaftar' }}
        </span>
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
    <div class="flex-1 overflow-y-auto">
      <!-- Empty state -->
      <AppEmptyState
        v-if="filteredProducts.length === 0"
        :icon="Folder"
        title="Tidak ada barang yang cocok dalam folder ini"
        description="Coba pilih kategori lain atau periksa kata kunci pencarian Anda"
      />

      <!-- Icon Grid View -->
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
            <div class="w-14 h-11 bg-gradient-to-b from-[#e8cf9b] to-[#cba366] rounded-md shadow-2xs border border-[#b89154] flex flex-col justify-end p-1">
              <div class="bg-[#f7eedc] h-5 rounded-xs flex items-center justify-center text-[10px] font-bold text-amber-950 truncate px-1">
                {{ prod.unit }}
              </div>
            </div>

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
                <span
                  v-if="prod.barcode"
                  class="p-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded shrink-0"
                  :title="`Scan kasir tersedia • Barcode: ${prod.barcode} (scan langsung masuk keranjang)`"
                >
                  <Barcode :size="12" class="text-amber-600" />
                </span>
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
</template>
