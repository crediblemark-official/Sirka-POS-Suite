export type UnitCategory = 'BASE' | 'PACKAGING' | 'METRIC';
export interface MasterUnit {
    id: string;
    name: string;
    category: UnitCategory;
    description?: string;
    defaultContent?: number;
    isDefault?: boolean;
}
//# sourceMappingURL=unit.d.ts.map