import { ref, computed } from 'vue';
import { ownerApi } from '../services/api';

const STORAGE_KEY = 'sirka_owner_store_profile';

const rawSettings = ref<Record<string, string>>({});
const loaded = ref(false);
/**
 * BUG FIX: error fetch sebelumnya ditelan tanpa jejak -> SettingsView
 * menampilkan "Tersinkronisasi" padahal fetch-nya gagal.
 */
const lastError = ref<string | null>(null);
const isSynced = computed(() => loaded.value && !lastError.value);

// Initialize from local cache immediately
if (typeof window !== 'undefined') {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      rawSettings.value = JSON.parse(cached);
      loaded.value = true;
    }
  } catch (e) {
    console.warn('Failed to parse cached store profile', e);
  }
}

export function useStoreProfile() {
  const storeName = computed(() => rawSettings.value.store_name || 'Taruna Bhakti');
  const storeTagline = computed(() => rawSettings.value.store_tagline || 'Distribusi B2B & Hub Pengadaan');
  const storeCode = computed(() => rawSettings.value.store_code || 'TB');
  const primaryColor = computed(() => rawSettings.value.primary_color || '#2563eb');
  const storeLogo = computed(() => rawSettings.value.store_logo || '');

  async function fetchStoreProfile() {
    try {
      const data = await ownerApi.getSettings();
      if (data && typeof data === 'object') {
        // BUG FIX: key yang DIHAPUS di server masih tertinggal di cache lokal
        // (merge) -> setting lama tidak pernah hilang. Sekarang key yang tidak
        // lagi ada di server dibuang dari cache.
        const next: Record<string, string> = { ...rawSettings.value };
        for (const key of Object.keys(rawSettings.value)) {
          if (!(key in data)) delete next[key];
        }
        rawSettings.value = { ...next, ...data };
        loaded.value = true;
        lastError.value = null;
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(rawSettings.value));
        }
      }
    } catch (e: any) {
      lastError.value = e?.message || String(e);
      console.warn('[useStoreProfile] Failed to fetch store settings from PostgreSQL:', e);
    }
  }

  // Fetch immediately if not loaded yet
  if (!loaded.value) {
    fetchStoreProfile();
  }

  return {
    storeName,
    storeTagline,
    storeCode,
    primaryColor,
    storeLogo,
    lastError,
    isSynced,
    fetchStoreProfile,
  };
}
