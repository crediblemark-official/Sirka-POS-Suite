<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useLicenseStore } from '../../stores/licenseStore';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  X,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Laptop,
  Cpu,
  Clock,
  Settings,
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next';

import { useConfirmDialog } from '../../composables/useConfirmDialog';

const licenseStore = useLicenseStore();
const confirmDialog = useConfirmDialog();

const inputKey = ref('');
const inputDeviceName = ref(licenseStore.deviceName || '');
const showRawKey = ref(false);
const copiedKey = ref(false);
const copiedHwid = ref(false);
const isDev = import.meta.env.DEV;
const showAdvancedConfig = ref(false);

// Advanced API config state
const configAppId = ref(licenseStore.apiConfig.appId);
const configApiKey = ref(licenseStore.apiConfig.apiKey);
const configBaseUrl = ref(licenseStore.apiConfig.baseUrl);
const configSavedMsg = ref(false);

const activeTab = ref<'status' | 'activate'>('status');

// Jika belum berlisensi, buka tab aktivasi secara default
if (!licenseStore.isLicensed) {
  activeTab.value = 'activate';
}

function handleCopyKey() {
  if (!licenseStore.licenseKey) return;
  navigator.clipboard.writeText(licenseStore.licenseKey);
  copiedKey.value = true;
  setTimeout(() => { copiedKey.value = false; }, 2000);
}

function handleCopyHwid() {
  if (!licenseStore.hwid) return;
  navigator.clipboard.writeText(licenseStore.hwid);
  copiedHwid.value = true;
  setTimeout(() => { copiedHwid.value = false; }, 2000);
}

async function handleActivate() {
  if (!inputKey.value.trim()) return;
  const res = await licenseStore.activate(inputKey.value, inputDeviceName.value);
  if (res.success) {
    activeTab.value = 'status';
    inputKey.value = '';
  }
}

async function handleCheckNow() {
  await licenseStore.checkLicense(true);
}

async function handleDeactivate() {
  const confirmed = await confirmDialog.confirm({
    title: 'Lepas Lisensi Perangkat',
    message: 'Lepas lisensi dari perangkat ini?',
    details: 'Setelah lisensi dilepas, perangkat ini tidak dapat menggunakan fitur kasir hingga diaktivasi kembali.',
    confirmText: 'Lepas Lisensi',
    cancelText: 'Batal',
    type: 'danger'
  });
  if (confirmed) {
    const res = await licenseStore.deactivate();
    if (res.success) {
      activeTab.value = 'activate';
    }
  }
}

function handleSaveConfig() {
  licenseStore.updateApiConfig({
    appId: configAppId.value,
    apiKey: configApiKey.value,
    baseUrl: configBaseUrl.value
  });
  configSavedMsg.value = true;
  setTimeout(() => { configSavedMsg.value = false; }, 3000);
}

const formattedExpiry = computed(() => {
  if (!licenseStore.expiresAt) return 'Permanen';
  try {
    const d = new Date(licenseStore.expiresAt);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return licenseStore.expiresAt;
  }
});

function handleKeydown(e: KeyboardEvent) {
  if (!licenseStore.showModal) return;
  if (confirmDialog.isOpen.value) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    licenseStore.closeLicenseModal();
  }
}

watch(
  () => licenseStore.showModal,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeydown, true);
    } else {
      window.removeEventListener('keydown', handleKeydown, true);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown, true);
});
</script>

<template>
  <div
    v-if="licenseStore.showModal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
    tabindex="-1"
    @click.self="licenseStore.closeLicenseModal"
    @keydown.esc="licenseStore.closeLicenseModal"
  >
    <div
      class="bg-white border border-gray-300 rounded-lg shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden text-gray-900 font-sans animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header (Native Explorer Theme) -->
      <div
        class="px-5 py-3.5 flex items-center justify-between border-b border-gray-200 select-none shrink-0"
        style="background-color: var(--surface-ribbon, #f6f5f2);"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="p-1.5 rounded-md text-white shadow-2xs"
            :class="licenseStore.isLicensed ? 'bg-emerald-600' : 'bg-blue-600'"
          >
            <ShieldCheck v-if="licenseStore.isLicensed" :size="18" />
            <KeyRound v-else :size="18" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-gray-800 leading-tight">Lisensi Aplikasi</h2>
            <p class="text-[11px] text-gray-400">Pengaturan lisensi perangkat</p>
          </div>
        </div>

        <button
          type="button"
          class="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 cursor-pointer transition-colors"
          title="Tutup"
          @click="licenseStore.closeLicenseModal"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Tab Navigation -->
      <div class="flex border-b border-gray-200 bg-gray-50 px-5 shrink-0 text-xs">
        <button
          type="button"
          class="px-4 py-2.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 -mb-px"
          :class="activeTab === 'status' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-600 hover:text-gray-900'"
          @click="activeTab = 'status'"
        >
          <Shield :size="14" />
          <span>Status</span>
          <span
            v-if="licenseStore.isLicensed"
            class="w-2 h-2 rounded-full bg-emerald-500"
          ></span>
        </button>

        <button
          type="button"
          class="px-4 py-2.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 -mb-px"
          :class="activeTab === 'activate' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-600 hover:text-gray-900'"
          @click="activeTab = 'activate'"
        >
          <KeyRound :size="14" />
          <span>{{ licenseStore.isLicensed ? 'Ganti' : 'Aktivasi' }}</span>
        </button>
      </div>

      <!-- Content Area (Scrollable) -->
      <div class="p-5 overflow-y-auto space-y-4 flex-1 bg-white">
        <!-- Error & Success Banners (Garis Aksen, Bukan Box Card) -->
        <div
          v-if="licenseStore.errorMessage"
          class="py-2 px-3 bg-rose-50/70 border-l-3 border-rose-500 text-xs text-rose-800 flex items-center gap-2"
        >
          <ShieldAlert :size="15" class="shrink-0 text-rose-600" />
          <div class="flex-1 font-medium">
            {{ licenseStore.errorMessage }}
          </div>
        </div>

        <div
          v-if="licenseStore.successMessage"
          class="py-2 px-3 bg-emerald-50/70 border-l-3 border-emerald-500 text-xs text-emerald-800 flex items-center gap-2"
        >
          <ShieldCheck :size="15" class="shrink-0 text-emerald-600" />
          <div class="flex-1 font-medium">
            {{ licenseStore.successMessage }}
          </div>
        </div>

        <!-- TAB 1: STATUS LISENSI -->
        <template v-if="activeTab === 'status'">
          <!-- Status Ringkas (Garis Pemisah, Bukan Box Card) -->
          <div class="pb-3.5 border-b border-gray-200 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                :class="licenseStore.isLicensed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
              >
                <ShieldCheck v-if="licenseStore.isLicensed" :size="18" />
                <KeyRound v-else :size="18" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-gray-900">
                    <template v-if="licenseStore.isLicensed">Aplikasi Berlisensi</template>
                    <template v-else-if="licenseStore.status === 'EXPIRED'">Masa Berlaku Berakhir</template>
                    <template v-else-if="licenseStore.status === 'REVOKED'">Lisensi Dicabut</template>
                    <template v-else>Belum Diaktivasi</template>
                  </span>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border"
                    :class="licenseStore.statusBadgeClass"
                  >
                    {{ licenseStore.statusLabel }}
                  </span>
                </div>
                <p class="text-xs text-gray-500 mt-0.5">
                  <template v-if="licenseStore.isLicensed">Siap digunakan.</template>
                  <template v-else>Aktivasi untuk membuka fitur.</template>
                </p>
              </div>
            </div>

            <div v-if="licenseStore.daysRemaining !== null" class="text-right shrink-0">
              <div class="text-sm font-bold font-mono text-emerald-700">
                {{ licenseStore.daysRemaining }} <span class="text-xs font-sans font-normal text-gray-500">hari</span>
              </div>
              <div class="text-[10px] text-gray-400 uppercase">Tersisa</div>
            </div>
          </div>

          <!-- Metadata List (Garis Pemisah, Bukan Box Card) -->
          <div class="divide-y divide-gray-200 text-xs">
            <!-- Kode Lisensi -->
            <div class="py-2.5 flex items-center justify-between gap-4">
              <span class="text-gray-500 font-medium shrink-0 flex items-center gap-1.5">
                <KeyRound :size="13" class="text-gray-400" />
                Kode Lisensi
              </span>
              <div class="flex items-center gap-2 font-mono text-gray-800">
                <span class="font-bold tracking-wider">
                  {{ showRawKey ? (licenseStore.licenseKey || '-') : licenseStore.maskedLicenseKey }}
                </span>
                <button
                  v-if="licenseStore.licenseKey"
                  type="button"
                  class="text-[11px] text-blue-600 hover:underline cursor-pointer ml-1"
                  @click="showRawKey = !showRawKey"
                >
                  {{ showRawKey ? 'Tutup' : 'Buka' }}
                </button>
                <button
                  v-if="licenseStore.licenseKey"
                  type="button"
                  class="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                  title="Salin"
                  @click="handleCopyKey"
                >
                  <Check v-if="copiedKey" :size="13" class="text-emerald-600" />
                  <Copy v-else :size="13" />
                </button>
              </div>
            </div>

            <!-- ID Perangkat -->
            <div class="py-2.5 flex items-center justify-between gap-4">
              <span class="text-gray-500 font-medium shrink-0 flex items-center gap-1.5">
                <Cpu :size="13" class="text-gray-400" />
                ID Perangkat
              </span>
              <div class="flex items-center gap-2 font-mono text-gray-800">
                <span class="truncate max-w-[240px]" :title="licenseStore.hwid">
                  {{ licenseStore.hwid || 'Memuat...' }}
                </span>
                <button
                  type="button"
                  class="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
                  title="Salin"
                  @click="handleCopyHwid"
                >
                  <Check v-if="copiedHwid" :size="13" class="text-emerald-600" />
                  <Copy v-else :size="13" />
                </button>
              </div>
            </div>

            <!-- Kuota Kursi / Seats -->
            <div class="py-2.5 flex items-center justify-between gap-4">
              <span class="text-gray-500 font-medium shrink-0 flex items-center gap-1.5">
                <Laptop :size="13" class="text-gray-400" />
                Kuota Perangkat
              </span>
              <div class="flex items-center gap-2.5">
                <span class="font-mono font-bold text-gray-800">
                  {{ licenseStore.seatsUsed }} / {{ licenseStore.maxSeats }}
                </span>
                <div class="w-16 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="licenseStore.seatsUsed >= licenseStore.maxSeats ? 'bg-orange-500' : 'bg-blue-600'"
                    :style="{ width: `${Math.min(100, Math.max(10, (licenseStore.seatsUsed / (licenseStore.maxSeats || 1)) * 100))}%` }"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Masa Berlaku -->
            <div class="py-2.5 flex items-center justify-between gap-4">
              <span class="text-gray-500 font-medium shrink-0 flex items-center gap-1.5">
                <Clock :size="13" class="text-gray-400" />
                Masa Berlaku
              </span>
              <div class="flex items-center gap-2">
                <span class="font-bold text-gray-800">{{ formattedExpiry }}</span>
                <span class="text-[10px] text-gray-400">({{ licenseStore.isOfflineVerification ? 'Offline' : 'Online' }})</span>
              </div>
            </div>
          </div>

          <!-- Action Buttons Bar -->
          <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-200">
            <div class="flex items-center gap-2">
              <button
                v-if="licenseStore.licenseKey"
                type="button"
                class="px-3 py-1.5 rounded-md text-xs font-semibold bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                :disabled="licenseStore.isChecking"
                @click="handleCheckNow"
              >
                <RefreshCw :size="13" :class="{ 'animate-spin': licenseStore.isChecking }" />
                <span>{{ licenseStore.isChecking ? 'Memeriksa...' : 'Periksa' }}</span>
              </button>

              <button
                v-if="licenseStore.isLicensed"
                type="button"
                class="px-3 py-1.5 rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                :disabled="licenseStore.isActivating"
                @click="handleDeactivate"
              >
                <LogOut :size="13" />
                <span>Lepas Lisensi</span>
              </button>
            </div>
          </div>
        </template>

        <!-- TAB 2: AKTIVASI / GANTI LISENSI -->
        <template v-else-if="activeTab === 'activate'">
          <div class="space-y-3">
            <!-- Input Kunci Lisensi -->
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1.5">
                Kode Lisensi
              </label>
              <div class="relative">
                <input
                  v-model="inputKey"
                  type="text"
                  placeholder="TT-XXXX-XXXX-XXXX"
                  class="w-full px-3.5 py-2 rounded-md border border-gray-300 bg-white text-sm font-mono tracking-wider text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase placeholder:text-gray-400 placeholder:normal-case shadow-2xs"
                  @keyup.enter="handleActivate"
                />
              </div>
            </div>

            <!-- Input Nama Perangkat -->
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1.5">
                Nama Perangkat
              </label>
              <input
                v-model="inputDeviceName"
                type="text"
                placeholder="Contoh: Kasir 1"
                class="w-full px-3.5 py-2 rounded-md border border-gray-300 bg-white text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 shadow-2xs"
              />
            </div>

            <!-- Tombol Aktivasi -->
            <button
              type="button"
              class="w-full py-2.5 rounded-md font-bold text-sm bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              :disabled="licenseStore.isActivating || !inputKey.trim()"
              @click="handleActivate"
            >
              <Sparkles v-if="!licenseStore.isActivating" :size="16" />
              <RefreshCw v-else :size="16" class="animate-spin" />
              <span>{{ licenseStore.isActivating ? 'Mengaktivasi...' : 'Aktivasi' }}</span>
            </button>

            <!-- Bantuan -->
            <p class="text-center text-[11px] text-gray-400 pt-1">
              Hubungi admin untuk lisensi.
            </p>
          </div>
        </template>

        <!-- ADVANCED / PENGATURAN SERVER LISENSI (Hanya untuk Developer di Mode Development) -->
        <div v-if="isDev" class="border-t border-gray-200 pt-3">
          <button
            type="button"
            class="w-full flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors py-1 cursor-pointer"
            @click="showAdvancedConfig = !showAdvancedConfig"
          >
            <span class="flex items-center gap-1.5">
              <Settings :size="13" class="text-gray-400" />
              <span>Pengaturan Server (Dev Only)</span>
            </span>
            <ChevronUp v-if="showAdvancedConfig" :size="14" />
            <ChevronDown v-else :size="14" />
          </button>

          <div v-if="showAdvancedConfig" class="mt-2.5 space-y-2.5 pt-2 text-xs border-t border-gray-100 animate-in fade-in duration-150">
            <div>
              <label class="block font-medium text-gray-700 mb-1">App ID</label>
              <input
                v-model="configAppId"
                type="text"
                placeholder="app_kasir_citra"
                class="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-900 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label class="block font-medium text-gray-700 mb-1">Publishable Key</label>
              <input
                v-model="configApiKey"
                type="text"
                placeholder="tt_live_xxxx"
                class="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-900 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label class="block font-medium text-gray-700 mb-1">Base URL</label>
              <input
                v-model="configBaseUrl"
                type="text"
                placeholder="https://..."
                class="w-full px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-900 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>

            <div class="flex items-center justify-between pt-1.5">
              <span v-if="configSavedMsg" class="text-emerald-600 font-bold flex items-center gap-1">
                <Check :size="13" /> Tersimpan!
              </span>
              <span v-else class="text-[11px] text-gray-400">Mode: {{ (licenseStore.apiConfig.apiKey || '').startsWith('tt_test_') ? 'Sandbox' : 'Production' }}</span>

              <button
                type="button"
                class="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-900 text-white font-semibold cursor-pointer ml-auto shadow-2xs"
                @click="handleSaveConfig"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500 shrink-0">
        <div class="flex items-center gap-1 font-mono text-[11px]">
          <span>Status:</span>
          <span class="font-bold text-gray-800">{{ licenseStore.status }}</span>
        </div>

        <button
          type="button"
          class="px-4 py-1.5 rounded-md text-xs font-semibold bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 transition-colors cursor-pointer shadow-2xs"
          @click="licenseStore.closeLicenseModal"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
