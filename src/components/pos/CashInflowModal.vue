<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import {
  Coins,
  X,
  Sparkles,
  Gift,
  HelpCircle,
  AlertCircle,
  RotateCcw
} from 'lucide-vue-next';
import { useShiftStore } from '../../stores/shiftStore';
import { formatRupiah } from '../../utils/formatters';
import { useModalLock } from '../../composables/useModalLock';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const shiftStore = useShiftStore();

const amountInput = ref('');
const category = ref<'INFAQ' | 'TIP' | 'TITIPAN' | 'LAINNYA'>('INFAQ');
const reason = ref('');
const errorMessage = ref('');
const amountInputRef = ref<HTMLInputElement | null>(null);

const rawAmount = computed(() => {
  return Number(amountInput.value.replace(/[^0-9]/g, '')) || 0;
});

const quickAmounts = [1000, 2000, 5000, 10000, 20000, 50000];

function onAmountInput(e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
  amountInput.value = val ? Number(val).toLocaleString('id-ID') : '';
  errorMessage.value = '';
}

function selectQuickAmount(val: number) {
  const total = rawAmount.value + val;
  amountInput.value = total > 0 ? total.toLocaleString('id-ID') : '';
  errorMessage.value = '';
}

function clearAmount() {
  amountInput.value = '';
  errorMessage.value = '';
}

function handleSave() {
  const num = rawAmount.value;
  if (!num || num <= 0) {
    errorMessage.value = 'Silakan masukkan nominal uang masuk yang valid.';
    amountInputRef.value?.focus();
    return;
  }

  if (!shiftStore.isShiftActive) {
    errorMessage.value = 'Tidak ada shift kasir aktif. Silakan buka shift kasir terlebih dahulu.';
    return;
  }

  shiftStore.recordCashInflow(
    Math.round(num),
    reason.value.trim() || `Penerimaan kas ${category.value}`,
    category.value
  );

  amountInput.value = '';
  reason.value = '';
  category.value = 'INFAQ';
  errorMessage.value = '';
  emit('close');
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || document.activeElement === amountInputRef.value)) {
    e.preventDefault();
    handleSave();
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      amountInput.value = '';
      reason.value = '';
      category.value = 'INFAQ';
      errorMessage.value = '';
      window.addEventListener('keydown', handleKeydown);
      nextTick(() => {
        amountInputRef.value?.focus();
      });
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  }
);

onMounted(() => {
  if (props.isOpen) window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => props.isOpen);
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-in fade-in duration-150"
      @click.self="emit('close')"
    >
      <div
        class="bg-white rounded-xl shadow-2xl border border-gray-300 w-full max-w-md overflow-hidden flex flex-col text-xs animate-in zoom-in-95 duration-150"
        @click.stop
      >
        <!-- Modal Header (Standard System Style) -->
        <div class="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Coins :size="18" />
            </div>
            <div>
              <h3 class="font-bold text-gray-900 text-sm leading-tight">Pemasukan Kas Non-Jual</h3>
              <p class="text-[11px] text-gray-500 mt-0.5">Tip kasir, infaq / donasi, atau titipan uang masuk</p>
            </div>
          </div>
          <button
            type="button"
            class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 rounded-lg cursor-pointer transition-colors"
            title="Tutup (Esc)"
            @click="emit('close')"
          >
            <X :size="16" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-5 space-y-4">
          <!-- Warning banner jika shift kasir belum dibuka -->
          <div
            v-if="!shiftStore.isShiftActive"
            class="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 animate-in fade-in"
          >
            <AlertCircle :size="16" class="text-amber-600 shrink-0 mt-0.5" />
            <div class="text-[11.5px] leading-relaxed">
              <span class="font-bold block">Shift Kasir Belum Dibuka</span>
              Pemasukan kas hanya dapat dicatat saat ada shift kasir yang aktif agar uang masuk tercatat dalam rekonsiliasi laci kasir.
            </div>
          </div>

          <!-- 1. Kategori Sumber Penerimaan -->
          <div>
            <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">
              Jenis Penerimaan
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="p-2.5 rounded-lg border text-left font-medium text-xs flex items-center gap-2.5 cursor-pointer transition-all"
                :class="category === 'INFAQ'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500/30 shadow-2xs'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'"
                @click="category = 'INFAQ'"
              >
                <div
                  class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  :class="category === 'INFAQ' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'"
                >
                  <Coins :size="15" />
                </div>
                <div>
                  <span class="block leading-tight font-bold">Infaq / Donasi</span>
                  <span class="text-[10px] text-gray-400 font-normal">Dari kembalian/pelanggan</span>
                </div>
              </button>

              <button
                type="button"
                class="p-2.5 rounded-lg border text-left font-medium text-xs flex items-center gap-2.5 cursor-pointer transition-all"
                :class="category === 'TIP'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500/30 shadow-2xs'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'"
                @click="category = 'TIP'"
              >
                <div
                  class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  :class="category === 'TIP' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'"
                >
                  <Gift :size="15" />
                </div>
                <div>
                  <span class="block leading-tight font-bold">Tip Kasir</span>
                  <span class="text-[10px] text-gray-400 font-normal">Tip dari pelanggan</span>
                </div>
              </button>

              <button
                type="button"
                class="p-2.5 rounded-lg border text-left font-medium text-xs flex items-center gap-2.5 cursor-pointer transition-all"
                :class="category === 'TITIPAN'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500/30 shadow-2xs'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'"
                @click="category = 'TITIPAN'"
              >
                <div
                  class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  :class="category === 'TITIPAN' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'"
                >
                  <Sparkles :size="15" />
                </div>
                <div>
                  <span class="block leading-tight font-bold">Titipan Uang</span>
                  <span class="text-[10px] text-gray-400 font-normal">Tambah modal/titipan</span>
                </div>
              </button>

              <button
                type="button"
                class="p-2.5 rounded-lg border text-left font-medium text-xs flex items-center gap-2.5 cursor-pointer transition-all"
                :class="category === 'LAINNYA'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500/30 shadow-2xs'
                  : 'border-gray-200 hover:bg-gray-50 text-gray-700'"
                @click="category = 'LAINNYA'"
              >
                <div
                  class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                  :class="category === 'LAINNYA' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'"
                >
                  <HelpCircle :size="15" />
                </div>
                <div>
                  <span class="block leading-tight font-bold">Lain-lain</span>
                  <span class="text-[10px] text-gray-400 font-normal">Pemasukan lainnya</span>
                </div>
              </button>
            </div>
          </div>

          <!-- 2. Input Nominal Uang Masuk -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                Nominal Uang Masuk <span class="text-rose-500">*</span>
              </label>
              <button
                v-if="rawAmount > 0"
                type="button"
                class="text-[10.5px] text-gray-400 hover:text-rose-600 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                @click="clearAmount"
              >
                <RotateCcw :size="11" />
                <span>Reset</span>
              </button>
            </div>

            <div class="relative">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold font-mono text-gray-400 text-sm">
                Rp
              </span>
              <input
                ref="amountInputRef"
                :value="amountInput"
                type="text"
                inputmode="numeric"
                placeholder="0"
                class="w-full pl-11 pr-3 py-2 border border-gray-300 rounded-lg text-lg font-mono font-bold text-gray-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
                @input="onAmountInput"
              />
            </div>

            <!-- Tombol Cepat Penambahan Nominal -->
            <div class="grid grid-cols-6 gap-1.5 mt-2">
              <button
                v-for="q in quickAmounts"
                :key="q"
                type="button"
                class="py-1 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-gray-700 border border-gray-200 rounded-md font-mono text-[11px] font-semibold text-center cursor-pointer transition-colors"
                @click="selectQuickAmount(q)"
              >
                +{{ formatRupiah(q).replace('Rp ', '') }}
              </button>
            </div>

            <!-- Error inline validation -->
            <p v-if="errorMessage" class="text-xs text-rose-600 font-medium mt-1.5 flex items-center gap-1">
              <AlertCircle :size="12" />
              <span>{{ errorMessage }}</span>
            </p>
          </div>

          <!-- 3. Keterangan / Sumber -->
          <div>
            <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Keterangan / Sumber
            </label>
            <input
              v-model="reason"
              type="text"
              placeholder="Contoh: Kembalian pembeli disedekahkan ke kotak infaq"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
            />
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3 bg-slate-50 border-t border-gray-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            class="px-3.5 py-1.5 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="button"
            class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!rawAmount || rawAmount <= 0 || !shiftStore.isShiftActive"
            @click="handleSave"
          >
            <Coins :size="14" />
            <span>Simpan Pemasukan Kas</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
