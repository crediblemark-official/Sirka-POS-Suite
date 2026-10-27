import { ref } from 'vue';
import { dbService } from './dbService';

export interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
  isSyncing: boolean;
}

// Reactive status for Vue components (e.g. AppTitleBar, ExplorerToolbar, etc.)
export const isOnline = ref<boolean>(false);
export const pendingCount = ref<number>(0);
export const isSyncing = ref<boolean>(false);
export const lastSyncAt = ref<Date | null>(null);
export const lastError = ref<string | null>(null);

let pollTimer: any = null;
let onlineListener: (() => void) | null = null;
let focusListener: (() => void) | null = null;

export async function refreshStatus(): Promise<void> {
  try {
    const res = await dbService.getSyncStatus();
    isOnline.value = res.is_online;
    pendingCount.value = res.pending_count;
    lastError.value = res.last_error;
    if (res.last_sync_time) {
      lastSyncAt.value = new Date(res.last_sync_time);
    }
  } catch (err: any) {
    // If running in browser unit test or mock
    console.debug('[SyncService] Status check:', err);
  }
}

export async function triggerSync(): Promise<void> {
  if (isSyncing.value) return;
  isSyncing.value = true;
  try {
    const res = await dbService.triggerSync();
    isOnline.value = res.is_online;
    pendingCount.value = res.pending_count;
    lastError.value = res.last_error;
    if (res.last_sync_time) {
      lastSyncAt.value = new Date(res.last_sync_time);
    }
  } catch (err: any) {
    lastError.value = String(err?.message || err);
    console.warn('[SyncService] Manual sync error:', err);
  } finally {
    isSyncing.value = false;
  }
}

export async function resetCache(): Promise<void> {
  if (isSyncing.value) return;
  isSyncing.value = true;
  try {
    const res = await dbService.resetCache();
    isOnline.value = res.is_online;
    pendingCount.value = res.pending_count;
    lastError.value = res.last_error;
    if (res.last_sync_time) {
      lastSyncAt.value = new Date(res.last_sync_time);
    }
  } catch (err: any) {
    lastError.value = String(err?.message || err);
    throw err;
  } finally {
    isSyncing.value = false;
  }
}

export function startPolling(intervalMs = 4000) {
  if (pollTimer) return;
  refreshStatus();

  // BUG FIX: listener dulu dibuat anonymous sehingga tidak bisa dilepas ->
  // setiap startPolling() menambah pasangan listener baru (sync jadi ganda).
  if (typeof window !== 'undefined') {
    if (!onlineListener) {
      onlineListener = () => {
        refreshStatus();
        triggerSync();
      };
      window.addEventListener('online', onlineListener);
    }
    if (!focusListener) {
      focusListener = () => {
        refreshStatus();
      };
      window.addEventListener('focus', focusListener);
    }
  }

  pollTimer = setInterval(() => {
    refreshStatus();
  }, intervalMs);
}

export function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  // BUG FIX: lepas juga listener online/focus agar tidak menumpuk
  if (typeof window !== 'undefined') {
    if (onlineListener) {
      window.removeEventListener('online', onlineListener);
      onlineListener = null;
    }
    if (focusListener) {
      window.removeEventListener('focus', focusListener);
      focusListener = null;
    }
  }
}

if (typeof window !== 'undefined') {
  startPolling();
}

/**
 * BUG FIX: `enqueue()` sebelumnya membuang kedua argumennya sehingga seluruh
 * fallback offline pada store (transaksi, pembeli, pre-order, kulakan, produk)
 * TIDAK pernah mengantre data — data hilang begitu aplikasi direstart.
 * Sekarang payload benar-benar ditulis ke tabel `sync_outbox` (SQLite) dan
 * akan dikirim ke cloud saat koneksi tersedia.
 */
export function enqueue(action: string, payload: any) {
  dbService
    .enqueueOutbox(action, payload ?? {})
    .then(() => {
      refreshStatus();
      triggerSync().catch(() => {});
    })
    .catch((err: any) => {
      console.warn(`[SyncService] Gagal mengantre "${action}" ke outbox:`, err);
    });
}

export const syncService = {
  isOnline,
  pendingCount,
  isSyncing,
  lastSyncAt,
  lastError,
  refreshStatus,
  triggerSync,
  resetCache,
  startPolling,
  stopPolling,
  enqueue,
};
