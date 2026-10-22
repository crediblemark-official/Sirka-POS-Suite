<script setup lang="ts">
import type { Component } from 'vue';

export interface MetricStatItem {
  label: string;
  value: string | number;
  sublabel?: string;
  tooltip?: string;
  icon: Component;
  iconBoxClass?: string;
  valClass?: string;
  sublabelClass?: string;
}

defineProps<{
  items: MetricStatItem[];
}>();
</script>

<template>
  <div class="flex items-center divide-x divide-gray-200 border-b border-gray-200 bg-white px-2 py-2 shrink-0 select-none">
    <div
      v-for="(item, idx) in items"
      :key="`${item.label}-${idx}`"
      class="flex-1 min-w-0 px-2 flex items-center gap-2 group cursor-default"
      :title="item.tooltip || (typeof item.value === 'string' ? item.value : undefined)"
    >
      <div
        class="p-1.5 rounded shrink-0 flex items-center justify-center"
        :class="item.iconBoxClass || 'bg-blue-50 text-blue-600'"
      >
        <component :is="item.icon" :size="15" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold truncate leading-none">
          {{ item.label }}
        </div>
        <div
          class="text-xs sm:text-sm font-bold font-mono truncate leading-tight mt-0.5 flex items-baseline gap-1"
          :class="item.valClass || 'text-gray-900'"
        >
          <span class="truncate">{{ item.value }}</span>
          <span
            v-if="item.sublabel"
            class="text-[10px] font-sans font-medium shrink-0"
            :class="item.sublabelClass || 'text-gray-500'"
          >
            {{ item.sublabel }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
