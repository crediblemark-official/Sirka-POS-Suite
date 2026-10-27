import { CashMutation, CashAccountType, CashAccountBalances } from '@sirka/shared-types';
export declare const useCashStore: import("pinia").SetupStoreDefinition<"cash", {
    mutations: import("vue").Ref<{
        id: string;
        date: string;
        time: string;
        type: import("@sirka/shared-types").CashMutationType;
        fromAccount: CashAccountType;
        toAccount?: CashAccountType | undefined;
        amount: number;
        category: string;
        notes: string;
        referenceNo?: string | undefined;
        settled?: boolean | undefined;
        createdAt: string;
    }[], CashMutation[] | {
        id: string;
        date: string;
        time: string;
        type: import("@sirka/shared-types").CashMutationType;
        fromAccount: CashAccountType;
        toAccount?: CashAccountType | undefined;
        amount: number;
        category: string;
        notes: string;
        referenceNo?: string | undefined;
        settled?: boolean | undefined;
        createdAt: string;
    }[]>;
    addExpense: (params: {
        fromAccount: CashAccountType;
        amount: number;
        category: string;
        notes?: string;
        referenceNo?: string;
        date?: string;
    }) => CashMutation;
    transferFunds: (params: {
        fromAccount: CashAccountType;
        toAccount: CashAccountType;
        amount: number;
        category?: string;
        notes?: string;
        referenceNo?: string;
        date?: string;
        settled?: boolean;
    }) => CashMutation;
    deleteMutation: (id: string) => void;
    calculateAccountBalances: (startDate?: string, endDate?: string) => CashAccountBalances;
    overallBalances: import("vue").ComputedRef<CashAccountBalances>;
}>;
//# sourceMappingURL=cashStore.d.ts.map