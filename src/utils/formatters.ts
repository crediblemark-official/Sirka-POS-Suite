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
