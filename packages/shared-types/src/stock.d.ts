import type { SupplierCategory } from './common';
export type WasteReason = 'BUSUK' | 'EXPIRED' | 'RUSAK_FISIK' | 'SUSUT_TIMBANGAN' | 'LAINNYA';
export interface WasteRecord {
    id: string;
    productId: string;
    productName: string;
    category: SupplierCategory;
    qty: number;
    unit: string;
    baseQty: number;
    reason: WasteReason;
    estimatedLoss: number;
    notes?: string;
    recordedBy: string;
    createdAt: string;
}
export type StockMovementType = 'KULAKAN' | 'PENJUALAN' | 'RETUR_MASUK' | 'RUSAK_WASTE' | 'PENYESUAIAN_OPNAME' | 'STOK_AWAL';
export type StockAdjustReason = 'SELISIH_HITUNG' | 'HILANG' | 'RUSAK_KADALUWARSA' | 'BONUS_SUPPLIER' | 'AWAL_MIGRASI' | 'LAINNYA';
export interface StockMovement {
    id: string;
    productId: string;
    productName: string;
    productCode: string;
    category: SupplierCategory;
    unit: string;
    type: StockMovementType;
    refNo: string;
    date: string;
    qtyChange: number;
    stockBefore: number;
    stockAfter: number;
    costPrice?: number;
    notes?: string;
    operator?: string;
    createdAt: string;
}
export interface StockAdjustmentRecord {
    id: string;
    productId: string;
    productName: string;
    systemStock: number;
    physicalStock: number;
    difference: number;
    reason: StockAdjustReason;
    notes?: string;
    adjustedBy: string;
    createdAt: string;
}
//# sourceMappingURL=stock.d.ts.map