export interface CashierShift {
    id: string;
    cashierName: string;
    startTime: string;
    endTime?: string;
    startingCash: number;
    cashSales: number;
    nonCashSales: number;
    cashInflow?: number;
    cashOutflow: number;
    refundOutflow?: number;
    expectedCash: number;
    actualCash?: number;
    discrepancy?: number;
    transferredToTreasury?: number;
    retainedInDrawer?: number;
    notes?: string;
    status: 'OPEN' | 'CLOSED';
    createdAt?: string;
}
//# sourceMappingURL=shift.d.ts.map