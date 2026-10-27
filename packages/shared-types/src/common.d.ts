export type BuyerName = string;
export type SupplierCategory = string;
export type CategoryName = string;
export type CustomerType = 'B2B' | 'B2C';
export type PaymentStatus = 'LUNAS' | 'TEMPO';
export type PaymentMethod = 'Transfer Bank' | 'Tunai / Kas' | 'QRIS' | 'Nota Tempo';
export interface StoreSetting {
    key: string;
    value: string;
}
export interface CategoryMarkupSetting {
    category: SupplierCategory;
    defaultMarkupPercent: number;
    description: string;
    color?: string;
}
//# sourceMappingURL=common.d.ts.map