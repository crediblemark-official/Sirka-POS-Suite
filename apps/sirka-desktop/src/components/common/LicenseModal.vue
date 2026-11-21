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
  ChevronUp,
  MessageCircle,
  Lock,
  Unlock,
  ExternalLink,
  QrCode,
  Building2,
  CheckCircle2,
  RotateCcw
} from 'lucide-vue-next';

import { useConfirmDialog } from '../../composables/useConfirmDialog';
import {
  APP_VERSION,
  APP_CREDIT,
  APP_DEVELOPER,
  APP_ORGANIZATION,
  APP_WHATSAPP,
  APP_WHATSAPP_LINK
} from '../../config/version';

const licenseStore = useLicenseStore();
const confirmDialog = useConfirmDialog();

const inputKey = ref('');
const inputDeviceName = ref(licenseStore.deviceName || '');
const showRawKey = ref(false);
const copiedKey = ref(false);
const copiedHwid = ref(false);
const copiedPaymentCode = ref(false);
const isDev = import.meta.env.DEV;
const showAdvancedConfig = ref(false);
const isDeactivateUnlocked = ref(false);

// Advanced API config state
const configAppId = ref(licenseStore.apiConfig.appId);
const configApiKey = ref(licenseStore.apiConfig.apiKey);
const configBaseUrl = ref(licenseStore.apiConfig.baseUrl);
const configSavedMsg = ref(false);

// Active Tab: Jika sudah aktif default ke 'status', jika belum default ke 'buy' (Alur 2 B)
const activeTab = ref<'status' | 'buy' | 'activate'>(licenseStore.isLicensed ? 'status' : 'buy');

// Tertaut Alur 2 B In-App Checkout state
const buyRail = ref<'qris' | 'va'>('qris');
const buyVaBank = ref<'MANDIRI' | 'BCA' | 'BRI' | 'BNI'>('MANDIRI');
const buyEmail = ref(licenseStore.customerEmail || '');
const buyName = ref(licenseStore.customerName || '');
const isCreatingCheckout = ref(false);
const isCheckingPayment = ref(false);
const paymentSuccess = ref(false);

const checkoutSession = ref<{
  transactionId: string;
  ticket?: string;
  checkoutUrl: string;
  qrDataUrl?: string;
  paymentCode?: string;
  status: string;
} | null>(null);

let autoPollTimer: ReturnType<typeof setInterval> | null = null;

function startAutoPolling() {
  stopAutoPolling();
  // Live polling setiap 2.5 detik (Alur 2 B)
  autoPollTimer = setInterval(async () => {
    if (!checkoutSession.value || checkoutSession.value.status === 'PAID' || paymentSuccess.value) {
      stopAutoPolling();
      return;
    }
    await pollPaymentStatus(true);
  }, 2500);
}

function stopAutoPolling() {
  if (autoPollTimer) {
    clearInterval(autoPollTimer);
    autoPollTimer = null;
  }
}

async function pollPaymentStatus(silent = false) {
  if (!checkoutSession.value) return;
  if (!silent) isCheckingPayment.value = true;
  try {
    const res = await licenseStore.checkPaymentStatus(
      checkoutSession.value.transactionId,
      checkoutSession.value.ticket
    );
    checkoutSession.value.status = res.paymentStatus;
    if (res.paymentStatus === 'PAID') {
      stopAutoPolling();
      paymentSuccess.value = true;
      if (res.licenseKey) {
        inputKey.value = res.licenseKey;
        await licenseStore.activate(res.licenseKey, inputDeviceName.value || buyName.value);
      }
    }
  } catch (err) {
    if (!silent) {
      console.warn('[LicenseModal] Cek status pembayaran gagal:', err);
    }
  } finally {
    if (!silent) isCheckingPayment.value = false;
  }
}

async function handleStartInAppCheckout() {
  if (!buyEmail.value.trim()) return;
  isCreatingCheckout.value = true;
  try {
    const res = await licenseStore.startCheckout({
      customerEmail: buyEmail.value.trim(),
      customerName: buyName.value.trim() || undefined,
      amount: licenseStore.apiConfig.targetPrice || 135000,
      paymentRail: buyRail.value,
      vaBank: buyRail.value === 'va' ? buyVaBank.value : undefined
    });

    let url = res.hostedPayUrl || res.checkoutUrl || '';
    if (url && res.ticket && url.includes('/pay/') && !url.includes('ticket=')) {
      url += (url.includes('?') ? '&' : '?') + `ticket=${encodeURIComponent(res.ticket)}`;
    }

    checkoutSession.value = {
      transactionId: res.transactionId,
      ticket: res.ticket,
      checkoutUrl: url,
      qrDataUrl: res.qrDataUrl,
      paymentCode: res.paymentCode,
      status: 'PENDING'
    };
    paymentSuccess.value = false;

    // Mulai background auto-polling status
    startAutoPolling();
  } catch (err: any) {
    console.error('[LicenseModal] Gagal memulai in-app checkout:', err);
    licenseStore.errorMessage = err?.message || 'Gagal membuat sesi pembayaran Tertaut.';
  } finally {
    isCreatingCheckout.value = false;
  }
}

function handleResetCheckout() {
  stopAutoPolling();
  checkoutSession.value = null;
  paymentSuccess.value = false;
}

async function handleCopyPaymentCode() {
  if (!checkoutSession.value?.paymentCode) return;
  try {
    await navigator.clipboard.writeText(checkoutSession.value.paymentCode);
    copiedPaymentCode.value = true;
    setTimeout(() => { copiedPaymentCode.value = false; }, 2000);
  } catch (err) {
    console.warn('Gagal menyalin paymentCode:', err);
  }
}

async function openHostedPayUrl() {
  const url = checkoutSession.value?.checkoutUrl || licenseStore.officialCheckoutUrl;
  if (!url) return;
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function closeModal() {
  stopAutoPolling();
  licenseStore.closeLicenseModal();
}

watch(() => licenseStore.showModal, (isOpen) => {
  if (!isOpen) {
    isDeactivateUnlocked.value = false;
    stopAutoPolling();
  } else {
    if (!licenseStore.isLicensed && activeTab.value === 'status') {
      activeTab.value = 'buy';
    }
  }
});

if (licenseStore.licenseKey && !inputKey.value) {
  inputKey.value = licenseStore.licenseKey;
}

watch(() => licenseStore.licenseKey, (newVal) => {
  if (newVal && !inputKey.value) {
    inputKey.value = newVal;
  }
});

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
  }
}

async function handleQuickActivate() {
  const key = licenseStore.licenseKey || inputKey.value;
  if (!key.trim()) {
    activeTab.value = 'activate';
    return;
  }
  const res = await licenseStore.activate(key, inputDeviceName.value);
  if (res.success) {
    activeTab.value = 'status';
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

async function openWhatsApp() {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(APP_WHATSAPP_LINK);
  } catch {
    window.open(APP_WHATSAPP_LINK, '_blank');
  }
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
    closeModal();
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
  stopAutoPolling();
  window.removeEventListener('keydown', handleKeydown, true);
});
</script>

<template>
  <div
    v-if="licenseStore.showModal"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
    tabindex="-1"
    @click.self="closeModal"
    @keydown.esc="closeModal"
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
            <Sparkles v-else :size="18" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-gray-800 leading-tight">Lisensi Sirka POS Studio</h2>
            <p class="text-[11px] text-gray-500">Pusat aktivasi & pembayaran lisensi resmi</p>
          </div>
        </div>

        <button
          type="button"
          class="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 cursor-pointer transition-colors"
          title="Tutup"
          @click="closeModal"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Tab Navigation (Alur 2 B: Beli Lisensi In-App) -->
      <div class="flex border-b border-gray-200 bg-gray-50 px-5 shrink-0 text-xs">
        <button
          type="button"
          class="px-4 py-2.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 -mb-px"
          :class="activeTab === 'status' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-600 hover:text-gray-900'"
          @click="activeTab = 'status'"
        >
          <Shield :size="14" />
          <span>Status Lisensi</span>
          <span
            v-if="licenseStore.isLicensed"
            class="w-2 h-2 rounded-full bg-emerald-500"
          ></span>
        </button>

        <button
          type="button"
          class="px-4 py-2.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 -mb-px"
          :class="activeTab === 'buy' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-600 hover:text-gray-900'"
          @click="activeTab = 'buy'"
        >
          <Sparkles :size="14" class="text-emerald-600" />
          <span>Beli Lisensi (QRIS / VA)</span>
          <span
            v-if="!licenseStore.isLicensed"
            class="px-1.5 py-0.2 rounded-full text-[9px] bg-emerald-600 text-white font-bold"
          >
            Alur In-App
          </span>
        </button>

        <button
          type="button"
          class="px-4 py-2.5 font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-2 -mb-px"
          :class="activeTab === 'activate' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-600 hover:text-gray-900'"
          @click="activeTab = 'activate'"
        >
          <KeyRound :size="14" />
          <span>Punya Kode?</span>
        </button>
      </div>

      <!-- Content Area (Scrollable) -->
      <div class="p-5 overflow-y-auto space-y-4 flex-1 bg-white">
        <!-- Error & Success Banners -->
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
          <!-- Status Ringkas -->
          <div class="pb-3.5 border-b border-gray-200 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div
                class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                :class="licenseStore.isLicensed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
              >
                <ShieldCheck v-if="licenseStore.isLicensed" :size="20" />
                <KeyRound v-else :size="20" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-gray-900">
                    <template v-if="licenseStore.isLicensed">Aplikasi Berlisensi Resmi</template>
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
                  <template v-if="licenseStore.isLicensed">Semua fitur kasir dan manajemen transaksi aktif.</template>
                  <template v-else>Beli atau aktivasi lisensi untuk membuka fitur kasir penuh.</template>
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

          <!-- Metadata List -->
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
                ID Perangkat (HWID)
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
                <span>{{ licenseStore.isChecking ? 'Memeriksa...' : 'Periksa Lisensi' }}</span>
              </button>

              <!-- Tombol Aktivasi Perangkat jika lisensi ada namun belum aktif di perangkat ini -->
              <button
                v-if="licenseStore.licenseKey && !licenseStore.isLicensed"
                type="button"
                class="px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                :disabled="licenseStore.isActivating"
                @click="handleQuickActivate"
              >
                <KeyRound :size="13" />
                <span>{{ licenseStore.isActivating ? 'Mengaktivasi...' : 'Aktivasi Perangkat Ini' }}</span>
              </button>

              <!-- Tombol Lepas Lisensi dengan Proteksi Lock/Unlock -->
              <template v-if="licenseStore.isLicensed">
                <button
                  v-if="!isDeactivateUnlocked"
                  type="button"
                  class="px-2.5 py-1.5 rounded-md text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100 hover:text-gray-700 border border-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs select-none"
                  @click="isDeactivateUnlocked = true"
                >
                  <Lock :size="12" class="text-gray-400" />
                  <span>Lepas Lisensi (Terkunci)</span>
                </button>

                <div v-else class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-md text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                    :disabled="licenseStore.isActivating"
                    @click="handleDeactivate"
                  >
                    <LogOut :size="13" />
                    <span>Lepas Lisensi</span>
                  </button>
                  <button
                    type="button"
                    class="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors cursor-pointer"
                    @click="isDeactivateUnlocked = false"
                  >
                    <Unlock :size="13" class="text-amber-600" />
                  </button>
                </div>
              </template>
            </div>

            <!-- Tombol Beli jika belum berlisensi -->
            <button
              v-if="!licenseStore.isLicensed"
              type="button"
              class="px-3.5 py-1.5 rounded-md text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer ml-auto shadow-2xs"
              @click="activeTab = 'buy'"
            >
              <Sparkles :size="13" />
              <span>Beli Lisensi Sekarang</span>
            </button>
          </div>
        </template>

        <!-- TAB 2: BELI LISENSI (ALUR 2 B - IN-APP CUSTOM UI DENGAN QRIS / VA) -->
        <template v-else-if="activeTab === 'buy'">
          <div class="space-y-3.5">
            <!-- Header Kartu Produk -->
            <div class="p-3.5 rounded-lg bg-emerald-50/80 border border-emerald-200 shadow-2xs">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Sparkles :size="14" class="text-emerald-600" />
                    <span>Lisensi Resmi Sirka POS Studio</span>
                  </div>
                  <p class="text-[11px] text-gray-600 mt-0.5">
                    Aktivasi otomatis & instan langsung di kasir tanpa perlu keluar aplikasi.
                  </p>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-base font-extrabold text-emerald-800">Rp 135.000</div>
                  <div class="text-[10px] text-gray-500 font-medium">Sekali Beli / Seumur Hidup</div>
                </div>
              </div>
            </div>

            <!-- KONDISI A: SUDAH SUKSES BAYAR (AUTO-AKTIVASI SELESAI) -->
            <div
              v-if="paymentSuccess || (checkoutSession && checkoutSession.status === 'PAID')"
              class="p-5 rounded-lg bg-emerald-50 border border-emerald-300 text-center space-y-3 animate-in fade-in zoom-in-95"
            >
              <div class="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 :size="28" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-emerald-900">Pembayaran Terkonfirmasi!</h3>
                <p class="text-xs text-emerald-700 mt-1">
                  Lisensi resmi Sirka POS Studio telah otomatis diaktivasi pada perangkat ini.
                </p>
              </div>

              <div v-if="inputKey" class="p-2.5 rounded bg-white border border-emerald-200 text-xs font-mono select-all text-gray-800">
                Kode Lisensi: <strong class="text-emerald-800">{{ inputKey }}</strong>
              </div>

              <div class="pt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  class="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs"
                  @click="activeTab = 'status'"
                >
                  Lihat Status Lisensi
                </button>
              </div>
            </div>

            <!-- KONDISI B: SESI CHECKOUT SEDANG AKTIF (MENAMPILKAN QRIS / VA + LIVE POLLING) -->
            <div
              v-else-if="checkoutSession"
              class="p-4 rounded-lg bg-gray-50 border border-blue-200 space-y-3 animate-in fade-in"
            >
              <!-- Live Polling Indicator -->
              <div class="flex items-center justify-between pb-2.5 border-b border-gray-200">
                <div class="flex items-center gap-2">
                  <span class="relative flex h-2.5 w-2.5">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span class="text-xs font-semibold text-gray-800">
                    Menunggu Pembayaran...
                  </span>
                </div>
                <span class="text-[11px] text-gray-500 font-medium">
                  Deteksi Otomatis Aktif
                </span>
              </div>

              <!-- JALUR 1: TAMPILKAN QRIS DINAMIS IN-APP -->
              <div v-if="checkoutSession.qrDataUrl" class="text-center space-y-2 py-1">
                <div class="bg-white p-3 rounded-lg border border-gray-300 inline-block shadow-xs">
                  <img
                    :src="checkoutSession.qrDataUrl"
                    alt="QRIS Pembayaran Resmi"
                    class="w-52 h-52 mx-auto object-contain select-none"
                  />
                  <div class="text-[11px] font-bold text-gray-700 mt-1 flex items-center justify-center gap-1.5">
                    <QrCode :size="13" class="text-emerald-600" />
                    <span>QRIS Resmi — Bebas Biaya Admin</span>
                  </div>
                </div>
                <p class="text-xs text-gray-600 max-w-sm mx-auto">
                  Scan kode QR di atas menggunakan <strong>BCA Mobile, Livin, BRImo, GoPay, OVO, Dana, ShopeePay</strong>, atau m-Banking apapun.
                </p>
                <div class="text-xs font-bold text-gray-800">
                  Total Bayar: <span class="text-emerald-700 text-sm font-extrabold">Rp 135.000</span>
                </div>
              </div>

              <!-- JALUR 2: TAMPILKAN VIRTUAL ACCOUNT IN-APP -->
              <div v-else-if="checkoutSession.paymentCode" class="space-y-2.5 py-1">
                <div class="p-3 bg-white rounded-lg border border-gray-300 text-center space-y-1 shadow-xs">
                  <div class="text-xs text-gray-500 font-medium">Nomor Virtual Account {{ buyVaBank }}</div>
                  <div class="text-xl font-mono font-extrabold text-blue-900 tracking-wider select-all py-1">
                    {{ checkoutSession.paymentCode }}
                  </div>
                  <button
                    type="button"
                    class="px-3 py-1 rounded-md text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    @click="handleCopyPaymentCode"
                  >
                    <Check v-if="copiedPaymentCode" :size="13" class="text-emerald-600" />
                    <Copy v-else :size="13" />
                    <span>{{ copiedPaymentCode ? 'Nomor Tersalin!' : 'Salin Nomor Rekening' }}</span>
                  </button>
                </div>
                <p class="text-[11px] text-gray-600 text-center">
                  Transfer tepat <strong>Rp 135.000</strong> ke nomor VA di atas. Sistem akan mendeteksi pelunasan secara instan.
                </p>
              </div>

              <!-- Sesi Status & Tombol Aksi -->
              <div class="pt-2 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  class="px-3 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                  @click="handleResetCheckout"
                >
                  <RotateCcw :size="13" />
                  <span>Ganti Metode / Batal</span>
                </button>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-md text-xs font-semibold bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Buka kasir di browser sebagai alternatif (Alur 1 B)"
                    @click="openHostedPayUrl"
                  >
                    <ExternalLink :size="13" />
                    <span>Buka di Web (Alur 1 B)</span>
                  </button>

                  <button
                    type="button"
                    class="px-3 py-1.5 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                    :disabled="isCheckingPayment"
                    @click="pollPaymentStatus(false)"
                  >
                    <RefreshCw :size="13" :class="{ 'animate-spin': isCheckingPayment }" />
                    <span>{{ isCheckingPayment ? 'Mengecek...' : 'Cek Status Manual' }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- KONDISI C: FORM AWAL PEMBUATAN SESI IN-APP (SELEKSI METODE & DATA PEMBELI) -->
            <div v-else class="space-y-3">
              <!-- Pemilihan Jalur Pembayaran (QRIS vs VA) -->
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1.5">
                  Pilih Metode Pembayaran
                </label>
                <div class="grid grid-cols-2 gap-2">
                  <!-- Opsi QRIS -->
                  <button
                    type="button"
                    class="p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col gap-1"
                    :class="buyRail === 'qris' ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600 text-emerald-950' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'"
                    @click="buyRail = 'qris'"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5 font-bold text-xs">
                        <QrCode :size="14" class="text-emerald-600" />
                        <span>QRIS Instan</span>
                      </div>
                      <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                        Populer
                      </span>
                    </div>
                    <p class="text-[10px] text-gray-500 leading-tight">
                      Scan via GoPay, Dana, OVO, BCA, Livin, ShopeePay, dll.
                    </p>
                  </button>

                  <!-- Opsi Virtual Account -->
                  <button
                    type="button"
                    class="p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col gap-1"
                    :class="buyRail === 'va' ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600 text-blue-950' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'"
                    @click="buyRail = 'va'"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5 font-bold text-xs">
                        <Building2 :size="14" class="text-blue-600" />
                        <span>Virtual Account</span>
                      </div>
                      <span class="text-[9px] font-semibold text-gray-400">Transfer Bank</span>
                    </div>
                    <p class="text-[10px] text-gray-500 leading-tight">
                      Mandiri, BCA, BRI, BNI (Terverifikasi otomatis).
                    </p>
                  </button>
                </div>
              </div>

              <!-- Pilihan Bank VA jika memilih VA -->
              <div v-if="buyRail === 'va'" class="p-2.5 rounded-md bg-gray-50 border border-gray-200 space-y-1.5">
                <label class="block text-[11px] font-bold text-gray-700">Pilih Bank Virtual Account:</label>
                <div class="grid grid-cols-4 gap-1.5 text-xs font-semibold">
                  <button
                    v-for="bank in ['MANDIRI', 'BCA', 'BRI', 'BNI'] as const"
                    :key="bank"
                    type="button"
                    class="py-1.5 px-2 rounded border text-center cursor-pointer transition-colors"
                    :class="buyVaBank === bank ? 'border-blue-600 bg-blue-600 text-white font-bold' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'"
                    @click="buyVaBank = bank"
                  >
                    {{ bank }}
                  </button>
                </div>
              </div>

              <!-- Input Email & Nama -->
              <div class="space-y-2">
                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1">
                    Email Penerima Lisensi <span class="text-rose-500">*</span>
                  </label>
                  <input
                    v-model="buyEmail"
                    type="email"
                    placeholder="nama@toko-anda.com"
                    class="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 shadow-2xs"
                  />
                  <p class="text-[10px] text-gray-500 mt-0.5">
                    Bukti pembayaran resmi dan kunci lisensi cadangan dikirim ke email ini.
                  </p>
                </div>

                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1">
                    Nama Toko / Pemilik (Opsional)
                  </label>
                  <input
                    v-model="buyName"
                    type="text"
                    placeholder="Contoh: Toko Berkah Jaya"
                    class="w-full px-3 py-2 rounded-md border border-gray-300 bg-white text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 shadow-2xs"
                  />
                </div>
              </div>

              <!-- Tombol Mulai Pembayaran In-App (Alur 2 B) -->
              <button
                type="button"
                class="w-full py-2.5 rounded-md font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                :disabled="isCreatingCheckout || !buyEmail.trim()"
                @click="handleStartInAppCheckout"
              >
                <RefreshCw v-if="isCreatingCheckout" :size="15" class="animate-spin" />
                <Sparkles v-else :size="15" />
                <span>
                  {{ isCreatingCheckout
                    ? 'Menyiapkan Pembayaran In-App...'
                    : (buyRail === 'qris' ? 'Tampilkan QRIS Pembayaran (Rp 135.000)' : `Buat VA ${buyVaBank} (Rp 135.000)`)
                  }}
                </span>
              </button>

              <div class="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded border border-gray-200 flex items-start gap-2">
                <span class="text-emerald-600 font-bold shrink-0">⚡</span>
                <div class="leading-relaxed">
                  <strong>Alur 2 B (In-App Checkout):</strong><br />
                  Kode QRIS / VA langsung muncul di dalam layar kasir ini. Setelah dibayar, aplikasi otomatis aktif tanpa perlu copy-paste serial key.
                </div>
              </div>
            </div>

            <!-- Bantuan WhatsApp -->
            <div class="text-center text-[11px] text-gray-500 pt-1 flex items-center justify-center gap-1.5">
              <span>Butuh bantuan pembayaran?</span>
              <a
                :href="APP_WHATSAPP_LINK"
                target="_blank"
                rel="noopener noreferrer"
                class="text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                @click.prevent="openWhatsApp"
              >
                <MessageCircle :size="12" />
                <span>WhatsApp Admin ({{ APP_WHATSAPP }})</span>
              </a>
            </div>
          </div>
        </template>

        <!-- TAB 3: PUNYA KODE LISENSI (AKTIVASI MANUAL) -->
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
              <p class="text-[11px] text-gray-500 mt-1">
                Masukkan kode lisensi yang Anda terima dari pembelian sebelumnya atau email konfirmasi.
              </p>
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
              class="w-full py-2.5 rounded-md font-bold text-xs bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              :disabled="licenseStore.isActivating || !inputKey.trim()"
              @click="handleActivate"
            >
              <Sparkles v-if="!licenseStore.isActivating" :size="15" />
              <RefreshCw v-else :size="15" class="animate-spin" />
              <span>{{ licenseStore.isActivating ? 'Mengaktivasi Lisensi...' : 'Aktivasi Perangkat Ini' }}</span>
            </button>

            <!-- Tautan ke Tab Beli -->
            <div class="pt-2 text-center">
              <button
                type="button"
                class="text-xs text-emerald-700 hover:text-emerald-800 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                @click="activeTab = 'buy'"
              >
                <Sparkles :size="13" />
                <span>Belum punya kode lisensi? Beli lisensi via QRIS / VA langsung di sini</span>
              </button>
            </div>

            <!-- Bantuan WhatsApp -->
            <div class="text-center text-[11px] text-gray-500 pt-2 flex items-center justify-center gap-1.5 border-t border-gray-100">
              <span>Butuh lisensi / bantuan?</span>
              <a
                :href="APP_WHATSAPP_LINK"
                target="_blank"
                rel="noopener noreferrer"
                class="text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                @click.prevent="openWhatsApp"
              >
                <MessageCircle :size="12" />
                <span>WhatsApp Admin ({{ APP_WHATSAPP }})</span>
              </a>
            </div>
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
                placeholder="app_2ee4f785d508"
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
                placeholder="https://tertaut.com/api/v1"
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
        <div class="flex flex-col gap-0.5">
          <div class="flex items-center gap-1 font-mono text-[11px]">
            <span>Status:</span>
            <span class="font-bold text-gray-800">{{ licenseStore.status }}</span>
            <span class="text-gray-300 mx-1">|</span>
            <span class="font-medium text-gray-600">v{{ APP_VERSION }}</span>
          </div>
          <div class="text-[10px] text-gray-400">
            Credit by <span class="text-gray-600 font-semibold">{{ APP_CREDIT }}</span> • Dev: <span class="text-gray-600 font-medium">{{ APP_DEVELOPER }}</span> • WA: <a :href="APP_WHATSAPP_LINK" target="_blank" class="text-emerald-600 hover:underline font-mono" @click.prevent="openWhatsApp">{{ APP_WHATSAPP }}</a> • Untuk <span class="text-indigo-600 font-medium">{{ APP_ORGANIZATION }}</span>
          </div>
        </div>

        <button
          type="button"
          class="px-4 py-1.5 rounded-md text-xs font-semibold bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 transition-colors cursor-pointer shadow-2xs"
          @click="closeModal"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>