import { dbService } from '../services/dbService';
import { syncService } from '../services/syncService';
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { PurchaseReceipt, PurchaseReceiptItem, Product } from '../types';
import { useInventoryStore } from './inventoryStore';
import { useBatchStore } from './batchStore';
import { useSupplierStore } from './supplierStore';
import { useStockMovementStore } from './stockMovementStore';

const STORAGE_KEY_PURCHASES = 'kasir_citra_purchases_v1';

export const usePurchaseStore = defineStore('purchase', () => {
  const inventoryStore = useInventoryStore();
  const batchStore = useBatchStore();
  const supplierStore = useSupplierStore();

  const saved = localStorage.getItem(STORAGE_KEY_PURCHASES);
  const purchaseHistory = ref<PurchaseReceipt[]>(saved ? JSON.parse(saved) : []);

  async function fetchPurchases() {
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

  // Form State untuk penerimaan barang aktif (Dinamis dari master supplier yang terdaftar)
  const selectedSupplier = ref<string>(
    supplierStore.suppliers[0]?.name || ''
  );

  watch(
    () => supplierStore.suppliers,
    (supps) => {
      if (supps.length > 0) {
        const exists = supps.some(s => s.name === selectedSupplier.value);
        if (!exists) {
          selectedSupplier.value = supps[0].name;
        }
      }
    },
    { immediate: true }
  );

  const supplierInvoiceNo = ref<string>('');
  const receiptDate = ref<string>(new Date().toISOString().slice(0, 10));
  const receiptNotes = ref<string>('');
  const receivingItems = ref<PurchaseReceiptItem[]>([]);
  const showHistoryDrawer = ref<boolean>(false);
  const activeView = ref<'history' | 'form'>('history');

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_PURCHASES, JSON.stringify(purchaseHistory.value));
  }

  function addItemToReceiving(product: Product, qty = 1, customBuyPrice?: number, customSellPrice?: number, expiryDate?: string) {
    const existing = receivingItems.value.find(i => i.productId === product.id);
    if (existing) {
      existing.qtyReceived += qty;
      existing.subtotalBuy = existing.qtyReceived * existing.buyPrice;
      if (expiryDate) existing.expiryDate = expiryDate;
      if (customSellPrice !== undefined && customSellPrice > 0) {
        existing.newSellPrice = customSellPrice;
        if (existing.buyPrice > 0) {
          existing.markupPercent = Number((((existing.newSellPrice - existing.buyPrice) / existing.buyPrice) * 100).toFixed(1));
        }
      }
      return;
    }

    const buyPrice = customBuyPrice !== undefined ? customBuyPrice : product.lastBuyPrice;
    let newSellPrice = customSellPrice !== undefined && customSellPrice > 0 
      ? customSellPrice 
      : product.lastSellPrice || 0;
    
    let markup = product.defaultMarkupPercent || inventoryStore.getCategoryMarkup(product.category);
    if (newSellPrice > 0 && buyPrice > 0) {
      markup = Number((((newSellPrice - buyPrice) / buyPrice) * 100).toFixed(1));
    } else if (newSellPrice === 0 && buyPrice > 0) {
      newSellPrice = Math.round(buyPrice * (1 + markup / 100));
    }

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
      expiryDate,
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

    // Local-First: Simpan ke riwayat lokal & terapkan stok & HPP ke produk lokal langsung
    purchaseHistory.value.unshift(receipt);
    const movementStore = useStockMovementStore();
    for (const item of receipt.items) {
      const prod = inventoryStore.products.find(p => p.id === item.productId);
      if (prod) {
        const stockBefore = prod.stock;
        prod.stock += item.qtyReceived;
        if (item.buyPrice > 0) prod.lastBuyPrice = item.buyPrice;
        if (item.newSellPrice > 0) prod.lastSellPrice = item.newSellPrice;

        movementStore.recordMovement({
          product: prod,
          type: 'KULAKAN',
          refNo: receipt.supplierInvoiceNo || receipt.id,
          qtyChange: item.qtyReceived,
          stockBefore,
          stockAfter: prod.stock,
          costPrice: item.buyPrice,
          notes: `Kulakan dari ${receipt.supplier}`,
          operator: 'Kasir / Admin'
        });
      }

      // Catat Batch FIFO/FEFO Baru
      batchStore.addBatch({
        productId: item.productId,
        batchNo: item.batchNo,
        purchaseReceiptId: receipt.id,
        qty: item.qtyReceived,
        buyPrice: item.buyPrice,
        sellPrice: item.newSellPrice,
        expiryDate: item.expiryDate
      });
    }
    inventoryStore.saveLocal();
    saveLocal();
    clearReceivingForm();

    try {
      await ensureReady();
      await dbService.savePurchase(receipt);
      await inventoryStore.fetchFromDb().catch(() => {});
    } catch (err) {
      console.warn('[Sync] Offline: enqueued purchase receipt for sync:', err);
      syncService.enqueue('SAVE_PURCHASE', { receipt });
    }

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

    const idx = purchaseHistory.value.findIndex(p => p.id === oldReceipt.id);
    if (idx !== -1) {
      purchaseHistory.value[idx] = updatedReceipt;
    }

    // Local-First: Rollback stok lama dan terapkan stok & harga baru di memori
    for (const item of oldReceipt.items) {
      const prod = inventoryStore.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.qtyReceived);
      }
    }
    for (const item of updatedReceipt.items) {
      const prod = inventoryStore.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock += item.qtyReceived;
        if (item.buyPrice > 0) prod.lastBuyPrice = item.buyPrice;
        if (item.newSellPrice > 0) prod.lastSellPrice = item.newSellPrice;
      }
    }
    inventoryStore.saveLocal();
    saveLocal();
    clearReceivingForm();

    try {
      await ensureReady();
      await dbService.savePurchase(updatedReceipt);
      await inventoryStore.fetchFromDb().catch(() => {});
    } catch (err) {
      console.warn('[Sync] Offline: enqueued update purchase for sync:', err);
      syncService.enqueue('SAVE_PURCHASE', { receipt: updatedReceipt });
    }

    return updatedReceipt;
  }

  // Proses Hapus Penerimaan Barang:
  // 1. Kurangi kembali stok yang sebelumnya masuk
  // 2. Hapus nota dari purchaseHistory
  async function deleteReceipt(id: string): Promise<boolean> {
    const rcp = purchaseHistory.value.find(p => p.id === id);
    if (!rcp) return false;

    // Rollback stok lokal
    for (const item of rcp.items) {
      const prod = inventoryStore.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, prod.stock - item.qtyReceived);
      }
    }
    inventoryStore.saveLocal();

    purchaseHistory.value = purchaseHistory.value.filter(p => p.id !== id);
    saveLocal();

    if (activeReceiptForEdit.value?.id === id) {
      clearReceivingForm();
    }

    try {
      await ensureReady();
      await dbService.deletePurchase(id);
      await inventoryStore.fetchFromDb().catch(() => {});
    } catch (err) {
      console.warn('[Sync] Offline: enqueued delete purchase for sync:', err);
      syncService.enqueue('DELETE_PURCHASE', { id });
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
    fetchPurchases,
    ensureReady,
    saveLocal
  };
});
