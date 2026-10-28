<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  HTMLCanvasElementLuminanceSource,
  NotFoundException
} from '@zxing/library';
import { usePosStore } from '../../stores/posStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { isAnyModalOpen } from '../../composables/useModalLock';
import { formatRupiah } from '../../utils/formatters';
import type { Product } from '@sirka/shared-types';
import {
  Camera,
  CameraOff,
  Minimize2,
  Maximize2,
  RefreshCw,
  Power,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Volume2,
  VolumeX,
  Zap,
  ScanLine
} from 'lucide-vue-next';

// BUG FIX: Patch @zxing/library v0.23.0 bug di mana NotFoundException memicu console.warn banjir ribuan baris
(MultiFormatReader.prototype as any).decodeInternal = function (this: any, image: any) {
  if (!this.readers) throw new NotFoundException('No readers configured');
  for (const reader of this.readers) {
    try {
      return reader.decode(image, this.hints);
    } catch {
      continue;
    }
  }
  throw new NotFoundException('No barcode found');
};

const props = withDefaults(
  defineProps<{
    isActive?: boolean;
    isMobile?: boolean;
  }>(),
  {
    isActive: true,
    isMobile: true
  }
);

const emit = defineEmits<{
  (e: 'scan-success', product: Product): void;
  (e: 'scan-not-found', code: string): void;
}>();

const posStore = usePosStore();
const inventoryStore = useInventoryStore();

// Native Video Reference
const videoRef = ref<HTMLVideoElement | null>(null);

// State
const isCameraEnabled = ref(localStorage.getItem('sirka_scanner_camera_enabled') !== 'false');
const isMinimized = ref(localStorage.getItem('sirka_scanner_pip_minimized') === 'true');
const isSoundEnabled = ref(localStorage.getItem('sirka_scanner_sound_enabled') !== 'false');

// Kamera Depan (User) vs Belakang (Environment) di Mobile
const savedFacing = (localStorage.getItem('sirka_scanner_facing_mode') as 'user' | 'environment') || 'environment';
const facingMode = ref<'user' | 'environment'>(savedFacing);
// Mirror otomatis: Kamera depan (selfie) SELALU mirror, kamera belakang normal
const isMirrored = ref(facingMode.value === 'user');

const isTorchOn = ref(false);
const isTorchAvailable = ref(false);

const isScanning = ref(false);
const isStarting = ref(false);
const errorMessage = ref('');
const availableCameras = ref<Array<{ id: string; label: string }>>([]);
const selectedCameraId = ref<string>('');
const isSuccessFlashing = ref(false);
const isErrorFlashing = ref(false);

const recentScan = ref<{
  success: boolean;
  name: string;
  code: string;
  price: number;
  unit?: string;
  time: number;
} | null>(null);

let zxingReader: MultiFormatReader | null = null;
let nativeBarcodeDetector: any = null;
let scanCanvas: HTMLCanvasElement | null = null;
let scanCtx: CanvasRenderingContext2D | null = null;
let scanIntervalId: any = null;
let isScanBusy = false;
let currentStream: MediaStream | null = null;
let lastScannedCode = '';
let lastScannedAt = 0;
let clearLastCodeTimer: any = null;
let recentScanTimer: any = null;

// Hardware Barcode Scanner Keyboard Wedge Listener (OTG scanner / Bluetooth Barcode)
let barcodeBuffer = '';
let lastKeyTime = 0;

// Format Barcode Retail yang didukung (Format 1D upfront agar respon kilat)
const barcodeHints = new Map<DecodeHintType, any>();
barcodeHints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.QR_CODE
]);

function playAudioChime(type: 'success' | 'error' = 'success') {
  if (!isSoundEnabled.value) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.08);
    } else {
      const now = audioCtx.currentTime;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(240, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);
      osc.start(now);
      osc.stop(now + 0.11);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(180, now + 0.13);
      gain2.gain.setValueAtTime(0.25, now + 0.13);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
      osc2.start(now + 0.13);
      osc2.stop(now + 0.28);
    }
  } catch {
    // Audio autoplay block ignore
  }
}

function processBarcode(rawCode: string) {
  const code = (rawCode || '').trim();
  if (!code) return;

  const prods = inventoryStore.products;

  // 1. Match product barcode
  let found = prods.find(p => (p.barcode || '').trim().toLowerCase() === code.toLowerCase());
  let foundUnit: string | undefined;

  // 2. Match packaging unit barcode (e.g. DUS / RENCENG)
  if (!found) {
    for (const p of prods) {
      const u = (p.units || []).find(unit => (unit.barcode || '').trim().toLowerCase() === code.toLowerCase());
      if (u) {
        found = p;
        foundUnit = u.unitName;
        break;
      }
    }
  }

  // 3. Match SKU / Code
  if (!found) {
    found = prods.find(p => (p.code || '').trim().toLowerCase() === code.toLowerCase());
  }

  // 4. Match ID
  if (!found) {
    found = prods.find(p => p.id === code);
  }

  if (found) {
    playAudioChime('success');
    isSuccessFlashing.value = true;
    setTimeout(() => {
      isSuccessFlashing.value = false;
    }, 450);

    if (foundUnit) {
      posStore.addProductToCart(found, 1, foundUnit);
    } else {
      posStore.addProductToCart(found, 1);
    }

    const price = foundUnit
      ? ((found.units || []).find((u: any) => u.unitName === foundUnit)?.sellPrice || found.lastSellPrice || 0)
      : (found.lastSellPrice || 0);

    recentScan.value = {
      success: true,
      name: found.name,
      code,
      price,
      unit: foundUnit,
      time: Date.now()
    };

    emit('scan-success', found);
  } else {
    playAudioChime('error');
    isErrorFlashing.value = true;
    setTimeout(() => {
      isErrorFlashing.value = false;
    }, 600);

    recentScan.value = {
      success: false,
      name: 'Produk Tidak Ditemukan',
      code,
      price: 0,
      time: Date.now()
    };
    emit('scan-not-found', code);
  }

  if (recentScanTimer) clearTimeout(recentScanTimer);
  recentScanTimer = setTimeout(() => {
    recentScan.value = null;
  }, 4000);
}

function handleCodeDetected(rawCode: string) {
  const code = (rawCode || '').trim();
  if (!code) return;

  const now = Date.now();
  // Anti-double scan cooldown (1.0 detik untuk produk yang sama persis, tanpa jeda jika produk berbeda)
  if (code === lastScannedCode && now - lastScannedAt < 1000) {
    return;
  }

  lastScannedCode = code;
  lastScannedAt = now;

  if (clearLastCodeTimer) clearTimeout(clearLastCodeTimer);
  clearLastCodeTimer = setTimeout(() => {
    lastScannedCode = '';
  }, 1800);

  processBarcode(code);
}

// Hardware Barcode Scanner listener (USB / Bluetooth Keyboard Wedge di Android / Tablet)
function handleGlobalKeydown(e: KeyboardEvent) {
  if (!props.isActive) return;

  const target = e.target as HTMLElement | null;
  const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

  const now = Date.now();
  const timeDiff = now - lastKeyTime;
  lastKeyTime = now;

  if (e.key === 'Enter') {
    if (barcodeBuffer.length >= 3 && timeDiff < 90) {
      const scannedCode = barcodeBuffer.trim();
      barcodeBuffer = '';
      if (isInput) {
        (target as HTMLInputElement).value = '';
        target.blur();
      }
      e.preventDefault();
      e.stopPropagation();
      handleCodeDetected(scannedCode);
    } else {
      barcodeBuffer = '';
    }
    return;
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    if (timeDiff > 90) {
      barcodeBuffer = e.key;
    } else {
      barcodeBuffer += e.key;
    }
  }
}

async function initializeCameras() {
  try {
    errorMessage.value = '';
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices
      .filter(d => d.kind === 'videoinput')
      .map(d => ({ id: d.deviceId, label: d.label || 'Kamera' }));

    if (videoDevices.length > 0) {
      availableCameras.value = videoDevices;
    } else {
      errorMessage.value = 'Tidak ada perangkat kamera terdeteksi.';
    }
  } catch (err: any) {
    console.warn('Gagal membaca daftar kamera mobile:', err);
  }
}

function initReaders() {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      nativeBarcodeDetector = new (window as any).BarcodeDetector({
        formats: [
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'code_128',
          'code_39',
          'code_93',
          'qr_code'
        ]
      });
    } catch {
      nativeBarcodeDetector = null;
    }
  }

  if (!zxingReader) {
    zxingReader = new MultiFormatReader();
    zxingReader.setHints(barcodeHints);
  }

  if (!scanCanvas) {
    scanCanvas = document.createElement('canvas');
    scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
  }
}

function startScanLoop() {
  stopScanLoop();
  initReaders();

  // Scan loop 60ms (~16 fps)
  scanIntervalId = setInterval(async () => {
    if (isScanBusy || !isScanning.value) return;
    const video = videoRef.value;
    if (!video || video.paused || video.ended || video.videoWidth === 0) return;

    isScanBusy = true;
    try {
      // 1. Native Hardware BarcodeDetector (Sangat cepat & akurat di Android WebView)
      if (nativeBarcodeDetector) {
        try {
          const detected = await nativeBarcodeDetector.detect(video);
          if (detected && detected.length > 0) {
            const raw = detected[0].rawValue?.trim();
            if (raw) {
              handleCodeDetected(raw);
              return;
            }
          }
        } catch {
          // fallback ke zxing jika native error di frame tertentu
        }
      }

      // 2. ZXing Reader Fallback
      if (zxingReader && scanCanvas && scanCtx) {
        const targetWidth = Math.min(800, video.videoWidth);
        const scale = targetWidth / video.videoWidth;
        const targetHeight = Math.floor(video.videoHeight * scale);

        scanCanvas.width = targetWidth;
        scanCanvas.height = targetHeight;
        scanCtx.drawImage(video, 0, 0, targetWidth, targetHeight);

        const luminanceSource = new HTMLCanvasElementLuminanceSource(scanCanvas);
        let result: any = null;

        // Coba 1: HybridBinarizer
        try {
          const bitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
          result = zxingReader.decodeWithState(bitmap);
        } catch {
          // Coba 2: GlobalHistogramBinarizer (ampuh untuk barcode 1D di berbagai kondisi cahaya)
          try {
            const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(luminanceSource));
            result = zxingReader.decodeWithState(bitmap);
          } catch {
            // Frame tanpa barcode (senyap)
          }
        }

        if (result && result.getText()) {
          const text = result.getText().trim();
          if (text) {
            handleCodeDetected(text);
          }
        }
      }
    } catch {
      // error frame senyap
    } finally {
      if (zxingReader) {
        try { zxingReader.reset(); } catch {}
      }
      isScanBusy = false;
    }
  }, 60);
}

function stopScanLoop() {
  if (scanIntervalId) {
    clearInterval(scanIntervalId);
    scanIntervalId = null;
  }
  isScanBusy = false;
}

async function startCameraScanner() {
  if (isStarting.value || isScanning.value || !isCameraEnabled.value || !props.isActive || isAnyModalOpen.value) return;

  isStarting.value = true;
  errorMessage.value = '';

  await nextTick();
  if (!videoRef.value) {
    isStarting.value = false;
    return;
  }

  try {
    initReaders();

    const videoConstraints: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 }
    };

    if (selectedCameraId.value) {
      videoConstraints.deviceId = { exact: selectedCameraId.value };
    } else {
      videoConstraints.facingMode = { ideal: facingMode.value };
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false
      });
    } catch {
      // Fallback tanpa resolusi spesifik
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode.value } },
        audio: false
      });
    }

    currentStream = stream;

    // Pasang stream ke video native tanpa autoplay ganda
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      videoRef.value.setAttribute('playsinline', 'true');
      videoRef.value.muted = true;
      try {
        await videoRef.value.play();
      } catch (playErr) {
        console.warn('Mobile video play caught:', playErr);
      }
    }

    isScanning.value = true;
    checkTorchSupport();

    // Coba aktifkan continuous autofocus jika hardware kamera mendukungnya
    try {
      const track = stream.getVideoTracks()?.[0];
      if (track) {
        const capabilities = (track as any).getCapabilities?.();
        if (capabilities?.focusMode?.includes('continuous')) {
          await (track as any).applyConstraints?.({
            advanced: [{ focusMode: 'continuous' }]
          });
        }
      }
    } catch {
      // Focus opsional
    }

    startScanLoop();
  } catch (err: any) {
    console.error('Gagal mengakses video kamera mobile:', err);
    errorMessage.value = 'Gagal mengakses video kamera.';
    isScanning.value = false;
  } finally {
    isStarting.value = false;
  }
}

async function stopCameraScanner() {
  try {
    stopScanLoop();
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
    if (videoRef.value) {
      videoRef.value.srcObject = null;
    }
  } catch (err) {
    console.warn('Cleanup error saat stop mobile scanner:', err);
  } finally {
    isScanning.value = false;
    isTorchOn.value = false;
    isTorchAvailable.value = false;
  }
}

function checkTorchSupport() {
  if (!currentStream) {
    isTorchAvailable.value = false;
    return;
  }
  try {
    const track = currentStream.getVideoTracks()?.[0];
    const capabilities = (track as any)?.getCapabilities?.();
    isTorchAvailable.value = !!capabilities?.torch;
  } catch {
    isTorchAvailable.value = false;
  }
}

async function toggleTorch() {
  if (!currentStream || !isTorchAvailable.value) return;
  try {
    const track = currentStream.getVideoTracks()?.[0];
    if (track) {
      isTorchOn.value = !isTorchOn.value;
      await (track as any).applyConstraints({
        advanced: [{ torch: isTorchOn.value }]
      });
    }
  } catch (err) {
    console.warn('Torch error:', err);
  }
}

async function flipCameraMobile() {
  if (isStarting.value) return;

  const nextMode = facingMode.value === 'environment' ? 'user' : 'environment';
  facingMode.value = nextMode;
  localStorage.setItem('sirka_scanner_facing_mode', nextMode);

  // Kamera depan (selfie/webcam) otomatis mirror cermin, kamera belakang normal
  isMirrored.value = (nextMode === 'user');
  selectedCameraId.value = '';

  await stopCameraScanner();
  await startCameraScanner();
}

function togglePower() {
  isCameraEnabled.value = !isCameraEnabled.value;
  localStorage.setItem('sirka_scanner_camera_enabled', isCameraEnabled.value ? 'true' : 'false');
  if (isCameraEnabled.value) {
    startCameraScanner();
  } else {
    stopCameraScanner();
  }
}

function toggleMinimize() {
  isMinimized.value = !isMinimized.value;
  localStorage.setItem('sirka_scanner_pip_minimized', isMinimized.value ? 'true' : 'false');
}

function toggleSound() {
  isSoundEnabled.value = !isSoundEnabled.value;
  localStorage.setItem('sirka_scanner_sound_enabled', isSoundEnabled.value ? 'true' : 'false');
}

// Koordinasi Kamera dengan Modal (seperti Scan Kartu Member)
watch(isAnyModalOpen, async (modalOpen) => {
  if (modalOpen) {
    // Bebaskan kamera saat modal scan member aktif
    await stopCameraScanner();
  } else if (props.isActive && isCameraEnabled.value) {
    // Ambil kembali kamera saat modal selesai dengan jeda 150ms agar device dilepas
    setTimeout(async () => {
      if (!isAnyModalOpen.value && props.isActive && isCameraEnabled.value) {
        await startCameraScanner();
      }
    }, 150);
  }
});

watch(
  () => props.isActive,
  async (active) => {
    if (active && isCameraEnabled.value && !isAnyModalOpen.value) {
      await startCameraScanner();
    } else {
      await stopCameraScanner();
    }
  }
);

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown, true);
  await initializeCameras();
  if (props.isActive && isCameraEnabled.value && !isAnyModalOpen.value) {
    await startCameraScanner();
  }
});

onUnmounted(async () => {
  window.removeEventListener('keydown', handleGlobalKeydown, true);
  if (clearLastCodeTimer) clearTimeout(clearLastCodeTimer);
  if (recentScanTimer) clearTimeout(recentScanTimer);
  await stopCameraScanner();
});
</script>

<template>
  <div class="pointer-events-none select-none">
    <!-- 1. MINIMIZED STATE: Floating Compact Square Button -->
    <div
      v-if="isMinimized"
      class="fixed z-40 pointer-events-auto transition-all animate-in fade-in duration-200"
      :class="isMobile ? 'bottom-20 right-4' : 'bottom-4 left-4'"
    >
      <button
        type="button"
        @click="toggleMinimize"
        class="group flex items-center gap-2 px-3 py-2 bg-slate-900/95 hover:bg-slate-800 text-white shadow-2xl border border-white/20 backdrop-blur-md cursor-pointer transition-all active:scale-95"
        title="Klik untuk membuka Mini Viewfinder Scanner Kamera"
      >
        <div class="relative flex items-center justify-center">
          <Camera :size="16" class="text-amber-400 group-hover:scale-110 transition-transform" />
          <span
            v-if="isScanning"
            class="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 ring-1 ring-slate-900 animate-pulse"
          ></span>
        </div>
        <span class="text-xs font-bold font-mono tracking-tight text-slate-100 pr-1">
          {{ isScanning ? 'Scanner Aktif' : 'Scanner Siap' }}
        </span>
        <Maximize2 :size="13" class="text-slate-400 group-hover:text-white transition-colors" />
      </button>
    </div>

    <!-- 2. EXPANDED STATE: Modern Mini Picture-in-Picture Viewfinder (No Rounding) -->
    <div
      v-show="!isMinimized"
      class="fixed z-40 pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-200 border border-slate-700"
      :class="[
        isMobile ? 'bottom-20 right-3' : 'bottom-4 left-4',
        isErrorFlashing
          ? 'ring-4 ring-rose-500 shadow-[0_0_35px_rgba(244,63,94,0.95)] animate-glitch'
          : isSuccessFlashing
            ? 'ring-4 ring-emerald-400/80 shadow-[0_0_25px_rgba(16,185,129,0.5)]'
            : 'shadow-2xl'
      ]"
      style="width: 220px; border-radius: 0; overflow: hidden; background: #0f172a;"
    >
      <!-- PiP Header Bar -->
      <div class="px-2.5 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
        <!-- Status Indicator -->
        <div class="flex items-center gap-1.5">
          <span
            class="w-2 h-2 transition-colors"
            :class="isScanning ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"
          ></span>
          <span class="text-[11px] font-bold text-slate-200">
            {{ isScanning ? 'Auto Scan' : 'Scanner' }}
          </span>
        </div>

        <!-- Header Actions: Torch, Switch Cam, Sound, Minimize, Power -->
        <div class="flex items-center gap-1">
          <!-- Torch / Senter Toggle (if available) -->
          <button
            v-if="isTorchAvailable"
            type="button"
            class="p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition"
            :title="isTorchOn ? 'Matikan Lampu Senter' : 'Nyalakan Lampu Senter'"
            @click="toggleTorch"
          >
            <Zap :size="13" :class="{ 'text-amber-400 fill-amber-400': isTorchOn }" />
          </button>

          <!-- Tombol Flip Kamera Depan + Belakang di Mobile -->
          <button
            type="button"
            class="px-1.5 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 cursor-pointer active:scale-95 border border-slate-700/60"
            :title="facingMode === 'user' ? 'Kamera Depan Aktif (Cermin) - Klik untuk beralih ke Kamera Belakang' : 'Kamera Belakang Aktif - Klik untuk beralih ke Kamera Depan (Cermin)'"
            @click="flipCameraMobile"
          >
            <RefreshCw :size="11" :class="facingMode === 'user' ? 'text-amber-400 rotate-180' : 'text-emerald-400'" class="transition-transform duration-300 shrink-0" />
            <span class="text-[9px] font-bold font-mono text-slate-200">
              {{ facingMode === 'user' ? 'Depan' : 'Belakang' }}
            </span>
          </button>

          <!-- Sound Toggle -->
          <button
            type="button"
            class="p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            :title="isSoundEnabled ? 'Matikan Bunyi Beep' : 'Nyalakan Bunyi Beep'"
            @click="toggleSound"
          >
            <Volume2 v-if="isSoundEnabled" :size="12" class="text-emerald-400" />
            <VolumeX v-else :size="12" class="text-rose-400" />
          </button>

          <!-- Power On / Off Camera Stream -->
          <button
            type="button"
            class="p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            :title="isCameraEnabled ? 'Jeda Kamera (Hemat Baterai)' : 'Aktifkan Kamera'"
            @click="togglePower"
          >
            <Power :size="12" :class="isCameraEnabled ? 'text-emerald-400' : 'text-slate-500'" />
          </button>

          <!-- Minimize Button -->
          <button
            type="button"
            class="p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Kecilkan ke Ikon Mengambang"
            @click="toggleMinimize"
          >
            <Minimize2 :size="12" />
          </button>
        </div>
      </div>

      <!-- Live Video Viewfinder -->
      <div class="relative w-full h-[150px] bg-black overflow-hidden flex items-center justify-center">
        <!-- Native Video Element (Reliable across all WebViews) -->
        <video
          ref="videoRef"
          playsinline
          muted
          class="w-full h-full object-cover transition-transform"
          :class="{ 'mirror-feed': isMirrored }"
        ></video>

        <!-- Red Glitch Overlay on Error Scan -->
        <div
          v-if="isErrorFlashing"
          class="absolute inset-0 z-30 pointer-events-none bg-rose-600/40 backdrop-blur-[1px] flex items-center justify-center animate-glitch"
        >
          <div class="px-2.5 py-1 bg-rose-950/95 border border-rose-400 text-rose-200 text-[10.5px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xl animate-pulse">
            <AlertTriangle :size="15" class="text-rose-400 shrink-0" />
            <span>BARCODE TIDAK ADA</span>
          </div>
        </div>

        <!-- Laser Scanning Animation Bar (Active when camera is running) -->
        <div v-if="isScanning" class="absolute inset-0 pointer-events-none flex flex-col justify-between py-3 px-4">
          <!-- Viewfinder Corner Guides (Sharp square brackets) -->
          <div class="flex justify-between">
            <span class="w-3 h-3 border-t-2 border-l-2 border-amber-400/90"></span>
            <span class="w-3 h-3 border-t-2 border-r-2 border-amber-400/90"></span>
          </div>
          <!-- Laser Beam Line -->
          <div class="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_10px_#f59e0b] animate-pulse"></div>
          <div class="flex justify-between">
            <span class="w-3 h-3 border-b-2 border-l-2 border-amber-400/90"></span>
            <span class="w-3 h-3 border-b-2 border-r-2 border-amber-400/90"></span>
          </div>
        </div>

        <!-- State: Camera Turned Off (Power Saving) -->
        <div
          v-if="!isCameraEnabled"
          class="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-1.5 p-3 text-center text-white"
        >
          <CameraOff :size="24" class="text-slate-500 mb-1" />
          <span class="text-[11px] font-bold text-slate-300">Kamera Dinonaktifkan</span>
          <p class="text-[9.5px] text-slate-400">Scanner barcode Bluetooth/USB tetap siap membaca.</p>
          <button
            type="button"
            @click="togglePower"
            class="mt-1 px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10.5px] cursor-pointer shadow-xs active:scale-95"
          >
            Nyalakan Kamera
          </button>
        </div>

        <!-- State: Error / No Permission -->
        <div
          v-else-if="errorMessage && !isScanning"
          class="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-1 p-2.5 text-center text-white"
        >
          <AlertCircle :size="20" class="text-rose-400" />
          <span class="text-[10px] font-bold text-rose-300 line-clamp-2 leading-tight">{{ errorMessage }}</span>
          <button
            type="button"
            @click="startCameraScanner"
            class="mt-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold text-[10px] cursor-pointer border border-slate-700"
          >
            Coba Lagi
          </button>
        </div>

        <!-- Real-time Scan Notification Badge / Feedback -->
        <div
          v-if="recentScan"
          class="absolute bottom-1.5 inset-x-1.5 z-20 pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div
            v-if="recentScan.success"
            class="px-2.5 py-1.5 bg-emerald-600/95 border border-emerald-400 text-white shadow-lg backdrop-blur-xs flex items-center justify-between text-xs"
          >
            <div class="min-w-0 mr-1.5">
              <div class="font-bold truncate text-[11px] leading-tight">+1 {{ recentScan.name }}</div>
              <div class="text-[9.5px] opacity-90 font-mono">
                {{ recentScan.unit ? `${recentScan.unit} • ` : '' }}Rp {{ formatRupiah(recentScan.price) }}
              </div>
            </div>
            <CheckCircle2 :size="16" class="text-emerald-200 shrink-0" />
          </div>
          <div
            v-else
            class="px-2.5 py-1.5 bg-rose-600/95 border border-rose-400 text-white shadow-lg backdrop-blur-xs flex items-center justify-between text-xs"
          >
            <div class="min-w-0 mr-1.5">
              <div class="font-bold text-[10.5px] leading-tight">Belum Ada di Master</div>
              <div class="text-[9.5px] opacity-90 font-mono truncate">{{ recentScan.code }}</div>
            </div>
            <AlertCircle :size="16" class="text-rose-200 shrink-0" />
          </div>
        </div>
      </div>

      <!-- PiP Footer Guide Bar -->
      <div class="px-2.5 py-1 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[9.5px] text-slate-400 font-mono">
        <span class="truncate">Arahkan barcode ke kamera</span>
        <ScanLine :size="12" class="text-amber-400 shrink-0" />
      </div>
    </div>
  </div>
</template>

<style scoped>
video {
  border-radius: 0 !important;
}

.mirror-feed {
  transform: scaleX(-1) !important;
}

@keyframes glitch-shake {
  0% { transform: translate(0, 0) scale(1); }
  20% { transform: translate(-4px, 2px) scale(1.02); }
  40% { transform: translate(4px, -2px) scale(0.98); }
  60% { transform: translate(-3px, -1px) scale(1.01); }
  80% { transform: translate(3px, 1px) scale(1); }
  100% { transform: translate(0, 0) scale(1); }
}

.animate-glitch {
  animation: glitch-shake 0.35s ease-in-out;
}
</style>
