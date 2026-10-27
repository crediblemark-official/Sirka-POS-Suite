import { CategoryMarkupSetting, Product, Buyer, Discount, PreOrderSchedule, Supplier } from '@sirka/shared-types';
export interface DemoDataPayload {
    version?: string;
    categoryMarkups?: CategoryMarkupSetting[];
    products?: Product[];
    buyers?: Buyer[];
    discounts?: Discount[];
    preOrders?: PreOrderSchedule[];
    suppliers?: Supplier[];
}
export declare const demoDataService: {
    /**
     * Mengambil file eksternal /demo-data.json dari folder public
     */
    fetchDemoData(): Promise<DemoDataPayload>;
    /**
     * Mengisi database dengan data demo dari file eksternal /demo-data.json (atau payload kustom)
     */
    loadDemoData(customPayload?: DemoDataPayload): Promise<void>;
    /**
     * Mengosongkan seluruh database (Fresh Clean / 0 data)
     */
    resetAllDataToFresh(wipeCloud?: boolean): Promise<void>;
    /**
     * Helper untuk menyegarkan seluruh store
     */
    refreshAllStores(): Promise<void>;
};
//# sourceMappingURL=demoDataService.d.ts.map