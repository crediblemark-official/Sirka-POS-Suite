<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Product, SupplierCategory } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';
import { Settings, Package } from 'lucide-vue-next';

// Modular Sub-Tabs
import MasterSkuTab from './MasterSkuTab.vue';

// Modular DRY Form Drawer
import FormSidebarDrawer from '../common/FormSidebarDrawer.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import { formatRupiah } from '../../utils/formatters';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const inventoryStore = useInventoryStore();
const categories = computed(() => inventoryStore.categoryMarkups.map(c => c.category));
const categoryOptions = computed<SelectOption[]>(() =>
  inventoryStore.categoryMarkups.map(c => ({
    value: c.category,
    label: c.category,
    badge: `${c.defaultMarkupPercent}% markup`
  }))
);

// Product Sidebar Drawer State (Gaya Diskon & Kulakan)
const isEditProduct = computed(() => !!inventoryStore.activeProductForSidebar?.id);

const productForm = ref<{
  id: string;
  code: string;
  name: string;
  category: SupplierCategory;
  unit: string;
  defaultMarkupPercent: number;
  lastBuyPrice: number;
  lastSellPrice: number;
  stock: number;
  barcode: string;
  notes: string;
}>({
  id: '',
  code: '',
  name: '',
  category: 'Umum' as SupplierCategory,
  unit: 'PCS',
  defaultMarkupPercent: 20,
  lastBuyPrice: 0,
  lastSellPrice: 0,
  stock: 100,
  barcode: '',
  notes: ''
});

function handleOpenAddProduct() {
  inventoryStore.activeProductForSidebar = null;
  const defaultCategory = categories.value[0] || 'Umum';
  const defaultMarkup = inventoryStore.getCategoryMarkup(defaultCategory);
  productForm.value = {
    id: '',
    code: '',
    name: '',
    category: defaultCategory,
    unit: 'PCS',
    defaultMarkupPercent: defaultMarkup,
    lastBuyPrice: 0,
    lastSellPrice: 0,
    stock: 100,
    barcode: '',
    notes: ''
  };
  inventoryStore.showProductSidebar = true;
}

function handleOpenEditProduct(prod: Product) {
  inventoryStore.activeProductForSidebar = { ...prod };
  productForm.value = {
    id: prod.id,
    code: prod.code,
    name: prod.name,
    category: prod.category,
    unit: prod.unit,
    defaultMarkupPercent: prod.defaultMarkupPercent ?? inventoryStore.getCategoryMarkup(prod.category),
    lastBuyPrice: prod.lastBuyPrice,
    lastSellPrice: prod.lastSellPrice,
    stock: prod.stock,
    barcode: prod.barcode || '',
    notes: prod.notes || ''
  };
  inventoryStore.showProductSidebar = true;
}

watch(
  () => inventoryStore.showProductSidebar,
  (isOpen) => {
    if (isOpen && !inventoryStore.activeProductForSidebar) {
      handleOpenAddProduct();
    }
  }
);

function onCategoryChange() {
  if (!isEditProduct.value) {
    productForm.value.defaultMarkupPercent = inventoryStore.getCategoryMarkup(productForm.value.category);
    recalculateSellPrice();
  }
}

function recalculateSellPrice() {
  const markup = productForm.value.defaultMarkupPercent ?? 20;
  productForm.value.lastSellPrice = Math.round((productForm.value.lastBuyPrice || 0) * (1 + markup / 100));
}

function handleSaveProductSidebar() {
  if (!productForm.value.name.trim() || !productForm.value.unit.trim()) return;

  const payload = {
    ...productForm.value,
    name: productForm.value.name.trim().toUpperCase(),
    code: (productForm.value.code.trim() || `SKU-${Date.now().toString().slice(-4)}`).toUpperCase(),
    unit: productForm.value.unit.trim().toUpperCase(),
    barcode: productForm.value.barcode.trim() || undefined,
    lastBuyPrice: Number(productForm.value.lastBuyPrice) || 0,
    lastSellPrice: Number(productForm.value.lastSellPrice) || 0,
    stock: Number(productForm.value.stock) || 0
  };

  if (isEditProduct.value && productForm.value.id) {
    inventoryStore.updateProduct(payload as Product);
  } else {
    inventoryStore.addProduct(payload);
  }
  inventoryStore.showProductSidebar = false;
}

function handleDeleteProduct(id: string) {
  inventoryStore.deleteProduct(id);
  inventoryStore.activeProductForSidebar = null;
  inventoryStore.showProductSidebar = false;
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Main Workspace: Split Layar (Kiri: Tabel SKU, Kanan: Sidebar Drawer) -->
    <main class="flex-1 flex overflow-hidden">
      <div class="flex-1 flex flex-col overflow-hidden">
        <MasterSkuTab
          :search-query="props.searchQuery"
          @add-product="handleOpenAddProduct"
          @edit-product="handleOpenEditProduct"
        />
      </div>

      <!-- Sisi Kanan: Form Input & Edit Barang (Modular FormSidebarDrawer) -->
      <FormSidebarDrawer
        v-model="inventoryStore.showProductSidebar"
        :is-editing="isEditProduct"
        title="Barang"
        :code-badge="productForm.code"
        :can-edit="!!inventoryStore.activeProductForSidebar"
        :can-save="!!productForm.name.trim() && !!productForm.unit.trim()"
        :save-label="isEditProduct ? 'SIMPAN PERUBAHAN' : 'SIMPAN BARANG'"
        theme-color="purple"
        @switch-to-new="handleOpenAddProduct"
        @switch-to-edit="inventoryStore.activeProductForSidebar && handleOpenEditProduct(inventoryStore.activeProductForSidebar)"
        @save="handleSaveProductSidebar"
        @delete="inventoryStore.activeProductForSidebar && handleDeleteProduct(inventoryStore.activeProductForSidebar.id)"
        @cancel="inventoryStore.showProductSidebar = false"
      >
        <template #icon>
          <Package :size="14" class="text-purple-700 shrink-0" />
        </template>

        <!-- Seksi 1: Identitas SKU & Kategori -->
        <div class="space-y-2.5 pb-4 border-b border-gray-200">
          <div class="flex items-center gap-1.5 font-bold text-purple-700 text-xs">
            <Package :size="13" />
            <span>Identitas Produk (SKU)</span>
          </div>

          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Kode SKU / Barcode</label>
            <input
              v-model="productForm.code"
              type="text"
              placeholder="Contoh: SKU-BRG-001 (Otomatis jika kosong)"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-purple-600 font-mono shadow-2xs"
            />
          </div>

          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Barcode Kasir (opsional)</label>
            <input
              v-model="productForm.barcode"
              type="text"
              placeholder="Klik lalu scan chip barcode fisik, atau ketik angka (EAN/UPC)"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-purple-600 font-mono shadow-2xs"
            />
            <span class="text-[10px] text-gray-400 block mt-0.5">
              Dipakai untuk scan langsung masuk keranjang di layar Kasir.
            </span>
          </div>

          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Nama Barang / Produk *</label>
            <input
              v-model="productForm.name"
              type="text"
              placeholder="Contoh: BERAS RAJA LELE 5KG"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-purple-600 font-semibold shadow-2xs"
            />
          </div>

          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Kategori / Vendor *</label>
            <SearchableSelect
              v-model="productForm.category"
              :options="categoryOptions"
              placeholder="Pilih Kategori / Vendor..."
              search-placeholder="Cari kategori / vendor..."
              hotkey=""
              @change="onCategoryChange"
            />
          </div>

          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Satuan *</label>
            <input
              v-model="productForm.unit"
              type="text"
              placeholder="PCS / ZAK / DUS"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-purple-600 font-mono uppercase shadow-2xs"
            />
          </div>
        </div>

        <!-- Seksi 2: Harga Beli & Harga Jual Kasir -->
        <div class="space-y-2.5 pb-4 border-b border-gray-200">
          <div class="flex items-center gap-1.5 font-bold text-blue-700 text-xs">
            <Percent :size="13" />
            <span>Harga Modal & Penjualan</span>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Modal Beli (HPP)</label>
              <div class="relative">
                <span class="absolute left-2 top-1 text-gray-400 font-mono text-[10px]">Rp</span>
                <input
                  v-model.number="productForm.lastBuyPrice"
                  type="number"
                  min="0"
                  step="500"
                  class="w-full bg-[#fcfbfa] border border-gray-300 rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-blue-600 font-mono font-bold text-gray-800 shadow-2xs"
                  @input="recalculateSellPrice"
                />
              </div>
            </div>

            <div>
              <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Margin Untung (%)</label>
              <div class="relative">
                <input
                  v-model.number="productForm.defaultMarkupPercent"
                  type="number"
                  min="0"
                  max="500"
                  class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-600 font-mono font-bold text-emerald-700 shadow-2xs"
                  @input="recalculateSellPrice"
                />
                <span class="absolute right-2 top-1 text-gray-400 font-mono text-[10px]">%</span>
              </div>
            </div>
          </div>

          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Harga Jual Kasir *</label>
            <div class="relative">
              <span class="absolute left-2 top-1 text-gray-400 font-mono text-[10px]">Rp</span>
              <input
                v-model.number="productForm.lastSellPrice"
                type="number"
                min="0"
                step="500"
                class="w-full bg-[#fcfbfa] border border-blue-300 rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-blue-600 font-mono font-bold text-blue-700 shadow-2xs"
              />
            </div>
            <span class="text-[10px] text-gray-400 block mt-0.5">
              Estimasi laba bersih: <strong class="text-emerald-700 font-mono">Rp {{ formatRupiah(Math.max(0, productForm.lastSellPrice - productForm.lastBuyPrice)) }}</strong> / {{ productForm.unit }}
            </span>
          </div>
        </div>

        <!-- Seksi 3: Stok Gudang & Catatan -->
        <div class="space-y-2.5">
          <div class="flex items-center gap-1.5 font-bold text-gray-700 text-xs">
            <Settings :size="13" />
            <span>Stok Fisik & Keterangan</span>
          </div>

          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Jumlah Stok Fisik Saat Ini</label>
            <input
              v-model.number="productForm.stock"
              type="number"
              min="0"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-purple-600 font-mono font-bold shadow-2xs"
            />
          </div>

          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Catatan Tambahan (Opsional)</label>
            <textarea
              v-model="productForm.notes"
              rows="2"
              placeholder="Keterangan rak / distributor..."
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded p-2 text-xs outline-none focus:border-purple-600 shadow-2xs"
            />
          </div>
        </div>
      </FormSidebarDrawer>
    </main>
  </div>
</template>
