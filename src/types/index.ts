// Dynamic Business Entities (No Hardcoded constraints)
export type BuyerName = string;
export type SupplierCategory = string;
export type CustomerType = 'B2B' | 'B2C';
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

export interface StoreSetting {
  key: string;
  value: string;
}

export type PaymentStatus = 'LUNAS' | 'TEMPO';

export type PaymentMethod = 'Transfer Bank' | 'Tunai / Kas' | 'QRIS' | 'Nota Tempo';

export interface Product {
  id: string;
  code: string;
  name: string;
  category: SupplierCategory;
  unit: string;
  defaultMarkupPercent: number;
  lastBuyPrice: number;
  lastSellPrice: number;
  stock: number;
  barcode?: string;
  notes?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  category: SupplierCategory;
  unit: string;
  qty: number;
  buyPrice: number;            // Inline input saat nota supplier datang
  markupPercent: number;       // Dinamis per baris (default dari supplier/global)
  sellPrice: number;           // Dihitung otomatis: buyPrice * (1 + markupPercent / 100), atau override manual
  isManualSellPrice?: boolean; // Jika kasir mematok harga jual tetap (contoh Tinta 85.000)
  subtotalBuy: number;         // qty * buyPrice
  subtotalSell: number;        // qty * sellPrice
  profit: number;              // subtotalSell - subtotalBuy
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
  createdAt: string;
}

export interface PreOrderItem {
  id: string;
  productName: string;
  category: SupplierCategory;
  qty: number;
  unit: string;
  packagingNote?: string;      // Contoh: "APEL FUJI 2500 (13 KRTN)", "AYAM POTONG AP (10) 150KG"
}

export interface PreOrderSchedule {
  id: string;
  date: string;                // YYYY-MM-DD (misal 2026-10-12 s/d 2026-10-16)
  dayName: string;             // Senin, Selasa, Rabu, Kamis, Jumat
  buyer: string;               // Nama Pembeli / Pelanggan
  items: PreOrderItem[];
  isLoadedToPos?: boolean;
}

export interface CategoryMarkupSetting {
  category: SupplierCategory;
  defaultMarkupPercent: number;
  description: string;
}

export interface PurchaseReceiptItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  category: SupplierCategory;
  unit: string;
  qtyReceived: number;
  buyPrice: number;            // Harga beli fisik dari nota supplier
  subtotalBuy: number;         // qtyReceived * buyPrice
  markupPercent: number;       // % markup yang diterapkan
  newSellPrice: number;        // Rekomendasi harga jual baru: buyPrice * (1 + markup/100)
}

export interface PurchaseReceipt {
  id: string;
  supplierInvoiceNo: string;   // Nomor nota fisik dari vendor
  date: string;                // Tanggal nota / barang datang
  supplier: SupplierCategory;
  items: PurchaseReceiptItem[];
  totalBuy: number;
  notes?: string;
  createdAt: string;
}
