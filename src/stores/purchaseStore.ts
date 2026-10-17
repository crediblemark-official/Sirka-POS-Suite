import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { PurchaseReceipt, PurchaseReceiptItem, SupplierCategory, Product } from '../types';
import { useInventoryStore } from './inventoryStore';

const STORAGE_KEY_PURCHASES = 'kasir_citra_purchases_v1';

export const usePurchaseStore = defineStore('purchase', () => {
  const inventoryStore = useInventoryStore();

  const saved = localStorage.getItem(STORAGE_KEY_PURCHASES);
  const purchaseHistory = ref<PurchaseReceipt[]>(saved ? JSON.parse(saved) : []);

  // Form State untuk penerimaan barang aktif
  const selectedSupplier = ref<SupplierCategory>('Hari Barokah');
  const supplierInvoiceNo = ref<string>('');
  const receiptDate = ref<string>(new Date().toISOString().slice(0, 10));
  const receiptNotes = ref<string>('');
  const receivingItems = ref<PurchaseReceiptItem[]>([]);

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

  function clearReceivingForm() {
    receivingItems.value = [];
    supplierInvoiceNo.value = '';
    receiptNotes.value = '';
  }

  const totalBuy = computed(() =>
    receivingItems.value.reduce((acc, i) => acc + i.subtotalBuy, 0)
  );

  // Proses Simpan Penerimaan Barang:
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

    // Update stok dan HPP di inventory
    for (const item of receivingItems.value) {
      const prod = inventoryStore.products.find(p => p.id === item.productId);
      if (prod) {
        prod.stock += item.qtyReceived;
        prod.lastBuyPrice = item.buyPrice;
        prod.lastSellPrice = item.newSellPrice;
      }
      // Update PostgreSQL
      inventoryStore.updateProductPrices(item.productId, item.buyPrice, item.newSellPrice);
    }

    purchaseHistory.value.unshift(receipt);
    saveLocal();
    clearReceivingForm();

    return receipt;
  }

  return {
    purchaseHistory,
    selectedSupplier,
    supplierInvoiceNo,
    receiptDate,
    receiptNotes,
    receivingItems,
    addItemToReceiving,
    updateItemQty,
    updateItemBuyPrice,
    updateItemMarkup,
    updateItemSellPrice,
    removeItem,
    clearReceivingForm,
    totalBuy,
    submitReceiving,
  };
});
