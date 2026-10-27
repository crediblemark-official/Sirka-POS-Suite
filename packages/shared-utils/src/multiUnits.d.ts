import { ProductUnitConversion } from '@sirka/shared-types';
export interface ProductUnitFormItem extends ProductUnitConversion {
    mode?: 'multiple' | 'fraction';
    displayFactor?: number;
    parentUnitName?: string;
}
export declare function formatUnitQty(val: number | string | undefined): string;
export declare function getParentUnitOptionsForList(units: ProductUnitFormItem[], baseUnit: string, idx: number): string[];
export declare function recalculateAllUnitFactors(units: ProductUnitFormItem[], baseUnit: string): void;
export declare function getEquivalentTotalStock(u: ProductUnitFormItem, currentStock: number): string;
export declare function getProportionalSellPrice(u: ProductUnitFormItem, baseSellPrice: number): number;
export declare function isUnitFactorInvalid(u: ProductUnitFormItem): boolean;
export declare function isUnitNameInvalid(u: ProductUnitFormItem): boolean;
export declare function isUnitPriceInvalid(u: ProductUnitFormItem): boolean;
export declare function isUnitRowPartiallyFilled(u: ProductUnitFormItem): boolean;
//# sourceMappingURL=multiUnits.d.ts.map