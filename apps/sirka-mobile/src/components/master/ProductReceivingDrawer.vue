<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Product, SupplierCategory, PurchaseReceipt, ProductUnitConversion } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useSupplierStore } from '../../stores/supplierStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { useStockMovementStore } from '../../stores/stockMovementStore';
import { useBatchStore } from '../../stores/batchStore';
import { formatRupiah, localTodayStr, resolveProductSupplier } from '../../utils/formatters';
import { dbService } from '../../services/dbService';
import { syncService } from '../../services/syncService';
import FormSidebarDrawer from '../common/FormSidebarDrawer.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import ProductMultiUnitsSection from './ProductMultiUnitsSection.vue';
import {
  type ProductUnitFormItem,
  isUnitRowPartiallyFilled,
  recalculateAllUnitFactors
} from '../../utils/multiUnits';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import {
  Package,
  Search,
  Percent,
  Truck,
  Sparkles,
  Barcode,
  Tag,
  ChevronDown,
  ChevronUp
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
  category: SupplierCategory | '';
  supplier: string;
  unit: string;
  defaultMarkupPercent: number;
  lastBuyPrice: number;
  lastSellPrice: number;
  currentStock: number;
  barcode: string;
  notes: string;
  hasMultiUnits: boolean;
  units: ProductUnitFormItem[];
  isPerishable: boolean;
}>({
  id: '',
  code: '',
  name: '',
  category: '',
  supplier: '',
  unit: '',
  defaultMarkupPercent: 20,
  lastBuyPrice: 0,
  lastSellPrice: 0,
  currentStock: 0,
  barcode: '',
  notes: '',
  hasMultiUnits: false,
  units: [],
  isPerishable: false
});

// State UI Progressive Disclosure untuk Kemudahan Pengguna Awam
const showAdvancedSku = ref<boolean>(false);
const isStockInboundEnabled = ref<boolean>(true);

// State Kulakan (Barang Masuk)
const qtyReceived = ref<number>(0);
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

// Efektif Qty penambahan ke Base Unit stok (untuk produk baru wajib, untuk produk lama hanya jika toggle kulakan aktif)
const effectiveReceivedBaseQty = computed(() => {
  if (isExistingProduct.value && !isStockInboundEnabled.value) return 0;
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
  // BUG FIX: bila satuan masuk adalah satuan kemasan, harga beli HARUS dihitung
  // dari harga per satuan dasar x isi kemasan. Sebelumnya memakai
  // `lastBuyPrice` (harga per satuan dasar) dikali jumlah kemasan sehingga
  // total biaya nota ikut terpaut 40x lebih kecil (contoh: 5 DUS x Rp 12.500
  // dihitung Rp 62.500 padahal nilainya Rp 2.500.000).
  const baseBuy = Number(productForm.value.lastBuyPrice) || 0;
  if (activeInboundFactor.value !== 1) {
    return received * baseBuy * activeInboundFactor.value;
  }
  return received * baseBuy;
});

// Inisialisasi Form untuk Produk Baru
function resetToNew(initialName = '') {
  selectedProductId.value = '';

  productForm.value = {
    id: '',
    code: `SKU-${Date.now().toString().slice(-4)}`,
    name: initialName.trim().toUpperCase(),
    category: '',
    supplier: '',
    unit: '',
    defaultMarkupPercent: 20,
    lastBuyPrice: 0,
    lastSellPrice: 0,
    currentStock: 0,
    barcode: '',
    notes: '',
    hasMultiUnits: false,
    units: [],
    isPerishable: false
  };
  qtyReceived.value = 0;
  // Produk baru wajib memasukkan stok awal kulakan
  isStockInboundEnabled.value = true;
  invoiceNumber.value = '';
  selectedInboundUnit.value = '';
  inboundPackageBuyPrice.value = 0;
}

// Muat data dari Produk yang dipilih
function loadProductData(prod: Product) {
  selectedProductId.value = prod.id;
  const existingUnits: ProductUnitFormItem[] = prod.units && Array.isArray(prod.units)
    ? JSON.parse(JSON.stringify(prod.units)).map((u: any) => {
        const factor = Number(u.conversionFactor) || 1;
        const isFraction = factor < 0.999 && factor > 0;
        const displayFactor = isFraction ? Math.round((1 / factor) * 100) / 100 : factor;
        return {
          ...u,
          parentUnitName: u.parentUnitName || prod.unit,
          mode: isFraction ? 'fraction' : 'multiple',
          displayFactor
        };
      })
    : [];

  productForm.value = {
    id: prod.id,
    code: prod.code,
    name: prod.name,
    category: prod.category,
    supplier: prod.supplier || resolveProductSupplier(prod) || '',
    unit: prod.unit,
    defaultMarkupPercent: prod.defaultMarkupPercent ?? inventoryStore.getCategoryMarkup(prod.category),
    lastBuyPrice: prod.lastBuyPrice || 0,
    lastSellPrice: prod.lastSellPrice || 0,
    currentStock: prod.stock || 0,
    barcode: prod.barcode || '',
    notes: prod.notes || '',
    hasMultiUnits: existingUnits.length > 0,
    units: existingUnits,
    isPerishable: prod.isPerishable ?? false
  };
  recalculateAllUnitFactors(productForm.value.units, productForm.value.unit);
  qtyReceived.value = 0;
  isStockInboundEnabled.value = false;
  selectedInboundUnit.value = prod.unit;
  inboundPackageBuyPrice.value = 0;
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
  if (productForm.value.category && (!productForm.value.supplier || productForm.value.supplier === '-')) {
    const autoSupp = resolveProductSupplier({
      category: productForm.value.category,
      code: productForm.value.code
    });
    if (autoSupp && autoSupp !== '-') {
      productForm.value.supplier = autoSupp;
    }
  }

  if (!isExistingProduct.value && productForm.value.category) {
    const newMarkup = inventoryStore.getCategoryMarkup(productForm.value.category as SupplierCategory);
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
    const markup = productForm.value.defaultMarkupPercent ?? (productForm.value.category ? inventoryStore.getCategoryMarkup(productForm.value.category as SupplierCategory) : 20);
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
  if (!productForm.value.name.trim() || !productForm.value.unit.trim() || !productForm.value.category) return;
  if (isSaving.value) return;

  // BUG FIX: nama barang & SKU harus unik. Tanpa validasi ini dua produk
  // dengan nama sama membuat lookup barcode/SKU ambigu.
  const dup = inventoryStore.products.find(
    p => p.name.trim().toUpperCase() === productForm.value.name.trim().toUpperCase()
      && p.id !== selectedProductId.value
  );
  if (dup) {
    alert(`Barang dengan nama "${productForm.value.name.trim().toUpperCase()}" sudah ada (${dup.code}).\nGunakan nama lain agar pencarian & barcode tidak ambigu.`);
    return;
  }

  isSaving.value = true;
  try {
    const isNew = !selectedProductId.value;
    const sell = Math.max(0, Number(productForm.value.lastSellPrice) || 0);
    const nowStock = Number(productForm.value.currentStock) || 0;

    // Hitung efektif stok & modal per base unit dari input kulakan
    const effectiveQty = effectiveReceivedBaseQty.value;
    const finalStock = isNew ? effectiveQty : Number((nowStock + effectiveQty).toFixed(4));
    const effectiveBuy = effectiveBaseBuyPrice.value;

    // Validasi aturan bisnis: Barang baru terdaftar TIDAK BOLEH bersaldo stok 0
    if (isNew && effectiveQty <= 0) {
      alert('Produk baru wajib memiliki stok awal masuk (tidak boleh 0). Silakan masukkan jumlah stok kulakan.');
      isSaving.value = false;
      return;
    }

    // BUG FIX: barang masuk tanpa harga modal akan membuat batch FIFO dengan
    // HPP Rp 0 sehingga laba penjualan reported jadi lebih besar dari kenyataan.
    if (effectiveQty > 0 && effectiveBuy <= 0) {
      alert('Harga beli (modal) wajib diisi untuk barang yang masuk, jika tidak HPP batch akan tersimpan Rp 0 dan laba penjualan jadi tidak akurat.');
      isSaving.value = false;
      return;
    }

    // Validasi multi-satuan: ketiga form harus diisi jika salah satu terisi
    if (productForm.value.hasMultiUnits && productForm.value.units.length > 0) {
      for (let i = 0; i < productForm.value.units.length; i++) {
        const u = productForm.value.units[i];
        if (isUnitRowPartiallyFilled(u)) {
          alert(`Baris satuan ke-${i + 1} belum lengkap.\nKetiga kolom (Isi pecahan, Nama satuan, dan Harga eceran) wajib diisi semua.`);
          isSaving.value = false;
          return;
        }
      }
    }

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
            parentUnitName: u.parentUnitName ? u.parentUnitName.trim().toUpperCase() : undefined,
            sellPrice: u.sellPrice && u.sellPrice > 0 ? Number(u.sellPrice) : undefined,
            barcode: u.barcode?.trim() || undefined
          }))
      : undefined;

    const productPayload: Product = {
      id: prodId,
      code: (productForm.value.code.trim() || `SKU-${Date.now().toString().slice(-4)}`).toUpperCase(),
      name: productForm.value.name.trim().toUpperCase(),
      category: productForm.value.category || 'Umum',
      supplier: productForm.value.supplier || resolveProductSupplier(productForm.value) || '',
      unit: productForm.value.unit.trim().toUpperCase(),
      defaultMarkupPercent: productForm.value.defaultMarkupPercent || 20,
      lastBuyPrice: effectiveBuy,
      lastSellPrice: sell,
      stock: finalStock,
      barcode: productForm.value.barcode?.trim() || undefined,
      notes: productForm.value.notes?.trim() || undefined,
      units: cleanUnits && cleanUnits.length > 0 ? cleanUnits : undefined,
      isPerishable: productForm.value.isPerishable ?? false
    };

    if (isNew) {
      // BUG FIX: `inventoryStore.addProduct()` kini menghormati id yang diberikan.
      // Sebelumnya id di-override sehingga batch / kartu stok / nota kulakan
      // menunjuk produk yang tidak pernah ada di master.
      productPayload.id = prodId;
      await inventoryStore.addProduct(productPayload);
    } else {
      await inventoryStore.updateProduct(productPayload);
    }

    // Sinkronkan stok form agar penyimpanan berikutnya tidak memakai nilai basi
    // (BUG FIX: `currentStock` hanya diisi saat load -> simpan 2x kehilangan stok).
    productForm.value.currentStock = finalStock;

    // Jika ada penambahan barang masuk (Nyetok / Kulakan > 0), catat ke Kartu Stok, Riwayat Kulakan, dan Batch FIFO
    if (effectiveQty > 0) {
      const invoiceNo =
        invoiceNumber.value.trim() ||
        `NOTA-${(productForm.value.supplier || 'KULAKAN').replace(/\s+/g, '-').toUpperCase()}-${localTodayStr().replace(/-/g, '')}`;

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
      // BUG FIX: `id` nota & item memakai `Date.now()` saja sehingga dua nota
      // yang dibuat pada milidetik yang sama bertabrakan. Ditambah sufiks acak.
      const receipt: PurchaseReceipt = {
        id: `pr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        supplierInvoiceNo: invoiceNo,
        date: localTodayStr(),
        supplier: supplierName,
        items: [
          {
            id: `rcv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            productId: productPayload.id,
            code: productPayload.code,
            name: productPayload.name,
            category: productPayload.category,
            unit: inboundUnitName,
            qtyReceived: Math.max(0, Number(qtyReceived.value) || 0),
            // BUG FIX: `baseQty` & `conversionFactor` wajib disimpan supaya
            // adjusting stok saat edit/hapus nota memakai satuan DASAR,
            // bukan jumlah kemasan (5 DUS vs 200 PCS).
            baseQty: effectiveQty,
            conversionFactor: activeInboundFactor.value,
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
      // BUG FIX: nota kulakan harus disimpan ke DATABASE, bukan hanya localStorage.
      // Sebelumnya `fetchPurchases()` menimpa cache lokal dengan data DB (kosong)
      // sehingga seluruh riwayat kulakan hilang setelah restart aplikasi.
      purchaseStore.purchaseHistory.unshift(receipt);
      purchaseStore.saveLocal();
      try {
        await dbService.savePurchase(receipt);
      } catch (err) {
        console.warn('[Sync] Offline: enqueued purchase receipt for sync:', err);
        syncService.enqueue('SAVE_PURCHASE', { receipt });
      }

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
    :can-save="
      !!productForm.name.trim() &&
      !!productForm.unit.trim() &&
      !!productForm.category &&
      (!isExistingProduct ? (qtyReceived > 0 && effectiveBaseBuyPrice > 0) : true) &&
      !isSaving
    "
    :save-label="
      isSaving
        ? 'MENYIMPAN...'
        : (isStockInboundEnabled && qtyReceived > 0)
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
        hotkey=""
        :allow-create="true"
        create-label="Tambah Produk Baru"
        :clearable="true"
        size="md"
        @change="handleSelectProductOption"
        @create="handleCreateProductFromQuery"
      />

      <div class="flex items-center justify-between text-[10.5px] text-gray-500 pt-0.5">
        <span class="truncate">
          Ketik nama barang atau pilih dari katalog
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

      <!-- Barcode Scanner & SKU (Ramah Pengguna Awam) -->
      <div>
        <div class="flex items-center justify-between mb-0.5">
          <label class="text-[11px] font-semibold text-gray-700 flex items-center gap-1">
            <Barcode :size="13" class="text-purple-600" />
            <span>Barcode Kemasan Produk</span>
          </label>
          <button
            type="button"
            class="text-[10px] text-purple-700 hover:text-purple-900 font-medium hover:underline cursor-pointer flex items-center gap-0.5"
            @click="showAdvancedSku = !showAdvancedSku"
          >
            <span>{{ showAdvancedSku ? 'Sembunyikan Kode SKU' : 'Atur Kode SKU Khusus' }}</span>
            <component :is="showAdvancedSku ? ChevronUp : ChevronDown" :size="11" />
          </button>
        </div>

        <div class="relative">
          <input
            v-model="productForm.barcode"
            type="text"
            placeholder="Scan barcode dengan scanner atau ketik angka barcode..."
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded pl-7 pr-2 py-1.5 text-xs outline-none focus:border-purple-600 font-mono shadow-2xs"
          />
          <Barcode :size="13" class="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
        </div>
        <p class="text-[10px] text-gray-400 mt-0.5">Bisa dikosongkan jika produk tidak memiliki barcode kemasan.</p>

        <!-- Kode SKU (Hanya jika diaktifkan pengguna) -->
        <div v-if="showAdvancedSku" class="mt-2 p-2 bg-purple-50/50 rounded border border-purple-200">
          <label class="text-[10.5px] font-semibold text-gray-700 block mb-0.5">
            Kode SKU Internal Toko
          </label>
          <input
            v-model="productForm.code"
            type="text"
            placeholder="Contoh: SKU-001"
            class="w-full bg-white border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-purple-600 font-mono shadow-2xs uppercase"
          />
          <span class="text-[9.5px] text-gray-500 mt-0.5 block">
            Kode unik internal barang. Sistem telah mengisikan kode otomatis, Anda dapat mengubahnya jika ada format toko sendiri.
          </span>
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

      <div :class="isExistingProduct ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'">
        <!-- Kolom 1: Stok Toko Saat Ini (Khusus Edit / Produk Lama Langsung Terlihat di Atas, Tanpa Background & Border) -->
        <div v-if="isExistingProduct">
          <label class="text-[11px] font-semibold text-gray-500 block mb-0.5 truncate">
            Stok Toko Saat Ini
          </label>
          <div class="py-1.5 font-mono font-bold text-sm text-gray-900 truncate">
            <span :class="productForm.currentStock <= 0 ? 'text-rose-600' : 'text-gray-900'">
              {{ productForm.currentStock }}
            </span>
            <span v-if="qtyReceived > 0" class="text-emerald-600 font-bold ml-1">
              + {{ effectiveReceivedBaseQty }}
            </span>
            <span class="text-xs font-semibold text-gray-500 ml-1 uppercase">
              {{ productForm.unit || 'Satuan' }}
            </span>
          </div>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-700 block mb-0.5 truncate" title="Harga Modal / Beli">
            Harga Modal <span class="text-rose-600">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-2.5 top-1.5 text-gray-400 font-mono text-[11px]">Rp</span>
            <input
              v-model.number="productForm.lastBuyPrice"
              type="number"
              min="0"
              step="500"
              placeholder="0"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded pl-7 pr-2 py-1.5 text-xs outline-none focus:border-blue-600 font-mono font-bold text-gray-800 shadow-2xs"
              @input="onBuyPriceChange"
            />
          </div>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-blue-800 block mb-0.5 truncate" title="Harga Jual Kasir">
            Harga Jual Kasir <span class="text-rose-600">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-2.5 top-1.5 text-blue-500 font-mono text-[11px]">Rp</span>
            <input
              v-model.number="productForm.lastSellPrice"
              type="number"
              min="0"
              step="500"
              placeholder="0"
              class="w-full bg-[#f8fbff] border border-blue-400 rounded pl-7 pr-2 py-1.5 text-xs outline-none focus:border-blue-600 font-mono font-bold text-blue-700 shadow-2xs"
              @input="onSellPriceChange"
            />
          </div>
        </div>
      </div>

      <!-- Info Margin & Laba Ringkas -->
      <div class="px-2.5 py-1.5 bg-gray-50 rounded border border-gray-200 flex items-center justify-between text-xs">
        <div class="flex items-center gap-1.5">
          <span class="text-[10px] text-gray-500">Laba Bersih per {{ productForm.unit || 'Satuan' }}:</span>
          <strong class="font-mono text-emerald-700 font-bold text-xs">
            +Rp {{ formatRupiah(Math.max(0, (productForm.lastSellPrice || 0) - (productForm.lastBuyPrice || 0))) }}
          </strong>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-[10px] text-gray-500">Margin:</span>
          <span class="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">
            +{{ productForm.defaultMarkupPercent || 0 }}%
          </span>
        </div>
      </div>
    </div>

    <!-- AREA 4: KULAKAN & STOK BARANG (DESAIN BERSIH & SELARAS) -->
    <div class="space-y-2 pb-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 font-bold text-gray-800 text-xs">
          <Truck :size="13" class="text-purple-600" />
          <span>{{ isExistingProduct ? 'Penambahan Stok Kulakan' : 'Stok Awal Kulakan' }}</span>
          <span v-if="!isExistingProduct" class="text-rose-600 font-bold">*</span>
        </div>
        <span
          v-if="!isExistingProduct"
          class="text-[9.5px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded"
        >
          Wajib Diisi
        </span>
        <label v-else class="flex items-center gap-1.5 cursor-pointer text-[10.5px] text-gray-600">
          <input
            v-model="isStockInboundEnabled"
            type="checkbox"
            class="w-3.5 h-3.5 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
            @change="qtyReceived = 0"
          />
          <span>Tambah Stok Masuk</span>
        </label>
      </div>

      <!-- Input Stok Masuk & Dampak Kulakan Sebaris Rapi (Tanpa Border) -->
      <div v-if="!isExistingProduct || isStockInboundEnabled" class="space-y-2">
        <!-- Baris Input Stok & Total Modal Belanja Sebaris -->
        <div class="grid grid-cols-2 gap-2">
          <!-- Kolom 1: Input Nominal Stok -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-0.5 truncate">
              {{ isExistingProduct ? 'Tambah Masuk (Qty)' : 'Jumlah Masuk' }} <span v-if="!isExistingProduct" class="text-rose-600">*</span>
            </label>
            <div class="relative flex items-center">
              <input
                v-model.number="qtyReceived"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                :class="isExistingProduct && qtyReceived > 0 ? 'pr-28' : 'pr-12'"
                class="w-full bg-[#fcfbfa] border border-gray-300 focus:border-purple-600 rounded pl-2.5 py-1.5 text-xs font-mono font-bold text-gray-900 outline-none shadow-2xs transition-colors"
              />
              <!-- Badge / Select Satuan / Info Jadi di dalam input sebelah kanan -->
              <div class="absolute right-1.5 flex items-center gap-1">
                <span
                  v-if="isExistingProduct && qtyReceived > 0"
                  class="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60"
                >
                  Jadi: {{ projectedStock }} {{ productForm.unit }}
                </span>
                <select
                  v-if="productForm.hasMultiUnits && availableInboundUnits.length > 1"
                  v-model="selectedInboundUnit"
                  class="bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-purple-900 outline-none cursor-pointer transition-colors"
                >
                  <option v-for="iu in availableInboundUnits" :key="iu.unitName" :value="iu.unitName">
                    {{ iu.unitName }}
                  </option>
                </select>
                <span
                  v-else-if="!(isExistingProduct && qtyReceived > 0)"
                  class="text-[10px] font-mono text-gray-400 font-bold px-1.5 uppercase"
                >
                  {{ productForm.unit || 'PCS' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Kolom 2: Total Modal Belanja Sebaris (Rata Kanan) -->
          <div class="flex flex-col justify-end items-end pb-1.5 text-right">
            <div class="flex items-center justify-end gap-1.5 text-xs truncate">
              <span class="text-gray-500 font-medium">Total,</span>
              <span class="font-mono font-bold text-emerald-700 text-sm">
                Rp. {{ formatRupiah(totalInboundCost) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Pintasan Cepat Qty -->
        <div class="flex items-center justify-between text-[10px] text-gray-500 pt-0.5">
          <div class="flex items-center gap-1">
            <span class="text-[9.5px] text-gray-400">Pintasan:</span>
            <button
              v-for="amt in [5, 10, 20, 50, 100]"
              :key="amt"
              type="button"
              class="px-1.5 py-0.5 text-[9.5px] font-mono font-semibold rounded bg-white hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 border border-gray-200 text-gray-700 cursor-pointer transition-colors shadow-2xs"
              @click="addQuickQty(amt)"
            >
              +{{ amt }}
            </button>
          </div>
          <button
            v-if="qtyReceived > 0"
            type="button"
            class="text-[9.5px] text-gray-400 hover:text-rose-600 hover:underline cursor-pointer"
            @click="qtyReceived = 0"
          >
            Reset 0
          </button>
        </div>

          <!-- Detail Tambahan jika Kemasan Besar (Dus/Peti) -->
          <div
            v-if="activeInboundFactor !== 1 && qtyReceived > 0"
            class="p-2 bg-purple-50/70 border border-purple-200 rounded space-y-1.5 text-xs"
          >
            <div class="flex items-center justify-between font-semibold text-gray-800 text-[11px]">
              <span>Harga Beli Modal per 1 {{ selectedInboundUnit }}:</span>
              <div class="relative w-36">
                <span class="absolute left-1.5 top-1 text-[10px] text-gray-400 font-mono">Rp</span>
                <input
                  v-model.number="inboundPackageBuyPrice"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="0"
                  class="w-full bg-white border border-gray-300 rounded pl-6 pr-2 py-0.5 text-xs font-mono font-bold text-gray-900 outline-none focus:border-purple-600"
                />
              </div>
            </div>

            <div class="flex items-center justify-between font-semibold text-gray-800 text-[11px]">
              <span class="flex items-center gap-1">
                <span>Isi per 1 {{ selectedInboundUnit }}:</span>
                <span class="text-[9.5px] text-gray-500 font-normal">(bisa diubah)</span>
              </span>
              <div class="flex items-center gap-1.5 w-36">
                <input
                  :value="activeInboundFactor"
                  type="number"
                  min="0.0001"
                  step="any"
                  class="w-full bg-white border border-gray-300 rounded px-2 py-0.5 text-xs font-mono font-bold text-gray-900 outline-none focus:border-purple-600 text-center"
                  @input="updateActiveInboundFactor(($event.target as HTMLInputElement).value)"
                />
                <span class="text-[10px] font-mono text-gray-600 shrink-0 font-bold uppercase">{{ productForm.unit }}</span>
              </div>
            </div>

            <div class="text-[10px] text-purple-900 font-mono pt-1 border-t border-purple-200/80 flex items-center justify-between">
              <span>
                Konversi: <strong>{{ qtyReceived }} {{ selectedInboundUnit }}</strong> = <strong>+{{ effectiveReceivedBaseQty }} {{ productForm.unit }}</strong>
              </span>
              <span>
                HPP = <strong>Rp {{ formatRupiah(effectiveBaseBuyPrice) }}/{{ productForm.unit }}</strong>
              </span>
            </div>
          </div>

        <!-- No Faktur / Nota Kulakan (Opsional) -->
        <div v-if="qtyReceived > 0" class="pt-2 border-t border-gray-200">
          <label class="text-[10.5px] font-semibold text-gray-600 block mb-0.5">
            No. Faktur / Nota Supplier (Opsional)
          </label>
          <input
            v-model="invoiceNumber"
            type="text"
            placeholder="Contoh: INV-2026/10/001 (Otomatis jika kosong)"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs font-mono outline-none focus:border-purple-600 shadow-2xs"
          />
        </div>
      </div>
    </div>

    <!-- AREA MULTI-SATUAN: PENJUALAN ECERAN & GROSIR (Modular Component) -->
    <ProductMultiUnitsSection
      v-model:has-multi-units="productForm.hasMultiUnits"
      :units="productForm.units"
      :base-unit="productForm.unit"
      :current-stock="productForm.currentStock"
      :last-sell-price="productForm.lastSellPrice"
    />

    <!-- AREA 5: CATATAN TAMBAHAN (OPSIONAL) -->
    <div class="pb-2">
      <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Catatan Tambahan (Opsional)</label>
      <textarea
        v-model="productForm.notes"
        rows="1"
        placeholder="Keterangan distributor, rak penyimpanan..."
        class="w-full bg-[#fcfbfa] border border-gray-300 rounded p-2 text-xs outline-none focus:border-purple-600 shadow-2xs"
      />
    </div>
  </FormSidebarDrawer>
</template>
