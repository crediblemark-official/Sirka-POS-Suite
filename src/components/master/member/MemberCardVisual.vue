<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import QRCode from 'qrcode';
import {
  RotateCw,
  CreditCard,
  QrCode as QrIcon,
  Sparkles,
  Phone
} from 'lucide-vue-next';
import { Buyer } from '../../../types';
import { useSettingsStore } from '../../../stores/settingsStore';

const props = withDefaults(
  defineProps<{
    buyer: Buyer;
    modelValue?: boolean; // true = back, false = front
    interactive?: boolean;
    showControls?: boolean;
  }>(),
  {
    modelValue: false,
    interactive: true,
    showControls: true
  }
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const settingsStore = useSettingsStore();
const isFlipped = ref(props.modelValue);
const qrDataUrl = ref<string>('');

watch(
  () => props.modelValue,
  (val) => {
    isFlipped.value = val;
  }
);

function toggleFlip() {
  if (!props.interactive) return;
  isFlipped.value = !isFlipped.value;
  emit('update:modelValue', isFlipped.value);
}

function setSide(back: boolean) {
  isFlipped.value = back;
  emit('update:modelValue', back);
}

// Generate Real QR Code
async function generateQr() {
  const cardNo = props.buyer.memberCardNo || props.buyer.phone || props.buyer.code || `${settingsStore.storeCode}-0000`;
  try {
    qrDataUrl.value = await QRCode.toDataURL(cardNo, {
      width: 260,
      margin: 3,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.warn('Gagal generate QR Code member:', err);
    qrDataUrl.value = '';
  }
}

watch(
  () => props.buyer.memberCardNo,
  () => {
    generateQr();
  },
  { immediate: true }
);

onMounted(() => {
  generateQr();
});

// Pseudo 1D barcode lines generator based on card number
const barcodeBars = computed(() => {
  const str = props.buyer.memberCardNo || `${settingsStore.storeCode}-0000`;
  const bars: { width: number; space: number }[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bars.push({
      width: (code % 3) + 1.5,
      space: ((code >> 1) % 2) + 1
    });
  }
  return bars;
});

function formatMemberSince(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const cleanStr = dateStr.includes(' ') && !dateStr.includes('T') ? dateStr.replace(' ', 'T') : dateStr;
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    return dateStr.slice(0, 10);
  } catch {
    return dateStr.slice(0, 10);
  }
}

const tierClass = computed(() => {
  switch (props.buyer.tier) {
    case 'SILVER':
      return {
        bg: 'from-[#475569] via-[#334155] to-[#1e293b]',
        border: 'border-slate-400/50',
        badge: 'bg-slate-200 text-slate-900 border-white',
        accent: 'text-slate-200',
        glow: 'shadow-slate-500/20'
      };
    case 'GOLD':
      return {
        bg: 'from-[#b45309] via-[#d97706] to-[#78350f]',
        border: 'border-amber-300/50',
        badge: 'bg-amber-300 text-amber-950 border-amber-100',
        accent: 'text-amber-200',
        glow: 'shadow-amber-500/25'
      };
    case 'PLATINUM':
      return {
        bg: 'from-[#581c87] via-[#3b0764] to-[#1e1b4b]',
        border: 'border-purple-400/50',
        badge: 'bg-purple-300 text-purple-950 border-purple-200',
        accent: 'text-purple-200',
        glow: 'shadow-purple-500/30'
      };
    case 'REGULAR':
    default:
      return {
        bg: 'from-[#1e293b] via-[#0f172a] to-[#020617]',
        border: 'border-slate-700',
        badge: 'bg-slate-800 text-slate-300 border-slate-600',
        accent: 'text-amber-300',
        glow: 'shadow-black/40'
      };
  }
});
</script>

<template>
  <div class="flex flex-col items-center">
    <!-- Controls (Toggle Tampak Depan / Belakang) -->
    <div v-if="showControls" class="flex items-center gap-2 mb-3">
      <div class="bg-slate-200 p-0.5 rounded-lg flex items-center text-xs font-semibold">
        <button
          type="button"
          class="px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5"
          :class="!isFlipped ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'"
          @click="setSide(false)"
        >
          <CreditCard :size="13" />
          <span>Tampak Depan</span>
        </button>
        <button
          type="button"
          class="px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5"
          :class="isFlipped ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'"
          @click="setSide(true)"
        >
          <QrIcon :size="13" />
          <span>Tampak Belakang (QR Code)</span>
        </button>
      </div>

      <button
        v-if="interactive"
        type="button"
        class="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200/70 rounded-md cursor-pointer transition-colors"
        title="Putar / Balik Kartu (Klik Kartu)"
        @click="toggleFlip"
      >
        <RotateCw :size="14" />
      </button>
    </div>

    <!-- 3D Flip Card Container -->
    <div
      class="card-scene select-none"
      :class="interactive ? 'cursor-pointer' : ''"
      title="Klik untuk membalik kartu"
      @click="toggleFlip"
    >
      <div class="card-flipper" :class="{ 'is-flipped': isFlipped }">
        <!-- ================= TAMPAK DEPAN (FRONT) ================= -->
        <div
          class="card-face card-front relative w-full h-full rounded-2xl p-5 shadow-2xl overflow-hidden text-white border flex flex-col justify-between"
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
              <div class="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center font-black text-amber-300 text-xs shadow-inner">
                KC
              </div>
              <div>
                <p class="font-black text-xs tracking-wider uppercase leading-none drop-shadow-sm">
                  {{ settingsStore.storeName || 'KASIR CITRA' }}
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

        <!-- ================= TAMPAK BELAKANG (BACK) ================= -->
        <div
          class="card-face card-back relative w-full h-full rounded-2xl shadow-2xl overflow-hidden text-white border flex flex-col justify-between"
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
                Kartu ini diterbitkan oleh {{ settingsStore.storeName || 'Kasir Citra' }}. Scan QR code saat transaksi untuk perolehan poin.
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
      </div>
    </div>

    <!-- Hint footer -->
    <div class="flex items-center gap-1.5 mt-2 text-[10.5px] text-slate-500">
      <Sparkles :size="12" class="text-amber-500" />
      <span>
        {{ isFlipped ? 'Tampak Belakang: Dilengkapi QR Code asli yang siap di-scan kasir.' : 'Tampak Depan: Klik kartu atau tombol di atas untuk melihat tampak belakang.' }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.card-scene {
  width: 390px;
  max-width: 100%;
  height: 225px;
  perspective: 1000px;
}

.card-flipper {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

.card-flipper.is-flipped {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  border-radius: 1rem;
}

.card-front {
  transform: rotateY(0deg);
}

.card-back {
  transform: rotateY(180deg);
}
</style>
