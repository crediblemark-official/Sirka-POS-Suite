import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { licenseService, getTertautConfig, saveTertautConfig, formatLicensingError } from '../services/licenseService';
import { getOrCreateHwid, getDeviceName, setDeviceName } from '../services/hwidService';
import { safeParse } from '@sirka/shared-utils';
const STORAGE_KEY_LICENSE = 'kasir_citra_license_data_v1';
export const useLicenseStore = defineStore('license', () => {
    // State HWID & Perangkat
    const hwid = ref('');
    const deviceName = ref(getDeviceName());
    // State Lisensi Utama
    const licenseKey = ref('');
    const status = ref('UNREGISTERED');
    const isValid = ref(false);
    const source = ref(null);
    const expiresAt = ref(null);
    const seatsUsed = ref(0);
    const maxSeats = ref(1);
    const floating = ref(false);
    const leaseKey = ref(null);
    const leaseTtlSeconds = ref(300);
    const heartbeatIntervalSeconds = ref(60);
    const offlineToken = ref(null);
    const licenseVersion = ref(1);
    const entitlements = ref({});
    const lastCheckedAt = ref(null);
    const customerEmail = ref('');
    const customerName = ref('');
    const minVersion = ref('0.1.0');
    // UI & Loading States
    const isChecking = ref(false);
    const isActivating = ref(false);
    const errorMessage = ref(null);
    const successMessage = ref(null);
    const showModal = ref(false);
    // Konfigurasi API Tertaut
    const apiConfig = ref(getTertautConfig());
    // Sesi Heartbeat Floating
    let heartbeatSession = null;
    // Baca cache lisensi lokal saat inisialisasi store
    const savedData = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_LICENSE) : null;
    const initial = safeParse(savedData, {}, 'LicenseStore');
    if (initial.licenseKey) {
        licenseKey.value = initial.licenseKey;
        status.value = initial.status || 'UNREGISTERED';
        isValid.value = !!initial.isValid;
        source.value = initial.source || null;
        expiresAt.value = initial.expiresAt || null;
        seatsUsed.value = initial.seatsUsed || 0;
        maxSeats.value = initial.maxSeats || 1;
        floating.value = !!initial.floating;
        leaseKey.value = initial.leaseKey || null;
        leaseTtlSeconds.value = initial.leaseTtlSeconds || 300;
        heartbeatIntervalSeconds.value = initial.heartbeatIntervalSeconds || 60;
        offlineToken.value = initial.offlineToken || null;
        licenseVersion.value = initial.licenseVersion || 1;
        entitlements.value = initial.entitlements || {};
        lastCheckedAt.value = initial.lastCheckedAt || null;
        customerEmail.value = initial.customerEmail || '';
        customerName.value = initial.customerName || '';
        if (initial.hwid) {
            hwid.value = initial.hwid;
        }
    }
    function saveToLocal() {
        if (typeof localStorage === 'undefined')
            return;
        const payload = {
            licenseKey: licenseKey.value,
            status: status.value,
            isValid: isValid.value,
            source: source.value,
            expiresAt: expiresAt.value,
            seatsUsed: seatsUsed.value,
            maxSeats: maxSeats.value,
            floating: floating.value,
            leaseKey: leaseKey.value,
            leaseTtlSeconds: leaseTtlSeconds.value,
            heartbeatIntervalSeconds: heartbeatIntervalSeconds.value,
            offlineToken: offlineToken.value,
            licenseVersion: licenseVersion.value,
            entitlements: entitlements.value,
            lastCheckedAt: lastCheckedAt.value,
            hwid: hwid.value,
            deviceName: deviceName.value,
            customerEmail: customerEmail.value,
            customerName: customerName.value,
            minVersion: minVersion.value
        };
        localStorage.setItem(STORAGE_KEY_LICENSE, JSON.stringify(payload));
    }
    // Computed Properties
    const isLicensed = computed(() => {
        return isValid.value && status.value !== 'EXPIRED' && status.value !== 'REVOKED' && status.value !== 'LEASE_EXPIRED';
    });
    const isOfflineVerification = computed(() => {
        return source.value === 'offline' || status.value === 'OFFLINE_GRACE';
    });
    const daysRemaining = computed(() => {
        if (!expiresAt.value)
            return null;
        const exp = new Date(expiresAt.value).getTime();
        const now = Date.now();
        const diff = exp - now;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    });
    const maskedLicenseKey = computed(() => {
        if (!licenseKey.value)
            return '-';
        const parts = licenseKey.value.split('-');
        if (parts.length < 2)
            return licenseKey.value;
        return `${parts[0]}-••••-••••-${parts[parts.length - 1]}`;
    });
    const statusLabel = computed(() => {
        switch (status.value) {
            case 'ACTIVE':
                return isOfflineVerification.value ? 'Aktif (Offline)' : 'Aktif (Online)';
            case 'OFFLINE_GRACE':
                return 'Aktif (Offline)';
            case 'EXPIRED':
                return 'Masa Berlaku Berakhir';
            case 'REVOKED':
                return 'Dicabut';
            case 'SEAT_FULL':
                return 'Kuota Penuh';
            case 'LEASE_EXPIRED':
                return 'Sesi Berakhir';
            case 'CHECKING':
                return 'Memeriksa...';
            case 'ERROR':
                return 'Gagal Validasi';
            case 'UNREGISTERED':
            default:
                return 'Belum Berlisensi';
        }
    });
    const statusBadgeClass = computed(() => {
        switch (status.value) {
            case 'ACTIVE':
                return isOfflineVerification.value
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'OFFLINE_GRACE':
                return 'bg-amber-50 text-amber-800 border-amber-200';
            case 'EXPIRED':
            case 'REVOKED':
                return 'bg-rose-50 text-rose-800 border-rose-200';
            case 'SEAT_FULL':
            case 'LEASE_EXPIRED':
                return 'bg-orange-50 text-orange-800 border-orange-200';
            case 'CHECKING':
                return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'UNREGISTERED':
            default:
                return 'bg-amber-50 text-amber-800 border-amber-200';
        }
    });
    /**
     * Menginisialisasi sistem lisensi saat aplikasi pertama kali boot.
     */
    async function init() {
        try {
            hwid.value = await getOrCreateHwid();
            deviceName.value = getDeviceName();
            if (licenseKey.value) {
                // Lakukan pengecekan pintar (dual-mode)
                await checkLicense(false);
                // Jika lisensi floating dan masih aktif, jalankan heartbeat session
                if (floating.value && leaseKey.value && isLicensed.value) {
                    startHeartbeat();
                }
            }
        }
        catch (err) {
            console.warn('[LicenseStore] Gagal inisialisasi lisensi:', err);
        }
    }
    /**
     * Mengaktivasi lisensi baru atau mengunci kursi perangkat ini.
     */
    async function activate(newKey, customName) {
        if (!newKey || !newKey.trim()) {
            errorMessage.value = 'Masukkan kode lisensi.';
            return { success: false, message: errorMessage.value };
        }
        isActivating.value = true;
        errorMessage.value = null;
        successMessage.value = null;
        try {
            if (!hwid.value) {
                hwid.value = await getOrCreateHwid();
            }
            if (customName && customName.trim()) {
                deviceName.value = customName.trim();
                setDeviceName(customName.trim());
            }
            const cleanKey = newKey.trim();
            const res = await licenseService.activate({
                licenseKey: cleanKey,
                hwid: hwid.value,
                deviceName: deviceName.value,
                config: apiConfig.value
            });
            if (res.success && res.data) {
                licenseKey.value = cleanKey;
                status.value = 'ACTIVE';
                isValid.value = true;
                source.value = 'online';
                expiresAt.value = res.data.expiresAt;
                seatsUsed.value = res.data.seatsUsed;
                maxSeats.value = res.data.maxSeats;
                floating.value = !!res.data.floating;
                leaseKey.value = res.data.leaseKey || null;
                leaseTtlSeconds.value = res.data.leaseTtlSeconds || 300;
                heartbeatIntervalSeconds.value = res.data.heartbeatIntervalSeconds || 60;
                offlineToken.value = res.data.licenseToken;
                licenseVersion.value = res.data.licenseVersion || 1;
                entitlements.value = res.data.entitlements || {};
                lastCheckedAt.value = new Date().toISOString();
                saveToLocal();
                if (floating.value && leaseKey.value) {
                    startHeartbeat();
                }
                successMessage.value = 'Aktivasi lisensi berhasil.';
                return { success: true, message: successMessage.value };
            }
            else {
                throw new Error(res.message || 'Aktivasi gagal.');
            }
        }
        catch (err) {
            const msg = formatLicensingError(err);
            errorMessage.value = msg;
            return { success: false, message: msg };
        }
        finally {
            isActivating.value = false;
        }
    }
    /**
     * Pengecekan lisensi berkala atau manual dengan fallback verifikasi offline token Ed25519.
     */
    async function checkLicense(forceOnline = false) {
        if (!licenseKey.value)
            return;
        isChecking.value = true;
        errorMessage.value = null;
        successMessage.value = null;
        try {
            if (!hwid.value) {
                hwid.value = await getOrCreateHwid();
            }
            const res = await licenseService.check({
                licenseKey: licenseKey.value,
                hwid: hwid.value,
                offlineToken: offlineToken.value,
                allowOfflineFallback: !forceOnline,
                appVersion: '0.1.0',
                config: apiConfig.value
            });
            isValid.value = res.valid;
            source.value = res.source;
            lastCheckedAt.value = new Date().toISOString();
            if (res.valid) {
                status.value = res.source === 'offline' ? 'OFFLINE_GRACE' : 'ACTIVE';
                if (res.expiresAt)
                    expiresAt.value = res.expiresAt;
                if (res.entitlements)
                    entitlements.value = res.entitlements;
                if (res.licenseVersion)
                    licenseVersion.value = res.licenseVersion;
                successMessage.value = 'Lisensi valid dan terverifikasi online.';
            }
            else {
                if (res.status === 'EXPIRED')
                    status.value = 'EXPIRED';
                else if (res.status === 'REVOKED')
                    status.value = 'REVOKED';
                else if (res.reason === 'SERVER_UNREACHABLE_NO_OFFLINE_TOKEN')
                    status.value = 'ERROR';
                else
                    status.value = 'ERROR';
                errorMessage.value = res.message || 'Lisensi tidak valid.';
                successMessage.value = null;
            }
            saveToLocal();
        }
        catch (err) {
            console.warn('[LicenseStore] Pengecekan lisensi gagal:', err);
            successMessage.value = null;
            // Jika offline dan ada token grace, jangan langsung mematikan aplikasi
            if (offlineToken.value && source.value === 'offline') {
                status.value = 'OFFLINE_GRACE';
            }
            else {
                errorMessage.value = formatLicensingError(err);
            }
        }
        finally {
            isChecking.value = false;
        }
    }
    /**
     * Validasi online penuh untuk merotasi token offline grace baru.
     */
    async function refreshOfflineToken() {
        if (!licenseKey.value)
            return;
        try {
            const res = await licenseService.validate({
                licenseKey: licenseKey.value,
                hwid: hwid.value,
                config: apiConfig.value
            });
            if (res.valid) {
                isValid.value = true;
                status.value = 'ACTIVE';
                source.value = 'online';
                if (res.offlineGraceToken) {
                    offlineToken.value = res.offlineGraceToken;
                }
                if (res.expiresAt)
                    expiresAt.value = res.expiresAt;
                saveToLocal();
            }
        }
        catch (err) {
            console.warn('[LicenseStore] Refresh offline token gagal:', err);
        }
    }
    /**
     * Melepas lisensi dari perangkat ini agar kuota kursi dapat digunakan di komputer lain.
     */
    async function deactivate() {
        if (!licenseKey.value)
            return { success: true };
        isActivating.value = true;
        errorMessage.value = null;
        try {
            stopHeartbeat();
            try {
                await licenseService.deactivate({
                    licenseKey: licenseKey.value,
                    hwid: hwid.value,
                    config: apiConfig.value
                });
            }
            catch (networkErr) {
                console.warn('[LicenseStore] Deaktivasi online ke server tidak berhasil, tetap melanjutkan reset lokal:', networkErr);
            }
            // Reset state lokal
            licenseKey.value = '';
            status.value = 'UNREGISTERED';
            isValid.value = false;
            source.value = null;
            expiresAt.value = null;
            seatsUsed.value = 0;
            leaseKey.value = null;
            offlineToken.value = null;
            entitlements.value = {};
            lastCheckedAt.value = null;
            saveToLocal();
            successMessage.value = 'Lisensi berhasil dilepas.';
            return { success: true, message: successMessage.value };
        }
        catch (err) {
            const msg = formatLicensingError(err);
            errorMessage.value = msg;
            return { success: false, message: msg };
        }
        finally {
            isActivating.value = false;
        }
    }
    /**
     * Menjalankan heartbeat session background untuk lisensi floating.
     */
    function startHeartbeat() {
        stopHeartbeat();
        if (!floating.value || !leaseKey.value || !licenseKey.value)
            return;
        heartbeatSession = licenseService.startHeartbeatSession({
            licenseKey: licenseKey.value,
            hwid: hwid.value,
            leaseKey: leaseKey.value,
            deviceName: deviceName.value,
            intervalSeconds: heartbeatIntervalSeconds.value || 60,
            config: apiConfig.value,
            onSuccess: (res) => {
                if (res.seatsUsed !== undefined)
                    seatsUsed.value = res.seatsUsed;
            },
            onLeaseExpired: (err) => {
                console.warn('[LicenseStore] Lease floating habis:', err);
                status.value = 'LEASE_EXPIRED';
                isValid.value = false;
                errorMessage.value = 'Sesi lisensi berakhir.';
                saveToLocal();
            },
            onError: (err) => {
                console.warn('[LicenseStore] Heartbeat error:', err.message);
            }
        });
    }
    function stopHeartbeat() {
        if (heartbeatSession) {
            try {
                heartbeatSession.stop();
            }
            catch { }
            heartbeatSession = null;
        }
    }
    /**
     * Memperbarui konfigurasi API Tertaut (App ID, API Key, Base URL).
     */
    function updateApiConfig(newConfig) {
        apiConfig.value = saveTertautConfig(newConfig);
    }
    /**
     * Helper pengecekan fitur entitlement (Feature Flags).
     */
    function hasFeature(featureName) {
        if (!isLicensed.value)
            return false;
        return !!entitlements.value[featureName];
    }
    function getFeature(featureName, defaultValue) {
        if (!isLicensed.value || entitlements.value[featureName] === undefined) {
            return defaultValue;
        }
        return entitlements.value[featureName];
    }
    function openLicenseModal(reason) {
        if (typeof reason === 'string' && reason && !isValid.value) {
            errorMessage.value = reason;
        }
        showModal.value = true;
    }
    function closeLicenseModal() {
        showModal.value = false;
    }
    return {
        // State
        hwid,
        deviceName,
        licenseKey,
        status,
        isValid,
        source,
        expiresAt,
        seatsUsed,
        maxSeats,
        floating,
        leaseKey,
        offlineToken,
        licenseVersion,
        entitlements,
        lastCheckedAt,
        customerEmail,
        customerName,
        minVersion,
        isChecking,
        isActivating,
        errorMessage,
        successMessage,
        showModal,
        apiConfig,
        // Computed
        isLicensed,
        isOfflineVerification,
        daysRemaining,
        maskedLicenseKey,
        statusLabel,
        statusBadgeClass,
        // Actions
        init,
        activate,
        checkLicense,
        refreshOfflineToken,
        deactivate,
        startHeartbeat,
        stopHeartbeat,
        updateApiConfig,
        hasFeature,
        getFeature,
        openLicenseModal,
        closeLicenseModal
    };
});
