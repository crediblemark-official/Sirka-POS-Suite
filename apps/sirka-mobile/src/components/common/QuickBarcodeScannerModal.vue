<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import jsQR from 'jsqr';
import { Camera, X, AlertCircle } from 'lucide-vue-next';

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'scanned', code: string): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const errorMessage = ref('');
const isScanning = ref(true);

let mediaStream: MediaStream | null = null;
let animId: number | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

function playBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch {
    // Ignore audio errors on unprompted mobile browsers
  }
}

async function startCamera() {
  try {
    errorMessage.value = '';
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });

    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream;
      videoRef.value.setAttribute('playsinline', 'true');
      await videoRef.value.play();
      requestAnimationFrame(scanTick);
    }
  } catch (err: any) {
    errorMessage.value = 'Izin kamera ditolak atau kamera tidak tersedia.';
  }
}

function stopCamera() {
  isScanning.value = false;
  if (animId) cancelAnimationFrame(animId);
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
}

function scanTick() {
  if (!isScanning.value || !videoRef.value) return;

  const video = videoRef.value;
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    if (!canvas) {
      canvas = document.createElement('canvas');
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        playBeep();
        emit('scanned', code.data);
        stopCamera();
        return;
      }
    }
  }

  animId = requestAnimationFrame(scanTick);
}

onMounted(() => {
  startCamera();
});

onUnmounted(() => {
  stopCamera();
});
</script>

<template>
  <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-between p-4 animate-in fade-in duration-200">
    <!-- Top Action Bar -->
    <div class="flex items-center justify-between text-white pt-safe">
      <div class="flex items-center gap-2">
        <Camera class="w-5 h-5 text-amber-400" />
        <span class="font-bold text-sm">Scan Barcode Kamera</span>
      </div>
      <button
        type="button"
        @click="emit('close')"
        class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition cursor-pointer"
      >
        <X class="w-5 h-5 text-white" />
      </button>
    </div>

    <!-- Center Camera Viewfinder -->
    <div class="flex-1 flex flex-col items-center justify-center my-4 relative overflow-hidden rounded-2xl border-2 border-white/20 bg-black">
      <video
        ref="videoRef"
        class="w-full h-full object-cover"
      ></video>

      <!-- Viewfinder Overlay Box -->
      <div class="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div class="w-64 h-64 border-2 border-amber-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
          <div class="absolute inset-x-2 top-0 h-0.5 bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-bounce"></div>
        </div>
      </div>

      <!-- Error Overlay -->
      <div
        v-if="errorMessage"
        class="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center text-white gap-3"
      >
        <AlertCircle class="w-10 h-10 text-rose-500" />
        <p class="text-xs text-rose-200 font-medium">{{ errorMessage }}</p>
        <button
          type="button"
          @click="startCamera"
          class="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold hover:bg-slate-700"
        >
          Coba Lagi
        </button>
      </div>
    </div>

    <!-- Bottom Guide Text -->
    <div class="text-center text-slate-300 pb-safe">
      <p class="text-xs">Arahkan kamera ke barcode produk atau QR Code member</p>
    </div>
  </div>
</template>
