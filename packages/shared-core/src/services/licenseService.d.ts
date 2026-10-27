/**
 * Tertaut.com Licensing Service
 * Integrasi client SDK @tertaut/sdk untuk Universal Cryptographic Licensing,
 * offline Ed25519 verification, device seat locking, dan floating lease heartbeat.
 */
import { Tertaut, type LicenseActivateResult, type LicenseCheckResult, type LicenseValidateResult, type HeartbeatSession } from '@tertaut/sdk';
import type { TertautApiConfig } from '@sirka/shared-types';
/**
 * Mendapatkan konfigurasi API Tertaut aktif.
 * Di mode produksi (build CI/CD): murni menggunakan nilai dari env variables.
 * Di mode dev: localStorage dapat digunakan untuk pengujian kustom.
 */
export declare function getTertautConfig(): TertautApiConfig;
/**
 * Menyimpan konfigurasi API Tertaut baru ke local storage.
 */
export declare function saveTertautConfig(config: Partial<TertautApiConfig>): TertautApiConfig;
/**
 * Membuat atau mendapatkan instance client SDK Tertaut.
 */
export declare function createTertautClient(customConfig?: Partial<TertautApiConfig>): Tertaut;
/**
 * Mengubah pesan error teknis menjadi pesan yang jelas dan ramah pengguna dalam Bahasa Indonesia.
 */
export declare function formatLicensingError(err: unknown): string;
export declare const licenseService: {
    /**
     * Mengaktivasi lisensi dan mengunci ke perangkat (HWID).
     */
    activate(payload: {
        licenseKey: string;
        hwid: string;
        deviceName?: string;
        config?: Partial<TertautApiConfig>;
    }): Promise<LicenseActivateResult>;
    /**
     * Memeriksa status lisensi dengan dual-mode:
     * 1. Mencoba validasi online ke server Tertaut.
     * 2. Jika offline/gangguan jaringan dan ada offlineToken, verifikasi kriptografis Ed25519 lokal.
     */
    check(payload: {
        licenseKey: string;
        hwid: string;
        offlineToken?: string | null;
        allowOfflineFallback?: boolean;
        appVersion?: string;
        config?: Partial<TertautApiConfig>;
    }): Promise<LicenseCheckResult>;
    /**
     * Validasi online penuh untuk memperbarui token offline grace Ed25519 yang terotasi.
     */
    validate(payload: {
        licenseKey: string;
        hwid: string;
        appVersion?: string;
        config?: Partial<TertautApiConfig>;
    }): Promise<LicenseValidateResult>;
    /**
     * Melepas kursi perangkat (deactivate seat) agar kuota seat dapat dipakai di PC lain.
     */
    deactivate(payload: {
        licenseKey: string;
        hwid: string;
        config?: Partial<TertautApiConfig>;
    }): Promise<boolean>;
    /**
     * Memulai sesi heartbeat berkala untuk lisensi tipe floating seat.
     */
    startHeartbeatSession(options: {
        licenseKey: string;
        hwid: string;
        leaseKey: string;
        intervalSeconds?: number;
        deviceName?: string;
        onSuccess?: (res: any) => void;
        onLeaseExpired?: (err: Error) => void;
        onError?: (err: Error) => void;
        config?: Partial<TertautApiConfig>;
    }): HeartbeatSession;
    /**
     * Mengambil URL checkout MoR (Merchant of Record) di Tertaut untuk pembelian/perpanjangan lisensi.
     */
    createCheckout(options: {
        customerEmail: string;
        customerName?: string;
        amount?: number;
        redirectUrl?: string;
        config?: Partial<TertautApiConfig>;
    }): Promise<import("@tertaut/sdk").CheckoutResult>;
};
//# sourceMappingURL=licenseService.d.ts.map