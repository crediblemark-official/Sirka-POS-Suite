<script setup lang="ts">
import { ref, computed, nextTick, watch, onUnmounted } from 'vue';
import jsQR from 'jsqr';
import {
  QrCode,
  ScanLine,
  CreditCard,
  Check,
  AlertCircle,
  Camera,
  CameraOff,
  FlipHorizontal,
  X,
  Sparkles
} from 'lucide-vue-next';
import { Buyer } from '../../types';
import { useBuyerStore } from '../../stores/buyerStore';
import { useModalLock } from '../../composables/useModalLock';

const props = defineProps<{
  isOpen: boolean;
}>();

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka,
// dan scanner PiP otomatis melepas webcam agar tidak tabrakan di Linux.
const modalLock = useModalLock();
modalLock.bind(() => props.isOpen);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', buyer: Buyer): void;
}>();

const buyerStore = useBuyerStore();

const scanInput = ref('');
const scanInputRef = ref<HTMLInputElement | null>(null);
const scanError = ref('');
const scanSuccess = ref('');
const isCameraActive = ref(false);
const isMirrored = ref(false);
const cameraError = ref('');
const scanFramesCount = ref(0);

// Video & in-memory canvas for jsQR
const videoRef = ref<HTMLVideoElement | null>(null);
let mediaStream: MediaStream | null = null;
let animationFrameId: number | null = null;
let scratchCanvas: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;

function playScanSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Ignore audio error
  }
}

const scannedMemberMatch = computed<Buyer | undefined>(() => {
  const q = scanInput.value.trim().toUpperCase();
  if (!q) return undefined;

  // BUG FIX: pencocokan fuzzy dengan 1 karakter bisa memilih member yang SALAH
  // (mis. mengetik "A" langsung memilih anggota pertama yang namanya
  // mengandung "A") -> tier diskon & poin yang dipakai salah pelanggan.
  // Pencocokan substring hanya boleh mulai dari minimal 3 karakter; nomor
  ///kode / telepon tetap boleh lebih pendek.
  const MIN_SUBSTRING_LEN = 3;
  const allowSubstring = q.length >= MIN_SUBSTRING_LEN;

  return buyerStore.buyers.find(b => {
    const isMbr = Boolean(b.memberCardNo);
    const card = (b.memberCardNo || '').toUpperCase();
    const phone = (b.phone || '').toUpperCase();
    const code = (b.code || '').toUpperCase();
    const name = (b.name || '').toUpperCase();
    if (!isMbr) return false;

    if (card === q || phone === q || code === q) return true;
    if (!allowSubstring) return false;
    return card.includes(q) || q.includes(card) || name.includes(q);
  });
});

function handleGlobalKeydown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    handleClose();
  }
}

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      window.addEventListener('keydown', handleGlobalKeydown);
      scanInput.value = '';
      scanError.value = '';
      scanSuccess.value = '';
      cameraError.value = '';
      isCameraActive.value = false;

      // Cek apakah komputer memiliki webcam terpasang
      let hasWebcam = false;
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          hasWebcam = devices.some(d => d.kind === 'videoinput');
        } catch (e) {
          console.warn('Gagal mendeteksi daftar webcam:', e);
        }
      }

      if (hasWebcam) {
        // Beri jeda 150ms agar stream kamera background (PosScannerPiP)
        // telah melepaskan handle /dev/video0 di Linux secara tuntas
        setTimeout(async () => {
          if (props.isOpen) {
            await startWebcamScanner();
          }
        }, 150);
      } else {
        // Jika tidak ada webcam, langsung fokuskan kursor ke input tembak barcode / keyboard
        setTimeout(() => {
          scanInputRef.value?.focus();
        }, 100);
      }
    } else {
      window.removeEventListener('keydown', handleGlobalKeydown);
      stopWebcamScanner();
    }
  }
);

async function handleClose() {
  stopWebcamScanner();
  emit('close');
}

async function toggleWebcamScanner() {
  if (isCameraActive.value) {
    stopWebcamScanner();
  } else {
    await startWebcamScanner();
  }
}

async function startWebcamScanner() {
  cameraError.value = '';
  isCameraActive.value = true;
  scanFramesCount.value = 0;
  await nextTick();

  try {
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      // Fallback tanpa constraint khusus
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }

    mediaStream = stream;
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      videoRef.value.setAttribute('playsinline', 'true');
      await videoRef.value.play();
      startScanLoop();
      setTimeout(() => {
        scanInputRef.value?.focus();
      }, 150);
    }
  } catch (err: any) {
    console.warn('Webcam start error:', err);
    const msg = String(err?.message || err || '');
    if (msg.includes('NotAllowedError') || msg.includes('PermissionDeniedError') || msg.includes('not allowed')) {
      cameraError.value = 'Izin kamera belum diizinkan oleh sistem operasi atau pengguna. Anda dapat menggunakan Barcode Scanner USB atau ketik no kartu.';
    } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
      cameraError.value = 'Tidak ada perangkat webcam yang terdeteksi di komputer kasir ini.';
    } else {
      cameraError.value = err?.message || 'Gagal mengakses webcam. Silakan tembak dengan Scanner USB.';
    }
    isCameraActive.value = false;
    setTimeout(() => {
      scanInputRef.value?.focus();
    }, 150);
  }
}

let scanCanvas: HTMLCanvasElement | null = null;
let scanCtx: CanvasRenderingContext2D | null = null;

function startScanLoop() {
  if (!scanCanvas) {
    scanCanvas = document.createElement('canvas');
    scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (!scratchCanvas) {
    scratchCanvas = document.createElement('canvas');
    scratchCtx = scratchCanvas.getContext('2d', { willReadFrequently: true });
  }

  let lastScan = 0;

  const tick = () => {
    if (!isCameraActive.value) return;

    try {
      const video = videoRef.value;

      // Cukup cek videoWidth > 0 dan tidak paused (tidak tergantung HAVE_ENOUGH_DATA di WebKit Linux)
      if (video && video.videoWidth > 0 && !video.paused && scanCtx && scanCanvas) {
        const now = performance.now();
        // Cek frame setiap ~30ms (~33 fps)
        if (now - lastScan >= 30) {
          lastScan = now;
          scanFramesCount.value++;

          // Gunakan resolusi optimal (maksimal 720px) agar jsQR membaca instan tanpa lag
          const targetWidth = Math.min(720, video.videoWidth);
          const scale = targetWidth / video.videoWidth;
          const targetHeight = Math.floor(video.videoHeight * scale);

          scanCanvas.width = targetWidth;
          scanCanvas.height = targetHeight;
          scanCtx.drawImage(video, 0, 0, targetWidth, targetHeight);

          const imageData = scanCtx.getImageData(0, 0, targetWidth, targetHeight);

          // 1. Coba decode normal
          let code = jsQR(imageData.data, targetWidth, targetHeight, {
            inversionAttempts: 'attemptBoth'
          });

          // 2. Jika belum terdeteksi (misal kamera selfie/mirror Linux), coba decode versi cermin
          if (!code && scratchCanvas && scratchCtx) {
            scratchCanvas.width = targetWidth;
            scratchCanvas.height = targetHeight;
            scratchCtx.save();
            scratchCtx.translate(targetWidth, 0);
            scratchCtx.scale(-1, 1);
            scratchCtx.drawImage(scanCanvas, 0, 0);
            scratchCtx.restore();

            const flippedData = scratchCtx.getImageData(0, 0, targetWidth, targetHeight);
            code = jsQR(flippedData.data, targetWidth, targetHeight, {
              inversionAttempts: 'attemptBoth'
            });
          }

          if (code && code.data && code.data.trim()) {
            console.log('[jsQR] ✅ QR CODE TERBACA:', code.data);
            handleOnCameraScanned(code.data.trim());
            return; // Berhenti loop setelah ketemu
          }
        }
      }
    } catch (loopErr) {
      console.warn('Frame processing loop error:', loopErr);
    }

    animationFrameId = requestAnimationFrame(tick);
  };

  animationFrameId = requestAnimationFrame(tick);
}

function stopWebcamScanner() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null;
  }
  isCameraActive.value = false;
  cameraError.value = '';
}

function handleOnCameraScanned(decodedText: string) {
  if (!decodedText) return;
  const clean = decodedText.trim().toUpperCase();
  scanInput.value = clean;
  console.log('[Member Scanner] Hasil decode:', clean);

  const match = buyerStore.buyers.find(b => {
    const card = (b.memberCardNo || '').toUpperCase();
    const phone = (b.phone || '').toUpperCase();
    const code = (b.code || '').toUpperCase();
    const name = (b.name || '').toUpperCase();
    return (
      (card && (card === clean || clean.includes(card) || card.includes(clean))) ||
      (phone && phone === clean) ||
      (code && code === clean) ||
      (name && name === clean)
    );
  });

  if (match) {
    handleApplyMember(match);
  } else {
    playScanSound();
    scanError.value = `Kode terdeteksi: "${decodedText}", namun belum terdaftar di data member.`;
  }
}

function handleApplyMember(buyer?: Buyer) {
  const target = buyer || scannedMemberMatch.value;
  if (!target || !target.memberCardNo) {
    scanError.value = 'Kartu member tidak ditemukan. Periksa nomor kartu atau nomor HP.';
    return;
  }

  playScanSound();
  scanSuccess.value = `Member ${target.name} (${target.memberCardNo}) terpasang!`;
  stopWebcamScanner();
  setTimeout(() => {
    emit('select', target);
  }, 350);
}

function handleScanInputKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    handleClose();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    if (scannedMemberMatch.value) {
      handleApplyMember(scannedMemberMatch.value);
    } else {
      scanError.value = `Tidak ditemukan member dengan nomor / nama "${scanInput.value}".`;
    }
  }
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  stopWebcamScanner();
});

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => props.isOpen);
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none text-xs"
    @click.self="handleClose"
  >
    <div class="bg-white rounded-xl shadow-2xl border border-gray-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <!-- Header -->
      <div class="px-4 py-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
        <div class="flex items-center gap-2">
          <QrCode :size="17" class="text-amber-400" />
          <div>
            <h3 class="font-bold text-xs tracking-tight">Scan Kartu Member Kasir</h3>
            <p class="text-[10px] text-indigo-200">Tembak scanner USB atau arahkan QR ke kamera webcam</p>
          </div>
        </div>
        <button type="button" class="p-1 text-slate-400 hover:text-white cursor-pointer" @click="handleClose">
          <X :size="16" />
        </button>
      </div>

      <div class="p-4 space-y-3.5">
        <!-- Input Barcode Scanner USB / Manual (Autofocus Utama) -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="font-bold text-gray-700 block text-[11px]">
              Tembak Barcode USB / Ketik No. Kartu:
            </label>
            <button
              type="button"
              class="text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors px-2 py-0.5 rounded border"
              :class="isCameraActive ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'"
              @click="toggleWebcamScanner"
            >
              <Camera :size="12" />
              <span>{{ isCameraActive ? 'Tutup Kamera' : 'Buka Kamera Webcam' }}</span>
            </button>
          </div>

          <div class="relative">
            <input
              ref="scanInputRef"
              v-model="scanInput"
              type="text"
              class="w-full bg-slate-50 border-2 border-amber-500 rounded-lg px-3 py-2 pl-9 font-mono font-black text-sm text-slate-900 tracking-wider outline-none focus:bg-white uppercase shadow-inner"
              placeholder="Scan barcode kartu atau ketik No. HP..."
              @keydown="handleScanInputKeydown"
            />
            <ScanLine :size="16" class="absolute left-3 top-3 text-amber-600 animate-pulse" />
          </div>
          <span class="text-[10px] text-gray-500 mt-1 block">
            💡 Tembak barcode scanner USB ke sini atau ketik nomor lalu tekan <strong>Enter</strong>.
          </span>
        </div>

        <!-- Live Webcam Feed (Muncul langsung saat tombol Buka Kamera ditekan) -->
        <div v-show="isCameraActive" class="space-y-1.5 animate-in fade-in duration-150">
          <div class="relative w-full h-64 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border-2 border-slate-700 shadow-inner">
            <!-- Native HTML5 Video Element -->
            <video
              ref="videoRef"
              class="w-full h-full object-cover transition-transform duration-200"
              :class="isMirrored ? '-scale-x-100' : ''"
              playsinline
              muted
            ></video>

            <!-- Live Status Badge & Frame Counter -->
            <div class="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 px-2 py-1 bg-black/70 backdrop-blur-xs text-white rounded-md border border-white/10 font-mono text-[10px]">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span class="font-bold text-emerald-300">Scanner Aktif</span>
              <span class="text-white/40">|</span>
              <span class="text-amber-300">Scan: {{ scanFramesCount }} frame</span>
            </div>

            <!-- Mirror / Flip Button -->
            <button
              v-if="!cameraError"
              type="button"
              class="absolute top-2.5 right-2.5 z-20 px-2 py-1 bg-black/70 hover:bg-black/90 text-white rounded-md font-medium text-[10px] flex items-center gap-1 cursor-pointer transition-colors backdrop-blur-xs border border-white/20 shadow-md"
              :title="isMirrored ? 'Tampilan Normal' : 'Balikkan Tampilan (Mirror)'"
              @click="isMirrored = !isMirrored"
            >
              <FlipHorizontal :size="12" />
              <span>{{ isMirrored ? 'Normal' : 'Mirror' }}</span>
            </button>

            <!-- Active Viewfinder Box with 4 Glowing Corners -->
            <div class="pointer-events-none absolute inset-8 border border-white/20 rounded-xl flex items-center justify-center overflow-hidden">
              <!-- Corner Brackets -->
              <div class="absolute top-0 left-0 w-5 h-5 border-t-3 border-l-3 border-amber-400 rounded-tl-lg"></div>
              <div class="absolute top-0 right-0 w-5 h-5 border-t-3 border-r-3 border-amber-400 rounded-tr-lg"></div>
              <div class="absolute bottom-0 left-0 w-5 h-5 border-b-3 border-l-3 border-amber-400 rounded-bl-lg"></div>
              <div class="absolute bottom-0 right-0 w-5 h-5 border-b-3 border-r-3 border-amber-400 rounded-br-lg"></div>

              <!-- Animated Sweeping Laser Scanner Line -->
              <div class="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#fbbf24] animate-laser"></div>
            </div>

            <!-- Camera Error Overlay -->
            <div v-if="cameraError" class="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-rose-300 p-4 text-center space-y-2 z-30">
              <CameraOff :size="26" class="text-rose-400" />
              <span class="text-xs font-semibold leading-relaxed">{{ cameraError }}</span>
              <button
                type="button"
                class="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold text-xs cursor-pointer shadow-md transition-all active:scale-95"
                @click="startWebcamScanner"
              >
                Coba Sambungkan Lagi
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between text-[10.5px] text-gray-500 px-1">
            <span class="flex items-center gap-1 text-slate-600 font-medium">
              <Sparkles :size="12" class="text-amber-500" />
              <span>Arahkan QR Code kartu ke dalam kotak bidik</span>
            </span>
            <span class="font-mono text-emerald-600 font-bold">Auto-Detect ON</span>
          </div>
        </div>

        <!-- Error / Success Alert -->
        <div v-if="scanError" class="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
          <AlertCircle :size="14" class="shrink-0" />
          <span>{{ scanError }}</span>
        </div>

        <div v-if="scanSuccess" class="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
          <Check :size="14" class="shrink-0" />
          <span>{{ scanSuccess }}</span>
        </div>

        <!-- Matched Card Preview (Live Feedback) -->
        <div
          v-if="scannedMemberMatch"
          class="p-3 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-lg border border-amber-400/40 shadow-md space-y-2"
        >
          <div class="flex items-center justify-between">
            <span class="font-mono font-bold text-amber-300 text-xs flex items-center gap-1">
              <CreditCard :size="13" />
              <span>{{ scannedMemberMatch.memberCardNo }}</span>
            </span>
            <span
              class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
              :class="{
                'bg-slate-700 text-slate-200': scannedMemberMatch.tier === 'REGULAR',
                'bg-slate-200 text-slate-900': scannedMemberMatch.tier === 'SILVER',
                'bg-amber-400 text-amber-950': scannedMemberMatch.tier === 'GOLD',
                'bg-purple-300 text-purple-950': scannedMemberMatch.tier === 'PLATINUM'
              }"
            >
              ⭐ {{ scannedMemberMatch.tier || 'REGULAR' }}
            </span>
          </div>

          <div>
            <p class="font-black text-sm text-white">{{ scannedMemberMatch.name }}</p>
            <p class="text-[10.5px] text-slate-300">
              {{ scannedMemberMatch.phone ? `Telp: ${scannedMemberMatch.phone}` : 'No Telp: -' }}
              • {{ scannedMemberMatch.customerType === 'B2B' ? 'Grosir (B2B)' : 'Eceran (B2C)' }}
            </p>
          </div>

          <div class="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
            <span class="text-amber-400 font-mono font-bold">
              {{ scannedMemberMatch.points || 0 }} Poin
            </span>
            <button
              type="button"
              class="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs cursor-pointer shadow-xs transition-all active:scale-95 flex items-center gap-1"
              @click="handleApplyMember(scannedMemberMatch)"
            >
              <Check :size="12" />
              <span>Pasang Kartu Ini</span>
            </button>
          </div>
        </div>

        <!-- Quick Member List Suggestions (If input empty and camera inactive) -->
        <div v-else-if="!scanInput.trim() && !isCameraActive" class="space-y-1.5">
          <span class="text-[11px] text-gray-500 font-semibold block">Member Terdaftar Terakhir:</span>
          <div class="max-h-32 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
            <button
              v-for="b in buyerStore.memberBuyers.slice(0, 5)"
              :key="b.id"
              type="button"
              class="w-full px-2.5 py-1.5 text-left hover:bg-amber-50/50 flex items-center justify-between cursor-pointer transition-colors"
              @click="handleApplyMember(b)"
            >
              <div>
                <span class="font-bold text-gray-800 text-xs block">{{ b.name }}</span>
                <span class="font-mono text-[10px] text-gray-400">{{ b.memberCardNo }} • {{ b.phone || '-' }}</span>
              </div>
              <div class="text-right">
                <span class="font-mono text-[10px] font-bold text-amber-700 block">{{ b.points || 0 }} Poin</span>
                <span class="text-[9px] text-slate-500 font-semibold uppercase">{{ b.tier || 'REGULAR' }}</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Footer Buttons -->
        <div class="flex items-center justify-between pt-2 border-t border-gray-200">
          <button
            type="button"
            class="text-[11px] text-gray-500 hover:text-gray-800 cursor-pointer"
            @click="handleClose"
          >
            Batal (Esc)
          </button>
          <button
            type="button"
            class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors flex items-center gap-1"
            :disabled="!scannedMemberMatch"
            @click="handleApplyMember(scannedMemberMatch)"
          >
            <Check :size="13" />
            <span>Gunakan Member</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes laserSweep {
  0% {
    transform: translateY(-80px);
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(80px);
    opacity: 0.2;
  }
}

.animate-laser {
  animation: laserSweep 2s ease-in-out infinite alternate;
}
</style>
