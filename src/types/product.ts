import type { SupplierCategory } from './common';

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
