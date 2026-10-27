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
export declare const CATEGORY_PALETTES: CategoryColorTheme[];
/**
 * Deterministic hash dari string kategori untuk mendapatkan warna bawaan yang konsisten.
 *
 * BUG FIX: hash dihitung dari nama yang sudah dinormalisasi (trim + lowercase)
 * supaya "Sembako", "sembako", dan "Sembako " menghasilkan warna yang sama.
 * Sebelumnya kategori yang sama bisa tampil dengan 3 warna berbeda.
 */
export declare function getDeterministicCategoryColor(categoryName: string): CategoryColorTheme;
/**
 * Mengambil tema warna kategori berdasarkan hex/id kustom atau nama kategorinya
 */
export declare function getCategoryTheme(categoryName: string, customColorOrId?: string): CategoryColorTheme;
//# sourceMappingURL=categoryColor.d.ts.map