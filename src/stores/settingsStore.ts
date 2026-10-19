import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { StoreSetting } from '../types';
import { dbService } from '../services/dbService';
import { applyTheme } from '../utils/theme';

const STORAGE_KEY_SETTINGS = 'kasir_citra_settings_v1';

export const useSettingsStore = defineStore('settings', () => {
  const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
  const settings = ref<Record<string, string>>(
    saved
      ? JSON.parse(saved)
      : {
          store_name: 'Kasir Citra',
          store_code: 'CITRA',
          store_tagline: 'Distribusi B2B & Hub Pengadaan',
          store_address: 'Jl. Sentral Distribusi No. 8',
          store_phone: '0812-3456-7890',
          invoice_prefix: 'INV-B2B',
          primary_color: '#2563eb',
          theme_preset: 'blue',
          header_accent_style: 'accent-line',
          surface_theme: 'bone-white',
          custom_surface_color: '#fcfbfa'
        }
  );

  // If user previously had default classic-gray, upgrade to requested bone-white
  if (!settings.value.surface_theme || settings.value.surface_theme === 'classic-gray') {
    settings.value.surface_theme = 'bone-white';
    settings.value.custom_surface_color = '#fcfbfa';
    saveLocal();
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings.value));
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
    await dbService.updateSetting(key, value);
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

  const storeName = computed(() => settings.value.store_name || 'Kasir Citra');
  const storeCode = computed(() => {
    if (settings.value.store_code && settings.value.store_code.trim()) {
      return settings.value.store_code.trim().toUpperCase();
    }
    const name = (settings.value.store_name || '').replace(/^(toko|kasir|warung|cv|pt|ud)\s+/i, '').trim();
    if (!name) return 'CITRA';
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
      return words[0].toUpperCase();
    }
    return words.map(w => w[0]).join('').toUpperCase() || 'CITRA';
  });
  const storeAbbreviation = computed(() => storeCode.value);
  const storeTagline = computed(() => settings.value.store_tagline || 'Distribusi B2B & Hub Pengadaan');
  const storeAddress = computed(() => settings.value.store_address || '');
  const storePhone = computed(() => settings.value.store_phone || '');
  const invoicePrefix = computed(() => settings.value.invoice_prefix || 'INV-B2B');
  const primaryColor = computed(() => settings.value.primary_color || '#2563eb');
  const themePreset = computed(() => settings.value.theme_preset || 'blue');
  const headerAccentStyle = computed(() => settings.value.header_accent_style || 'accent-line');
  const surfaceTheme = computed(() => settings.value.surface_theme || 'classic-gray');
  const customSurfaceColor = computed(() => settings.value.custom_surface_color || '#ecebe9');

  return {
    settings,
    storeName,
    storeCode,
    storeAbbreviation,
    storeTagline,
    storeAddress,
    storePhone,
    invoicePrefix,
    primaryColor,
    themePreset,
    headerAccentStyle,
    surfaceTheme,
    customSurfaceColor,
    fetchSettings,
    updateSetting,
    setTheme,
    setSurfaceTheme,
    applyCurrentTheme
  };
});
