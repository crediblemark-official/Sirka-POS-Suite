/**
 * Hardware ID (HWID) Service
 * Menghasilkan dan menyimpan fingerprint perangkat yang stabil dan ter-salt
 * untuk binding lisensi perangkat (device seat locking) pada tertaut.com.
 */
/**
 * Menghasilkan atau mengambil HWID unik yang konsisten untuk perangkat ini.
 * Menggunakan Web Crypto SHA-256 dengan salt aplikasi.
 */
export declare function getOrCreateHwid(): Promise<string>;
/**
 * Mendapatkan nama ramah perangkat untuk ditampilkan di dashboard admin Tertaut.
 */
export declare function getDeviceName(): string;
/**
 * Menyimpan kustomisasi nama perangkat.
 */
export declare function setDeviceName(name: string): void;
//# sourceMappingURL=hwidService.d.ts.map