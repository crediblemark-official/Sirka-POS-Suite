<script setup lang="ts">
import { ref } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'add-vendor'): void;
}>();

const inventoryStore = useInventoryStore();

const editingCategory = ref<string | null>(null);
const tempCategoryMarkup = ref<number>(20);

function handleStartEditMarkup(cat: string, currentMarkup: number) {
  editingCategory.value = cat;
  tempCategoryMarkup.value = currentMarkup;
}

function handleSaveCategoryMarkup(cat: string) {
  inventoryStore.updateCategoryMarkup(cat, tempCategoryMarkup.value);
  editingCategory.value = null;
}

function handleDeleteCategory(cat: string) {
  if (confirm(`Yakin ingin menghapus kategori/vendor "${cat}"?`)) {
    inventoryStore.deleteCategory(cat);
  }
}
</script>

<template>
  <div class="space-y-3 select-none text-xs">
    <!-- Header Card -->
    <div class="p-3 bg-white border border-[#dedbd6] rounded-lg shadow-xs flex items-center justify-between">
      <div>
        <span class="font-bold text-xs text-emerald-700 block">Aturan Default % Markup Dinamis per Kelompok Supplier</span>
        <p class="text-[11px] text-gray-500">
          Setiap kategori/vendor memiliki persentase keuntungan sendiri yang terhitung otomatis saat nota datang.
        </p>
      </div>
      <button
        type="button"
        class="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
        @click="emit('add-vendor')"
      >
        <Plus :size="14" />
        <span>+ Tambah Vendor / Kategori Baru</span>
      </button>
    </div>

    <!-- Vendor Grid Cards -->
    <div class="grid grid-cols-3 gap-3">
      <div
        v-for="setting in inventoryStore.categoryMarkups"
        :key="setting.category"
        class="p-3 bg-white border border-gray-200 rounded-lg shadow-xs flex flex-col justify-between gap-3 hover:border-emerald-300 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div>
            <span class="font-bold text-xs text-gray-900 block">{{ setting.category }}</span>
            <span class="text-[11px] text-gray-500 block mt-0.5">{{ setting.description || 'Kelompok Barang' }}</span>
          </div>
          <button
            type="button"
            class="text-gray-300 hover:text-red-500 p-1 rounded cursor-pointer transition-colors"
            title="Hapus Kategori"
            @click="handleDeleteCategory(setting.category)"
          >
            <Trash2 :size="13" />
          </button>
        </div>

        <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
          <span class="text-[11px] text-gray-600 font-medium">Markup Laba:</span>

          <div class="flex items-center gap-1.5">
            <template v-if="editingCategory === setting.category">
              <input
                v-model.number="tempCategoryMarkup"
                type="number"
                step="0.5"
                min="0"
                max="100"
                class="w-16 bg-gray-50 border border-blue-500 rounded px-1.5 py-0.5 text-xs font-mono font-bold text-emerald-700 outline-none"
                @keyup.enter="handleSaveCategoryMarkup(setting.category)"
                @keyup.esc="editingCategory = null"
              />
              <span class="font-bold text-gray-500 text-xs">%</span>
              <button
                type="button"
                class="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer shadow-xs"
                title="Simpan"
                @click="handleSaveCategoryMarkup(setting.category)"
              >
                <Check :size="12" />
              </button>
              <button
                type="button"
                class="p-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded cursor-pointer"
                title="Batal"
                @click="editingCategory = null"
              >
                <X :size="12" />
              </button>
            </template>

            <template v-else>
              <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold font-mono text-xs">
                +{{ setting.defaultMarkupPercent }}%
              </span>
              <button
                type="button"
                class="p-1 text-gray-400 hover:text-blue-600 rounded cursor-pointer transition-colors"
                title="Ubah Markup"
                @click="handleStartEditMarkup(setting.category, setting.defaultMarkupPercent)"
              >
                <Edit2 :size="12" />
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
