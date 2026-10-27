import type { SupplierCategory } from './common';

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
