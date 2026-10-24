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
  X,
  GripHorizontal
} from 'lucide-vue-next';
import { useLicenseStore } from '../../stores/licenseStore';

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
  | 'master'
  | 'license'
  | 'launcher';

export type StickyNoteColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple' | 'orange';

export interface StickyNoteItem {
  id: string;
  text: string;
  color: StickyNoteColor;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  createdAt: number;
}

const colorOptions: StickyNoteColor[] = ['yellow', 'green', 'blue', 'pink', 'purple', 'orange'];

const NOTE_COLORS: Record<StickyNoteColor, {
  bg: string;
  header: string;
  border: string;
  text: string;
  dot: string;
}> = {
  yellow: {
    bg: 'bg-[#fef9c3]/95',
    header: 'bg-[#fef08a]/90 border-[#fde047]/80',
    border: 'border-[#fde047]',
    text: 'text-amber-950 placeholder:text-amber-800/40',
    dot: '#eab308'
  },
  green: {
    bg: 'bg-[#dcfce7]/95',
    header: 'bg-[#bbf7d0]/90 border-[#86efac]/80',
    border: 'border-[#86efac]',
    text: 'text-emerald-950 placeholder:text-emerald-800/40',
    dot: '#22c55e'
  },
  blue: {
    bg: 'bg-[#e0f2fe]/95',
    header: 'bg-[#bae6fd]/90 border-[#7dd3fc]/80',
    border: 'border-[#7dd3fc]',
    text: 'text-sky-950 placeholder:text-sky-800/40',
    dot: '#0ea5e9'
  },
  pink: {
    bg: 'bg-[#ffe4e6]/95',
    header: 'bg-[#fecdd3]/90 border-[#fda4af]/80',
    border: 'border-[#fda4af]',
    text: 'text-rose-950 placeholder:text-rose-800/40',
    dot: '#f43f5e'
  },
  purple: {
    bg: 'bg-[#f3e8ff]/95',
    header: 'bg-[#e9d5ff]/90 border-[#d8b4fe]/80',
    border: 'border-[#d8b4fe]',
    text: 'text-purple-950 placeholder:text-purple-800/40',
    dot: '#a855f7'
  },
  orange: {
    bg: 'bg-[#ffedd5]/95',
    header: 'bg-[#fed7aa]/90 border-[#fdba74]/80',
    border: 'border-[#fdba74]',
    text: 'text-orange-950 placeholder:text-orange-800/40',
    dot: '#f97316'
  }
};

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
  { id: 'branding', title: 'Profil', icon: Store, color: '#475569', defaultX: 578, defaultY: 148 }
];

export interface ShortcutItem extends ShortcutDef {
  x: number;
  y: number;
}

const STORAGE_KEY = 'kasir_citra_desktop_free_positions_v3';
const STICKY_NOTES_STORAGE_KEY = 'kasir_citra_canvas_sticky_notes_v1';

// Inisialisasi state tanpa JSON.stringify agar reference komponen icon tidak hilang
const shortcuts = ref<ShortcutItem[]>(
  shortcutDefs.map(def => ({
    ...def,
    x: def.defaultX,
    y: def.defaultY
  }))
);

const stickyNotes = ref<StickyNoteItem[]>([]);
const maxNoteZIndex = ref(30);
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

function loadStickyNotes() {
  try {
    const raw = localStorage.getItem(STICKY_NOTES_STORAGE_KEY);
    if (!raw) {
      // Catatan awal ramah kasir saat pertama kali dibuka
      stickyNotes.value = [
        {
          id: 'welcome_note',
          text: '📌 Catatan Kasir:\n• Tarik & geser catatan ini ke mana saja di layar.\n• Klik ganda di area kosong canvas untuk menambah baru.',
          color: 'yellow',
          x: 460,
          y: 220,
          width: 230,
          height: 160,
          zIndex: 30,
          createdAt: Date.now()
        }
      ];
      saveStickyNotes();
      return;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      stickyNotes.value = parsed;
      parsed.forEach(n => {
        if (n.zIndex && n.zIndex > maxNoteZIndex.value) {
          maxNoteZIndex.value = n.zIndex;
        }
      });
    }
  } catch (err) {
    console.error('Gagal memuat catatan sticky notes:', err);
  }
}

function saveStickyNotes() {
  try {
    localStorage.setItem(STICKY_NOTES_STORAGE_KEY, JSON.stringify(stickyNotes.value));
  } catch (err) {
    console.error('Gagal menyimpan catatan sticky notes:', err);
  }
}

function bringNoteToFront(id: string) {
  maxNoteZIndex.value += 1;
  const note = stickyNotes.value.find(n => n.id === id);
  if (note) {
    note.zIndex = maxNoteZIndex.value;
    saveStickyNotes();
  }
}

function addStickyNote(posX?: number, posY?: number) {
  const area = desktopAreaRef.value;
  const count = stickyNotes.value.length;
  const defaultX = posX ?? (area ? Math.max(40, Math.floor(area.clientWidth / 2 - 115 + (count % 4) * 24)) : 350);
  const defaultY = posY ?? (area ? Math.max(40, Math.floor(area.clientHeight / 2 - 80 + (count % 4) * 24)) : 200);

  const nextColor = colorOptions[count % colorOptions.length];
  maxNoteZIndex.value += 1;

  const newNote: StickyNoteItem = {
    id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    text: '',
    color: nextColor,
    x: Math.max(8, defaultX),
    y: Math.max(8, defaultY),
    width: 230,
    height: 160,
    zIndex: maxNoteZIndex.value,
    createdAt: Date.now()
  };

  stickyNotes.value.push(newNote);
  saveStickyNotes();
}

function deleteStickyNote(id: string) {
  stickyNotes.value = stickyNotes.value.filter(n => n.id !== id);
  saveStickyNotes();
}

function setNoteColor(note: StickyNoteItem, color: StickyNoteColor) {
  note.color = color;
  saveStickyNotes();
}

function formatNoteTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Dragging Sticky Note
const draggingNoteId = ref<string | null>(null);
let startNoteMouseX = 0;
let startNoteMouseY = 0;
let startNoteX = 0;
let startNoteY = 0;

function onNotePointerDown(note: StickyNoteItem, e: PointerEvent) {
  if (e.button !== 0) return;

  bringNoteToFront(note.id);
  draggingNoteId.value = note.id;
  startNoteMouseX = e.clientX;
  startNoteMouseY = e.clientY;
  startNoteX = note.x;
  startNoteY = note.y;

  (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);

  window.addEventListener('pointermove', onNotePointerMove);
  window.addEventListener('pointerup', onNotePointerUp);
}

function onNotePointerMove(e: PointerEvent) {
  if (!draggingNoteId.value) return;

  const dx = e.clientX - startNoteMouseX;
  const dy = e.clientY - startNoteMouseY;

  const note = stickyNotes.value.find(n => n.id === draggingNoteId.value);
  if (!note) return;

  const area = desktopAreaRef.value;
  const maxX = area ? Math.max(100, area.clientWidth - note.width) : 2000;
  const maxY = area ? Math.max(100, area.clientHeight - note.height) : 2000;

  note.x = Math.max(8, Math.min(maxX, startNoteX + dx));
  note.y = Math.max(8, Math.min(maxY, startNoteY + dy));
}

function onNotePointerUp() {
  if (!draggingNoteId.value) return;

  window.removeEventListener('pointermove', onNotePointerMove);
  window.removeEventListener('pointerup', onNotePointerUp);

  const note = stickyNotes.value.find(n => n.id === draggingNoteId.value);
  if (note) {
    const area = desktopAreaRef.value;
    const maxX = area ? Math.max(100, area.clientWidth - note.width) : 2000;
    const maxY = area ? Math.max(100, area.clientHeight - note.height) : 2000;
    note.x = Math.max(8, Math.min(maxX, Math.round(note.x / 8) * 8));
    note.y = Math.max(8, Math.min(maxY, Math.round(note.y / 8) * 8));
  }

  draggingNoteId.value = null;
  saveStickyNotes();
}

function onCanvasDblClick(e: MouseEvent) {
  const area = desktopAreaRef.value;
  if (area && e.target === area) {
    const rect = area.getBoundingClientRect();
    const x = e.clientX - rect.left - 115;
    const y = e.clientY - rect.top - 30;
    addStickyNote(x, y);
  }
}

onMounted(() => {
  loadPositions();
  loadStickyNotes();
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
  window.removeEventListener('pointermove', onNotePointerMove);
  window.removeEventListener('pointerup', onNotePointerUp);
  draggingId.value = null;
  draggingNoteId.value = null;
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
        @click="addStickyNote()"
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

    <!-- Sticky Notes di Canvas Desktop -->
    <div
      v-for="note in stickyNotes"
      :key="note.id"
      :style="{
        left: `${note.x}px`,
        top: `${note.y}px`,
        width: `${note.width}px`,
        height: `${note.height}px`,
        zIndex: note.zIndex
      }"
      class="group/note absolute flex flex-col rounded-xl border shadow-md transition-shadow select-none overflow-hidden"
      :class="[
        NOTE_COLORS[note.color].bg,
        NOTE_COLORS[note.color].border,
        draggingNoteId === note.id ? 'shadow-xl scale-[1.01] transition-none' : 'hover:shadow-lg'
      ]"
      @click="bringNoteToFront(note.id)"
    >
      <!-- Header Note (Area Drag) -->
      <div
        class="flex items-center justify-between px-2.5 py-1.5 border-b cursor-grab active:cursor-grabbing select-none"
        :class="NOTE_COLORS[note.color].header"
        @pointerdown="onNotePointerDown(note, $event)"
      >
        <!-- Grip & Waktu Dibuat -->
        <div class="flex items-center gap-1.5 opacity-60">
          <GripHorizontal :size="12" />
          <span class="text-[10px] font-mono tracking-tight font-medium">
            {{ formatNoteTime(note.createdAt) }}
          </span>
        </div>

        <!-- Opsi Warna & Tombol Hapus -->
        <div class="flex items-center gap-1.5" @pointerdown.stop>
          <!-- Color Picker Dots -->
          <div class="flex items-center gap-1">
            <button
              v-for="cKey in colorOptions"
              :key="cKey"
              type="button"
              class="w-2.5 h-2.5 rounded-full transition-transform cursor-pointer"
              :class="[
                note.color === cKey ? 'scale-125 ring-1 ring-black/40 ring-offset-1' : 'opacity-70 hover:opacity-100 hover:scale-110'
              ]"
              :style="{ backgroundColor: NOTE_COLORS[cKey].dot }"
              :title="`Warna ${cKey}`"
              @click.stop="setNoteColor(note, cKey)"
            />
          </div>

          <!-- Tombol Hapus -->
          <button
            type="button"
            class="p-0.5 rounded text-black/40 hover:text-rose-600 hover:bg-black/10 cursor-pointer transition-colors ml-1"
            title="Hapus Catatan"
            @click.stop="deleteStickyNote(note.id)"
          >
            <X :size="12" />
          </button>
        </div>
      </div>

      <!-- Area Teks Catatan -->
      <textarea
        v-model="note.text"
        class="w-full flex-1 p-2.5 bg-transparent resize-none focus:outline-hidden text-xs leading-relaxed select-text cursor-text font-sans"
        :class="NOTE_COLORS[note.color].text"
        placeholder="Tulis catatan kasir, pengingat, atau memo penting..."
        @input="saveStickyNotes"
        @pointerdown.stop
        @mousedown.stop
        @click="bringNoteToFront(note.id)"
      ></textarea>
    </div>
  </div>
</template>
