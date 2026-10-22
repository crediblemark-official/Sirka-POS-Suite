/**
 * Jembatan ke plugin Android Keystore (native) dengan fallback Web Crypto.
 *
 * BUG FIX (SEC-3): aplikasi memakai kunci kripto non-extractable milik
 * perangkat. Di Android, versi YANG LEBIH KUAT memakai Android Keystore
 * (hardware-backed) + BiometricPrompt. Plugin native hanya ada bila
 * `scripts/install-android-keystore.mjs` sudah dijalankan — karena itu
 * pemeriksaan di bawah selalu aman dan jatuh ke Web Crypto bila plugin
 * tidak tersedia.
 *
 * Pemeriksaan ketersediaan dilakukan sekali lalu di-cache.
 */

const PLUGIN_NAME = 'android-keystore';
const KEY_ALIAS = 'sirka_owner_device_key';

let availabilityCache: { available: boolean; strongBox: boolean; biometric: boolean } | null = null;

function isTauriAndroid(): boolean {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isAndroid = /Android/i.test(ua);
    const isTauri = '__TAURI_INTERNALS__' in (globalThis as any);
    return isAndroid && isTauri;
  } catch {
    return false;
  }
}

async function invokePlugin<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(`plugin:${PLUGIN_NAME}|${cmd}`, args);
}

/**
 * Apakah plugin Android Keystore terpasang & perangkatnya mendukung?
 */
export async function isNativeKeystoreAvailable(): Promise<boolean> {
  if (!isTauriAndroid()) return false;
  if (availabilityCache) return availabilityCache.available;
  try {
    const res = await invokePlugin<{ available: boolean; strongBox: boolean; biometric: boolean }>(
      'isAvailable'
    );
    availabilityCache = res;
    return !!res?.available;
  } catch (e) {
    console.warn('[AndroidKeystore] Plugin tidak tersedia, memakai Web Crypto:', e);
    availabilityCache = { available: false, strongBox: false, biometric: false };
    return false;
  }
}

/** Apakah perangkat punya StrongBox (hardware security envelope)? */
export async function hasStrongBox(): Promise<boolean> {
  if (!isTauriAndroid()) return false;
  try {
    const res = await invokePlugin<{ available: boolean; strongBox: boolean }>('isAvailable');
    return !!res?.strongBox;
  } catch {
    return false;
  }
}

/**
 * Minta konfirmasi biometrik / kredensial layar kunci.
 * Mengembalikan true bila pengguna berhasil diverifikasi.
 */
export async function requestNativeBiometric(reason: string): Promise<boolean> {
  if (!isTauriAndroid()) return false;
  try {
    const res = await invokePlugin<{ authenticated: boolean }>('authenticate', { reason });
    return !!res?.authenticated;
  } catch (e) {
    console.warn('[AndroidKeystore] Autentikasi native gagal/ditolak:', e);
    return false;
  }
}

/**
 * Pastikan kunci native tersedia (dibuat bila belum).
 */
export async function ensureNativeKey(): Promise<boolean> {
  if (!isTauriAndroid()) return false;
  try {
    await invokePlugin('generateKey', { alias: KEY_ALIAS });
    return true;
  } catch (e) {
    console.warn('[AndroidKeystore] Gagal membuat kunci native:', e);
    return false;
  }
}

/**
 * Tandatangani payload (base64) dengan private key di Android Keystore.
 * Mengembalikan signature base64.
 */
export async function signWithNativeKey(payloadBase64: string): Promise<string | null> {
  if (!isTauriAndroid()) return null;
  try {
    const res = await invokePlugin<{ signature: string }>('sign', {
      alias: KEY_ALIAS,
      payload: payloadBase64
    });
    return res?.signature ?? null;
  } catch (e) {
    console.warn('[AndroidKeystore] Gagal menandatangani dengan kunci native:', e);
    return null;
  }
}

/** Hapus kunci native dari perangkat. */
export async function deleteNativeKey(): Promise<void> {
  if (!isTauriAndroid()) return;
  try {
    await invokePlugin('deleteKey', { alias: KEY_ALIAS });
  } catch (e) {
    console.warn('[AndroidKeystore] Gagal menghapus kunci native:', e);
  }
}

/** Reset cache ketersediaan (dipanggil saat status berubah). */
export function resetKeystoreAvailabilityCache(): void {
  availabilityCache = null;
}
