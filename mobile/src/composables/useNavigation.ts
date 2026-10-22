import { ref } from 'vue';
import type { ActiveTab } from '../types';

const currentTab = ref<ActiveTab>('reports');
const previousTab = ref<ActiveTab>('reports');

export function useNavigation() {
  function navigateTo(tab: ActiveTab) {
    if (tab !== 'settings') {
      previousTab.value = tab;
    }
    currentTab.value = tab;
  }

  function toggleSettings() {
    if (currentTab.value === 'settings') {
      currentTab.value = previousTab.value || 'reports';
    } else {
      previousTab.value = currentTab.value;
      currentTab.value = 'settings';
    }
  }

  return {
    currentTab,
    navigateTo,
    toggleSettings,
  };
}
