<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Product, SupplierCategory, PurchaseReceipt, ProductUnitConversion } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useSupplierStore } from '../../stores/supplierStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { useStockMovementStore } from '../../stores/stockMovementStore';
import { useBatchStore } from '../../stores/batchStore';
import { formatRupiah } from '../../utils/formatters';
import FormSidebarDrawer from '../common/FormSidebarDrawer.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import {
  Package,
  Search,
  Percent,
  Truck,
  Sparkles,
  Barcode,
  Tag,
  Plus,
  Trash2,
  Scale
} from 'lucide-vue-next';

const props = defineProps<{
  modelValue: boolean;
  activeProduct?: Product | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved', prod: Product): void;
  (e: 'deleted', id: string): void;
}>();

const inventoryStore = useInventoryStore();
const supplierStore = useSupplierStore();
const purchaseStore = usePurchaseStore();
const movementStore = useStockMovementStore();
const batchStore = useBatchStore();
const { confirm: showConfirm } = useConfirmDialog();

import { useUnitStore } from '../../stores/unitStore';

const unitStore = useUnitStore();

// Daftar Master Satuan Terstandar Dinamis dari UnitStore
const allStandardUnits = computed(() => unitStore.allUnitNames);

// Options untuk Dropdown
const categories = computed(() => inventoryStore.categoryMarkups.map(c => c.category));
const categoryOptions = computed<SelectOption[]>(() =>
  inventoryStore.categoryMarkups.map(c => ({
    value: c.category,
    label: c.category
  }))
);

const supplierOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Tanpa Supplier Spesifik' },
  ...supplierStore.suppliers.map(s => ({
    value: s.name,
    label: s.name,
    badge: s.phone || undefined
  }))
]);

// Product Options untuk SearchableSelect di bagian atas
const productOptions = computed<SelectOption[]>(() =>
  inventoryStore.products.map(p => ({
    value: p.id,
    label: p.name,
    code: p.code,
    sublabel: `Kategori: ${p.category}${p.supplier ? ` • Supplier: ${p.supplier}` : ''} • Stok: ${p.stock} ${p.unit} • Modal: Rp ${formatRupiah(p.lastBuyPrice || 0)}`,
    badge: `${p.stock} ${p.unit}`
  }))
);

// State Form Terpadu
const selectedProductId = ref<string>('');
const isExistingProduct = computed(() => !!selectedProductId.value);

const productForm = ref<{
  id: string;
  code: string;
  name: string;
  category: SupplierCategory;
  supplier: string;
  unit: string;
  defaultMarkupPercent: number;
  lastBuyPrice: number;
  lastSellPrice: number;
  currentStock: number;
  barcode: string;
  notes: string;
  hasMultiUnits: boolean;
  units: ProductUnitConversion[];
}>({
  id: '',
  code: '',
  name: '',
  category: 'Umum' as SupplierCategory,
  supplier: '',
  unit: 'PCS',
  defaultMarkupPercent: 20,
  lastBuyPrice: 0,
  lastSellPrice: 0,
  currentStock: 0,
  barcode: '',
  notes: '',
  hasMultiUnits: false,
  units: []
});

// State Kulakan (Barang Masuk)
const qtyReceived = ref<number>(10);
const invoiceNumber = ref<string>('');
const selectedInboundUnit = ref<string>(''); // Kosong berarti Base Unit
const inboundPackageBuyPrice = ref<number>(0); // Modal kulakan per kemasan besar (jika beli Dus/Peti)

// Opsi Satuan yang bisa dipilih saat kulakan (Base Unit + Satuan Turunan)
const availableInboundUnits = computed(() => {
  const base = productForm.value.unit || 'PCS';
  const list = [{ unitName: base, factor: 1, label: `${base} (Base Unit Terkecil)` }];
  if (productForm.value.hasMultiUnits && productForm.value.units) {
    for (const u of productForm.value.units) {
      if (u.unitName && u.unitName.toUpperCase() !== base.toUpperCase()) {
        list.push({
          unitName: u.unitName,
          factor: u.conversionFactor,
          label: `${u.unitName} (Isi ${u.conversionFactor} ${base})`
        });
      }
    }
  }
  return list;
});

// Faktor konversi satuan masuk kulakan aktif
const activeInboundFactor = computed(() => {
  if (!productForm.value.hasMultiUnits || !selectedInboundUnit.value || selectedInboundUnit.value.toUpperCase() === productForm.value.unit.toUpperCase()) {
    return 1;
  }
  const found = productForm.value.units.find(u => u.unitName.toUpperCase() === selectedInboundUnit.value.toUpperCase());
  return found ? (Number(found.conversionFactor) || 1) : 1;
});

// Efektif Qty penambahan ke Base Unit stok
const effectiveReceivedBaseQty = computed(() => {
  const qty = Math.max(0, Number(qtyReceived.value) || 0);
  return Number((qty * activeInboundFactor.value).toFixed(4));
});

// Efektif HPP modal per Base Unit
const effectiveBaseBuyPrice = computed(() => {
  if (activeInboundFactor.value !== 1 && inboundPackageBuyPrice.value > 0) {
    return Math.round(inboundPackageBuyPrice.value / activeInboundFactor.value);
  }
  return Number(productForm.value.lastBuyPrice) || 0;
});

// Hitung total stok proyeksi setelah barang masuk (dalam base unit)
const projectedStock = computed(() => {
  const current = Number(productForm.value.currentStock) || 0;
  return Number((current + effectiveReceivedBaseQty.value).toFixed(4));
});

// Hitung total biaya kulakan
const totalInboundCost = computed(() => {
  const received = Math.max(0, Number(qtyReceived.value) || 0);
  if (activeInboundFactor.value !== 1 && inboundPackageBuyPrice.value > 0) {
    return received * inboundPackageBuyPrice.value;
  }
  return received * (Number(productForm.value.lastBuyPrice) || 0);
});

// Inisialisasi Form untuk Produk Baru
function resetToNew(initialName = '') {
  selectedProductId.value = '';
  const defCategory = (categories.value[0] || 'Umum') as SupplierCategory;
  const defMarkup = inventoryStore.getCategoryMarkup(defCategory);

  productForm.value = {
    id: '',
    code: `SKU-${Date.now().toString().slice(-4)}`,
    name: initialName.trim().toUpperCase(),
    category: defCategory,
    supplier: supplierStore.suppliers[0]?.name || '',
    unit: 'PCS',
    defaultMarkupPercent: defMarkup,
    lastBuyPrice: 0,
    lastSellPrice: 0,
    currentStock: 0,
    barcode: '',
    notes: '',
    hasMultiUnits: false,
    units: []
  };
  qtyReceived.value = 10;
  invoiceNumber.value = '';
  selectedInboundUnit.value = 'PCS';
  inboundPackageBuyPrice.value = 0;
}

// Muat data dari Produk yang dipilih
function loadProductData(prod: Product) {
  selectedProductId.value = prod.id;
  const existingUnits: ProductUnitConversion[] = prod.units && Array.isArray(prod.units)
    ? JSON.parse(JSON.stringify(prod.units))
    : [];

  productForm.value = {
    id: prod.id,
    code: prod.code,
    name: prod.name,
    category: prod.category,
    supplier: prod.supplier || '',
    unit: prod.unit,
    defaultMarkupPercent: prod.defaultMarkupPercent ?? inventoryStore.getCategoryMarkup(prod.category),
    lastBuyPrice: prod.lastBuyPrice || 0,
    lastSellPrice: prod.lastSellPrice || 0,
    currentStock: prod.stock || 0,
    barcode: prod.barcode || '',
    notes: prod.notes || '',
    hasMultiUnits: existingUnits.length > 0,
    units: existingUnits
  };
  qtyReceived.value = 0;
  selectedInboundUnit.value = prod.unit;
  inboundPackageBuyPrice.value = 0;
}

// Helper Multi-Satuan: Pasang Template Cepat Populer
function applyUnitTemplate(type: 'mie' | 'telur' | 'rokok' | 'beras' | 'air' | 'renceng') {
  productForm.value.hasMultiUnits = true;
  if (type === 'mie') {
    productForm.value.unit = 'BUNGKUS';
    if (!productForm.value.lastSellPrice) productForm.value.lastSellPrice = 3500;
    if (!productForm.value.lastBuyPrice) productForm.value.lastBuyPrice = 2875;
    const dusPrice = Math.round(productForm.value.lastSellPrice * 40 * 0.95);
    productForm.value.units = [
      { id: `u-${Date.now()}-1`, unitName: 'DUS', conversionFactor: 40, sellPrice: dusPrice }
    ];
  } else if (type === 'telur') {
    productForm.value.unit = 'KG';
    if (!productForm.value.lastSellPrice) productForm.value.lastSellPrice = 28000;
    if (!productForm.value.lastBuyPrice) productForm.value.lastBuyPrice = 24000;
    productForm.value.units = [
      { id: `u-${Date.now()}-1`, unitName: 'PETI (15 KG)', conversionFactor: 15, sellPrice: Math.round(productForm.value.lastSellPrice * 15 * 0.96) },
      { id: `u-${Date.now()}-2`, unitName: 'BUTIR', conversionFactor: 0.0625, sellPrice: 2000 }
    ];
  } else if (type === 'rokok') {
    productForm.value.unit = 'BUNGKUS';
    if (!productForm.value.lastSellPrice) productForm.value.lastSellPrice = 30000;
    if (!productForm.value.lastBuyPrice) productForm.value.lastBuyPrice = 27000;
    productForm.value.units = [
      { id: `u-${Date.now()}-1`, unitName: 'SLOP', conversionFactor: 10, sellPrice: Math.round(productForm.value.lastSellPrice * 10 * 0.98) }
    ];
  } else if (type === 'beras') {
    productForm.value.unit = 'KG';
    if (!productForm.value.lastSellPrice) productForm.value.lastSellPrice = 14500;
    if (!productForm.value.lastBuyPrice) productForm.value.lastBuyPrice = 12500;
    productForm.value.units = [
      { id: `u-${Date.now()}-1`, unitName: 'SAK (50 KG)', conversionFactor: 50, sellPrice: Math.round(productForm.value.lastSellPrice * 50 * 0.96) },
      { id: `u-${Date.now()}-2`, unitName: 'SAK (25 KG)', conversionFactor: 25, sellPrice: Math.round(productForm.value.lastSellPrice * 25 * 0.97) },
      { id: `u-${Date.now()}-3`, unitName: 'KARUNG (5 KG)', conversionFactor: 5, sellPrice: Math.round(productForm.value.lastSellPrice * 5) }
    ];
  } else if (type === 'air') {
    productForm.value.unit = 'CUP';
    if (!productForm.value.lastSellPrice) productForm.value.lastSellPrice = 1000;
    if (!productForm.value.lastBuyPrice) productForm.value.lastBuyPrice = 600;
    productForm.value.units = [
      { id: `u-${Date.now()}-1`, unitName: 'DUS', conversionFactor: 40, sellPrice: Math.round(productForm.value.lastSellPrice * 40 * 0.9) }
    ];
  } else if (type === 'renceng') {
    productForm.value.unit = 'SACHET';
    if (!productForm.value.lastSellPrice) productForm.value.lastSellPrice = 2000;
    if (!productForm.value.lastBuyPrice) productForm.value.lastBuyPrice = 1500;
    productForm.value.units = [
      { id: `u-${Date.now()}-1`, unitName: 'RENCENG', conversionFactor: 10, sellPrice: Math.round(productForm.value.lastSellPrice * 10 * 0.95) }
    ];
  }
}

// Update faktor konversi satuan kemasan langsung dari kotak penerimaan kulakan
function updateActiveInboundFactor(newVal: string | number) {
  const val = Number(newVal);
  if (isNaN(val) || val <= 0) return;
  const found = productForm.value.units.find(
    u => u.unitName.toUpperCase() === selectedInboundUnit.value.toUpperCase()
  );
  if (found) {
    found.conversionFactor = val;
  }
}

function addCustomUnit() {
  productForm.value.hasMultiUnits = true;
  productForm.value.units.push({
    id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    unitName: 'DUS',
    conversionFactor: 1,
    sellPrice: productForm.value.lastSellPrice || 0
  });
}

function removeUnit(index: number) {
  productForm.value.units.splice(index, 1);
  if (productForm.value.units.length === 0) {
    productForm.value.hasMultiUnits = false;
  }
}

// Watcher sinkronisasi dengan props activeProduct dari parent
watch(
  () => props.activeProduct,
  (newProd) => {
    if (newProd && newProd.id) {
      loadProductData(newProd);
    } else {
      resetToNew();
    }
  },
  { immediate: true }
);

// Watcher ketika drawer dibuka/tutup
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      if (props.activeProduct && props.activeProduct.id) {
        loadProductData(props.activeProduct);
      } else if (!selectedProductId.value && !productForm.value.name) {
        resetToNew();
      }
    }
  }
);

// Handler saat memilih produk dari SearchableSelect
function handleSelectProductOption(opt: SelectOption | undefined) {
  if (!opt || !opt.value) {
    resetToNew();
    return;
  }
  const prod = inventoryStore.products.find(p => p.id === String(opt.value));
  if (prod) {
    loadProductData(prod);
  }
}

// Handler saat mengetik nama produk baru yang belum ada di katalog
function handleCreateProductFromQuery(query: string) {
  resetToNew(query);
}

// Logika Kalkulasi Harga & Margin
function onCategoryChange() {
  if (!isExistingProduct.value) {
    const newMarkup = inventoryStore.getCategoryMarkup(productForm.value.category);
    if (!productForm.value.lastSellPrice || productForm.value.lastSellPrice === 0) {
      productForm.value.defaultMarkupPercent = newMarkup;
      if (productForm.value.lastBuyPrice > 0) {
        recalculateSellPrice();
      }
    } else if (productForm.value.lastBuyPrice > 0) {
      const buy = productForm.value.lastBuyPrice;
      const sell = productForm.value.lastSellPrice;
      productForm.value.defaultMarkupPercent = Number((((sell - buy) / buy) * 100).toFixed(1));
    }
  }
}

function onBuyPriceChange() {
  const buy = Number(productForm.value.lastBuyPrice) || 0;
  const sell = Number(productForm.value.lastSellPrice) || 0;
  if (sell > 0 && buy > 0) {
    productForm.value.defaultMarkupPercent = Number((((sell - buy) / buy) * 100).toFixed(1));
  } else if (sell === 0 && buy > 0) {
    const markup = productForm.value.defaultMarkupPercent ?? inventoryStore.getCategoryMarkup(productForm.value.category);
    productForm.value.lastSellPrice = Math.round(buy * (1 + markup / 100));
  }
}

function onSellPriceChange() {
  const buy = Number(productForm.value.lastBuyPrice) || 0;
  const sell = Number(productForm.value.lastSellPrice) || 0;
  if (buy > 0) {
    productForm.value.defaultMarkupPercent = Number((((sell - buy) / buy) * 100).toFixed(1));
  }
}

function recalculateSellPrice() {
  const markup = productForm.value.defaultMarkupPercent ?? 20;
  productForm.value.lastSellPrice = Math.round((productForm.value.lastBuyPrice || 0) * (1 + markup / 100));
}

// Quick Qty Increment Buttons
function addQuickQty(delta: number) {
  qtyReceived.value = Math.max(0, (Number(qtyReceived.value) || 0) + delta);
}

// Simpan Data Terpadu (Katalog + Kulakan)
const isSaving = ref(false);

async function handleSave() {
  if (!productForm.value.name.trim() || !productForm.value.unit.trim()) return;
  if (isSaving.value) return;

  isSaving.value = true;
  try {
    const isNew = !selectedProductId.value;
    const sell = Math.max(0, Number(productForm.value.lastSellPrice) || 0);
    const nowStock = Number(productForm.value.currentStock) || 0;
    
    // Hitung efektif stok & modal per base unit dari input kulakan
    const effectiveQty = effectiveReceivedBaseQty.value;
    const finalStock = isNew ? effectiveQty : Number((nowStock + effectiveQty).toFixed(4));
    const effectiveBuy = effectiveBaseBuyPrice.value;

    const prodId = isNew
      ? `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
      : selectedProductId.value;

    // Bersihkan data multi-satuan jika diaktifkan
    const cleanUnits: ProductUnitConversion[] | undefined = productForm.value.hasMultiUnits && productForm.value.units.length > 0
      ? productForm.value.units
          .filter(u => u.unitName.trim() && Number(u.conversionFactor) > 0)
          .map(u => ({
            id: u.id || `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            unitName: u.unitName.trim().toUpperCase(),
            conversionFactor: Number(u.conversionFactor),
            sellPrice: u.sellPrice && u.sellPrice > 0 ? Number(u.sellPrice) : undefined,
            barcode: u.barcode?.trim() || undefined
          }))
      : undefined;

    const productPayload: Product = {
      id: prodId,
      code: (productForm.value.code.trim() || `SKU-${Date.now().toString().slice(-4)}`).toUpperCase(),
      name: productForm.value.name.trim().toUpperCase(),
      category: productForm.value.category || 'Umum',
      supplier: productForm.value.supplier || '',
      unit: productForm.value.unit.trim().toUpperCase(),
      defaultMarkupPercent: productForm.value.defaultMarkupPercent || 20,
      lastBuyPrice: effectiveBuy,
      lastSellPrice: sell,
      stock: finalStock,
      barcode: productForm.value.barcode?.trim() || undefined,
      notes: productForm.value.notes?.trim() || undefined,
      units: cleanUnits && cleanUnits.length > 0 ? cleanUnits : undefined,
      isPerishable: false
    };

    if (isNew) {
      inventoryStore.addProduct(productPayload);
    } else {
      inventoryStore.updateProduct(productPayload);
    }

    // Jika ada penambahan barang masuk (Nyetok / Kulakan > 0), catat ke Kartu Stok, Riwayat Kulakan, dan Batch FIFO
    if (effectiveQty > 0) {
      const invoiceNo =
        invoiceNumber.value.trim() ||
        `NOTA-${(productForm.value.supplier || 'KULAKAN').replace(/\s+/g, '-').toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;

      const supplierName = productForm.value.supplier || 'Mitra Pemasok';
      const inboundUnitName = selectedInboundUnit.value || productPayload.unit;
      const inboundDesc = activeInboundFactor.value !== 1
        ? ` (${qtyReceived.value} ${inboundUnitName} = ${effectiveQty} ${productPayload.unit})`
        : '';

      // 1. Catat Aliran Kartu Stok
      movementStore.recordMovement({
        product: productPayload,
        type: 'KULAKAN',
        refNo: invoiceNo,
        qtyChange: effectiveQty,
        stockBefore: nowStock,
        stockAfter: finalStock,
        costPrice: effectiveBuy,
        notes: isNew
          ? `Katalog baru & kulakan masuk (${supplierName})${inboundDesc}`
          : `Kulakan masuk dari ${supplierName}${inboundDesc}`,
        operator: 'Kasir / Admin'
      });

      // 2. Simpan Riwayat Nota Kulakan
      const receipt: PurchaseReceipt = {
        id: `pr-${Date.now()}`,
        supplierInvoiceNo: invoiceNo,
        date: new Date().toISOString().slice(0, 10),
        supplier: supplierName,
        items: [
          {
            id: `rcv-${Date.now()}`,
            productId: productPayload.id,
            code: productPayload.code,
            name: productPayload.name,
            category: productPayload.category,
            unit: inboundUnitName,
            qtyReceived: Math.max(0, Number(qtyReceived.value) || 0),
            buyPrice: activeInboundFactor.value !== 1 && inboundPackageBuyPrice.value > 0 ? inboundPackageBuyPrice.value : effectiveBuy,
            subtotalBuy: totalInboundCost.value,
            markupPercent: productPayload.defaultMarkupPercent,
            newSellPrice: sell
          }
        ],
        totalBuy: totalInboundCost.value,
        notes: productForm.value.notes || undefined,
        createdAt: new Date().toISOString()
      };
      purchaseStore.purchaseHistory.unshift(receipt);
      purchaseStore.saveLocal();

      // 3. Catat Batch FIFO/FEFO dalam Base Unit
      batchStore.addBatch({
        productId: productPayload.id,
        purchaseReceiptId: receipt.id,
        qty: effectiveQty,
        buyPrice: effectiveBuy,
        sellPrice: sell
      });
    }

    // Daftarkan satuan ke UnitStore jika belum ada
    if (productPayload.unit) {
      unitStore.ensureUnitRegistered(productPayload.unit, 'BASE');
    }
    if (productPayload.units && Array.isArray(productPayload.units)) {
      for (const cu of productPayload.units) {
        if (cu.unitName) {
          unitStore.ensureUnitRegistered(cu.unitName, 'PACKAGING');
        }
      }
    }

    inventoryStore.saveLocal();
    emit('saved', productPayload);
    emit('update:modelValue', false);
  } finally {
    isSaving.value = false;
  }
}

// Hapus Produk
async function handleDelete() {
  if (!selectedProductId.value) return;
  const isConfirmed = await showConfirm({
    title: 'Hapus Produk dari Katalog',
    message: `Hapus "${productForm.value.name}" (${productForm.value.code}) secara permanen?`,
    details: 'Barang yang dihapus tidak akan dapat dipilih di Kasir maupun laporan stok.',
    confirmText: 'Ya, Hapus Produk',
    cancelText: 'Batal',
    type: 'danger'
  });
  if (!isConfirmed) return;

  inventoryStore.deleteProduct(selectedProductId.value);
  emit('deleted', selectedProductId.value);
  emit('update:modelValue', false);
}
</script>

<template>
  <FormSidebarDrawer
    :model-value="modelValue"
    :is-editing="isExistingProduct"
    title="Barang & Kulakan"
    :code-badge="productForm.code"
    :can-edit="isExistingProduct"
    :can-save="!!productForm.name.trim() && !!productForm.unit.trim() && !isSaving"
    :save-label="
      isSaving
        ? 'MENYIMPAN...'
        : qtyReceived > 0
        ? (isExistingProduct ? 'SIMPAN & TAMBAH STOK' : 'SIMPAN BARANG & STOK')
        : (isExistingProduct ? 'SIMPAN PERUBAHAN' : 'SIMPAN BARANG')
    "
    theme-color="purple"
    :show-delete="isExistingProduct"
    width="w-[410px] lg:w-[450px]"
    @update:model-value="emit('update:modelValue', $event)"
    @switch-to-new="resetToNew"
    @switch-to-edit="props.activeProduct && loadProductData(props.activeProduct)"
    @save="handleSave"
    @delete="handleDelete"
    @cancel="emit('update:modelValue', false)"
  >
    <template #icon>
      <Package :size="14" class="text-purple-700 shrink-0" />
    </template>

    <!-- AREA 1: PENCARIAN & PEMILIHAN PRODUK / TAMBAH BARU (SearchableSelect) -->
    <div class="p-3 bg-gradient-to-r from-purple-50/80 via-blue-50/80 to-amber-50/80 border border-purple-200/90 rounded-lg space-y-2 shadow-2xs">
      <div class="flex items-center justify-between">
        <label class="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
          <Search :size="12" class="text-purple-600" />
          <span>PILIH PRODUK DARI KATALOG / BUAT BARU</span>
        </label>
        <span
          v-if="isExistingProduct"
          class="text-[10px] text-emerald-800 font-bold bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded flex items-center gap-1"
        >
          <span>Terdaftar</span>
        </span>
        <span
          v-else
          class="text-[10px] text-purple-800 font-bold bg-purple-100 border border-purple-300 px-1.5 py-0.2 rounded flex items-center gap-1"
        >
          <Sparkles :size="10" />
          <span>Produk Baru</span>
        </span>
      </div>

      <!-- SearchableSelect dengan fitur create langsung -->
      <SearchableSelect
        :model-value="selectedProductId"
        :options="productOptions"
        placeholder="Cari produk katalog atau ketik nama baru..."
        search-placeholder="Ketik nama barang / SKU / barcode..."
        hotkey="F4"
        :allow-create="true"
        create-label="Tambah Produk Baru"
        :clearable="true"
        size="md"
        @change="handleSelectProductOption"
        @create="handleCreateProductFromQuery"
      />

      <div class="flex items-center justify-between text-[10.5px] text-gray-500 pt-0.5">
        <span class="truncate">
          Ketik nama barang lalu tekan <kbd class="px-1 py-0.2 bg-white border border-gray-300 rounded font-mono font-bold text-gray-700">Enter ↵</kbd>
        </span>
        <button
          v-if="isExistingProduct"
          type="button"
          class="text-purple-700 hover:text-purple-900 font-bold hover:underline cursor-pointer shrink-0 ml-2"
          @click="resetToNew()"
        >
          + Buat Baru
        </button>
      </div>
    </div>

    <!-- AREA 2: IDENTITAS BARANG & KATEGORI -->
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <div class="flex items-center justify-between font-bold text-purple-800 text-xs">
        <div class="flex items-center gap-1.5">
          <Tag :size="13" />
          <span>Identitas & Informasi Katalog</span>
        </div>
        <span class="text-[10px] font-mono text-gray-400">ID: {{ productForm.code }}</span>
      </div>

      <!-- Nama Barang -->
      <div>
        <label class="text-[11px] font-semibold text-gray-700 block mb-0.5">
          Nama Barang / Produk <span class="text-rose-600">*</span>
        </label>
        <input
          v-model="productForm.name"
          type="text"
          placeholder="Contoh: BERAS RAJA LELE 5KG"
          class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-purple-600 font-bold text-gray-900 shadow-2xs uppercase"
        />
      </div>

      <!-- Grid: Kode SKU & Barcode Scanner -->
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Kode SKU</label>
          <input
            v-model="productForm.code"
            type="text"
            placeholder="SKU-BRG-001"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-purple-600 font-mono shadow-2xs uppercase"
          />
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Barcode Kasir</label>
          <div class="relative">
            <input
              v-model="productForm.barcode"
              type="text"
              placeholder="Scan / angka barcode"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-purple-600 font-mono shadow-2xs"
            />
            <Barcode :size="13" class="absolute left-2 top-2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <!-- Grid: Kategori & Satuan Terstandar -->
      <div class="grid grid-cols-3 gap-2">
        <div class="col-span-2">
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">
            Kategori Barang <span class="text-rose-600">*</span>
          </label>
          <SearchableSelect
            v-model="productForm.category"
            :options="categoryOptions"
            placeholder="Pilih Kategori..."
            search-placeholder="Cari kategori..."
            hotkey=""
            @change="onCategoryChange"
          />
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5 flex items-center justify-between">
            <span>Satuan <span class="text-rose-600">*</span></span>
            <span class="text-[9px] font-normal text-purple-600">Base Unit</span>
          </label>
          <div class="relative">
            <input
              v-model="productForm.unit"
              list="standard-units-list"
              type="text"
              placeholder="PCS / KG"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-purple-600 font-mono uppercase font-bold text-center shadow-2xs"
            />
            <datalist id="standard-units-list">
              <option v-for="u in allStandardUnits" :key="u" :value="u" />
            </datalist>
          </div>
        </div>
      </div>

      <!-- Quick Pick Satuan Dasar Populer -->
      <div class="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
        <span class="text-[9.5px] text-gray-400 shrink-0">Pilih cepat:</span>
        <button
          v-for="u in ['PCS', 'BUNGKUS', 'KG', 'BUTIR', 'LITER', 'SAK', 'DUS']"
          :key="u"
          type="button"
          class="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer shrink-0"
          :class="productForm.unit.toUpperCase() === u
            ? 'bg-purple-100 text-purple-900 border-purple-400 shadow-2xs'
            : 'bg-white hover:bg-gray-100 text-gray-600 border-gray-200'"
          @click="productForm.unit = u"
        >
          {{ u }}
        </button>
      </div>

      <!-- Mitra Supplier (Pemasok) -->
      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Mitra Supplier (Pemasok Kulakan)</label>
        <SearchableSelect
          v-model="productForm.supplier"
          :options="supplierOptions"
          placeholder="Pilih Mitra Supplier Pemasok..."
          search-placeholder="Cari nama supplier..."
          hotkey=""
        />
      </div>
    </div>

    <!-- AREA 3: HARGA BELI & HARGA JUAL KASIR -->
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 font-bold text-blue-700 text-xs">
          <Percent :size="13" />
          <span>Harga Modal & Harga Jual Kasir</span>
        </div>
        <span class="text-[10px] text-gray-400">Margin & laba otomatis</span>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-gray-700 block mb-0.5">
            Modal Beli (HPP per {{ productForm.unit }}) *
          </label>
          <div class="relative">
            <span class="absolute left-2.5 top-1.5 text-gray-400 font-mono text-[11px]">Rp</span>
            <input
              v-model.number="productForm.lastBuyPrice"
              type="number"
              min="0"
              step="500"
              placeholder="0"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded pl-8 pr-2 py-1.5 text-xs outline-none focus:border-blue-600 font-mono font-bold text-gray-800 shadow-2xs"
              @input="onBuyPriceChange"
            />
          </div>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-blue-800 block mb-0.5">
            Harga Jual Kasir (per {{ productForm.unit }}) *
          </label>
          <div class="relative">
            <span class="absolute left-2.5 top-1.5 text-blue-500 font-mono text-[11px]">Rp</span>
            <input
              v-model.number="productForm.lastSellPrice"
              type="number"
              min="0"
              step="500"
              placeholder="0"
              class="w-full bg-[#f8fbff] border border-blue-400 rounded pl-8 pr-2 py-1.5 text-xs outline-none focus:border-blue-600 font-mono font-bold text-blue-700 shadow-2xs"
              @input="onSellPriceChange"
            />
          </div>
        </div>
      </div>

      <!-- Visual Card Margin & Keuntungan -->
      <div class="p-2.5 bg-gradient-to-r from-emerald-50/70 to-blue-50/70 border border-emerald-200/80 rounded-lg flex items-center justify-between text-xs">
        <div class="flex flex-col">
          <span class="text-[10px] text-gray-500 font-medium">Laba Bersih per {{ productForm.unit }}:</span>
          <strong class="font-mono text-emerald-700 font-bold text-xs">
            +Rp {{ formatRupiah(Math.max(0, (productForm.lastSellPrice || 0) - (productForm.lastBuyPrice || 0))) }}
          </strong>
        </div>

        <div class="flex flex-col items-end">
          <span class="text-[10px] text-gray-500 font-medium">Margin Sistem:</span>
          <div class="flex items-center gap-1">
            <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">
              +{{ productForm.defaultMarkupPercent || 0 }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- AREA MULTI-SATUAN: PENJUALAN ECERAN & GROSIR (OPTIONAL TOGGLE) -->
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <div class="flex items-center justify-between p-2.5 bg-purple-50/70 border border-purple-200 rounded-lg">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            v-model="productForm.hasMultiUnits"
            type="checkbox"
            class="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
          />
          <div>
            <span class="text-xs font-bold text-purple-950 block">Aktifkan Penjualan Eceran / Multi-Satuan</span>
            <span class="text-[10px] text-purple-700 block">
              Untuk barang kulakan dus/peti yang bisa diecer (Mie Dus, Telur Kiloan & Butiran, Rokok Slop)
            </span>
          </div>
        </label>
        <span
          class="text-[10px] font-bold px-2 py-0.5 rounded shrink-0"
          :class="productForm.hasMultiUnits ? 'bg-purple-600 text-white shadow-2xs' : 'bg-gray-200 text-gray-600'"
        >
          {{ productForm.hasMultiUnits ? 'Multi-Satuan ON' : '1 Satuan Saja' }}
        </span>
      </div>

      <!-- Detail Konfigurasi Satuan Turunan (Tampil jika hasMultiUnits aktif) -->
      <div v-if="productForm.hasMultiUnits" class="p-3 bg-white border border-purple-200 rounded-lg space-y-3">
        <!-- Banner Info Base Unit -->
        <div class="flex items-center justify-between text-[11px] p-2 bg-purple-50/50 rounded border border-purple-100 text-purple-900">
          <div class="flex items-center gap-1.5">
            <Scale :size="13" class="text-purple-600 shrink-0" />
            <span>Satuan Dasar Stok Utama: <strong>{{ productForm.unit }}</strong></span>
          </div>
          <span class="text-[10px] text-gray-500 font-mono">Semua stok gudang disimpan dalam {{ productForm.unit }}</span>
        </div>

        <!-- Tombol Template Cepat Ritel Sembako -->
        <div>
          <span class="text-[10.5px] font-semibold text-gray-600 block mb-1">Pasang Template Ritel Sembako Cepat:</span>
          <div class="flex flex-wrap gap-1.5">
            <button
              type="button"
              class="px-2 py-1 text-[10.5px] font-medium rounded bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 cursor-pointer transition-colors"
              title="1 Dus = 40 Bungkus"
              @click="applyUnitTemplate('mie')"
            >
              🍜 Mie Dus (Isi 40)
            </button>
            <button
              type="button"
              class="px-2 py-1 text-[10.5px] font-medium rounded bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-300 cursor-pointer transition-colors"
              title="1 Dus = 40 Cup (Bisa disesuaikan jika isi 20/24/48)"
              @click="applyUnitTemplate('air')"
            >
              🥤 Air Mineral Dus (Isi 40)
            </button>
            <button
              type="button"
              class="px-2 py-1 text-[10.5px] font-medium rounded bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-300 cursor-pointer transition-colors"
              title="1 Renceng = 10 Sachet"
              @click="applyUnitTemplate('renceng')"
            >
              ☕ Kopi/Sampo Renceng (Isi 10)
            </button>
            <button
              type="button"
              class="px-2 py-1 text-[10.5px] font-medium rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 cursor-pointer transition-colors"
              title="Base KG + 1 Peti 15kg + Ecer Butir"
              @click="applyUnitTemplate('telur')"
            >
              🥚 Telur Ayam (Peti & Ecer Butir)
            </button>
            <button
              type="button"
              class="px-2 py-1 text-[10.5px] font-medium rounded bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 cursor-pointer transition-colors"
              title="1 Slop = 10 Bungkus"
              @click="applyUnitTemplate('rokok')"
            >
              🚬 Rokok Slop (Isi 10)
            </button>
            <button
              type="button"
              class="px-2 py-1 text-[10.5px] font-medium rounded bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-300 cursor-pointer transition-colors"
              title="Base KG + Sak 50kg, 25kg, Karung 5kg"
              @click="applyUnitTemplate('beras')"
            >
              🌾 Beras Curah (Sak 50kg/25kg)
            </button>
          </div>
        </div>

        <!-- Tabel Satuan Turunan -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-gray-700">Daftar Kemasan & Satuan Eceran Turunan:</span>
            <button
              type="button"
              class="text-purple-700 hover:text-purple-900 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              @click="addCustomUnit"
            >
              <Plus :size="12" />
              <span>Tambah Baris Satuan</span>
            </button>
          </div>

          <div v-if="productForm.units.length === 0" class="text-center py-3 text-gray-400 text-xs italic bg-gray-50 rounded border border-dashed border-gray-300">
            Belum ada satuan turunan. Klik salah satu template di atas atau klik "+ Tambah Baris Satuan".
          </div>

          <div
            v-for="(u, idx) in productForm.units"
            :key="u.id || idx"
            class="p-2 bg-gray-50 rounded border border-gray-200 space-y-1.5"
          >
            <div class="grid grid-cols-12 gap-1.5 items-center">
              <!-- Nama Satuan -->
              <div class="col-span-3">
                <label class="text-[9.5px] text-gray-500 block mb-0.5">Nama Satuan</label>
                <input
                  v-model="u.unitName"
                  list="standard-units-list"
                  type="text"
                  placeholder="DUS / BUTIR"
                  class="w-full bg-white border border-gray-300 rounded px-1.5 py-1 text-[11px] font-mono font-bold uppercase outline-none focus:border-purple-600 text-center"
                />
              </div>

              <!-- Faktor Konversi -->
              <div class="col-span-3">
                <label class="text-[9.5px] text-gray-500 block mb-0.5">Isi Base Unit</label>
                <div class="relative">
                  <input
                    v-model.number="u.conversionFactor"
                    type="number"
                    step="any"
                    min="0.0001"
                    placeholder="Contoh 40"
                    class="w-full bg-white border border-gray-300 rounded px-1.5 py-1 text-[11px] font-mono font-bold text-purple-900 outline-none focus:border-purple-600 text-center"
                  />
                </div>
              </div>

              <!-- Harga Jual Kasir Satuan Ini -->
              <div class="col-span-5">
                <label class="text-[9.5px] text-blue-700 block mb-0.5">Harga Jual Khusus (Rp)</label>
                <div class="relative">
                  <span class="absolute left-1.5 top-1 text-[10px] text-gray-400 font-mono">Rp</span>
                  <input
                    v-model.number="u.sellPrice"
                    type="number"
                    min="0"
                    step="500"
                    placeholder="0"
                    class="w-full bg-blue-50/50 border border-blue-300 rounded pl-6 pr-1.5 py-1 text-[11px] font-mono font-bold text-blue-900 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <!-- Tombol Hapus Baris -->
              <div class="col-span-1 flex justify-center pt-3">
                <button
                  type="button"
                  class="p-1 text-gray-400 hover:text-red-600 rounded cursor-pointer transition-colors"
                  title="Hapus satuan ini"
                  @click="removeUnit(idx)"
                >
                  <Trash2 :size="13" />
                </button>
              </div>
            </div>

            <!-- Helper Rumus Konversi Otomatis -->
            <div class="flex items-center justify-between text-[10px] font-mono text-gray-500 px-1 pt-0.5">
              <span>
                Rumus: <strong>1 {{ u.unitName || 'SATUAN' }}</strong> = <strong>{{ u.conversionFactor }} {{ productForm.unit }}</strong>
                <span v-if="u.conversionFactor < 1 && u.conversionFactor > 0" class="text-purple-700 ml-1">
                  (1 {{ productForm.unit }} ≈ {{ Math.round(1 / u.conversionFactor) }} {{ u.unitName }})
                </span>
              </span>
              <span v-if="u.sellPrice" class="text-emerald-700 font-bold">
                Jual: Rp {{ formatRupiah(u.sellPrice) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AREA 4: KULAKAN & ALIRAN STOK MASUK (The Merged Powerhouse!) -->
    <div class="space-y-3 pb-2">
      <div class="flex items-center justify-between font-bold text-amber-800 text-xs">
        <div class="flex items-center gap-1.5">
          <Truck :size="14" class="text-amber-600" />
          <span>Kulakan & Aliran Stok Barang Masuk</span>
        </div>
        <span class="text-[10px] font-normal text-amber-900 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300 font-mono">
          Nyetok Langsung
        </span>
      </div>

      <!-- Panel Status Stok & Input Qty Kulakan -->
      <div class="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2.5">
        <div class="grid grid-cols-2 gap-2 text-xs">
          <!-- Kolom 1: Stok Saat Ini -->
          <div class="p-2 bg-white rounded border border-amber-200/80">
            <span class="text-[10.5px] text-gray-500 block">Stok Toko Saat Ini:</span>
            <div class="font-mono font-bold text-gray-800 text-sm mt-0.5">
              {{ productForm.currentStock }} {{ productForm.unit }}
            </div>
          </div>

          <!-- Kolom 2: Jumlah Barang Masuk (Kulakan) -->
          <div class="p-2 bg-white rounded border border-amber-300 ring-1 ring-amber-400/50">
            <span class="text-[10.5px] text-amber-900 font-bold block flex items-center justify-between">
              <span>+ Tambah Masuk (Qty):</span>
              <span v-if="qtyReceived > 0" class="text-amber-600 text-[10px] font-normal">Kulakan</span>
            </span>
            <div class="flex items-center gap-1 mt-0.5">
              <input
                v-model.number="qtyReceived"
                type="number"
                min="0"
                step="any"
                class="w-full bg-amber-50/40 border border-amber-400 rounded px-2 py-0.5 text-xs font-mono font-bold text-amber-900 outline-none focus:border-amber-600 text-center"
              />
              <!-- Dropdown Satuan Masuk jika Multi-Satuan Aktif -->
              <select
                v-if="productForm.hasMultiUnits && availableInboundUnits.length > 1"
                v-model="selectedInboundUnit"
                class="bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-amber-900 outline-none cursor-pointer"
                title="Pilih satuan barang masuk"
              >
                <option v-for="iu in availableInboundUnits" :key="iu.unitName" :value="iu.unitName">
                  {{ iu.unitName }}
                </option>
              </select>
              <span v-else class="text-[11px] font-mono text-gray-500 shrink-0">{{ productForm.unit }}</span>
            </div>
          </div>
        </div>

        <!-- Input Harga Modal & Isi Kemasan jika Kulakan dalam Satuan Besar (misal Beli Dus/Peti/Sak) -->
        <div
          v-if="activeInboundFactor !== 1 && qtyReceived > 0"
          class="p-2.5 bg-amber-100/70 border border-amber-300 rounded-lg space-y-2 text-xs"
        >
          <!-- Baris 1: Harga Beli Modal Kemasan -->
          <div class="flex items-center justify-between font-semibold text-amber-950 text-[11px]">
            <span>Harga Beli Modal per 1 {{ selectedInboundUnit }}:</span>
            <div class="relative w-36">
              <span class="absolute left-1.5 top-1 text-[10px] text-gray-400 font-mono">Rp</span>
              <input
                v-model.number="inboundPackageBuyPrice"
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                class="w-full bg-white border border-amber-400 rounded pl-6 pr-2 py-0.5 text-xs font-mono font-bold text-amber-900 outline-none focus:border-amber-600"
              />
            </div>
          </div>

          <!-- Baris 2: Hitung Isi per Kemasan (Bisa langsung diedit saat kulakan jika pabrik mengecilkan/mengubah kemasan) -->
          <div class="flex items-center justify-between font-semibold text-amber-950 text-[11px]">
            <span class="flex items-center gap-1" title="Dihitung saat kulakan karena isi kemasan dus/sak/renceng bisa berkurang dari pabrik">
              <span>Isi per 1 {{ selectedInboundUnit }}:</span>
              <span class="text-[9.5px] text-amber-700 font-normal">(bisa diubah)</span>
            </span>
            <div class="flex items-center gap-1.5 w-36">
              <input
                :value="activeInboundFactor"
                type="number"
                min="0.0001"
                step="any"
                class="w-full bg-white border border-amber-400 rounded px-2 py-0.5 text-xs font-mono font-bold text-amber-900 outline-none focus:border-amber-600 text-center"
                title="Jumlah isi satuan terkecil di dalam kemasan ini (bisa diedit jika pabrik mengubah isi kemasan)"
                @input="updateActiveInboundFactor(($event.target as HTMLInputElement).value)"
              />
              <span class="text-[10px] font-mono text-amber-900 shrink-0 font-bold uppercase">{{ productForm.unit }}</span>
            </div>
          </div>

          <!-- Keterangan konversi real-time -->
          <div class="text-[10px] text-amber-900 font-mono pt-1.5 border-t border-amber-300/80 flex items-center justify-between">
            <span>
              Konversi: <strong>{{ qtyReceived }} {{ selectedInboundUnit }}</strong> = <strong>+{{ effectiveReceivedBaseQty }} {{ productForm.unit }}</strong>
            </span>
            <span>
              HPP Modal = <strong>Rp {{ formatRupiah(effectiveBaseBuyPrice) }} / {{ productForm.unit }}</strong>
            </span>
          </div>
        </div>

        <!-- Tombol Cepat Tambah Qty -->
        <div class="flex items-center gap-1.5 pt-0.5">
          <span class="text-[10px] text-gray-400 shrink-0">Pintasan:</span>
          <button
            v-for="amt in [5, 10, 20, 50, 100]"
            :key="amt"
            type="button"
            class="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-white hover:bg-amber-100 border border-amber-200 text-amber-800 cursor-pointer transition-colors shadow-2xs"
            @click="addQuickQty(amt)"
          >
            +{{ amt }}
          </button>
          <button
            v-if="qtyReceived > 0"
            type="button"
            class="px-1.5 py-0.5 text-[10px] font-mono rounded bg-gray-100 hover:bg-gray-200 text-gray-600 cursor-pointer ml-auto"
            title="Nolkan Qty Masuk (Hanya edit katalog barang)"
            @click="qtyReceived = 0"
          >
            Reset 0
          </button>
        </div>

        <!-- Ringkasan Proyeksi Total Stok & Biaya Kulakan -->
        <div
          v-if="qtyReceived > 0"
          class="p-2 bg-white rounded border border-amber-300 flex items-center justify-between text-xs animate-in fade-in duration-150"
        >
          <div>
            <span class="text-[10px] text-gray-500 block">Total Stok Menjadi:</span>
            <span class="font-mono font-bold text-emerald-700 text-xs">
              {{ projectedStock }} {{ productForm.unit }}
            </span>
            <span v-if="activeInboundFactor !== 1" class="text-[9.5px] text-gray-400 block font-mono">
              (+{{ effectiveReceivedBaseQty }} {{ productForm.unit }})
            </span>
          </div>

          <div class="text-right">
            <span class="text-[10px] text-gray-500 block">Total Modal Kulakan:</span>
            <span class="font-mono font-bold text-amber-900 text-xs">
              Rp {{ formatRupiah(totalInboundCost) }}
            </span>
          </div>
        </div>

        <!-- No Faktur / Nota Kulakan (Opsional) -->
        <div v-if="qtyReceived > 0">
          <label class="text-[10.5px] font-semibold text-gray-600 block mb-0.5">
            No. Faktur / Nota Supplier (Opsional)
          </label>
          <input
            v-model="invoiceNumber"
            type="text"
            placeholder="Contoh: INV-2026/10/001 (Otomatis jika kosong)"
            class="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono outline-none focus:border-amber-600 shadow-2xs"
          />
        </div>
      </div>

      <!-- Catatan Tambahan -->
      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Catatan Tambahan (Opsional)</label>
        <textarea
          v-model="productForm.notes"
          rows="1"
          placeholder="Keterangan distributor, rak penyimpanan..."
          class="w-full bg-[#fcfbfa] border border-gray-300 rounded p-2 text-xs outline-none focus:border-purple-600 shadow-2xs"
        />
      </div>
    </div>
  </FormSidebarDrawer>
</template>
