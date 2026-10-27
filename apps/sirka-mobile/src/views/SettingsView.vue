<script setup lang="ts">
import { ref, onMounted } from 'vue';
import HeaderBar from '../components/HeaderBar.vue';
import { ShieldCheck, CheckCircle2, Save, Store, Fingerprint, Globe, RefreshCw, AlertCircle } from 'lucide-vue-next';
import { useStoreProfile } from '../composables/useStoreProfile';
import { useDeviceAuth } from '../composables/useDeviceAuth';
import { isDeviceAuthSupported, getKeyBackend } from '../utils/deviceKey';
import { ownerApi, DEFAULT_API_URL } from '../services/api';

const { storeName, storeTagline, storeCode, isSynced: profileSynced } = useStoreProfile();

const {
  deviceId: authDeviceId,
  enableDeviceAuth,
  disableDeviceAuth,
  isDeviceAuthEnabled,
  isTokenEncrypted,
  savePinHash,
  clearPin,
} = useDeviceAuth();

const apiUrl = ref(DEFAULT_API_URL);
const apiToken = ref('');
const isTestingConnection = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

const pinCode = ref('');
const pinEnabled = ref(false);
const savedNotification = ref(false);
const deviceKeyEnabled = ref(false);
const deviceKeySupported = ref(false);
const deviceKeyMessage = ref('');
const keyBackend = ref<'android-keystore' | 'webcrypto'>(getKeyBackend());
const tokenEncrypted = ref(false);

onMounted(async () => {
  apiUrl.value = localStorage.getItem('sirka_owner_api_url') || DEFAULT_API_URL;
  apiToken.value = await ownerApi.getApiToken();
  tokenEncrypted.value = isTokenEncrypted();
  pinEnabled.value = localStorage.getItem('sirka_owner_pin_enabled') === 'true';
  deviceKeyEnabled.value = isDeviceAuthEnabled();
  deviceKeySupported.value = isDeviceAuthSupported();
  keyBackend.value = getKeyBackend();
});

async function runTestConnection() {
  isTestingConnection.value = true;
  testResult.value = null;
  try {
    const res = await ownerApi.testDbConnection(apiUrl.value.trim());
    testResult.value = res;
  } catch (e: any) {
    testResult.value = { success: false, message: e.message || 'Gagal menghubungi server' };
  } finally {
    isTestingConnection.value = false;
  }
}

async function saveSettings() {
  if (apiUrl.value) {
    localStorage.setItem('sirka_owner_api_url', apiUrl.value.trim());
  }
  await ownerApi.saveApiToken(apiToken.value.trim());
  tokenEncrypted.value = isTokenEncrypted();

  if (pinCode.value) {
    await savePinHash(pinCode.value);
    pinCode.value = '';
  }
  savedNotification.value = true;
  setTimeout(() => {
    savedNotification.value = false;
  }, 2500);
}

async function handleToggleDeviceKey() {
  if (deviceKeyEnabled.value) {
    const res = await disableDeviceAuth();
    deviceKeyMessage.value = res.message;
    deviceKeyEnabled.value = isDeviceAuthEnabled();
  } else {
    const res = await enableDeviceAuth();
    deviceKeyMessage.value = res.message;
    deviceKeyEnabled.value = isDeviceAuthEnabled();
  }
}

/**
 * BUG FIX (SEC-3): ketika Kunci Perangkat dinonaktifkan, PIN fallback (yang
 * disimpan sebagai hash) juga dihapus — tidak boleh ada dua mekanisme kunci
 * yang bisa saling bertentangan.
 */
async function handleTogglePin(enabled: boolean) {
  pinEnabled.value = enabled;
  if (!enabled) {
    clearPin();
    localStorage.setItem('sirka_owner_pin_enabled', 'false');
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#ecebe9] pb-20 text-[#2e2b28] font-sans flex flex-col">
    <!-- Header Bar (Full Edge) -->
    <HeaderBar
      title="Properti &amp; Setelan"
      subtitle="Sistem &gt; Konfigurasi Cloud"
    />

    <!-- Main Content (Full Edge) -->
    <main class="w-full flex-1 flex flex-col">
      <!-- 1. Profil Toko dari PostgreSQL -->
      <div class="w-full bg-white border-b border-[#c8c5c0]">
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between text-xs font-bold text-[#2e2b28]">
          <span class="flex items-center gap-1.5">
            <Store class="w-4 h-4 text-[#2563eb]" />
            Identitas Toko (PostgreSQL Cloud)
          </span>
          <span
            class="text-[10px] font-mono font-bold"
            :class="profileSynced ? 'text-[#16a34a]' : 'text-rose-700'"
          >
            {{ profileSynced ? '● Terhubung' : '○ Gagal Sinkron' }}
          </span>
        </div>

        <div class="p-3 space-y-2 text-xs divide-y divide-[#f0ede8]">
          <div class="flex justify-between items-center pt-1">
            <span class="text-[#6b655f]">Nama Toko</span>
            <span class="font-bold text-[#2e2b28]">{{ storeName }}</span>
          </div>
          <div class="flex justify-between items-center pt-2">
            <span class="text-[#6b655f]">Tagline</span>
            <span class="font-medium text-[#2e2b28]">{{ storeTagline }}</span>
          </div>
          <div class="flex justify-between items-center pt-2">
            <span class="text-[#6b655f]">Kode Singkat</span>
            <span class="font-mono font-bold text-[#2563eb]">{{ storeCode }}</span>
          </div>
        </div>
      </div>

      <!-- 2. Koneksi Server API & PostgreSQL Cloud -->
      <div class="w-full bg-white border-b border-[#c8c5c0]">
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between text-xs font-bold text-[#2e2b28]">
          <span class="flex items-center gap-1.5">
            <Globe class="w-4 h-4 text-[#2563eb]" />
            Server API Worker &amp; PostgreSQL Cloud
          </span>
        </div>

        <div class="p-3 space-y-3 text-xs">
          <div>
            <label class="block text-[11px] font-bold text-[#2e2b28] mb-1">URL Server API:</label>
            <input
              v-model="apiUrl"
              type="text"
              placeholder="https://sirka-owner-api.irudsa.workers.dev"
              class="w-full bg-[#faf9f7] border border-[#b8b5af] rounded-xs px-2.5 py-1 text-xs font-mono text-[#2e2b28] focus:outline-none focus:border-[#2563eb] shadow-inner"
            />
            <p class="text-[10px] text-[#6b655f] mt-1">
              Default: <span class="font-mono text-[#2563eb]">https://sirka-owner-api.irudsa.workers.dev</span>
            </p>
          </div>

          <div>
            <label class="block text-[11px] font-bold text-[#2e2b28] mb-1">Token Akses Worker (OWNER_SECRET_KEY):</label>
            <input
              v-model="apiToken"
              type="password"
              placeholder="Kosongkan jika proteksi token belum diaktifkan di Worker"
              class="w-full bg-[#faf9f7] border border-[#b8b5af] rounded-xs px-2.5 py-1 text-xs font-mono text-[#2e2b28] focus:outline-none focus:border-[#2563eb] shadow-inner"
            />
          </div>

          <!-- Tombol Uji Koneksi Langsung -->
          <div class="flex items-center gap-2 pt-1">
            <button
              type="button"
              @click="runTestConnection"
              :disabled="isTestingConnection"
              class="explorer-btn px-3 py-1.5 text-xs font-bold rounded-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isTestingConnection }" />
              {{ isTestingConnection ? 'Menguji Koneksi...' : 'Uji Koneksi Server' }}
            </button>
          </div>

          <!-- Hasil Uji Koneksi -->
          <div
            v-if="testResult"
            class="p-2 rounded border text-xs font-mono flex items-start gap-1.5 mt-2"
            :class="testResult.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'"
          >
            <CheckCircle2 v-if="testResult.success" class="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <AlertCircle v-else class="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{{ testResult.message }}</span>
          </div>
        </div>
      </div>

      <!-- 3. Full-Edge Device Key Security Section -->
      <div class="w-full bg-white border-b border-[#c8c5c0]">
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between text-xs font-bold text-[#2e2b28]">
          <span class="flex items-center gap-1.5">
            <ShieldCheck class="w-4 h-4 text-[#2563eb]" />
            Kunci Perangkat (Device Key)
          </span>
        </div>

        <div class="p-3 space-y-3 text-xs">
          <!--
            BUG FIX (SEC-3): PIN Owner dulu disimpan sebagai TEKS POLA di
            localStorage (bisa dibaca backup/skirp). Sekarang digantikan kunci
            kripto NON-EXTRACTABLE milik perangkat ini + konfirmasi kredensial
            perangkat (sidik jari/pattern HP) bila tersedia.
          -->
          <div class="flex items-center justify-between">
            <div class="min-w-0 pr-3">
              <span class="font-bold text-[#2e2b28] flex items-center gap-1.5">
                <Fingerprint :size="13" class="text-[#2563eb]" />
                Kunci Aplikasi dengan Kunci Perangkat
              </span>
              <p class="text-[10.5px] text-[#6b655f] mt-0.5">
                <template v-if="deviceKeyEnabled">
                  Aktif. Aplikasi terkunci saat dibuka &amp; memakai
                  sidik jari/kunci layar HP bila tersedia.
                </template>
                <template v-else-if="deviceKeySupported">
                  Aktifkan untuk mengunci aplikasi memakai Kunci Perangkat
                  (kunci kripto privat milik HP ini, tidak bisa dibaca aplikasi lain).
                </template>
                <template v-else>
                  Perangkat ini tidak mendukung Web Crypto — tetap memakai PIN fallback.
                </template>
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                :checked="deviceKeyEnabled"
                :disabled="!deviceKeySupported"
                @change="handleToggleDeviceKey"
                class="sr-only peer"
              />
              <div class="w-9 h-5 bg-[#d6d4cf] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#b0aca5] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2563eb]"></div>
            </label>
          </div>

          <p v-if="deviceKeyMessage" class="text-[10.5px] text-[#6b655f] font-mono">
            {{ deviceKeyMessage }}
          </p>

          <p v-if="deviceKeyEnabled && authDeviceId" class="text-[10.5px] text-[#6b655f] font-mono">
            ID Perangkat: {{ authDeviceId }}
            <span v-if="keyBackend === 'android-keystore'" class="text-emerald-700">
              (Android Keystore — hardware-backed)
            </span>
            <span v-else class="text-[#9a958d]">(Web Crypto)</span>
          </p>

          <!-- Status enkripsi token akses Worker -->
          <p class="text-[10.5px] text-[#6b655f] font-mono">
            Penyimpanan token:
            <span :class="tokenEncrypted ? 'text-emerald-700' : 'text-amber-700'">
              {{ tokenEncrypted ? 'TERENKRIPSI (AES-GCM, kunci perangkat)' : 'belum terenkripsi' }}
            </span>
          </p>

          <!-- Fallback PIN -->
          <div class="pt-2 border-t border-[#e5e3de]">
            <div class="flex items-center justify-between">
              <div>
                <span class="font-bold text-[#2e2b28]">Cadangan: PIN Akses</span>
                <p class="text-[10.5px] text-[#6b655f]">
                  Hanya dipakai bila Kunci Perangkat tidak tersedia
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="pinEnabled"
                  @change="handleTogglePin(($event.target as HTMLInputElement).checked)"
                  class="sr-only peer"
                />
                <div class="w-9 h-5 bg-[#d6d4cf] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#b0aca5] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2563eb]"></div>
              </label>
            </div>

            <div v-if="pinEnabled" class="pt-2">
              <label class="block text-[11px] font-bold text-[#2e2b28] mb-1">Set PIN Baru (4-6 Angka):</label>
              <input
                v-model="pinCode"
                type="password"
                maxlength="6"
                placeholder="Contoh: 1234"
                class="w-full bg-[#faf9f7] border border-[#b8b5af] rounded-xs px-2.5 py-1 text-xs font-mono text-[#2e2b28] focus:outline-none focus:border-[#2563eb] shadow-inner"
              />
              <p class="text-[10.5px] text-amber-700 mt-1">
                PIN disimpan di perangkat ini dan akan DIHAPUS otomatis setelah
                Kunci Perangkat aktif.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Full-Edge Action Button Bar -->
      <div class="w-full bg-[#dfddd9] border-b border-[#c8c5c0] p-3 flex items-center justify-between">
        <button
          @click="saveSettings"
          class="explorer-btn-primary px-4 py-1.5 text-xs font-bold rounded-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Save class="w-3.5 h-3.5" />
          Simpan Setelan
        </button>

        <span
          v-if="savedNotification"
          class="text-xs font-bold text-[#16a34a] flex items-center gap-1 animate-fade-in"
        >
          <CheckCircle2 class="w-4 h-4" />
          Tersimpan!
        </span>
      </div>
    </main>
  </div>
</template>
