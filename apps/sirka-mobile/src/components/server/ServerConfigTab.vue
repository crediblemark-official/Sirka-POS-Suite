<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { dbService } from '../../services/dbService';
import { syncService } from '../../services/syncService';
import { useSettingsStore } from '../../stores/settingsStore';
import type { ServerConfig } from '../../types';
import {
  Server,
  Database,
  Cloud,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Copy,
  Check,
  Globe,
  ShieldCheck,
  Info,
  Radio
} from 'lucide-vue-next';


const settingsStore = useSettingsStore();

const databaseUrl = ref('');
const workerUrl = ref('');
const workerToken = ref('');

const showDbPassword = ref(false);
const showWorkerToken = ref(false);

const isSaving = ref(false);
const isTestingDb = ref(false);
const isTestingWorker = ref(false);
const isSyncing = ref(false);

const copiedDbUrl = ref(false);
const statusSuccessMsg = ref<string | null>(null);
const statusErrorMsg = ref<string | null>(null);

const dbTestResult = ref<{ success: boolean; message: string } | null>(null);
const workerTestResult = ref<{ success: boolean; message: string } | null>(null);

async function loadConfig() {
  try {
    const config: ServerConfig = await dbService.getServerConfig();
    databaseUrl.value = config.databaseUrl || '';
    workerUrl.value = config.workerUrl || '';
    workerToken.value = config.workerToken || settingsStore.ownerApiToken || '';
  } catch (err: any) {
    console.error('Gagal memuat konfigurasi server:', err);
  }
}

async function handleTestDb() {
  if (!databaseUrl.value.trim()) {
    dbTestResult.value = {
      success: false,
      message: 'Harap isi URL Database PostgreSQL terlebih dahulu untuk menguji koneksi.'
    };
    return;
  }

  isTestingDb.value = true;
  dbTestResult.value = null;
  statusSuccessMsg.value = null;
  statusErrorMsg.value = null;

  try {
    const version = await dbService.testDatabaseConnection(databaseUrl.value.trim());
    dbTestResult.value = {
      success: true,
      message: `Terhubung ke PostgreSQL! ${version}`
    };
  } catch (err: any) {
    dbTestResult.value = {
      success: false,
      message: String(err?.message || err)
    };
  } finally {
    isTestingDb.value = false;
  }
}

async function handleTestWorker() {
  if (!workerUrl.value.trim()) {
    workerTestResult.value = {
      success: false,
      message: 'Harap isi URL Cloudflare Worker terlebih dahulu.'
    };
    return;
  }

  isTestingWorker.value = true;
  workerTestResult.value = null;

  try {
    let cleanUrl = workerUrl.value.trim().replace(/\/+$/, '');
    const healthUrl = `${cleanUrl}/health`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json() as any;
      let msg = `Worker Aktif! Layanan: ${data.service || 'Sirka Owner API'}`;
      if (data.authEnabled) {
        msg += ' (Proteksi Token S2S Aktif)';
      }
      workerTestResult.value = { success: true, message: msg };
    } else {
      workerTestResult.value = {
        success: false,
        message: `Worker merespons kode status ${res.status} (${res.statusText})`
      };
    }
  } catch (err: any) {
    workerTestResult.value = {
      success: false,
      message: `Gagal ping Worker: ${err?.message || err}. Pastikan URL dapat diakses publik.`
    };
  } finally {
    isTestingWorker.value = false;
  }
}

async function handleSaveConfig() {
  isSaving.value = true;
  statusSuccessMsg.value = null;
  statusErrorMsg.value = null;

  try {
    const cleanDb = databaseUrl.value.trim() || null;
    const cleanWorker = workerUrl.value.trim() || null;
    const cleanToken = workerToken.value.trim() || null;

    await dbService.saveServerConfig({
      databaseUrl: cleanDb,
      workerUrl: cleanWorker,
      workerToken: cleanToken
    });

    if (cleanToken) {
      settingsStore.setOwnerApiToken(cleanToken);
    }

    await syncService.refreshStatus();

    statusSuccessMsg.value = cleanDb
      ? 'Pengaturan server berhasil disimpan! Sinkronisasi background otomatis diaktifkan.'
      : 'Pengaturan disimpan! Mode Offline Murni aktif (tidak ada cloud sync).';
  } catch (err: any) {
    statusErrorMsg.value = `Gagal menyimpan konfigurasi: ${err?.message || err}`;
  } finally {
    isSaving.value = false;
  }
}

async function handleUseOfflineMode() {
  if (!confirm('Kosongkan koneksi cloud dan beralih ke Mode Offline Murni? Seluruh transaksi kasir tetap aman di SQLite lokal HP ini.')) {
    return;
  }
  databaseUrl.value = '';
  await handleSaveConfig();
}

async function handleManualSync() {
  isSyncing.value = true;
  statusSuccessMsg.value = null;
  statusErrorMsg.value = null;
  try {
    await syncService.triggerSync();
    statusSuccessMsg.value = 'Sinkronisasi berhasil! Data lokal dan cloud kini sinkron.';
  } catch (err: any) {
    statusErrorMsg.value = `Sinkronisasi gagal: ${err?.message || err}`;
  } finally {
    isSyncing.value = false;
  }
}

function copyDbUrl() {
  if (!databaseUrl.value) return;
  navigator.clipboard.writeText(databaseUrl.value);
  copiedDbUrl.value = true;
  setTimeout(() => (copiedDbUrl.value = false), 2000);
}

function applySampleUrl(type: 'supabase' | 'neon' | 'local') {
  if (type === 'supabase') {
    databaseUrl.value = 'postgresql://postgres.PROJECT_ID:PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require';
  } else if (type === 'neon') {
    databaseUrl.value = 'postgresql://USER:PASSWORD@ep-sample-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  } else {
    databaseUrl.value = 'postgresql://postgres:password@192.168.1.100:5432/sirka_pos_db?sslmode=disable';
  }
}

onMounted(() => {
  loadConfig();
  syncService.refreshStatus();
});
</script>

<template>
  <div class="h-full flex flex-col bg-slate-100 overflow-hidden select-none text-slate-800">
    <!-- Top Stats Banner -->
    <div class="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
      <div class="flex items-center gap-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs"
          :style="{ backgroundColor: settingsStore.primaryColor }"
        >
          <Server :size="18" />
        </div>
        <div>
          <h2 class="text-sm font-bold text-slate-900 leading-tight">Pengaturan Server</h2>
          <p class="text-[11px] text-slate-500 mt-0.5">Database PostgreSQL Cloud & Worker API</p>
        </div>
      </div>

      <!-- Quick Status Badges -->
      <div class="flex items-center gap-2 flex-wrap">
        <div class="px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-1.5 text-[10.5px]">
          <HardDrive :size="12" class="text-emerald-600" />
          <span class="font-bold text-emerald-700">SQLite (0ms)</span>
        </div>

        <div
          class="px-2 py-0.5 rounded-lg border flex items-center gap-1.5 text-[10.5px]"
          :class="syncService.isOnline.value ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-100 border-slate-300 text-slate-600'"
        >
          <Cloud :size="12" :class="syncService.isOnline.value ? 'text-emerald-600' : 'text-slate-400'" />
          <span class="font-bold">
            {{ syncService.isOnline.value ? 'Online' : (databaseUrl ? 'Offline' : 'Lokal') }}
          </span>
        </div>
      </div>
    </div>

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4 max-w-xl mx-auto w-full pb-20">
      <!-- Alerts -->
      <div v-if="statusSuccessMsg" class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-start gap-2.5 text-xs">
        <CheckCircle2 :size="16" class="text-emerald-600 shrink-0 mt-0.5" />
        <div class="font-medium leading-relaxed">{{ statusSuccessMsg }}</div>
      </div>

      <div v-if="statusErrorMsg" class="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 flex items-start gap-2.5 text-xs">
        <AlertTriangle :size="16" class="text-rose-600 shrink-0 mt-0.5" />
        <div class="font-medium leading-relaxed">{{ statusErrorMsg }}</div>
      </div>

      <!-- Card 1: Penjelasan Ringkas -->
      <div class="p-4 rounded-xl border border-blue-200 bg-blue-50/70 text-slate-800 space-y-2">
        <div class="flex items-center gap-2 text-blue-900 font-bold text-xs">
          <ShieldCheck :size="15" class="text-blue-700 shrink-0" />
          <span>Sistem Lisensi Sekali Beli (Offline-First)</span>
        </div>
        <p class="text-[11px] leading-relaxed text-slate-700">
          Sirka Mobile beroperasi langsung dari database SQLite lokal di smartphone Anda.
          Untuk sinkronisasi otomatis dengan aplikasi Kasir Desktop, masukkan URL database PostgreSQL milik Anda sendiri.
        </p>
      </div>

      <!-- Card 2: Konfigurasi PostgreSQL Cloud -->
      <div class="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3.5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Database :size="15" />
            </div>
            <div>
              <h3 class="font-bold text-xs text-slate-900">Database Cloud (PostgreSQL)</h3>
              <p class="text-[10px] text-slate-500">Sinkronisasi Desktop Kasir & Android</p>
            </div>
          </div>
          <button
            type="button"
            class="px-2 py-0.5 text-[10px] rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer"
            @click="handleUseOfflineMode"
          >
            Mode Offline
          </button>
        </div>

        <div class="space-y-2.5 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1 text-[11px]">
              URL PostgreSQL (DATABASE_URL)
            </label>
            <div class="relative flex items-center">
              <input
                v-model="databaseUrl"
                :type="showDbPassword ? 'text' : 'password'"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 pr-16 text-xs font-mono text-slate-800 outline-none focus:border-indigo-600 focus:bg-white"
                placeholder="postgresql://user:pass@host:port/db?sslmode=require"
              />
              <div class="absolute right-1.5 flex items-center gap-1 text-slate-500">
                <button
                  type="button"
                  class="p-1 hover:text-slate-800 rounded cursor-pointer"
                  @click="showDbPassword = !showDbPassword"
                >
                  <EyeOff v-if="showDbPassword" :size="13" />
                  <Eye v-else :size="13" />
                </button>
                <button
                  type="button"
                  class="p-1 hover:text-slate-800 rounded cursor-pointer"
                  @click="copyDbUrl"
                >
                  <Check v-if="copiedDbUrl" :size="13" class="text-emerald-600" />
                  <Copy v-else :size="13" />
                </button>
              </div>
            </div>
          </div>

          <!-- Format Cepat -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] font-semibold text-slate-500 uppercase">Preset:</span>
            <button
              type="button"
              class="px-2 py-0.5 rounded text-[10px] border border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer"
              @click="applySampleUrl('supabase')"
            >
              Supabase
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded text-[10px] border border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer"
              @click="applySampleUrl('neon')"
            >
              Neon
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded text-[10px] border border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer"
              @click="applySampleUrl('local')"
            >
              LAN
            </button>
          </div>

          <!-- Test Result Box -->
          <div
            v-if="dbTestResult"
            class="p-3 rounded-xl border text-[11px] flex items-start gap-2"
            :class="dbTestResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'"
          >
            <CheckCircle2 v-if="dbTestResult.success" :size="15" class="text-emerald-600 shrink-0 mt-0.5" />
            <AlertTriangle v-else :size="15" class="text-rose-600 shrink-0 mt-0.5" />
            <div class="font-medium break-all">{{ dbTestResult.message }}</div>
          </div>

          <div class="pt-1">
            <button
              type="button"
              class="w-full py-2 rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100 cursor-pointer flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
              :disabled="isTestingDb || !databaseUrl.trim()"
              @click="handleTestDb"
            >
              <RefreshCw :size="13" :class="{ 'animate-spin': isTestingDb }" />
              <span>{{ isTestingDb ? 'Menguji Koneksi...' : 'Uji Koneksi Database' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Card 3: Cloudflare Worker API -->
      <div class="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-3.5">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-orange-50 text-orange-700 flex items-center justify-center">
              <Globe :size="15" />
            </div>
            <div>
              <h3 class="font-bold text-xs text-slate-900">Cloudflare Worker API</h3>
              <p class="text-[10px] text-slate-500">Opsional untuk dashboard web / REST</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
            Opsional
          </span>
        </div>

        <div class="space-y-2.5 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1 text-[11px]">
              URL Cloudflare Worker
            </label>
            <input
              v-model="workerUrl"
              type="text"
              class="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-mono text-slate-800 outline-none focus:border-orange-500 focus:bg-white"
              placeholder="https://sirka-owner-api.domain.workers.dev"
            />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1 text-[11px]">
              Token Akses Worker (OWNER_SECRET_KEY)
            </label>
            <div class="relative flex items-center">
              <input
                v-model="workerToken"
                :type="showWorkerToken ? 'text' : 'password'"
                class="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 pr-10 text-xs font-mono text-slate-800 outline-none focus:border-orange-500 focus:bg-white"
                placeholder="Token rahasia Worker"
              />
              <button
                type="button"
                class="absolute right-2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                @click="showWorkerToken = !showWorkerToken"
              >
                <EyeOff v-if="showWorkerToken" :size="13" />
                <Eye v-else :size="13" />
              </button>
            </div>
          </div>

          <!-- Worker Test Result -->
          <div
            v-if="workerTestResult"
            class="p-3 rounded-xl border text-[11px] flex items-start gap-2"
            :class="workerTestResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'"
          >
            <CheckCircle2 v-if="workerTestResult.success" :size="15" class="text-emerald-600 shrink-0 mt-0.5" />
            <AlertTriangle v-else :size="15" class="text-rose-600 shrink-0 mt-0.5" />
            <div class="font-medium break-all">{{ workerTestResult.message }}</div>
          </div>

          <div class="pt-1">
            <button
              type="button"
              class="w-full py-1.5 rounded-xl border border-orange-300 bg-orange-50 text-orange-800 font-bold hover:bg-orange-100 cursor-pointer flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
              :disabled="isTestingWorker || !workerUrl.trim()"
              @click="handleTestWorker"
            >
              <RefreshCw :size="13" :class="{ 'animate-spin': isTestingWorker }" />
              <span>{{ isTestingWorker ? 'Menguji...' : 'Uji Ping Worker' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="space-y-2 pt-2">
        <button
          type="button"
          class="w-full py-3 rounded-xl text-white font-bold text-xs shadow-sm hover:brightness-110 active:scale-[0.99] cursor-pointer transition-all flex items-center justify-center gap-2"
          :style="{ backgroundColor: settingsStore.primaryColor }"
          :disabled="isSaving"
          @click="handleSaveConfig"
        >
          <Check :size="16" />
          <span>{{ isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Server' }}</span>
        </button>

        <button
          v-if="databaseUrl.trim()"
          type="button"
          class="w-full py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
          :disabled="isSyncing || syncService.isSyncing.value"
          @click="handleManualSync"
        >
          <RefreshCw :size="13" :class="{ 'animate-spin': isSyncing || syncService.isSyncing.value }" />
          <span>Sinkronkan Sekarang</span>
        </button>
      </div>
    </div>
  </div>
</template>
