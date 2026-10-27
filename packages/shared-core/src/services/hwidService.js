/**
 * Hardware ID (HWID) Service
 * Menghasilkan dan menyimpan fingerprint perangkat yang stabil dan ter-salt
 * untuk binding lisensi perangkat (device seat locking) pada tertaut.com.
 */
const HWID_STORAGE_KEY = 'kasir_citra_hwid_v1';
const DEVICE_NAME_STORAGE_KEY = 'kasir_citra_device_name_v1';
/**
 * Menghasilkan atau mengambil HWID unik yang konsisten untuk perangkat ini.
 * Menggunakan Web Crypto SHA-256 dengan salt aplikasi.
 */
export async function getOrCreateHwid() {
    if (typeof localStorage === 'undefined') {
        return 'HWID-STANDALONE-TEST-0001';
    }
    const existing = localStorage.getItem(HWID_STORAGE_KEY);
    if (existing && existing.startsWith('HWID-') && existing.length >= 16) {
        return existing;
    }
    try {
        // Kumpulkan komponen sidik jari lingkungan
        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Desktop';
        const lang = typeof navigator !== 'undefined' ? navigator.language : 'id-ID';
        const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) : 4;
        const screenRes = typeof screen !== 'undefined'
            ? `${screen.width}x${screen.height}x${screen.colorDepth || 24}`
            : '1920x1080x24';
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
        // Salt mesin acak unik untuk memastikan isolasi antar instalasi
        let machineSeed = localStorage.getItem('kasir_citra_machine_seed');
        if (!machineSeed) {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                machineSeed = crypto.randomUUID();
            }
            else {
                machineSeed = `${Math.random().toString(36).substring(2, 15)}-${Date.now().toString(36)}`;
            }
            localStorage.setItem('kasir_citra_machine_seed', machineSeed);
        }
        const payload = `KasirCitra:Salt:v1:${userAgent}::${lang}::${cores}::${screenRes}::${tz}::${machineSeed}`;
        // Hash menggunakan SHA-256 via Web Crypto API
        let hashHex = '';
        if (typeof crypto !== 'undefined' && crypto.subtle) {
            const data = new TextEncoder().encode(payload);
            const hashBuf = await crypto.subtle.digest('SHA-256', data);
            const hashBytes = Array.from(new Uint8Array(hashBuf));
            hashHex = hashBytes.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
        }
        else {
            // Fallback sederhana jika crypto.subtle tidak ada
            let hash = 0;
            for (let i = 0; i < payload.length; i++) {
                hash = ((hash << 5) - hash) + payload.charCodeAt(i);
                hash |= 0;
            }
            hashHex = Math.abs(hash).toString(16).padStart(16, '0').toUpperCase();
        }
        // Format yang rapi dan mudah dibaca: HWID-XXXX-XXXX-XXXX-XXXX
        const p1 = hashHex.substring(0, 4);
        const p2 = hashHex.substring(4, 8);
        const p3 = hashHex.substring(8, 12);
        const p4 = hashHex.substring(12, 16);
        const formattedHwid = `HWID-${p1}-${p2}-${p3}-${p4}`;
        localStorage.setItem(HWID_STORAGE_KEY, formattedHwid);
        return formattedHwid;
    }
    catch (err) {
        console.warn('[HWID Service] Gagal menghitung hardware ID, memakai fallback acak:', err);
        const fallback = `HWID-FB${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Date.now().toString(36).substring(2, 6).toUpperCase()}`;
        localStorage.setItem(HWID_STORAGE_KEY, fallback);
        return fallback;
    }
}
/**
 * Mendapatkan nama ramah perangkat untuk ditampilkan di dashboard admin Tertaut.
 */
export function getDeviceName() {
    if (typeof localStorage === 'undefined')
        return 'Kasir Utama Desktop';
    const custom = localStorage.getItem(DEVICE_NAME_STORAGE_KEY);
    if (custom && custom.trim())
        return custom.trim();
    let platformName = 'Desktop';
    if (typeof navigator !== 'undefined') {
        const ua = navigator.userAgent;
        if (/windows/i.test(ua))
            platformName = 'Windows';
        else if (/macintosh|mac os x/i.test(ua))
            platformName = 'macOS';
        else if (/linux/i.test(ua))
            platformName = 'Linux';
        else if (/android/i.test(ua))
            platformName = 'Android Tablet';
    }
    return `Kasir Citra POS (${platformName})`;
}
/**
 * Menyimpan kustomisasi nama perangkat.
 */
export function setDeviceName(name) {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEVICE_NAME_STORAGE_KEY, name.trim());
    }
}
