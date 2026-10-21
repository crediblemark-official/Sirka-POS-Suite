import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { StockMovement, StockAdjustmentRecord, StockMovementType, StockAdjustReason, Product } from '../types';
import { useInventoryStore } from './inventoryStore';

const STORAGE_KEY_MOVEMENTS = 'kasir_citra_stock_movements_v1';
const STORAGE_KEY_ADJUSTMENTS = 'kasir_citra_stock_adjustments_v1';

export const useStockMovementStore = defineStore('stockMovement', () => {
  const inventoryStore = useInventoryStore();

  const savedMovements = localStorage.getItem(STORAGE_KEY_MOVEMENTS);
  const movements = ref<StockMovement[]>(savedMovements ? JSON.parse(savedMovements) : []);

  const savedAdjustments = localStorage.getItem(STORAGE_KEY_ADJUSTMENTS);
  const adjustments = ref<StockAdjustmentRecord[]>(savedAdjustments ? JSON.parse(savedAdjustments) : []);

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

    const stockBefore = prod.stock || 0;
    const physical = Math.max(0, Number(params.physicalStock));
    const difference = physical - stockBefore;

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
    return true;
  }

  function openStockCard(prod: Product) {
    activeProductForCard.value = prod;
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
