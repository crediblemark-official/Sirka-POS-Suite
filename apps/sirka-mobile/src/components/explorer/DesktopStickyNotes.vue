<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { GripHorizontal, X } from 'lucide-vue-next';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import {
  type StickyNoteColor,
  type StickyNoteItem,
  NOTE_COLORS,
  colorOptions
} from '../../types/stickyNote';

const props = defineProps<{
  containerRef?: HTMLElement | null;
}>();

const STICKY_NOTES_STORAGE_KEY = 'kasir_citra_canvas_sticky_notes_v1';

const stickyNotes = ref<StickyNoteItem[]>([]);
const maxNoteZIndex = ref(30);
const confirmDialog = useConfirmDialog();

// Dragging state
const draggingNoteId = ref<string | null>(null);
let startNoteMouseX = 0;
let startNoteMouseY = 0;
let startNoteX = 0;
let startNoteY = 0;

function loadStickyNotes() {
  try {
    const raw = localStorage.getItem(STICKY_NOTES_STORAGE_KEY);
    if (!raw) {
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
  const area = props.containerRef;
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

async function deleteStickyNote(id: string) {
  const note = stickyNotes.value.find(n => n.id !== id);
  const textSnippet = note?.text?.trim()
    ? (note.text.trim().length > 45 ? note.text.trim().substring(0, 45) + '...' : note.text.trim())
    : '';

  const confirmed = await confirmDialog.confirm({
    title: 'Hapus Catatan',
    message: 'Hapus catatan memo ini?',
    details: textSnippet ? `"${textSnippet}"` : 'Catatan yang dihapus tidak dapat dipulihkan.',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger'
  });

  if (confirmed) {
    stickyNotes.value = stickyNotes.value.filter(n => n.id !== id);
    saveStickyNotes();
  }
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

  const area = props.containerRef;
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
    const area = props.containerRef;
    const maxX = area ? Math.max(100, area.clientWidth - note.width) : 2000;
    const maxY = area ? Math.max(100, area.clientHeight - note.height) : 2000;
    note.x = Math.max(8, Math.min(maxX, Math.round(note.x / 8) * 8));
    note.y = Math.max(8, Math.min(maxY, Math.round(note.y / 8) * 8));
  }

  draggingNoteId.value = null;
  saveStickyNotes();
}

onMounted(() => {
  loadStickyNotes();
});

onUnmounted(() => {
  window.removeEventListener('pointermove', onNotePointerMove);
  window.removeEventListener('pointerup', onNotePointerUp);
  draggingNoteId.value = null;
});

defineExpose({
  addStickyNote
});
</script>

<template>
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

      <!-- Opsi Warna (Tanpa Border) & Tombol Hapus -->
      <div class="flex items-center gap-1.5" @pointerdown.stop @mousedown.stop>
        <!-- Color Picker Dots -->
        <div class="flex items-center gap-1">
          <button
            v-for="cKey in colorOptions"
            :key="cKey"
            type="button"
            class="w-2.5 h-2.5 rounded-full transition-transform cursor-pointer"
            :class="[
              note.color === cKey ? 'scale-130 opacity-100' : 'opacity-50 hover:opacity-100 hover:scale-110'
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
          @pointerdown.stop
          @mousedown.stop
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
</template>
