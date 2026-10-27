/**
 * Definisi Tipe Sistem Lisensi Tertaut (tertaut.com)
 */

export type LicenseStatus =
  | 'UNREGISTERED'   // Belum ada lisensi yang dimasukkan (Fitur Terkunci)
  | 'ACTIVE'         // Aktif dan sah (terverifikasi online atau via offline token)
  | 'EXPIRED'        // Masa berlaku lisensi telah habis
  | 'REVOKED'        // Lisensi dicabut atau dibatalkan oleh penerbit
  | 'SEAT_FULL'      // Batas kuota kursi/perangkat telah tercapai
  | 'LEASE_EXPIRED'  // Floating seat lease habis masa berlakunya
  | 'OFFLINE_GRACE'  // Terverifikasi lokal via Ed25519 (mode offline)
  | 'CHECKING'       // Sedang memvalidasi ke server
  | 'ERROR';         // Terjadi kesalahan jaringan / kredensial

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
