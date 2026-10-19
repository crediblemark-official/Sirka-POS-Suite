<script setup lang="ts">
import { ref, computed } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { formatRupiah } from '../../utils/formatters';
import FormSidebarDrawer from '../common/FormSidebarDrawer.vue';
import {
  Plus,
  Trash2,
  Package,
  Truck,
  FileText
} from 'lucide-vue-next';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void;
  (e: 'close'): void;
  (e: 'saved', res: any): void;
}>();

const inventoryStore = useInventoryStore();
const purchaseStore = usePurchaseStore();

const suppliers = computed(() => inventoryStore.categoryMarkups.map(c => c.category));

const supplierOptions = computed<SelectOption[]>(() => {
  return suppliers.value.map(s => ({
    value: s,
    label: s
  }));
});

const selectedProductToAdd = ref<string>('');
const addQty = ref<number>(10);
const addBuyPrice = ref<number>(0);

const supplierProducts = computed(() => {
  return inventoryStore.products.filter(p => p.category === purchaseStore.selectedSupplier);
});

const productOptions = computed<SelectOption[]>(() => {
  return supplierProducts.value.map(p => ({
    value: p.id,
    label: p.name,
    code: p.code,
    sublabel: `Stok: ${p.stock} ${p.unit} • Beli terakhir: Rp ${formatRupiah(p.lastBuyPrice || 0)}`,
    badge: p.unit
  }));
});

function handleSupplierChange(supp: string) {
  if (purchaseStore.selectedSupplier !== supp) {
    purchaseStore.selectedSupplier = supp as any;
    purchaseStore.receivingItems = [];
    selectedProductToAdd.value = '';
    addBuyPrice.value = 0;
  }
}

function handleSelectProduct(prodId: string) {
  selectedProductToAdd.value = prodId;
  const prod = supplierProducts.value.find(p => p.id === prodId);
  if (prod) {
    addBuyPrice.value = prod.lastBuyPrice || 0;
  }
}

function handleAddItem() {
  if (!selectedProductToAdd.value) return;
  const prod = supplierProducts.value.find(p => p.id === selectedProductToAdd.value);
  if (prod) {
    purchaseStore.addItemToReceiving(prod, Number(addQty.value), Number(addBuyPrice.value));
    selectedProductToAdd.value = '';
    addQty.value = 10;
    addBuyPrice.value = 0;
  }
}

const isSaving = ref(false);
const isEditMode = computed(() => !!purchaseStore.activeReceiptForEdit);

function handleSwitchToNew() {
  purchaseStore.openNewReceiving();
}

function handleSwitchToEdit() {
  if (purchaseStore.activeReceiptForEdit) {
    purchaseStore.loadReceiptForEdit(purchaseStore.activeReceiptForEdit);
  }
}

function handleCancel() {
  purchaseStore.clearReceivingForm();
  emit('update:isOpen', false);
  emit('close');
}

async function handleSaveReceiving() {
  if (purchaseStore.receivingItems.length === 0) return;
  if (isSaving.value) return;
  isSaving.value = true;
  try {
    const res = isEditMode.value
      ? await purchaseStore.updateReceiving()
      : await purchaseStore.submitReceiving();
    if (res) {
      emit('saved', res);
      emit('update:isOpen', false);
      emit('close');
    }
  } catch (error) {
    alert(`Nota gagal disimpan: ${error}`);
  } finally {
    isSaving.value = false;
  }
}

async function handleDeleteReceiving() {
  if (!purchaseStore.activeReceiptForEdit) return;
  if (!confirm(`Hapus nota kulakan ${purchaseStore.activeReceiptForEdit.supplierInvoiceNo}? Stok barang akan dikembalikan ke kondisi sebelum nota ini dicatat.`)) {
    return;
  }
  try {
    const ok = await purchaseStore.deleteReceipt(purchaseStore.activeReceiptForEdit.id);
    if (ok) {
      emit('update:isOpen', false);
      emit('close');
    }
  } catch (e) {
    alert(`Gagal menghapus nota: ${e}`);
  }
}
</script>

<template>
  <FormSidebarDrawer
    :model-value="isOpen"
    :is-editing="isEditMode"
    title="Kulakan"
    :code-badge="purchaseStore.activeReceiptForEdit?.supplierInvoiceNo || purchaseStore.supplierInvoiceNo || ''"
    :can-edit="!!purchaseStore.activeReceiptForEdit"
    :can-save="purchaseStore.receivingItems.length > 0 && !isSaving"
    :save-label="isEditMode ? 'PERBARUI NOTA' : 'SIMPAN STOK'"
    theme-color="amber"
    :show-delete="isEditMode"
    width="w-[410px] lg:w-[440px]"
    @update:model-value="emit('update:isOpen', $event)"
    @switch-to-new="handleSwitchToNew"
    @switch-to-edit="handleSwitchToEdit"
    @save="handleSaveReceiving"
    @delete="handleDeleteReceiving"
    @cancel="handleCancel"
  >
    <template #icon>
      <Truck :size="14" class="text-amber-700 shrink-0" />
    </template>

    <!-- Seksi 1: Informasi Nota Fisik Supplier -->
    <div class="space-y-2 pb-4 border-b border-gray-200">
      <div class="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
        <FileText :size="13" />
        <span>Informasi Nota Fisik Supplier</span>
      </div>

      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Kelompok Vendor *</label>
        <SearchableSelect
          :model-value="purchaseStore.selectedSupplier"
          :options="supplierOptions"
          placeholder="Pilih Supplier..."
          search-placeholder="Cari nama supplier..."
          hotkey=""
          @change="(opt) => opt && handleSupplierChange(String(opt.value))"
        />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">No. Faktur Fisik</label>
          <input
            v-model="purchaseStore.supplierInvoiceNo"
            type="text"
            placeholder="Misal: NOTA-HB-01"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs font-mono outline-none focus:border-amber-500 shadow-2xs"
          />
        </div>
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Tanggal Penerimaan</label>
          <input
            v-model="purchaseStore.receiptDate"
            type="date"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs font-mono outline-none focus:border-amber-500 shadow-2xs"
          />
        </div>
      </div>

      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Catatan Nota</label>
        <input
          v-model="purchaseStore.receiptNotes"
          type="text"
          placeholder="Kondisi barang, tempo, dll..."
          class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-amber-500 shadow-2xs"
        />
      </div>
    </div>

    <!-- Seksi 2: Form Input Cepat Barang -->
    <div class="space-y-2 pb-4 border-b border-gray-200">
      <div class="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
        <Plus :size="13" />
        <span>Input Barang Masuk</span>
      </div>

      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Pilih Barang {{ purchaseStore.selectedSupplier }}</label>
        <SearchableSelect
          v-model="selectedProductToAdd"
          :options="productOptions"
          :placeholder="`-- Pilih barang ${purchaseStore.selectedSupplier || ''} --`"
          search-placeholder="Ketik nama atau kode barang..."
          hotkey=""
          clearable
          @change="(opt) => opt && handleSelectProduct(String(opt.value))"
        />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Qty Masuk</label>
          <input
            v-model.number="addQty"
            type="number"
            min="1"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs font-mono text-center font-bold outline-none focus:border-amber-500 shadow-2xs"
            @keyup.enter="handleAddItem"
          />
        </div>
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Harga Modal Beli</label>
          <div class="relative flex items-center">
            <span class="absolute left-2 text-[11px] text-gray-400 font-mono">Rp</span>
            <input
              v-model.number="addBuyPrice"
              type="number"
              step="500"
              min="0"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded pl-7 pr-2 py-1 text-xs font-mono text-right font-bold outline-none focus:border-amber-500 shadow-2xs"
              @keyup.enter="handleAddItem"
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        class="w-full py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded font-bold text-xs cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
        :disabled="!selectedProductToAdd"
        @click="handleAddItem"
      >
        <Plus :size="13" />
        <span>+ Masukkan ke Nota</span>
      </button>
    </div>

    <!-- Seksi 3: Daftar Barang Dalam Nota -->
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 font-bold text-gray-800 text-xs">
          <Package :size="13" class="text-amber-700" />
          <span>Barang Dalam Nota ({{ purchaseStore.receivingItems.length }})</span>
        </div>
        <span v-if="purchaseStore.receivingItems.length > 0" class="text-[10px] text-gray-400">Qty & modal bisa diedit</span>
      </div>

      <!-- Empty Items State -->
      <div v-if="purchaseStore.receivingItems.length === 0" class="py-6 text-center text-gray-400 text-xs border border-dashed border-gray-200 rounded">
        Belum ada barang di nota. Pilih barang di atas untuk menambahkan.
      </div>

      <!-- List Item Rows -->
      <div v-else class="space-y-1.5 max-h-[300px] overflow-y-auto">
        <div
          v-for="item in purchaseStore.receivingItems"
          :key="item.id"
          class="p-2.5 rounded bg-gray-50 border border-gray-200 hover:bg-amber-50/20 transition-colors space-y-1.5"
        >
          <!-- Row 1: Nama, Satuan & Hapus -->
          <div class="flex items-center justify-between gap-1">
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <span class="font-bold text-gray-900 truncate" :title="item.name">{{ item.name }}</span>
              <span class="px-1 py-0.2 bg-amber-100 text-amber-800 rounded text-[9.5px] font-bold shrink-0 font-mono">
                {{ item.unit }}
              </span>
            </div>
            <button
              type="button"
              class="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer transition-colors shrink-0"
              title="Hapus baris"
              @click="purchaseStore.removeItem(item.id)"
            >
              <Trash2 :size="13" />
            </button>
          </div>

          <!-- Row 2: Inputs Qty, Modal, Subtotal -->
          <div class="flex items-center justify-between text-xs gap-2 pt-0.5">
            <div class="flex items-center gap-1 shrink-0">
              <span class="text-[11px] text-gray-500 font-semibold">Qty:</span>
              <input
                type="number"
                min="1"
                :value="item.qtyReceived"
                class="w-14 bg-white border border-gray-300 rounded px-1 py-0.5 text-center font-mono font-bold outline-none focus:bg-white focus:border-amber-500"
                @input="(e: any) => purchaseStore.updateItemQty(item.id, Number(e.target.value))"
              />
            </div>

            <div class="flex items-center gap-1 shrink-0">
              <span class="text-[11px] text-gray-500 font-semibold">Modal:</span>
              <input
                type="number"
                step="500"
                :value="item.buyPrice"
                class="w-20 bg-white border border-gray-300 rounded px-1.5 py-0.5 text-right font-mono font-bold outline-none focus:bg-white focus:border-amber-500"
                @input="(e: any) => purchaseStore.updateItemBuyPrice(item.id, Number(e.target.value))"
              />
            </div>

            <div class="text-right shrink-0">
              <span class="font-mono font-bold text-emerald-700">Rp {{ formatRupiah(item.subtotalBuy) }}</span>
            </div>
          </div>

          <!-- Row 3: Markup % & Rekomendasi Jual Baru -->
          <div class="flex items-center justify-between text-[10.5px] bg-white px-2 py-0.5 rounded border border-gray-100 text-gray-600">
            <span>Markup: <strong class="text-blue-700 font-mono">+{{ item.markupPercent }}%</strong></span>
            <span>Jual Baru: <strong class="text-blue-700 font-mono">Rp {{ formatRupiah(item.newSellPrice) }}</strong></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Template Footer Prefix (Total Item & Total Modal) -->
    <template #footer-prefix>
      <div class="flex items-center justify-between text-xs">
        <span class="text-gray-500 font-medium">Total Item Masuk:</span>
        <span class="font-bold text-gray-800 font-mono">{{ purchaseStore.receivingItems.length }} barang</span>
      </div>

      <div class="flex items-center justify-between border-t border-gray-100 pt-1">
        <span class="text-xs text-gray-700 font-bold">TOTAL MODAL:</span>
        <span class="text-sm font-bold text-emerald-700 font-mono">Rp {{ formatRupiah(purchaseStore.totalBuy) }}</span>
      </div>
    </template>
  </FormSidebarDrawer>
</template>
