export interface ServerConfig {
  databaseUrl: string | null;
  workerUrl: string | null;
  workerToken: string | null;
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
}
