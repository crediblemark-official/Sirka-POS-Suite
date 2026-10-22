import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type {
  TransactionRefund,
  RefundItem,
  RefundType,
  WasteRecord,
  WasteReason,
  Transaction
} from '../types';
import { useBatchStore } from './batchStore';
import { useInventoryStore } from './inventoryStore';
import { useLedgerStore } from './ledgerStore';
import { useShiftStore } from './shiftStore';
import { useStockMovementStore } from './stockMovementStore';
import { safeParse } from '../utils/storage';

const STORAGE_KEY_REFUNDS = 'kasir_citra_refunds_v1';
const STORAGE_KEY_WASTE = 'kasir_citra_waste_v1';

export const useReturnStore = defineStore('return', () => {
  const batchStore = useBatchStore();
  const inventoryStore = useInventoryStore();
  const ledgerStore = useLedgerStore();
  const shiftStore = useShiftStore();
  const movementStore = useStockMovementStore();

  const savedRefunds = localStorage.getItem(STORAGE_KEY_REFUNDS);
  const refunds = ref<TransactionRefund[]>(safeParse<TransactionRefund[]>(savedRefunds, [], 'ReturnStore'));

  const savedWaste = localStorage.getItem(STORAGE_KEY_WASTE);
  const wasteRecords = ref<WasteRecord[]>(safeParse<WasteRecord[]>(savedWaste, [], 'ReturnStore'));

  // Modal State Controls
  const showRefundModal = ref(false);
  const activeTransactionForRefund = ref<Transaction | null>(null);
  const showWasteModal = ref(false);

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_REFUNDS, JSON.stringify(refunds.value));
    localStorage.setItem(STORAGE_KEY_WASTE, JSON.stringify(wasteRecords.value));
  }

  function openRefundModal(tx: Transaction) {
    activeTransactionForRefund.value = tx;
    showRefundModal.value = true;
  }

  function closeRefundModal() {
    activeTransactionForRefund.value = null;
    showRefundModal.value = false;
  }

  function openWasteModal() {
    showWasteModal.value = true;
  }

  function closeWasteModal() {
    showWasteModal.value = false;
  }

  /**
   * Poin 6: Proses Retur Transaksi Kasir
   * - Mendukung barang rusak (tidak masuk stok)
   * - Mendukung barang layak jual (kembali ke batch FIFO/FEFO)
   * - Mendukung koreksi salah input kasir
   * - Memotong uang kas register jika tunai
   */
  async function processRefund(params: {
    transaction: Transaction;
    refundType: RefundType;
    reason: string;
    items: RefundItem[];
    refundPaymentMethod: 'TUNAI' | 'TRANSFER';
    cashierName?: string;
  }): Promise<TransactionRefund> {
    const { transaction, refundType, reason, items, refundPaymentMethod, cashierName } = params;

    const totalRefundAmount = items.reduce((sum, it) => sum + it.refundAmount, 0);
    const refundId = `ref-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);

    const activeCashier = cashierName || shiftStore.currentShift?.cashierName || 'Kasir Toko';

    // 1. Tangani tiap item: pemulihan stok vs write-off rusak
    for (const item of items) {
      if (item.qty <= 0) continue;

      if (item.returnToStock) {
        // Layak jual / Koreksi: Kembalikan ke batch stok & inventori
        if (item.batchDeductions && item.batchDeductions.length > 0) {
          batchStore.restoreBatchDeductions(item.batchDeductions);
        }
        const prod = inventoryStore.products.find(p => p.id === item.productId);
        const stockBefore = prod?.stock ?? 0;
        await inventoryStore.updateStockAndPrice(item.productId, item.baseQty, 0, 0);
        // Catat di Kartu Stok agar jejak retur masuk terlihat
        if (prod) {
          movementStore.recordMovement({
            product: prod,
            type: 'RETUR_MASUK',
            refNo: transaction.invoiceNo,
            qtyChange: item.baseQty,
            stockBefore,
            stockAfter: prod.stock,
            costPrice: prod.lastBuyPrice,
            notes: `Retur masuk dari nota ${transaction.invoiceNo} (${item.qty} ${item.unit})`,
            operator: activeCashier
          });
        }
      } else {
        // Barang rusak / basi: Uang kembali ke pembeli, tapi barang TIDAK masuk stok aktif
        // Otomatis dicatat ke buku Waste & Spoilage sebagai kerugian barang rusak
        const prod = inventoryStore.products.find(p => p.id === item.productId);
        const estLoss = (prod?.lastBuyPrice || item.unitPrice * 0.8) * item.baseQty;

        const wasteItem: WasteRecord = {
          id: `wst-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
          productId: item.productId,
          productName: item.productName,
          category: prod?.category || 'Sembako',
          qty: item.qty,
          unit: item.unit,
          baseQty: item.baseQty,
          reason: 'RUSAK_FISIK',
          estimatedLoss: Math.round(estLoss),
          notes: `Retur dari nota ${transaction.invoiceNo}: ${reason}`,
          recordedBy: activeCashier,
          createdAt: nowIso
        };
        wasteRecords.value.unshift(wasteItem);
      }
    }

    // 2. Aliran Kas: Jika pengembalian secara tunai, kurangi kas laci kasir aktif
    if (refundPaymentMethod === 'TUNAI' && totalRefundAmount > 0) {
      shiftStore.recordRefundOutflow(totalRefundAmount, transaction.invoiceNo);
    }

    // 3. Update status transaksi di Ledger
    const targetTx = ledgerStore.transactions.find(t => t.id === transaction.id);
    if (targetTx) {
      targetTx.refundTotal = (targetTx.refundTotal || 0) + totalRefundAmount;
      const originalTotal = targetTx.finalTotal ?? targetTx.totalSell;
      if (targetTx.refundTotal >= originalTotal) {
        targetTx.refundStatus = 'FULL';
      } else {
        targetTx.refundStatus = 'PARTIAL';
      }
    }

    // 4. Buat record refund
    const refundRecord: TransactionRefund = {
      id: refundId,
      transactionId: transaction.id,
      invoiceNo: transaction.invoiceNo,
      date: todayStr,
      cashierName: activeCashier,
      refundType,
      reason,
      items,
      totalRefundAmount,
      refundPaymentMethod,
      shiftId: shiftStore.currentShift?.id,
      createdAt: nowIso
    };

    refunds.value.unshift(refundRecord);
    saveLocal();
    closeRefundModal();

    return refundRecord;
  }

  /**
   * Poin 7: Penyesuaian Barang Rusak / Susut / Expired (Waste & Spoilage)
   * Mengurangi stok batch FIFO/FEFO tanpa menghasilkan penjualan kasir
   */
  async function recordWaste(payload: {
    productId: string;
    productName: string;
    category?: any;
    qty: number;
    unit: string;
    baseQty: number;
    reason: WasteReason;
    notes?: string;
    recordedBy?: string;
  }): Promise<WasteRecord> {
    const prod = inventoryStore.products.find(p => p.id === payload.productId);
    const category = payload.category || prod?.category || 'Sembako';
    const unitPrice = prod?.lastBuyPrice || 0;
    const estLoss = Math.round(unitPrice * payload.baseQty);
    const nowIso = new Date().toISOString();
    const actor = payload.recordedBy || shiftStore.currentShift?.cashierName || 'Supervisor Gudang';

    // 1. Deduksi dari batch FIFO/FEFO terawal
    batchStore.deductProductWaste(payload.productId, payload.baseQty);

    // 2. Kurangi stok fisik di master barang
    const stockBefore = prod?.stock || 0;
    await inventoryStore.updateStockAndPrice(payload.productId, -payload.baseQty, 0, 0);

    const movementStore = useStockMovementStore();
    if (prod) {
      movementStore.recordMovement({
        product: prod,
        type: 'RUSAK_WASTE',
        refNo: `WST-${Date.now().toString().slice(-4)}`,
        qtyChange: -payload.baseQty,
        stockBefore,
        stockAfter: Math.max(0, stockBefore - payload.baseQty),
        costPrice: unitPrice,
        notes: `Barang Rusak/Susut: ${payload.reason}${payload.notes ? ` - ${payload.notes}` : ''}`,
        operator: actor
      });
    }

    // 3. Simpan record waste
    const wasteRecord: WasteRecord = {
      id: `wst-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      productId: payload.productId,
      productName: payload.productName,
      category,
      qty: payload.qty,
      unit: payload.unit,
      baseQty: payload.baseQty,
      reason: payload.reason,
      estimatedLoss: estLoss,
      notes: payload.notes || '',
      recordedBy: actor,
      createdAt: nowIso
    };

    wasteRecords.value.unshift(wasteRecord);
    saveLocal();
    closeWasteModal();

    return wasteRecord;
  }

  // Ringkasan Statistik Audit
  const totalRefundsValue = computed(() =>
    refunds.value.reduce((acc, r) => acc + r.totalRefundAmount, 0)
  );

  const totalWasteLoss = computed(() =>
    wasteRecords.value.reduce((acc, w) => acc + w.estimatedLoss, 0)
  );

  return {
    refunds,
    wasteRecords,
    showRefundModal,
    activeTransactionForRefund,
    showWasteModal,
    totalRefundsValue,
    totalWasteLoss,
    openRefundModal,
    closeRefundModal,
    openWasteModal,
    closeWasteModal,
    processRefund,
    recordWaste
  };
});
