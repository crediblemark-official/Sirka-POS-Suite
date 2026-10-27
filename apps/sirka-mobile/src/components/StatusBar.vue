<script setup lang="ts">
import { Database, ShieldCheck } from 'lucide-vue-next';

defineProps<{
  itemCountText?: string;
}>();
</script>

<template>
  <footer class="explorer-statusbar flex items-center justify-between px-3 py-1 border-t text-[10.5px] font-mono shrink-0 select-none">
    <div class="flex items-center gap-1.5 min-w-0">
      <Database :size="11" class="text-[#2563eb] shrink-0" />
      <span class="truncate">{{ itemCountText || 'PostgreSQL pgpool-II Live' }}</span>
    </div>

    <div class="flex items-center gap-1.5 shrink-0 text-[#166534] font-semibold">
      <ShieldCheck :size="12" />
      <span>Cloudflare SSL</span>
    </div>
  </footer>
</template>
