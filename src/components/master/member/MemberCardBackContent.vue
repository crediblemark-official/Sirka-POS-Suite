<script setup lang="ts">
import { Phone } from 'lucide-vue-next';
import { Buyer } from '../../../types';
import { useSettingsStore } from '../../../stores/settingsStore';

defineProps<{
  buyer: Buyer;
  tierClass: {
    bg: string;
    border: string;
    badge: string;
    accent: string;
    glow: string;
  };
  qrDataUrl: string;
  barcodeBars: { width: number; space: number }[];
}>();

const settingsStore = useSettingsStore();
</script>

<template>
  <div
    class="relative w-full h-full rounded-2xl shadow-2xl overflow-hidden text-white border flex flex-col justify-between"
    :class="[
      `bg-gradient-to-br ${tierClass.bg}`,
      tierClass.border,
      tierClass.glow
    ]"
  >
    <!-- Magnetic Stripe -->
    <div class="w-full h-9 bg-neutral-950 border-b border-neutral-800 shadow-inner mt-3"></div>

    <!-- Signature Strip & Real QR Code Section -->
    <div class="px-5 py-2 flex items-center justify-between gap-3 relative z-10 my-auto">
      <!-- Left Info: Signature strip, Terms, and 1D Barcode -->
      <div class="flex-1 space-y-2">
        <!-- Authorized Signature Strip -->
        <div class="flex items-center gap-2">
          <div class="h-6 flex-1 bg-white/90 rounded px-2 flex items-center justify-between shadow-inner">
            <span class="font-cursive italic text-[11px] text-slate-800 font-bold truncate max-w-[120px]">
              {{ buyer.name }}
            </span>
            <span class="font-mono text-[9px] text-slate-400 tracking-wider">
              AUTHORIZED
            </span>
          </div>
          <!-- CVV / Security Digits -->
          <div class="w-10 h-6 bg-white/20 border border-white/30 rounded flex items-center justify-center font-mono text-[10px] font-bold text-amber-300">
            {{ (buyer.memberCardNo || '000').slice(-3) }}
          </div>
        </div>

        <!-- Barcode 1D Simulation -->
        <div class="bg-white/95 p-1 rounded flex flex-col items-center shadow-xs">
          <div class="flex items-end justify-center h-4 w-full gap-[1.5px] px-1">
            <span
              v-for="(b, idx) in barcodeBars"
              :key="idx"
              class="bg-slate-900 inline-block h-full"
              :style="{ width: `${b.width}px` }"
            ></span>
          </div>
          <span class="font-mono text-[8px] text-slate-900 tracking-widest font-black leading-none mt-0.5">
            {{ buyer.memberCardNo || `${settingsStore.storeCode}-0000` }}
          </span>
        </div>

        <!-- Short Disclaimer -->
        <p class="text-[8px] text-white/70 leading-tight">
          Kartu ini diterbitkan oleh {{ settingsStore.storeName || 'Sirka' }}. Scan QR code saat transaksi untuk perolehan poin.
        </p>
      </div>

      <!-- Right Box: REAL QR CODE (Scannable by Camera/Webcam/HP) -->
      <div class="shrink-0 flex flex-col items-center">
        <div class="bg-white p-1 rounded-xl shadow-lg border-2 border-amber-400/80 flex items-center justify-center">
          <img
            v-if="qrDataUrl"
            :src="qrDataUrl"
            alt="Member QR Code"
            class="w-[86px] h-[86px] object-contain rounded-lg"
          />
          <div v-else class="w-[86px] h-[86px] bg-slate-100 flex items-center justify-center text-slate-400 text-[10px]">
            Loading...
          </div>
        </div>
        <span class="text-[8px] font-black uppercase tracking-wider text-amber-300 mt-1">
          Scan QR Member
        </span>
      </div>
    </div>

    <!-- Bottom Back Footer: Store Contact -->
    <div class="px-5 pb-3 pt-1 border-t border-white/10 flex items-center justify-between text-[8px] text-white/60">
      <span class="flex items-center gap-1">
        <Phone :size="9" />
        <span>CS: {{ settingsStore.storePhone || '0812-3456-7890' }}</span>
      </span>
      <span class="font-mono tracking-widest uppercase">ID-1 ISO/IEC 7810</span>
    </div>
  </div>
</template>
