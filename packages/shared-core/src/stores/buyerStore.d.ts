import { Buyer, CustomerType, MembershipTier, LoyaltyProgramSetting } from '@sirka/shared-types';
export declare const useBuyerStore: import("pinia").SetupStoreDefinition<"buyer", {
    showMemberDrawer: import("vue").Ref<boolean, boolean>;
    showBuyerSidebar: import("vue").Ref<boolean, boolean>;
    activeBuyerForSidebar: import("vue").Ref<{
        id: string;
        name: string;
        code?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        customerType?: CustomerType | undefined;
        memberCardNo?: string | undefined;
        tier?: MembershipTier | undefined;
        points?: number | undefined;
        totalSpend?: number | undefined;
        memberSince?: string | undefined;
        notes?: string | undefined;
    } | null, Buyer | {
        id: string;
        name: string;
        code?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        customerType?: CustomerType | undefined;
        memberCardNo?: string | undefined;
        tier?: MembershipTier | undefined;
        points?: number | undefined;
        totalSpend?: number | undefined;
        memberSince?: string | undefined;
        notes?: string | undefined;
    } | null>;
    buyers: import("vue").Ref<{
        id: string;
        name: string;
        code?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        customerType?: CustomerType | undefined;
        memberCardNo?: string | undefined;
        tier?: MembershipTier | undefined;
        points?: number | undefined;
        totalSpend?: number | undefined;
        memberSince?: string | undefined;
        notes?: string | undefined;
    }[], Buyer[] | {
        id: string;
        name: string;
        code?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        customerType?: CustomerType | undefined;
        memberCardNo?: string | undefined;
        tier?: MembershipTier | undefined;
        points?: number | undefined;
        totalSpend?: number | undefined;
        memberSince?: string | undefined;
        notes?: string | undefined;
    }[]>;
    b2bBuyers: import("vue").ComputedRef<{
        id: string;
        name: string;
        code?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        customerType?: CustomerType | undefined;
        memberCardNo?: string | undefined;
        tier?: MembershipTier | undefined;
        points?: number | undefined;
        totalSpend?: number | undefined;
        memberSince?: string | undefined;
        notes?: string | undefined;
    }[]>;
    b2cBuyers: import("vue").ComputedRef<{
        id: string;
        name: string;
        code?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        customerType?: CustomerType | undefined;
        memberCardNo?: string | undefined;
        tier?: MembershipTier | undefined;
        points?: number | undefined;
        totalSpend?: number | undefined;
        memberSince?: string | undefined;
        notes?: string | undefined;
    }[]>;
    memberBuyers: import("vue").ComputedRef<{
        id: string;
        name: string;
        code?: string | undefined;
        phone?: string | undefined;
        address?: string | undefined;
        customerType?: CustomerType | undefined;
        memberCardNo?: string | undefined;
        tier?: MembershipTier | undefined;
        points?: number | undefined;
        totalSpend?: number | undefined;
        memberSince?: string | undefined;
        notes?: string | undefined;
    }[]>;
    loyaltySettings: import("vue").Ref<{
        earnPerAmount: number;
        pointValueInRupiah: number;
        tierDiscounts: {
            REGULAR: number;
            SILVER: number;
            GOLD: number;
            PLATINUM: number;
        };
        tierMinSpend?: {
            SILVER: number;
            GOLD: number;
            PLATINUM: number;
        } | undefined;
    }, LoyaltyProgramSetting | {
        earnPerAmount: number;
        pointValueInRupiah: number;
        tierDiscounts: {
            REGULAR: number;
            SILVER: number;
            GOLD: number;
            PLATINUM: number;
        };
        tierMinSpend?: {
            SILVER: number;
            GOLD: number;
            PLATINUM: number;
        } | undefined;
    }>;
    fetchBuyers: () => Promise<void>;
    getBuyerByName: (name: string) => Buyer | undefined;
    getBuyerByCardNo: (cardNo: string) => Buyer | undefined;
    generateMemberCardNo: (prefix?: string, customerType?: CustomerType) => string;
    addBuyer: (name: string, code?: string, phone?: string, address?: string, customerType?: CustomerType, memberCardNo?: string, tier?: MembershipTier, points?: number) => Promise<Buyer>;
    updateBuyer: (buyer: Buyer) => Promise<void>;
    deleteBuyer: (id: string) => Promise<void>;
    updateLoyaltySettings: (newSettings: LoyaltyProgramSetting) => Promise<void>;
    computeTierFromSpend: (totalSpend?: number) => MembershipTier;
    recordPurchase: (buyerId: string, spendAmount: number, pointsEarned?: number, pointsUsed?: number) => void;
    revertPurchase: (buyerId: string, spendAmount: number, pointsEarned?: number, pointsUsed?: number) => void;
    saveLocal: () => void;
}>;
//# sourceMappingURL=buyerStore.d.ts.map