/**
 * Centralized formatting utilities (DRY)
 */

export function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val || 0);
}

export function formatPercent(val: number): string {
  return Number(val || 0).toFixed(1);
}

export function formatDateIndo(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const cleanStr = dateStr.includes(' ') && !dateStr.includes('T') ? dateStr.replace(' ', 'T') : dateStr;
    const d = new Date(cleanStr);
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(d);
  } catch {
    return dateStr;
  }
}

/**
 * Tanggal hari ini dalam zona waktu LOKAL (YYYY-MM-DD).
 *
 * BUG FIX: `new Date().toISOString().slice(0, 10)` menghasilkan tanggal UTC.
 * Di WIB (UTC+7) pukul 00:30, tanggal UTC masih "kemarin" sehingga transaksi,
 * nota kulakan, dan laporan "Hari Ini" salah tanggal.
 */
export function localTodayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Tanggal lokal N hari kebelakang (YYYY-MM-DD) — aman terhadap overflow bulan.
 */
export function localDateOffset(days: number, d: Date = new Date()): string {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() - days);
  return localTodayStr(copy);
}

/**
 * Awal bulan sebelumnya (YYYY-MM-DD) — aman terhadap overflow `setMonth`.
 */
export function localPreviousMonthStr(d: Date = new Date()): string {
  const copy = new Date(d.getTime());
  copy.setDate(1);              // kunci ke tanggal 1 agar tidak overflow
  copy.setMonth(copy.getMonth() - 1);
  return localTodayStr(copy);
}
