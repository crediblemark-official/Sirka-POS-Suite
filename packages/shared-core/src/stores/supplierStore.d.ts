import { Supplier } from '@sirka/shared-types';
export declare const useSupplierStore: import("pinia").SetupStoreDefinition<"supplier", {
    suppliers: import("vue").Ref<{
        id: string;
        name: string;
        phone?: string | undefined;
        contactPerson?: string | undefined;
        address?: string | undefined;
        notes?: string | undefined;
        createdAt?: string | undefined;
    }[], Supplier[] | {
        id: string;
        name: string;
        phone?: string | undefined;
        contactPerson?: string | undefined;
        address?: string | undefined;
        notes?: string | undefined;
        createdAt?: string | undefined;
    }[]>;
    showSupplierDrawer: import("vue").Ref<boolean, boolean>;
    activeSupplierForDrawer: import("vue").Ref<{
        id: string;
        name: string;
        phone?: string | undefined;
        contactPerson?: string | undefined;
        address?: string | undefined;
        notes?: string | undefined;
        createdAt?: string | undefined;
    } | null, Supplier | {
        id: string;
        name: string;
        phone?: string | undefined;
        contactPerson?: string | undefined;
        address?: string | undefined;
        notes?: string | undefined;
        createdAt?: string | undefined;
    } | null>;
    getSupplierByName: (name: string) => Supplier | undefined;
    getSupplierById: (id: string) => Supplier | undefined;
    addSupplier: (data: Omit<Supplier, "id" | "createdAt">) => Supplier;
    updateSupplier: (id: string, updates: Partial<Omit<Supplier, "id" | "createdAt">>) => void;
    deleteSupplier: (id: string) => void;
}>;
//# sourceMappingURL=supplierStore.d.ts.map