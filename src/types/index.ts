// Dynamic Business Entities (No Hardcoded constraints)
export type BuyerName = string;
export type SupplierCategory = string;
export type CategoryName = string;
export type CustomerType = 'B2B' | 'B2C';
export type MembershipTier = 'REGULAR' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  contactPerson?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
}

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

export interface StoreSetting {
  key: string;
  value: string;
}

export type PaymentStatus = 'LUNAS' | 'TEMPO';

export type PaymentMethod = 'Transfer Bank' | 'Tunai / Kas' | 'QRIS' | 'Nota Tempo';

export type UnitCategory = 'BASE' | 'PACKAGING' | 'METRIC';

export interface MasterUnit {
  id: string;
  name: string;              // e.g. 'PCS', 'BUNGKUS', 'KG', 'DUS', 'SLOP', 'SAK', 'BUTIR'
  category: UnitCategory;    // 'BASE' (Satuan Dasar/Ecer), 'PACKAGING' (Kemasan Besar), 'METRIC' (Metrik Baku Berat/Volume)
  description?: string;      // e.g. 'Kemasan karton isi banyak', 'Satuan timbangan berat baku'
  defaultContent?: number;   // Isi default jika kemasan (misal Dus default 40, Slop default 10, Sak default 50)
  isDefault?: boolean;       // Bawaan sistem atau buatan user
}

export interface ProductUnitConversion {
  id: string;
  unitName: string;          // e.g. 'GRAM', 'BUTIR', 'SAK', 'LUSIN', 'TRAY', 'JERIGEN'
  conversionFactor: number;  // Faktor pengali ke base unit (e.g. 0.001 untuk GRAM->KG, 12 untuk LUSIN->PCS, 50 untuk SAK->KG)
  parentUnitName?: string;    // Satuan induk acuan pecahan bertingkat (misal 'DUS', 'SLOP', 'KG', 'ONS')
  sellPrice?: number;        // Harga jual khusus satuan ini
  barcode?: string;
}

export interface BatchDeduction {
  batchId: string;
  batchNo: string;
  qtyDeducted: number;       // Dalam base unit
  buyPrice: number;          // Harga beli modal batch terkait
  expiryDate?: string;
}

export interface ProductBatch {
  id: string;
  productId: string;
  batchNo: string;
  purchaseReceiptId?: string;
  initialQty: number;        // Disimpan dalam base unit
  remainingQty: number;      // Sisa stok dalam base unit
  buyPrice: number;          // Modal per base unit
  sellPrice?: number;        // Harga jual saat batch ini masuk
  expiryDate?: string;       // YYYY-MM-DD
  createdAt: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: SupplierCategory;
  supplier?: string;         // Mitra pemasok utama barang ini
  unit: string;              // Base Unit
  defaultMarkupPercent: number;
  lastBuyPrice: number;
  lastSellPrice: number;
  stock: number;
  barcode?: string;
  notes?: string;
  units?: ProductUnitConversion[];
  isPerishable?: boolean;    // true jika produk cepat busuk/exp (prioritas FEFO)
}

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
  color?: string;
}

export interface PurchaseReceiptItem {
  id: string;
  productId: string;
  code: string;
  name: string;
  category: SupplierCategory;
  unit: string;                 // Satuan fisik item nota (mis. 'DUS')
  qtyReceived: number;          // Jumlah dalam satuan fisik nota (mis. 5 DUS)
  baseQty?: number;             // Jumlah dalam satuan DASAR produk (mis. 200 PCS)
  conversionFactor?: number;    // Faktor satuan nota -> satuan dasar (mis. 40)
  buyPrice: number;            // Harga beli fisik dari nota supplier
  subtotalBuy: number;         // qtyReceived * buyPrice
  markupPercent: number;       // % markup yang diterapkan
  newSellPrice: number;        // Rekomendasi harga jual baru
  expiryDate?: string;         // Tanggal kedaluwarsa untuk FEFO (First Expired First Out)
  batchNo?: string;            // Nomor batch unik
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

export interface CashierShift {
  id: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  startingCash: number;
  cashSales: number;
  nonCashSales: number;
  cashInflow?: number;         // Pemasukan non-penjualan (tip, infaq, donasi pelanggan)
  cashOutflow: number;         // Pengeluaran operasional / biaya kasir
  refundOutflow?: number;      // Total pengeluaran pengembalian dana (refund)
  expectedCash: number;
  actualCash?: number;
  discrepancy?: number;
  transferredToTreasury?: number; // Jumlah disetor ke bendahara
  retainedInDrawer?: number;      // Sisa modal di laci kasir untuk shift selanjutnya
  notes?: string;
  status: 'OPEN' | 'CLOSED';
  createdAt?: string;
}

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

export type WasteReason = 'BUSUK' | 'EXPIRED' | 'RUSAK_FISIK' | 'SUSUT_TIMBANGAN' | 'LAINNYA';

export interface WasteRecord {
  id: string;
  productId: string;
  productName: string;
  category: SupplierCategory;
  qty: number;
  unit: string;
  baseQty: number;
  reason: WasteReason;
  estimatedLoss: number;     // Estimasi kerugian HPP (modal * baseQty)
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export type StockMovementType =
  | 'KULAKAN'            // Masuk (+) dari faktur supplier
  | 'PENJUALAN'          // Keluar (-) transaksi kasir
  | 'RETUR_MASUK'        // Masuk (+) retur pembeli layak jual
  | 'RUSAK_WASTE'        // Keluar (-) barang rusak/pecah/susut
  | 'PENYESUAIAN_OPNAME' // Koreksi (+ / -) selisih fisik opname
  | 'STOK_AWAL';         // Inisialisasi awal

export type StockAdjustReason =
  | 'SELISIH_HITUNG'     // Kesalahan hitung fisik / lupa catat
  | 'HILANG'             // Barang tidak ditemukan / hilang
  | 'RUSAK_KADALUWARSA'  // Ditemukan sudah rusak di rak
  | 'BONUS_SUPPLIER'     // Bonus fisik lebih dari distributor
  | 'AWAL_MIGRASI'       // Saldo awal migrasi sistem
  | 'LAINNYA';

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  category: SupplierCategory;
  unit: string;
  type: StockMovementType;
  refNo: string;              // No nota faktur / no struk POS / no opname
  date: string;               // ISO date atau YYYY-MM-DD HH:mm
  qtyChange: number;          // +10 atau -2
  stockBefore: number;
  stockAfter: number;
  costPrice?: number;         // Modal HPP saat mutasi
  notes?: string;
  operator?: string;          // Kasir / Admin
  createdAt: string;
}

export interface StockAdjustmentRecord {
  id: string;
  productId: string;
  productName: string;
  systemStock: number;
  physicalStock: number;
  difference: number;         // physicalStock - systemStock
  reason: StockAdjustReason;
  notes?: string;
  adjustedBy: string;
  createdAt: string;
}


