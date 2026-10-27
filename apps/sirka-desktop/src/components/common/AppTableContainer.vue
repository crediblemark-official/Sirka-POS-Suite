<script setup lang="ts">
import type { Component } from 'vue';
import AppEmptyState from './AppEmptyState.vue';

withDefaults(defineProps<{
  isEmpty?: boolean;
  emptyIcon?: Component;
  emptyTitle?: string;
  emptyDescription?: string;
}>(), {
  isEmpty: false,
  emptyTitle: 'Tidak Ada Data Ditemukan',
  emptyDescription: ''
});
</script>

<template>
  <div class="app-table-container flex-1 overflow-auto bg-white relative select-none">
    <slot name="empty" v-if="isEmpty">
      <AppEmptyState
        :icon="emptyIcon"
        :title="emptyTitle"
        :description="emptyDescription"
      >
        <slot name="empty-action" />
      </AppEmptyState>
    </slot>

    <slot v-else />
  </div>
</template>
