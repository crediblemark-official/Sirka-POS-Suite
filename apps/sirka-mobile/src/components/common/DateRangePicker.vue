<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, RotateCcw, X, Check } from 'lucide-vue-next';
import { localTodayStr, localDateOffset, localPreviousMonthStr, localMonthStartStr, formatDateIndo } from '../../utils/formatters';

const props = withDefaults(defineProps<{
  startDate?: string;
  endDate?: string;
  placeholder?: string;
}>(), {
  startDate: '',
  endDate: '',
  placeholder: 'Pilih Rentang Tanggal'
});

const emit = defineEmits<{
  (e: 'update:startDate', val: string): void;
  (e: 'update:endDate', val: string): void;
  (e: 'update:start-date', val: string): void;
  (e: 'update:end-date', val: string): void;
  (e: 'change', val: { startDate: string; endDate: string }): void;
}>();

const isOpen = ref(false);
const isMobile = ref(false);
const containerRef = ref<HTMLElement | null>(null);
const popoverRef = ref<HTMLElement | null>(null);

function checkIsMobile() {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth < 640;
  }
}

const popoverPosition = ref({
  top: '0px',
  left: '0px'
});

// Temporary selection state when clicking dates
const selectingStart = ref<string | null>(null);
const hoverDate = ref<string | null>(null);

// Calendar viewing month & year
const viewDate = ref<Date>(new Date());

const currentYear = computed(() => viewDate.value.getFullYear());
const currentMonth = computed(() => viewDate.value.getMonth()); // 0 - 11

const monthNamesIndo = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const currentMonthLabel = computed(() => {
  return `${monthNamesIndo[currentMonth.value]} ${currentYear.value}`;
});

function prevMonth() {
  const d = new Date(viewDate.value.getTime());
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  viewDate.value = d;
}

function nextMonth() {
  const d = new Date(viewDate.value.getTime());
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  viewDate.value = d;
}

// Format date to YYYY-MM-DD
function toDateStr(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

// Calendar grid generation (Monday as first day of week)
interface CalendarDay {
  dateStr: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

const calendarDays = computed<CalendarDay[]>(() => {
  const year = currentYear.value;
  const month = currentMonth.value;

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  // Convert Sunday (0) - Saturday (6) to Monday (0) - Sunday (6)
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  const daysInMonth = lastDayOfMonth.getDate();
  const prevMonthLastDay = new Date(year, month, 0).getDate();

  const days: CalendarDay[] = [];
  const today = localTodayStr();

  // Previous month trailing days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const prevMonthDate = new Date(year, month - 1, dayNum);
    const dateStr = toDateStr(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), dayNum);
    days.push({
      dateStr,
      dayNum,
      isCurrentMonth: false,
      isToday: dateStr === today
    });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(year, month, d);
    days.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateStr === today
    });
  }

  // Next month leading days (fill to complete grid)
  const remaining = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const nextMonthDate = new Date(year, month + 1, d);
    const dateStr = toDateStr(nextMonthDate.getFullYear(), nextMonthDate.getMonth(), d);
    days.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateStr === today
    });
  }

  return days;
});

// Selection logic
const effectiveStartDate = computed(() => props.startDate);
const effectiveEndDate = computed(() => props.endDate);

function isSelectedStart(dateStr: string): boolean {
  if (selectingStart.value) return selectingStart.value === dateStr;
  return effectiveStartDate.value === dateStr;
}

function isSelectedEnd(dateStr: string): boolean {
  if (selectingStart.value) {
    return hoverDate.value === dateStr && hoverDate.value > selectingStart.value;
  }
  return effectiveEndDate.value === dateStr;
}

function isInRange(dateStr: string): boolean {
  let start = effectiveStartDate.value;
  let end = effectiveEndDate.value;

  if (selectingStart.value) {
    start = selectingStart.value;
    end = hoverDate.value || selectingStart.value;
    if (end < start) {
      const temp = start;
      start = end;
      end = temp;
    }
  }

  if (!start || !end) return false;
  return dateStr > start && dateStr < end;
}

function emitUpdates(start: string, end: string) {
  emit('update:startDate', start);
  emit('update:endDate', end);
  emit('update:start-date', start);
  emit('update:end-date', end);
  emit('change', { startDate: start, endDate: end });
}

function handleDateClick(day: CalendarDay) {
  if (!selectingStart.value) {
    // Start new range selection
    selectingStart.value = day.dateStr;
  } else {
    // Complete selection
    let start = selectingStart.value;
    let end = day.dateStr;

    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    emitUpdates(start, end);

    selectingStart.value = null;
    hoverDate.value = null;
    closeDropdown();
  }
}

function handleDateHover(day: CalendarDay) {
  if (selectingStart.value) {
    hoverDate.value = day.dateStr;
  }
}

// Preset Options definition
const presets = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'yesterday', label: 'Kemarin' },
  { key: 'week', label: '7 Hari Terakhir' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'prevMonth', label: 'Bulan Lalu' },
  { key: 'all', label: 'Semua Waktu' }
] as const;

function isPresetActive(preset: 'today' | 'yesterday' | 'week' | 'month' | 'prevMonth' | 'all'): boolean {
  if (preset === 'today') {
    return props.startDate === localTodayStr() && props.endDate === localTodayStr();
  }
  if (preset === 'yesterday') {
    return props.startDate === localDateOffset(1) && props.endDate === localDateOffset(1);
  }
  if (preset === 'week') {
    return props.startDate === localDateOffset(7) && props.endDate === localTodayStr();
  }
  if (preset === 'month') {
    return props.startDate === localMonthStartStr() && props.endDate === localTodayStr();
  }
  if (preset === 'prevMonth') {
    const d = new Date();
    d.setDate(0);
    return props.startDate === localPreviousMonthStr() && props.endDate === localTodayStr(d);
  }
  if (preset === 'all') {
    return !props.startDate && !props.endDate;
  }
  return false;
}

// Preset Quick Select
function selectPreset(preset: 'today' | 'yesterday' | 'week' | 'month' | 'prevMonth' | 'all') {
  selectingStart.value = null;
  hoverDate.value = null;

  let start = '';
  let end = '';

  const today = localTodayStr();

  if (preset === 'today') {
    start = today;
    end = today;
  } else if (preset === 'yesterday') {
    start = localDateOffset(1);
    end = start;
  } else if (preset === 'week') {
    start = localDateOffset(7);
    end = today;
  } else if (preset === 'month') {
    start = localMonthStartStr();
    end = today;
  } else if (preset === 'prevMonth') {
    start = localPreviousMonthStr();
    const d = new Date();
    d.setDate(0);
    end = localTodayStr(d);
  } else if (preset === 'all') {
    start = '';
    end = '';
  }

  emitUpdates(start, end);

  if (start) {
    viewDate.value = new Date(start);
  }
  closeDropdown();
}

function handleReset() {
  selectPreset('all');
}

// Display Label for trigger button
const displayLabel = computed(() => {
  if (!props.startDate && !props.endDate) {
    return 'Semua Waktu';
  }
  if (props.startDate === props.endDate) {
    if (props.startDate === localTodayStr()) return 'Hari Ini';
    if (props.startDate === localDateOffset(1)) return 'Kemarin';
    return formatDateIndo(props.startDate);
  }
  if (props.startDate && props.endDate) {
    const startStr = formatDateIndo(props.startDate);
    const endStr = formatDateIndo(props.endDate);
    return `${startStr} – ${endStr}`;
  }
  if (props.startDate) return `Mulai ${formatDateIndo(props.startDate)}`;
  return `Hingga ${formatDateIndo(props.endDate)}`;
});

// Update position for Teleported popover (Desktop only)
function updatePopoverPosition() {
  if (!containerRef.value || isMobile.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const popoverWidth = Math.min(490, window.innerWidth - 24);
  const popoverHeight = 350;

  // Vertical position
  const spaceBelow = window.innerHeight - rect.bottom;
  let top = rect.bottom + 6;
  if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
    top = Math.max(8, rect.top - popoverHeight - 6);
  }

  // Horizontal position: align right edge with button right edge, clamped to viewport
  let left = rect.right - popoverWidth;
  if (left < 10) {
    left = Math.max(10, rect.left);
  }
  if (left + popoverWidth > window.innerWidth - 10) {
    left = Math.max(10, window.innerWidth - popoverWidth - 10);
  }

  popoverPosition.value = {
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`
  };
}

function toggleDropdown() {
  if (isOpen.value) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function openDropdown() {
  checkIsMobile();
  updatePopoverPosition();
  isOpen.value = true;
  if (props.startDate) {
    viewDate.value = new Date(props.startDate);
  }
  nextTick(() => {
    updatePopoverPosition();
  });
}

function closeDropdown() {
  isOpen.value = false;
  selectingStart.value = null;
  hoverDate.value = null;
}

// Click outside handling
function handleClickOutside(e: MouseEvent) {
  if (!isOpen.value) return;
  if (isMobile.value) return; // Mobile uses backdrop overlay
  const target = e.target as Node;
  const inContainer = containerRef.value && containerRef.value.contains(target);
  const inPopover = popoverRef.value && popoverRef.value.contains(target);
  if (!inContainer && !inPopover) {
    closeDropdown();
  }
}

function handleScrollOrResize() {
  checkIsMobile();
  if (isOpen.value) {
    updatePopoverPosition();
  }
}

onMounted(() => {
  checkIsMobile();
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', handleScrollOrResize);
  window.addEventListener('scroll', handleScrollOrResize, true);
  if (props.startDate) {
    viewDate.value = new Date(props.startDate);
  }
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', handleScrollOrResize);
  window.removeEventListener('scroll', handleScrollOrResize, true);
});
</script>

<template>
  <div ref="containerRef" class="relative inline-block text-xs select-none shrink-0">
    <!-- Trigger Button (Matches user screenshot: 28 Dec 22 – 10 Jan 23 ⌄) -->
    <button type="button"
      class="h-7 px-2.5 rounded-lg bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-semibold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      :class="{ 'border-blue-500 ring-2 ring-blue-500/20 text-blue-900 bg-blue-50/20': isOpen || (props.startDate || props.endDate) }"
      @click.stop="toggleDropdown">
      <CalendarIcon :size="13" class="text-blue-600 shrink-0" />
      <span class="max-w-[220px] truncate">{{ displayLabel }}</span>
      <ChevronDown :size="12" class="text-gray-400 transition-transform duration-200"
        :class="{ 'rotate-180 text-blue-600': isOpen }" />
    </button>

    <!-- Popover / Drawer Dropdown (Teleported to body to prevent overflow clipping by headers/ribbons) -->
    <Teleport to="body">
      <!-- 1. MOBILE-FIRST: Bottom Sheet Drawer (Layar Ponsel < 640px) -->
      <div
        v-if="isOpen && isMobile"
        class="fixed inset-0 z-[99999] flex items-end justify-center select-none"
      >
        <!-- Backdrop Blur Gelap -->
        <div
          class="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          @click="closeDropdown"
        ></div>

        <!-- Drawer Content -->
        <div
          class="relative z-10 w-full bg-white rounded-t-3xl shadow-2xl border-t border-gray-200 flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom duration-200"
          @click.stop
        >
          <!-- Pull Bar Indicator -->
          <div class="w-full flex justify-center pt-3 pb-1">
            <div class="w-12 h-1.5 rounded-full bg-gray-300"></div>
          </div>

          <!-- Drawer Header -->
          <div class="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between bg-slate-50 shrink-0">
            <div class="flex items-center gap-2">
              <div class="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                <CalendarIcon :size="16" />
              </div>
              <div>
                <h3 class="font-bold text-sm text-gray-900 leading-tight">Filter Rentang Tanggal</h3>
                <p class="text-[10.5px] text-gray-500 leading-tight mt-0.5">Pilih durasi cepat atau tentukan di kalender</p>
              </div>
            </div>
            <button
              type="button"
              class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              title="Tutup Filter"
              @click="closeDropdown"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Scrollable Body -->
          <div class="flex-1 overflow-y-auto p-4 space-y-3.5">
            <!-- Preset Durasi Cepat (Horizontal Scroll Chips) -->
            <div>
              <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Preset Waktu Cepat</div>
              <div v-horizontal-scroll class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <button
                  v-for="p in presets"
                  :key="p.key"
                  type="button"
                  class="px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 cursor-pointer transition-all border shadow-2xs"
                  :class="isPresetActive(p.key)
                    ? 'bg-blue-600 text-white border-blue-600 font-bold'
                    : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'"
                  @click="selectPreset(p.key)"
                >
                  {{ p.label }}
                </button>
              </div>
            </div>

            <!-- Kalender Grid Interaktif -->
            <div class="bg-gray-50/80 border border-gray-200 rounded-2xl p-3">
              <!-- Calendar Header -->
              <div class="flex items-center justify-between pb-2 mb-2 border-b border-gray-200">
                <span class="font-bold text-gray-900 text-sm tracking-tight">{{ currentMonthLabel }}</span>
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="p-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 cursor-pointer shadow-2xs transition-colors"
                    title="Bulan sebelumnya"
                    @click="prevMonth"
                  >
                    <ChevronLeft :size="16" />
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 cursor-pointer shadow-2xs transition-colors"
                    title="Bulan berikutnya"
                    @click="nextMonth"
                  >
                    <ChevronRight :size="16" />
                  </button>
                </div>
              </div>

              <!-- Days of Week Header -->
              <div class="grid grid-cols-7 text-center font-bold text-gray-400 text-[11px] mb-2">
                <span>Sen</span>
                <span>Sel</span>
                <span>Rab</span>
                <span>Kam</span>
                <span>Jum</span>
                <span>Sab</span>
                <span>Min</span>
              </div>

              <!-- Days Grid -->
              <div class="grid grid-cols-7 gap-y-1.5 text-center text-xs">
                <div
                  v-for="(day, idx) in calendarDays"
                  :key="idx"
                  class="relative flex items-center justify-center h-9 cursor-pointer group"
                  :class="{
                    'bg-blue-100 text-blue-900 font-bold': isInRange(day.dateStr),
                    'rounded-l-full': isSelectedStart(day.dateStr) && (isSelectedEnd(day.dateStr) || isInRange(day.dateStr)),
                    'rounded-r-full': isSelectedEnd(day.dateStr) && (isSelectedStart(day.dateStr) || isInRange(day.dateStr))
                  }"
                  @click="handleDateClick(day)"
                >
                  <!-- Bubble Highlight Start / End Date -->
                  <span
                    v-if="isSelectedStart(day.dateStr) || isSelectedEnd(day.dateStr)"
                    class="absolute inset-0 m-auto w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shadow-xs z-10 scale-100"
                  >
                    {{ day.dayNum }}
                  </span>

                  <!-- Normal Day -->
                  <span
                    v-else
                    class="w-8 h-8 rounded-full flex items-center justify-center transition-all group-active:bg-gray-200"
                    :class="{
                      'text-gray-300': !day.isCurrentMonth,
                      'text-gray-800 font-medium': day.isCurrentMonth,
                      'border border-blue-500 font-bold text-blue-600': day.isToday && !isInRange(day.dateStr)
                    }"
                  >
                    {{ day.dayNum }}
                  </span>
                </div>
              </div>

              <!-- Helper Bottom Info -->
              <div class="mt-2.5 pt-2 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
                <span v-if="selectingStart" class="text-blue-600 font-bold animate-pulse">
                  Pilih tanggal akhir rentang...
                </span>
                <span v-else>
                  Ketuk tanggal untuk tentukan rentang
                </span>
                <span v-if="props.startDate && props.endDate" class="font-mono text-gray-800 font-bold">
                  {{ props.startDate }} &rarr; {{ props.endDate }}
                </span>
              </div>
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              class="px-3 py-2 text-gray-600 hover:text-rose-600 font-bold hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
              @click="handleReset"
            >
              <RotateCcw :size="13" />
              <span>Semua Waktu</span>
            </button>

            <button
              type="button"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
              @click="closeDropdown"
            >
              <Check :size="14" />
              <span>Terapkan</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 2. DESKTOP / TABLET: Popover Dropdown (Layar >= 640px) -->
      <transition
        v-else-if="isOpen && !isMobile"
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <div
          ref="popoverRef"
          :style="{
            position: 'fixed',
            top: popoverPosition.top,
            left: popoverPosition.left,
            zIndex: 99999
          }"
          class="bg-white rounded-2xl shadow-2xl border border-gray-200/90 p-4 flex gap-5 select-none"
          style="min-width: 490px; max-width: calc(100vw - 24px);"
          @click.stop
        >
          <!-- Sisi Kiri: Preset Durasi Cepat -->
          <div class="w-32 flex flex-col justify-between border-r border-gray-100 pr-3 text-xs text-gray-600">
            <div class="flex flex-col gap-1">
              <button
                v-for="p in presets"
                :key="p.key"
                type="button"
                class="text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium cursor-pointer"
                :class="{ 'bg-blue-50 text-blue-700 font-bold': isPresetActive(p.key) }"
                @click="selectPreset(p.key)"
              >
                {{ p.label }}
              </button>
            </div>

            <!-- Tombol Reset -->
            <button
              type="button"
              class="text-left px-2.5 py-1.5 text-blue-600 hover:text-blue-800 font-bold hover:bg-blue-50/60 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer mt-4"
              @click="handleReset"
            >
              <RotateCcw :size="12" />
              <span>Reset</span>
            </button>
          </div>

          <!-- Sisi Kanan: Interactive Mini Calendar -->
          <div class="flex-1 flex flex-col select-none">
            <!-- Calendar Header (Month/Year & Prev/Next Nav) -->
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
              <span class="font-bold text-gray-800 text-sm tracking-tight">{{ currentMonthLabel }}</span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  class="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800 cursor-pointer transition-colors"
                  title="Bulan sebelumnya"
                  @click="prevMonth"
                >
                  <ChevronLeft :size="15" />
                </button>
                <button
                  type="button"
                  class="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-800 cursor-pointer transition-colors"
                  title="Bulan berikutnya"
                  @click="nextMonth"
                >
                  <ChevronRight :size="15" />
                </button>
              </div>
            </div>

            <!-- Days of Week Header -->
            <div class="grid grid-cols-7 text-center font-bold text-gray-400 text-[10.5px] mb-1.5">
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
              <span>Su</span>
            </div>

            <!-- Days Grid -->
            <div class="grid grid-cols-7 gap-y-1 text-center text-xs">
              <div
                v-for="(day, idx) in calendarDays"
                :key="idx"
                class="relative flex items-center justify-center h-8 cursor-pointer group"
                :class="{
                  'bg-blue-50 text-blue-900': isInRange(day.dateStr),
                  'rounded-l-full': isSelectedStart(day.dateStr) && (isSelectedEnd(day.dateStr) || isInRange(day.dateStr)),
                  'rounded-r-full': isSelectedEnd(day.dateStr) && (isSelectedStart(day.dateStr) || isInRange(day.dateStr))
                }"
                @click="handleDateClick(day)"
                @mouseenter="handleDateHover(day)"
              >
                <!-- Highlight Bubble for Start / End Date -->
                <span
                  v-if="isSelectedStart(day.dateStr) || isSelectedEnd(day.dateStr)"
                  class="absolute inset-0 m-auto w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shadow-xs z-10 scale-100 animate-in zoom-in-75 duration-100"
                >
                  {{ day.dayNum }}
                </span>

                <!-- Normal Day Number -->
                <span
                  v-else
                  class="w-7 h-7 rounded-full flex items-center justify-center transition-all group-hover:bg-gray-100"
                  :class="{
                    'text-gray-300 font-normal': !day.isCurrentMonth,
                    'text-gray-800 font-medium': day.isCurrentMonth,
                    'border border-blue-400 font-bold text-blue-600': day.isToday && !isInRange(day.dateStr)
                  }"
                >
                  {{ day.dayNum }}
                </span>
              </div>
            </div>

            <!-- Helper hint at bottom -->
            <div class="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
              <span v-if="selectingStart" class="text-blue-600 font-medium">
                Pilih tanggal akhir rentang...
              </span>
              <span v-else>
                Klik tanggal untuk pilih
              </span>
              <span v-if="props.startDate && props.endDate" class="font-mono text-gray-700 font-bold">
                {{ props.startDate }} &rarr; {{ props.endDate }}
              </span>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>
