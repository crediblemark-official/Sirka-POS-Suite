<script setup lang="ts">
import { ref, onMounted } from 'vue';
import HeaderBar from '../components/HeaderBar.vue';
import { ShieldCheck, CheckCircle2, Save, Store, Fingerprint } from 'lucide-vue-next';
import { useStoreProfile } from '../composables/useStoreProfile';
import { useDeviceAuth } from '../composables/useDeviceAuth';
import { isDeviceAuthSupported, getKeyBackend } from '../utils/deviceKey';

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

const pinCode = ref('');
const pinEnabled = ref(false);
const savedNotification = ref(false);
const deviceKeyEnabled = ref(false);
const deviceKeySupported = ref(false);
const deviceKeyMessage = ref('');
const keyBackend = ref<'android-keystore' | 'webcrypto'>(getKeyBackend());
const tokenEncrypted = ref(false);

onMounted(async () => {
  tokenEncrypted.value = isTokenEncrypted();
  pinEnabled.value = localStorage.getItem('sirka_owner_pin_enabled') === 'true';
  deviceKeyEnabled.value = isDeviceAuthEnabled();
  deviceKeySupported.value = isDeviceAuthSupported();
  keyBackend.value = getKeyBackend();
});

async function saveSettings() {
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

      <!-- 2. Full-Edge Device Key Security Section -->
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
