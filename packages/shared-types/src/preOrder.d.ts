import type { SupplierCategory } from './common';
export interface PreOrderItem {
    id: string;
    productName: string;
    category: SupplierCategory;
    qty: number;
    unit: string;
    packagingNote?: string;
}
export interface PreOrderSchedule {
    id: string;
    date: string;
    dayName: string;
    buyer: string;
    items: PreOrderItem[];
    isLoadedToPos?: boolean;
}
//# sourceMappingURL=preOrder.d.ts.map