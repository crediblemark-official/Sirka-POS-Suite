/**
 * Helper parsing localStorage yang aman.
 *
 * BUG FIX: `JSON.parse(localStorage.getItem(...))` tanpa try/catch membuat
 * satu nilai korup (mis. storage penuh / write terpotong / data versi lama)
 * melempar SyntaxError SAAT STORE DIBUAT. Karena Pinia setup store gagal di
 * awal, seluruh aplikasi tidak bisa start.
 *
 * Helper ini mengembalikan nilai default bila data kosong, tidak valid, atau
 * bernilai `null` (string "null" adalah JSON valid tetapi tidak boleh dipakai).
 */
export function safeParse<T>(raw: string | null | undefined, fallback: T, label?: string): T {
  if (raw === null || raw === undefined || raw === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch (e) {
    console.warn(`[${label || 'Store'}] Gagal parse localStorage, memakai nilai default:`, e);
    return fallback;
  }
}

/**
 * Clone objek/array secara aman (menggantikan JSON.parse(JSON.stringify(x)))
 * dengan fallback bila input tidak bisa diserialisasi (mis. BigInt/circular).
 */
export function safeClone<T>(value: T, fallback: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch (e) {
    console.warn('[Store] Gagal clone data, memakai nilai default:', e);
    return fallback;
  }
}
