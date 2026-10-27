export interface SyncStatus {
    isOnline: boolean;
    pendingCount: number;
    lastSyncAt: Date | null;
    lastError: string | null;
    isSyncing: boolean;
}
export declare const isOnline: import("vue").Ref<boolean, boolean>;
export declare const pendingCount: import("vue").Ref<number, number>;
export declare const isSyncing: import("vue").Ref<boolean, boolean>;
export declare const lastSyncAt: import("vue").Ref<Date | null, Date | null>;
export declare const lastError: import("vue").Ref<string | null, string | null>;
export declare function refreshStatus(): Promise<void>;
export declare function triggerSync(): Promise<void>;
export declare function resetCache(): Promise<void>;
export declare function startPolling(intervalMs?: number): void;
export declare function stopPolling(): void;
/**
 * BUG FIX: `enqueue()` sebelumnya membuang kedua argumennya sehingga seluruh
 * fallback offline pada store (transaksi, pembeli, pre-order, kulakan, produk)
 * TIDAK pernah mengantre data — data hilang begitu aplikasi direstart.
 * Sekarang payload benar-benar ditulis ke tabel `sync_outbox` (SQLite) dan
 * akan dikirim ke cloud saat koneksi tersedia.
 */
export declare function enqueue(action: string, payload: any): void;
export declare const syncService: {
    isOnline: import("vue").Ref<boolean, boolean>;
    pendingCount: import("vue").Ref<number, number>;
    isSyncing: import("vue").Ref<boolean, boolean>;
    lastSyncAt: import("vue").Ref<Date | null, Date | null>;
    lastError: import("vue").Ref<string | null, string | null>;
    refreshStatus: typeof refreshStatus;
    triggerSync: typeof triggerSync;
    resetCache: typeof resetCache;
    startPolling: typeof startPolling;
    stopPolling: typeof stopPolling;
    enqueue: typeof enqueue;
};
//# sourceMappingURL=syncService.d.ts.map