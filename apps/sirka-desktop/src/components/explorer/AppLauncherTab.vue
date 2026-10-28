<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  ShoppingCart,
  Truck,
  Package,
  Users,
  Tag,
  CreditCard,
  Calendar,
  BookOpen,
  Store,
  FileSpreadsheet,
  Scale,
  LayoutDashboard,
  Lock,
  StickyNote,
  Server
} from 'lucide-vue-next';

import { useLicenseStore } from '../../stores/licenseStore';
import DesktopStickyNotes from './DesktopStickyNotes.vue';

export type ModuleTab =
  | 'home'
  | 'pos'
  | 'discounts'
  | 'loyalty'
  | 'receiving'
  | 'preorder'
  | 'ledger'
  | 'reports'
  | 'returns'
  | 'products'
  | 'vendors'
  | 'suppliers'
  | 'buyers'
  | 'branding'
  | 'server'
  | 'master'
  | 'license'
  | 'launcher';


export type { StickyNoteColor, StickyNoteItem } from '../../types/stickyNote';

const props = withDefaults(
  defineProps<{
    openTabIds?: ModuleTab[];
    searchQuery?: string;
  }>(),
  {
    openTabIds: () => [],
    searchQuery: ''
  }
);

const emit = defineEmits<{
  (e: 'open-tab', id: ModuleTab): void;
}>();

const licenseStore = useLicenseStore();

export interface ShortcutDef {
  id: ModuleTab;
  title: string;
  icon: any;
  color: string;
  defaultX: number;
  defaultY: number;
}

// 12 Modul Shortcut Desktop dengan Icon Asli & Warna Khas Masing-masing
const shortcutDefs: ShortcutDef[] = [
  { id: 'home', title: 'Home', icon: LayoutDashboard, color: '#4f46e5', defaultX: 28, defaultY: 28 },
  { id: 'pos', title: 'Kasir', icon: ShoppingCart, color: '#2563eb', defaultX: 138, defaultY: 28 },
  { id: 'products', title: 'Inventaris', icon: Package, color: '#7c3aed', defaultX: 248, defaultY: 28 },
  { id: 'vendors', title: 'Kategori', icon: Scale, color: '#ea580c', defaultX: 358, defaultY: 28 },
  { id: 'suppliers', title: 'Supplier', icon: Truck, color: '#db2777', defaultX: 468, defaultY: 28 },
  { id: 'buyers', title: 'Pelanggan', icon: Users, color: '#0284c7', defaultX: 578, defaultY: 28 },
  { id: 'discounts', title: 'Diskon', icon: Tag, color: '#dc2626', defaultX: 28, defaultY: 148 },
  { id: 'loyalty', title: 'Member', icon: CreditCard, color: '#d97706', defaultX: 138, defaultY: 148 },
  { id: 'preorder', title: 'Pesanan', icon: Calendar, color: '#0d9488', defaultX: 248, defaultY: 148 },
  { id: 'reports', title: 'Laporan', icon: FileSpreadsheet, color: '#16a34a', defaultX: 358, defaultY: 148 },
  { id: 'ledger', title: 'Buku Kas', icon: BookOpen, color: '#0891b2', defaultX: 468, defaultY: 148 },
  { id: 'branding', title: 'Profil', icon: Store, color: '#475569', defaultX: 578, defaultY: 148 },
  { id: 'server', title: 'Server', icon: Server, color: '#0284c7', defaultX: 28, defaultY: 268 }
];


export interface ShortcutItem extends ShortcutDef {
  x: number;
  y: number;
}

const STORAGE_KEY = 'kasir_citra_desktop_free_positions_v3';

// Inisialisasi state tanpa JSON.stringify agar reference komponen icon tidak hilang
const shortcuts = ref<ShortcutItem[]>(
  shortcutDefs.map(def => ({
    ...def,
    x: def.defaultX,
    y: def.defaultY
  }))
);

const desktopAreaRef = ref<HTMLDivElement | null>(null);
const stickyNotesRef = ref<InstanceType<typeof DesktopStickyNotes> | null>(null);

function loadPositions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const posMap: Record<string, { x: number; y: number }> = JSON.parse(raw);
    shortcuts.value.forEach(item => {
      if (posMap[item.id]) {
        item.x = posMap[item.id].x;
        item.y = posMap[item.id].y;
      }
    });

    if (!posMap['home']) {
      const homeItem = shortcuts.value.find(s => s.id === 'home');
      if (homeItem) {
        let col = 0;
        let row = 0;
        const isOccupied = (x: number, y: number) => {
          return shortcuts.value.some(s => s.id !== 'home' && Math.abs(s.x - x) < 80 && Math.abs(s.y - y) < 80);
        };
        while (isOccupied(homeItem.x, homeItem.y) && row < 5) {
          col++;
          if (col > 5) {
            col = 0;
            row++;
          }
          homeItem.x = 28 + col * 110;
          homeItem.y = 28 + row * 120;
        }
      }
    }
  } catch (err) {
    console.error('Gagal memuat posisi shortcut desktop:', err);
  }
}

function savePositions() {
  try {
    const posMap: Record<string, { x: number; y: number }> = {};
    shortcuts.value.forEach(item => {
      posMap[item.id] = { x: item.x, y: item.y };
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posMap));
  } catch (err) {
    console.error('Gagal menyimpan posisi shortcut desktop:', err);
  }
}

function onCanvasDblClick(e: MouseEvent) {
  const area = desktopAreaRef.value;
  if (area && e.target === area) {
    const rect = area.getBoundingClientRect();
    const x = e.clientX - rect.left - 115;
    const y = e.clientY - rect.top - 30;
    stickyNotesRef.value?.addStickyNote(x, y);
  }
}

onMounted(() => {
  loadPositions();
});

const isSearching = computed(() => !!props.searchQuery?.trim());

// Dragging bebas posisi shortcut seperti di desktop PC
const draggingId = ref<ModuleTab | null>(null);
const isMoved = ref(false);
let startMouseX = 0;
let startMouseY = 0;
let startItemX = 0;
let startItemY = 0;

function onPointerDown(item: ShortcutItem, e: PointerEvent) {
  if (e.button !== 0) return; // Hanya klik kiri

  draggingId.value = item.id;
  isMoved.value = false;
  startMouseX = e.clientX;
  startMouseY = e.clientY;
  startItemX = item.x;
  startItemY = item.y;

  (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}

function onPointerMove(e: PointerEvent) {
  if (!draggingId.value) return;

  const dx = e.clientX - startMouseX;
  const dy = e.clientY - startMouseY;

  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
    isMoved.value = true;
  }

  const item = shortcuts.value.find(i => i.id === draggingId.value);
  if (!item) return;

  const area = desktopAreaRef.value;
  const maxX = area ? Math.max(100, area.clientWidth - 88) : 2000;
  const maxY = area ? Math.max(100, area.clientHeight - 96) : 2000;

  item.x = Math.max(8, Math.min(maxX, startItemX + dx));
  item.y = Math.max(8, Math.min(maxY, startItemY + dy));
}

function onPointerUp() {
  if (!draggingId.value) return;

  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);

  const currentId = draggingId.value;
  const item = shortcuts.value.find(i => i.id === currentId);

  if (item && isMoved.value) {
    const area = desktopAreaRef.value;
    const maxX = area ? Math.max(100, area.clientWidth - 88) : 2000;
    const maxY = area ? Math.max(100, area.clientHeight - 96) : 2000;
    item.x = Math.max(8, Math.min(maxX, Math.round(item.x / 8) * 8));
    item.y = Math.max(8, Math.min(maxY, Math.round(item.y / 8) * 8));
    savePositions();
  }

  const moved = isMoved.value;
  draggingId.value = null;

  // Jika tidak digeser (hanya klik biasa), buka tab
  if (!moved) {
    emit('open-tab', currentId);
  }
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  draggingId.value = null;
});
</script>

<template>
  <!-- Area Desktop PC: Bersih, Tanpa Card Box, Tanpa Header Reset, Letak Bebas Dipindah-pindah -->
  <div
    ref="desktopAreaRef"
    class="relative flex-1 w-full h-full bg-[#fdfdfc] overflow-hidden select-none touch-none"
    @dblclick="onCanvasDblClick"
  >
    <!-- Floating Toolbar di Pojok Kanan Atas Canvas -->
    <div class="absolute top-3.5 right-3.5 z-40 flex items-center gap-2">
      <button
        type="button"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 hover:bg-white text-gray-700 hover:text-gray-900 border border-gray-200/90 shadow-xs hover:shadow transition-all cursor-pointer text-xs font-semibold backdrop-blur-xs select-none active:scale-95"
        title="Tambah Catatan Tempel Baru (atau klik ganda di canvas)"
        @click="stickyNotesRef?.addStickyNote()"
      >
        <StickyNote :size="14" class="text-amber-500" />
        <span>+ Sticky Note</span>
      </button>
    </div>

    <!-- Shortcut Desktop PC -->
    <div
      v-for="item in shortcuts"
      :key="item.id"
      :style="{
        left: `${item.x}px`,
        top: `${item.y}px`,
        zIndex: draggingId === item.id ? 50 : 10
      }"
      class="group absolute flex flex-col items-center justify-start w-22 select-none p-1.5 rounded-xl cursor-grab active:cursor-grabbing hover:bg-black/[0.04] active:bg-blue-500/10 transition-colors"
      :class="[
        isSearching && !item.title.toLowerCase().includes(props.searchQuery.toLowerCase().trim())
          ? 'opacity-20 pointer-events-none'
          : 'opacity-100',
        draggingId === item.id ? 'transition-none pointer-events-auto' : ''
      ]"
      @pointerdown="onPointerDown(item, $event)"
    >
      <!-- Ikon Asli Berwarna Khas Tiap Modul -->
      <div
        class="relative w-14 h-14 flex items-center justify-center transition-transform duration-150"
        :class="draggingId === item.id ? 'scale-115' : 'group-hover:scale-110 group-active:scale-95'"
      >
        <component
          :is="item.icon"
          :size="42"
          :stroke-width="1.8"
          :style="{ color: item.color }"
          class="drop-shadow-xs transition-colors"
        />

        <!-- Titik Hijau Indikator Tab Sedang Terbuka -->
        <span
          v-if="openTabIds.includes(item.id)"
          class="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 border border-white rounded-full shadow-xs"
          title="Tab sedang aktif / terbuka"
        ></span>
        <!-- Indikator Fitur Terkunci jika belum berlisensi -->
        <span
          v-else-if="!licenseStore.isLicensed"
          class="absolute -top-1 -right-1 p-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 shadow-2xs"
          title="Fitur Terkunci"
        >
          <Lock :size="10" />
        </span>
      </div>

      <!-- Teks Nama Shortcut Tepat di Bawah Ikon (Desktop Shortcut Label) -->
      <span
        class="text-xs font-medium text-gray-800 text-center leading-tight mt-1.5 px-0.5 max-w-[88px] line-clamp-2 select-none transition-colors group-hover:text-blue-700"
        :class="openTabIds.includes(item.id) ? 'font-semibold text-gray-950' : ''"
        :title="item.title"
      >
        {{ item.title }}
      </span>
    </div>

    <!-- Sticky Notes Component Terpisah -->
    <DesktopStickyNotes ref="stickyNotesRef" :container-ref="desktopAreaRef" />
  </div>
</template>
