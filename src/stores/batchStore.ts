import { defineStore } from 'pinia';
import { ref } from 'vue';
import { ProductBatch, BatchDeduction, Product } from '../types';
import { useInventoryStore } from './inventoryStore';

const STORAGE_KEY_BATCHES = 'kasir_citra_batches_v1';

export const useBatchStore = defineStore('batch', () => {
  const inventoryStore = useInventoryStore();

  const saved = localStorage.getItem(STORAGE_KEY_BATCHES);
  const batches = ref<ProductBatch[]>(saved ? JSON.parse(saved) : []);

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(batches.value));
  }

  /**
   * Inisialisasi batch awal untuk produk yang sudah memiliki stok namun belum ada riwayat batch
   */
  function initBatchesForExistingProducts() {
    let hasNew = false;
    for (const prod of inventoryStore.products) {
      const existing = batches.value.filter(b => b.productId === prod.id && b.remainingQty > 0);
      if (existing.length === 0 && prod.stock > 0) {
        const initialBatch: ProductBatch = {
          id: `batch-init-${prod.id}`,
          productId: prod.id,
          batchNo: `BATCH-AWAL-${prod.code}`,
          initialQty: prod.stock,
          remainingQty: prod.stock,
          buyPrice: prod.lastBuyPrice || 0,
          sellPrice: prod.lastSellPrice || 0,
          createdAt: new Date().toISOString()
        };
        batches.value.push(initialBatch);
        hasNew = true;
      }
    }
    if (hasNew) {
      saveLocal();
    }
  }

  // Jalankan inisialisasi awal
  initBatchesForExistingProducts();

  /**
   * Mengambil semua batch milik produk tertentu
   */
  function getBatchesForProduct(productId: string): ProductBatch[] {
    return batches.value.filter(b => b.productId === productId);
  }

  /**
   * Mengambil total stok aktif dari akumulasi batch
   */
  function getActiveStockFromBatches(productId: string): number {
    const list = batches.value.filter(b => b.productId === productId && b.remainingQty > 0);
    return list.reduce((acc, b) => acc + b.remainingQty, 0);
  }

  /**
   * ENGINE DEDUKSI STOK FIFO / FEFO:
   * 1. FEFO (First Expired First Out): Prioritaskan batch dengan expiry_date paling dekat.
   * 2. FIFO (First In First Out): Untuk batch tanpa expiry_date, urutkan berdasarkan created_at paling lama.
   * 3. Hitung HPP murni berdasarkan harga modal batch riil yang terpotong.
   */
  function deductFifoFefo(
    product: Product,
    requiredBaseQty: number
  ): {
    deductions: BatchDeduction[];
    totalHpp: number;
    effectiveAverageBuyPrice: number;
    isShortage: boolean;
  } {
    // Pastikan jika belum ada batch tapi stok master ada, buatkan batch awal
    initBatchesForExistingProducts();

    const availableBatches = batches.value
      .filter(b => b.productId === product.id && b.remainingQty > 0)
      .sort((a, b) => {
        // Jika keduanya punya tanggal expired: urutkan FEFO (yang mau expired keluar duluan)
        if (a.expiryDate && b.expiryDate) {
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        }
        // Jika salah satu punya expired: yang ada expired didahulukan
        if (a.expiryDate && !b.expiryDate) return -1;
        if (!a.expiryDate && b.expiryDate) return 1;

        // Jika tidak ada expired: urutkan FIFO (pertama masuk keluar duluan)
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    const deductions: BatchDeduction[] = [];
    let remainingNeeded = requiredBaseQty;
    let totalHpp = 0;

    for (const batch of availableBatches) {
      if (remainingNeeded <= 0) break;

      const qtyToTake = Math.min(batch.remainingQty, remainingNeeded);
      batch.remainingQty = Math.max(0, Number((batch.remainingQty - qtyToTake).toFixed(4)));

      deductions.push({
        batchId: batch.id,
        batchNo: batch.batchNo,
        qtyDeducted: qtyToTake,
        buyPrice: batch.buyPrice,
        expiryDate: batch.expiryDate
      });

      totalHpp += qtyToTake * batch.buyPrice;
      remainingNeeded = Number((remainingNeeded - qtyToTake).toFixed(4));
    }

    // Jika stok batch habis namun kasir tetap menjual (shortage/minus)
    const isShortage = remainingNeeded > 0;
    if (isShortage) {
      const fallbackBuyPrice = product.lastBuyPrice || 0;
      totalHpp += remainingNeeded * fallbackBuyPrice;
    }

    saveLocal();

    const effectiveAverageBuyPrice =
      requiredBaseQty > 0 ? Number((totalHpp / requiredBaseQty).toFixed(2)) : product.lastBuyPrice || 0;

    return {
      deductions,
      totalHpp,
      effectiveAverageBuyPrice,
      isShortage
    };
  }

  /**
   * Menambahkan batch baru (misal saat Kulakan/Restock diterima)
   */
  function addBatch(batchData: {
    productId: string;
    batchNo?: string;
    purchaseReceiptId?: string;
    qty: number;
    buyPrice: number;
    sellPrice?: number;
    expiryDate?: string;
  }): ProductBatch {
    const cleanBatchNo =
      batchData.batchNo ||
      `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const newBatch: ProductBatch = {
      id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: batchData.productId,
      batchNo: cleanBatchNo,
      purchaseReceiptId: batchData.purchaseReceiptId,
      initialQty: batchData.qty,
      remainingQty: batchData.qty,
      buyPrice: batchData.buyPrice,
      sellPrice: batchData.sellPrice,
      expiryDate: batchData.expiryDate || undefined,
      createdAt: new Date().toISOString()
    };

    batches.value.unshift(newBatch);
    saveLocal();
    return newBatch;
  }

  /**
   * Mengembalikan stok batch (untuk proses Retur/Refund barang yang layak jual kembali ke rak)
   */
  function restoreBatchDeductions(deductions: BatchDeduction[]) {
    for (const d of deductions) {
      const batch = batches.value.find(b => b.id === d.batchId);
      if (batch) {
        batch.remainingQty = Number((batch.remainingQty + d.qtyDeducted).toFixed(4));
      }
    }
    saveLocal();
  }

  /**
   * Penyesuaian stok rusak/afkir langsung memotong batch tertentu (Waste & Spoilage)
   */
  function deductDamagedFromBatch(batchId: string, damagedQty: number): boolean {
    const batch = batches.value.find(b => b.id === batchId);
    if (!batch) return false;

    batch.remainingQty = Math.max(0, Number((batch.remainingQty - damagedQty).toFixed(4)));
    saveLocal();
    return true;
  }

  /**
   * Memotong stok rusak/susut secara otomatis dari batch FIFO/FEFO terawal produk
   */
  function deductProductWaste(productId: string, wasteQty: number): BatchDeduction[] {
    const prod = inventoryStore.products.find(p => p.id === productId);
    if (!prod) return [];
    const deductions = deductFifoFefo(prod, wasteQty);
    saveLocal();
    return deductions.deductions;
  }

  return {
    batches,
    initBatchesForExistingProducts,
    getBatchesForProduct,
    getActiveStockFromBatches,
    deductFifoFefo,
    addBatch,
    restoreBatchDeductions,
    deductDamagedFromBatch,
    deductProductWaste,
    saveLocal
  };
});
