<script setup lang="ts">
import { ref, computed } from 'vue';
import { Product } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useSupplierStore } from '../../stores/supplierStore';
import { useStockMovementStore } from '../../stores/stockMovementStore';
import { formatRupiah, resolveProductSupplier } from '../../utils/formatters';
import {
  Trash2,
  Package,
  Boxes,
  PackageCheck,
  TrendingUp,
  Coins,
  Truck,
  Scale,
  AlertTriangle,
  FileText,
  ArrowUp,
  ArrowDown,
  Plus,
  SlidersHorizontal,
  X,
  RotateCcw
} from 'lucide-vue-next';
import AppTableContainer from '../common/AppTableContainer.vue';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import AppFilterDrawer from '../common/AppFilterDrawer.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { useReturnStore } from '../../stores/returnStore';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const emit = defineEmits<{
  (e: 'add-product'): void;
  (e: 'edit-product', prod: Product): void;
}>();

const inventoryStore = useInventoryStore();
const supplierStore = useSupplierStore();
const movementStore = useStockMovementStore();
const returnStore = useReturnStore();
const { confirm: showConfirm } = useConfirmDialog();

async function handleDeleteProduct(prod: Product) {
  const isConfirmed = await showConfirm({
    title: 'Hapus Barang dari Katalog?',
    message: `Hapus "${prod.name}" (${prod.code}) secara permanen?`,
    details: 'Barang yang dihapus tidak akan dapat dipilih lagi di transaksi Kasir maupun laporan stok.',
    confirmText: 'Ya, Hapus Barang',
    cancelText: 'Batal',
    type: 'danger'
  });
  if (isConfirmed) {
    inventoryStore.deleteProduct(prod.id);
  }
}

const showFilterDrawer = ref(false);
const selectedCategory = ref<string>('Semua');
const selectedSupplier = ref<string>('Semua');
const selectedStockStatus = ref<'Semua' | 'Kritis' | 'Habis' | 'Tersedia'>('Semua');

const activeFiltersCount = computed(() => {
  let count = 0;
  if (selectedCategory.value !== 'Semua') count++;
  if (selectedSupplier.value !== 'Semua') count++;
  if (selectedStockStatus.value !== 'Semua') count++;
  return count;
});

function resetAllFilters() {
  selectedCategory.value = 'Semua';
  selectedSupplier.value = 'Semua';
  selectedStockStatus.value = 'Semua';
}

const categoryOptions = computed<SelectOption[]>(() => [
  { value: 'Semua', label: 'Semua Kategori' },
  ...inventoryStore.categoryMarkups.map(c => ({
    value: c.category,
    label: c.category
  }))
]);

const supplierOptions = computed<SelectOption[]>(() => [
  { value: 'Semua', label: 'Semua Supplier' },
  ...supplierStore.suppliers.map(s => ({
    value: s.name,
    label: s.name,
    badge: s.phone || undefined
  }))
]);

const filteredProducts = computed(() => {
  const q = (props.searchQuery || '').toLowerCase().trim();
  return inventoryStore.products.filter(p => {
    // Filter pencarian teks
    if (q) {
      const matchQuery =
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.supplier && p.supplier.toLowerCase().includes(q));
      if (!matchQuery) return false;
    }

    // Filter Kategori
    if (selectedCategory.value !== 'Semua') {
      if (p.category !== selectedCategory.value) return false;
    }

    // Filter Supplier
    if (selectedSupplier.value !== 'Semua') {
      if ((p.supplier || '') !== selectedSupplier.value) return false;
    }

    // Filter Status Stok Fisik
    if (selectedStockStatus.value === 'Kritis') {
      if (p.stock > 5) return false;
    } else if (selectedStockStatus.value === 'Habis') {
      if (p.stock > 0) return false;
    } else if (selectedStockStatus.value === 'Tersedia') {
      if (p.stock <= 0) return false;
    }

    return true;
  });
});



// Metrik Lengkap Aset Stok Barang
/**
 * BUG FIX: jumlah stok dijumlahkan dari berbagai satuan dasar (KG + PCS + DUS)
 * sehingga angkanya tidak bermakna ("312 Unit / Pcs"). Sekarang ditampilkan
 * per satuan dasar agar bisa dibaca.
 */
const stockQtyByUnit = computed(() => {
  const map = new Map<string, number>();
  for (const p of filteredProducts.value) {
    const unit = (p.unit || 'pcs').toUpperCase();
    map.set(unit, (map.get(unit) || 0) + (p.stock || 0));
  }
  // Urutkan kuantitas terbanyak di depan
  return [...map.entries()]
    .map(([unit, qty]) => ({ unit, qty }))
    .sort((a, b) => b.qty - a.qty);
});

const totalStockCount = computed(() => {
  return filteredProducts.value.reduce((acc, p) => acc + (p.stock || 0), 0);
});

const stockSummary = computed(() => {
  if (stockQtyByUnit.value.length === 0 || totalStockCount.value === 0) {
    return {
      primary: '0 Unit',
      sublabel: undefined,
      tooltip: 'Tidak ada stok fisik tercatat'
    };
  }

  const unitCount = stockQtyByUnit.value.length;
  const tooltip = `Rincian Stok Fisik (${unitCount} Satuan):\n` +
    stockQtyByUnit.value.map(s => `• ${formatRupiah(s.qty)} ${s.unit}`).join('\n');

  return {
    primary: `${formatRupiah(totalStockCount.value)} Unit`,
    sublabel: `(${unitCount} Satuan)`,
    tooltip
  };
});

const totalAssetBuy = computed(() => {
  return filteredProducts.value.reduce((acc, p) => acc + ((p.stock || 0) * (p.lastBuyPrice || 0)), 0);
});

const totalAssetSell = computed(() => {
  return filteredProducts.value.reduce((acc, p) => acc + ((p.stock || 0) * (p.lastSellPrice || 0)), 0);
});

/**
 * BUG FIX: margin aset tidak boleh dijepit ke 0. Kalau harga jual master di
 * bawah harga modal (barang rugi), nilai sebenarnya harus negatif — dijepit 0
 * membuat laporan potential margin menyesatkan.
 */
const totalAssetProfit = computed(() => {
  return totalAssetSell.value - totalAssetBuy.value;
});

const averageAssetMargin = computed(() => {
  if (totalAssetBuy.value === 0) return 0;
  return Number(((totalAssetProfit.value / totalAssetBuy.value) * 100).toFixed(1));
});

const categoriesCount = computed(() => {
  return new Set(filteredProducts.value.map(p => p.category)).size;
});

const metricStats = computed<MetricStatItem[]>(() => [
  {
    label: 'Total SKU Barang',
    value: `${filteredProducts.value.length} SKU`,
    icon: Package,
    iconBoxClass: 'bg-purple-50 text-purple-700',
    valClass: 'text-gray-800'
  },
  {
    label: 'Fisik Stok di Toko',
    value: stockSummary.value.primary,
    sublabel: stockSummary.value.sublabel,
    tooltip: stockSummary.value.tooltip,
    icon: Boxes,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-blue-800',
    sublabelClass: 'text-blue-700 bg-blue-100/70 px-1 py-0.5 rounded text-[10px] font-semibold'
  },
  {
    label: 'Nilai Aset Modal (HPP)',
    value: `Rp ${formatRupiah(totalAssetBuy.value)}`,
    icon: PackageCheck,
    iconBoxClass: 'bg-emerald-50 text-emerald-700',
    valClass: 'text-emerald-700'
  },
  {
    label: 'Estimasi Nilai Jual',
    value: `Rp ${formatRupiah(totalAssetSell.value)}`,
    icon: TrendingUp,
    iconBoxClass: 'bg-amber-50 text-amber-700',
    valClass: 'text-amber-800'
  },
  {
    label: 'Potensi Margin Aset',
    // BUG FIX: tanda & warna harus mengikuti nilai sebenarnya (boleh negatif).
    value: `${totalAssetProfit.value >= 0 ? '+' : '-'}Rp ${formatRupiah(Math.abs(totalAssetProfit.value))}`,
    sublabel: `(${averageAssetMargin.value >= 0 ? '+' : ''}${averageAssetMargin.value}%)`,
    icon: Coins,
    iconBoxClass: totalAssetProfit.value >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700',
    valClass: totalAssetProfit.value >= 0 ? 'text-teal-800' : 'text-rose-700',
    sublabelClass: totalAssetProfit.value >= 0 ? 'text-emerald-600 font-semibold font-mono' : 'text-rose-600 font-semibold font-mono'
  },
  {
    label: 'Kategori / Supplier',
    value: `${categoriesCount.value} Vendor`,
    icon: Truck,
    iconBoxClass: 'bg-rose-50 text-rose-700',
    valClass: 'text-rose-800'
  }
]);

type SkuSortField = 'code' | 'name' | 'category' | 'supplier' | 'unit' | 'margin' | 'buyPrice' | 'sellPrice' | 'stock';
type SortDirection = 'asc' | 'desc';

const sortField = ref<SkuSortField>('name');
const sortDirection = ref<SortDirection>('asc');

function toggleSort(field: SkuSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = ['margin', 'buyPrice', 'sellPrice', 'stock'].includes(field) ? 'desc' : 'asc';
  }
}

const sortedProducts = computed(() => {
  const list = [...filteredProducts.value];
  const field = sortField.value;
  const dir = sortDirection.value === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    switch (field) {
      case 'code':
        return dir * (a.code || '').localeCompare(b.code || '');
      case 'name':
        return dir * (a.name || '').localeCompare(b.name || '');
      case 'category':
        return dir * (a.category || '').localeCompare(b.category || '');
      case 'supplier': {
        const suppA = a.supplier || resolveProductSupplier(a) || '';
        const suppB = b.supplier || resolveProductSupplier(b) || '';
        return dir * suppA.localeCompare(suppB);
      }
      case 'unit':
        return dir * (a.unit || '').localeCompare(b.unit || '');
      case 'margin': {
        const mA = a.defaultMarkupPercent ?? inventoryStore.getCategoryMarkup(a.category) ?? 0;
        const mB = b.defaultMarkupPercent ?? inventoryStore.getCategoryMarkup(b.category) ?? 0;
        return dir * (mA - mB);
      }
      case 'buyPrice':
        return dir * ((a.lastBuyPrice || 0) - (b.lastBuyPrice || 0));
      case 'sellPrice':
        return dir * ((a.lastSellPrice || 0) - (b.lastSellPrice || 0));
      case 'stock':
        return dir * ((a.stock || 0) - (b.stock || 0));
      default:
        return 0;
    }
  });

  return list;
});

function handleDblClick(prod: Product) {
  emit('edit-product', prod);
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-white select-none text-xs overflow-hidden">
    <!-- 1. Mobile-First Top Header & Action Controls -->
    <div class="bg-[#f6f5f2] border-b border-gray-200 p-2.5 flex flex-col gap-2 shrink-0 select-none shadow-2xs">
      <!-- Top Row: Title, SKU Count & Primary Add Button -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <Package :size="16" />
          </div>
          <div class="min-w-0 flex flex-col">
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-xs text-gray-900 truncate">Katalog Barang (SKU)</span>
              <span class="text-[10px] px-2 py-0.2 rounded-full bg-purple-100 text-purple-800 font-bold font-mono">
                {{ filteredProducts.length }}/{{ inventoryStore.products.length }}
              </span>
            </div>
            <span class="text-[10px] text-gray-500">Master inventaris toko & kulakan</span>
          </div>
        </div>

        <!-- Tombol Tambah Barang Baru (Mobile Touch Friendly) -->
        <button
          type="button"
          @click="emit('add-product')"
          class="h-8 px-3 rounded-lg bg-purple-600 hover:bg-purple-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
        >
          <Plus :size="14" />
          <span>+ Barang</span>
        </button>
      </div>

      <!-- Bottom Row: Marketplace-Style Filter Drawer Trigger & Quick Action Buttons -->
      <div v-horizontal-scroll class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        <!-- Marketplace Filter Drawer Trigger Button -->
        <button
          type="button"
          @click="showFilterDrawer = true"
          class="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 shadow-xs whitespace-nowrap active:scale-95"
          :class="activeFiltersCount > 0
            ? 'bg-purple-600 text-white border-purple-600 shadow-purple-500/20'
            : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'"
        >
          <SlidersHorizontal :size="13" />
          <span>Filter</span>
          <span
            v-if="activeFiltersCount > 0"
            class="px-1.5 py-0.2 rounded-full bg-white text-purple-700 font-mono text-[10px] font-bold"
          >
            {{ activeFiltersCount }}
          </span>
        </button>

        <!-- Active Filter Chip: Kategori -->
        <div
          v-if="selectedCategory !== 'Semua'"
          class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200 rounded-lg shrink-0 whitespace-nowrap"
        >
          <span>Kategori: <strong>{{ selectedCategory }}</strong></span>
          <button
            type="button"
            class="p-0.5 hover:bg-purple-200 rounded-full cursor-pointer ml-0.5"
            @click="selectedCategory = 'Semua'"
          >
            <X :size="11" />
          </button>
        </div>

        <!-- Active Filter Chip: Supplier -->
        <div
          v-if="selectedSupplier !== 'Semua'"
          class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 rounded-lg shrink-0 whitespace-nowrap"
        >
          <span>Supplier: <strong>{{ selectedSupplier }}</strong></span>
          <button
            type="button"
            class="p-0.5 hover:bg-blue-200 rounded-full cursor-pointer ml-0.5"
            @click="selectedSupplier = 'Semua'"
          >
            <X :size="11" />
          </button>
        </div>

        <!-- Active Filter Chip: Stok -->
        <div
          v-if="selectedStockStatus !== 'Semua'"
          class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-lg shrink-0 whitespace-nowrap"
        >
          <span>Stok: <strong>{{ selectedStockStatus }}</strong></span>
          <button
            type="button"
            class="p-0.5 hover:bg-amber-200 rounded-full cursor-pointer ml-0.5"
            @click="selectedStockStatus = 'Semua'"
          >
            <X :size="11" />
          </button>
        </div>

        <!-- Reset Button jika ada filter aktif -->
        <button
          v-if="activeFiltersCount > 0"
          type="button"
          class="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors shrink-0 whitespace-nowrap"
          title="Hapus semua filter"
          @click="resetAllFilters"
        >
          <RotateCcw :size="11" />
          <span>Reset</span>
        </button>

        <div class="h-4 w-px bg-gray-300 shrink-0"></div>

        <!-- Tombol Buku Mutasi / Kartu Stok Semua Produk -->
        <button
          type="button"
          class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border cursor-pointer transition-colors shrink-0 bg-white hover:bg-purple-50 text-purple-700 border-purple-200 shadow-2xs whitespace-nowrap"
          title="Lihat buku mutasi dan kartu stok gabungan seluruh produk"
          @click="movementStore.openStockCard(null)"
        >
          <FileText :size="12" />
          <span>Kartu Stok</span>
        </button>

        <!-- Tombol Adjust Stok (Opname) -->
        <button
          type="button"
          class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border cursor-pointer transition-colors shrink-0 bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs whitespace-nowrap"
          title="Sesuaikan stok fisik dengan sistem (Stock Opname)"
          @click="movementStore.openAdjustModal()"
        >
          <Scale :size="12" />
          <span>Opname</span>
        </button>

        <!-- Tombol Barang Rusak (Waste) -->
        <button
          type="button"
          class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border cursor-pointer transition-colors shrink-0 bg-white hover:bg-rose-50 text-rose-700 border-rose-200 shadow-2xs whitespace-nowrap"
          title="Catat barang rusak / pecah / susut / expired"
          @click="returnStore.openWasteModal()"
        >
          <AlertTriangle :size="12" />
          <span>Barang Rusak</span>
        </button>

        <!-- Indikator Query Pencarian -->
        <span
          v-if="props.searchQuery"
          class="text-[10.5px] text-gray-600 bg-gray-200/80 px-2 py-0.5 rounded-md font-medium shrink-0 whitespace-nowrap"
        >
          Cari: "<strong class="text-gray-900">{{ props.searchQuery }}</strong>"
        </span>
      </div>
    </div>

    <!-- 2. Reusable MetricStatsStrip (DRY) -->
    <MetricStatsStrip :items="metricStats" />

    <!-- Table of SKUs (Edge-to-Edge) -->
    <AppTableContainer
      :is-empty="filteredProducts.length === 0"
      :empty-icon="Package"
      empty-title="Belum Ada Barang Dagangan"
      empty-description="Tidak ada barang atau SKU yang cocok dengan pencarian."
    >
      <table class="table-explorer whitespace-nowrap min-w-[850px]">
        <thead>
          <tr>
            <th
              class="is-sortable w-28 whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'code' }"
              title="Klik untuk mengurutkan kode"
              @click="toggleSort('code')"
            >
              <div class="flex items-center gap-1.5">
                <span>KODE</span>
                <ArrowUp v-if="sortField === 'code' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'code' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
              </div>
            </th>
            <th
              class="is-sortable whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'name' }"
              title="Klik untuk mengurutkan nama barang"
              @click="toggleSort('name')"
            >
              <div class="flex items-center gap-1.5">
                <span>NAMA BARANG</span>
                <ArrowUp v-if="sortField === 'name' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'name' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
              </div>
            </th>
            <th
              class="is-sortable w-32 whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'category' }"
              title="Klik untuk mengurutkan kategori"
              @click="toggleSort('category')"
            >
              <div class="flex items-center gap-1.5">
                <span>KATEGORI</span>
                <ArrowUp v-if="sortField === 'category' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'category' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
              </div>
            </th>
            <th
              class="is-sortable w-32 whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'supplier' }"
              title="Klik untuk mengurutkan mitra supplier"
              @click="toggleSort('supplier')"
            >
              <div class="flex items-center gap-1.5">
                <span>MITRA SUPPLIER</span>
                <ArrowUp v-if="sortField === 'supplier' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'supplier' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
              </div>
            </th>
            <th
              class="is-sortable w-16 text-center whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'unit' }"
              title="Klik untuk mengurutkan satuan"
              @click="toggleSort('unit')"
            >
              <div class="flex items-center justify-center gap-1.5">
                <span>SATUAN</span>
                <ArrowUp v-if="sortField === 'unit' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'unit' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
              </div>
            </th>
            <th
              class="is-sortable w-24 text-center whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'margin' }"
              title="Klik untuk mengurutkan margin"
              @click="toggleSort('margin')"
            >
              <div class="flex items-center justify-center gap-1.5">
                <span>MARGIN (%)</span>
                <ArrowUp v-if="sortField === 'margin' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'margin' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
              </div>
            </th>
            <th
              class="is-sortable w-28 text-right whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'buyPrice' }"
              title="Klik untuk mengurutkan modal beli"
              @click="toggleSort('buyPrice')"
            >
              <div class="flex items-center justify-end gap-1.5">
                <span>MODAL BELI</span>
                <ArrowUp v-if="sortField === 'buyPrice' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'buyPrice' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
              </div>
            </th>
            <th
              class="is-sortable w-28 text-right whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'sellPrice' }"
              title="Klik untuk mengurutkan harga jual"
              @click="toggleSort('sellPrice')"
            >
              <div class="flex items-center justify-end gap-1.5">
                <span>HARGA JUAL</span>
                <ArrowUp v-if="sortField === 'sellPrice' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'sellPrice' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
              </div>
            </th>
            <th
              class="is-sortable w-24 text-center whitespace-nowrap"
              :class="{ 'is-sorted': sortField === 'stock' }"
              title="Klik untuk mengurutkan stok fisik"
              @click="toggleSort('stock')"
            >
              <div class="flex items-center justify-center gap-1.5">
                <span>STOK FISIK</span>
                <ArrowUp v-if="sortField === 'stock' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                <ArrowDown v-else-if="sortField === 'stock' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
              </div>
            </th>
            <!-- Sticky Action Header -->
            <th class="th-action-sticky w-24 text-center">KARTU & AKSI</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="prod in sortedProducts"
            :key="prod.id"
            class="cursor-pointer whitespace-nowrap"
            :class="inventoryStore.activeProductForSidebar?.id === prod.id ? 'bg-[#f7f0fa] ring-1 ring-inset ring-purple-400 font-semibold' : ''"
            @click="emit('edit-product', prod)"
            @dblclick="handleDblClick(prod)"
          >
            <td class="font-mono text-gray-600 font-bold truncate whitespace-nowrap" :title="prod.code">{{ prod.code }}</td>
            <td class="font-semibold text-gray-900 truncate" :title="prod.name">{{ prod.name }}</td>
            <td class="truncate" :title="prod.category">
              <span class="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[11px] font-medium border border-purple-200 truncate block">
                {{ prod.category }}
              </span>
            </td>
            <td class="truncate" :title="prod.supplier || resolveProductSupplier(prod) || '-'">
              <span class="px-2 py-0.5 bg-gray-50 text-gray-700 rounded text-[11px] font-medium border border-gray-200 truncate block">
                {{ prod.supplier || resolveProductSupplier(prod) || '-' }}
              </span>
            </td>
            <td class="text-center font-bold text-gray-600 font-mono whitespace-nowrap">{{ prod.unit }}</td>
            <td class="text-center font-mono font-bold text-emerald-700 whitespace-nowrap">
              +{{ prod.defaultMarkupPercent || inventoryStore.getCategoryMarkup(prod.category) }}%
            </td>
            <td class="text-right font-mono text-gray-500 whitespace-nowrap">
              Rp {{ formatRupiah(prod.lastBuyPrice) }}
            </td>
            <td class="text-right font-mono font-bold text-blue-700 whitespace-nowrap">
              Rp {{ formatRupiah(prod.lastSellPrice) }}
            </td>
            <!-- Stok Fisik dengan Indikator Status -->
            <td class="text-center font-mono font-bold whitespace-nowrap">
              <span
                class="px-2 py-0.5 rounded-full text-[11px] font-bold inline-block"
                :class="
                  prod.stock === 0
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : prod.stock <= 5
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-50 text-emerald-800'
                "
                :title="prod.stock === 0 ? 'Stok Habis!' : prod.stock <= 5 ? 'Stok Menipis' : 'Stok Aman'"
              >
                {{ prod.stock }} {{ prod.unit }}
              </span>
            </td>
            <!-- Sticky Action Cell -->
            <td class="td-action-sticky text-center whitespace-nowrap" @click.stop>
              <div class="flex items-center justify-center gap-1">
                <!-- Kartu Stok -->
                <button
                  type="button"
                  class="p-1 text-purple-700 hover:text-purple-900 hover:bg-purple-100 rounded cursor-pointer transition-colors"
                  title="Lihat Kartu Stok & Mutasi"
                  @click.stop="movementStore.openStockCard(prod)"
                >
                  <FileText :size="13" />
                </button>

                <!-- Adjust Stok -->
                <button
                  type="button"
                  class="p-1 text-indigo-700 hover:text-indigo-900 hover:bg-indigo-100 rounded cursor-pointer transition-colors"
                  title="Koreksi / Adjust Stok (Opname)"
                  @click.stop="movementStore.openAdjustModal(prod)"
                >
                  <Scale :size="13" />
                </button>

                <!-- Hapus SKU -->
                <button
                  type="button"
                  class="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                  title="Hapus SKU"
                  @click.stop="handleDeleteProduct(prod)"
                >
                  <Trash2 :size="13" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </AppTableContainer>

    <!-- Marketplace-Style Filter Drawer Component -->
    <AppFilterDrawer
      :is-open="showFilterDrawer"
      title="Filter Katalog Barang"
      subtitle="Saring produk berdasarkan kategori, supplier, dan stok"
      :active-filters-count="activeFiltersCount"
      :result-count="filteredProducts.length"
      result-label="Barang"
      apply-button-color="bg-purple-600 hover:bg-purple-700 active:bg-purple-800"
      @close="showFilterDrawer = false"
      @reset="resetAllFilters"
      @apply="showFilterDrawer = false"
    >
      <!-- Seksi 1: Kategori Barang -->
      <div class="space-y-2">
        <label class="font-bold text-gray-800 text-xs block">Kategori Barang</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer"
            :class="selectedCategory === 'Semua'
              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="selectedCategory = 'Semua'"
          >
            Semua Kategori
          </button>
          <button
            v-for="cat in inventoryStore.categoryMarkups"
            :key="cat.category"
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer"
            :class="selectedCategory === cat.category
              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="selectedCategory = cat.category"
          >
            {{ cat.category }}
          </button>
        </div>
      </div>

      <!-- Seksi 2: Mitra Supplier -->
      <div class="pt-3 space-y-2">
        <label class="font-bold text-gray-800 text-xs block">Mitra Supplier / Pemasok</label>
        <SearchableSelect
          v-model="selectedSupplier"
          :options="supplierOptions"
          placeholder="Pilih Supplier..."
          search-placeholder="Cari nama supplier..."
          hotkey=""
        />
      </div>

      <!-- Seksi 3: Status Ketersediaan Stok -->
      <div class="pt-3 space-y-2">
        <label class="font-bold text-gray-800 text-xs block">Status Ketersediaan Stok</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
            :class="selectedStockStatus === 'Semua'
              ? 'bg-purple-50 border-purple-600 text-purple-900 font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="selectedStockStatus = 'Semua'"
          >
            <span>Semua Stok</span>
            <span class="w-2 h-2 rounded-full" :class="selectedStockStatus === 'Semua' ? 'bg-purple-600' : 'bg-transparent'"></span>
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
            :class="selectedStockStatus === 'Kritis'
              ? 'bg-rose-50 border-rose-600 text-rose-900 font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="selectedStockStatus = 'Kritis'"
          >
            <span>Stok Kritis (≤ 5)</span>
            <span class="w-2 h-2 rounded-full" :class="selectedStockStatus === 'Kritis' ? 'bg-rose-600' : 'bg-transparent'"></span>
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
            :class="selectedStockStatus === 'Habis'
              ? 'bg-gray-100 border-gray-600 text-gray-900 font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="selectedStockStatus = 'Habis'"
          >
            <span>Stok Habis (0)</span>
            <span class="w-2 h-2 rounded-full" :class="selectedStockStatus === 'Habis' ? 'bg-gray-600' : 'bg-transparent'"></span>
          </button>

          <button
            type="button"
            class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
            :class="selectedStockStatus === 'Tersedia'
              ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold'
              : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="selectedStockStatus = 'Tersedia'"
          >
            <span>Stok Tersedia (&gt; 0)</span>
            <span class="w-2 h-2 rounded-full" :class="selectedStockStatus === 'Tersedia' ? 'bg-emerald-600' : 'bg-transparent'"></span>
          </button>
        </div>
      </div>

      <!-- Seksi 4: Urutkan Barang (Sort) -->
      <div class="pt-3 space-y-2">
        <label class="font-bold text-gray-800 text-xs block">Urutkan Barang</label>
        <div class="flex flex-wrap gap-1.5">
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all"
            :class="sortField === 'name' ? 'bg-slate-800 text-white border-slate-800 font-bold' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="toggleSort('name')"
          >
            Nama Produk {{ sortField === 'name' ? (sortDirection === 'asc' ? '↑' : '↓') : '' }}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all"
            :class="sortField === 'stock' ? 'bg-slate-800 text-white border-slate-800 font-bold' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="toggleSort('stock')"
          >
            Jumlah Stok {{ sortField === 'stock' ? (sortDirection === 'desc' ? '↓' : '↑') : '' }}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all"
            :class="sortField === 'sellPrice' ? 'bg-slate-800 text-white border-slate-800 font-bold' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="toggleSort('sellPrice')"
          >
            Harga Jual {{ sortField === 'sellPrice' ? (sortDirection === 'desc' ? '↓' : '↑') : '' }}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-all"
            :class="sortField === 'margin' ? 'bg-slate-800 text-white border-slate-800 font-bold' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
            @click="toggleSort('margin')"
          >
            Margin Laba {{ sortField === 'margin' ? (sortDirection === 'desc' ? '↓' : '↑') : '' }}
          </button>
        </div>
      </div>
    </AppFilterDrawer>

    <!-- Floating Action Button: Tambah Barang Baru -->
    <button
      type="button"
      @click="emit('add-product')"
      class="fixed right-4 bottom-20 z-30 w-13 h-13 rounded-full bg-purple-600 hover:bg-purple-700 active:scale-95 text-white shadow-xl flex items-center justify-center transition cursor-pointer border-2 border-white/20"
      title="Tambah Barang Baru"
    >
      <Plus :size="24" />
    </button>
  </div>
</template>
