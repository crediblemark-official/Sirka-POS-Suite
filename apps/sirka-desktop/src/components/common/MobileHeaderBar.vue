<script setup lang="ts">
import { ref } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useShiftStore } from '../../stores/shiftStore';
import {
  Search,
  X,
  Clock
} from 'lucide-vue-next';

defineProps<{
  activeTabTitle: string;
  searchQuery: string;
}>();

const emit = defineEmits<{
  (e: 'update:searchQuery', val: string): void;
  (e: 'open-shift-modal'): void;
}>();

const settingsStore = useSettingsStore();
const shiftStore = useShiftStore();
const isSearchOpen = ref(false);

function toggleSearch() {
  isSearchOpen.value = !isSearchOpen.value;
  if (!isSearchOpen.value) {
    emit('update:searchQuery', '');
  }
}
</script>

<template>
  <header class="bg-[#1e293b] text-white border-b border-slate-700 shadow-md select-none shrink-0 z-30 pt-safe">
    <!-- Main Top Bar -->
    <div class="h-12 px-3 flex items-center justify-between gap-2">
      <!-- Left: Logo & Store Info -->
      <div class="flex items-center gap-2 min-w-0">
        <img
          :src="settingsStore.storeLogo || '/logo.png'"
          alt="Logo"
          class="w-7 h-7 rounded object-contain bg-white/10 p-0.5 shrink-0"
        />
        <div class="min-w-0 flex flex-col">
          <div class="flex items-center gap-1.5 leading-tight">
            <span class="font-bold text-sm text-slate-100 truncate max-w-[120px] sm:max-w-[160px]">
              {{ settingsStore.storeName }}
            </span>
            <!-- Business Type Badge -->
            <span
              class="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border shrink-0 uppercase tracking-wider"
              :class="settingsStore.currentBusinessConfig.badgeColor"
            >
              {{ settingsStore.currentBusinessConfig.title.split(' ')[0] }}
            </span>
          </div>
          <span class="text-[10px] text-slate-400 truncate">
            {{ activeTabTitle }}
          </span>
        </div>
      </div>

      <!-- Right: Shift Status & Search Action -->
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Shift Status Pill -->
        <button
          @click="emit('open-shift-modal')"
          class="flex items-center gap-1 px-2 py-1 rounded text-xs transition cursor-pointer"
          :class="shiftStore.isShiftActive
            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/80'
            : 'bg-rose-950/80 text-rose-300 border border-rose-800/80'"
        >
          <Clock class="w-3.5 h-3.5 shrink-0" />
          <span class="text-[10px] font-medium hidden xs:inline">
            {{ shiftStore.isShiftActive ? 'Shift Buka' : 'Shift Tutup' }}
          </span>
        </button>

        <!-- Search Icon Toggle Button -->
        <button
          @click="toggleSearch"
          class="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
          :aria-label="isSearchOpen ? 'Tutup Pencarian' : 'Buka Pencarian'"
        >
          <X v-if="isSearchOpen" class="w-4 h-4 text-rose-400" />
          <Search v-else class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Expandable Search Input Row (Smooth Mobile Slide) -->
    <div
      v-if="isSearchOpen"
      class="px-3 pb-2.5 pt-0.5 bg-slate-900/90 border-t border-slate-800 flex items-center gap-2 animate-fade-in"
    >
      <div class="relative flex-1">
        <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          :value="searchQuery"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="Cari produk, SKU, nota, pelanggan..."
          class="w-full pl-8 pr-7 py-1.5 text-xs bg-slate-800 text-white rounded border border-slate-700 focus:outline-none focus:border-blue-500 placeholder:text-slate-500"
          autofocus
        />
        <button
          v-if="searchQuery"
          @click="$emit('update:searchQuery', '')"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
</style>
