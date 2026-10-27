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
export declare function safeParse<T>(raw: string | null | undefined, fallback: T, label?: string): T;
/**
 * Clone objek/array secara aman (menggantikan JSON.parse(JSON.stringify(x)))
 * dengan fallback bila input tidak bisa diserialisasi (mis. BigInt/circular).
 */
export declare function safeClone<T>(value: T, fallback: T): T;
//# sourceMappingURL=storage.d.ts.map