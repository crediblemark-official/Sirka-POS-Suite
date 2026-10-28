<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { SlidersHorizontal, X, RotateCcw, Check } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    title?: string;
    subtitle?: string;
    activeFiltersCount?: number;
    resultCount?: number;
    resultLabel?: string;
    applyButtonColor?: string;
  }>(),
  {
    title: 'Filter Lengkap',
    subtitle: 'Pilih kriteria untuk menyaring data',
    activeFiltersCount: 0,
    resultLabel: 'Hasil',
    applyButtonColor: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'reset'): void;
  (e: 'apply'): void;
}>();

function handleKeyDown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center select-none"
    >
      <!-- Backdrop Gelap dengan Blur -->
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        @click="emit('close')"
      ></div>

      <!-- Drawer Body (Slide-Up Bottom Sheet di Mobile, Modal di Tablet/Desktop) -->
      <div
        class="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[88vh] overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
      >
        <!-- Pull Indicator (Khas Mobile Bottom Sheet) -->
        <div class="w-full flex justify-center pt-2.5 pb-1 sm:hidden">
          <div class="w-12 h-1.5 rounded-full bg-gray-300"></div>
        </div>

        <!-- Header Drawer -->
        <div class="px-5 py-3 border-b border-gray-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
              <SlidersHorizontal :size="16" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-bold text-sm text-gray-900 leading-tight">{{ title }}</h3>
                <span
                  v-if="activeFiltersCount > 0"
                  class="px-2 py-0.2 rounded-full bg-indigo-600 text-white font-mono text-[10px] font-bold"
                >
                  {{ activeFiltersCount }} aktif
                </span>
              </div>
              <p class="text-[11px] text-gray-500 leading-tight mt-0.5">{{ subtitle }}</p>
            </div>
          </div>

          <button
            type="button"
            class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
            title="Tutup Filter"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Konten Opsi-Opsi Filter (Scrollable) -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4 text-xs divide-y divide-gray-100">
          <slot></slot>
        </div>

        <!-- Sticky Footer: Reset & Terapkan Filter -->
        <div class="px-4 py-3 pb-safe sm:pb-3 bg-white border-t border-gray-200 flex items-center gap-3 shrink-0 shadow-lg">
          <button
            type="button"
            class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-bold text-xs cursor-pointer transition-colors shrink-0"
            @click="emit('reset')"
          >
            <RotateCcw :size="13" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs cursor-pointer shadow-md transition-all active:scale-[0.98]"
            :class="applyButtonColor"
            @click="emit('apply')"
          >
            <Check :size="15" />
            <span>
              Terapkan Filter
              <template v-if="resultCount !== undefined">
                ({{ resultCount }} {{ resultLabel }})
              </template>
            </span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 12px);
}
</style>
