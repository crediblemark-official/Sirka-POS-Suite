<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Product, SupplierCategory } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';
import { X, Save, Plus, Edit2 } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  initialData?: Product | null;
  categories: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: Omit<Product, 'id'> | Product): void;
}>();

const inventoryStore = useInventoryStore();

const isEditMode = computed(() => !!props.initialData?.id);

const form = ref<{
  id?: string;
  code: string;
  name: string;
  category: SupplierCategory;
  unit: string;
  defaultMarkupPercent: number;
  lastBuyPrice: number;
  lastSellPrice: number;
  stock: number;
  notes: string;
}>({
  code: '',
  name: '',
  category: 'Umum',
  unit: 'PCS',
  defaultMarkupPercent: 20,
  lastBuyPrice: 0,
  lastSellPrice: 0,
  stock: 0,
  notes: ''
});

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      if (props.initialData) {
        form.value = {
          id: props.initialData.id,
          code: props.initialData.code,
          name: props.initialData.name,
          category: props.initialData.category,
          unit: props.initialData.unit,
          defaultMarkupPercent: props.initialData.defaultMarkupPercent,
          lastBuyPrice: props.initialData.lastBuyPrice,
          lastSellPrice: props.initialData.lastSellPrice,
          stock: props.initialData.stock,
          notes: props.initialData.notes || ''
        };
      } else {
        const defaultCategory = props.categories[0] || 'Umum';
        const defaultMarkup = inventoryStore.getCategoryMarkup(defaultCategory);
        form.value = {
          code: '',
          name: '',
          category: defaultCategory,
          unit: 'PCS',
          defaultMarkupPercent: defaultMarkup,
          lastBuyPrice: 0,
          lastSellPrice: 0,
          stock: 100,
          notes: ''
        };
      }
    }
  },
  { immediate: true }
);

function onCategoryChange() {
  if (!isEditMode.value) {
    form.value.defaultMarkupPercent = inventoryStore.getCategoryMarkup(form.value.category);
    recalculateSellPrice();
  }
}

function recalculateSellPrice() {
  const markup = form.value.defaultMarkupPercent ?? 20;
  form.value.lastSellPrice = Math.round((form.value.lastBuyPrice || 0) * (1 + markup / 100));
}

function handleSubmit() {
  if (!form.value.name.trim() || !form.value.unit.trim()) return;

  const payload = {
    ...form.value,
    name: form.value.name.trim().toUpperCase(),
    code: (form.value.code.trim() || `SKU-${Date.now().toString().slice(-4)}`).toUpperCase(),
    unit: form.value.unit.trim().toUpperCase(),
    lastBuyPrice: Number(form.value.lastBuyPrice) || 0,
    lastSellPrice: Number(form.value.lastSellPrice) || 0,
    stock: Number(form.value.stock) || 0
  };

  emit('save', payload as Product);
  emit('close');
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none text-xs"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl border border-gray-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <!-- Modal Header -->
      <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-sm text-gray-800">
        <div class="flex items-center gap-2">
          <component :is="isEditMode ? Edit2 : Plus" :size="16" :class="isEditMode ? 'text-blue-600' : 'text-emerald-600'" />
          <span>{{ isEditMode ? `Edit Data SKU: ${form.code}` : 'Tambah SKU Barang Baru' }}</span>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-black rounded cursor-pointer transition-colors"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleSubmit" class="p-4 space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Kode Barang</label>
            <input
              v-model="form.code"
              type="text"
              placeholder="Misal: APD-001"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-mono font-bold uppercase"
            />
          </div>
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Satuan *</label>
            <input
              v-model="form.unit"
              type="text"
              required
              placeholder="BOX / KG / PCS / LUSIN"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 uppercase font-bold"
            />
          </div>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-1">Nama Barang *</label>
          <input
            v-model="form.name"
            type="text"
            required
            placeholder="Misal: SARUNG TANGAN LATEX"
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-bold uppercase"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Kelompok Supplier / Vendor</label>
            <select
              v-model="form.category"
              @change="onCategoryChange"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-semibold"
            >
              <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">% Markup Dinamis</label>
            <input
              v-model.number="form.defaultMarkupPercent"
              type="number"
              step="0.5"
              @input="recalculateSellPrice"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-mono font-bold text-emerald-700"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Harga Beli Terakhir (HPP Rp)</label>
            <input
              v-model.number="form.lastBuyPrice"
              type="number"
              step="100"
              @input="recalculateSellPrice"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-mono text-right"
            />
          </div>
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Harga Jual (Rp)</label>
            <input
              v-model.number="form.lastSellPrice"
              type="number"
              step="100"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-mono text-right font-bold text-blue-700"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Stok Fisik Gudang</label>
            <input
              v-model.number="form.stock"
              type="number"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-mono text-center font-bold"
            />
          </div>
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Catatan / Keterangan</label>
            <input
              v-model="form.notes"
              type="text"
              placeholder="Misal: Kemasan jerigen 5L"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div class="pt-2.5 flex items-center justify-end gap-2 border-t border-gray-200">
          <button
            type="button"
            class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs cursor-pointer transition-colors"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="submit"
            class="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            <Save :size="14" />
            <span>{{ isEditMode ? 'Simpan Perubahan' : 'Simpan SKU' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
