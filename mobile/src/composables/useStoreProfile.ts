import { ref, computed } from 'vue';
import { ownerApi } from '../services/api';

const STORAGE_KEY = 'sirka_owner_store_profile';

const rawSettings = ref<Record<string, string>>({});
const loaded = ref(false);

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
        rawSettings.value = { ...rawSettings.value, ...data };
        loaded.value = true;
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(rawSettings.value));
        }
      }
    } catch (e) {
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
    fetchStoreProfile,
  };
}
