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
  ArrowDown
} from 'lucide-vue-next';
import AppTableContainer from '../common/AppTableContainer.vue';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
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

const selectedCategory = ref<string>('Semua');
const selectedSupplier = ref<string>('Semua');

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
    <!-- 1. Top Ribbon: Title, Counter & Filters (Left-aligned) -->
    <div
      v-horizontal-scroll
      class="h-10 relative flex items-center bg-[#f6f5f2] border-b border-gray-200 px-3 select-none shrink-0 gap-3 overflow-x-auto no-scrollbar"
    >
      <!-- Judul & Badge Counter -->
      <div class="flex items-center gap-2 shrink-0">
        <Package :size="15" class="text-purple-700" />
        <span class="font-bold text-xs text-gray-800">Daftar Barang (SKU)</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold font-mono">
          {{ filteredProducts.length }} / {{ inventoryStore.products.length }}
        </span>
      </div>

      <div class="h-4 w-px bg-gray-300 shrink-0"></div>

      <!-- Filter Kategori (Di Kiri) -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-[11px] text-gray-500 font-medium">Kategori:</span>
        <div class="w-44">
          <SearchableSelect
            v-model="selectedCategory"
            :options="categoryOptions"
            placeholder="Semua Kategori"
            search-placeholder="Cari kategori..."
            hotkey=""
            size="sm"
          />
        </div>
      </div>

      <!-- Filter Supplier (Di Kiri) -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-[11px] text-gray-500 font-medium">Supplier:</span>
        <div class="w-44">
          <SearchableSelect
            v-model="selectedSupplier"
            :options="supplierOptions"
            placeholder="Semua Supplier"
            search-placeholder="Cari supplier..."
            hotkey=""
            size="sm"
          />
        </div>
      </div>

      <!-- Sisi Kanan: Indikator Pencarian & Tombol Aksi (Adjust Stok & Barang Rusak) -->
      <div class="flex items-center gap-2 shrink-0 ml-auto">
        <span
          v-if="props.searchQuery"
          class="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium"
        >
          Cari: "<span class="font-bold text-gray-800">{{ props.searchQuery }}</span>"
        </span>

        <!-- Tombol Buku Mutasi / Kartu Stok Semua Produk -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded border cursor-pointer transition-colors shadow-2xs bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-700 border-purple-300"
          title="Lihat buku mutasi dan kartu stok gabungan seluruh produk"
          @click="movementStore.openStockCard(null)"
        >
          <FileText :size="13" />
          <span>Kartu Stok Semua</span>
        </button>

        <!-- Tombol Adjust Stok (Opname) -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded border cursor-pointer transition-colors shadow-2xs bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 border-indigo-300"
          title="Sesuaikan stok fisik dengan sistem (Stock Opname)"
          @click="movementStore.openAdjustModal()"
        >
          <Scale :size="13" />
          <span>Adjust Stok</span>
        </button>

        <!-- Tombol Barang Rusak (Waste) -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded border cursor-pointer transition-colors shadow-2xs bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border-rose-300"
          title="Catat barang rusak / pecah / susut / expired"
          @click="returnStore.openWasteModal()"
        >
          <AlertTriangle :size="13" />
          <span>Barang Rusak</span>
        </button>
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
            <td class="font-semibold text-gray-900 truncate" :title="prod.name">
              <div class="flex items-center gap-1.5 truncate">
                <span v-if="prod.productType === 'SERVICE'" class="px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded text-[9.5px] font-bold shrink-0">🔧 JASA</span>
                <span v-else-if="prod.productType === 'FNB_MENU'" class="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9.5px] font-bold shrink-0">🍽️ MENU</span>
                <span class="truncate">{{ prod.name }}</span>
                <span v-if="prod.tierPricing && prod.tierPricing.length > 0" class="text-[9px] px-1 bg-blue-100 text-blue-800 rounded font-bold shrink-0" title="Ada harga grosir bertingkat">Tier</span>
              </div>
            </td>
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
                v-if="prod.productType === 'SERVICE'"
                class="px-2 py-0.5 rounded-full text-[10px] font-bold inline-block bg-indigo-50 text-indigo-700 border border-indigo-200"
                title="Layanan Jasa (Bebas Stok Fisik Gudang)"
              >
                ∞ JASA
              </span>
              <span
                v-else
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
  </div>
</template>
