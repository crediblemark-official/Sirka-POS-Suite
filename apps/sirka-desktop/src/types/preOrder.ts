import type { SupplierCategory } from './common';

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
