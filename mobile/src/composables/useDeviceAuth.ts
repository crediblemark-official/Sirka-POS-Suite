import { ref, computed } from 'vue';
import {
  enrollDeviceKey,
  isDeviceEnrolled,
  isDeviceAuthSupported,
  getDeviceId,
  revokeDeviceKey,
  signWithDeviceKey,
  verifyDeviceSignature,
  requestDeviceCredential,
  sealSecret,
  openSecret,
  type SealedSecret
} from '../utils/deviceKey';

const STORAGE_PIN_ENABLED = 'sirka_owner_pin_enabled';
const STORAGE_PIN_HASH = 'sirka_owner_pin_hash';
const STORAGE_PIN = 'sirka_owner_pin';
const STORAGE_TOKEN_SEALED = 'sirka_owner_token_sealed';
const STORAGE_TOKEN_LEGACY = 'sirka_owner_api_token';
const STORAGE_DEVICE_AUTH = 'sirka_device_auth_enabled';

export type AuthMode = 'device' | 'pin' | 'none';

const isLocked = ref(false);
const isBusy = ref(false);
const errorMessage = ref('');
const deviceId = ref<string | null>(null);
const biometricAvailable = ref(false);

/** Mode autentikasi aktif: 'device' (kunci perangkat) atau 'pin' (fallback). */
const authMode = ref<AuthMode>('none');

/**
 * Hash PIN fallback — TIDAK disimpan sebagai teks polos.
 *
 * BUG FIX (SEC-3): PIN Owner dulu disimpan apa adanya di localStorage sehingga
 * bisa dibaca backup/skirp. Sekarang disimpan sebagai
 * `base64(salt || SHA-256(salt + pin))` dengan salt acak per perangkat.
 * PIN masih bisa dicek lokal (tidak ada server yang perlu理论研究), tapi
 * nilainya tidak lagi bisa dibaca langsung.
 */
async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const data = new TextEncoder().encode(`${bytesToBase64(salt)}|${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
  return `${bytesToBase64(salt)}.${bytesToBase64(digest)}`;
}

async function verifyPinHash(pin: string, stored: string): Promise<boolean> {
  const [saltB64, digestB64] = stored.split('.');
  if (!saltB64 || !digestB64) return false;
  try {
    const salt = base64ToBytes(saltB64);
    const data = new TextEncoder().encode(`${saltB64}|${pin}`);
    const digest = await crypto.subtle.digest('SHA-256', data as BufferSource);
    // Perbandingan constant-time
    const a = new Uint8Array(digest);
    const b = base64ToBytes(digestB64);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  } catch {
    return false;
  }
}

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/**
 * Deteksi mode autentikasi saat aplikasi start.
 *
 * Prioritas:
 *  1. Kunci perangkat (Web Crypto non-extractable + WebAuthn bila ada)
 *  2. PIN lama (fallback, TANPA plaintext — PIN dihapus setelah migrasi)
 *  3. Tidak ada kunci (aplikasi terbuka)
 */
export function initAuth(): AuthMode {
  const supported = isDeviceAuthSupported();
  const enrolled = supported && isDeviceEnrolled();
  const pinEnabled = localStorage.getItem(STORAGE_PIN_ENABLED) === 'true';
  const hasPin = Boolean(localStorage.getItem(STORAGE_PIN_HASH) || localStorage.getItem(STORAGE_PIN));

  deviceId.value = getDeviceId();

  if (enrolled) {
    authMode.value = 'device';
    isLocked.value = true;
  } else if (pinEnabled && hasPin) {
    authMode.value = 'pin';
    isLocked.value = true;
  } else {
    authMode.value = 'none';
    isLocked.value = false;
  }

  // Deteksi biometric asynchronously (tidak memblokir UI)
  if (enrolled) {
    isUserVerifyingPlatformAuthenticatorAvailable().then(v => { biometricAvailable.value = v; });
  }

  return authMode.value;
}

/**
 * Daftarkan kunci perangkat secara otomatis (tanpa interaksi user) bila
 * perangkat mendukung.
 *
 * Tujuannya: token akses Worker SELALU bisa disimpan terenkripsi, sehingga
 * tidak pernah ada rahasia plaintext di localStorage — bahkan untuk pengguna
 * yang tidak pernah menyentuh toggle "Kunci Perangkat".
 */
export async function autoEnrollDeviceKey(): Promise<boolean> {
  if (!isDeviceAuthSupported() || isDeviceEnrolled()) return false;
  try {
    await enrollDeviceKey();
    deviceId.value = getDeviceId();
    localStorage.setItem(STORAGE_DEVICE_AUTH, 'true');
    return true;
  } catch (err) {
    console.warn('[Auth] Auto-enroll kunci perangkat gagal:', err);
    return false;
  }
}

async function isUserVerifyingPlatformAuthenticatorAvailable(): Promise<boolean> {
  try {
    if (typeof PublicKeyCredential === 'undefined') return false;
    const fn = (PublicKeyCredential as any).isUserVerifyingPlatformAuthenticatorAvailable;
    if (typeof fn !== 'function') return false;
    return Boolean(await fn.call(PublicKeyCredential));
  } catch {
    return false;
  }
}

/**
 * Buka kunci dengan Kunci Perangkat.
 *
 * Alur: tandatangani challenge acak -> verifikasi dengan public key.
 * Bila perangkat mendukung kredensial platform (sidik jari/pattern HP),
 * konfirmasi device credential juga diminta.
 */
export async function unlockWithDeviceKey(): Promise<boolean> {
  if (isBusy.value) return false;
  isBusy.value = true;
  errorMessage.value = '';
  try {
    // 1. Konfirmasi kredensial perangkat (bila ada) — ini "kunci bawaan HP"
    const confirmed = await requestDeviceCredential();
    if (!confirmed) {
      // Tidak didukung / ditolak. Kalau perangkat TIDAK punya biometric,
      // tetap lanjut dengan proof-of-possession (challenge signature).
      const available = await isUserVerifyingPlatformAuthenticatorAvailable();
      if (available) {
        errorMessage.value = 'Konfirmasi perangkat ditolak atau dibatalkan.';
        return false;
      }
    }

    // 2. Bukti kepemilikan kunci: signature challenge
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const signature = await signWithDeviceKey(challenge);
    const ok = await verifyDeviceSignature(challenge, signature);
    if (!ok) {
      errorMessage.value = 'Verifikasi kunci perangkat gagal. Daftarkan ulang di Setelan.';
      return false;
    }

    isLocked.value = false;
    return true;
  } catch (err: any) {
    errorMessage.value = err?.message || 'Gagal membuka kunci perangkat.';
    return false;
  } finally {
    isBusy.value = false;
  }
}

/** Buka kunci dengan PIN lama (fallback) — PIN disimpan sebagai HASH. */
export async function unlockWithPin(pin: string): Promise<boolean> {
  errorMessage.value = '';
  const storedHash = localStorage.getItem(STORAGE_PIN_HASH);
  const legacyPin = localStorage.getItem(STORAGE_PIN);

  if (!storedHash && !legacyPin) {
    errorMessage.value = 'PIN belum diatur.';
    return false;
  }

  if (storedHash) {
    const ok = await verifyPinHash(pin, storedHash);
    if (ok) {
      isLocked.value = false;
      return true;
    }
    errorMessage.value = 'PIN salah, coba lagi.';
    return false;
  }

  // Legacy: PIN plaintext lama (hanya untuk perangkat yang belum dimigrasi)
  if (pin === legacyPin) {
    isLocked.value = false;
    return true;
  }
  errorMessage.value = 'PIN salah, coba lagi.';
  return false;
}

/** Simpan PIN fallback — disimpan sebagai HASH, bukan teks polos. */
export async function savePinHash(pin: string): Promise<void> {
  const clean = (pin || '').trim();
  if (!clean) {
    localStorage.removeItem(STORAGE_PIN_HASH);
    localStorage.removeItem(STORAGE_PIN);
    localStorage.setItem(STORAGE_PIN_ENABLED, 'false');
    return;
  }
  const hash = await hashPin(clean);
  localStorage.setItem(STORAGE_PIN_HASH, hash);
  localStorage.removeItem(STORAGE_PIN);
  localStorage.setItem(STORAGE_PIN_ENABLED, 'true');
}

/** Apakah PIN sudah disimpan (dalam bentuk hash)? */
export function hasPinConfigured(): boolean {
  return Boolean(localStorage.getItem(STORAGE_PIN_HASH) || localStorage.getItem(STORAGE_PIN));
}

/** Hapus PIN fallback sepenuhnya (dipakai saat migrasi ke kunci perangkat). */
export function clearPin(): void {
  localStorage.removeItem(STORAGE_PIN_HASH);
  localStorage.removeItem(STORAGE_PIN);
}

/**
 * Migrasi dari PIN lama ke Kunci Perangkat.
 *
 * Dipanggil setelah user berhasil unlock dengan PIN: private key dibuat,
 * PIN plaintext DIHAPUS dari localStorage, dan token Worker (bila ada)
 * dienkripsi ulang dengan kunci perangkat.
 */
export async function migratePinToDeviceKey(): Promise<boolean> {
  if (!isDeviceAuthSupported()) return false;
  try {
    await enrollDeviceKey();
    deviceId.value = getDeviceId();

    // Enkripsi token Worker lama (bila masih plaintext) lalu hapus plaintext
    const legacyToken = localStorage.getItem(STORAGE_TOKEN_LEGACY);
    if (legacyToken) {
      const sealed = await sealSecret(legacyToken);
      localStorage.setItem(STORAGE_TOKEN_SEALED, JSON.stringify(sealed));
      localStorage.removeItem(STORAGE_TOKEN_LEGACY);
    }

    // Hapus PIN ( plaintext maupun hash ) — kunci perangkat menggantikan
    clearPin();
    localStorage.setItem(STORAGE_PIN_ENABLED, 'false');
    localStorage.setItem(STORAGE_DEVICE_AUTH, 'true');

    authMode.value = 'device';
    return true;
  } catch (err: any) {
    console.warn('[Auth] Migrasi ke kunci perangkat gagal:', err);
    return false;
  }
}

/** Aktifkan kunci perangkat (dari Setelan). */
export async function enableDeviceAuth(): Promise<{ ok: boolean; message: string }> {
  if (!isDeviceAuthSupported()) {
    return {
      ok: false,
      message: 'Perangkat ini tidak mendukung kunci perangkat (Web Crypto/IndexedDB tidak tersedia).'
    };
  }
  try {
    await enrollDeviceKey();
    deviceId.value = getDeviceId();
    localStorage.setItem(STORAGE_DEVICE_AUTH, 'true');
    authMode.value = 'device';
    isLocked.value = true;
    return { ok: true, message: 'Kunci perangkat aktif. Aplikasi akan terkunci saat dibuka.' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Gagal mengaktifkan kunci perangkat.' };
  }
}

/** Nonaktifkan kunci perangkat (hapus kunci dari perangkat ini). */
export async function disableDeviceAuth(): Promise<{ ok: boolean; message: string }> {
  try {
    await revokeDeviceKey();
    localStorage.removeItem(STORAGE_DEVICE_AUTH);
    deviceId.value = null;
    authMode.value = 'none';
    isLocked.value = false;
    return { ok: true, message: 'Kunci perangkat dimatikan.' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Gagal menonaktifkan kunci perangkat.' };
  }
}

export function isDeviceAuthEnabled(): boolean {
  return localStorage.getItem(STORAGE_DEVICE_AUTH) === 'true';
}

/** Simpan token Worker — dienkripsi dengan kunci perangkat bila tersedia. */
export async function saveApiTokenSecure(token: string): Promise<void> {
  const clean = (token || '').trim();
  if (!clean) {
    localStorage.removeItem(STORAGE_TOKEN_SEALED);
    localStorage.removeItem(STORAGE_TOKEN_LEGACY);
    return;
  }
  if (isDeviceAuthSupported() && isDeviceEnrolled()) {
    const sealed = await sealSecret(clean);
    localStorage.setItem(STORAGE_TOKEN_SEALED, JSON.stringify(sealed));
    localStorage.removeItem(STORAGE_TOKEN_LEGACY);
  } else {
    // Tanpa kunci perangkat, simpan apa adanya (dengan peringatan caller).
    localStorage.setItem(STORAGE_TOKEN_LEGACY, clean);
  }
}

/** Ambil token Worker (dekripsi bila tersegel). */
export async function getApiTokenSecure(): Promise<string> {
  const sealedRaw = localStorage.getItem(STORAGE_TOKEN_SEALED);
  if (sealedRaw) {
    try {
      const sealed = JSON.parse(sealedRaw) as SealedSecret;
      return await openSecret(sealed);
    } catch (err) {
      console.warn('[Auth] Gagal mendekripsi token akses:', err);
      return '';
    }
  }
  return localStorage.getItem(STORAGE_TOKEN_LEGACY) || '';
}

/** Apakah token tersimpan dalam bentuk terenkripsi? */
export function isTokenEncrypted(): boolean {
  return Boolean(localStorage.getItem(STORAGE_TOKEN_SEALED));
}

export function useDeviceAuth() {
  return {
    isLocked,
    isBusy,
    errorMessage,
    deviceId,
    authMode,
    biometricAvailable,
    initAuth,
    autoEnrollDeviceKey,
    unlockWithDeviceKey,
    unlockWithPin,
    savePinHash,
    hasPinConfigured,
    clearPin,
    migratePinToDeviceKey,
    enableDeviceAuth,
    disableDeviceAuth,
    isDeviceAuthEnabled,
    saveApiTokenSecure,
    getApiTokenSecure,
    isTokenEncrypted,
  };
}
