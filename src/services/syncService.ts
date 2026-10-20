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
const isOnline = ref<boolean>(false);
const pendingCount = ref<number>(0);
const isSyncing = ref<boolean>(false);
const lastSyncAt = ref<Date | null>(null);
const lastError = ref<string | null>(null);

let pollTimer: any = null;

async function refreshStatus(): Promise<void> {
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

async function triggerSync(): Promise<void> {
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

async function resetCache(): Promise<void> {
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

function startPolling(intervalMs = 4000) {
  if (pollTimer) return;
  refreshStatus();

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      refreshStatus();
      triggerSync();
    });
    window.addEventListener('focus', () => {
      refreshStatus();
    });
  }

  pollTimer = setInterval(() => {
    refreshStatus();
  }, intervalMs);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

if (typeof window !== 'undefined') {
  startPolling();
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
  // Helper for compatibility if store calls enqueue
  enqueue: (_action: string, _payload: any) => {
    // Rust SQLite automatically enqueues outbox on every command
    triggerSync().catch(() => {});
  }
};
