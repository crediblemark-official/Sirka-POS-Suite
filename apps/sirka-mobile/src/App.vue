<script setup lang="ts">
import MobileAppShell from './components/mobile/MobileAppShell.vue';
</script>

<template>
  <MobileAppShell />
</template>

<style>
/* Global resets for Mobile First Android & iOS */
body, html, #app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
</style>