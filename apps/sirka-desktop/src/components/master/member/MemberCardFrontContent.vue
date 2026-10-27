<script setup lang="ts">
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
  formatMemberSince: (dateStr?: string) => string;
}>();

const settingsStore = useSettingsStore();
</script>

<template>
  <div
    class="relative w-full h-full rounded-2xl p-5 shadow-2xl overflow-hidden text-white border flex flex-col justify-between"
    :class="[
      `bg-gradient-to-br ${tierClass.bg}`,
      tierClass.border,
      tierClass.glow
    ]"
  >
    <!-- Holographic Sheen Layer -->
    <div class="absolute inset-0 bg-gradient-to-tr from-white/10 via-transparent to-white/5 pointer-events-none"></div>

    <!-- Top Row: Brand & Tier -->
    <div class="flex items-center justify-between relative z-10">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center font-black text-amber-300 text-xs shadow-inner overflow-hidden shrink-0">
          <img
            :src="settingsStore.storeLogo || '/logo.png'"
            alt="Logo Toko"
            class="w-full h-full object-contain p-0.5"
          />
        </div>
        <div>
          <p class="font-black text-xs tracking-wider uppercase leading-none drop-shadow-sm">
            {{ settingsStore.storeName || 'SIRKA' }}
          </p>
          <p class="text-[9px] text-amber-200/90 font-medium tracking-widest mt-0.5">VIP REWARD MEMBER</p>
        </div>
      </div>

      <div
        class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 border"
        :class="tierClass.badge"
      >
        <span>⭐ {{ buyer.tier || 'REGULAR' }}</span>
      </div>
    </div>

    <!-- Middle: EMV Smart Chip & Contactless Wave -->
    <div class="flex items-center gap-3 relative z-10 my-auto">
      <!-- Metallic Chip Simulation -->
      <div class="w-10 h-7 rounded bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 border border-amber-300/80 p-0.5 shadow-inner flex flex-col justify-around">
        <div class="h-0.5 bg-amber-800/40 rounded-full"></div>
        <div class="h-0.5 bg-amber-800/40 rounded-full"></div>
        <div class="h-0.5 bg-amber-800/40 rounded-full"></div>
      </div>

      <!-- Contactless Icon -->
      <svg class="w-5 h-5 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M8.5 16.5a5 5 0 0 1 0-7M12 18a8 8 0 0 0 0-12M15.5 20a11 11 0 0 0 0-16" />
      </svg>
    </div>

    <!-- Bottom: Card Number, Name & Points -->
    <div class="relative z-10 pt-2 border-t border-white/15">
      <!-- Embossed Card Number -->
      <p class="font-mono text-base font-extrabold tracking-widest text-white drop-shadow-md">
        {{ buyer.memberCardNo || `${settingsStore.storeCode}-0000` }}
      </p>

      <div class="flex items-end justify-between mt-1 text-xs">
        <div>
          <p class="text-[8.5px] uppercase tracking-wider text-white/60 font-medium leading-none">
            Pemegang Kartu
          </p>
          <p class="font-bold text-sm tracking-wide text-white truncate max-w-[210px] mt-0.5">
            {{ buyer.name }}
          </p>
        </div>

        <div class="text-right">
          <p v-if="buyer.memberSince" class="text-[9px] text-white/70 font-mono">
            SEJAK: {{ formatMemberSince(buyer.memberSince) }}
          </p>
          <p v-else class="text-[9px] text-white/70 font-mono tracking-wider">
            VALID MEMBER
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
