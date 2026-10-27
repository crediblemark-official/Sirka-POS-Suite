import type { SupplierCategory } from './common';

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
