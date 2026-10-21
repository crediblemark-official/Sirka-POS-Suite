<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ownerApi, DEFAULT_API_URL } from '../services/api';
import HeaderBar from '../components/HeaderBar.vue';
import { Cloud, ShieldCheck, CheckCircle2, AlertCircle, Save, RotateCcw, Store } from 'lucide-vue-next';
import { useStoreProfile } from '../composables/useStoreProfile';

const { storeName, storeTagline, storeCode } = useStoreProfile();

const apiUrl = ref('');
const pinCode = ref('');
const pinEnabled = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);
const testing = ref(false);
const savedNotification = ref(false);

onMounted(() => {
  apiUrl.value = localStorage.getItem('sirka_owner_api_url') || DEFAULT_API_URL;
  pinCode.value = localStorage.getItem('sirka_owner_pin') || '';
  pinEnabled.value = localStorage.getItem('sirka_owner_pin_enabled') === 'true';
});

async function runTestConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await ownerApi.testDbConnection(apiUrl.value);
  } finally {
    testing.value = false;
  }
}

function resetDefaultUrl() {
  apiUrl.value = DEFAULT_API_URL;
  saveSettings();
}

function saveSettings() {
  localStorage.setItem('sirka_owner_api_url', apiUrl.value);
  localStorage.setItem('sirka_owner_pin', pinCode.value);
  localStorage.setItem('sirka_owner_pin_enabled', pinEnabled.value ? 'true' : 'false');
  savedNotification.value = true;
  setTimeout(() => {
    savedNotification.value = false;
  }, 2500);
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
      <!-- 1. Full-Edge API Section -->
      <div class="w-full bg-white border-b border-[#c8c5c0]">
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between text-xs font-bold text-[#2e2b28]">
          <span class="flex items-center gap-1.5">
            <Cloud class="w-4 h-4 text-[#2563eb]" />
            Koneksi Cloudflare Worker REST API
          </span>
          <span class="text-[10px] text-[#16a34a] font-bold">HTTPS Aktif</span>
        </div>

        <div class="p-3 space-y-2.5 text-xs">
          <p class="text-[11px] text-[#6b655f]">
            Serverless API yang menjembatani HP Owner ke database PostgreSQL dengan aman dan cepat:
          </p>

          <div>
            <label class="block text-[11px] font-bold text-[#2e2b28] mb-1">URL Endpoint Publik:</label>
            <input
              v-model="apiUrl"
              type="url"
              class="w-full bg-[#faf9f7] border border-[#b8b5af] rounded-xs px-2.5 py-1 text-xs font-mono text-[#2e2b28] focus:outline-none focus:border-[#2563eb] focus:bg-white shadow-inner"
            />
          </div>

          <div class="flex items-center gap-2 pt-1">
            <button
              @click="runTestConnection"
              :disabled="testing"
              class="explorer-btn px-3 py-1 text-xs font-bold rounded-xs cursor-pointer disabled:opacity-50"
            >
              {{ testing ? 'Menguji...' : 'Uji Status Koneksi' }}
            </button>
            <button
              @click="resetDefaultUrl"
              class="text-xs text-[#2563eb] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
            >
              <RotateCcw class="w-3 h-3" />
              Reset Default
            </button>
          </div>

          <!-- Connection Test Feedback -->
          <div
            v-if="testResult"
            class="p-2 rounded-xs text-xs flex items-center gap-2 border"
            :class="testResult.success
              ? 'bg-[#f0fdf4] border-[#86efac] text-[#166534]'
              : 'bg-[#fef2f2] border-[#fca5a5] text-[#991b1b]'"
          >
            <CheckCircle2 v-if="testResult.success" class="w-4 h-4 shrink-0 text-[#16a34a]" />
            <AlertCircle v-else class="w-4 h-4 shrink-0 text-[#dc2626]" />
            <span class="font-mono">{{ testResult.message }}</span>
          </div>
        </div>
      </div>

      <!-- 2. Full-Edge PIN Security Section -->
      <div class="w-full bg-white border-b border-[#c8c5c0]">
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between text-xs font-bold text-[#2e2b28]">
          <span class="flex items-center gap-1.5">
            <ShieldCheck class="w-4 h-4 text-[#2563eb]" />
            Proteksi PIN Akses Aplikasi
          </span>
        </div>

        <div class="p-3 space-y-3 text-xs">
          <div class="flex items-center justify-between">
            <div>
              <span class="font-bold text-[#2e2b28]">Kunci dengan PIN</span>
              <p class="text-[10.5px] text-[#6b655f]">Minta PIN saat aplikasi dibuka</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                v-model="pinEnabled"
                class="sr-only peer"
              />
              <div class="w-9 h-5 bg-[#d6d4cf] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#b0aca5] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2563eb]"></div>
            </label>
          </div>

          <div v-if="pinEnabled">
            <label class="block text-[11px] font-bold text-[#2e2b28] mb-1">Set PIN Baru (4-6 Angka):</label>
            <input
              v-model="pinCode"
              type="password"
              maxlength="6"
              placeholder="Contoh: 1234"
              class="w-full bg-[#faf9f7] border border-[#b8b5af] rounded-xs px-2.5 py-1 text-xs font-mono text-[#2e2b28] focus:outline-none focus:border-[#2563eb] shadow-inner"
            />
          </div>
        </div>
      </div>

      <!-- 3. Profil Toko dari PostgreSQL -->
      <div class="w-full bg-white border-b border-[#c8c5c0]">
        <div class="bg-[#f0ede8] px-3 py-1.5 border-b border-[#c8c5c0] flex items-center justify-between text-xs font-bold text-[#2e2b28]">
          <span class="flex items-center gap-1.5">
            <Store class="w-4 h-4 text-[#2563eb]" />
            Identitas Toko (PostgreSQL)
          </span>
          <span class="text-[10px] text-[#2563eb] font-mono">Tersinkronisasi</span>
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

      <!-- 4. Full-Edge Action Button Bar -->
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
