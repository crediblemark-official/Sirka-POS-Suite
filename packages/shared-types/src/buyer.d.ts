import type { CustomerType } from './common';
export type MembershipTier = 'REGULAR' | 'SILVER' | 'GOLD' | 'PLATINUM';
export interface Buyer {
    id: string;
    name: string;
    code?: string;
    phone?: string;
    address?: string;
    customerType?: CustomerType;
    memberCardNo?: string;
    tier?: MembershipTier;
    points?: number;
    totalSpend?: number;
    memberSince?: string;
    /** Catatan pelanggan — dipakai juga untuk jejak audit penyesuaian poin. */
    notes?: string;
}
export type DiscountType = 'PERCENT' | 'FIXED';
export type DiscountScope = 'ALL' | 'CATEGORY' | 'CUSTOMER_TYPE' | 'MEMBER_ONLY';
export interface Discount {
    id: string;
    code: string;
    name: string;
    type: DiscountType;
    value: number;
    minPurchase: number;
    maxDiscount?: number;
    scope: DiscountScope;
    targetCategory?: string;
    targetCustomerType?: CustomerType;
    isActive: boolean;
    description?: string;
    usageCount?: number;
    createdAt?: string;
}
export interface LoyaltyProgramSetting {
    earnPerAmount: number;
    pointValueInRupiah: number;
    tierDiscounts: Record<MembershipTier, number>;
    tierMinSpend?: {
        SILVER: number;
        GOLD: number;
        PLATINUM: number;
    };
}
//# sourceMappingURL=buyer.d.ts.map