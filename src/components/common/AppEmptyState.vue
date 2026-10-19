<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  icon?: Component;
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="h-64 flex flex-col items-center justify-center text-gray-400 gap-2 select-none px-4 text-center">
    <component :is="icon" v-if="icon" :size="44" class="text-gray-300 mb-1" />
    <span class="font-bold text-gray-700 text-sm leading-tight">{{ title }}</span>
    <span v-if="description" class="text-xs text-gray-400 max-w-md leading-relaxed">{{ description }}</span>
    <div v-if="$slots.default" class="mt-2">
      <slot />
    </div>
  </div>
</template>
