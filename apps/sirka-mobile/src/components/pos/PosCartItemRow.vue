<script setup lang="ts">
import { ref } from 'vue';
import { CartItem } from '../../types';
import { Trash2, Plus, Minus } from 'lucide-vue-next';
import { formatRupiah } from '../../utils/formatters';

export interface AvailableUnitOption {
  unitName: string;
  factor?: number;
  price?: number;
}

const props = defineProps<{
  item: CartItem;
  masterPrice: number;
  availableUnits: AvailableUnitOption[];
}>();

const emit = defineEmits<{
  (e: 'open-adjust-price'): void;
  (e: 'remove'): void;
  (e: 'change-unit', unit: string): void;
  (e: 'update-qty', qty: number): void;
}>();

const METRIC_UNITS = ['KG', 'LITER', 'LTR'];

function isMetricUnit(unit?: string): boolean {
  return METRIC_UNITS.includes((unit || '').toUpperCase());
}

/**
 * Langkah pengurangan qty untuk satuan metrik.
 * Mencegah pengurangan melebihi sisa qty agar tidak bernilai minus / terhapus tidak sengaja.
 */
function qtyDecrement(): number {
  if (!isMetricUnit(props.item.unit)) return 1;
  const qty = Number(props.item.qty) || 0;
  if (qty > 1) return 1;
  return Math.min(0.25, qty);
}

/** Pertahankan langkah 0,25 kg untuk satuan metrik di bawah 1 kg. */
function qtyIncrement(): number {
  if (!isMetricUnit(props.item.unit)) return 1;
  return (Number(props.item.qty) || 0) < 1 ? 0.25 : 1;
}

function handleQtyInputChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const cleaned = target.value.replace(',', '.');
  const val = parseFloat(cleaned);
  emit('update-qty', isNaN(val) ? 1 : Math.max(0.001, val));
}

// Gesture Geser Kiri / Kanan untuk Hapus Item (Swipe-To-Delete)
const translateX = ref(0);
const isDragging = ref(false);
let startX = 0;
let startY = 0;
let currentX = 0;
let isHorizontal = false;

function onPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement;
  // Jangan aktifkan gesture geser jika menekan tombol, input angka, atau dropdown
  if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.closest('button')) {
    return;
  }
  // Jika sedang terbuka, ketukan pada kartu akan menutupnya kembali
  if (translateX.value !== 0) {
    translateX.value = 0;
    e.preventDefault();
    return;
  }
  startX = e.clientX;
  startY = e.clientY;
  currentX = startX;
  isDragging.value = true;
  isHorizontal = false;
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return;
  currentX = e.clientX;
  const deltaX = currentX - startX;
  const deltaY = e.clientY - startY;

  if (!isHorizontal) {
    // Jika gerakan dominan vertikal, batalkan gesture geser agar scrolling halaman mulus
    if (Math.abs(deltaY) > 7 && Math.abs(deltaY) > Math.abs(deltaX)) {
      isDragging.value = false;
      translateX.value = 0;
      return;
    }
    // Jika gerakan dominan horizontal, aktifkan gesture geser dan kunci pointer
    if (Math.abs(deltaX) > 7 && Math.abs(deltaX) >= Math.abs(deltaY)) {
      isHorizontal = true;
      try {
        (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
      } catch {}
    }
  }

  if (isHorizontal) {
    // Geser ke kiri (deltaX < 0) atau kanan (deltaX > 0) dengan peredam jika terlalu jauh
    if (Math.abs(deltaX) > 130) {
      const sign = deltaX > 0 ? 1 : -1;
      translateX.value = sign * (130 + (Math.abs(deltaX) - 130) * 0.3);
    } else {
      translateX.value = deltaX;
    }
  }
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging.value) return;
  isDragging.value = false;
  try {
    (e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId);
  } catch {}

  const fullSwipeThreshold = 120;
  const revealThreshold = 55;

  if (Math.abs(translateX.value) >= fullSwipeThreshold) {
    // Geser penuh: animasi keluar lalu hapus
    const dir = translateX.value > 0 ? 1 : -1;
    triggerDelete(dir);
  } else if (Math.abs(translateX.value) >= revealThreshold) {
    // Geser separuh: tahan terbuka untuk menampilkan tombol Hapus
    translateX.value = translateX.value > 0 ? 84 : -84;
  } else {
    // Kembali ke posisi semula
    translateX.value = 0;
  }
  isHorizontal = false;
}

function onPointerCancel() {
  if (isDragging.value) {
    isDragging.value = false;
    translateX.value = 0;
    isHorizontal = false;
  }
}

function triggerDelete(direction = -1) {
  translateX.value = direction * 450;
  setTimeout(() => {
    emit('remove');
    translateX.value = 0;
  }, 180);
}
</script>

<template>
  <div
    class="relative overflow-hidden border-b border-slate-100 last:border-b-0 touch-pan-y select-none"
    :class="translateX !== 0 ? 'bg-rose-600' : 'bg-white'"
  >
    <!-- Left Delete Action (Muncul saat geser ke KANAN) -->
    <div
      v-show="translateX > 0"
      class="absolute inset-y-0 left-0 w-24 flex flex-col items-center justify-center gap-1 text-white font-bold text-xs cursor-pointer active:bg-rose-700 select-none z-0"
      @click="triggerDelete(1)"
    >
      <Trash2 :size="18" />
      <span>Hapus</span>
    </div>

    <!-- Right Delete Action (Muncul saat geser ke KIRI) -->
    <div
      v-show="translateX < 0"
      class="absolute inset-y-0 right-0 w-24 flex flex-col items-center justify-center gap-1 text-white font-bold text-xs cursor-pointer active:bg-rose-700 select-none z-0"
      @click="triggerDelete(-1)"
    >
      <Trash2 :size="18" />
      <span>Hapus</span>
    </div>

    <!-- Foreground Content Card (Mengikuti gesture geser) -->
    <div
      class="relative z-10 bg-white px-3.5 py-2.5 transition-colors flex flex-col gap-1.5 cursor-grab active:cursor-grabbing"
      :style="{
        transform: `translateX(${translateX}px)`,
        transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
      }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <!-- Baris 1: Nama Barang (Kiri) & Subtotal Hasil (Kanan Atas) -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <span class="font-bold text-slate-900 text-sm truncate" :title="item.name">
            {{ item.name }}
          </span>

          <!-- Dropdown multi-satuan jika produk memiliki lebih dari 1 satuan kemasan -->
          <select
            v-if="availableUnits.length > 1"
            :value="item.unit"
            class="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-xs font-bold border-none outline-none cursor-pointer transition-colors shrink-0"
            title="Klik untuk ganti satuan kemasan"
            @change="(e: any) => emit('change-unit', e.target.value)"
          >
            <option
              v-for="u in availableUnits"
              :key="u.unitName"
              :value="u.unitName"
            >
              {{ u.unitName }}
            </option>
          </select>
        </div>

        <!-- Subtotal Hasil di Kanan Atas Sejajar Nama Produk -->
        <span class="font-black font-mono text-slate-900 text-sm sm:text-base text-right shrink-0 min-w-[70px]">
          {{ formatRupiah(item.subtotalSell) }}
        </span>
      </div>

      <!-- Baris 2: Harga Satuan & Stepper Qty di Bawah -->
      <div class="flex items-center gap-2.5">
        <!-- Harga Satuan (@ harga) -->
        <div
          class="flex items-baseline gap-1 cursor-pointer hover:opacity-80 group/price shrink-0 text-xs font-mono"
          title="Klik untuk ubah harga / negosiasi"
          @click="emit('open-adjust-price')"
        >
          <!-- Jika harga dinego lebih rendah dari harga master -->
          <template v-if="masterPrice > item.sellPrice">
            <span class="line-through text-slate-400 text-[11px]">
              {{ formatRupiah(masterPrice) }}
            </span>
            <span class="font-bold text-rose-600 group-hover/price:underline">
              @ {{ formatRupiah(item.sellPrice) }}
            </span>
          </template>

          <!-- Normal -->
          <template v-else>
            <span class="font-medium text-slate-500 group-hover/price:underline">
              @ {{ formatRupiah(item.sellPrice) }}
            </span>
          </template>
        </div>

        <!-- Flexible Qty Input (Stepper Modern Bersekat POS) -->
        <div class="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-2xs divide-x divide-slate-200 overflow-hidden shrink-0">
          <button
            type="button"
            class="w-6.5 h-6.5 flex items-center justify-center bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-950 cursor-pointer transition-colors active:scale-95"
            title="Kurangi Qty"
            @click="emit('update-qty', Number(Math.max(0, item.qty - qtyDecrement()).toFixed(3)))"
          >
            <Minus :size="12" class="stroke-[2.5]" />
          </button>
          <input
            type="text"
            inputmode="decimal"
            :value="item.qty"
            class="w-9 h-6.5 text-center font-mono font-black text-xs text-slate-900 bg-white border-none outline-none focus:bg-blue-50/40"
            title="Jumlah beli (bisa ketik desimal, misal 0.5 atau 0.25)"
            @change="handleQtyInputChange"
            @keydown.up.prevent="emit('update-qty', Number((item.qty + qtyIncrement()).toFixed(3)))"
            @keydown.down.prevent="emit('update-qty', Number(Math.max(0, item.qty - qtyDecrement()).toFixed(3)))"
          />
          <button
            type="button"
            class="w-6.5 h-6.5 flex items-center justify-center bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 hover:text-slate-950 cursor-pointer transition-colors active:scale-95"
            title="Tambah Qty"
            @click="emit('update-qty', Number((item.qty + qtyIncrement()).toFixed(3)))"
          >
            <Plus :size="12" class="stroke-[2.5]" />
          </button>
        </div>
      </div>

    <!-- Baris 3: Shortcut Pecahan Cepat Timbangan (1/4, 1/2, 3/4, 1) jika satuan KG/Liter -->
    <div
      v-if="['KG', 'LITER', 'LTR'].includes((item.unit || '').toUpperCase())"
      class="flex items-center gap-1 text-[9.5px] pt-0.5"
    >
      <span class="text-gray-400 font-medium text-[9px]">Pecahan:</span>
      <button
        type="button"
        class="px-1.5 py-0.2 rounded text-gray-700 hover:text-amber-900 border border-gray-200 font-mono font-semibold cursor-pointer transition-colors"
        :class="item.qty === 0.25 ? 'bg-amber-500 text-white border-amber-600' : 'bg-gray-100 hover:bg-amber-100'"
        @click="emit('update-qty', 0.25)"
      >
        1/4
      </button>
      <button
        type="button"
        class="px-1.5 py-0.2 rounded text-gray-700 hover:text-amber-900 border border-gray-200 font-mono font-semibold cursor-pointer transition-colors"
        :class="item.qty === 0.5 ? 'bg-amber-500 text-white border-amber-600' : 'bg-gray-100 hover:bg-amber-100'"
        @click="emit('update-qty', 0.5)"
      >
        1/2
      </button>
      <button
        type="button"
        class="px-1.5 py-0.2 rounded text-gray-700 hover:text-amber-900 border border-gray-200 font-mono font-semibold cursor-pointer transition-colors"
        :class="item.qty === 0.75 ? 'bg-amber-500 text-white border-amber-600' : 'bg-gray-100 hover:bg-amber-100'"
        @click="emit('update-qty', 0.75)"
      >
        3/4
      </button>
      <button
        type="button"
        class="px-1.5 py-0.2 rounded text-gray-700 hover:text-amber-900 border border-gray-200 font-mono font-semibold cursor-pointer transition-colors"
        :class="item.qty === 1 ? 'bg-amber-500 text-white border-amber-600' : 'bg-gray-100 hover:bg-amber-100'"
        @click="emit('update-qty', 1)"
      >
        1 {{ item.unit.toLowerCase() }}
      </button>
    </div>
    </div>
  </div>
</template>
