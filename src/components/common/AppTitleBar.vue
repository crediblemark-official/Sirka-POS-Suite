<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { invoke } from '@tauri-apps/api/core';
import {
  Minus,
  Square,
  Copy,
  X,
  Store
} from 'lucide-vue-next';

const settingsStore = useSettingsStore();
const shiftStore = useShiftStore();
const confirmDialog = useConfirmDialog();

const isMaximized = ref(false);
let unlistenClose: (() => void) | null = null;

async function notifyShiftActiveAndPromptClose() {
  const shouldCloseShift = await confirmDialog.confirm({
    title: 'Shift Kasir Masih Aktif',
    message: 'Aplikasi tidak dapat ditutup karena sesi shift kasir masih berjalan.',
    details: 'Wajib melakukan tutup shift dan rekapitulasi uang kas kasir terlebih dahulu sebelum keluar dari aplikasi demi keamanan pencatatan keuangan.',
    confirmText: 'Tutup Shift Sekarang',
    cancelText: 'Kembali ke Kasir',
    type: 'warning'
  });

  if (shouldCloseShift) {
    shiftStore.showCloseShiftModal = true;
  }
}

// Window control functions with safe fallbacks (works in Tauri desktop and safe in browser)
async function handleMinimize() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().minimize();
  } catch {
    try {
      await invoke('window_minimize');
    } catch (e) {
      console.warn('Window minimize not supported in current environment:', e);
    }
  }
}

async function handleToggleMaximize() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    await win.toggleMaximize();
    isMaximized.value = await win.isMaximized();
  } catch {
    try {
      const res = await invoke<boolean>('window_toggle_maximize');
      isMaximized.value = res;
    } catch (e) {
      console.warn('Window maximize not supported in current environment:', e);
    }
  }
}

async function handleClose() {
  if (shiftStore.isShiftActive) {
    await notifyShiftActiveAndPromptClose();
    return;
  }

  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
  } catch {
    try {
      await invoke('window_close');
    } catch (e) {
      console.warn('Window close not supported in current environment:', e);
    }
  }
}

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (shiftStore.isShiftActive) {
    e.preventDefault();
    e.returnValue = '';
  }
}

onMounted(async () => {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const win = getCurrentWindow();
    isMaximized.value = await win.isMaximized();
    win.onResized(async () => {
      isMaximized.value = await win.isMaximized();
    });

    // Cegah penutupan jendela desktop (Alt+F4 atau tombol close) jika shift belum ditutup
    unlistenClose = await win.onCloseRequested(async (event) => {
      if (shiftStore.isShiftActive) {
        event.preventDefault();
        await notifyShiftActiveAndPromptClose();
      }
    });
  } catch {
    // Not running inside native Tauri window
  }

  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  if (unlistenClose) {
    unlistenClose();
  }
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

<template>
  <div
    data-tauri-drag-region
    class="custom-app-titlebar flex items-center justify-between h-8 border-b select-none shrink-0 transition-colors z-50 text-xs"
    style="background-color: var(--surface-header); color: var(--surface-text); border-color: var(--surface-header-border);"
    @dblclick="handleToggleMaximize"
  >
    <!-- Sisi Kiri: Logo, Nama Toko & Status Sistem (Drag Area) -->
    <div data-tauri-drag-region class="flex items-center gap-2 pl-3 min-w-0 flex-1 h-full">
      <div
        class="flex items-center justify-center w-5 h-5 rounded shadow-2xs text-white"
        :style="{ backgroundColor: settingsStore.primaryColor }"
      >
        <Store :size="12" />
      </div>

      <div data-tauri-drag-region class="flex items-center gap-2 min-w-0">
        <span class="font-bold tracking-tight text-xs truncate" style="color: var(--surface-text);">
          {{ settingsStore.storeName || 'Sirka' }}
        </span>
        <span class="text-[10px] opacity-40 font-mono hidden sm:inline">|</span>
        <span class="text-[10.5px] opacity-70 hidden md:inline truncate">
          {{ settingsStore.storeTagline || 'Sistem Kasir & Distribusi Toko' }}
        </span>
      </div>
    </div>

    <!-- Area Tengah: Drag Region Bebas -->
    <div data-tauri-drag-region class="flex-1 h-full cursor-default"></div>

    <!-- Sisi Kanan: Tombol Kontrol Jendela Desktop (Minimize, Maximize, Close) -->
    <div class="flex items-center h-full shrink-0">
      <!-- Tombol Minimize -->
      <button
        type="button"
        class="titlebar-btn flex items-center justify-center w-10 h-full hover:bg-black/10 active:bg-black/20 cursor-pointer transition-colors"
        style="color: var(--surface-text);"
        title="Kecilkan Jendela (Minimize)"
        @click="handleMinimize"
      >
        <Minus :size="13" />
      </button>

      <!-- Tombol Maximize / Restore -->
      <button
        type="button"
        class="titlebar-btn flex items-center justify-center w-10 h-full hover:bg-black/10 active:bg-black/20 cursor-pointer transition-colors"
        style="color: var(--surface-text);"
        :title="isMaximized ? 'Kembalikan Ukuran Jendela' : 'Perbesar Jendela (Maximize)'"
        @click="handleToggleMaximize"
      >
        <Copy v-if="isMaximized" :size="12" class="rotate-180" />
        <Square v-else :size="11" />
      </button>

      <!-- Tombol Close (Aksen Merah saat Hover khas Desktop) -->
      <button
        type="button"
        class="titlebar-btn flex items-center justify-center w-11 h-full hover:bg-red-600 hover:text-white active:bg-red-700 cursor-pointer transition-colors"
        style="color: var(--surface-text);"
        :title="shiftStore.isShiftActive ? 'Tutup Aplikasi (Shift kasir masih aktif: tutup shift terlebih dahulu)' : 'Tutup Aplikasi'"
        @click="handleClose"
      >
        <X :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.custom-app-titlebar {
  user-select: none;
  -webkit-app-region: drag;
}

.titlebar-btn {
  -webkit-app-region: no-drag;
}
</style>
