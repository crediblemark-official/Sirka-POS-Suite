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
  Scale
} from 'lucide-vue-next';

export type ModuleTab =
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
  | 'master'
  | 'launcher';

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

export interface ShortcutDef {
  id: ModuleTab;
  title: string;
  icon: any;
  color: string;
  defaultX: number;
  defaultY: number;
}

// 11 Modul Shortcut Desktop dengan Icon Asli & Warna Khas Masing-masing
const shortcutDefs: ShortcutDef[] = [
  { id: 'pos', title: 'Kasir & Penjualan', icon: ShoppingCart, color: '#2563eb', defaultX: 28, defaultY: 28 },
  { id: 'products', title: 'Inventaris & Stok', icon: Package, color: '#7c3aed', defaultX: 138, defaultY: 28 },
  { id: 'vendors', title: 'Satuan & Kategori', icon: Scale, color: '#ea580c', defaultX: 248, defaultY: 28 },
  { id: 'suppliers', title: 'Mitra Supplier', icon: Truck, color: '#db2777', defaultX: 358, defaultY: 28 },
  { id: 'buyers', title: 'Data Pelanggan', icon: Users, color: '#4f46e5', defaultX: 468, defaultY: 28 },
  { id: 'discounts', title: 'Diskon & Kupon', icon: Tag, color: '#dc2626', defaultX: 578, defaultY: 28 },
  { id: 'loyalty', title: 'Member & Poin', icon: CreditCard, color: '#d97706', defaultX: 28, defaultY: 148 },
  { id: 'preorder', title: 'Pesanan Mingguan', icon: Calendar, color: '#0d9488', defaultX: 138, defaultY: 148 },
  { id: 'reports', title: 'Laporan Keuangan', icon: FileSpreadsheet, color: '#16a34a', defaultX: 248, defaultY: 148 },
  { id: 'ledger', title: 'Buku Kas & Nota', icon: BookOpen, color: '#0284c7', defaultX: 358, defaultY: 148 },
  { id: 'branding', title: 'Profil Toko & Struk', icon: Store, color: '#475569', defaultX: 468, defaultY: 148 }
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
    // BUG FIX: snapping ke kelipatan 8px dilakukan SETELAH clamping sehingga
    // bisa mendorong ikon keluar area (mis. max 812 -> 816, terpotong 4px).
    // Sekarang clamp dilakukan lagi setelah snapping.
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

// BUG FIX: listener pointermove/pointerup hanya dilepas saat pointerup.
// Kalau tab di-unmount saat sedang drag, listener tetap terpasang selamanya
// dan terus mengubah posisi shortcut.
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
  >
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
      <!-- Ikon Asli Berwarna Khas Tiap Modul (Besar, Jernih, Bukan Folder & Bukan Card Box) -->
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
  </div>
</template>
