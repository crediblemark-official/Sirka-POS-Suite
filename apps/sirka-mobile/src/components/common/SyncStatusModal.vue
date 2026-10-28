<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { useDiscountStore } from '../../stores/discountStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { syncService } from '../../services/syncService';
import { demoDataService } from '../../services/demoDataService';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

import {
  Database,
  Cloud,
  HardDrive,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  X,
  Server
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'open-server'): void;
}>();


const settingsStore = useSettingsStore();
const inventoryStore = useInventoryStore();
const buyerStore = useBuyerStore();
const ledgerStore = useLedgerStore();
const discountStore = useDiscountStore();
const preOrderStore = usePreOrderStore();
const purchaseStore = usePurchaseStore();

const confirmClearOpen = ref(false);
const isClearingCache = ref(false);
const isLoadingDemo = ref(false);
const isResettingDemo = ref(false);
const confirmResetOpen = ref(false);
const wipeCloudOption = ref(true);

const cacheSuccessMsg = ref<string | null>(null);
const cacheErrorMsg = ref<string | null>(null);

async function handleManualSync() {
  cacheSuccessMsg.value = null;
  cacheErrorMsg.value = null;
  try {
    await syncService.triggerSync();
  } catch (e: any) {
    cacheErrorMsg.value = String(e?.message || e);
  }
}

async function handleClearCacheAndResync() {
  isClearingCache.value = true;
  cacheSuccessMsg.value = null;
  cacheErrorMsg.value = null;
  try {
    await syncService.resetCache();
    await Promise.allSettled([
      inventoryStore.fetchFromDb(),
      buyerStore.fetchBuyers(),
      ledgerStore.fetchTransactionsFromDb(),
      discountStore.fetchDiscounts(),
      purchaseStore.fetchPurchases(),
      preOrderStore.fetchPreOrdersFromDb(),
      settingsStore.fetchSettings()
    ]);
    cacheSuccessMsg.value = 'Database lokal berhasil dikosongkan dan ditarik ulang dari Server Cloud!';
    confirmClearOpen.value = false;
  } catch (err: any) {
    cacheErrorMsg.value = String(err?.message || err);
  } finally {
    isClearingCache.value = false;
  }
}

async function handleLoadDemoData() {
  isLoadingDemo.value = true;
  cacheSuccessMsg.value = null;
  cacheErrorMsg.value = null;
  try {
    await demoDataService.loadDemoData();
    cacheSuccessMsg.value = 'Data demo berhasil dimuat ke database lokal & cloud!';
  } catch (e: any) {
    cacheErrorMsg.value = `Gagal memuat demo: ${e?.message || e}`;
  } finally {
    isLoadingDemo.value = false;
  }
}

async function handleResetDemoData() {
  isResettingDemo.value = true;
  cacheSuccessMsg.value = null;
  cacheErrorMsg.value = null;
  try {
    await demoDataService.resetAllDataToFresh(wipeCloudOption.value);
    await syncService.refreshStatus();
    confirmResetOpen.value = false;
    cacheSuccessMsg.value = wipeCloudOption.value
      ? 'Seluruh data (Lokal & Cloud) berhasil dikosongkan! Kondisi fresh install.'
      : 'Data lokal berhasil dikosongkan!';
  } catch (e: any) {
    cacheErrorMsg.value = `Gagal mereset: ${e?.message || e}`;
  } finally {
    isResettingDemo.value = false;
  }
}

function handleReloadApp() {
  window.location.reload();
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('close');
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeydown);
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => props.isOpen);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-999 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none text-xs animate-in fade-in duration-150"
      style="-webkit-app-region: no-drag;"
      @click.self="emit('close')"
    >
      <div
        class="w-full sm:max-w-md max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col text-slate-900 animate-in slide-in-from-bottom duration-200 sm:zoom-in-95"
      >
        <!-- Mobile Pull Indicator -->
        <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0"></div>

        <!-- Header Modal -->
        <div class="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs"
              :style="{ backgroundColor: settingsStore.primaryColor }"
            >
              <Database :size="16" />
            </div>
            <div>
              <h3 class="font-bold text-sm text-slate-900 leading-tight">Status Database & Cache</h3>
              <p class="text-[11px] text-slate-500 mt-0.5">Sinkronisasi Server Cloud & Database Lokal</p>
            </div>
          </div>
          <button
            type="button"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Body Modal -->
        <div class="p-5 space-y-4 text-xs bg-white overflow-y-auto flex-1">
          <!-- Status Card Grid -->
          <div class="grid grid-cols-2 gap-3">
            <!-- Cloud Status -->
            <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[10.5px] uppercase font-bold tracking-wider text-slate-600">Database Cloud</span>
                <Cloud :size="14" class="text-slate-500" />
              </div>
              <div class="flex items-center gap-2 mt-0.5">
                <span
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  :class="syncService.isOnline.value ? 'bg-emerald-500 shadow-xs' : 'bg-red-500'"
                ></span>
                <span
                  class="font-bold text-xs"
                  :class="syncService.isOnline.value ? 'text-emerald-700' : 'text-red-600'"
                >
                  {{ syncService.isOnline.value ? 'Terhubung (Online)' : 'Terputus (Offline)' }}
                </span>
              </div>
            </div>

            <!-- Local SQLite Status -->
            <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[10.5px] uppercase font-bold tracking-wider text-slate-600">Database Lokal</span>
                <HardDrive :size="14" class="text-slate-500" />
              </div>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-xs"></span>
                <span class="font-bold text-xs text-slate-800">
                  Penyimpanan Aktif
                </span>
              </div>
            </div>
          </div>

          <!-- Detail Metrics -->
          <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-slate-600 font-medium">Antrean Sinkronisasi (Outbox):</span>
              <span
                class="font-mono font-bold px-2.5 py-0.5 rounded text-[11px] border"
                :class="syncService.pendingCount.value > 0 ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'"
              >
                {{ syncService.pendingCount.value }} data tertunda
              </span>
            </div>
            <div class="flex items-center justify-between border-t border-slate-200 pt-2.5">
              <span class="text-slate-600 font-medium">Terakhir Sinkron:</span>
              <span class="font-mono font-bold text-slate-800">
                {{ syncService.lastSyncAt.value ? syncService.lastSyncAt.value.toLocaleTimeString('id-ID') : 'Belum pernah' }}
              </span>
            </div>
          </div>

          <!-- Feedback Alerts -->
          <div v-if="cacheSuccessMsg" class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-start gap-2.5">
            <CheckCircle2 :size="16" class="shrink-0 mt-0.5 text-emerald-600" />
            <span class="text-xs font-medium">{{ cacheSuccessMsg }}</span>
          </div>

          <div v-if="cacheErrorMsg || syncService.lastError.value" class="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-800 flex items-start gap-2.5">
            <AlertTriangle :size="16" class="shrink-0 mt-0.5 text-red-600" />
            <span class="text-xs font-medium">{{ cacheErrorMsg || syncService.lastError.value }}</span>
          </div>

          <!-- Action 1: Force Sync Button -->
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs text-white shadow-sm cursor-pointer transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            :style="{ backgroundColor: settingsStore.primaryColor }"
            :disabled="syncService.isSyncing.value || isClearingCache || isLoadingDemo || isResettingDemo"
            @click="handleManualSync"
          >
            <RefreshCw :size="14" :class="{ 'animate-spin': syncService.isSyncing.value }" />
            <span>{{ syncService.isSyncing.value ? 'Sedang Menyinkronkan...' : 'Sinkronkan Sekarang (Push & Pull)' }}</span>
          </button>

          <!-- Action: Buka Pengaturan Server -->
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 cursor-pointer transition-all shadow-2xs"
            @click="emit('open-server'); emit('close');"
          >
            <Server :size="14" />
            <span>Buka Menu Pengaturan Server & Database</span>
          </button>

          <!-- Action 2: Hapus Cache Section -->

          <div class="border-t border-slate-200 pt-3.5 space-y-2.5">
            <div>
              <h4 class="font-bold text-slate-900 text-xs">Pembersihan Cache Lokal</h4>
              <p class="text-[11px] text-slate-500 mt-0.5">Kosongkan database lokal & unduh ulang master data dari Cloud</p>
            </div>

            <!-- Box Konfirmasi jika tombol ditekan -->
            <div v-if="confirmClearOpen" class="p-4 rounded-xl border border-rose-300 bg-rose-50 text-rose-900 space-y-3">
              <div class="flex items-start gap-2.5 text-xs">
                <AlertTriangle :size="18" class="shrink-0 text-rose-600 mt-0.5" />
                <div>
                  <span class="font-bold block text-rose-900">Konfirmasi Hapus Cache:</span>
                  <span class="text-[11px] leading-relaxed block text-rose-800 mt-0.5">
                    Seluruh data lokal di komputer ini akan dikosongkan, lalu ditarik ulang secara segar dari Server Cloud.
                  </span>
                  <span v-if="syncService.pendingCount.value > 0" class="block font-bold text-rose-700 text-[11px] mt-1.5 p-2 rounded bg-rose-100 border border-rose-200">
                    ⚠️ PERINGATAN: Ada {{ syncService.pendingCount.value }} data kasir offline yang belum terkirim ke Cloud! Sinkronkan dulu sebelum menghapus cache.
                  </span>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-1 border-t border-rose-200">
                <button
                  type="button"
                  class="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer shadow-2xs"
                  :disabled="isClearingCache"
                  @click="confirmClearOpen = false"
                >
                  Batal
                </button>
                <button
                  type="button"
                  class="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  :disabled="isClearingCache"
                  @click="handleClearCacheAndResync"
                >
                  <RefreshCw v-if="isClearingCache" :size="13" class="animate-spin" />
                  <Trash2 v-else :size="13" />
                  <span>{{ isClearingCache ? 'Membersihkan...' : 'Ya, Bersihkan Sekarang' }}</span>
                </button>
              </div>
            </div>

            <div v-else class="flex items-center gap-2">
              <button
                type="button"
                class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100/80 active:bg-rose-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                :disabled="isClearingCache || syncService.isSyncing.value || isLoadingDemo || isResettingDemo"
                @click="confirmClearOpen = true"
              >
                <Trash2 :size="14" class="text-rose-600" />
                <span>Hapus Cache & Tarik Ulang Data</span>
              </button>

              <button
                type="button"
                class="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                title="Muat ulang antarmuka aplikasi"
                @click="handleReloadApp"
              >
                <RotateCcw :size="14" class="text-slate-600" />
                <span>Reload UI</span>
              </button>
            </div>
          </div>

          <!-- Action 3: Demo Data & Reset Fresh Management -->
          <div class="border-t border-slate-200 pt-3.5 space-y-2.5">
            <div>
              <h4 class="font-bold text-slate-900 text-xs">Data Demo & Reset Fresh</h4>
              <p class="text-[11px] text-slate-500 mt-0.5">Muat data percontohan untuk demonstrasi atau kembali ke kondisi kosong (fresh install)</p>
            </div>

            <!-- Box Konfirmasi Reset Demo jika tombol ditekan -->
            <div v-if="confirmResetOpen" class="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 space-y-3">
              <div class="flex items-start gap-2.5 text-xs">
                <AlertTriangle :size="18" class="shrink-0 text-amber-600 mt-0.5" />
                <div class="space-y-1">
                  <span class="font-bold block text-amber-900">Konfirmasi Reset ke Kosong (Fresh):</span>
                  <span class="text-[11px] leading-relaxed block text-amber-800">
                    Tindakan ini akan mengosongkan seluruh master barang, pembeli, pre-order, diskon, dan transaksi kasir.
                  </span>
                  
                  <label class="flex items-center gap-2 pt-1 cursor-pointer select-none">
                    <input
                      v-model="wipeCloudOption"
                      type="checkbox"
                      class="rounded border-amber-400 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span class="text-[11px] font-semibold text-amber-900">
                      Kosongkan juga data di Server Cloud
                    </span>
                  </label>
                </div>
              </div>

              <div class="flex items-center justify-end gap-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  class="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer shadow-2xs"
                  :disabled="isResettingDemo"
                  @click="confirmResetOpen = false"
                >
                  Batal
                </button>
                <button
                  type="button"
                  class="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  :disabled="isResettingDemo"
                  @click="handleResetDemoData"
                >
                  <RefreshCw v-if="isResettingDemo" :size="13" class="animate-spin" />
                  <RotateCcw v-else :size="13" />
                  <span>{{ isResettingDemo ? 'Mereset...' : 'Ya, Kosongkan Semuanya' }}</span>
                </button>
              </div>
            </div>

            <!-- Tombol Muat Demo & Reset Demo -->
            <div v-else class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                :disabled="isLoadingDemo || isResettingDemo || isClearingCache || syncService.isSyncing.value"
                @click="handleLoadDemoData"
              >
                <Sparkles :size="14" :class="{ 'animate-spin': isLoadingDemo }" class="text-indigo-600" />
                <span>{{ isLoadingDemo ? 'Memuat Demo...' : 'Muat Data Demo' }}</span>
              </button>

              <button
                type="button"
                class="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 active:bg-slate-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                :disabled="isLoadingDemo || isResettingDemo || isClearingCache || syncService.isSyncing.value"
                @click="confirmResetOpen = true"
              >
                <RotateCcw :size="14" class="text-slate-600" />
                <span>Reset ke Kosong</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
