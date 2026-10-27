<script setup lang="ts">
import { computed } from 'vue';
import { useResponsive } from './composables/useResponsive';
import { useSettingsStore } from './stores/settingsStore';
import FileExplorerLayout from './components/explorer/FileExplorerLayout.vue';
import TabletPosShell from './components/shells/TabletPosShell.vue';
import MobilePosShell from './components/shells/MobilePosShell.vue';

const responsive = useResponsive();
const settingsStore = useSettingsStore();

const activeShell = computed<'desktop' | 'tablet' | 'mobile'>(() => {
  const mode = settingsStore.uiShellMode;
  if (mode && mode !== 'auto') {
    return mode;
  }
  // Auto-detection based on viewport:
  if (responsive.isMobile.value) {
    return 'mobile';
  }
  if (responsive.isTablet.value) {
    return 'tablet';
  }
  return 'desktop';
});
</script>

<template>
  <div class="w-full h-full overflow-hidden select-none font-sans">
    <MobilePosShell v-if="activeShell === 'mobile'" />
    <TabletPosShell v-else-if="activeShell === 'tablet'" />
    <FileExplorerLayout v-else />
  </div>
</template>

<style>
/* Global resets for Desktop File Explorer */
body, html, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
}
</style>