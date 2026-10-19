<script setup lang="ts">
import { ref, computed } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { formatRupiah } from '../../utils/formatters';
import {
  Plus,
  Trash2,
  Package,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  X,
  FileText
} from 'lucide-vue-next';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
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

function handleResetForm() {
  if (purchaseStore.receivingItems.length > 0) {
    if (!confirm('Item dalam nota yang belum disimpan akan direset. Yakin ingin mengosongkan form?')) {
      return;
    }
  }
  purchaseStore.clearReceivingForm();
  selectedProductToAdd.value = '';
  addQty.value = 10;
  addBuyPrice.value = 0;
}

const isEditMode = computed(() => !!purchaseStore.activeReceiptForEdit);

async function handleSaveReceiving() {
  if (purchaseStore.receivingItems.length === 0) return;
  const res = isEditMode.value
    ? await purchaseStore.updateReceiving()
    : await purchaseStore.submitReceiving();
  if (res) {
    emit('saved', res);
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="w-[410px] lg:w-[440px] border-l border-gray-300 bg-white flex flex-col shrink-0 shadow-lg select-none text-xs"
  >
    <!-- Sidebar Header (Sesuai PosCart Header) -->
    <div class="h-10 px-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <PackagePlus v-if="!isEditMode" :size="15" class="text-amber-700 shrink-0" />
        <FileText v-else :size="15" class="text-blue-700 shrink-0" />
        <span class="font-bold text-xs text-gray-800 shrink-0">
          {{ isEditMode ? 'Edit Nota Kulakan' : 'Form Input Kulakan' }}
        </span>
        <span
          v-if="isEditMode && purchaseStore.activeReceiptForEdit"
          class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold truncate max-w-[130px]"
          :title="purchaseStore.activeReceiptForEdit.supplierInvoiceNo"
        >
          {{ purchaseStore.activeReceiptForEdit.supplierInvoiceNo }}
        </span>
        <span class="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold font-mono text-[10px] shrink-0">
          {{ purchaseStore.receivingItems.length }} item
        </span>
      </div>
      <button
        type="button"
        class="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded cursor-pointer transition-colors"
        title="Tutup Form Input (Sidebar)"
        @click="emit('close')"
      >
        <X :size="14" />
      </button>
    </div>

    <!-- Sidebar Body (Clean Sections Separated by Lines) -->
    <div class="flex-1 overflow-y-auto px-4 py-3.5 space-y-4 bg-white">
      <!-- Seksi 1: Informasi Nota Fisik Supplier -->
      <div class="space-y-2 pb-4 border-b border-gray-200">
        <div class="flex items-center gap-1.5 font-bold text-blue-700 text-xs">
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
    </div>

    <!-- Sidebar Footer (Sticky at Bottom) -->
    <div class="p-2.5 bg-white border-t border-gray-200 shrink-0 space-y-1.5">
      <div class="flex items-center justify-between text-xs">
        <span class="text-gray-500 font-medium">Total Item Masuk:</span>
        <span class="font-bold text-gray-800 font-mono">{{ purchaseStore.receivingItems.length }} barang</span>
      </div>

      <div class="flex items-center justify-between border-t border-gray-100 pt-1">
        <span class="text-xs text-gray-700 font-bold">TOTAL MODAL:</span>
        <span class="text-sm font-bold text-emerald-700 font-mono">Rp {{ formatRupiah(purchaseStore.totalBuy) }}</span>
      </div>

      <div class="grid grid-cols-3 gap-2 pt-1">
        <button
          type="button"
          class="col-span-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded font-semibold text-xs cursor-pointer flex items-center justify-center gap-1 transition-colors"
          @click="handleResetForm"
        >
          <RotateCcw :size="12" />
          <span>{{ isEditMode ? 'Batal' : 'Reset' }}</span>
        </button>

        <button
          type="button"
          class="col-span-2 py-1.5 text-white rounded font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-xs transition-colors disabled:opacity-40"
          :class="isEditMode ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800' : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'"
          :disabled="purchaseStore.receivingItems.length === 0"
          @click="handleSaveReceiving"
        >
          <PackageCheck :size="15" />
          <span>{{ isEditMode ? 'PERBARUI NOTA' : 'SIMPAN STOK' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
