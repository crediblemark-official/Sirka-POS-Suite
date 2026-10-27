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

/**
 * Awal bulan berjalan (YYYY-MM-DD) dalam zona waktu lokal.
 */
export function localMonthStartStr(d: Date = new Date()): string {
  const copy = new Date(d.getTime());
  copy.setDate(1);
  return localTodayStr(copy);
}

/**
 * Memastikan nama mitra supplier selalu terisi dengan benar (fallback bila database lama/sinkronisasi sempat kosong)
 */
export function resolveProductSupplier(prod?: {
  supplier?: string | null;
  category?: string | null;
  code?: string | null;
} | null): string {
  if (!prod) return '-';
  const supp = (prod.supplier || '').trim();
  if (supp && supp !== '-') return supp;

  const cat = (prod.category || '').trim();
  const code = (prod.code || '').trim().toUpperCase();

  // 1. Fallback by code prefix
  if (code.startsWith('ST-')) return 'Sayur Tufel';
  if (code.startsWith('PA-')) return 'Pak Agus';
  if (code.startsWith('HB-')) return 'Hari Barokah';
  if (code.startsWith('FF-')) return 'Fadhil Food';
  if (code.startsWith('HP-')) return 'Haff Pro Jaya';
  if (code.startsWith('PC-')) return 'Pantry Co';
  if (code.startsWith('KD-')) return 'Koko Didid';
  if (code.startsWith('APD-') || cat === 'APD & Sabun') return 'Mitra APD & Sanitasi';
  if (code.startsWith('ATK-') || cat === 'ATK & Kertas') return 'CV Surya Gemilang ATK';

  // 2. Fallback by category mapping (commodity categories or legacy vendor categories)
  if (cat === 'Sayuran Segar' || cat === 'Sayur Tufel') return 'Sayur Tufel';
  if (cat === 'Bumbu Kering & Rempah' || cat === 'Pak Agus') return 'Pak Agus';
  if (cat === 'Saus, Kecap & Tepung' || cat === 'Hari Barokah') return 'Hari Barokah';
  if (cat === 'Daging & Telur' || cat === 'Fadhil Food') return 'Fadhil Food';
  if (cat === 'Tahu, Tempe & Bawang' || cat === 'Haff Pro Jaya' || cat === 'Haff Pro') return 'Haff Pro Jaya';
  if (cat === 'Buah Segar' || cat === 'Pantry Co') return 'Pantry Co';
  if (cat === 'Beras & Minyak' || cat === 'Koko Didid') return 'Koko Didid';

  return '-';
}

/**
 * Parse tanggal 'YYYY-MM-DD' sebagai WAKTU LOKAL (bukan UTC).
 * `new Date('2026-10-22')` = UTC midnight -> di WIB mundur 7 jam.
 */
export function parseLocalDate(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(dateStr);
}

