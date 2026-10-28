<script setup lang="ts">
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
</script>

<template>
  <div class="px-3.5 py-2.5 hover:bg-slate-50/80 transition-colors flex flex-col gap-1.5 border-b border-slate-100 last:border-b-0">
    <!-- Baris 1: Nama Barang, Unit Selector, Kategori, & Tombol Hapus -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5 min-w-0 flex-1">
        <span class="font-bold text-slate-900 text-sm truncate" :title="item.name">
          {{ item.name }}
        </span>

        <!-- Unit Selector Pill (Dropdown jika produk mendukung konversi multi-satuan) -->
        <div class="relative shrink-0">
          <select
            v-if="availableUnits.length > 1"
            :value="item.unit"
            class="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded text-xs font-bold border-none outline-none cursor-pointer transition-colors"
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
          <span v-else class="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-bold uppercase font-mono">
            {{ item.unit }}
          </span>
        </div>

        <span class="truncate text-xs text-slate-400 shrink-0">
          {{ item.category }}
        </span>
      </div>

      <button
        type="button"
        class="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors shrink-0"
        title="Hapus barang dari keranjang"
        @click="emit('remove')"
      >
        <Trash2 :size="15" />
      </button>
    </div>

    <!-- Baris 2: Harga Jual Satuan (Kiri) & Qty + Subtotal (Kanan) -->
    <div class="flex items-center justify-between gap-2">
      <!-- Kiri: Harga Satuan (Bisa di-tap untuk ubah harga / negosiasi) -->
      <div
        class="flex items-baseline gap-1 cursor-pointer hover:opacity-80 group/price min-w-0"
        title="Klik untuk ubah harga / negosiasi"
        @click="emit('open-adjust-price')"
      >
        <!-- Jika harga dinego lebih rendah dari harga master -->
        <template v-if="masterPrice > item.sellPrice">
          <span class="line-through text-slate-400 text-xs font-mono">
            {{ formatRupiah(masterPrice) }}
          </span>
          <span class="text-sm font-black text-rose-600 font-mono group-hover/price:underline">
            {{ formatRupiah(item.sellPrice) }}
          </span>
          <span class="text-xs text-slate-500 font-semibold uppercase font-mono">/ {{ item.unit }}</span>
        </template>

        <!-- Normal: Warna kontras jelas & nominal terbaca -->
        <template v-else>
          <span class="text-sm font-black text-slate-900 font-mono group-hover/price:underline">
            {{ formatRupiah(item.sellPrice) }}
          </span>
          <span class="text-xs text-slate-500 font-semibold uppercase font-mono">/ {{ item.unit }}</span>
        </template>
      </div>

      <!-- Kanan: Qty Control Desimal & Subtotal -->
      <div class="flex items-center gap-2.5 shrink-0">
        <!-- Flexible Qty Input (Touch-friendly 32px buttons) -->
        <div class="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          <button
            type="button"
            class="w-8 h-8 rounded-lg bg-white shadow-2xs text-slate-700 hover:text-black hover:bg-slate-200 flex items-center justify-center cursor-pointer transition-all active:scale-90"
            title="Kurangi Qty"
            @click="emit('update-qty', Number(Math.max(0, item.qty - qtyDecrement()).toFixed(3)))"
          >
            <Minus :size="14" />
          </button>
          <input
            type="text"
            inputmode="decimal"
            :value="item.qty"
            class="w-10 h-8 text-center font-mono font-black text-sm bg-transparent text-slate-900 border-none outline-none"
            title="Jumlah beli (bisa ketik desimal, misal 0.5 atau 0.25)"
            @change="handleQtyInputChange"
            @keydown.up.prevent="emit('update-qty', Number((item.qty + qtyIncrement()).toFixed(3)))"
            @keydown.down.prevent="emit('update-qty', Number(Math.max(0, item.qty - qtyDecrement()).toFixed(3)))"
          />
          <button
            type="button"
            class="w-8 h-8 rounded-lg bg-white shadow-2xs text-slate-700 hover:text-black hover:bg-slate-200 flex items-center justify-center cursor-pointer transition-all active:scale-90"
            title="Tambah Qty"
            @click="emit('update-qty', Number((item.qty + qtyIncrement()).toFixed(3)))"
          >
            <Plus :size="14" />
          </button>
        </div>

        <!-- Subtotal Nominal (Jelas, Tebal & Terbaca) -->
        <span class="font-black font-mono text-slate-900 text-sm sm:text-base text-right min-w-[70px]">
          {{ formatRupiah(item.subtotalSell) }}
        </span>
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
</template>
