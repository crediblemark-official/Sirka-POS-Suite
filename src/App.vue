<script setup lang="ts">
import FileExplorerLayout from './components/explorer/FileExplorerLayout.vue';
</script>

<template>
  <FileExplorerLayout />
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