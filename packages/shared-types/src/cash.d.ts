export type CashAccountType = 'TUNAI' | 'BANK' | 'QRIS';
export type CashMutationType = 'EXPENSE' | 'TRANSFER' | 'INFLOW';
export interface CashMutation {
    id: string;
    date: string;
    time: string;
    type: CashMutationType;
    fromAccount: CashAccountType;
    toAccount?: CashAccountType;
    amount: number;
    category: string;
    notes: string;
    referenceNo?: string;
    settled?: boolean;
    createdAt: string;
}
export interface CashAccountBalances {
    salesCash: number;
    expenseCash: number;
    transferOutCash: number;
    transferInCash: number;
    netCashDrawer: number;
    salesBank: number;
    expenseBank: number;
    transferOutBank: number;
    transferInBank: number;
    purchasesCostBank: number;
    netBankBalance: number;
    salesQris: number;
    settledQrisToBank: number;
    expenseQris: number;
    pendingQrisSettlement: number;
    totalLiquidFunds: number;
}
//# sourceMappingURL=cash.d.ts.map