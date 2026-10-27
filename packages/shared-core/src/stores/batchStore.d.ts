import { ProductBatch, BatchDeduction, Product } from '@sirka/shared-types';
export declare const useBatchStore: import("pinia").SetupStoreDefinition<"batch", {
    batches: import("vue").Ref<{
        id: string;
        productId: string;
        batchNo: string;
        purchaseReceiptId?: string | undefined;
        initialQty: number;
        remainingQty: number;
        buyPrice: number;
        sellPrice?: number | undefined;
        expiryDate?: string | undefined;
        createdAt: string;
    }[], ProductBatch[] | {
        id: string;
        productId: string;
        batchNo: string;
        purchaseReceiptId?: string | undefined;
        initialQty: number;
        remainingQty: number;
        buyPrice: number;
        sellPrice?: number | undefined;
        expiryDate?: string | undefined;
        createdAt: string;
    }[]>;
    initBatchesForExistingProducts: () => void;
    getBatchesForProduct: (productId: string) => ProductBatch[];
    getActiveStockFromBatches: (productId: string) => number;
    deductFifoFefo: (product: Product, requiredBaseQty: number) => {
        deductions: BatchDeduction[];
        totalHpp: number;
        effectiveAverageBuyPrice: number;
        isShortage: boolean;
    };
    addBatch: (batchData: {
        productId: string;
        batchNo?: string;
        purchaseReceiptId?: string;
        qty: number;
        buyPrice: number;
        sellPrice?: number;
        expiryDate?: string;
    }) => ProductBatch;
    restoreBatchDeductions: (deductions: BatchDeduction[]) => void;
    deductDamagedFromBatch: (batchId: string, damagedQty: number) => boolean;
    deductProductWaste: (productId: string, wasteQty: number) => BatchDeduction[];
    syncStockWithBatches: (productId: string, physicalStock: number) => boolean;
    removeBatchesForReceipt: (receiptId: string) => number;
    saveLocal: () => void;
}>;
//# sourceMappingURL=batchStore.d.ts.map