/**
 * Centralized formatting utilities (DRY)
 */
export declare function formatRupiah(val: number): string;
export declare function formatPercent(val: number): string;
export declare function formatDateIndo(dateStr: string): string;
/**
 * Tanggal hari ini dalam zona waktu LOKAL (YYYY-MM-DD).
 *
 * BUG FIX: `new Date().toISOString().slice(0, 10)` menghasilkan tanggal UTC.
 * Di WIB (UTC+7) pukul 00:30, tanggal UTC masih "kemarin" sehingga transaksi,
 * nota kulakan, dan laporan "Hari Ini" salah tanggal.
 */
export declare function localTodayStr(d?: Date): string;
/**
 * Tanggal lokal N hari kebelakang (YYYY-MM-DD) — aman terhadap overflow bulan.
 */
export declare function localDateOffset(days: number, d?: Date): string;
/**
 * Awal bulan sebelumnya (YYYY-MM-DD) — aman terhadap overflow `setMonth`.
 */
export declare function localPreviousMonthStr(d?: Date): string;
/**
 * Awal bulan berjalan (YYYY-MM-DD) dalam zona waktu lokal.
 */
export declare function localMonthStartStr(d?: Date): string;
/**
 * Memastikan nama mitra supplier selalu terisi dengan benar (fallback bila database lama/sinkronisasi sempat kosong)
 */
export declare function resolveProductSupplier(prod?: {
    supplier?: string | null;
    category?: string | null;
    code?: string | null;
} | null): string;
/**
 * Parse tanggal 'YYYY-MM-DD' sebagai WAKTU LOKAL (bukan UTC).
 * `new Date('2026-10-22')` = UTC midnight -> di WIB mundur 7 jam.
 */
export declare function parseLocalDate(dateStr: string): Date;
//# sourceMappingURL=formatters.d.ts.map