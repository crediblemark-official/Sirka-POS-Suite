import type { BuyerName, CustomerType, PaymentMethod, PaymentStatus, SupplierCategory } from './common';
import type { BatchDeduction } from './product';

export interface CartItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  category: SupplierCategory;
  unit: string;              // Satuan aktif saat kasir menjual (misal 'GRAM', 'KG', 'BUTIR')
  baseUnit?: string;         // Satuan dasar produk (misal 'KG', 'PCS')
  conversionFactor?: number; // Pengali ke base unit (default 1)
  qty: number;               // Jumlah dalam satuan aktif (support desimal)
  baseQty?: number;          // qty * conversionFactor (dipotong dari batch stok)
  buyPrice: number;          // HPP modal
  markupPercent: number;
  sellPrice: number;         // Harga jual per satuan aktif
  isManualSellPrice?: boolean;
  subtotalBuy: number;
  subtotalSell: number;
  profit: number;
  batchDeductions?: BatchDeduction[]; // Rincian pemotongan stok batch FIFO/FEFO
}

export interface Transaction {
  id: string;
  invoiceNo: string;           // INV-YYYYMMDD-XXXX
  date: string;                // YYYY-MM-DD
  buyer: string;               // Nama Pembeli / Pelanggan
  items: CartItem[];
  totalBuy: number;
  totalSell: number;
  totalProfit: number;
  profitPercent: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  customerType?: CustomerType;
  isPreOrder?: boolean;
  picName?: string;
  notes?: string;
  // Diskon & Loyalty Membership
  discountAmount?: number;
  discountCode?: string;
  pointsUsed?: number;
  pointsDiscount?: number;
  pointsEarned?: number;
  finalTotal?: number;
  // Fitur Split Payment & Infaq Koin Kasir (Fase 2)
  isSplitPayment?: boolean;
  cashAmount?: number;
  nonCashAmount?: number;
  nonCashMethod?: 'Transfer Bank' | 'QRIS';
  changeAmount?: number;
  infaqAmount?: number;
  shiftId?: string;
  refundStatus?: 'NONE' | 'PARTIAL' | 'FULL';
  refundTotal?: number;
  createdAt: string;
}

export interface HeldCart {
  id: string;
  cartNumber: number;          // e.g. 1, 2, 3
  label?: string;              // e.g. "Ibu Rina" / "Antrean 1"
  items: CartItem[];
  buyer: BuyerName;
  saleMode: CustomerType;
  totalSell: number;
  finalTotal: number;
  createdAt: string;           // Formatted time or timestamp
}
