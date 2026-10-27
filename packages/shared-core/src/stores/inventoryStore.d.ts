import { Product, CategoryMarkupSetting, SupplierCategory } from '@sirka/shared-types';
export declare const useInventoryStore: import("pinia").SetupStoreDefinition<"inventory", {
    showProductSidebar: import("vue").Ref<boolean, boolean>;
    activeProductForSidebar: import("vue").Ref<{
        id: string;
        code: string;
        name: string;
        category: SupplierCategory;
        supplier?: string | undefined;
        unit: string;
        defaultMarkupPercent: number;
        lastBuyPrice: number;
        lastSellPrice: number;
        stock: number;
        barcode?: string | undefined;
        notes?: string | undefined;
        units?: {
            id: string;
            unitName: string;
            conversionFactor: number;
            parentUnitName?: string | undefined;
            sellPrice?: number | undefined;
            barcode?: string | undefined;
        }[] | undefined;
        isPerishable?: boolean | undefined;
        productType?: import("@sirka/shared-types").ProductType | undefined;
        tierPricing?: {
            minQty: number;
            price: number;
            label?: string | undefined;
        }[] | undefined;
        availableModifiers?: string[] | undefined;
        serviceDurationMinutes?: number | undefined;
    } | null, Product | {
        id: string;
        code: string;
        name: string;
        category: SupplierCategory;
        supplier?: string | undefined;
        unit: string;
        defaultMarkupPercent: number;
        lastBuyPrice: number;
        lastSellPrice: number;
        stock: number;
        barcode?: string | undefined;
        notes?: string | undefined;
        units?: {
            id: string;
            unitName: string;
            conversionFactor: number;
            parentUnitName?: string | undefined;
            sellPrice?: number | undefined;
            barcode?: string | undefined;
        }[] | undefined;
        isPerishable?: boolean | undefined;
        productType?: import("@sirka/shared-types").ProductType | undefined;
        tierPricing?: {
            minQty: number;
            price: number;
            label?: string | undefined;
        }[] | undefined;
        availableModifiers?: string[] | undefined;
        serviceDurationMinutes?: number | undefined;
    } | null>;
    showVendorSidebar: import("vue").Ref<boolean, boolean>;
    activeVendorForSidebar: import("vue").Ref<{
        category: SupplierCategory;
        defaultMarkupPercent: number;
        description: string;
        color?: string | undefined;
    } | null, CategoryMarkupSetting | {
        category: SupplierCategory;
        defaultMarkupPercent: number;
        description: string;
        color?: string | undefined;
    } | null>;
    products: import("vue").Ref<{
        id: string;
        code: string;
        name: string;
        category: SupplierCategory;
        supplier?: string | undefined;
        unit: string;
        defaultMarkupPercent: number;
        lastBuyPrice: number;
        lastSellPrice: number;
        stock: number;
        barcode?: string | undefined;
        notes?: string | undefined;
        units?: {
            id: string;
            unitName: string;
            conversionFactor: number;
            parentUnitName?: string | undefined;
            sellPrice?: number | undefined;
            barcode?: string | undefined;
        }[] | undefined;
        isPerishable?: boolean | undefined;
        productType?: import("@sirka/shared-types").ProductType | undefined;
        tierPricing?: {
            minQty: number;
            price: number;
            label?: string | undefined;
        }[] | undefined;
        availableModifiers?: string[] | undefined;
        serviceDurationMinutes?: number | undefined;
    }[], Product[] | {
        id: string;
        code: string;
        name: string;
        category: SupplierCategory;
        supplier?: string | undefined;
        unit: string;
        defaultMarkupPercent: number;
        lastBuyPrice: number;
        lastSellPrice: number;
        stock: number;
        barcode?: string | undefined;
        notes?: string | undefined;
        units?: {
            id: string;
            unitName: string;
            conversionFactor: number;
            parentUnitName?: string | undefined;
            sellPrice?: number | undefined;
            barcode?: string | undefined;
        }[] | undefined;
        isPerishable?: boolean | undefined;
        productType?: import("@sirka/shared-types").ProductType | undefined;
        tierPricing?: {
            minQty: number;
            price: number;
            label?: string | undefined;
        }[] | undefined;
        availableModifiers?: string[] | undefined;
        serviceDurationMinutes?: number | undefined;
    }[]>;
    categoryMarkups: import("vue").Ref<{
        category: SupplierCategory;
        defaultMarkupPercent: number;
        description: string;
        color?: string | undefined;
    }[], CategoryMarkupSetting[] | {
        category: SupplierCategory;
        defaultMarkupPercent: number;
        description: string;
        color?: string | undefined;
    }[]>;
    isConnectedToPg: import("vue").Ref<boolean, boolean>;
    fetchFromDb: () => Promise<void>;
    getCategoryMarkup: (category: SupplierCategory) => number;
    getCategoryColor: (category: SupplierCategory) => string | undefined;
    updateCategoryMarkup: (category: SupplierCategory, percent: number) => Promise<void>;
    updateCategory: (category: SupplierCategory, updates: Partial<CategoryMarkupSetting>) => Promise<void>;
    addCategory: (category: string, defaultMarkupPercent?: number, description?: string, color?: string) => Promise<void>;
    deleteCategory: (category: string) => Promise<boolean>;
    updateProductPrices: (productId: string, lastBuyPrice: number, lastSellPrice: number) => Promise<void>;
    updateStockAndPrice: (productId: string, addedStock: number, buyPrice: number, sellPrice: number) => Promise<void>;
    addProduct: (newProd: Omit<Product, "id"> & {
        id?: string;
    }) => Promise<Product>;
    updateProduct: (product: Product) => Promise<void>;
    deleteProduct: (id: string) => Promise<boolean>;
    resetToDefaults: () => void;
    deductStock: (productId: string, qtyToDeduct: number, lastSellPrice?: number) => {
        product: Product;
        stockBefore: number;
        stockAfter: number;
    } | null;
    restoreStock: (productId: string, qtyToRestore: number) => {
        product: Product;
        stockBefore: number;
        stockAfter: number;
    } | null;
    saveLocal: () => void;
}>;
//# sourceMappingURL=inventoryStore.d.ts.map