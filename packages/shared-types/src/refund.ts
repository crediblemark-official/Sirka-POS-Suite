import type { BatchDeduction } from './product';

export type RefundType = 'DAMAGED_GOODS' | 'RESTOCK' | 'CORRECTION';

export interface RefundItem {
  productId: string;
  productName: string;
  unit: string;
  baseUnit?: string;
  conversionFactor: number;
  qty: number;               // Qty yang diretur dalam satuan aktif
  baseQty: number;           // Qty yang diretur dalam base unit
  unitPrice: number;         // Harga jual per satuan aktif saat transaksi
  refundAmount: number;      // Total uang yang dikembalikan untuk item ini
  returnToStock: boolean;    // True jika barang layak jual (masuk stok batch), False jika rusak/busuk (masuk write-off)
  batchDeductions?: BatchDeduction[];
}

export interface TransactionRefund {
  id: string;
  transactionId: string;
  invoiceNo: string;
  date: string;              // YYYY-MM-DD
  cashierName: string;
  refundType: RefundType;
  reason: string;
  items: RefundItem[];
  totalRefundAmount: number;
  refundPaymentMethod: 'TUNAI' | 'TRANSFER';
  shiftId?: string;
  createdAt: string;
}
