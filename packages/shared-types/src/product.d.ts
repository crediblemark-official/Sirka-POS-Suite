import type { SupplierCategory } from './common';
export interface ProductUnitConversion {
    id: string;
    unitName: string;
    conversionFactor: number;
    parentUnitName?: string;
    sellPrice?: number;
    barcode?: string;
}
export interface BatchDeduction {
    batchId: string;
    batchNo: string;
    qtyDeducted: number;
    buyPrice: number;
    expiryDate?: string;
}
export interface ProductBatch {
    id: string;
    productId: string;
    batchNo: string;
    purchaseReceiptId?: string;
    initialQty: number;
    remainingQty: number;
    buyPrice: number;
    sellPrice?: number;
    expiryDate?: string;
    createdAt: string;
}
export type ProductType = 'GOODS' | 'SERVICE' | 'FNB_MENU';
export interface ProductTierPrice {
    minQty: number;
    price: number;
    label?: string;
}
export interface Product {
    id: string;
    code: string;
    name: string;
    category: SupplierCategory;
    supplier?: string;
    unit: string;
    defaultMarkupPercent: number;
    lastBuyPrice: number;
    lastSellPrice: number;
    stock: number;
    barcode?: string;
    notes?: string;
    units?: ProductUnitConversion[];
    isPerishable?: boolean;
    productType?: ProductType;
    tierPricing?: ProductTierPrice[];
    availableModifiers?: string[];
    serviceDurationMinutes?: number;
}
//# sourceMappingURL=product.d.ts.map