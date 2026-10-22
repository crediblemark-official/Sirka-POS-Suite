import { describe, expect, test } from 'bun:test';

/**
 * Uji logika keamanan "Kunci Perangkat" (SEC-3).
 *
 * Pada lingkungan tes tidak ada IndexedDB/WebView, jadi yang diuji adalah
 * primitif kripto yang dipakai: challenge signature + enkripsi AES-GCM via
 * ECDH. Ini memastikan private key benar-benar non-extractable (tidak bisa
 * diekspor) dan rahasia terenkripsi tidak bisa dibaca tanpa private key.
 */

const subtle = (globalThis.crypto as Crypto).subtle;

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

describe('Kunci Perangkat (device key)', () => {
  test('private key signing TIDAK bisa diekspor (non-extractable)', async () => {
    const pair = await subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, // extractable = false
      ['sign', 'verify']
    );
    expect(pair.privateKey.extractable).toBe(false);
    // Ekspor harus GAGAL — inilah inti keamanan device key.
    let exportFailed = false;
    try {
      await subtle.exportKey('pkcs8', pair.privateKey);
    } catch {
      exportFailed = true;
    }
    expect(exportFailed).toBe(true);
  });

  test('signature challenge hanya bisa diverifikasi dengan public key yang benar', async () => {
    const pair = await subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign', 'verify']
    );
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const signature = await subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.privateKey,
      challenge as unknown as BufferSource
    );

    const pub = await subtle.exportKey('jwk', pair.publicKey);
    const imported = await subtle.importKey(
      'jwk', pub, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
    );

    const valid = await subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      imported,
      signature,
      challenge as unknown as BufferSource
    );
    expect(valid).toBe(true);

    // Signature dari challenge LAIN tidak boleh valid
    const otherChallenge = crypto.getRandomValues(new Uint8Array(32));
    const invalid = await subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      imported,
      signature,
      otherChallenge as unknown as BufferSource
    );
    expect(invalid).toBe(false);
  });

  test('token Worker terenkripsi (ECDH + AES-GCM) tidak terbaca tanpa private key', async () => {
    // Kunci "perangkat" (ECDH, non-extractable)
    const device = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey']
    );
    const devicePublic = await subtle.exportKey('jwk', device.publicKey);

    // Kunci ephemeral (pengganti, boleh exportable)
    const ephemeral = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    );
    const ephemeralPublic = await subtle.exportKey('jwk', ephemeral.publicKey);

    const derive = async (priv: CryptoKey, pub: JsonWebKey) => subtle.deriveKey(
      { name: 'ECDH', public: await subtle.importKey('jwk', pub, { name: 'ECDH', namedCurve: 'P-256' }, false, []) },
      priv,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    const aesKey = await derive(device.privateKey, ephemeralPublic);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const secret = 'OWNER_SECRET_KEY-super-rahasia';
    const ciphertext = await subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new TextEncoder().encode(secret) as BufferSource
    );

    // Ciphertext TIDAK boleh mengandung plaintext
    const asText = new TextDecoder().decode(ciphertext);
    expect(asText).not.toContain(secret);
    expect(asText).not.toContain('OWNER_SECRET_KEY');

    // Dekripsi dengan private key perangkat yang benar -> berhasil
    const aesKey2 = await derive(device.privateKey, ephemeralPublic);
    const plaintext = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey2,
      ciphertext,
      ciphertext as BufferSource
    );
    expect(new TextDecoder().decode(plaintext)).toBe(secret);

    // Dekripsi dengan private key LAIN -> GAGAL
    const otherDevice = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey']
    );
    const wrongKey = await derive(otherDevice.privateKey, ephemeralPublic);
    let decryptFailed = false;
    try {
      await subtle.decrypt(
        { name: 'AES-GCM', iv },
        wrongKey,
        ciphertext,
        ciphertext as BufferSource
      );
    } catch {
      decryptFailed = true;
    }
    expect(decryptFailed).toBe(true);
  });

  test('IV acak dipakai setiap enkripsi (ciphertext berbeda untuk plaintext sama)', async () => {
    const device = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveKey']
    );
    const ephemeral = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    );
    const ephemeralPublic = await subtle.exportKey('jwk', ephemeral.publicKey);
    const aesKey = await subtle.deriveKey(
      {
        name: 'ECDH',
        public: await subtle.importKey('jwk', ephemeralPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
      },
      device.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const secret = 'token-sama';
    const enc = new TextEncoder().encode(secret) as BufferSource;
    const a = await subtle.encrypt({ name: 'AES-GCM', iv: crypto.getRandomValues(new Uint8Array(12)) }, aesKey, enc);
    const b = await subtle.encrypt({ name: 'AES-GCM', iv: crypto.getRandomValues(new Uint8Array(12)) }, aesKey, enc);
    expect(bytesToBase64(a)).not.toBe(bytesToBase64(b));
    expect(base64ToBytes(bytesToBase64(a)).length).toBe(a.byteLength);
  });
});

describe('Hash PIN fallback (bukan plaintext)', () => {
  const encoder = new TextEncoder();

  function b64(bytes: ArrayBuffer | Uint8Array): string {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let bin = '';
    for (let i = 0; i < view.length; i++) bin += String.fromCharCode(view[i]);
    return btoa(bin);
  }

  function unb64(s: string): Uint8Array {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function hashPin(pin: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const data = encoder.encode(`${b64(salt)}|${pin}`);
    const digest = await subtle.digest('SHA-256', data as BufferSource);
    return `${b64(salt)}.${b64(digest)}`;
  }

  async function verify(pin: string, stored: string): Promise<boolean> {
    const [saltB64, digestB64] = stored.split('.');
    if (!saltB64 || !digestB64) return false;
    const data = encoder.encode(`${saltB64}|${pin}`);
    const digest = new Uint8Array(await subtle.digest('SHA-256', data as BufferSource));
    const expected = unb64(digestB64);
    if (digest.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < digest.length; i++) diff |= digest[i] ^ expected[i];
    return diff === 0;
  }

  test('PIN tidak pernah disimpan sebagai teks polos', async () => {
    const stored = await hashPin('1234');
    expect(stored).not.toContain('1234');
    expect(stored.split('.')).toHaveLength(2);
  });

  test('PIN benar diverifikasi, PIN salah ditolak', async () => {
    const stored = await hashPin('1234');
    expect(await verify('1234', stored)).toBe(true);
    expect(await verify('1235', stored)).toBe(false);
    expect(await verify('', stored)).toBe(false);
  });

  test('salt acak → hash berbeda untuk PIN sama (rainbow table tidak berguna)', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a).not.toBe(b);
    // Tapi keduanya tetap memverifikasi PIN yang sama
    expect(await verify('1234', a)).toBe(true);
    expect(await verify('1234', b)).toBe(true);
  });
});
