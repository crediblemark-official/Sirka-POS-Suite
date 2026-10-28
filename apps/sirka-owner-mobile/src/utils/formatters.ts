/**
 * BUG FIX: `formatCompactNumber` sebelumnya memanggil `.toString()` pada
 * `amount` yang bisa `undefined` -> TypeError yang mematikan view.
 * Sekarang nilai tidak valid dikembalikan sebagai string aman.
 */
export function formatRupiah(amount: number | null | undefined): string {
  const safe = Number(amount);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number.isFinite(safe) ? safe : 0);
}

export function formatCompactNumber(amount: number | null | undefined): string {
  const safe = Number(amount);
  if (!Number.isFinite(safe)) return '0';
  const abs = Math.abs(safe);
  if (abs >= 1_000_000_000) {
    return (safe / 1_000_000_000).toFixed(1) + ' M';
  }
  if (abs >= 1_000_000) {
    return (safe / 1_000_000).toFixed(1) + ' jt';
  }
  if (abs >= 1_000) {
    return (safe / 1_000).toFixed(0) + ' rb';
  }
  return safe.toString();
}

/**
 * BUG FIX: `new Date('2026-10-22')` diparsing sebagai UTC midnight, lalu
 * dirender memakai zona waktu LOKAL -> di zona di belakang UTC tanggalnya
 *mundur satu hari (invoice "22 Okt" tampil "21 Okt").
 * Sekarang string ISO 'YYYY-MM-DD' diparse sebagai waktu LOKAL.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    // Tanggal polos (YYYY-MM-DD) -> parse sebagai waktu lokal, bukan UTC
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    const d = dateOnly
      ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
      : new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format timestamp shift yang aman (toleran format non-ISO).
 *
 * BUG FIX: worker mengirim `to_char(timestamptz, 'YYYY-MM-DD HH24:MI')` yang
 * BUKAN ISO-8601. WebKit/iOS mengembalikan "Invalid Date" untuk format itu.
 * Sekarang format 'YYYY-MM-DD HH:MM' diparse manual sebagai waktu lokal.
 */
export function formatShiftDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const raw = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(raw);
  try {
    const d = m
      ? new Date(
          Number(m[1]), Number(m[2]) - 1, Number(m[3]),
          Number(m[4]), Number(m[5]), Number(m[6] || 0)
        )
      : new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return raw;
  }
}

export function formatShiftTime(value: string | null | undefined): string {
  if (!value) return '-';
  const raw = String(value).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(raw);
  try {
    const d = m
      ? new Date(
          Number(m[1]), Number(m[2]) - 1, Number(m[3]),
          Number(m[4]), Number(m[5]), 0
        )
      : new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleTimeString('id-ID', { timeStyle: 'short' });
  } catch {
    return raw;
  }
}
