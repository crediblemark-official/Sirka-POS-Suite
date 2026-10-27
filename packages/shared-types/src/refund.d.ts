import type { BatchDeduction } from './product';
export type RefundType = 'DAMAGED_GOODS' | 'RESTOCK' | 'CORRECTION';
export interface RefundItem {
    productId: string;
    productName: string;
    unit: string;
    baseUnit?: string;
    conversionFactor: number;
    qty: number;
    baseQty: number;
    unitPrice: number;
    refundAmount: number;
    returnToStock: boolean;
    batchDeductions?: BatchDeduction[];
}
export interface TransactionRefund {
    id: string;
    transactionId: string;
    invoiceNo: string;
    date: string;
    cashierName: string;
    refundType: RefundType;
    reason: string;
    items: RefundItem[];
    totalRefundAmount: number;
    refundPaymentMethod: 'TUNAI' | 'TRANSFER';
    shiftId?: string;
    createdAt: string;
}
//# sourceMappingURL=refund.d.ts.map