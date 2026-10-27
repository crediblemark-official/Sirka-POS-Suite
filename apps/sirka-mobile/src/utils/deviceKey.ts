/**
 * Kunci Perangkat (Device Key) — lapisan keamanan lokal untuk aplikasi Owner.
 *
 * BUG FIX (SEC-3): sebelumnya PIN Owner disimpan sebagai TEKS POLA di
 * `localStorage` (`sirka_owner_pin`). PIN tersebut bisa dibaca oleh:
 *  - skrip berbahaya (XSS) yang kebetulan jalan di WebView,
 *  - backup `adb backup` / file app yang di-root,
 *  - siapa pun yang punya akses file cache aplikasi.
 *
 * Pendekatan baru — TIDAK ada rahasia yang tersimpan sebagai teks:
 *  1. `generateKey(..., extractable: false)` menghasilkan pasangan kunci ECDSA
 *     P-256 yang **tidak dapat diekspor** oleh JavaScript. Private key hanya
 *     bisa dipakai untuk menandatangani, tidak pernah bisa dibaca.
 *  2. Private key disimpan di **IndexedDB** (sandbox privat aplikasi, tidak
 *     dibagi ke aplikasi lain di Android).
 *  3. "Unlock" = menandatangani challenge acak dengan private key, lalu
 *     memverifikasi signature dengan public key. Tidak ada password yang
 *     diketik user, tapi membuktiakan kepemilikan kunci perangkat ini.
 *  4. Token akses Worker (rahasia yang benar-benar melindungi data keuangan)
 *     di-ENKRIPSI dengan kunci ECDH perangkat + AES-GCM, sehingga tidak
 *     pernah ada token plaintext di localStorage.
 *  5. Bila perangkat mendukung **WebAuthn / platform authenticator**
 *     (Android: sidik jari / pattern / PIN layar kunci), Unlock juga
 *     meminta konfirmasi device credential — persis "kunci bawaan HP".
 *
 * Fallback: bila Web Crypto / IndexedDB tidak tersedia, aplikasi kembali ke
 * mode PIN lama (kompatibilitas).
 */

const DB_NAME = 'sirka_device_keys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';
const KEY_SIGN = 'signing';
const KEY_ECDH = 'ecdh';
const STORAGE_PUBLIC_SIGN = 'sirka_device_pubkey';
const STORAGE_PUBLIC_ECDH = 'sirka_device_ecdh_pub';
const STORAGE_DEVICE_ID = 'sirka_device_id';
/** Alias kunci di Android Keystore. */
const NATIVE_KEY_ALIAS = 'sirka_owner_device_key';

export interface SealedSecret {
  ephemeralPub: JsonWebKey;
  iv: string;
  ciphertext: string;
}

export interface DeviceKeyInfo {
  deviceId: string;
  publicKey: JsonWebKey;
  createdAt: string;
}

function isCryptoAvailable(): boolean {
  return typeof globalThis.crypto !== 'undefined'
    && typeof globalThis.crypto.subtle !== 'undefined'
    && typeof globalThis.indexedDB !== 'undefined';
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

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Fingerprint singkat dari public key — dipakai sebagai Device ID. */
async function fingerprint(publicKey: JsonWebKey): Promise<string> {
  // Hash dari koordinat public key (JWK). Tidak perlu export 'raw' karena
  // public key memang exportable.
  const material = `${publicKey.x || ''}.${publicKey.y || ''}`;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(material) as BufferSource
  );
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function isDeviceAuthSupported(): boolean {
  // Web Crypto tetap menjadi dasar (selalu tersedia di WebView).
  // Android Keystore native memperkuat: see `androidKeystore.ts`.
  return isCryptoAvailable();
}

import {
  isNativeKeystoreAvailable,
  ensureNativeKey,
  signWithNativeKey,
  requestNativeBiometric,
} from './androidKeystore';

export function isDeviceEnrolled(): boolean {
  if (!isCryptoAvailable()) return false;
  return Boolean(localStorage.getItem(STORAGE_PUBLIC_SIGN) && localStorage.getItem(STORAGE_DEVICE_ID));
}

export function getDeviceId(): string | null {
  return localStorage.getItem(STORAGE_DEVICE_ID);
}

export function getDeviceKeyInfo(): DeviceKeyInfo | null {
  const publicKeyRaw = localStorage.getItem(STORAGE_PUBLIC_SIGN);
  const deviceId = localStorage.getItem(STORAGE_DEVICE_ID);
  if (!publicKeyRaw || !deviceId) return null;
  try {
    return {
      deviceId,
      publicKey: JSON.parse(publicKeyRaw) as JsonWebKey,
      createdAt: localStorage.getItem('sirka_device_key_created') || ''
    };
  } catch {
    return null;
  }
}

/**
 * Daftarkan kunci perangkat. Idempotent — kalau sudah ada, tidak di-generate
 * ulang (maka kunci lama tetap berlaku).
 *
 * Di Android, bila plugin Android Keystore terpasang, kunci **hardware-backed**
 * dibuat di dalam keystore sistem (private key tidak pernah keluar dari HP).
 * Bila plugin belum terpasang, jatuh ke Web Crypto non-extractable.
 */
export async function enrollDeviceKey(): Promise<DeviceKeyInfo> {
  if (!isCryptoAvailable()) {
    throw new Error('Perangkat ini tidak mendukung Web Crypto (kunci perangkat tidak tersedia).');
  }

  const existingPub = localStorage.getItem(STORAGE_PUBLIC_SIGN);
  if (existingPub) {
    const info = getDeviceKeyInfo();
    if (info) return info;
  }

  // 1) Coba Android Keystore (hardware-backed) dulu
  const nativeAvailable = await isNativeKeystoreAvailable();
  if (nativeAvailable) {
    const created = await ensureNativeKey();
    if (created) {
      const deviceId = await nativeFingerprint();
      localStorage.setItem(STORAGE_PUBLIC_SIGN, JSON.stringify({ kty: 'EC', crv: 'P-256', ext: true, x: 'native', y: 'native' }));
      localStorage.setItem(STORAGE_PUBLIC_ECDH, JSON.stringify({ kty: 'EC', crv: 'P-256', ext: true, x: 'native', y: 'native' }));
      localStorage.setItem(STORAGE_DEVICE_ID, deviceId);
      localStorage.setItem('sirka_device_key_created', new Date().toISOString());
      localStorage.setItem('sirka_device_key_backend', 'android-keystore');
      return { deviceId, publicKey: { kty: 'EC' }, createdAt: localStorage.getItem('sirka_device_key_created') || '' };
    }
  }

  // 2) Fallback: Web Crypto non-extractable
  const signPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign', 'verify']
  );
  const signPublic = await crypto.subtle.exportKey('jwk', signPair.publicKey);
  await idbPut(KEY_SIGN, signPair.privateKey);

  // Kunci enkripsi (ECDH): NON-EXTRACTABLE
  const ecdhPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey', 'deriveBits']
  );
  const ecdhPublic = await crypto.subtle.exportKey('jwk', ecdhPair.publicKey);
  await idbPut(KEY_ECDH, ecdhPair.privateKey);

  const deviceId = await fingerprint(signPublic);
  localStorage.setItem(STORAGE_PUBLIC_SIGN, JSON.stringify(signPublic));
  localStorage.setItem(STORAGE_PUBLIC_ECDH, JSON.stringify(ecdhPublic));
  localStorage.setItem(STORAGE_DEVICE_ID, deviceId);
  localStorage.setItem('sirka_device_key_created', new Date().toISOString());
  localStorage.removeItem('sirka_device_key_backend');

  return { deviceId, publicKey: signPublic, createdAt: localStorage.getItem('sirka_device_key_created') || '' };
}

/** Backend kunci yang dipakai: 'android-keystore' atau 'webcrypto'. */
export function getKeyBackend(): 'android-keystore' | 'webcrypto' {
  return localStorage.getItem('sirka_device_key_backend') === 'android-keystore'
    ? 'android-keystore'
    : 'webcrypto';
}

/** Fingerprint perangkat untuk kunci native (berbasis id aplikasi + keystore). */
async function nativeFingerprint(): Promise<string> {
  const seed = `sirka-native-${NATIVE_KEY_ALIAS}-${navigator.userAgent.length}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed) as BufferSource);
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/** Hapus kunci perangkat (reset). */
export async function revokeDeviceKey(): Promise<void> {
  await idbDelete(KEY_SIGN).catch(() => {});
  await idbDelete(KEY_ECDH).catch(() => {});
  localStorage.removeItem(STORAGE_PUBLIC_SIGN);
  localStorage.removeItem(STORAGE_PUBLIC_ECDH);
  localStorage.removeItem(STORAGE_DEVICE_ID);
  localStorage.removeItem('sirka_device_key_created');
  localStorage.removeItem('sirka_device_key_backend');
}

/**
 * Tanda tangan challenge dengan private key perangkat.
 * Mengembalikan signature base64. whoever hanya punya public key tidak bisa
 * membuat signature yang valid.
 *
 * Di Android dengan plugin terpasang, private key berada di HARDWARE keystore
 * (tidak pernah keluar dari HP) & Unlock juga meminta biometrik.
 */
export async function signWithDeviceKey(challenge: Uint8Array): Promise<string> {
  // 1) Coba Android Keystore (hardware-backed)
  if (getKeyBackend() === 'android-keystore') {
    const payload = bytesToBase64(challenge);
    const nativeSig = await signWithNativeKey(payload);
    if (nativeSig) return nativeSig;
  }

  // 2) Fallback: Web Crypto non-extractable
  const privateKey = await idbGet<CryptoKey>(KEY_SIGN);
  if (!privateKey) throw new Error('Kunci perangkat tidak ditemukan. Daftarkan ulang di Setelan.');
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    challenge as unknown as BufferSource
  );
  return bytesToBase64(signature);
}

/** Verifikasi signature challenge dengan public key perangkat. */
export async function verifyDeviceSignature(
  challenge: Uint8Array,
  signatureB64: string
): Promise<boolean> {
  const publicKeyRaw = localStorage.getItem(STORAGE_PUBLIC_SIGN);
  if (!publicKeyRaw) return false;
  try {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(publicKeyRaw) as JsonWebKey,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify']
    );
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      base64ToBytes(signatureB64) as unknown as BufferSource,
      challenge as unknown as BufferSource
    );
  } catch {
    return false;
  }
}

/**
 * Minta konfirmasi kredensial perangkat (sidik jari / pattern / PIN layar
 * kunci Android) lewat WebAuthn bila platform authenticator tersedia.
 *
 * Mengembalikan `true` bila konfirmasi berhasil, `false` bila perangkat tidak
 * mendukung / pengguna membatalkan.
 */
export async function requestDeviceCredential(): Promise<boolean> {
  // 1) Android Keystore + BiometricPrompt (paling kuat)
  if (getKeyBackend() === 'android-keystore') {
    const ok = await requestNativeBiometric('Buka laporan keuangan Sirka');
    if (ok) return true;
  }

  // 2) WebAuthn (platform authenticator)
  try {
    if (typeof navigator === 'undefined' || !navigator.credentials) return false;
    if (!window.PublicKeyCredential) return false;

    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.();
    if (!available) return false;

    // Challenge acak; WebAuthn di Android memakai "platform" authenticator.
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60_000,
        userVerification: 'required',
        rpId: window.location.hostname || undefined,
        allowCredentials: [],
      } as unknown as PublicKeyCredentialRequestOptions,
      mediation: 'optional',
    } as CredentialRequestOptions);
    return true;
  } catch (err) {
    console.warn('[DeviceKey] WebAuthn tidak tersedia / ditolak:', err);
    return false;
  }
}

/**
 * Enkripsi rahasia (token Worker) dengan kunci ECDH perangkat + AES-GCM.
 * Hasilnya (ciphertext) aman disimpan di localStorage.
 */
export async function sealSecret(plaintext: string): Promise<SealedSecret> {
  const devicePrivate = await idbGet<CryptoKey>(KEY_ECDH);
  if (!devicePrivate) throw new Error('Kunci perangkat belum didaftarkan.');

  const devicePublicRaw = localStorage.getItem(STORAGE_PUBLIC_ECDH);
  if (!devicePublicRaw) throw new Error('Public key enkripsi perangkat tidak ditemukan.');

  // Kunci ephemeral (hanya untuk satu kali enkripsi)
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
  const ephemeralPublic = await crypto.subtle.exportKey('jwk', ephemeral.publicKey);

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: ephemeral.publicKey },
    devicePrivate,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );

  return {
    ephemeralPub: ephemeralPublic,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(ciphertext),
  };
}

/** Dekripsi rahasia yang sebelumnya di-seal. */
export async function openSecret(sealed: SealedSecret): Promise<string> {
  const devicePrivate = await idbGet<CryptoKey>(KEY_ECDH);
  if (!devicePrivate) throw new Error('Kunci perangkat tidak ditemukan.');

  const ephemeralPublic = await crypto.subtle.importKey(
    'jwk',
    sealed.ephemeralPub,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const aesKey = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: ephemeralPublic },
    devicePrivate,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(sealed.iv) as unknown as BufferSource },
    aesKey,
    base64ToBytes(sealed.ciphertext) as unknown as BufferSource
  );

  return new TextDecoder().decode(plaintext);
}
