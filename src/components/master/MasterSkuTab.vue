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
  Truck
} from 'lucide-vue-next';
import AppEmptyState from '../common/AppEmptyState.vue';

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

function handleDblClick(prod: Product) {
  emit('edit-product', prod);
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-white select-none text-xs overflow-hidden">
    <!-- 1. Ringkasan Metrik Cepat Aset Inventori (Seimbang Terbagi Rata 6 Kolom, Identik Kulakan) -->
    <div class="flex items-center divide-x divide-gray-200 px-2 py-2 border-b border-gray-200 bg-white shrink-0">
      <!-- 1. Total SKU -->
      <div class="flex items-center gap-2 px-2.5 first:pl-1 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
          <Package :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Total SKU Barang</div>
          <div class="text-xs font-bold text-gray-800 font-mono mt-0.5 truncate">{{ filteredProducts.length }} SKU</div>
        </div>
      </div>

      <!-- 2. Total Fisik Stok -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <Boxes :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Fisik Stok di Toko</div>
          <div class="text-xs font-bold text-blue-800 font-mono mt-0.5 truncate">{{ totalStockQty }} Unit / Pcs</div>
        </div>
      </div>

      <!-- 3. Total Nilai Modal Stok (HPP) -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <PackageCheck :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Nilai Aset Modal (HPP)</div>
          <div class="text-xs font-bold text-emerald-700 font-mono mt-0.5 truncate">Rp {{ formatRupiah(totalAssetBuy) }}</div>
        </div>
      </div>

      <!-- 4. Potensi Nilai Jual Stok -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          <TrendingUp :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Estimasi Nilai Jual Stok</div>
          <div class="text-xs font-bold text-amber-800 font-mono mt-0.5 truncate">Rp {{ formatRupiah(totalAssetSell) }}</div>
        </div>
      </div>

      <!-- 5. Potensi Margin Aset -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
          <Coins :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Potensi Margin Aset</div>
          <div class="text-xs font-bold text-teal-800 font-mono mt-0.5 truncate">+Rp {{ formatRupiah(totalAssetProfit) }} <span class="text-[10px] font-semibold text-emerald-600 font-mono">(+{{ averageAssetMargin }}%)</span></div>
        </div>
      </div>

      <!-- 6. Total Supplier -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
          <Truck :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Kategori / Supplier</div>
          <div class="text-xs font-bold text-rose-800 font-mono mt-0.5 truncate">{{ categoriesCount }} Vendor</div>
        </div>
      </div>
    </div>

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
