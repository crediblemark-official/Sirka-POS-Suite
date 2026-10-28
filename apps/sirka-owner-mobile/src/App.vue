<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { ActiveTab } from './types';
import ReportsCenterView from './views/ReportsCenterView.vue';
import IncomeStatementView from './views/IncomeStatementView.vue';
import CashFlowView from './views/CashFlowView.vue';
import ReceivablesView from './views/ReceivablesView.vue';
import InventoryAssetView from './views/InventoryAssetView.vue';
import SettingsView from './views/SettingsView.vue';
import BottomNav from './components/BottomNav.vue';
import { Lock, Delete, Store, Fingerprint, KeyRound } from 'lucide-vue-next';
import { useDeviceAuth } from './composables/useDeviceAuth';
import { useNavigation } from './composables/useNavigation';

const { currentTab, navigateTo } = useNavigation();

// BUG FIX (SEC-3): PIN Owner dulu disimpan sebagai TEKS POLA di localStorage.
// Sekarang digantikan Kunci Perangkat (ECDSA non-extractable di IndexedDB) —
// private key tidak bisa dibaca JavaScript mana pun, dan token Worker
// dienkripsi (AES-GCM) sehingga tidak ada rahasia plaintext di perangkat.
const {
  isLocked,
  isBusy,
  errorMessage,
  deviceId,
  authMode,
  biometricAvailable,
  initAuth,
  autoEnrollDeviceKey,
  unlockWithDeviceKey,
  unlockWithPin,
  migratePinToDeviceKey,
  hasPinConfigured,
} = useDeviceAuth();

// PIN lama (hanya untuk mode fallback / migrasi)
const inputPin = ref('');
const pinError = ref(false);

const useDeviceKey = computed(() => authMode.value === 'device');

onMounted(async () => {
  initAuth();
  // BUG FIX (SEC-3): daftar kunci perangkat secara otomatis (tanpa interaksi)
  // supaya token akses Worker SELALU bisa disimpan terenkripsi — tidak pernah
  // ada rahasia plaintext di localStorage.
  await autoEnrollDeviceKey();
});

async function handleDeviceUnlock() {
  const ok = await unlockWithDeviceKey();
  if (!ok) return;
  // Migrasi: hapus PIN (plaintext/hash) & enkripsi token
  if (hasPinConfigured()) {
    await migratePinToDeviceKey();
  }
}

function handlePinInput(num: number) {
  if (inputPin.value.length < 6) {
    inputPin.value += num.toString();
    pinError.value = false;
    checkPin();
  }
}

function handlePinBackspace() {
  inputPin.value = inputPin.value.slice(0, -1);
  pinError.value = false;
}

async function checkPin() {
  const ok = await unlockWithPin(inputPin.value);
  if (ok) {
    inputPin.value = '';
    // Migrasi ke kunci perangkat setelah PIN benar dipakai sekali
    if (hasPinConfigured()) {
      await migratePinToDeviceKey();
    }
  } else {
    pinError.value = true;
    setTimeout(() => {
      inputPin.value = '';
    }, 600);
  }
}
</script>

<template>
  <!-- Desktop Style PIN Lock Dialog Overlay -->
  <div
    v-if="isLocked"
    class="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none"
  >
    <div class="w-full max-w-xs bg-[#ecebe9] border border-[#b8b5af] rounded shadow-2xl overflow-hidden animate-fade-in">
      <!-- Desktop Dialog Titlebar -->
      <div class="h-8 px-3 flex items-center justify-between bg-[#dfddd9] border-b border-[#c8c5c0] text-xs">
        <div class="flex items-center gap-2">
          <img src="/logo.png" alt="Sirka" class="w-4 h-4 rounded object-contain shrink-0" />
          <span class="font-bold text-[#2e2b28]">Keamanan Owner</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="w-2.5 h-2.5 rounded-full bg-[#ef4444]/80 border border-[#dc2626]/40 inline-block"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-[#eab308]/80 border border-[#ca8a04]/40 inline-block"></span>
          <span class="w-2.5 h-2.5 rounded-full bg-[#22c55e]/80 border border-[#16a34a]/40 inline-block"></span>
        </div>
      </div>

      <!-- Dialog Body -->
      <div class="p-4 flex flex-col items-center">
        <img src="/logo.png" alt="Sirka" class="w-12 h-12 rounded-xl object-contain mb-2 shadow-sm" />
        <h2 class="text-sm font-bold tracking-tight text-[#2e2b28]">Sirka Owner</h2>

        <!--
          BUG FIX (SEC-3): tidak ada lagi PIN plaintext di perangkat.
          Unlock memakai Kunci Perangkat (kunci kripto non-extractable milik
          perangkat ini) + konfirmasi kredensial perangkat (sidik jari/pattern
          HP) bila tersedia.
        -->
        <template v-if="useDeviceKey">
          <p class="text-[11px] text-[#6b655f] text-center mt-0.5 mb-4 font-mono">
            {{ biometricAvailable
              ? 'Verifikasi dengan sidik jari / kunci layar HP'
              : 'Buka dengan Kunci Perangkat' }}
          </p>
          <p v-if="deviceId" class="text-[10px] text-[#9a958d] text-center mb-4 font-mono">
            Perangkat: {{ deviceId }}
          </p>

          <button
            type="button"
            :disabled="isBusy"
            class="explorer-btn-primary w-full h-11 rounded text-sm font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            @click="handleDeviceUnlock"
          >
            <KeyRound :size="16" />
            <span>{{ isBusy ? 'Memverifikasi...' : 'Buka dengan Kunci Perangkat' }}</span>
          </button>

          <p v-if="errorMessage" class="text-[11px] text-[#dc2626] font-bold mt-3 font-mono text-center">
            {{ errorMessage }}
          </p>
        </template>

        <!-- Fallback PIN (hanya bila kunci perangkat tidak tersedia) -->
        <template v-else>
        <p class="text-[11px] text-[#6b655f] text-center mt-0.5 mb-4 font-mono">
          Masukkan 4-6 digit PIN Owner
        </p>

        <!-- PIN Dots Indicator -->
        <div class="flex items-center gap-2.5 mb-5" :class="{ 'animate-shake': pinError }">
          <div
            v-for="i in 4"
            :key="i"
            class="w-3.5 h-3.5 rounded-full border border-[#b0aca5] transition-all"
            :class="inputPin.length >= i ? 'bg-[#2563eb] border-[#1d4ed8] scale-105' : 'bg-white'"
          />
        </div>

        <!-- Keypad Numbers (Desktop Bevel Button) -->
        <div class="grid grid-cols-3 gap-2 w-full">
          <button
            v-for="n in [1, 2, 3, 4, 5, 6, 7, 8, 9]"
            :key="n"
            @click="handlePinInput(n)"
            class="explorer-btn h-12 rounded text-base font-bold font-mono active:scale-98 flex items-center justify-center cursor-pointer"
          >
            {{ n }}
          </button>
          <div />
          <button
            @click="handlePinInput(0)"
            class="explorer-btn h-12 rounded text-base font-bold font-mono active:scale-98 flex items-center justify-center cursor-pointer"
          >
            0
          </button>
          <button
            @click="handlePinBackspace"
            class="explorer-btn h-12 rounded text-[#dc2626] active:scale-98 flex items-center justify-center cursor-pointer"
          >
            <Delete class="w-5 h-5" />
          </button>
        </div>

        <p v-if="pinError" class="text-[11px] text-[#dc2626] font-bold mt-3 font-mono">
          PIN salah, coba lagi.
        </p>
        </template>
      </div>
    </div>
  </div>

  <!-- Main Mobile Financial Reports Shell (Desktop Aesthetic) -->
  <div v-else class="min-h-screen bg-[#ecebe9] text-[#2e2b28] flex flex-col font-sans select-none pb-20">
    <div class="flex-1">
      <ReportsCenterView v-if="currentTab === 'reports'" @navigate="navigateTo" />
      <IncomeStatementView v-else-if="currentTab === 'income_statement'" />
      <CashFlowView v-else-if="currentTab === 'cash_flow'" />
      <ReceivablesView v-else-if="currentTab === 'receivables'" />
      <InventoryAssetView v-else-if="currentTab === 'inventory_asset'" />
      <SettingsView v-else-if="currentTab === 'settings'" />
    </div>

    <!-- Desktop Style Bottom Navigation -->
    <BottomNav
      :active-tab="currentTab"
      @update:active-tab="navigateTo"
    />
  </div>
</template>

<style>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}
.animate-shake {
  animation: shake 0.3s ease-in-out;
}
</style>
