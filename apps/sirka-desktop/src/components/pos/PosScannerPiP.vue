<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, computed } from 'vue';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import jsQR from 'jsqr';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePosStore } from '../../stores/posStore';
import type { Product } from '../../types';
import {
  CameraOff,
  X,
  Minimize2,
  Maximize2,
  FlipHorizontal,
  Check,
  AlertCircle,
  ScanLine,
  Volume2,
  VolumeX,
  SwitchCamera,
  ShoppingCart,
  Trash2
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const inventoryStore = useInventoryStore();
const posStore = usePosStore();

// Scanner state
const videoRef = ref<HTMLVideoElement | null>(null);
const isCameraActive = ref(false);
const cameraError = ref('');
const isMirrored = ref(false);
const isMinimized = ref(false);
const soundEnabled = ref(true);
const scanFramesCount = ref(0);

// Camera devices
const videoDevices = ref<MediaDeviceInfo[]>([]);
const selectedDeviceId = ref<string>('');

// Continuous scan tracking
const lastScannedCode = ref('');
const lastScanTime = ref(0);
const scanCooldownMs = 1200; // 1.2 detik cooldown hanya untuk barcode yang persis sama
export interface ScanHistoryItem {
  code: string;
  name: string;
  price: number;
  unitName: string;
  cartQty: number;
  time: number;
  status: 'ok' | 'notfound';
}
const scanHistory = ref<ScanHistoryItem[]>([]);
const totalScanned = ref(0);

// Multi-engine scanner internals
let mediaStream: MediaStream | null = null;
let animationFrameId: number | null = null;
let scanCanvas: HTMLCanvasElement | null = null;
let scanCtx: CanvasRenderingContext2D | null = null;
let scratchCanvas: HTMLCanvasElement | null = null;
let scratchCtx: CanvasRenderingContext2D | null = null;
let isProcessingFrame = false;

// 1. Native BarcodeDetector (hardware accelerated)
let nativeDetector: any = null;
if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
  try {
    nativeDetector = new (window as any).BarcodeDetector({
      formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'data_matrix']
    });
  } catch (e) {
    console.warn('[PosScannerPiP] BarcodeDetector init failed:', e);
  }
}

// 2. ZXing Reader for 1D retail barcodes & 2D codes
const zxingHints = new Map<DecodeHintType, any>();
zxingHints.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.DATA_MATRIX
]);
zxingHints.set(DecodeHintType.TRY_HARDER, true);
const zxingReader = new BrowserMultiFormatReader(zxingHints);

// Feedback animation
const flashStatus = ref<'ok' | 'notfound' | null>(null);
let flashTimeout: ReturnType<typeof setTimeout> | null = null;

function playScanSound(success: boolean = true) {
  if (!soundEnabled.value) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (success) {
      // Kasir swalayan chime: high crisp beep (950 Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, ctx.currentTime);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } else {
      // Error chime: double low beep (320 Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch {
    // Ignore audio error
  }
}

interface ScanResult {
  product: Product;
  unitName?: string;
}

function lookupByBarcode(code: string): ScanResult | undefined {
  const key = code.trim();
  if (!key) return undefined;
  const prods = inventoryStore.products;

  // 1. Exact match pada barcode produk atau kode SKU
  for (const p of prods) {
    const pBarcode = (p.barcode || '').trim();
    const pCode = (p.code || '').trim().toUpperCase();
    if (pBarcode === key || pCode === key.toUpperCase()) {
      return { product: p };
    }
    // Cek barcode satuan bertingkat (misal scan barcode kardus DUS)
    if (p.units && Array.isArray(p.units)) {
      const matchUnit = p.units.find(u => (u.barcode || '').trim() === key);
      if (matchUnit) {
        return { product: p, unitName: matchUnit.unitName };
      }
    }
  }

  // 2. Normalisasi awalan nol (UPC-A 12 digit vs EAN-13 13 digit)
  const keyWithoutZero = key.replace(/^0+/, '');
  const keyWithZero = '0' + key;
  for (const p of prods) {
    const pBarcode = (p.barcode || '').trim();
    if (pBarcode && (pBarcode === keyWithoutZero || pBarcode === keyWithZero)) {
      return { product: p };
    }
    if (p.units && Array.isArray(p.units)) {
      const matchUnit = p.units.find(u => {
        const uBarcode = (u.barcode || '').trim();
        return uBarcode && (uBarcode === keyWithoutZero || uBarcode === keyWithZero);
      });
      if (matchUnit) {
        return { product: p, unitName: matchUnit.unitName };
      }
    }
  }

  return undefined;
}

function handleScannedCode(rawCode: string) {
  const code = rawCode.trim();
  if (!code) return;

  const now = Date.now();

  // Cooldown HANYA berlaku bila barcode sama persis discan berturut-turut dalam jeda singkat
  if (code === lastScannedCode.value && (now - lastScanTime.value) < scanCooldownMs) {
    return;
  }

  lastScannedCode.value = code;
  lastScanTime.value = now;
  totalScanned.value++;

  const match = lookupByBarcode(code);
  if (match) {
    posStore.addProductToCart(match.product, 1, match.unitName);

    // Ambil info qty terkini di keranjang
    const cartItem = posStore.cartItems.find(
      ci => ci.productId === match.product.id && (match.unitName ? ci.unit === match.unitName : true)
    );
    const cartQty = cartItem ? cartItem.qty : 1;
    const sellPrice = match.unitName
      ? (match.product.units?.find(u => u.unitName === match.unitName)?.sellPrice ?? match.product.lastSellPrice)
      : match.product.lastSellPrice;

    playScanSound(true);
    showFlash('ok');
    scanHistory.value.unshift({
      code,
      name: match.product.name,
      price: sellPrice,
      unitName: match.unitName || match.product.unit || 'pcs',
      cartQty,
      time: now,
      status: 'ok'
    });
  } else {
    playScanSound(false);
    showFlash('notfound');
    scanHistory.value.unshift({
      code,
      name: `Barcode "${code}" belum terdaftar`,
      price: 0,
      unitName: '',
      cartQty: 0,
      time: now,
      status: 'notfound'
    });
  }

  if (scanHistory.value.length > 20) {
    scanHistory.value = scanHistory.value.slice(0, 20);
  }
}

function showFlash(status: 'ok' | 'notfound') {
  if (flashTimeout) clearTimeout(flashTimeout);
  flashStatus.value = status;
  flashTimeout = setTimeout(() => {
    flashStatus.value = null;
  }, 1000);
}

const latestScan = computed(() => scanHistory.value[0] || null);

// ─── Camera Lifecycle & Devices ───

async function enumerateCameras() {
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices.value = devices.filter(d => d.kind === 'videoinput');
    }
  } catch (err) {
    console.warn('[PosScannerPiP] Gagal mendeteksi daftar webcam:', err);
  }
}

async function switchCamera() {
  if (videoDevices.value.length < 2) return;
  const currentIdx = videoDevices.value.findIndex(d => d.deviceId === selectedDeviceId.value);
  const nextIdx = (currentIdx + 1) % videoDevices.value.length;
  selectedDeviceId.value = videoDevices.value[nextIdx].deviceId;
  stopWebcamScanner();
  await startWebcamScanner();
}

watch(
  () => props.isOpen,
  async (open) => {
    if (open) {
      await enumerateCameras();
      await startWebcamScanner();
    } else {
      stopWebcamScanner();
    }
  }
);

async function startWebcamScanner() {
  cameraError.value = '';
  isCameraActive.value = true;
  scanFramesCount.value = 0;
  await nextTick();

  try {
    const constraints: MediaStreamConstraints = {
      video: selectedDeviceId.value
        ? { deviceId: { exact: selectedDeviceId.value }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      // Fallback: coba kamera default apa saja
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    }

    mediaStream = stream;
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      videoRef.value.setAttribute('playsinline', 'true');
      await videoRef.value.play();
      startScanLoop();
    }

    // Perbarui daftar kamera setelah izin webcam aktif
    await enumerateCameras();
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (msg.includes('NotAllowedError') || msg.includes('PermissionDenied')) {
      cameraError.value = 'Izin kamera ditolak. Periksa pengaturan sistem / browser.';
    } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFound')) {
      cameraError.value = 'Tidak ada webcam yang terdeteksi di perangkat ini.';
    } else {
      cameraError.value = err?.message || 'Gagal mengakses webcam.';
    }
    isCameraActive.value = false;
  }
}

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

  const tick = async () => {
    if (!isCameraActive.value) return;

    try {
      const video = videoRef.value;
      if (video && video.videoWidth > 0 && !video.paused && !isProcessingFrame) {
        const now = performance.now();
        if (now - lastScan >= 45) { // ~22 fps
          lastScan = now;
          isProcessingFrame = true;
          scanFramesCount.value++;

          let decodedCode: string | null = null;

          // 1. Mesin Utama: BarcodeDetector bawaan (hardware accelerated, EAN-13, Code 128, QR)
          if (nativeDetector) {
            try {
              const barcodes = await nativeDetector.detect(video);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                decodedCode = barcodes[0].rawValue;
              }
            } catch {
              // fallback ke ZXing
            }
          }

          // 2. Mesin Kedua: ZXing BrowserMultiFormatReader langsung pada video element (1D retail barcodes + 2D)
          if (!decodedCode && video) {
            try {
              const zxRes = zxingReader.decode(video);
              if (zxRes && zxRes.getText()) {
                decodedCode = zxRes.getText();
              }
            } catch {
              // NotFoundException wajar tiap frame jika barcode belum tepat di depan kamera
            }
          }

          // 3. Mesin Ketiga: jsQR spesialis QR code
          if (!decodedCode && scanCtx && scanCanvas) {
            const targetWidth = Math.min(720, video.videoWidth);
            const scale = targetWidth / video.videoWidth;
            const targetHeight = Math.floor(video.videoHeight * scale);

            scanCanvas.width = targetWidth;
            scanCanvas.height = targetHeight;
            scanCtx.drawImage(video, 0, 0, targetWidth, targetHeight);

            try {
              const imgData = scanCtx.getImageData(0, 0, targetWidth, targetHeight);
              const qrRes = jsQR(imgData.data, targetWidth, targetHeight, {
                inversionAttempts: 'attemptBoth'
              });
              if (qrRes && qrRes.data) {
                decodedCode = qrRes.data;
              }
            } catch {
              // Ignore
            }

            // 4. Jika mode cermin aktif dan belum terdeteksi, coba balik frame di scratch canvas
            if (!decodedCode && isMirrored.value && scratchCtx && scratchCanvas) {
              try {
                scratchCanvas.width = targetWidth;
                scratchCanvas.height = targetHeight;
                scratchCtx.save();
                scratchCtx.translate(targetWidth, 0);
                scratchCtx.scale(-1, 1);
                scratchCtx.drawImage(scanCanvas, 0, 0);
                scratchCtx.restore();

                const flippedData = scratchCtx.getImageData(0, 0, targetWidth, targetHeight);
                const flippedQr = jsQR(flippedData.data, targetWidth, targetHeight, {
                  inversionAttempts: 'attemptBoth'
                });
                if (flippedQr && flippedQr.data) {
                  decodedCode = flippedQr.data;
                }
              } catch {
                // Ignore
              }
            }
          }

          if (decodedCode) {
            handleScannedCode(decodedCode);
          }
        }
      }
    } catch (err) {
      console.warn('[PosScannerPiP] frame error:', err);
    } finally {
      isProcessingFrame = false;
      if (isCameraActive.value) {
        animationFrameId = requestAnimationFrame(tick);
      }
    }
  };

  animationFrameId = requestAnimationFrame(tick);
}

function stopWebcamScanner() {
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (videoRef.value) {
    videoRef.value.srcObject = null;
  }
  isCameraActive.value = false;
  cameraError.value = '';
}

function handleClose() {
  stopWebcamScanner();
  emit('close');
}

function toggleMinimize() {
  isMinimized.value = !isMinimized.value;
}

function clearHistory() {
  scanHistory.value = [];
}

function formatRupiah(val: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val);
}

onMounted(() => {
  if (props.isOpen) {
    startWebcamScanner();
  }
});

onUnmounted(() => {
  stopWebcamScanner();
  if (flashTimeout) clearTimeout(flashTimeout);
});
</script>

<template>
  <!-- PiP Floating Scanner Widget -->
  <div
    v-if="isOpen"
    class="pos-scanner-pip"
    :class="{
      'pip-minimized': isMinimized,
      'pip-expanded': !isMinimized
    }"
  >
    <!-- Header Bar -->
    <div class="pip-header">
      <div class="pip-header-left">
        <ScanLine :size="14" class="text-amber-400 animate-pulse shrink-0" />
        <span class="pip-header-title">Scanner Kasir</span>
        <span v-if="totalScanned > 0" class="pip-scan-count">
          {{ totalScanned }} scan
        </span>
      </div>
      <div class="pip-header-actions">
        <!-- Switch Camera Button (hanya tampil jika > 1 kamera) -->
        <button
          v-if="videoDevices.length > 1"
          type="button"
          class="pip-action-btn"
          title="Ganti Perangkat Kamera"
          @click="switchCamera"
        >
          <SwitchCamera :size="13" />
        </button>

        <!-- Toggle Sound -->
        <button
          type="button"
          class="pip-action-btn"
          :class="{ 'text-amber-400': soundEnabled }"
          :title="soundEnabled ? 'Matikan Suara Beep' : 'Nyalakan Suara Beep'"
          @click="soundEnabled = !soundEnabled"
        >
          <Volume2 v-if="soundEnabled" :size="13" />
          <VolumeX v-else :size="13" />
        </button>

        <!-- Flip/Mirror -->
        <button
          type="button"
          class="pip-action-btn"
          :title="isMirrored ? 'Normal' : 'Cermin (Mirror)'"
          @click="isMirrored = !isMirrored"
        >
          <FlipHorizontal :size="13" />
        </button>

        <!-- Minimize/Maximize -->
        <button
          type="button"
          class="pip-action-btn"
          :title="isMinimized ? 'Perbesar' : 'Perkecil'"
          @click="toggleMinimize"
        >
          <Maximize2 v-if="isMinimized" :size="13" />
          <Minimize2 v-else :size="13" />
        </button>

        <!-- Close -->
        <button
          type="button"
          class="pip-action-btn pip-close-btn"
          title="Tutup Scanner"
          @click="handleClose"
        >
          <X :size="13" />
        </button>
      </div>
    </div>

    <!-- Camera Feed (collapsed if minimized) -->
    <div v-show="!isMinimized" class="pip-camera-container">
      <video
        ref="videoRef"
        class="pip-video"
        :class="{ 'pip-mirrored': isMirrored }"
        playsinline
        muted
      ></video>

      <!-- Viewfinder Box -->
      <div class="pip-viewfinder">
        <div class="pip-corner pip-corner-tl"></div>
        <div class="pip-corner pip-corner-tr"></div>
        <div class="pip-corner pip-corner-bl"></div>
        <div class="pip-corner pip-corner-br"></div>
        <!-- Laser Sweep Animation -->
        <div class="pip-laser"></div>
      </div>

      <!-- Flash Overlay on Scan -->
      <div
        v-if="flashStatus"
        class="pip-flash"
        :class="{
          'pip-flash-ok': flashStatus === 'ok',
          'pip-flash-fail': flashStatus === 'notfound'
        }"
      >
        <div class="pip-flash-badge">
          <Check v-if="flashStatus === 'ok'" :size="24" class="text-white" />
          <AlertCircle v-else :size="24" class="text-white" />
        </div>
      </div>

      <!-- Camera Error -->
      <div v-if="cameraError" class="pip-error-overlay">
        <CameraOff :size="22" class="text-rose-400" />
        <span class="text-[10px] text-rose-200 font-medium text-center leading-tight">{{ cameraError }}</span>
        <button
          type="button"
          class="pip-retry-btn"
          @click="startWebcamScanner"
        >
          Coba Lagi
        </button>
      </div>

      <!-- Status Badge -->
      <div v-if="isCameraActive && !cameraError" class="pip-status-badge">
        <span class="pip-status-dot"></span>
        <span class="text-[9px] font-bold text-emerald-300">AUTO SCAN 1D/2D</span>
      </div>
    </div>

    <!-- Latest Scan Result (always visible, even minimized) -->
    <div
      v-if="latestScan"
      class="pip-latest-result"
      :class="latestScan.status === 'ok' ? 'pip-result-ok' : 'pip-result-fail'"
    >
      <div class="pip-result-icon">
        <Check v-if="latestScan.status === 'ok'" :size="12" />
        <AlertCircle v-else :size="12" />
      </div>
      <div class="pip-result-text">
        <div class="flex items-center gap-1.5 justify-between">
          <span class="pip-result-name">{{ latestScan.name }}</span>
          <span
            v-if="latestScan.status === 'ok' && latestScan.cartQty > 0"
            class="pip-cart-badge"
          >
            <ShoppingCart :size="9" />
            {{ latestScan.cartQty }}
          </span>
        </div>
        <div class="flex items-center gap-2 text-[9px] text-slate-400">
          <span v-if="latestScan.status === 'ok' && latestScan.price > 0" class="text-emerald-400 font-bold">
            {{ formatRupiah(latestScan.price) }}
          </span>
          <span class="pip-result-code">{{ latestScan.code }}</span>
        </div>
      </div>
    </div>

    <!-- Scan History (only when expanded and history > 1) -->
    <div v-if="!isMinimized && scanHistory.length > 1" class="pip-history">
      <div class="pip-history-header">
        <span>Riwayat Scan Kasir</span>
        <button
          type="button"
          class="text-[9px] text-slate-400 hover:text-rose-400 flex items-center gap-0.5"
          @click="clearHistory"
        >
          <Trash2 :size="9" /> Bersihkan
        </button>
      </div>
      <div class="pip-history-scroll">
        <div
          v-for="(item, idx) in scanHistory.slice(1, 6)"
          :key="idx"
          class="pip-history-item"
          :class="item.status === 'ok' ? 'text-slate-300' : 'text-rose-400'"
        >
          <span class="pip-history-dot" :class="item.status === 'ok' ? 'bg-emerald-400' : 'bg-rose-400'"></span>
          <span class="truncate flex-1">{{ item.name }}</span>
          <span v-if="item.status === 'ok' && item.price > 0" class="text-[8.5px] font-mono text-emerald-300">
            {{ formatRupiah(item.price) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pos-scanner-pip {
  position: fixed;
  z-index: 45;
  bottom: 2.5rem;
  right: 28rem;
  width: 270px;
  background: #0f172a;
  border-radius: 16px;
  box-shadow: 0 10px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  animation: pipSlideIn 0.3s ease-out;
}

.pip-minimized {
  width: 240px;
}

.pip-expanded {
  width: 270px;
}

@keyframes pipSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Header */
.pip-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: linear-gradient(135deg, #1e293b, #312e81);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.pip-header-left {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.pip-header-title {
  font-size: 11px;
  font-weight: 800;
  color: #f1f5f9;
  white-space: nowrap;
}

.pip-scan-count {
  font-size: 9px;
  font-weight: 700;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.15);
  padding: 1px 5px;
  border-radius: 6px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.pip-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.pip-action-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}

.pip-action-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
}

.pip-close-btn:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}

/* Camera Container */
.pip-camera-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: #000;
  overflow: hidden;
}

.pip-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.pip-mirrored {
  transform: scaleX(-1);
}

/* Viewfinder */
.pip-viewfinder {
  position: absolute;
  inset: 12px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.pip-corner {
  position: absolute;
  width: 14px;
  height: 14px;
}

.pip-corner-tl { top: 0; left: 0; border-top: 2.5px solid #fbbf24; border-left: 2.5px solid #fbbf24; border-radius: 6px 0 0 0; }
.pip-corner-tr { top: 0; right: 0; border-top: 2.5px solid #fbbf24; border-right: 2.5px solid #fbbf24; border-radius: 0 6px 0 0; }
.pip-corner-bl { bottom: 0; left: 0; border-bottom: 2.5px solid #fbbf24; border-left: 2.5px solid #fbbf24; border-radius: 0 0 0 6px; }
.pip-corner-br { bottom: 0; right: 0; border-bottom: 2.5px solid #fbbf24; border-right: 2.5px solid #fbbf24; border-radius: 0 0 6px 0; }

.pip-laser {
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, transparent 0%, #fbbf24 35%, #fbbf24 65%, transparent 100%);
  box-shadow: 0 0 10px #fbbf24, 0 0 4px #fbbf24;
  animation: laserSweep 1.6s ease-in-out infinite alternate;
}

@keyframes laserSweep {
  0% {
    transform: translateY(-50px);
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
  100% {
    transform: translateY(50px);
    opacity: 0.3;
  }
}

/* Flash feedback overlay */
.pip-flash {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: flashPulse 0.35s ease-out;
  pointer-events: none;
}

.pip-flash-ok {
  background: rgba(16, 185, 129, 0.4);
}

.pip-flash-fail {
  background: rgba(239, 68, 68, 0.45);
}

.pip-flash-badge {
  padding: 8px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

@keyframes flashPulse {
  0% {
    opacity: 0;
    transform: scale(0.85);
  }
  40% {
    opacity: 1;
    transform: scale(1.05);
  }
  100% {
    opacity: 0.8;
    transform: scale(1);
  }
}

/* Camera Error */
.pip-error-overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
}

.pip-retry-btn {
  padding: 4px 12px;
  background: #fbbf24;
  color: #0f172a;
  border: none;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
}

.pip-retry-btn:hover {
  background: #f59e0b;
}

/* Status Badge */
.pip-status-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.pip-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34d399;
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Latest Result */
.pip-latest-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  animation: resultSlideIn 0.2s ease-out;
}

.pip-result-ok {
  background: rgba(16, 185, 129, 0.12);
}

.pip-result-fail {
  background: rgba(239, 68, 68, 0.12);
}

@keyframes resultSlideIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.pip-result-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pip-result-ok .pip-result-icon {
  background: rgba(16, 185, 129, 0.25);
  color: #34d399;
}

.pip-result-fail .pip-result-icon {
  background: rgba(239, 68, 68, 0.25);
  color: #f87171;
}

.pip-result-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.pip-result-name {
  font-size: 11px;
  font-weight: 700;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pip-cart-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  font-weight: 800;
  background: #10b981;
  color: #ffffff;
  padding: 1px 5px;
  border-radius: 6px;
  flex-shrink: 0;
}

.pip-result-code {
  font-size: 9px;
  font-weight: 600;
  color: #94a3b8;
  font-family: monospace;
}

/* History List */
.pip-history {
  padding: 4px 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.pip-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 9px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 0 4px;
}

.pip-history-scroll {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 80px;
  overflow-y: auto;
}

.pip-history-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9.5px;
  font-weight: 500;
  padding: 2px 0;
}

.pip-history-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
