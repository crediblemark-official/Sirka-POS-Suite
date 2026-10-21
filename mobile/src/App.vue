<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { ActiveTab } from './types';
import ReportsCenterView from './views/ReportsCenterView.vue';
import IncomeStatementView from './views/IncomeStatementView.vue';
import CashFlowView from './views/CashFlowView.vue';
import ReceivablesView from './views/ReceivablesView.vue';
import InventoryAssetView from './views/InventoryAssetView.vue';
import SettingsView from './views/SettingsView.vue';
import BottomNav from './components/BottomNav.vue';
import StatusBar from './components/StatusBar.vue';
import { Lock, Delete, Store } from 'lucide-vue-next';

const currentTab = ref<ActiveTab>('reports');

// PIN Lock State
const isLocked = ref(false);
const inputPin = ref('');
const pinError = ref(false);

onMounted(() => {
  const pinEnabled = localStorage.getItem('sirka_owner_pin_enabled') === 'true';
  const pin = localStorage.getItem('sirka_owner_pin');
  if (pinEnabled && pin) {
    isLocked.value = true;
  }
});

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

function checkPin() {
  const savedPin = localStorage.getItem('sirka_owner_pin') || '';
  if (inputPin.value === savedPin) {
    isLocked.value = false;
    inputPin.value = '';
  } else if (inputPin.value.length >= savedPin.length && savedPin.length > 0) {
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
          <div class="w-4 h-4 rounded bg-[#2563eb] text-white flex items-center justify-center">
            <Store :size="10" />
          </div>
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
        <div class="w-10 h-10 rounded-full bg-[#dfddd9] border border-[#c8c5c0] text-[#2563eb] flex items-center justify-center mb-3 shadow-inner">
          <Lock class="w-5 h-5" />
        </div>
        <h2 class="text-sm font-bold tracking-tight text-[#2e2b28]">Kunci Laporan Finansial</h2>
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
      </div>
    </div>
  </div>

  <!-- Main Mobile Financial Reports Shell (Desktop Aesthetic) -->
  <div v-else class="min-h-screen bg-[#ecebe9] text-[#2e2b28] flex flex-col font-sans select-none pb-20">
    <div class="flex-1">
      <ReportsCenterView v-if="currentTab === 'reports'" @navigate="(tab) => currentTab = tab" />
      <IncomeStatementView v-else-if="currentTab === 'income_statement'" />
      <CashFlowView v-else-if="currentTab === 'cash_flow'" />
      <ReceivablesView v-else-if="currentTab === 'receivables'" />
      <InventoryAssetView v-else-if="currentTab === 'inventory_asset'" />
      <SettingsView v-else-if="currentTab === 'settings'" />
    </div>

    <!-- Desktop Style Bottom Navigation -->
    <BottomNav
      :active-tab="currentTab"
      @update:active-tab="(tab) => currentTab = tab"
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
