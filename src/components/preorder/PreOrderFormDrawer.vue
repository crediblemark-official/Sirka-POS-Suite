<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { BuyerName, SupplierCategory, PreOrderSchedule, PreOrderItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  Calendar,
  Plus,
  Trash2,
  Layers
} from 'lucide-vue-next';
import FormSidebarDrawer from '../common/FormSidebarDrawer.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:isOpen', val: boolean): void;
}>();

const preOrderStore = usePreOrderStore();
const inventoryStore = useInventoryStore();
const buyerStore = useBuyerStore();

const isEditPo = computed(() => !!preOrderStore.activeScheduleForSidebar?.id);

const formDate = ref(new Date().toISOString().split('T')[0]);
const formBuyer = ref('');
const formItems = ref<PreOrderItem[]>([]);

const selectedProductId = ref('');
const newItemQty = ref<number>(1);
const newItemPackaging = ref('');

const selectedProduct = computed(() =>
  inventoryStore.products.find(p => p.id === selectedProductId.value)
);

const productOptions = computed<SelectOption[]>(() =>
  inventoryStore.products.map(p => ({
    value: p.id,
    label: p.name,
    sublabel: `Stok: ${p.stock} ${p.unit} • Rp ${formatRupiah(p.lastSellPrice || 0)}`
  }))
);

const buyerOptions = computed<SelectOption[]>(() =>
  buyerStore.buyers.map(b => ({
    value: b.name,
    label: b.name
  }))
);

const dayNamesIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const detectedDayName = computed(() => {
  if (!formDate.value) return 'Senin';
  const d = new Date(formDate.value);
  return dayNamesIndo[d.getDay()] || 'Senin';
});

watch(
  () => preOrderStore.activeScheduleForSidebar,
  (sched) => {
    if (sched) {
      formDate.value = sched.date;
      formBuyer.value = sched.buyer;
      formItems.value = JSON.parse(JSON.stringify(sched.items || []));
    } else {
      formDate.value = new Date().toISOString().split('T')[0];
      formBuyer.value = buyerStore.buyers[0]?.name || 'Semua Pembeli';
      formItems.value = [];
    }
    selectedProductId.value = '';
    newItemQty.value = 1;
    newItemPackaging.value = '';
  },
  { immediate: true }
);

function handleOpenAddPo() {
  preOrderStore.activeScheduleForSidebar = null;
  formDate.value = new Date().toISOString().split('T')[0];
  formBuyer.value = buyerStore.buyers[0]?.name || 'Semua Pembeli';
  formItems.value = [];
  selectedProductId.value = '';
  newItemQty.value = 1;
  newItemPackaging.value = '';
}

function handleOpenEditPo(sched: PreOrderSchedule) {
  preOrderStore.activeScheduleForSidebar = sched;
  formDate.value = sched.date;
  formBuyer.value = sched.buyer;
  formItems.value = JSON.parse(JSON.stringify(sched.items || []));
  selectedProductId.value = '';
  newItemQty.value = 1;
  newItemPackaging.value = '';
}

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
  selectedProductId.value = '';
  newItemQty.value = 1;
  newItemPackaging.value = '';
}

function handleRemoveItem(index: number) {
  formItems.value.splice(index, 1);
}

async function handleSavePoSidebar() {
  if (!formDate.value || !formBuyer.value || formItems.value.length === 0) return;

  const payload: PreOrderSchedule = {
    id: isEditPo.value && preOrderStore.activeScheduleForSidebar ? preOrderStore.activeScheduleForSidebar.id : `po-${Date.now()}`,
    date: formDate.value,
    dayName: detectedDayName.value,
    buyer: formBuyer.value as BuyerName,
    items: formItems.value
  };

  if (isEditPo.value) {
    await preOrderStore.updateSchedule(payload);
  } else {
    await preOrderStore.addSchedule(payload);
  }
  emit('update:isOpen', false);
}

async function handleDeletePoSidebar() {
  if (preOrderStore.activeScheduleForSidebar) {
    await preOrderStore.deleteSchedule(preOrderStore.activeScheduleForSidebar.id);
    preOrderStore.activeScheduleForSidebar = null;
    emit('update:isOpen', false);
  }
}
</script>

<template>
  <FormSidebarDrawer
    :model-value="isOpen"
    :is-editing="isEditPo"
    title="Pesanan"
    :code-badge="formDate ? `${detectedDayName}, ${formDate}` : ''"
    :can-edit="!!preOrderStore.activeScheduleForSidebar"
    :can-save="!!formDate && !!formBuyer && formItems.length > 0"
    :save-label="isEditPo ? 'SIMPAN PERUBAHAN' : 'SIMPAN PESANAN'"
    theme-color="emerald"
    @update:model-value="emit('update:isOpen', $event)"
    @switch-to-new="handleOpenAddPo"
    @switch-to-edit="preOrderStore.activeScheduleForSidebar && handleOpenEditPo(preOrderStore.activeScheduleForSidebar)"
    @save="handleSavePoSidebar"
    @delete="handleDeletePoSidebar"
    @cancel="emit('update:isOpen', false)"
  >
    <template #icon>
      <Calendar :size="14" class="text-emerald-700 shrink-0" />
    </template>

    <!-- Seksi 1: Tanggal & Pelanggan Pemesan -->
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <div class="flex items-center gap-1.5 font-bold text-emerald-700 text-xs">
        <Calendar :size="13" />
        <span>Jadwal & Pelanggan Pemesan</span>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Tanggal Kirim *</label>
          <input
            v-model="formDate"
            type="date"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-emerald-600 font-mono shadow-2xs cursor-pointer"
          />
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Hari Terdeteksi</label>
          <div class="w-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded px-2.5 py-1 text-xs text-center">
            {{ detectedDayName }}
          </div>
        </div>
      </div>

      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Nama Pelanggan / Toko *</label>
        <SearchableSelect
          v-model="formBuyer"
          :options="buyerOptions"
          placeholder="Pilih Pelanggan..."
          search-placeholder="Cari pelanggan..."
          hotkey=""
        />
      </div>
    </div>

    <!-- Seksi 2: Tambah Barang ke Pesanan -->
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <div class="flex items-center gap-1.5 font-bold text-blue-700 text-xs">
        <Plus :size="13" />
        <span>Pilih Barang Titipan</span>
      </div>

      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Barang / Produk *</label>
        <SearchableSelect
          v-model="selectedProductId"
          :options="productOptions"
          placeholder="Cari barang dagangan..."
          search-placeholder="Ketik nama atau kode..."
          hotkey=""
        />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Jumlah (Qty) *</label>
          <input
            v-model.number="newItemQty"
            type="number"
            min="1"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-blue-600 font-mono font-bold shadow-2xs"
          />
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Keterangan Kemasan</label>
          <input
            v-model="newItemPackaging"
            type="text"
            placeholder="Contoh: 1 Zak / Dus"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-blue-600 shadow-2xs"
          />
        </div>
      </div>

      <button
        type="button"
        class="w-full py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs transition-colors disabled:opacity-40"
        :disabled="!selectedProduct || newItemQty <= 0"
        @click="handleAddItem"
      >
        <Plus :size="13" />
        <span>+ Masukkan ke Daftar Pesanan</span>
      </button>
    </div>

    <!-- Seksi 3: Daftar Barang yang Dipesan -->
    <div class="space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 font-bold text-gray-800 text-xs">
          <Layers :size="13" class="text-emerald-700" />
          <span>Daftar Pesanan ({{ formItems.length }} Item)</span>
        </div>
        <span class="text-[10px] text-gray-400 font-mono">
          Total: {{ formItems.reduce((acc, it) => acc + (it.qty || 0), 0) }} Pcs
        </span>
      </div>

      <div v-if="formItems.length === 0" class="py-6 text-center text-gray-400 text-xs border border-dashed border-gray-200 rounded">
        Belum ada barang dimasukkan. Pilih barang di atas.
      </div>

      <div v-else class="space-y-1.5 max-h-56 overflow-y-auto">
        <div
          v-for="(it, idx) in formItems"
          :key="it.id"
          class="flex items-center justify-between p-2 rounded bg-gray-50 border border-gray-200 text-xs"
        >
          <div class="min-w-0 pr-2">
            <span class="font-bold text-gray-900 block truncate">{{ it.productName }}</span>
            <span v-if="it.packagingNote" class="text-[10px] text-gray-500 font-mono">{{ it.packagingNote }}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="font-bold font-mono text-emerald-800">{{ it.qty }} {{ it.unit }}</span>
            <button
              type="button"
              class="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
              title="Hapus item"
              @click="handleRemoveItem(idx)"
            >
              <Trash2 :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </FormSidebarDrawer>
</template>
