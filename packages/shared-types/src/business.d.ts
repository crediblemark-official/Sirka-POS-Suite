export type BusinessType = 'retail' | 'fnb' | 'service' | 'wholesale' | 'universal';
export interface BusinessModeConfig {
    id: BusinessType;
    title: string;
    tagline: string;
    description: string;
    icon: string;
    badgeColor: string;
    features: {
        tableManagement: boolean;
        modifiers: boolean;
        kitchenTicket: boolean;
        serviceStaff: boolean;
        serviceStatus: boolean;
        wholesaleTiers: boolean;
        preOrderMatrix: boolean;
        dynamicMarkup: boolean;
        barcodeScanner: boolean;
        multiUnits: boolean;
    };
    terminology: {
        productLabel: string;
        productLabelPlural: string;
        categoryLabel: string;
        cartTitle: string;
        customerLabel: string;
        addSuccessMessage: string;
    };
}
export declare const BUSINESS_MODES: Record<BusinessType, BusinessModeConfig>;
//# sourceMappingURL=business.d.ts.map