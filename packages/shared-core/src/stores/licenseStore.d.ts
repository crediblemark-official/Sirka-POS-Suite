import type { LicenseStatus, TertautApiConfig } from '@sirka/shared-types';
export declare const useLicenseStore: import("pinia").SetupStoreDefinition<"license", {
    hwid: import("vue").Ref<string, string>;
    deviceName: import("vue").Ref<string, string>;
    licenseKey: import("vue").Ref<string, string>;
    status: import("vue").Ref<LicenseStatus, LicenseStatus>;
    isValid: import("vue").Ref<boolean, boolean>;
    source: import("vue").Ref<"online" | "offline" | null, "online" | "offline" | null>;
    expiresAt: import("vue").Ref<string | null, string | null>;
    seatsUsed: import("vue").Ref<number, number>;
    maxSeats: import("vue").Ref<number, number>;
    floating: import("vue").Ref<boolean, boolean>;
    leaseKey: import("vue").Ref<string | null, string | null>;
    offlineToken: import("vue").Ref<string | null, string | null>;
    licenseVersion: import("vue").Ref<number, number>;
    entitlements: import("vue").Ref<Record<string, any>, Record<string, any>>;
    lastCheckedAt: import("vue").Ref<string | null, string | null>;
    customerEmail: import("vue").Ref<string, string>;
    customerName: import("vue").Ref<string, string>;
    minVersion: import("vue").Ref<string, string>;
    isChecking: import("vue").Ref<boolean, boolean>;
    isActivating: import("vue").Ref<boolean, boolean>;
    errorMessage: import("vue").Ref<string | null, string | null>;
    successMessage: import("vue").Ref<string | null, string | null>;
    showModal: import("vue").Ref<boolean, boolean>;
    apiConfig: import("vue").Ref<{
        apiKey: string;
        appId: string;
        baseUrl: string;
    }, TertautApiConfig | {
        apiKey: string;
        appId: string;
        baseUrl: string;
    }>;
    isLicensed: import("vue").ComputedRef<boolean>;
    isOfflineVerification: import("vue").ComputedRef<boolean>;
    daysRemaining: import("vue").ComputedRef<number | null>;
    maskedLicenseKey: import("vue").ComputedRef<string>;
    statusLabel: import("vue").ComputedRef<"Aktif (Offline)" | "Aktif (Online)" | "Masa Berlaku Berakhir" | "Dicabut" | "Kuota Penuh" | "Sesi Berakhir" | "Memeriksa..." | "Gagal Validasi" | "Belum Berlisensi">;
    statusBadgeClass: import("vue").ComputedRef<"bg-blue-50 text-blue-700 border-blue-200" | "bg-emerald-50 text-emerald-700 border-emerald-200" | "bg-amber-50 text-amber-800 border-amber-200" | "bg-rose-50 text-rose-800 border-rose-200" | "bg-orange-50 text-orange-800 border-orange-200">;
    init: () => Promise<void>;
    activate: (newKey: string, customName?: string) => Promise<{
        success: boolean;
        message: string;
    }>;
    checkLicense: (forceOnline?: boolean) => Promise<void>;
    refreshOfflineToken: () => Promise<void>;
    deactivate: () => Promise<{
        success: boolean;
        message?: undefined;
    } | {
        success: boolean;
        message: string;
    }>;
    startHeartbeat: () => void;
    stopHeartbeat: () => void;
    updateApiConfig: (newConfig: Partial<TertautApiConfig>) => void;
    hasFeature: (featureName: string) => boolean;
    getFeature: <T = any>(featureName: string, defaultValue?: T) => T;
    openLicenseModal: (reason?: string | Event) => void;
    closeLicenseModal: () => void;
}>;
//# sourceMappingURL=licenseStore.d.ts.map