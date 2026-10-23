import type { CustomerType } from './common';

export type MembershipTier = 'REGULAR' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface Buyer {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  address?: string;
  customerType?: CustomerType;
  // Loyalty & Membership Card
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
  value: number;                // e.g. 10 for 10%, or 25000 for Rp 25.000
  minPurchase: number;          // minimum cart subtotal
  maxDiscount?: number;         // maximum discount limit for percentage
  scope: DiscountScope;
  targetCategory?: string;
  targetCustomerType?: CustomerType;
  isActive: boolean;
  description?: string;
  usageCount?: number;
  createdAt?: string;
}

export interface LoyaltyProgramSetting {
  earnPerAmount: number;        // e.g. 10000 -> 1 point for each Rp 10.000 spend
  pointValueInRupiah: number;   // e.g. 100 -> 1 point = Rp 100
  tierDiscounts: Record<MembershipTier, number>; // discount percentage per tier
  tierMinSpend?: {
    SILVER: number;
    GOLD: number;
    PLATINUM: number;
  };
}
