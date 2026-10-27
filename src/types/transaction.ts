import type { BuyerName, CustomerType, PaymentMethod, PaymentStatus, SupplierCategory } from './common';
import type { BatchDeduction, ProductType } from './product';

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'STANDARD';
export type ServiceStatus = 'QUEUED' | 'IN_PROGRESS' | 'DONE' | 'COLLECTED';

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
  productType?: ProductType;
  modifiers?: string[];      // Varian / catatan rasa F&B (e.g. ['Less Sugar', 'Level 2'])
  staffName?: string;        // Staf / teknisi / kapster pengerja jasa
  itemNotes?: string;        // Catatan khusus baris pesanan
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
  // Mode Bisnis & F&B / Jasa
  businessType?: string;
  orderType?: OrderType;       // Dine-in / Takeaway / Delivery
  tableNo?: string;            // Nomor Meja (F&B)
  staffName?: string;          // Staf / Operator Jasa utama
  serviceStatus?: ServiceStatus; // Antre / Proses / Selesai / Diambil
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
  label?: string;              // e.g. "Ibu Rina" / "Antrean 1" / "Meja 04"
  items: CartItem[];
  buyer: BuyerName;
  saleMode: CustomerType;
  orderType?: OrderType;
  tableNo?: string;
  staffName?: string;
  totalSell: number;
  finalTotal: number;
  createdAt: string;           // Formatted time or timestamp
}
