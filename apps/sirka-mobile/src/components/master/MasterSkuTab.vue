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
  Edit2,
  ArrowUpDown
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

    <!-- Sort Selector Bar for Mobile -->
    <div class="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-1.5 text-[11px] text-gray-600">
        <ArrowUpDown :size="13" class="text-purple-600" />
        <span class="font-medium">Urut:</span>
        <select
          :value="sortField"
          class="bg-white border border-gray-300 rounded px-2 py-0.5 text-xs text-gray-800 font-medium focus:ring-1 focus:ring-purple-500 focus:outline-none"
          @change="e => sortField = (e.target as HTMLSelectElement).value as any"
        >
          <option value="name">Nama Barang</option>
          <option value="code">Kode SKU</option>
          <option value="category">Kategori</option>
          <option value="stock">Jumlah Stok</option>
          <option value="sellPrice">Harga Jual</option>
          <option value="buyPrice">Harga Beli</option>
        </select>
      </div>

      <button
        type="button"
        class="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 rounded text-xs font-semibold text-gray-700 active:bg-gray-100"
        @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
      >
        <span>{{ sortDirection === 'asc' ? 'A-Z (Naik)' : 'Z-A (Turun)' }}</span>
        <ArrowUp v-if="sortDirection === 'asc'" :size="12" class="text-purple-600" />
        <ArrowDown v-else :size="12" class="text-purple-600" />
      </button>
    </div>

    <!-- Mobile Product Cards List -->
    <div class="flex-1 overflow-y-auto p-3 space-y-3 pb-24">
      <div
        v-if="sortedProducts.length === 0"
        class="flex flex-col items-center justify-center p-8 text-center text-gray-500"
      >
        <Package :size="40" class="text-gray-300 mb-2" />
        <p class="font-bold text-gray-700 text-sm">Belum Ada Barang Dagangan</p>
        <p class="text-xs text-gray-500 max-w-xs mt-1">Tidak ada barang atau SKU yang cocok dengan pencarian / filter.</p>
      </div>

      <div
        v-for="prod in sortedProducts"
        :key="prod.id"
        class="bg-white rounded-xl border border-gray-200 shadow-xs p-3.5 flex flex-col gap-2.5 transition-all"
        :class="inventoryStore.activeProductForSidebar?.id === prod.id ? 'ring-2 ring-purple-500 bg-purple-50/20' : ''"
        @click="emit('edit-product', prod)"
      >
        <!-- Card Top: SKU, Kategori, Stok Badge -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="font-mono text-[11px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
              {{ prod.code }}
            </span>
            <span class="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-[11px] font-medium border border-purple-200">
              {{ prod.category }}
            </span>
          </div>

          <!-- Stock Status Badge -->
          <span
            class="px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0"
            :class="
              prod.stock === 0
                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                : prod.stock <= 5
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            "
          >
            {{ prod.stock === 0 ? 'Habis (0)' : prod.stock + ' ' + prod.unit }}
          </span>
        </div>

        <!-- Product Name & Supplier -->
        <div>
          <h4 class="font-bold text-sm text-gray-900 leading-snug">{{ prod.name }}</h4>
          <p class="text-[11px] text-gray-500 mt-0.5">
            Supplier: <span class="font-medium text-gray-700">{{ prod.supplier || resolveProductSupplier(prod) || '-' }}</span>
          </p>
        </div>

        <!-- Price Breakdown Strip -->
        <div class="grid grid-cols-2 gap-2 bg-gray-50/80 rounded-lg p-2 border border-gray-100">
          <div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Harga Beli</div>
            <div class="font-mono text-xs text-gray-700">Rp {{ formatRupiah(prod.lastBuyPrice) }}</div>
          </div>
          <div>
            <div class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Harga Jual</div>
            <div class="font-mono text-sm font-bold text-blue-700">Rp {{ formatRupiah(prod.lastSellPrice) }}</div>
          </div>
        </div>

        <!-- Action Buttons (Thumb-friendly touch targets) -->
        <div class="flex items-center justify-between pt-1 border-t border-gray-100 gap-2" @click.stop>
          <div class="flex items-center gap-1.5 flex-1">
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 bg-purple-50 active:bg-purple-100 text-purple-700 font-semibold rounded-lg text-xs border border-purple-200 transition-colors"
              @click.stop="emit('edit-product', prod)"
            >
              <Edit2 :size="13" />
              <span>Edit</span>
            </button>

            <button
              type="button"
              class="flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-50 active:bg-gray-100 text-gray-700 font-medium rounded-lg text-xs border border-gray-200 transition-colors"
              title="Lihat Kartu Stok"
              @click.stop="movementStore.openStockCard(prod)"
            >
              <FileText :size="13" />
              <span>Kartu</span>
            </button>

            <button
              type="button"
              class="flex items-center justify-center gap-1 py-1.5 px-2 bg-indigo-50 active:bg-indigo-100 text-indigo-700 font-medium rounded-lg text-xs border border-indigo-200 transition-colors"
              title="Opname / Sesuaikan Stok"
              @click.stop="movementStore.openAdjustModal(prod)"
            >
              <Scale :size="13" />
              <span>Opname</span>
            </button>
          </div>

          <button
            type="button"
            class="p-2 text-gray-400 active:text-rose-600 active:bg-rose-50 rounded-lg border border-gray-200 transition-colors"
            title="Hapus Barang"
            @click.stop="handleDeleteProduct(prod)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>

    <!-- Floating Action Button: + Barang Baru -->
    <button
      type="button"
      class="fixed right-4 bottom-20 z-30 flex items-center gap-2 px-4 py-3 bg-purple-700 active:bg-purple-800 text-white font-bold rounded-full shadow-lg shadow-purple-900/25 cursor-pointer transition-transform active:scale-95"
      @click="emit('add-product')"
    >
      <Plus :size="18" />
      <span class="text-xs">Barang Baru</span>
    </button>
  </div>
</template>
