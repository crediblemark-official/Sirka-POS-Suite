import { dbService } from '../services/dbService';
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { PurchaseReceipt, PurchaseReceiptItem, SupplierCategory, Product } from '../types';
import { useInventoryStore } from './inventoryStore';

const STORAGE_KEY_PURCHASES = 'kasir_citra_purchases_v1';

export const usePurchaseStore = defineStore('purchase', () => {
  const inventoryStore = useInventoryStore();

  const saved = localStorage.getItem(STORAGE_KEY_PURCHASES);
  const purchaseHistory = ref<PurchaseReceipt[]>(saved ? JSON.parse(saved) : []);

  const migrationKey = 'kasir_citra_purchases_db_migrated_v1';
  async function fetchPurchases() {
    if (!localStorage.getItem(migrationKey)) {
      await dbService.importPurchases(purchaseHistory.value);
      localStorage.setItem(migrationKey, 'true');
    }
    purchaseHistory.value = await dbService.getPurchases();
    saveLocal();
  }
  let ready = fetchPurchases().then(() => true).catch(error => {
    console.warn('Riwayat kulakan belum tersinkron:', error);
    return false;
  });
  async function ensureReady() {
    if (!await ready) {
      await fetchPurchases();
      ready = Promise.resolve(true);
    }
  }

  // Form State untuk penerimaan barang aktif
  const selectedSupplier = ref<SupplierCategory>('Hari Barokah');
  const supplierInvoiceNo = ref<string>('');
  const receiptDate = ref<string>(new Date().toISOString().slice(0, 10));
  const receiptNotes = ref<string>('');
  const receivingItems = ref<PurchaseReceiptItem[]>([]);
  const showHistoryDrawer = ref<boolean>(false);
  const activeView = ref<'history' | 'form'>('history');

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_PURCHASES, JSON.stringify(purchaseHistory.value));
  }

  function addItemToReceiving(product: Product, qty = 1, customBuyPrice?: number) {
    const existing = receivingItems.value.find(i => i.productId === product.id);
    if (existing) {
      existing.qtyReceived += qty;
      existing.subtotalBuy = existing.qtyReceived * existing.buyPrice;
      return;
    }

    const buyPrice = customBuyPrice !== undefined ? customBuyPrice : product.lastBuyPrice;
    const markup = product.defaultMarkupPercent || inventoryStore.getCategoryMarkup(product.category);
    const newSellPrice = Math.round(buyPrice * (1 + markup / 100));

    receivingItems.value.push({
      id: `rcv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      unit: product.unit,
      qtyReceived: qty,
      buyPrice,
      subtotalBuy: qty * buyPrice,
      markupPercent: markup,
      newSellPrice,
    });
  }

  function updateItemQty(itemId: string, qty: number) {
    const item = receivingItems.value.find(i => i.id === itemId);
    if (item) {
      item.qtyReceived = Math.max(1, qty);
      item.subtotalBuy = item.qtyReceived * item.buyPrice;
    }
  }

  function updateItemBuyPrice(itemId: string, buyPrice: number) {
    const item = receivingItems.value.find(i => i.id === itemId);
    if (item) {
      item.buyPrice = Math.max(0, buyPrice);
      item.subtotalBuy = item.qtyReceived * item.buyPrice;
      item.newSellPrice = Math.round(item.buyPrice * (1 + item.markupPercent / 100));
    }
  }

  function updateItemMarkup(itemId: string, markup: number) {
    const item = receivingItems.value.find(i => i.id === itemId);
    if (item) {
      item.markupPercent = markup;
      item.newSellPrice = Math.round(item.buyPrice * (1 + markup / 100));
    }
  }

  function updateItemSellPrice(itemId: string, sellPrice: number) {
    const item = receivingItems.value.find(i => i.id === itemId);
    if (item) {
      item.newSellPrice = Math.max(0, sellPrice);
      if (item.buyPrice > 0) {
        item.markupPercent = Number((((item.newSellPrice - item.buyPrice) / item.buyPrice) * 100).toFixed(1));
      }
    }
  }

  function removeItem(itemId: string) {
    receivingItems.value = receivingItems.value.filter(i => i.id !== itemId);
  }

  const activeReceiptForEdit = ref<PurchaseReceipt | null>(null);

  function clearReceivingForm() {
    receivingItems.value = [];
    supplierInvoiceNo.value = '';
    receiptNotes.value = '';
    activeReceiptForEdit.value = null;
  }

  function loadReceiptForEdit(receipt: PurchaseReceipt) {
    activeReceiptForEdit.value = receipt;
    selectedSupplier.value = receipt.supplier;
    supplierInvoiceNo.value = receipt.supplierInvoiceNo;
    receiptDate.value = receipt.date;
    receiptNotes.value = receipt.notes || '';
    receivingItems.value = JSON.parse(JSON.stringify(receipt.items || []));
    showHistoryDrawer.value = true;
  }

  function openNewReceiving() {
    clearReceivingForm();
    showHistoryDrawer.value = true;
  }

  const totalBuy = computed(() =>
    receivingItems.value.reduce((acc, i) => acc + i.subtotalBuy, 0)
  );

  // Proses Simpan Penerimaan Barang Baru:
  // 1. Tambah stok barang di Inventory
  // 2. Update HPP (lastBuyPrice) & lastSellPrice di Inventory & DB
  // 3. Simpan riwayat penerimaan pembelian
  async function submitReceiving(): Promise<PurchaseReceipt | null> {
    if (receivingItems.value.length === 0) return null;

    const receipt: PurchaseReceipt = {
      id: `pr-${Date.now()}`,
      supplierInvoiceNo: supplierInvoiceNo.value || `NOTA-${selectedSupplier.value.replace(/\s+/g, '-').toUpperCase()}-${receiptDate.value.replace(/-/g, '')}`,
      date: receiptDate.value,
      supplier: selectedSupplier.value,
      items: JSON.parse(JSON.stringify(receivingItems.value)),
      totalBuy: totalBuy.value,
      notes: receiptNotes.value || undefined,
      createdAt: new Date().toISOString(),
    };

    await ensureReady();
    await dbService.savePurchase(receipt);
    await inventoryStore.fetchFromDb();

    purchaseHistory.value.unshift(receipt);
    saveLocal();
    clearReceivingForm();

    return receipt;
  }

  // Proses Perbarui Penerimaan Barang (Edit):
  // 1. Hitung selisih stok (delta) antara versi lama vs versi baru
  // 2. Update HPP & Harga Jual baru
  // 3. Simpan pembaruan nota di riwayat
  async function updateReceiving(): Promise<PurchaseReceipt | null> {
    if (!activeReceiptForEdit.value || receivingItems.value.length === 0) return null;

    const oldReceipt = activeReceiptForEdit.value;
    const updatedReceipt: PurchaseReceipt = {
      ...oldReceipt,
      supplierInvoiceNo: supplierInvoiceNo.value || oldReceipt.supplierInvoiceNo,
      date: receiptDate.value,
      supplier: selectedSupplier.value,
      items: JSON.parse(JSON.stringify(receivingItems.value)),
      totalBuy: totalBuy.value,
      notes: receiptNotes.value || undefined,
    };

    await ensureReady();
    await dbService.savePurchase(updatedReceipt);
    await inventoryStore.fetchFromDb();

    const idx = purchaseHistory.value.findIndex(p => p.id === oldReceipt.id);
    if (idx !== -1) {
      purchaseHistory.value[idx] = updatedReceipt;
    }
    saveLocal();
    clearReceivingForm();

    return updatedReceipt;
  }

  // Proses Hapus Penerimaan Barang:
  // 1. Kurangi kembali stok yang sebelumnya masuk
  // 2. Hapus nota dari purchaseHistory
  async function deleteReceipt(id: string): Promise<boolean> {
    const rcp = purchaseHistory.value.find(p => p.id === id);
    if (!rcp) return false;

    await ensureReady();
    await dbService.deletePurchase(id);
    await inventoryStore.fetchFromDb();

    purchaseHistory.value = purchaseHistory.value.filter(p => p.id !== id);
    saveLocal();

    if (activeReceiptForEdit.value?.id === id) {
      clearReceivingForm();
    }
    return true;
  }

  return {
    purchaseHistory,
    selectedSupplier,
    supplierInvoiceNo,
    receiptDate,
    receiptNotes,
    receivingItems,
    activeReceiptForEdit,
    loadReceiptForEdit,
    openNewReceiving,
    addItemToReceiving,
    updateItemQty,
    updateItemBuyPrice,
    updateItemMarkup,
    updateItemSellPrice,
    removeItem,
    clearReceivingForm,
    totalBuy,
    submitReceiving,
    updateReceiving,
    deleteReceipt,
    showHistoryDrawer,
    activeView,
  };
});
