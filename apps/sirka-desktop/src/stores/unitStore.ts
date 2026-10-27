import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { MasterUnit, UnitCategory } from '../types';
import { useInventoryStore } from './inventoryStore';
import { safeParse } from '../utils/storage';

const STORAGE_KEY_UNITS = 'kasir_citra_units_v1';

const DEFAULT_UNITS: MasterUnit[] = [
  // 1. Satuan Metrik Baku (Pasti & Ilmiah)
  { id: 'unit-kg', name: 'KG', category: 'METRIC', description: 'Kilogram - Timbangan berat standar', defaultContent: 1, isDefault: true },
  { id: 'unit-gram', name: 'GRAM', category: 'METRIC', description: 'Gram - 0.001 Kilogram', defaultContent: 0.001, isDefault: true },
  { id: 'unit-ons', name: 'ONS', category: 'METRIC', description: 'Ons - 100 Gram / 0.1 KG', defaultContent: 0.1, isDefault: true },
  { id: 'unit-liter', name: 'LITER', category: 'METRIC', description: 'Liter - Satuan volume cairan', defaultContent: 1, isDefault: true },
  { id: 'unit-ml', name: 'ML', category: 'METRIC', description: 'Mililiter - 0.001 Liter', defaultContent: 0.001, isDefault: true },

  // 2. Satuan Dasar Eceran (Base Units Sembako/Ritel)
  { id: 'unit-pcs', name: 'PCS', category: 'BASE', description: 'Buah / Satuan umum eceran', isDefault: true },
  { id: 'unit-bungkus', name: 'BUNGKUS', category: 'BASE', description: 'Bungkus mie instan, snack, atau rokok', isDefault: true },
  { id: 'unit-sachet', name: 'SACHET', category: 'BASE', description: 'Sachet sampo, kopi instan, bumbu masak', isDefault: true },
  { id: 'unit-butir', name: 'BUTIR', category: 'BASE', description: 'Butir eceran telur ayam/bebek', isDefault: true },
  { id: 'unit-cup', name: 'CUP', category: 'BASE', description: 'Gelas / Cup air mineral atau minuman', isDefault: true },
  { id: 'unit-botol', name: 'BOTOL', category: 'BASE', description: 'Botol kecap, saus, sirup, atau minuman', isDefault: true },
  { id: 'unit-kaleng', name: 'KALENG', category: 'BASE', description: 'Kaleng susu kental manis, sarden, biskuit', isDefault: true },
  { id: 'unit-ikat', name: 'IKAT', category: 'BASE', description: 'Ikat sayuran segar atau daun', isDefault: true },
  { id: 'unit-lembar', name: 'LEMBAR', category: 'BASE', description: 'Lembar kertas, kardus, atau plastik', isDefault: true },
  { id: 'unit-batang', name: 'BATANG', category: 'BASE', description: 'Batang rokok ketengan atau sabun batang', isDefault: true },
  { id: 'unit-potong', name: 'POTONG', category: 'BASE', description: 'Potong kue atau daging olahan', isDefault: true },

  // 3. Satuan Kemasan Besar (Packaging Units - Dihitung saat kulakan)
  { id: 'unit-dus', name: 'DUS', category: 'PACKAGING', description: 'Karton / Dus kemasan pabrik (Mie, Air, Minyak)', defaultContent: 40, isDefault: true },
  { id: 'unit-slop', name: 'SLOP', category: 'PACKAGING', description: 'Slop rokok kemasan isi bungkus', defaultContent: 10, isDefault: true },
  { id: 'unit-sak', name: 'SAK', category: 'PACKAGING', description: 'Sak karung beras, terigu, atau gula', defaultContent: 50, isDefault: true },
  { id: 'unit-peti', name: 'PETI', category: 'PACKAGING', description: 'Peti kayu telur ayam atau buah', defaultContent: 15, isDefault: true },
  { id: 'unit-tray', name: 'TRAY', category: 'PACKAGING', description: 'Tray karton telur (isi butiran)', defaultContent: 30, isDefault: true },
  { id: 'unit-bal', name: 'BAL', category: 'PACKAGING', description: 'Bal kemasan kerupuk, rokok, atau bahan pokok', defaultContent: 20, isDefault: true },
  { id: 'unit-renceng', name: 'RENCENG', category: 'PACKAGING', description: 'Renceng kopi, bumbu, atau sampo sachet', defaultContent: 10, isDefault: true },
  { id: 'unit-pak', name: 'PAK', category: 'PACKAGING', description: 'Pack mika atau plastik isi eceran', defaultContent: 12, isDefault: true },
  { id: 'unit-lusin', name: 'LUSIN', category: 'PACKAGING', description: 'Lusin isi 12 pcs pasti', defaultContent: 12, isDefault: true },
  { id: 'unit-jerigen', name: 'JERIGEN', category: 'PACKAGING', description: 'Jerigen minyak goreng curah / cairan', defaultContent: 5, isDefault: true }
];

export const useUnitStore = defineStore('unit', () => {
  const saved = localStorage.getItem(STORAGE_KEY_UNITS);
  const units = ref<MasterUnit[]>(
    safeParse<MasterUnit[]>(saved, DEFAULT_UNITS.map(u => ({ ...u })), 'UnitStore')
  );

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(units.value));
  }

  // Filter Categories
  const baseUnits = computed(() => units.value.filter(u => u.category === 'BASE' || u.category === 'METRIC'));
  const packagingUnits = computed(() => units.value.filter(u => u.category === 'PACKAGING'));
  const metricUnits = computed(() => units.value.filter(u => u.category === 'METRIC'));
  const allUnitNames = computed(() => units.value.map(u => u.name));

  // Menghitung berapa banyak produk di inventaris yang menggunakan satuan ini
  function getUnitUsageCount(unitName: string): number {
    const inv = useInventoryStore();
    const uname = (unitName || '').toUpperCase().trim();
    let count = 0;
    for (const p of inv.products) {
      if ((p.unit || '').toUpperCase().trim() === uname) {
        count++;
      } else if (p.units && Array.isArray(p.units)) {
        if (p.units.some(u => (u.unitName || '').toUpperCase().trim() === uname)) {
          count++;
        }
      }
    }
    return count;
  }

  function addUnit(payload: {
    name: string;
    category: UnitCategory;
    description?: string;
    defaultContent?: number;
  }): MasterUnit {
    const cleanName = payload.name.trim().toUpperCase();
    const existing = units.value.find(u => u.name.toUpperCase() === cleanName);
    if (existing) {
      // BUG FIX: `addUnit` diam-diam MENGUBAH satuan yang sudah ada (mis.
      // satuan sistem "KG" jadi kategori BASE). Sekarang satuan existing
      // dikembalikan apa adanya; perubahan harus lewat `updateUnit`.
      console.warn(`[UnitStore] Satuan "${cleanName}" sudah ada, tidak dibuat ulang.`);
      return existing;
    }

    const newUnit: MasterUnit = {
      id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      category: payload.category,
      description: payload.description || '',
      // BUG FIX: `||` mengabaikan nilai 0 yang valid (mis. 1 GRAM = 0.001,
      // atau satuan dengan isi 0). Gunakan ?? agar 0 tidak tertimpa.
      defaultContent: payload.defaultContent ?? (payload.category === 'PACKAGING' ? 10 : 1),
      isDefault: false
    };

    units.value.push(newUnit);
    saveLocal();
    return newUnit;
  }

  function updateUnit(id: string, updates: Partial<MasterUnit>) {
    const found = units.value.find(u => u.id === id);
    if (!found) return;
    if (updates.name) {
      const newName = updates.name.trim().toUpperCase();
      // BUG FIX: nama satuan harus unik. Duplikat (mis. "SAK" ganda) membuat
      // `find(u => u.name === ...)` bergantung urutan array.
      const clash = units.value.find(u => u.id !== id && u.name.toUpperCase() === newName);
      if (clash) {
        console.warn(`[UnitStore] Nama satuan "${newName}" sudah dipakai satuan lain.`);
        return;
      }
      updates.name = newName;
    }
    Object.assign(found, updates);
    saveLocal();
  }

  function deleteUnit(id: string): boolean {
    const idx = units.value.findIndex(u => u.id === id);
    if (idx !== -1) {
      units.value.splice(idx, 1);
      saveLocal();
      return true;
    }
    return false;
  }

  // Pastikan jika ada satuan baru yang diketik di barang, otomatis terdaftar
  function ensureUnitRegistered(unitName: string, category: UnitCategory = 'BASE') {
    const clean = (unitName || '').trim().toUpperCase();
    if (!clean) return;
    if (!units.value.some(u => u.name.toUpperCase() === clean)) {
      addUnit({
        name: clean,
        category,
        description: `Satuan kustom terdaftar otomatis`,
        defaultContent: category === 'PACKAGING' ? 10 : 1
      });
    }
  }

  return {
    units,
    baseUnits,
    packagingUnits,
    metricUnits,
    allUnitNames,
    getUnitUsageCount,
    addUnit,
    updateUnit,
    deleteUnit,
    ensureUnitRegistered,
    saveLocal
  };
});
