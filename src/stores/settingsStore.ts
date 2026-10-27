import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { StoreSetting, BusinessType, BUSINESS_MODES } from '../types';
import { dbService } from '../services/dbService';
import { applyTheme } from '../utils/theme';
import { safeParse } from '../utils/storage';

const STORAGE_KEY_SETTINGS = 'kasir_citra_settings_v1';
// BUG FIX (keamanan): token akses Worker TIDAK boleh ikut ter-sync ke cloud.
const STORAGE_KEY_OWNER_API_TOKEN = 'kasir_citra_owner_api_token';

const DEFAULT_SETTINGS: Record<string, string> = {
  store_name: 'Sirka',
  store_code: 'SIRKA',
  store_tagline: 'Sistem Kasir & Operasional Bisnis Terpadu',
  store_address: 'Jl. Niaga Utama No. 8',
  store_phone: '0812-3456-7890',
  invoice_prefix: 'INV',
  store_logo: '',
  business_type: 'universal',
  ui_shell_mode: 'auto',
  primary_color: '#2563eb',
  theme_preset: 'blue',
  header_accent_style: 'accent-line',
  surface_theme: 'bone-white',
  custom_surface_color: '#fcfbfa',
  printer_network_address: '127.0.0.1:9100',
  receipt_paper_width: '58mm',
  receipt_footer: 'Terima kasih atas kunjungan Anda'
};

export const useSettingsStore = defineStore('settings', () => {
  const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
  // BUG FIX: JSON.parse tanpa try/catch + nilai default selalu digabung agar
  // setting baru (mis. printer) tidak hilang bila cache lama belum punya.
  const settings = ref<Record<string, string>>({
    ...DEFAULT_SETTINGS,
    ...safeParse<Record<string, string>>(saved, {}, 'SettingsStore')
  });

  // If user previously had default classic-gray, upgrade to requested bone-white
  if (!settings.value.surface_theme || settings.value.surface_theme === 'classic-gray') {
    settings.value.surface_theme = 'bone-white';
    settings.value.custom_surface_color = '#fcfbfa';
    saveLocal();
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings.value));
    } catch (err) {
      console.warn('[SettingsStore] localStorage setItem failed (e.g. QuotaExceededError), retrying without logo:', err);
      try {
        const withoutLogo = { ...settings.value, store_logo: '' };
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(withoutLogo));
      } catch (innerErr) {
        console.error('[SettingsStore] localStorage save failed completely:', innerErr);
      }
    }
  }

  function applyCurrentTheme() {
    const color = settings.value.primary_color || '#2563eb';
    const headerStyle = settings.value.header_accent_style || 'accent-line';
    const surfaceId = settings.value.surface_theme || 'bone-white';
    const customSurface = settings.value.custom_surface_color || '#fcfbfa';
    applyTheme(color, headerStyle, surfaceId, customSurface);
  }

  async function fetchSettings() {
    try {
      const data: StoreSetting[] = await dbService.getSettings();
      if (data && data.length > 0) {
        for (const item of data) {
          settings.value[item.key] = item.value;
        }
        saveLocal();
        applyCurrentTheme();
      }
    } catch (e) {
      console.warn('[SettingsStore] Failed to fetch settings:', e);
    }
  }

  // Initial theme application
  applyCurrentTheme();
  fetchSettings();

  async function updateSetting(key: string, value: string) {
    settings.value[key] = value;
    saveLocal();
    if (key === 'primary_color' || key === 'header_accent_style' || key === 'surface_theme' || key === 'custom_surface_color') {
      applyCurrentTheme();
    }
    // BUG FIX: error DB sebelumnya dibiarkan menetu (unhandled rejection) ->
    // "Save Branding" gagal diam-diam tanpa pesan ke user. Sekarang error
    // dilempar agar pemanggil bisa menanganinya.
    await dbService.updateSetting(key, value);
  }

  /**
   * Token akses Worker (OWNER_SECRET_KEY).
   *
   * BUG FIX (keamanan): token disimpan KHUSUS di localStorage perangkat ini —
   * BUKAN di `store_settings` (tabel yang ikut ter-sinkron ke PostgreSQL cloud).
   * Kalau ikut ter-sync, token akses akan tersimpan di database dan bisa
   * dibaca siapa pun yang punya akses ke cloud.
   */
  const ownerApiToken = ref<string>(
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY_OWNER_API_TOKEN)
      : null) || ''
  );

  function setOwnerApiToken(token: string) {
    ownerApiToken.value = (token || '').trim();
    if (typeof localStorage !== 'undefined') {
      if (ownerApiToken.value) {
        localStorage.setItem(STORAGE_KEY_OWNER_API_TOKEN, ownerApiToken.value);
      } else {
        localStorage.removeItem(STORAGE_KEY_OWNER_API_TOKEN);
      }
    }
  }

  async function setTheme(colorHex: string, presetId: string = 'custom', headerStyle?: string) {
    settings.value.primary_color = colorHex;
    settings.value.theme_preset = presetId;
    if (headerStyle) {
      settings.value.header_accent_style = headerStyle;
    }
    saveLocal();
    applyCurrentTheme();

    await Promise.all([
      dbService.updateSetting('primary_color', colorHex),
      dbService.updateSetting('theme_preset', presetId),
      headerStyle ? dbService.updateSetting('header_accent_style', headerStyle) : Promise.resolve()
    ]);
  }

  async function setSurfaceTheme(surfaceId: string, customHex?: string) {
    settings.value.surface_theme = surfaceId;
    if (customHex) {
      settings.value.custom_surface_color = customHex;
    }
    saveLocal();
    applyCurrentTheme();

    await Promise.all([
      dbService.updateSetting('surface_theme', surfaceId),
      customHex ? dbService.updateSetting('custom_surface_color', customHex) : Promise.resolve()
    ]);
  }

  // --- Business Mode & Universal Engine ---
  const businessType = computed<BusinessType>(() => (settings.value.business_type as BusinessType) || 'universal');
  const currentBusinessConfig = computed(() => BUSINESS_MODES[businessType.value] || BUSINESS_MODES.universal);
  const businessFeatures = computed(() => currentBusinessConfig.value.features);
  const businessTerminology = computed(() => currentBusinessConfig.value.terminology);

  const isRetail = computed(() => businessType.value === 'retail');
  const isFnb = computed(() => businessType.value === 'fnb');
  const isService = computed(() => businessType.value === 'service');
  const isWholesale = computed(() => businessType.value === 'wholesale');
  const isUniversal = computed(() => businessType.value === 'universal');

  async function setBusinessType(type: BusinessType) {
    settings.value.business_type = type;
    saveLocal();
    await dbService.updateSetting('business_type', type);
  }

  const storeName = computed(() => settings.value.store_name || 'Sirka');
  const storeCode = computed(() => {
    if (settings.value.store_code && settings.value.store_code.trim()) {
      return settings.value.store_code.trim().toUpperCase();
    }
    const name = (settings.value.store_name || '').replace(/^(toko|kasir|warung|cv|pt|ud)\s+/i, '').trim();
    if (!name) return 'SIRKA';
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      return words[0].toUpperCase();
    }
    return words.map(w => w[0]).join('').toUpperCase() || 'SIRKA';
  });
  const storeAbbreviation = computed(() => storeCode.value);
  const storeTagline = computed(() => settings.value.store_tagline || currentBusinessConfig.value.tagline);
  const storeAddress = computed(() => settings.value.store_address || '');
  const storePhone = computed(() => settings.value.store_phone || '');
  const invoicePrefix = computed(() => settings.value.invoice_prefix || 'INV');
  const storeLogo = computed(() => settings.value.store_logo || '/logo.png');
  const hasCustomLogo = computed(() => !!settings.value.store_logo);
  const primaryColor = computed(() => settings.value.primary_color || '#2563eb');
  const themePreset = computed(() => settings.value.theme_preset || 'blue');
  const headerAccentStyle = computed(() => settings.value.header_accent_style || 'accent-line');
  const surfaceTheme = computed(() => settings.value.surface_theme || 'bone-white');
  const customSurfaceColor = computed(() => settings.value.custom_surface_color || '#ecebe9');
  const printerNetworkAddress = computed(() => settings.value.printer_network_address || '127.0.0.1:9100');
  const receiptPaperWidth = computed(() => settings.value.receipt_paper_width || '58mm');
  const receiptFooter = computed(() => settings.value.receipt_footer || 'Terima kasih atas kunjungan Anda');
  const uiShellMode = computed<'auto' | 'desktop' | 'tablet' | 'mobile'>(() => (settings.value.ui_shell_mode as any) || 'auto');

  function setUiShellMode(mode: 'auto' | 'desktop' | 'tablet' | 'mobile') {
    settings.value.ui_shell_mode = mode;
    saveLocal();
  }

  return {
    settings,
    uiShellMode,
    setUiShellMode,
    ownerApiToken,
    setOwnerApiToken,
    // Business Mode
    businessType,
    currentBusinessConfig,
    businessFeatures,
    businessTerminology,
    isRetail,
    isFnb,
    isService,
    isWholesale,
    isUniversal,
    setBusinessType,
    // Store Info
    storeName,
    storeCode,
    storeAbbreviation,
    storeTagline,
    storeAddress,
    storePhone,
    invoicePrefix,
    storeLogo,
    hasCustomLogo,
    primaryColor,
    themePreset,
    headerAccentStyle,
    surfaceTheme,
    customSurfaceColor,
    printerNetworkAddress,
    receiptPaperWidth,
    receiptFooter,
    fetchSettings,
    updateSetting,
    setTheme,
    setSurfaceTheme,
    applyCurrentTheme
  };
});
