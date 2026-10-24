import { createMiddleware } from 'hono/factory';
import { Bindings } from '../types';
import { constantTimeEquals } from '../utils/security';

/**
 * BUG FIX (keamanan): `OWNER_SECRET_KEY` sebelumnya DIDEKLARASIKAN tapi tidak
 * pernah dipakai — sehingga seluruh data keuangan toko (omzet, nama pelanggan,
 * piutang) terbuka untuk siapa pun yang mengetahui URL Worker. Klaim
 * "proteksi token" di README tidak pernah ada.
 *
 * Sekarang token DITEGAKAN:
 * - Bila `OWNER_SECRET_KEY` diset → semua endpoint `/api/*` WAJIB mengirim
 *   header `Authorization: Bearer <token>` (atau `x-owner-pin`).
 * - Bila `OWNER_SECRET_KEY` TIDAK diset → proteksi dimatikan (mode dev),
 *   dan aplikasi mobile menampilkan peringatan.
 *
 * Perbandingan token memakai constant-time comparison supaya tidak bisa
 * ditebak dengan timing attack.
 */
export const authMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const expected = c.env.OWNER_SECRET_KEY;
  if (!expected || !expected.trim()) {
    // Proteksi dimatikan (mode pengembangan). Endpoint tetap berjalan.
    return next();
  }

  const authHeader = c.req.header('Authorization') || '';
  const pinHeader = c.req.header('x-owner-pin') || '';
  const provided = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : pinHeader.trim();

  if (!provided || !constantTimeEquals(provided, expected.trim())) {
    return c.json(
      {
        error: 'Unauthorized. Endpoint ini memerlukan token akses yang valid.',
        hint: 'Kirim header "Authorization: Bearer <OWNER_SECRET_KEY>".',
      },
      401
    );
  }

  return next();
});
