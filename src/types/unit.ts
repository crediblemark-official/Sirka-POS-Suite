export type UnitCategory = 'BASE' | 'PACKAGING' | 'METRIC';

export interface MasterUnit {
  id: string;
  name: string;              // e.g. 'PCS', 'BUNGKUS', 'KG', 'DUS', 'SLOP', 'SAK', 'BUTIR'
  category: UnitCategory;    // 'BASE' (Satuan Dasar/Ecer), 'PACKAGING' (Kemasan Besar), 'METRIC' (Metrik Baku Berat/Volume)
  description?: string;      // e.g. 'Kemasan karton isi banyak', 'Satuan timbangan berat baku'
  defaultContent?: number;   // Isi default jika kemasan (misal Dus default 40, Slop default 10, Sak default 50)
  isDefault?: boolean;       // Bawaan sistem atau buatan user
}
