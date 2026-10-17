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
          store_tagline: 'Distribusi B2B & Hub Pengadaan',
          store_address: 'Jl. Sentral Distribusi No. 8',
          store_phone: '0812-3456-7890',
          invoice_prefix: 'INV-B2B',
          primary_color: '#2563eb',
          theme_preset: 'blue',
          header_accent_style: 'accent-line'
        }
  );

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings.value));
  }

  function applyCurrentTheme() {
    const color = settings.value.primary_color || '#2563eb';
    const headerStyle = settings.value.header_accent_style || 'accent-line';
    applyTheme(color, headerStyle);
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
    if (key === 'primary_color' || key === 'header_accent_style') {
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

  const storeName = computed(() => settings.value.store_name || 'Kasir Citra');
  const storeTagline = computed(() => settings.value.store_tagline || 'Distribusi B2B & Hub Pengadaan');
  const storeAddress = computed(() => settings.value.store_address || '');
  const storePhone = computed(() => settings.value.store_phone || '');
  const invoicePrefix = computed(() => settings.value.invoice_prefix || 'INV-B2B');
  const primaryColor = computed(() => settings.value.primary_color || '#2563eb');
  const themePreset = computed(() => settings.value.theme_preset || 'blue');
  const headerAccentStyle = computed(() => settings.value.header_accent_style || 'accent-line');

  return {
    settings,
    storeName,
    storeTagline,
    storeAddress,
    storePhone,
    invoicePrefix,
    primaryColor,
    themePreset,
    headerAccentStyle,
    fetchSettings,
    updateSetting,
    setTheme,
    applyCurrentTheme
  };
});
