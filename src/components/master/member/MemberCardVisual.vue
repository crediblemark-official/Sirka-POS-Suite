<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import QRCode from 'qrcode';
import {
  RotateCw,
  CreditCard,
  QrCode as QrIcon,
  Sparkles,
  Download,
  ChevronDown,
  Loader2,
  Image as ImageIcon,
  CheckCircle2,
  Layers
} from 'lucide-vue-next';
import { Buyer } from '../../../types';
import { useSettingsStore } from '../../../stores/settingsStore';
import { exportElementToPng, getMemberCardFilename } from '../../../utils/cardExporter';
import MemberCardFrontContent from './MemberCardFrontContent.vue';
import MemberCardBackContent from './MemberCardBackContent.vue';

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

// Export and Download State
const exportFrontRef = ref<HTMLElement | null>(null);
const exportBackRef = ref<HTMLElement | null>(null);
const exportBothRef = ref<HTMLElement | null>(null);

const isDownloading = ref(false);
const isMenuOpen = ref(false);
const downloadDropdownRef = ref<HTMLElement | null>(null);
const feedbackToast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(msg: string) {
  if (toastTimer) clearTimeout(toastTimer);
  feedbackToast.value = msg;
  toastTimer = setTimeout(() => {
    feedbackToast.value = null;
  }, 3500);
}

function handleClickOutside(event: MouseEvent) {
  if (
    downloadDropdownRef.value &&
    !downloadDropdownRef.value.contains(event.target as Node)
  ) {
    isMenuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  if (toastTimer) clearTimeout(toastTimer);
});

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

// Download Logic
async function downloadSide(side: 'depan' | 'belakang' | 'kedua_sisi' | 'semua_terpisah') {
  isMenuOpen.value = false;
  if (isDownloading.value) return;

  isDownloading.value = true;
  try {
    if (side === 'depan' && exportFrontRef.value) {
      const filename = getMemberCardFilename(props.buyer, 'depan');
      const res = await exportElementToPng(exportFrontRef.value, filename);
      if (res) showToast('✓ Kartu Tampak Depan berhasil diunduh');
    } else if (side === 'belakang' && exportBackRef.value) {
      const filename = getMemberCardFilename(props.buyer, 'belakang');
      const res = await exportElementToPng(exportBackRef.value, filename);
      if (res) showToast('✓ Kartu Tampak Belakang berhasil diunduh');
    } else if (side === 'kedua_sisi' && exportBothRef.value) {
      const filename = getMemberCardFilename(props.buyer, 'kedua_sisi');
      const res = await exportElementToPng(exportBothRef.value, filename);
      if (res) showToast('✓ Kartu Lengkap (2 Sisi) berhasil diunduh');
    } else if (side === 'semua_terpisah' && exportFrontRef.value && exportBackRef.value) {
      const fnFront = getMemberCardFilename(props.buyer, 'depan');
      const fnBack = getMemberCardFilename(props.buyer, 'belakang');
      const res1 = await exportElementToPng(exportFrontRef.value, fnFront);
      if (res1) {
        await new Promise((r) => setTimeout(r, 300));
        const res2 = await exportElementToPng(exportBackRef.value, fnBack);
        if (res2) {
          showToast('✓ 2 File Kartu (Depan & Belakang) berhasil diunduh');
        }
      }
    }
  } catch (err) {
    console.error('Gagal mengunduh kartu member PNG:', err);
    showToast('⚠️ Gagal mengunduh PNG. Silakan coba lagi.');
  } finally {
    isDownloading.value = false;
  }
}

function handleQuickDownload() {
  if (isFlipped.value) {
    downloadSide('belakang');
  } else {
    downloadSide('depan');
  }
}

defineExpose({
  downloadSide,
  handleQuickDownload
});
</script>

<template>
  <div class="flex flex-col items-center relative">
    <!-- Controls (Toggle Tampak Depan / Belakang & Unduh PNG) -->
    <div v-if="showControls" class="flex flex-wrap items-center justify-between w-full max-w-[390px] gap-2 mb-3">
      <!-- Toggle Sisi Depan / Belakang -->
      <div class="bg-slate-200 p-0.5 rounded-lg flex items-center text-xs font-semibold">
        <button
          type="button"
          class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5"
          :class="!isFlipped ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'"
          @click="setSide(false)"
        >
          <CreditCard :size="13" />
          <span>Depan</span>
        </button>
        <button
          type="button"
          class="px-2.5 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5"
          :class="isFlipped ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'"
          @click="setSide(true)"
        >
          <QrIcon :size="13" />
          <span>Belakang (QR)</span>
        </button>
      </div>

      <div class="flex items-center gap-1.5">
        <!-- Rotate / Flip Button -->
        <button
          v-if="interactive"
          type="button"
          class="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-200/70 rounded-md cursor-pointer transition-colors"
          title="Putar / Balik Kartu"
          @click="toggleFlip"
        >
          <RotateCw :size="14" />
        </button>

        <!-- Download PNG Split Button with Dropdown -->
        <div ref="downloadDropdownRef" class="relative">
          <div class="flex items-stretch rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-xs transition-colors">
            <!-- Main Button: Quick Download currently active side -->
            <button
              type="button"
              :disabled="isDownloading"
              class="px-2.5 py-1 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 select-none"
              :title="`Unduh PNG (${isFlipped ? 'Tampak Belakang' : 'Tampak Depan'})`"
              @click="handleQuickDownload"
            >
              <Loader2 v-if="isDownloading" :size="13" class="animate-spin" />
              <Download v-else :size="13" />
              <span>{{ isDownloading ? 'Unduh...' : 'Unduh PNG' }}</span>
            </button>

            <!-- Dropdown Toggle Arrow -->
            <button
              type="button"
              :disabled="isDownloading"
              class="px-1.5 py-1 border-l border-amber-600/30 hover:bg-amber-600/20 rounded-r-lg cursor-pointer transition-colors flex items-center justify-center disabled:opacity-50"
              title="Pilih Opsi Download PNG"
              @click.stop="isMenuOpen = !isMenuOpen"
            >
              <ChevronDown :size="12" :class="{ 'rotate-180': isMenuOpen }" class="transition-transform duration-150" />
            </button>
          </div>

          <!-- Dropdown Menu -->
          <div
            v-if="isMenuOpen"
            class="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-slate-800 text-xs font-medium"
            @click.stop
          >
            <div class="px-3 py-1 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Pilihan Format Unduh PNG (HD)
            </div>

            <!-- Option 1: Tampak Depan -->
            <button
              type="button"
              class="w-full px-3 py-1.5 text-left hover:bg-amber-50/80 flex items-center gap-2.5 cursor-pointer transition-colors"
              @click="downloadSide('depan')"
            >
              <div class="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <CreditCard :size="13" />
              </div>
              <div class="flex-1">
                <div class="font-bold text-slate-800 leading-tight">Tampak Depan</div>
                <div class="text-[10px] text-gray-500">Nama member, No. kartu & Chip</div>
              </div>
            </button>

            <!-- Option 2: Tampak Belakang -->
            <button
              type="button"
              class="w-full px-3 py-1.5 text-left hover:bg-indigo-50/80 flex items-center gap-2.5 cursor-pointer transition-colors"
              @click="downloadSide('belakang')"
            >
              <div class="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <QrIcon :size="13" />
              </div>
              <div class="flex-1">
                <div class="font-bold text-slate-800 leading-tight">Tampak Belakang</div>
                <div class="text-[10px] text-gray-500">QR Code asli & Barcode scan</div>
              </div>
            </button>

            <div class="my-1 border-t border-gray-100"></div>

            <!-- Option 3: Kedua Sisi Berdampingan -->
            <button
              type="button"
              class="w-full px-3 py-1.5 text-left hover:bg-emerald-50/80 flex items-center gap-2.5 cursor-pointer transition-colors"
              @click="downloadSide('kedua_sisi')"
            >
              <div class="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <ImageIcon :size="13" />
              </div>
              <div class="flex-1">
                <div class="font-bold text-slate-800 leading-tight">Kedua Sisi (1 Gambar)</div>
                <div class="text-[10px] text-gray-500">Depan & belakang berdampingan</div>
              </div>
            </button>

            <!-- Option 4: Semua Terpisah (2 File) -->
            <button
              type="button"
              class="w-full px-3 py-1.5 text-left hover:bg-purple-50/80 flex items-center gap-2.5 cursor-pointer transition-colors"
              @click="downloadSide('semua_terpisah')"
            >
              <div class="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Layers :size="13" />
              </div>
              <div class="flex-1">
                <div class="font-bold text-slate-800 leading-tight">Unduh Keduanya (2 File)</div>
                <div class="text-[10px] text-gray-500">File depan & belakang terpisah</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Feedback Notification Toast -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform -translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform -translate-y-2 opacity-0"
    >
      <div
        v-if="feedbackToast"
        class="mb-2 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold shadow-lg flex items-center gap-2 z-20"
      >
        <CheckCircle2 :size="14" class="text-emerald-400 shrink-0" />
        <span>{{ feedbackToast }}</span>
      </div>
    </transition>

    <!-- 3D Flip Card Container -->
    <div
      class="card-scene select-none"
      :class="interactive ? 'cursor-pointer' : ''"
      title="Klik untuk membalik kartu"
      @click="toggleFlip"
    >
      <div class="card-flipper" :class="{ 'is-flipped': isFlipped }">
        <!-- ================= TAMPAK DEPAN (FRONT) ================= -->
        <div class="card-face card-front">
          <MemberCardFrontContent
            :buyer="buyer"
            :tier-class="tierClass"
            :format-member-since="formatMemberSince"
          />
        </div>

        <!-- ================= TAMPAK BELAKANG (BACK) ================= -->
        <div class="card-face card-back">
          <MemberCardBackContent
            :buyer="buyer"
            :tier-class="tierClass"
            :qr-data-url="qrDataUrl"
            :barcode-bars="barcodeBars"
          />
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

    <!-- ================= HIDDEN OFFSCREEN EXPORT CONTAINER ================= -->
    <!-- Elemen flat murni berdimensi presisi (tanpa 3D perspective / rotation) untuk hasil export PNG resolusi tinggi -->
    <div
      class="fixed pointer-events-none -left-[9999px] -top-[9999px] z-[-100] flex flex-col gap-6"
      aria-hidden="true"
    >
      <!-- 1. Single Flat Front Card -->
      <div ref="exportFrontRef" style="width: 390px; height: 225px;" class="overflow-hidden rounded-2xl">
        <MemberCardFrontContent
          :buyer="buyer"
          :tier-class="tierClass"
          :format-member-since="formatMemberSince"
        />
      </div>

      <!-- 2. Single Flat Back Card -->
      <div ref="exportBackRef" style="width: 390px; height: 225px;" class="overflow-hidden rounded-2xl">
        <MemberCardBackContent
          :buyer="buyer"
          :tier-class="tierClass"
          :qr-data-url="qrDataUrl"
          :barcode-bars="barcodeBars"
        />
      </div>

      <!-- 3. Flat Both Sides Side-by-Side (Berdampingan) -->
      <div
        ref="exportBothRef"
        style="width: 840px; padding: 24px;"
        class="bg-slate-900 rounded-3xl flex items-center justify-center gap-6"
      >
        <div style="width: 390px; height: 225px;" class="overflow-hidden rounded-2xl shadow-2xl">
          <MemberCardFrontContent
            :buyer="buyer"
            :tier-class="tierClass"
            :format-member-since="formatMemberSince"
          />
        </div>
        <div style="width: 390px; height: 225px;" class="overflow-hidden rounded-2xl shadow-2xl">
          <MemberCardBackContent
            :buyer="buyer"
            :tier-class="tierClass"
            :qr-data-url="qrDataUrl"
            :barcode-bars="barcodeBars"
          />
        </div>
      </div>
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
