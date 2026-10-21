/**
 * Utility untuk manajemen warna kategori produk di Kasir-Citra
 */

export interface CategoryColorTheme {
  id: string;
  name: string;
  hex: string;
  gradientFrom: string;
  gradientTo: string;
  badgeBg: string;
  badgeText: string;
  borderHex: string;
  bgLightHex: string;
}

export const CATEGORY_PALETTES: CategoryColorTheme[] = [
  {
    id: 'amber',
    name: 'Kuning Emas / Sembako',
    hex: '#d97706',
    gradientFrom: '#f59e0b',
    gradientTo: '#b45309',
    badgeBg: '#fef3c7',
    badgeText: '#92400e',
    borderHex: '#d97706',
    bgLightHex: '#fffbeb'
  },
  {
    id: 'emerald',
    name: 'Hijau Segar / Sayur & Buah',
    hex: '#059669',
    gradientFrom: '#10b981',
    gradientTo: '#047857',
    badgeBg: '#d1fae5',
    badgeText: '#065f46',
    borderHex: '#059669',
    bgLightHex: '#ecfdf5'
  },
  {
    id: 'blue',
    name: 'Biru Samudera / Dairy & Frozen',
    hex: '#2563eb',
    gradientFrom: '#3b82f6',
    gradientTo: '#1d4ed8',
    badgeBg: '#dbeafe',
    badgeText: '#1e40af',
    borderHex: '#2563eb',
    bgLightHex: '#eff6ff'
  },
  {
    id: 'rose',
    name: 'Merah Segar / Daging & Bumbu',
    hex: '#e11d48',
    gradientFrom: '#f43f5e',
    gradientTo: '#be123c',
    badgeBg: '#ffe4e6',
    badgeText: '#9f1239',
    borderHex: '#e11d48',
    bgLightHex: '#fff1f2'
  },
  {
    id: 'purple',
    name: 'Ungu / Non-Sembako & ATK',
    hex: '#7c3aed',
    gradientFrom: '#8b5cf6',
    gradientTo: '#6d28d9',
    badgeBg: '#ede9fe',
    badgeText: '#5b21b6',
    borderHex: '#7c3aed',
    bgLightHex: '#f5f3ff'
  },
  {
    id: 'cyan',
    name: 'Cyan / Minuman & Es',
    hex: '#0891b2',
    gradientFrom: '#06b6d4',
    gradientTo: '#0e7490',
    badgeBg: '#cffafe',
    badgeText: '#155e75',
    borderHex: '#0891b2',
    bgLightHex: '#ecfeff'
  },
  {
    id: 'orange',
    name: 'Oranye / Snack & Makanan Ringan',
    hex: '#ea580c',
    gradientFrom: '#f97316',
    gradientTo: '#c2410c',
    badgeBg: '#ffedd5',
    badgeText: '#9a3412',
    borderHex: '#ea580c',
    bgLightHex: '#fff7ed'
  },
  {
    id: 'teal',
    name: 'Teal / Bumbu Dapur & Herbal',
    hex: '#0d9488',
    gradientFrom: '#14b8a6',
    gradientTo: '#0f766e',
    badgeBg: '#ccfbf1',
    badgeText: '#115e59',
    borderHex: '#0d9488',
    bgLightHex: '#f0fdfa'
  },
  {
    id: 'indigo',
    name: 'Indigo / Rokok & Tembakau',
    hex: '#4f46e5',
    gradientFrom: '#6366f1',
    gradientTo: '#4338ca',
    badgeBg: '#e0e7ff',
    badgeText: '#3730a3',
    borderHex: '#4f46e5',
    bgLightHex: '#eef2ff'
  },
  {
    id: 'pink',
    name: 'Pink / Perawatan & Kosmetik',
    hex: '#db2777',
    gradientFrom: '#ec4899',
    gradientTo: '#be185d',
    badgeBg: '#fce7f3',
    badgeText: '#9d174d',
    borderHex: '#db2777',
    bgLightHex: '#fdf2f8'
  },
  {
    id: 'stone',
    name: 'Cokelat Kayu / Kebersihan & Rumah Tangga',
    hex: '#78716c',
    gradientFrom: '#a8a29e',
    gradientTo: '#57534e',
    badgeBg: '#f5f5f4',
    badgeText: '#44403c',
    borderHex: '#78716c',
    bgLightHex: '#fafaf9'
  },
  {
    id: 'lime',
    name: 'Hijau Lime / Segar Alam',
    hex: '#65a30d',
    gradientFrom: '#84cc16',
    gradientTo: '#4d7c0f',
    badgeBg: '#ecfccb',
    badgeText: '#3f6212',
    borderHex: '#65a30d',
    bgLightHex: '#f7fee7'
  }
];

/**
 * Deterministic hash dari string kategori untuk mendapatkan warna bawaan yang konsisten
 */
export function getDeterministicCategoryColor(categoryName: string): CategoryColorTheme {
  if (!categoryName) return CATEGORY_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CATEGORY_PALETTES.length;
  return CATEGORY_PALETTES[index];
}

/**
 * Mengambil tema warna kategori berdasarkan hex/id kustom atau nama kategorinya
 */
export function getCategoryTheme(categoryName: string, customColorOrId?: string): CategoryColorTheme {
  if (customColorOrId) {
    const byId = CATEGORY_PALETTES.find(p => p.id === customColorOrId || p.hex.toLowerCase() === customColorOrId.toLowerCase());
    if (byId) return byId;

    if (customColorOrId.startsWith('#')) {
      return {
        id: 'custom',
        name: 'Kustom',
        hex: customColorOrId,
        gradientFrom: customColorOrId,
        gradientTo: customColorOrId,
        badgeBg: `${customColorOrId}15`,
        badgeText: customColorOrId,
        borderHex: customColorOrId,
        bgLightHex: `${customColorOrId}08`
      };
    }
  }

  return getDeterministicCategoryColor(categoryName);
}
