/**
 * Definisi Tipe Sistem Lisensi Tertaut (tertaut.com)
 */
export type LicenseStatus = 'UNREGISTERED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SEAT_FULL' | 'LEASE_EXPIRED' | 'OFFLINE_GRACE' | 'CHECKING' | 'ERROR';
export interface LicenseInfo {
    licenseKey: string;
    status: LicenseStatus;
    isValid: boolean;
    source: 'online' | 'offline' | null;
    expiresAt: string | null;
    seatsUsed: number;
    maxSeats: number;
    floating: boolean;
    leaseKey?: string | null;
    leaseTtlSeconds?: number;
    heartbeatIntervalSeconds?: number;
    offlineToken?: string | null;
    licenseVersion: number;
    entitlements: Record<string, any>;
    lastCheckedAt: string | null;
    hwid: string;
    deviceName: string;
    customerEmail?: string;
    customerName?: string;
    minVersion?: string;
}
export interface TertautApiConfig {
    apiKey: string;
    appId: string;
    baseUrl: string;
}
export interface LicenseActivationPayload {
    licenseKey: string;
    deviceName?: string;
}
export interface LicenseCheckResultPayload {
    valid: boolean;
    source: 'online' | 'offline';
    status: string;
    expiresAt: string | null;
    entitlements: Record<string, any>;
    licenseVersion: number;
    reason?: string;
    message?: string;
}
//# sourceMappingURL=license.d.ts.map