import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { StockMovement, StockAdjustmentRecord, StockMovementType, StockAdjustReason, Product } from '@sirka/shared-types';
import { useInventoryStore } from './inventoryStore';
import { useBatchStore } from './batchStore';
import { dbService } from '../services/dbService';
import { syncService } from '../services/syncService';

const STORAGE_KEY_MOVEMENTS = 'kasir_citra_stock_movements_v1';
const STORAGE_KEY_ADJUSTMENTS = 'kasir_citra_stock_adjustments_v1';

/**
 * BUG FIX: helper parsing localStorage yang aman.
 * JSON.parse tanpa try/catch membuat 1 nilai korup mematikan boot aplikasi.
 */
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch (e) {
    console.warn('[StockMovement] Gagal parse localStorage, memakai nilai default:', e);
    return fallback;
  }
}

export const useStockMovementStore = defineStore('stockMovement', () => {
  const inventoryStore = useInventoryStore();

  const savedMovements = localStorage.getItem(STORAGE_KEY_MOVEMENTS);
  const movements = ref<StockMovement[]>(safeParse<StockMovement[]>(savedMovements, []));

  const savedAdjustments = localStorage.getItem(STORAGE_KEY_ADJUSTMENTS);
  const adjustments = ref<StockAdjustmentRecord[]>(safeParse<StockAdjustmentRecord[]>(savedAdjustments, []));

  // UI state untuk Drawer & Modal
  const isStockCardOpen = ref(false);
  const activeProductForCard = ref<Product | null>(null);

  const isAdjustModalOpen = ref(false);
  const activeProductForAdjust = ref<Product | null>(null);

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_MOVEMENTS, JSON.stringify(movements.value));
    localStorage.setItem(STORAGE_KEY_ADJUSTMENTS, JSON.stringify(adjustments.value));
  }

  function recordMovement(params: {
    product: Product;
    type: StockMovementType;
    refNo: string;
    qtyChange: number;
    stockBefore: number;
    stockAfter: number;
    costPrice?: number;
    notes?: string;
    operator?: string;
    date?: string;
  }): StockMovement {
    const record: StockMovement = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: params.product.id,
      productName: params.product.name,
      productCode: params.product.code,
      category: params.product.category,
      unit: params.product.unit,
      type: params.type,
      refNo: params.refNo,
      date: params.date || new Date().toISOString(),
      qtyChange: params.qtyChange,
      stockBefore: params.stockBefore,
      stockAfter: params.stockAfter,
      costPrice: params.costPrice ?? params.product.lastBuyPrice,
      notes: params.notes,
      operator: params.operator || 'Kasir',
      createdAt: new Date().toISOString()
    };

    movements.value.unshift(record);
    saveLocal();
    return record;
  }

  async function adjustStock(params: {
    productId: string;
    physicalStock: number;
    reason: StockAdjustReason;
    notes?: string;
    adjustedBy?: string;
  }): Promise<boolean> {
    const prod = inventoryStore.products.find(p => p.id === params.productId);
    if (!prod) return false;

    // BUG FIX: input kosong / teks tidak valid menghasilkan NaN yang membuat
    // `prod.stock` jadi NaN dan meracuni seluruh perhitungan inventori.
    const raw = Number(params.physicalStock);
    if (!Number.isFinite(raw)) {
      console.warn('[StockMovement] physicalStock tidak valid, penyesuaian dibatalkan:', params.physicalStock);
      return false;
    }
    const physical = Math.max(0, raw);
    const stockBefore = prod.stock || 0;
    const difference = physical - stockBefore;
    if (difference === 0) {
      // Tidak ada selisih -> tidak perlu penyesuaian
      return false;
    }

    const adjRecord: StockAdjustmentRecord = {
      id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: prod.id,
      productName: prod.name,
      systemStock: stockBefore,
      physicalStock: physical,
      difference,
      reason: params.reason,
      notes: params.notes,
      adjustedBy: params.adjustedBy || 'Owner / Kasir',
      createdAt: new Date().toISOString()
    };
    adjustments.value.unshift(adjRecord);

    prod.stock = physical;
    inventoryStore.saveLocal();

    recordMovement({
      product: prod,
      type: 'PENYESUAIAN_OPNAME',
      refNo: adjRecord.id.toUpperCase(),
      qtyChange: difference,
      stockBefore,
      stockAfter: physical,
      costPrice: prod.lastBuyPrice,
      notes: `Alasan: ${params.reason}${params.notes ? ` - ${params.notes}` : ''}`,
      operator: params.adjustedBy || 'Owner / Kasir'
    });

    saveLocal();

    // BUG FIX: penyesuaian stok WAJIB disimpan ke database. Sebelumnya hanya
    // localStorage sehingga setiap `fetchFromDb()` (setiap penjualan/pembelian)
    // mengembalikan stok ke nilai lama dan penyesuaian hilang.
    try {
      await dbService.updateStockAndPrice(prod.id, difference, 0, 0);
    } catch (err) {
      console.warn('[Sync] Offline: enqueued stock adjustment for sync:', err);
      syncService.enqueue('UPDATE_STOCK_AND_PRICE', {
        productId: prod.id,
        addedStock: difference,
        buyPrice: 0,
        sellPrice: 0
      });
    }

    // Sinkronkan batch FIFO/FEFO agar remainingQty tidak lagi berbeda dengan
    // stok master (batch = sumber kebenaran HPP).
    try {
      const batchStore = useBatchStore();
      batchStore.syncStockWithBatches(prod.id, physical);
    } catch (err) {
      console.warn('[StockMovement] Gagal sinkronkan batch FIFO:', err);
    }

    return true;
  }

  function openStockCard(prod?: Product | null) {
    activeProductForCard.value = prod || null;
    isStockCardOpen.value = true;
  }

  function closeStockCard() {
    isStockCardOpen.value = false;
    activeProductForCard.value = null;
  }

  function openAdjustModal(prod?: Product) {
    activeProductForAdjust.value = prod || null;
    isAdjustModalOpen.value = true;
  }

  function closeAdjustModal() {
    isAdjustModalOpen.value = false;
    activeProductForAdjust.value = null;
  }

  function getProductMovements(productId: string): StockMovement[] {
    return movements.value.filter(m => m.productId === productId);
  }

  const recentMovements = computed(() => movements.value.slice(0, 100));

  return {
    movements,
    adjustments,
    isStockCardOpen,
    activeProductForCard,
    isAdjustModalOpen,
    activeProductForAdjust,
    recordMovement,
    adjustStock,
    openStockCard,
    closeStockCard,
    openAdjustModal,
    closeAdjustModal,
    getProductMovements,
    recentMovements,
    saveLocal
  };
});
