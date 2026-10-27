import { PreOrderSchedule, BuyerName, SupplierCategory } from '@sirka/shared-types';
export declare const usePreOrderStore: import("pinia").SetupStoreDefinition<"preOrder", {
    showPreOrderSidebar: import("vue").Ref<boolean, boolean>;
    activeScheduleForSidebar: import("vue").Ref<{
        id: string;
        date: string;
        dayName: string;
        buyer: string;
        items: {
            id: string;
            productName: string;
            category: SupplierCategory;
            qty: number;
            unit: string;
            packagingNote?: string | undefined;
        }[];
        isLoadedToPos?: boolean | undefined;
    } | null, PreOrderSchedule | {
        id: string;
        date: string;
        dayName: string;
        buyer: string;
        items: {
            id: string;
            productName: string;
            category: SupplierCategory;
            qty: number;
            unit: string;
            packagingNote?: string | undefined;
        }[];
        isLoadedToPos?: boolean | undefined;
    } | null>;
    schedules: import("vue").Ref<{
        id: string;
        date: string;
        dayName: string;
        buyer: string;
        items: {
            id: string;
            productName: string;
            category: SupplierCategory;
            qty: number;
            unit: string;
            packagingNote?: string | undefined;
        }[];
        isLoadedToPos?: boolean | undefined;
    }[], PreOrderSchedule[] | {
        id: string;
        date: string;
        dayName: string;
        buyer: string;
        items: {
            id: string;
            productName: string;
            category: SupplierCategory;
            qty: number;
            unit: string;
            packagingNote?: string | undefined;
        }[];
        isLoadedToPos?: boolean | undefined;
    }[]>;
    saveLocal: () => void;
    fetchPreOrdersFromDb: () => Promise<void>;
    getSchedule: (date: string, buyer: BuyerName) => PreOrderSchedule | undefined;
    filterSchedules: (buyerFilter?: BuyerName | "Semua", categoryFilter?: SupplierCategory | "Semua") => {
        id: string;
        date: string;
        dayName: string;
        buyer: string;
        items: {
            id: string;
            productName: string;
            category: SupplierCategory;
            qty: number;
            unit: string;
            packagingNote?: string | undefined;
        }[];
        isLoadedToPos?: boolean | undefined;
    }[];
    addSchedule: (scheduleData: Omit<PreOrderSchedule, "id"> | PreOrderSchedule) => Promise<PreOrderSchedule>;
    updateSchedule: (schedule: PreOrderSchedule) => Promise<void>;
    deleteSchedule: (id: string) => Promise<void>;
}>;
//# sourceMappingURL=preOrderStore.d.ts.map