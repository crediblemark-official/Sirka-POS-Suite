<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { PreOrderSchedule, PreOrderItem, SupplierCategory } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { X, Plus, Trash2, Calendar, Save } from 'lucide-vue-next';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import { formatRupiah } from '../../utils/formatters';

const props = defineProps<{
  isOpen: boolean;
  initialData?: PreOrderSchedule | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', schedule: PreOrderSchedule | Omit<PreOrderSchedule, 'id'>): void;
}>();

const inventoryStore = useInventoryStore();
const buyerStore = useBuyerStore();

const isEditMode = computed(() => !!props.initialData?.id);

const formDate = ref(new Date().toISOString().split('T')[0]);
const formBuyer = ref('');
const formItems = ref<PreOrderItem[]>([]);

// Form input for new item row
const selectedProductId = ref('');
const newItemQty = ref<number>(1);
const newItemPackaging = ref('');

const buyerOptions = computed<SelectOption[]>(() =>
  buyerStore.buyers.map(b => ({
    value: b.name,
    label: b.name,
    code: b.customerType || 'B2B',
    badge: b.customerType || 'B2B',
    sublabel: b.address ? `${b.address}` : undefined
  }))
);

const productOptions = computed<SelectOption[]>(() =>
  inventoryStore.products.map(p => ({
    value: p.id,
    label: p.name,
    sublabel: `Stok: ${p.stock} ${p.unit} • Rp ${formatRupiah(p.lastSellPrice || 0)}`
  }))
);

function handleSelectProduct(_opt?: SelectOption) {
  if (selectedProduct.value && !newItemPackaging.value) {
    newItemPackaging.value = `${newItemQty.value} ${selectedProduct.value.unit}`;
  }
}

const dayNamesIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const detectedDayName = computed(() => {
  if (!formDate.value) return 'Senin';
  const d = new Date(formDate.value);
  return dayNamesIndo[d.getDay()] || 'Senin';
});

const selectedProduct = computed(() =>
  inventoryStore.products.find(p => p.id === selectedProductId.value)
);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      if (props.initialData) {
        formDate.value = props.initialData.date;
        formBuyer.value = props.initialData.buyer;
        formItems.value = JSON.parse(JSON.stringify(props.initialData.items || []));
      } else {
        formDate.value = new Date().toISOString().split('T')[0];
        formBuyer.value = buyerStore.buyers[0]?.name || 'Pembeli Banjarsari';
        formItems.value = [];
      }
      selectedProductId.value = '';
      newItemQty.value = 1;
      newItemPackaging.value = '';
    }
  },
  { immediate: true }
);

function handleAddItem() {
  if (!selectedProduct.value || newItemQty.value <= 0) return;

  const newItem: PreOrderItem = {
    id: `poi-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    productName: selectedProduct.value.name,
    category: selectedProduct.value.category as SupplierCategory,
    qty: newItemQty.value,
    unit: selectedProduct.value.unit,
    packagingNote: newItemPackaging.value.trim() || `${newItemQty.value} ${selectedProduct.value.unit}`
  };

  formItems.value.push(newItem);

  // Reset item row
  selectedProductId.value = '';
  newItemQty.value = 1;
  newItemPackaging.value = '';
}

function handleRemoveItem(idx: number) {
  formItems.value.splice(idx, 1);
}

function handleSubmit() {
  if (!formBuyer.value || !formDate.value || formItems.value.length === 0) {
    alert('Mohon pilih pembeli, tanggal, dan minimal tambahkan 1 item barang pesanan.');
    return;
  }

  const payload: PreOrderSchedule | Omit<PreOrderSchedule, 'id'> = {
    ...(props.initialData?.id ? { id: props.initialData.id } : {}),
    date: formDate.value,
    dayName: detectedDayName.value,
    buyer: formBuyer.value,
    items: formItems.value,
    isLoadedToPos: props.initialData?.isLoadedToPos || false
  };

  emit('save', payload);
  emit('close');
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none text-xs"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-sm text-gray-800">
        <div class="flex items-center gap-2">
          <Calendar :size="16" class="text-blue-600" />
          <span>{{ isEditMode ? 'Edit Jadwal Pre-Order (PO)' : 'Buat Pre-Order (PO) Baru' }}</span>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-black rounded cursor-pointer"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-4 overflow-y-auto space-y-3.5 flex-1">
        <!-- Date & Buyer Selection -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Tanggal Pengiriman *</label>
            <div class="flex items-center gap-1.5">
              <input
                v-model="formDate"
                type="date"
                required
                class="flex-1 h-8 px-2.5 border border-[#dedbd6] rounded text-xs bg-gray-50 focus:bg-white focus:outline-none focus:border-blue-500 font-mono shadow-2xs"
              />
              <span class="h-8 px-2.5 bg-blue-100 text-blue-800 font-bold rounded text-xs shrink-0 flex items-center justify-center border border-blue-200">
                {{ detectedDayName }}
              </span>
            </div>
          </div>

          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Nama Pembeli / Buyer *</label>
            <SearchableSelect
              v-model="formBuyer"
              :options="buyerOptions"
              placeholder="Pilih Pembeli / Buyer..."
              search-placeholder="Ketik nama pembeli..."
            />
          </div>
        </div>

        <!-- Add Items Row -->
        <div class="p-3 bg-[#f9f8f6] rounded border border-gray-200 space-y-2">
          <span class="font-bold text-xs text-gray-700 block">+ Masukkan Barang Pesanan:</span>
          
          <div class="grid grid-cols-12 gap-2 items-end">
            <!-- Product Selector -->
            <div class="col-span-6">
              <label class="text-[10px] text-gray-500 block mb-0.5">Pilih SKU Barang</label>
              <SearchableSelect
                v-model="selectedProductId"
                :options="productOptions"
                placeholder="-- Pilih Barang dari Katalog --"
                search-placeholder="Ketik nama barang / satuan / kategori..."
                @change="handleSelectProduct"
              />
            </div>

            <!-- Qty -->
            <div class="col-span-2">
              <label class="text-[10px] text-gray-500 block mb-0.5">Qty</label>
              <input
                v-model.number="newItemQty"
                type="number"
                min="1"
                class="w-full h-8 px-2 border border-[#dedbd6] rounded text-xs bg-white text-center font-mono font-bold focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            <!-- Satuan & Kemasan -->
            <div class="col-span-3">
              <label class="text-[10px] text-gray-500 block mb-0.5 truncate">
                Kemasan ({{ selectedProduct ? selectedProduct.unit : 'Unit' }})
              </label>
              <input
                v-model="newItemPackaging"
                type="text"
                :placeholder="selectedProduct ? `${newItemQty} ${selectedProduct.unit}` : 'Contoh: 150 KG'"
                class="w-full h-8 px-2.5 border border-[#dedbd6] rounded text-xs bg-white focus:outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            <!-- Add Button -->
            <div class="col-span-1">
              <button
                type="button"
                class="w-full h-8 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded flex items-center justify-center cursor-pointer transition-colors disabled:opacity-40 shadow-2xs"
                :disabled="!selectedProductId || newItemQty <= 0"
                title="Tambahkan ke Pesanan"
                @click="handleAddItem"
              >
                <Plus :size="16" />
              </button>
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-xs text-gray-700">Daftar Barang Dipesan ({{ formItems.length }} Item):</span>
          </div>

          <div class="border border-gray-200 rounded overflow-hidden max-h-48 overflow-y-auto">
            <table class="w-full text-xs text-left">
              <thead class="bg-[#f0ede8] border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
                <tr>
                  <th class="p-2">NAMA BARANG</th>
                  <th class="p-2 w-28">VENDOR</th>
                  <th class="p-2 w-20 text-center">JUMLAH</th>
                  <th class="p-2 w-24">KEMASAN</th>
                  <th class="p-2 w-12 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-if="formItems.length === 0">
                  <td colspan="5" class="p-4 text-center text-gray-400">
                    Belum ada barang dalam pesanan ini. Pilih barang di atas dan klik tombol (+).
                  </td>
                </tr>
                <tr v-for="(it, idx) in formItems" :key="it.id" class="hover:bg-gray-50">
                  <td class="p-2 font-semibold text-gray-900">{{ it.productName }}</td>
                  <td class="p-2 text-gray-500 font-mono text-[11px]">{{ it.category }}</td>
                  <td class="p-2 text-center font-bold text-blue-700 font-mono">{{ it.qty }} {{ it.unit }}</td>
                  <td class="p-2 text-gray-600">{{ it.packagingNote || '-' }}</td>
                  <td class="p-2 text-center">
                    <button
                      type="button"
                      class="text-gray-400 hover:text-red-600 p-1 cursor-pointer"
                      title="Hapus"
                      @click="handleRemoveItem(idx)"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-4 py-3 bg-[#f6f5f2] border-t border-gray-200 flex items-center justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
          @click="emit('close')"
        >
          Batal
        </button>
        <button
          type="button"
          class="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold cursor-pointer shadow-xs transition-colors disabled:opacity-40"
          :disabled="formItems.length === 0"
          @click="handleSubmit"
        >
          <Save :size="14" />
          <span>{{ isEditMode ? 'Simpan Perubahan' : 'Simpan Jadwal PO' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
