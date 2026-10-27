import { MasterUnit, UnitCategory } from '@sirka/shared-types';
export declare const useUnitStore: import("pinia").SetupStoreDefinition<"unit", {
    units: import("vue").Ref<{
        id: string;
        name: string;
        category: UnitCategory;
        description?: string | undefined;
        defaultContent?: number | undefined;
        isDefault?: boolean | undefined;
    }[], MasterUnit[] | {
        id: string;
        name: string;
        category: UnitCategory;
        description?: string | undefined;
        defaultContent?: number | undefined;
        isDefault?: boolean | undefined;
    }[]>;
    baseUnits: import("vue").ComputedRef<{
        id: string;
        name: string;
        category: UnitCategory;
        description?: string | undefined;
        defaultContent?: number | undefined;
        isDefault?: boolean | undefined;
    }[]>;
    packagingUnits: import("vue").ComputedRef<{
        id: string;
        name: string;
        category: UnitCategory;
        description?: string | undefined;
        defaultContent?: number | undefined;
        isDefault?: boolean | undefined;
    }[]>;
    metricUnits: import("vue").ComputedRef<{
        id: string;
        name: string;
        category: UnitCategory;
        description?: string | undefined;
        defaultContent?: number | undefined;
        isDefault?: boolean | undefined;
    }[]>;
    allUnitNames: import("vue").ComputedRef<string[]>;
    getUnitUsageCount: (unitName: string) => number;
    addUnit: (payload: {
        name: string;
        category: UnitCategory;
        description?: string;
        defaultContent?: number;
    }) => MasterUnit;
    updateUnit: (id: string, updates: Partial<MasterUnit>) => void;
    deleteUnit: (id: string) => boolean;
    ensureUnitRegistered: (unitName: string, category?: UnitCategory) => void;
    saveLocal: () => void;
}>;
//# sourceMappingURL=unitStore.d.ts.map