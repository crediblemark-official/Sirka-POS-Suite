<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue';
import { X, Plus, Pencil, Trash2, Check } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    isEditing: boolean;
    title: string;
    codeBadge?: string;
    width?: string;
    canEdit?: boolean;
    canSave?: boolean;
    saveLabel?: string;
    newButtonLabel?: string;
    editButtonLabel?: string;
    themeColor?: 'brand' | 'rose' | 'amber' | 'blue' | 'purple' | 'emerald' | 'indigo' | 'gray';
    showDelete?: boolean;
    showSegmentedControl?: boolean;
  }>(),
  {
    width: 'w-[380px] lg:w-[420px]',
    canEdit: true,
    canSave: true,
    saveLabel: '',
    newButtonLabel: 'Baru',
    editButtonLabel: 'Edit',
    themeColor: 'rose',
    showDelete: true,
    showSegmentedControl: true
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'switch-to-new'): void;
  (e: 'switch-to-edit'): void;
  (e: 'save'): void;
  (e: 'delete'): void;
  (e: 'cancel'): void;
}>();

const colorConfig = computed(() => {
  switch (props.themeColor) {
    case 'brand':
      return {
        icon: 'text-blue-700',
        badge: 'bg-blue-100 text-blue-900',
        activePillNew: 'bg-white text-blue-700 shadow-xs font-bold',
        activePillEdit: 'bg-white text-blue-700 shadow-xs font-bold',
        saveBtn: 'hover:opacity-95 active:opacity-90',
        saveBtnStyle: { backgroundColor: 'var(--brand-primary)', color: 'var(--brand-primary-contrast, #ffffff)' }
      };
    case 'amber':
      return {
        icon: 'text-amber-700',
        badge: 'bg-amber-100 text-amber-900',
        activePillNew: 'bg-white text-amber-700 shadow-xs font-bold',
        activePillEdit: 'bg-white text-blue-700 shadow-xs font-bold',
        saveBtn: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
      };
    case 'emerald':
      return {
        icon: 'text-emerald-700',
        badge: 'bg-emerald-100 text-emerald-900',
        activePillNew: 'bg-white text-emerald-700 shadow-xs font-bold',
        activePillEdit: 'bg-white text-blue-700 shadow-xs font-bold',
        saveBtn: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
      };
    case 'purple':
      return {
        icon: 'text-purple-700',
        badge: 'bg-purple-100 text-purple-900',
        activePillNew: 'bg-white text-purple-700 shadow-xs font-bold',
        activePillEdit: 'bg-white text-blue-700 shadow-xs font-bold',
        saveBtn: 'bg-purple-700 hover:bg-purple-800 active:bg-purple-900'
      };
    case 'blue':
      return {
        icon: 'text-blue-700',
        badge: 'bg-blue-100 text-blue-900',
        activePillNew: 'bg-white text-blue-700 shadow-xs font-bold',
        activePillEdit: 'bg-white text-indigo-700 shadow-xs font-bold',
        saveBtn: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
      };
    case 'indigo':
      return {
        icon: 'text-indigo-700',
        badge: 'bg-indigo-100 text-indigo-900',
        activePillNew: 'bg-white text-indigo-700 shadow-xs font-bold',
        activePillEdit: 'bg-white text-blue-700 shadow-xs font-bold',
        saveBtn: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
      };
    case 'rose':
    default:
      return {
        icon: 'text-rose-700',
        badge: 'bg-rose-100 text-rose-800',
        activePillNew: 'bg-white text-rose-700 shadow-xs font-bold',
        activePillEdit: 'bg-white text-blue-700 shadow-xs font-bold',
        saveBtn: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
      };
  }
});

const defaultSaveText = computed(() => {
  if (props.saveLabel) return props.saveLabel;
  return props.isEditing ? 'SIMPAN PERUBAHAN' : `SIMPAN ${props.title.toUpperCase()}`;
});

function handleClose() {
  emit('update:modelValue', false);
  emit('cancel');
}

function handleKeyDown(e: KeyboardEvent) {
  if (!props.modelValue) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    handleClose();
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
    @click.self="handleClose"
  >
    <div
      class="w-full sm:max-w-md h-full bg-white flex flex-col shadow-2xl select-none text-xs animate-in slide-in-from-right duration-200"
    >
      <!-- Single-Row Compact Header (h-12) with touch target -->
      <div class="h-12 px-3.5 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between shrink-0 gap-2">
        <!-- Title & Icon -->
        <div class="flex items-center gap-1.5 min-w-0">
          <slot name="icon">
            <div :class="colorConfig.icon" class="shrink-0">
              <Pencil v-if="isEditing" :size="16" />
              <Plus v-else :size="16" />
            </div>
          </slot>
          <span class="font-bold text-sm text-gray-800 truncate">
            {{ isEditing ? `Edit ${title}` : `${title} Baru` }}
          </span>
          <span
            v-if="isEditing && codeBadge"
            :class="colorConfig.badge"
            class="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] shrink-0"
          >
            {{ codeBadge }}
          </span>
        </div>

        <!-- Right Controls: Segmented Pill Switcher & Close Button -->
        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Optional Extra Action -->
          <slot name="header-extra" />

          <!-- Segmented Pill Control -->
          <div
            v-if="showSegmentedControl"
            class="flex items-center p-0.5 bg-gray-200/80 rounded-md text-[11px] font-semibold"
          >
            <button
              type="button"
              class="px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1"
              :class="!isEditing ? colorConfig.activePillNew : 'text-gray-600 hover:text-gray-900'"
              title="Beralih ke Form Baru"
              @click="emit('switch-to-new')"
            >
              <Plus :size="12" />
              <span>{{ newButtonLabel }}</span>
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded transition-all cursor-pointer flex items-center gap-1 disabled:opacity-40"
              :class="isEditing ? colorConfig.activePillEdit : 'text-gray-600 hover:text-gray-900'"
              :disabled="!canEdit"
              title="Beralih ke Form Edit"
              @click="emit('switch-to-edit')"
            >
              <Pencil :size="12" />
              <span>{{ editButtonLabel }}</span>
            </button>
          </div>

          <!-- Close Button (Touch Friendly 36x36px) -->
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full cursor-pointer transition-colors"
            title="Tutup Form"
            @click="handleClose"
          >
            <X :size="18" />
          </button>
        </div>
      </div>

      <!-- Scrollable Body (Clean Sections Separated by Lines) -->
      <div class="flex-1 overflow-y-auto px-4 py-3.5 space-y-4 bg-white">
        <slot />
      </div>

      <!-- Compact Sticky Footer with Safe Area -->
      <div class="p-3 bg-white border-t border-gray-200 shrink-0 space-y-2 pb-safe">
        <slot name="footer-prefix" />
        <div v-if="isEditing" class="grid grid-cols-4 gap-2">
          <button
            v-if="showDelete"
            type="button"
            class="col-span-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg font-semibold text-xs cursor-pointer flex items-center justify-center gap-1 transition-colors active:scale-95"
            title="Hapus Data Ini"
            @click="emit('delete')"
          >
            <Trash2 :size="14" />
            <span>Hapus</span>
          </button>

          <button
            type="button"
            :class="showDelete ? 'col-span-1' : 'col-span-2'"
            class="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg font-semibold text-xs cursor-pointer flex items-center justify-center gap-1 transition-colors active:scale-95"
            @click="handleClose"
          >
            <span>Batal</span>
          </button>

          <button
            type="button"
            class="col-span-2 py-2.5 text-white rounded-lg font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-colors disabled:opacity-40 active:scale-98"
            :class="colorConfig.saveBtn"
            :style="colorConfig.saveBtnStyle || {}"
            :disabled="!canSave"
            @click="emit('save')"
          >
            <Check :size="16" />
            <span>{{ defaultSaveText }}</span>
          </button>
        </div>

        <div v-else class="grid grid-cols-3 gap-2">
          <button
            type="button"
            class="col-span-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg font-semibold text-xs cursor-pointer flex items-center justify-center gap-1 transition-colors active:scale-95"
            @click="handleClose"
          >
            <span>Batal</span>
          </button>

          <button
            type="button"
            class="col-span-2 py-2.5 text-white rounded-lg font-bold text-xs cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-colors disabled:opacity-40 active:scale-98"
            :class="colorConfig.saveBtn"
            :style="colorConfig.saveBtnStyle || {}"
            :disabled="!canSave"
            @click="emit('save')"
          >
            <Check :size="16" />
            <span>{{ defaultSaveText }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
