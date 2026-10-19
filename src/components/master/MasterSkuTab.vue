<script setup lang="ts">
import { computed } from 'vue';
import { Product } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';
import { formatRupiah } from '../../utils/formatters';
import {
  Trash2,
  Package,
  Boxes,
  PackageCheck,
  TrendingUp,
  Coins,
  Truck,
  RotateCcw
} from 'lucide-vue-next';
import AppEmptyState from '../common/AppEmptyState.vue';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';

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

const filteredProducts = computed(() => {
  const q = (props.searchQuery || '').toLowerCase().trim();
  if (!q) return inventoryStore.products;
  return inventoryStore.products.filter(
    p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  );
});

// Metrik Lengkap Aset Stok Barang
const totalStockQty = computed(() => {
  return filteredProducts.value.reduce((acc, p) => acc + (p.stock || 0), 0);
});

const totalAssetBuy = computed(() => {
  return filteredProducts.value.reduce((acc, p) => acc + ((p.stock || 0) * (p.lastBuyPrice || 0)), 0);
});

const totalAssetSell = computed(() => {
  return filteredProducts.value.reduce((acc, p) => acc + ((p.stock || 0) * (p.lastSellPrice || 0)), 0);
});

const totalAssetProfit = computed(() => {
  return Math.max(0, totalAssetSell.value - totalAssetBuy.value);
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
    value: `${totalStockQty.value} Unit / Pcs`,
    icon: Boxes,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-blue-800'
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
    value: `+Rp ${formatRupiah(totalAssetProfit.value)}`,
    sublabel: `(+${averageAssetMargin.value}%)`,
    icon: Coins,
    iconBoxClass: 'bg-teal-50 text-teal-700',
    valClass: 'text-teal-800',
    sublabelClass: 'text-emerald-600 font-semibold font-mono'
  },
  {
    label: 'Kategori / Supplier',
    value: `${categoriesCount.value} Vendor`,
    icon: Truck,
    iconBoxClass: 'bg-rose-50 text-rose-700',
    valClass: 'text-rose-800'
  }
]);

function handleDblClick(prod: Product) {
  emit('edit-product', prod);
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-white select-none text-xs overflow-hidden">
    <!-- 1. Top Ribbon: Title, Counter & Action -->
    <div
      v-horizontal-scroll
      class="h-10 relative flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 select-none shrink-0 gap-1.5 overflow-x-auto no-scrollbar"
    >
      <div class="flex items-center gap-2 shrink-0">
        <Package :size="15" class="text-purple-700" />
        <span class="font-bold text-xs text-gray-800">Daftar Barang Dagangan (Katalog SKU)</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold font-mono">
          {{ inventoryStore.products.length }} SKU
        </span>
      </div>

      <!-- Sisi Kanan: Search indicator, Reset Bawaan & Action Tambah Barang -->
      <div class="flex items-center gap-2 shrink-0 ml-auto">
        <span v-if="props.searchQuery" class="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium">
          Cari: "<span class="font-bold text-gray-800">{{ props.searchQuery }}</span>"
        </span>

        <button
          type="button"
          class="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-gray-100 text-gray-700 rounded text-xs font-semibold cursor-pointer border border-gray-300 transition-colors shadow-2xs"
          title="Kembalikan data ke daftar bawaan"
          @click="inventoryStore.resetToDefaults"
        >
          <RotateCcw :size="11" />
          <span>Reset Bawaan</span>
        </button>
      </div>
    </div>

    <!-- 2. Reusable MetricStatsStrip (DRY) -->
    <MetricStatsStrip :items="metricStats" />

    <!-- Table of SKUs (Edge-to-Edge) -->
    <div class="flex-1" :class="inventoryStore.showProductSidebar ? 'overflow-auto' : 'overflow-y-auto overflow-x-hidden'">
      <AppEmptyState
        v-if="filteredProducts.length === 0"
        :icon="Package"
        title="Belum Ada Barang Dagangan"
        description="Tidak ada barang atau SKU yang cocok dengan pencarian."
      />

      <table v-else class="table-explorer" :class="inventoryStore.showProductSidebar ? 'min-w-[720px]' : ''">
        <thead>
          <tr>
            <th class="w-28">KODE</th>
            <th>NAMA BARANG</th>
            <th class="w-36">PEMASOK / SUPPLIER</th>
            <th class="w-16 text-center">SATUAN</th>
            <th class="w-24 text-center">MARGIN (%)</th>
            <th class="w-28 text-right">MODAL BELI</th>
            <th class="w-28 text-right">HARGA JUAL</th>
            <th class="w-16 text-center">STOK</th>
            <!-- Sticky Action Header -->
            <th class="th-action-sticky w-16 text-center">AKSI</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="prod in filteredProducts"
            :key="prod.id"
            class="cursor-pointer"
            :class="inventoryStore.activeProductForSidebar?.id === prod.id ? 'bg-[#f7f0fa] ring-1 ring-inset ring-purple-400 font-semibold' : ''"
            @click="emit('edit-product', prod)"
            @dblclick="handleDblClick(prod)"
          >
            <td class="font-mono text-gray-600 font-bold truncate whitespace-nowrap" :title="prod.code">{{ prod.code }}</td>
            <td class="font-semibold text-gray-900 truncate" :title="prod.name">{{ prod.name }}</td>
            <td class="truncate" :title="prod.category">
              <span class="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[11px] font-medium border border-gray-200 truncate block">
                {{ prod.category }}
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
            <td class="text-center font-mono font-bold text-gray-800 whitespace-nowrap">
              {{ prod.stock }}
            </td>
            <!-- Sticky Action Cell -->
            <td class="td-action-sticky text-center whitespace-nowrap" @click.stop>
              <div class="flex items-center justify-center">
                <button
                  type="button"
                  class="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                  title="Hapus SKU"
                  @click.stop="inventoryStore.deleteProduct(prod.id)"
                >
                  <Trash2 :size="13" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
