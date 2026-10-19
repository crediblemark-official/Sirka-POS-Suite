<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { Search, ChevronDown, Check, X, Plus } from 'lucide-vue-next';

export interface SelectOption {
  value: string | number;
  label: string;
  sublabel?: string;
  code?: string;
  badge?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    options: SelectOption[];
    placeholder?: string;
    searchPlaceholder?: string;
    hotkey?: string; // e.g. 'F4'
    disabled?: boolean;
    clearable?: boolean;
    size?: 'sm' | 'md';
    allowCreate?: boolean;
    createLabel?: string;
  }>(),
  {
    placeholder: 'Pilih...',
    searchPlaceholder: 'Ketik nama / kode...',
    hotkey: 'F4',
    disabled: false,
    clearable: false,
    size: 'sm',
    allowCreate: false,
    createLabel: 'Tambah baru'
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
  (e: 'change', option: SelectOption | undefined): void;
  (e: 'create', query: string): void;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const optionsListRef = ref<HTMLDivElement | null>(null);
const popoverRef = ref<HTMLDivElement | null>(null);

const isOpen = ref(false);
const searchQuery = ref('');
const highlightedIndex = ref(0);

const dropdownPosition = ref({
  top: '0px',
  left: '0px',
  width: '0px'
});

function updateDropdownPosition() {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  const dropdownHeight = 230;

  let top = rect.bottom + 4;
  if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
    top = Math.max(8, rect.top - dropdownHeight - 4);
  }

  dropdownPosition.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(rect.left)}px`,
    width: `${Math.max(Math.round(rect.width), 200)}px`
  };
}

function handleScrollOrResize() {
  if (isOpen.value) {
    updateDropdownPosition();
  }
}

const selectedOption = computed(() =>
  props.options.find(opt => opt.value === props.modelValue)
);

const filteredOptions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter(opt =>
    opt.label.toLowerCase().includes(q) ||
    (opt.code && opt.code.toLowerCase().includes(q)) ||
    (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
  );
});

const hasExactMatch = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return false;
  return props.options.some(opt => opt.label.toLowerCase() === q);
});

const isFocused = ref(false);

function handleInputFocus() {
  if (props.disabled) return;
  isFocused.value = true;
  openDropdown();
}

function handleInputBlur() {
  isFocused.value = false;
}

function handleInputChange(e: Event) {
  const target = e.target as HTMLInputElement;
  searchQuery.value = target.value;
  if (!isOpen.value) {
    openDropdown();
  }
}

function openDropdown() {
  if (props.disabled) return;
  updateDropdownPosition();
  isOpen.value = true;
  searchQuery.value = '';
  // Set initial highlighted index to current selected item
  const idx = filteredOptions.value.findIndex(opt => opt.value === props.modelValue);
  highlightedIndex.value = idx >= 0 ? idx : 0;

  nextTick(() => {
    updateDropdownPosition();
    searchInputRef.value?.focus();
    scrollToHighlighted();
  });
}

function closeDropdown() {
  isOpen.value = false;
  searchQuery.value = '';
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function selectOption(opt: SelectOption) {
  emit('update:modelValue', opt.value);
  emit('change', opt);
  closeDropdown();
}

function handleTriggerCreate() {
  const query = searchQuery.value.trim();
  if (!query) return;
  emit('create', query);
  closeDropdown();
}

function clearSelection(e: MouseEvent) {
  e.stopPropagation();
  emit('update:modelValue', '');
  emit('change', undefined);
  searchQuery.value = '';
  if (isOpen.value) {
    searchInputRef.value?.focus();
  }
}

function scrollToHighlighted() {
  nextTick(() => {
    if (!optionsListRef.value) return;
    const items = optionsListRef.value.querySelectorAll('[data-option-item]');
    const activeItem = items[highlightedIndex.value] as HTMLElement | undefined;
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  });
}

function handleKeydown(e: KeyboardEvent) {
  if (!isOpen.value) {
    if (props.hotkey && e.key === props.hotkey) {
      e.preventDefault();
      openDropdown();
    }
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (filteredOptions.value.length === 0) return;
    highlightedIndex.value = (highlightedIndex.value + 1) % filteredOptions.value.length;
    scrollToHighlighted();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (filteredOptions.value.length === 0) return;
    highlightedIndex.value =
      (highlightedIndex.value - 1 + filteredOptions.value.length) % filteredOptions.value.length;
    scrollToHighlighted();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (filteredOptions.value.length === 0) {
      if (props.allowCreate && searchQuery.value.trim()) {
        handleTriggerCreate();
      }
      return;
    }
    const opt = filteredOptions.value[highlightedIndex.value];
    if (opt) {
      selectOption(opt);
    } else if (props.allowCreate && searchQuery.value.trim()) {
      handleTriggerCreate();
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeDropdown();
  } else if (e.key === 'Tab') {
    closeDropdown();
  }
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  const inContainer = containerRef.value && containerRef.value.contains(target);
  const inPopover = popoverRef.value && popoverRef.value.contains(target);
  if (!inContainer && !inPopover) {
    closeDropdown();
  }
}

watch(searchQuery, () => {
  highlightedIndex.value = 0;
  scrollToHighlighted();
});

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  document.addEventListener('mousedown', handleClickOutside);
  window.addEventListener('resize', handleScrollOrResize);
  window.addEventListener('scroll', handleScrollOrResize, true);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('mousedown', handleClickOutside);
  window.removeEventListener('resize', handleScrollOrResize);
  window.removeEventListener('scroll', handleScrollOrResize, true);
});

defineExpose({
  open: openDropdown,
  close: closeDropdown,
  focus: () => searchInputRef.value?.focus()
});
</script>

<template>
  <div ref="containerRef" class="relative w-full text-xs">
    <!-- Inline Search & Select Input -->
    <div
      role="combobox"
      :aria-expanded="isOpen"
      class="w-full flex items-center justify-between gap-1.5 bg-white border border-[#dedbd6] rounded transition-all shadow-2xs"
      :class="[
        size === 'sm' ? 'h-7 text-xs px-2' : 'h-8 text-xs px-2.5',
        disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-text hover:border-blue-400',
        isOpen ? 'border-blue-500 ring-1 ring-blue-500 bg-white' : ''
      ]"
      @click="openDropdown"
    >
      <div class="flex items-center gap-2 truncate flex-1 min-w-0">
        <slot name="icon">
          <Search :size="13" class="text-gray-400 shrink-0" />
        </slot>

        <!-- If open, direct typing input; if closed, shows selected text or placeholder -->
        <input
          v-if="isOpen"
          ref="searchInputRef"
          :value="searchQuery"
          type="text"
          class="w-full bg-transparent text-xs text-gray-800 placeholder-gray-400 focus:outline-none"
          :placeholder="selectedOption ? selectedOption.label : searchPlaceholder"
          @input="handleInputChange"
          @focus="handleInputFocus"
          @blur="handleInputBlur"
        />

        <div v-else class="truncate flex items-center gap-1.5 flex-1 cursor-pointer">
          <span v-if="selectedOption" class="font-semibold text-gray-800 truncate">
            {{ selectedOption.label }}
          </span>
          <span v-else class="text-gray-400 font-normal truncate">
            {{ placeholder }}
          </span>
          <span
            v-if="selectedOption?.code"
            class="shrink-0 px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded text-[10px] font-mono border border-gray-200"
          >
            {{ selectedOption.code }}
          </span>
        </div>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <button
          v-if="clearable && selectedOption && !disabled"
          type="button"
          class="text-gray-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
          title="Hapus pilihan"
          @click="clearSelection"
        >
          <X :size="12" />
        </button>
        <ChevronDown
          :size="13"
          class="text-gray-400 transition-transform duration-150 cursor-pointer"
          :class="isOpen ? 'rotate-180 text-blue-600' : ''"
          @click.stop="toggleDropdown"
        />
      </div>
    </div>

    <!-- Dropdown Menu / Popover (Teleported to body to avoid overflow clipping) -->
    <Teleport to="body">
      <transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          v-if="isOpen"
          ref="popoverRef"
          :style="{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 99999
          }"
          class="bg-white rounded-md border border-[#dedbd6] shadow-xl overflow-hidden flex flex-col max-h-56 text-xs select-none"
        >

        <!-- Options List -->
        <div
          ref="optionsListRef"
          class="overflow-y-auto divide-y divide-gray-50 p-1 max-h-52"
        >
          <!-- Empty State (No match found) -->
          <div
            v-if="filteredOptions.length === 0"
            class="p-2.5 flex flex-col items-center gap-2 text-center"
          >
            <span class="text-gray-400 text-[11px]">
              Tidak ada data yang cocok dengan "<strong class="text-gray-700 font-semibold">{{ searchQuery }}</strong>"
            </span>

            <button
              v-if="allowCreate && searchQuery.trim()"
              type="button"
              class="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all animate-pulse hover:animate-none"
              @click="handleTriggerCreate"
            >
              <Plus :size="14" />
              <span class="truncate">Tambah "{{ searchQuery.trim() }}" Baru</span>
              <kbd class="ml-1 px-1.5 py-0.2 bg-black/20 text-white rounded text-[10px] font-mono font-normal">Tekan Enter ↵</kbd>
            </button>
          </div>

          <!-- Existing Options -->
          <div
            v-for="(opt, idx) in filteredOptions"
            :key="opt.value"
            data-option-item
            class="flex items-center justify-between p-2 rounded cursor-pointer transition-colors text-xs select-none"
            :class="[
              highlightedIndex === idx ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-gray-700 hover:bg-gray-100',
              opt.value === modelValue ? 'bg-blue-100/60 font-bold' : ''
            ]"
            @mouseenter="highlightedIndex = idx"
            @click="selectOption(opt)"
          >
            <div class="flex flex-col min-w-0 pr-2 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-semibold text-gray-800 leading-tight">{{ opt.label }}</span>
                <span
                  v-if="opt.code"
                  class="px-1 py-0.2 rounded text-[9.5px] font-mono shrink-0"
                  :class="opt.value === modelValue ? 'bg-blue-200 text-blue-900' : 'bg-gray-100 text-gray-500'"
                >
                  {{ opt.code }}
                </span>
                <span
                  v-if="opt.badge"
                  class="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-emerald-100 text-emerald-800 shrink-0"
                >
                  {{ opt.badge }}
                </span>
              </div>
              <span
                v-if="opt.sublabel"
                class="text-[10.5px] text-gray-400 font-normal leading-tight mt-0.5"
              >
                {{ opt.sublabel }}
              </span>
            </div>

            <Check
              v-if="opt.value === modelValue"
              :size="14"
              class="text-blue-600 shrink-0 ml-1"
            />
          </div>

          <!-- Quick create button when typing something new even if there are partial results -->
          <div
            v-if="allowCreate && searchQuery.trim() && !hasExactMatch && filteredOptions.length > 0"
            class="p-1 pt-1 border-t border-gray-100"
          >
            <button
              type="button"
              class="w-full py-1.5 px-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded text-blue-700 font-semibold text-xs flex items-center justify-between cursor-pointer transition-colors"
              @click="handleTriggerCreate"
            >
              <div class="flex items-center gap-1.5 truncate">
                <Plus :size="13" />
                <span class="truncate">Tambah <strong>"{{ searchQuery.trim() }}"</strong> Baru...</span>
              </div>
              <span class="text-[10px] text-blue-500 font-normal shrink-0">Klik untuk tambah</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</div>
</template>
