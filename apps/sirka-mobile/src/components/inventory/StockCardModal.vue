<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useStockMovementStore } from '../../stores/stockMovementStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { formatRupiah } from '../../utils/formatters';
import {
  X,
  FileText,
  TrendingDown,
  TrendingUp,
  Scale,
  Package,
  AlertTriangle,
  RotateCcw,
  Truck,
  Search,
  Layers,
  ArrowUpDown,
  Maximize2,
  Minimize2,
  Check
} from 'lucide-vue-next';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import AppTableContainer from '../common/AppTableContainer.vue';

const movementStore = useStockMovementStore();
const inventoryStore = useInventoryStore();

// Tampilan Default: Fullwidth (Layar Penuh) untuk kenyamanan melihat ledger
const isFullWidth = ref(true);

// Produk yang sedang dipilih dalam kartu ('ALL' = Buku Mutasi Gabungan Seluruh Produk)
const selectedProductId = ref<string>('ALL');
const filterType = ref<string>('ALL');
const searchQuery = ref<string>('');
const sortOrder = ref<'desc' | 'asc'>('desc'); // 'desc' = terbaru di atas, 'asc' = kronologis

// Opsi Produk untuk SearchableSelect
const productOptions = computed<SelectOption[]>(() => [
  {
    value: 'ALL',
    label: 'Semua Produk (Buku Mutasi Global)',
    badge: `${inventoryStore.products.length} SKU`
  },
  ...inventoryStore.products.map(p => ({
    value: p.id,
    label: p.name,
    code: p.code,
    badge: `${p.stock} ${p.unit}`,
    sublabel: `Kategori: ${p.category}${p.supplier ? ` • Mitra: ${p.supplier}` : ''}`
  }))
]);

// Opsi Jenis Mutasi untuk SearchableSelect
const mutationTypeOptions = computed<SelectOption[]>(() => [
  { value: 'ALL', label: 'Semua Jenis Mutasi' },
  { value: 'KULAKAN', label: 'Kulakan Masuk', badge: 'Masuk' },
  { value: 'PENJUALAN', label: 'Terjual Kasir', badge: 'Keluar' },
  { value: 'PENYESUAIAN_OPNAME', label: 'Opname / Adjust', badge: 'Koreksi' },
  { value: 'RUSAK_WASTE', label: 'Barang Rusak / Susut', badge: 'Waste' },
  { value: 'RETUR_MASUK', label: 'Retur Pelanggan', badge: 'Retur' }
]);

// Sinkronkan saat store membuka produk tertentu
watch(
  () => movementStore.activeProductForCard,
  (prod) => {
    selectedProductId.value = prod ? prod.id : 'ALL';
    searchQuery.value = '';
    filterType.value = 'ALL';
  },
  { immediate: true }
);

// Keyboard shortcut: ESC untuk tutup
function handleKeydown(e: KeyboardEvent) {
  if (!movementStore.isStockCardOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    movementStore.closeStockCard();
  }
}

watch(
  () => movementStore.isStockCardOpen,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeydown);
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  }
);

onMounted(() => {
  if (movementStore.isStockCardOpen) {
    window.addEventListener('keydown', handleKeydown);
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const activeProduct = computed(() => {
  if (selectedProductId.value === 'ALL') return null;
  return inventoryStore.products.find(p => p.id === selectedProductId.value) || null;
});

// Daftar mutasi tersaring
const filteredMovements = computed(() => {
  let list = selectedProductId.value === 'ALL'
    ? [...movementStore.movements]
    : [...movementStore.getProductMovements(selectedProductId.value)];

  // Filter jenis
  if (filterType.value !== 'ALL') {
    list = list.filter(m => m.type === filterType.value);
  }

  // Filter pencarian
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase();
    list = list.filter(m =>
      (m.productName && m.productName.toLowerCase().includes(q)) ||
      (m.productCode && m.productCode.toLowerCase().includes(q)) ||
      (m.refNo && m.refNo.toLowerCase().includes(q)) ||
      (m.notes && m.notes.toLowerCase().includes(q)) ||
      (m.operator && m.operator.toLowerCase().includes(q)) ||
      (m.category && m.category.toLowerCase().includes(q))
    );
  }

  // Urutkan
  return list.sort((a, b) => {
    const ta = new Date(a.createdAt || a.date || 0).getTime();
    const tb = new Date(b.createdAt || b.date || 0).getTime();
    if (ta !== tb) {
      return sortOrder.value === 'asc' ? ta - tb : tb - ta;
    }
    return (b.id || '').localeCompare(a.id || '');
  });
});

// Ringkasan KPI
const totalInCount = computed(() => {
  return filteredMovements.value.filter(m => m.qtyChange > 0).length;
});

const totalOutCount = computed(() => {
  return filteredMovements.value.filter(m => m.qtyChange < 0).length;
});

const singleProductTotalInQty = computed(() => {
  if (!activeProduct.value) return 0;
  return filteredMovements.value
    .filter(m => m.qtyChange > 0)
    .reduce((acc, m) => acc + m.qtyChange, 0);
});

const singleProductTotalOutQty = computed(() => {
  if (!activeProduct.value) return 0;
  return filteredMovements.value
    .filter(m => m.qtyChange < 0)
    .reduce((acc, m) => acc + Math.abs(m.qtyChange), 0);
});

function formatDate(iso: string) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'KULAKAN':
      return {
        label: 'Kulakan Masuk',
        class: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icon: TrendingUp
      };
    case 'PENJUALAN':
      return {
        label: 'Terjual Kasir',
        class: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: TrendingDown
      };
    case 'RUSAK_WASTE':
      return {
        label: 'Barang Rusak / Susut',
        class: 'bg-rose-100 text-rose-800 border-rose-300',
        icon: AlertTriangle
      };
    case 'PENYESUAIAN_OPNAME':
      return {
        label: 'Opname / Adjust',
        class: 'bg-purple-100 text-purple-800 border-purple-300',
        icon: Scale
      };
    case 'RETUR_MASUK':
      return {
        label: 'Retur Pelanggan',
        class: 'bg-amber-100 text-amber-800 border-amber-300',
        icon: RotateCcw
      };
    default:
      return {
        label: type,
        class: 'bg-gray-100 text-gray-800 border-gray-300',
        icon: FileText
      };
  }
}

function handleOpenAdjust() {
  if (activeProduct.value) {
    movementStore.openAdjustModal(activeProduct.value);
  } else {
    movementStore.openAdjustModal();
  }
}

function handleOpenReceiving() {
  if (activeProduct.value) {
    inventoryStore.activeProductForSidebar = { ...activeProduct.value };
    inventoryStore.showProductSidebar = true;
    movementStore.closeStockCard();
  }
}

function selectProductFromTable(productId: string) {
  selectedProductId.value = productId;
}
</script>

<template>
  <div
    v-if="movementStore.isStockCardOpen"
    class="fixed inset-0 z-50 flex select-none bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
    :class="isFullWidth ? 'p-0 items-stretch justify-stretch' : 'items-end sm:items-center justify-center p-0 sm:p-4'"
    @click.self="movementStore.closeStockCard"
  >
    <div
      class="bg-white flex flex-col overflow-hidden shadow-2xl transition-all duration-200"
      :class="isFullWidth ? 'w-full h-full rounded-none' : 'w-full sm:max-w-6xl h-[92vh] sm:h-[88vh] rounded-t-3xl sm:rounded-xl border border-gray-300 animate-in slide-in-from-bottom duration-200 sm:zoom-in-95'"
    >
      <!-- Mobile Pull Indicator -->
      <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0"></div>

      <!-- 1. Header Toolbar (Native Explorer Style) -->
      <div class="px-6 py-3.5 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Layers v-if="!activeProduct" :size="20" />
            <FileText v-else :size="20" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="text-sm font-bold text-gray-900 truncate uppercase tracking-tight">
                {{ activeProduct ? `Kartu Stok: ${activeProduct.name}` : 'Buku Mutasi Stok (Semua Produk)' }}
              </h1>
              <span v-if="activeProduct" class="text-[11px] px-2 py-0.5 bg-gray-200 text-gray-800 font-mono rounded font-bold shrink-0">
                {{ activeProduct.code }}
              </span>
              <span v-else class="text-[11px] px-2 py-0.5 bg-purple-100 text-purple-800 font-semibold rounded shrink-0">
                {{ inventoryStore.products.length }} SKU Aktif
              </span>
            </div>
            <p class="text-xs text-gray-500 truncate mt-0.5">
              <template v-if="activeProduct">
                Kategori: <span class="font-medium text-gray-700">{{ activeProduct.category }}</span>
                {{ activeProduct.supplier ? ` • Mitra Supplier: ${activeProduct.supplier}` : '' }}
              </template>
              <template v-else>
                Audit log lengkap seluruh pergerakan barang (Kulakan, Penjualan Kasir, Opname, Retur & Barang Rusak)
              </template>
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2.5 shrink-0">
          <button
            v-if="activeProduct"
            type="button"
            class="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-md text-xs font-semibold text-amber-800 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="Buka form kulakan untuk barang ini"
            @click="handleOpenReceiving"
          >
            <Truck :size="13" class="text-amber-700" />
            <span>+ Kulakan Masuk</span>
          </button>

          <button
            type="button"
            class="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="Koreksi / sesuaikan stok fisik (Stock Opname)"
            @click="handleOpenAdjust"
          >
            <Scale :size="13" class="text-purple-600" />
            <span>Adjust Stok (Opname)</span>
          </button>

          <!-- Toggle Fullscreen / Jendela Kompak -->
          <button
            type="button"
            class="p-1.5 rounded-md hover:bg-gray-200 text-gray-500 hover:text-gray-800 cursor-pointer transition-colors"
            :title="isFullWidth ? 'Kecilkan Tampilan Jendela' : 'Perbesar ke Layar Penuh (Fullwidth)'"
            @click="isFullWidth = !isFullWidth"
          >
            <Minimize2 v-if="isFullWidth" :size="16" />
            <Maximize2 v-else :size="16" />
          </button>

          <!-- Close Button -->
          <button
            type="button"
            class="p-1.5 rounded-md hover:bg-rose-100 text-gray-400 hover:text-rose-700 cursor-pointer transition-colors ml-1"
            title="Tutup (Esc)"
            @click="movementStore.closeStockCard"
          >
            <X :size="18" />
          </button>
        </div>
      </div>

      <!-- 2. Bilah Filter & Pencarian Lengkap (Compact Ribbon) -->
      <div
        v-horizontal-scroll
        class="px-5 py-2 bg-[#fcfbfa] border-b border-gray-200 shrink-0 flex items-center gap-2.5 text-xs select-none overflow-x-auto no-scrollbar"
      >
        <!-- Selector Produk Cepat (SearchableSelect) -->
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[11px] font-semibold text-gray-500 whitespace-nowrap">Produk:</span>
          <div class="w-80">
            <SearchableSelect
              v-model="selectedProductId"
              :options="productOptions"
              placeholder="Pilih Produk..."
              search-placeholder="Ketik nama atau kode SKU..."
              size="sm"
              hotkey=""
            />
          </div>
        </div>

        <div class="h-4 w-px bg-gray-300 shrink-0"></div>

        <!-- Filter Jenis Mutasi (SearchableSelect) -->
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[11px] font-semibold text-gray-500 whitespace-nowrap">Jenis:</span>
          <div class="w-48">
            <SearchableSelect
              v-model="filterType"
              :options="mutationTypeOptions"
              placeholder="Semua Jenis..."
              search-placeholder="Cari jenis mutasi..."
              size="sm"
              hotkey=""
            />
          </div>
        </div>

        <div class="h-4 w-px bg-gray-300 shrink-0"></div>

        <!-- Search Input -->
        <div class="relative flex-1 min-w-[200px]">
          <Search :size="13" class="absolute left-2.5 top-2 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari ref, nota, kode barang, catatan..."
            class="w-full pl-8 pr-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 shadow-2xs"
          />
        </div>

        <!-- Toggle Urutan -->
        <button
          type="button"
          class="px-2.5 py-1.5 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 hover:bg-gray-100 flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 transition-colors whitespace-nowrap"
          :title="sortOrder === 'desc' ? 'Urutan: Terbaru di Atas' : 'Urutan: Lama ke Baru (Kronologis)'"
          @click="sortOrder = sortOrder === 'desc' ? 'asc' : 'desc'"
        >
          <ArrowUpDown :size="12" />
          <span>{{ sortOrder === 'desc' ? 'Terbaru' : 'Kronologis' }}</span>
        </button>
      </div>

      <!-- 3. Ringkasan Status Stok & KPI (Full Cell Compact Strip, Tanpa Card Box) -->
      <!-- MODE PRODUK SPESIFIK -->
      <div
        v-if="activeProduct"
        v-horizontal-scroll
        class="flex items-stretch divide-x divide-gray-200 border-b border-gray-200 bg-white shrink-0 select-none text-xs overflow-x-auto no-scrollbar snap-x scroll-smooth cursor-grab active:cursor-grabbing"
      >
        <div class="flex-1 min-w-[150px] sm:min-w-0 shrink-0 sm:shrink snap-start px-4 sm:px-5 py-2">
          <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Sisa Stok Fisik</span>
          <div class="font-mono text-sm font-bold text-gray-900 truncate mt-0.5">
            {{ activeProduct.stock }} <span class="text-xs font-normal text-gray-500">{{ activeProduct.unit }}</span>
          </div>
        </div>

        <div class="flex-1 min-w-[170px] sm:min-w-0 shrink-0 sm:shrink snap-start px-4 sm:px-5 py-2">
          <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Total Masuk (Kulakan/Retur)</span>
          <div class="font-mono text-sm font-bold text-emerald-600 truncate mt-0.5">
            +{{ singleProductTotalInQty }} <span class="text-xs font-normal text-gray-500">{{ activeProduct.unit }}</span>
          </div>
        </div>

        <div class="flex-1 min-w-[170px] sm:min-w-0 shrink-0 sm:shrink snap-start px-4 sm:px-5 py-2">
          <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Total Keluar (Kasir/Waste)</span>
          <div class="font-mono text-sm font-bold text-rose-600 truncate mt-0.5">
            -{{ singleProductTotalOutQty }} <span class="text-xs font-normal text-gray-500">{{ activeProduct.unit }}</span>
          </div>
        </div>

        <div class="flex-1 min-w-[160px] sm:min-w-0 shrink-0 sm:shrink snap-start px-4 sm:px-5 py-2">
          <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Modal HPP / Jual</span>
          <div class="font-mono text-xs font-bold text-gray-800 truncate mt-0.5">
            Rp {{ formatRupiah(activeProduct.lastBuyPrice || 0) }}
            <span class="text-gray-400 font-normal"> / </span>
            <span class="text-blue-700">Rp {{ formatRupiah(activeProduct.lastSellPrice || 0) }}</span>
          </div>
        </div>
      </div>

      <!-- MODE SEMUA PRODUK (GLOBAL) -->
      <div
        v-else
        v-horizontal-scroll
        class="flex items-stretch divide-x divide-gray-200 border-b border-gray-200 bg-white shrink-0 select-none text-xs overflow-x-auto no-scrollbar snap-x scroll-smooth cursor-grab active:cursor-grabbing"
      >
        <div class="flex-1 min-w-[150px] sm:min-w-0 shrink-0 sm:shrink snap-start px-4 sm:px-5 py-2">
          <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Total Aktivitas Mutasi</span>
          <div class="font-mono text-sm font-bold text-gray-900 truncate mt-0.5">
            {{ filteredMovements.length }} <span class="text-xs font-normal text-gray-500">Catatan</span>
          </div>
        </div>

        <div class="flex-1 min-w-[170px] sm:min-w-0 shrink-0 sm:shrink snap-start px-4 sm:px-5 py-2">
          <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Arus Masuk (Kulakan / Retur)</span>
          <div class="font-mono text-sm font-bold text-emerald-600 truncate mt-0.5">
            {{ totalInCount }} <span class="text-xs font-normal text-gray-500">Aktivitas</span>
          </div>
        </div>

        <div class="flex-1 min-w-[170px] sm:min-w-0 shrink-0 sm:shrink snap-start px-4 sm:px-5 py-2">
          <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Arus Keluar (Penjualan / Waste)</span>
          <div class="font-mono text-sm font-bold text-rose-600 truncate mt-0.5">
            {{ totalOutCount }} <span class="text-xs font-normal text-gray-500">Aktivitas</span>
          </div>
        </div>

        <div class="flex-1 min-w-[150px] sm:min-w-0 shrink-0 sm:shrink snap-start px-4 sm:px-5 py-2">
          <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">Cakupan SKU Terdaftar</span>
          <div class="font-mono text-sm font-bold text-purple-700 truncate mt-0.5">
            {{ inventoryStore.products.length }} <span class="text-xs font-normal text-gray-500">Produk Aktif</span>
          </div>
        </div>
      </div>

      <!-- 4. Tabel Riwayat Mutasi Kartu Stok (Fullwidth Table) -->
      <div class="flex-1 flex flex-col overflow-hidden text-xs">
        <div class="px-6 py-2.5 bg-gray-100/70 border-b border-gray-200 flex items-center justify-between text-xs font-bold text-gray-700 shrink-0">
          <span class="flex items-center gap-1.5">
            <Check :size="14" class="text-emerald-600" />
            <span>Aliran Mutasi Fisik: {{ activeProduct ? activeProduct.name : 'Seluruh Katalog Barang' }}</span>
          </span>
          <span class="text-gray-500 font-normal font-mono text-[11px]">{{ filteredMovements.length }} baris mutasi</span>
        </div>

        <AppTableContainer
          :is-empty="filteredMovements.length === 0"
          :empty-icon="Package"
          empty-title="Belum Ada Riwayat Mutasi Yang Cocok"
          empty-description="Mutasi otomatis tercatat secara real-time saat terjadi transaksi Kulakan Masuk, Penjualan di POS Kasir, Pencatatan Barang Rusak, atau Stock Opname."
        >
          <table class="table-explorer whitespace-nowrap min-w-[900px]">
            <thead class="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase tracking-wider font-semibold sticky top-0 z-10 shadow-2xs select-none">
              <tr>
                <th class="py-2.5 px-4 w-36">WAKTU</th>
                <th v-if="!activeProduct" class="py-2.5 px-3 w-28">KODE SKU</th>
                <th v-if="!activeProduct" class="py-2.5 px-3 min-w-[200px]">NAMA BARANG</th>
                <th v-if="!activeProduct" class="py-2.5 px-3 w-32">KATEGORI</th>
                <th class="py-2.5 px-3 w-36">JENIS MUTASI</th>
                <th class="py-2.5 px-3 w-40">NO. REFERENSI</th>
                <th class="py-2.5 px-3 w-32 text-right">PERUBAHAN</th>
                <th class="py-2.5 px-4 w-32 text-right">SISA STOK</th>
                <th class="py-2.5 px-4">KETERANGAN / PIC</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 font-mono text-[11px]">
              <tr
                v-for="m in filteredMovements"
                :key="m.id"
                class="hover:bg-purple-50/40 transition-colors"
              >
                <!-- Waktu -->
                <td class="py-2.5 px-4 text-gray-600 whitespace-nowrap font-sans text-[11px]">
                  {{ formatDate(m.date || m.createdAt) }}
                </td>

                <!-- Kode SKU (Jika mode semua produk) -->
                <td v-if="!activeProduct" class="py-2.5 px-3 font-mono font-bold text-gray-600 whitespace-nowrap">
                  {{ m.productCode }}
                </td>

                <!-- Nama Barang (Jika mode semua produk) -->
                <td v-if="!activeProduct" class="py-2.5 px-3 font-sans">
                  <button
                    type="button"
                    class="text-left font-bold text-gray-900 hover:text-purple-700 cursor-pointer block truncate"
                    :title="`Klik untuk fokus ke kartu stok ${m.productName}`"
                    @click="selectProductFromTable(m.productId)"
                  >
                    {{ m.productName }}
                  </button>
                </td>

                <!-- Kategori (Jika mode semua produk) -->
                <td v-if="!activeProduct" class="py-2.5 px-3 font-sans whitespace-nowrap">
                  <span class="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-semibold border border-purple-200">
                    {{ m.category }}
                  </span>
                </td>

                <!-- Jenis Mutasi Badge -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                  <span
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-bold border font-sans"
                    :class="getTypeBadge(m.type).class"
                  >
                    <component :is="getTypeBadge(m.type).icon" :size="11" />
                    <span>{{ getTypeBadge(m.type).label }}</span>
                  </span>
                </td>

                <!-- No Ref -->
                <td class="py-2.5 px-3 text-gray-700 font-semibold whitespace-nowrap font-mono text-[11px]">
                  {{ m.refNo || '-' }}
                </td>

                <!-- Perubahan Qty -->
                <td class="py-2.5 px-3 text-right font-bold whitespace-nowrap font-mono text-xs">
                  <span
                    :class="m.qtyChange > 0 ? 'text-emerald-700' : m.qtyChange < 0 ? 'text-rose-700' : 'text-gray-500'"
                  >
                    {{ m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange }}
                  </span>
                  <span class="text-[10px] font-normal text-gray-500 ml-1 font-sans">{{ m.unit }}</span>
                </td>

                <!-- Sisa Stok -->
                <td class="py-2.5 px-4 text-right font-bold text-gray-900 whitespace-nowrap font-mono text-xs">
                  {{ m.stockAfter }} <span class="text-[10px] font-normal text-gray-500 font-sans">{{ m.unit }}</span>
                </td>

                <!-- Keterangan & Operator -->
                <td class="py-2.5 px-4 text-gray-600 font-sans text-[11px] truncate" :title="m.notes || m.operator || ''">
                  {{ m.notes || m.operator || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </AppTableContainer>
      </div>

      <!-- 5. Footer Drawer -->
      <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0 text-xs">
        <span class="text-xs text-gray-500">
          <template v-if="activeProduct">
            Stok fisik: <strong class="font-mono text-gray-800 font-bold">{{ activeProduct.stock }} {{ activeProduct.unit }}</strong>
          </template>
          <template v-else>
            Menampilkan buku mutasi audit log untuk <strong class="text-gray-800 font-bold">{{ inventoryStore.products.length }} produk</strong>
          </template>
          <span class="text-gray-400 ml-2 font-mono text-[11px]">(Tekan Esc untuk menutup)</span>
        </span>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-4 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-md text-xs font-bold cursor-pointer transition-colors shadow-2xs"
            @click="movementStore.closeStockCard"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
