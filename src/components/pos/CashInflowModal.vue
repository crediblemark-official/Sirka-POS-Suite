<script setup lang="ts">
import { ref } from 'vue';
import {
  HeartHandshake,
  X,
  Coins,
  Sparkles,
  Gift,
  HelpCircle
} from 'lucide-vue-next';
import { useShiftStore } from '../../stores/shiftStore';
import { formatRupiah } from '../../utils/formatters';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const shiftStore = useShiftStore();

const amount = ref<number | ''>('');
const category = ref<'INFAQ' | 'TIP' | 'TITIPAN' | 'LAINNYA'>('INFAQ');
const reason = ref('');

const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

function selectQuickAmount(val: number) {
  amount.value = (Number(amount.value) || 0) + val;
}

function handleSave() {
  const num = Number(amount.value);
  if (!num || num <= 0) return;

  // BUG FIX: nominal kas harus bilangan bulat (rupiah penuh, tanpa sen).
  // Pecahan desimal membuat `expectedCash` pecahan sehingga rekonsiliasi
  // shift tidak bisa cocok dengan uang fisik.
  const rounded = Math.round(num);
  if (!Number.isFinite(rounded) || rounded <= 0) return;

  // BUG FIX: inflow hanya bisa dicatat bila ada shift kasir aktif. Sebelumnya
  // `recordCashInflow` keluar diam-diam (early return) tetapi modal tetap
  // tertutup seolah-olah tersimpan -> uang hilang tanpa jejak.
  if (!shiftStore.isShiftActive) {
    alert('Tidak ada shift kasir aktif. Buka shift kasir terlebih dahulu sebelum mencatat penerimaan kas.');
    return;
  }

  shiftStore.recordCashInflow(
    rounded,
    reason.value.trim() || `Penerimaan kas ${category.value}`,
    category.value
  );

  amount.value = '';
  reason.value = '';
  category.value = 'INFAQ';
  emit('close');
}

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => props.isOpen);
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150"
  >
    <div
      class="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md flex flex-col overflow-hidden text-gray-800"
      @click.stop
    >
      <!-- HEADER -->
      <div class="px-6 py-4 bg-gradient-to-r from-teal-600 to-emerald-700 text-white flex items-center justify-between shrink-0 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
            <HeartHandshake class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-base font-bold tracking-tight">Pemasukan Kas Non-Jual</h2>
            <p class="text-xs text-teal-100/90 mt-0.5">
              Tip, Infaq / Donasi Pelanggan, atau Titipan Kas
            </p>
          </div>
        </div>
        <button
          type="button"
          class="p-2 text-teal-200 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
          @click="emit('close')"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- BODY -->
      <div class="p-6 space-y-4 text-xs">
        <!-- 1. KATEGORI SUMBER -->
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Jenis Penerimaan
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="p-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
              :class="category === 'INFAQ'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400/20'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'"
              @click="category = 'INFAQ'"
            >
              <Coins :size="16" class="text-emerald-600" />
              <span>Infaq / Donasi</span>
            </button>
            <button
              type="button"
              class="p-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
              :class="category === 'TIP'
                ? 'border-teal-500 bg-teal-50 text-teal-800 ring-2 ring-teal-400/20'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'"
              @click="category = 'TIP'"
            >
              <Gift :size="16" class="text-teal-600" />
              <span>Tip Kasir</span>
            </button>
            <button
              type="button"
              class="p-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
              :class="category === 'TITIPAN'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-800 ring-2 ring-indigo-400/20'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'"
              @click="category = 'TITIPAN'"
            >
              <Sparkles :size="16" class="text-indigo-600" />
              <span>Titipan Uang</span>
            </button>
            <button
              type="button"
              class="p-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 cursor-pointer transition-all"
              :class="category === 'LAINNYA'
                ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-400/20'
                : 'border-gray-200 hover:bg-gray-50 text-gray-700'"
              @click="category = 'LAINNYA'"
            >
              <HelpCircle :size="16" class="text-amber-600" />
              <span>Lain-lain</span>
            </button>
          </div>
        </div>

        <!-- 2. INPUT NOMINAL -->
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Nominal Uang Masuk <span class="text-rose-500">*</span>
          </label>
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-400 text-sm">Rp</span>
            <input
              v-model.number="amount"
              type="number"
              min="1"
              step="100"
              placeholder="0"
              class="w-full pl-11 pr-3 py-2.5 border border-gray-200 rounded-xl text-base font-mono font-black text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          <!-- Tombol Cepat -->
          <div class="flex flex-wrap gap-1.5 mt-2">
            <button
              v-for="q in quickAmounts"
              :key="q"
              type="button"
              class="px-2 py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 rounded-lg font-mono font-bold text-[11px] cursor-pointer transition-colors"
              @click="selectQuickAmount(q)"
            >
              +{{ formatRupiah(q) }}
            </button>
          </div>
        </div>

        <!-- 3. KETERANGAN -->
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Keterangan / Sumber
          </label>
          <input
            v-model="reason"
            type="text"
            placeholder="Contoh: Kembalian pembeli disedekahkan ke kotak infaq"
            class="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>
      </div>

      <!-- FOOTER -->
      <div class="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2 shrink-0">
        <button
          type="button"
          class="px-4 py-2 border border-gray-200 hover:bg-white text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          @click="emit('close')"
        >
          Batal
        </button>
        <button
          type="button"
          class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!amount || Number(amount) <= 0"
          @click="handleSave"
        >
          <Coins :size="14" />
          <span>Simpan Pemasukan Kas</span>
        </button>
      </div>
    </div>
  </div>
</template>
