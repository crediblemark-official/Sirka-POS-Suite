<script setup lang="ts">
import { ref, computed } from 'vue';
import { Product } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';
import { formatRupiah } from '../../utils/formatters';
import { Search, Plus, Edit2, Trash2 } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'add-product'): void;
  (e: 'edit-product', prod: Product): void;
}>();

const inventoryStore = useInventoryStore();
const searchQuery = ref('');

const filteredProducts = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return inventoryStore.products;
  return inventoryStore.products.filter(
    p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
  );
});

function handleDblClick(prod: Product) {
  emit('edit-product', prod);
}
</script>

<template>
  <div class="bg-white border border-[#dedbd6] rounded-lg shadow-xs flex flex-col overflow-hidden text-xs select-none">
    <!-- Header Bar -->
    <div class="p-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="font-bold text-xs text-blue-700">Daftar Semua Barang Aktif ({{ inventoryStore.products.length }} Item)</span>
        <button
          type="button"
          class="px-2 py-0.5 bg-gray-200 hover:bg-gray-300 rounded text-[11px] font-semibold text-gray-700 cursor-pointer transition-colors"
          title="Reset ke bawaan spreadsheet PRD"
          @click="inventoryStore.resetToDefaults"
        >
          Reset Bawaan
        </button>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 rounded w-60 shadow-inner">
          <Search :size="13" class="text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari SKU atau nama barang..."
            class="bg-transparent outline-none text-xs w-full text-gray-700"
          />
        </div>

        <button
          type="button"
          class="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
          @click="emit('add-product')"
        >
          <Plus :size="14" />
          <span>+ Tambah SKU Baru</span>
        </button>
      </div>
    </div>

    <!-- Table of SKUs -->
    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left">
        <thead class="bg-[#fcfbfa] border-b border-gray-200 text-gray-600 font-semibold">
          <tr>
            <th class="p-2 w-24">KODE</th>
            <th class="p-2">NAMA BARANG</th>
            <th class="p-2 w-36">KELOMPOK SUPPLIER</th>
            <th class="p-2 w-20 text-center">SATUAN</th>
            <th class="p-2 w-24 text-center">DEFAULT %</th>
            <th class="p-2 w-32 text-right">BELI TERAKHIR</th>
            <th class="p-2 w-32 text-right">HARGA JUAL</th>
            <th class="p-2 w-24 text-center">STOK</th>
            <th class="p-2 w-20 text-center">AKSI</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="prod in filteredProducts"
            :key="prod.id"
            class="border-b border-gray-100 hover:bg-[#faf9f7] cursor-pointer transition-colors"
            @dblclick="handleDblClick(prod)"
          >
            <td class="p-2 font-mono text-gray-500 font-bold">{{ prod.code }}</td>
            <td class="p-2 font-semibold text-gray-900">{{ prod.name }}</td>
            <td class="p-2">
              <span class="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[11px] font-medium border border-gray-200">
                {{ prod.category }}
              </span>
            </td>
            <td class="p-2 text-center font-bold text-gray-600">{{ prod.unit }}</td>
            <td class="p-2 text-center font-mono font-bold text-emerald-700">
              +{{ prod.defaultMarkupPercent || inventoryStore.getCategoryMarkup(prod.category) }}%
            </td>
            <td class="p-2 text-right font-mono text-gray-500">Rp {{ formatRupiah(prod.lastBuyPrice) }}</td>
            <td class="p-2 text-right font-mono font-bold text-blue-700">Rp {{ formatRupiah(prod.lastSellPrice) }}</td>
            <td class="p-2 text-center font-mono font-semibold">{{ prod.stock }}</td>
            <td class="p-2 text-center">
              <div class="flex items-center justify-center gap-1">
                <button
                  type="button"
                  class="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                  title="Edit SKU Produk"
                  @click.stop="emit('edit-product', prod)"
                >
                  <Edit2 :size="13" />
                </button>
                <button
                  type="button"
                  class="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
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
