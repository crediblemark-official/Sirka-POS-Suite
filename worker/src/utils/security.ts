/** Perbandingan string constant-time (mencegah timing attack). */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Tetap lakukan perbandingan agar durasi tidak bocor lewat panjang.
    let diff = 1;
    for (let i = 0; i < a.length; i++) {
      diff |= a.charCodeAt(i) ^ (i < b.length ? b.charCodeAt(i) : 0);
    }
    return diff === 0;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
