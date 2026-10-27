import type { SupplierCategory } from './common';
export interface PurchaseReceiptItem {
    id: string;
    productId: string;
    code: string;
    name: string;
    category: SupplierCategory;
    unit: string;
    qtyReceived: number;
    baseQty?: number;
    conversionFactor?: number;
    buyPrice: number;
    subtotalBuy: number;
    markupPercent: number;
    newSellPrice: number;
    expiryDate?: string;
    batchNo?: string;
}
export interface PurchaseReceipt {
    id: string;
    supplierInvoiceNo: string;
    date: string;
    supplier: SupplierCategory;
    items: PurchaseReceiptItem[];
    totalBuy: number;
    notes?: string;
    createdAt: string;
}
//# sourceMappingURL=purchase.d.ts.map