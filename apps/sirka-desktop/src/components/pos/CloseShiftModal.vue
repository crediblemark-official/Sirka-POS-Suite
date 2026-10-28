<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useShiftStore } from '../../stores/shiftStore';
import { formatRupiah } from '../../utils/formatters';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

import {
  LogOut,
  X,
  Coins,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowDownRight,
  TrendingUp,
  Receipt
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const shiftStore = useShiftStore();
const { confirm: showConfirm } = useConfirmDialog();

// Input mode: 'denominations' | 'direct'
const countMode = ref<'denominations' | 'direct'>('denominations');

// Pecahan uang kertas & koin
const counts = ref({
  c100k: 0,
  c50k: 0,
  c20k: 0,
  c10k: 0,
  c5k: 0,
  c2k: 0,
  c1k: 0,
  cCoins: 0 // Nominal koin langsung
});

// Direct input
const directCashInput = ref('');
const directCash = ref(0);

const notes = ref('');
const isSubmitting = ref(false);

const denominationTotal = computed(() => {
  return (
    counts.value.c100k * 100000 +
    counts.value.c50k * 50000 +
    counts.value.c20k * 20000 +
    counts.value.c10k * 10000 +
    counts.value.c5k * 5000 +
    counts.value.c2k * 2000 +
    counts.value.c1k * 1000 +
    (Number(counts.value.cCoins) || 0)
  );
});

const actualCashTotal = computed(() => {
  return countMode.value === 'denominations' ? denominationTotal.value : directCash.value;
});

const activeShift = computed(() => shiftStore.currentShift);

const startingCash = computed(() => activeShift.value?.startingCash || 0);
const cashSales = computed(() => activeShift.value?.cashSales || 0);
const nonCashSales = computed(() => activeShift.value?.nonCashSales || 0);
const cashInflow = computed(() => activeShift.value?.cashInflow || 0);
const cashOutflow = computed(() => activeShift.value?.cashOutflow || 0);
const refundOutflow = computed(() => activeShift.value?.refundOutflow || 0);
const expectedCash = computed(() => activeShift.value?.expectedCash || 0);

const discrepancy = computed(() => actualCashTotal.value - expectedCash.value);

// Poin 10: Pemindahan Kas ke Pembukuan Bendahara
const retainedInDrawer = ref<number | ''>('');
const transferredToTreasury = computed(() => {
  const retained = Number(retainedInDrawer.value) || 0;
  return Math.max(0, actualCashTotal.value - retained);
});

// Otomatis isi default uang yang ditinggal di laci kasir = modal awal saat modal dibuka
// BUG FIX: hitungan uang fisik harus di-reset setiap kali modal dibuka.
// Sebelumnya hanya `retainedInDrawer` yang di-reset sehingga nominal hitungan
// lama masih tampil & bisa dikonfirmasi tanpa sengaja saat modal dibuka ulang.
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      resetCounts();
      countMode.value = 'denominations';
      retainedInDrawer.value = startingCash.value;
    }
  },
  { immediate: true }
);

function onDirectInput(e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
  directCashInput.value = val;
  directCash.value = Number(val) || 0;
}

function resetCounts() {
  counts.value = {
    c100k: 0,
    c50k: 0,
    c20k: 0,
    c10k: 0,
    c5k: 0,
    c2k: 0,
    c1k: 0,
    cCoins: 0
  };
  directCash.value = 0;
  directCashInput.value = '';
  notes.value = '';
  retainedInDrawer.value = '';
}

async function handleConfirmClose() {
  if (isSubmitting.value) return;
  if (actualCashTotal.value < 0) {
    alert('Total uang fisik tidak valid');
    return;
  }

  // Jika selisih dan belum ada catatan
  if (discrepancy.value !== 0 && !notes.value.trim()) {
    const isProceed = await showConfirm({
      title: 'Konfirmasi Selisih Kas Shift',
      message: `Terdapat selisih kas sebesar Rp ${formatRupiah(Math.abs(discrepancy.value))} (${discrepancy.value < 0 ? 'Tekor/Minus' : 'Kelebihan'}).`,
      details: 'Apakah Anda tetap ingin menutup shift ini tanpa catatan penjelasan?',
      confirmText: 'Ya, Tetap Tutup Shift',
      cancelText: 'Isi Catatan Dulu',
      type: 'warning'
    });
    if (!isProceed) return;
  }

  isSubmitting.value = true;
  try {
    await shiftStore.closeShift(actualCashTotal.value, notes.value, {
      transferredToTreasury: transferredToTreasury.value,
      retainedInDrawer: Number(retainedInDrawer.value) || 0
    });
    resetCounts();
    emit('close');
  } catch (err: any) {
    alert(err?.message || 'Gagal menutup shift kasir');
  } finally {
    isSubmitting.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    if (!isSubmitting.value) {
      e.preventDefault();
      emit('close');
    }
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    handleConfirmClose();
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    window.addEventListener('keydown', handleKeydown);
  } else {
    window.removeEventListener('keydown', handleKeydown);
  }
});

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
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header (Native Explorer Theme) -->
      <div
        class="px-5 py-3.5 flex items-center justify-between border-b border-gray-200 select-none shrink-0"
        style="background-color: var(--surface-ribbon, #f6f5f2);"
      >
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 bg-rose-100 text-rose-700 rounded-md">
            <LogOut :size="18" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-gray-800 leading-tight">Tutup Shift & Rekonsiliasi Kas Laci</h2>
            <p class="text-[11px] text-gray-500">
              Kasir: <strong class="text-gray-700">{{ activeShift?.cashierName || 'Kasir' }}</strong> • 
              Durasi: {{ shiftStore.shiftDuration }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-200 cursor-pointer transition-colors"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <!-- Modal Body (Scrollable & Compact) -->
      <div class="p-4 overflow-y-auto space-y-3 text-xs">
        <!-- 1. Expected Cash Breakdown Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="p-2 bg-gray-50 border border-gray-200 rounded">
            <span class="text-[9.5px] text-gray-500 uppercase tracking-wider block font-semibold">1. Modal Awal</span>
            <span class="text-xs font-bold font-mono text-gray-800 block mt-0.5">
              Rp {{ formatRupiah(startingCash) }}
            </span>
          </div>

          <div class="p-2 bg-emerald-50/60 border border-emerald-200 rounded">
            <span class="text-[9.5px] text-emerald-700 uppercase tracking-wider block font-semibold flex items-center gap-1">
              <TrendingUp :size="10" />
              2. (+) Jual Tunai & Tip
            </span>
            <span class="text-xs font-bold font-mono text-emerald-800 block mt-0.5">
              Rp {{ formatRupiah(cashSales + cashInflow) }}
            </span>
            <span v-if="cashInflow > 0" class="text-[9px] text-emerald-600 block">
              (Tip: Rp {{ formatRupiah(cashInflow) }})
            </span>
          </div>

          <div class="p-2 bg-amber-50/60 border border-amber-200 rounded">
            <span class="text-[9.5px] text-amber-700 uppercase tracking-wider block font-semibold flex items-center gap-1">
              <ArrowDownRight :size="10" />
              3. (-) Keluar & Retur
            </span>
            <span class="text-xs font-bold font-mono text-amber-800 block mt-0.5">
              Rp {{ formatRupiah(cashOutflow + refundOutflow) }}
            </span>
            <span v-if="refundOutflow > 0" class="text-[9px] text-rose-600 block">
              (Retur: Rp {{ formatRupiah(refundOutflow) }})
            </span>
          </div>

          <div class="p-2 bg-blue-50/80 border border-blue-200 rounded">
            <span class="text-[9.5px] text-blue-700 uppercase tracking-wider block font-bold">Total Kas Seharusnya</span>
            <span class="text-xs font-extrabold font-mono text-blue-900 block mt-0.5">
              Rp {{ formatRupiah(expectedCash) }}
            </span>
          </div>
        </div>

        <!-- Non-Cash Sales Note -->
        <div class="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-600">
          <div class="flex items-center gap-1.5">
            <Receipt :size="12" class="text-gray-400" />
            <span>Non-Tunai (Transfer & QRIS - rekening toko):</span>
          </div>
          <span class="font-bold font-mono text-gray-800">Rp {{ formatRupiah(nonCashSales) }}</span>
        </div>

        <!-- 2. Physical Cash Counting Section (Compact, Tanpa Box Container) -->
        <div class="space-y-1.5 pt-1">
          <div class="flex items-center justify-between pb-1.5 border-b border-gray-200">
            <div class="flex items-center gap-1.5">
              <Calculator :size="13" class="text-gray-600" />
              <h3 class="font-bold text-gray-800 text-xs">Penghitungan Uang Fisik Laci (Kas Aktual)</h3>
            </div>
            <!-- Mode Switcher -->
            <div class="flex items-center bg-gray-100 p-0.5 rounded border border-gray-200">
              <button
                type="button"
                @click="countMode = 'denominations'"
                class="px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer"
                :class="countMode === 'denominations' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'"
              >
                Pecahan Lembaran
              </button>
              <button
                type="button"
                @click="countMode = 'direct'"
                class="px-2 py-0.5 rounded text-[10px] font-semibold transition-all cursor-pointer"
                :class="countMode === 'direct' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-gray-500 hover:text-gray-800'"
              >
                Input Total Sekaligus
              </button>
            </div>
          </div>

          <!-- Mode 1: Denomination Counter (Compact, Rapi & Tabular Aligned) -->
          <div v-if="countMode === 'denominations'" class="space-y-1.5 pt-1">
            <div class="grid grid-cols-2 gap-x-4">
              <!-- Kolom Kiri: 100k, 20k, 5k, 1k -->
              <div class="space-y-1">
                <!-- 100k -->
                <div class="flex items-center gap-1.5 py-1 px-1 border-b border-slate-100 hover:bg-slate-50 rounded transition-colors">
                  <span class="w-14 text-right font-mono font-bold text-[11px] text-rose-700 shrink-0">100.000</span>
                  <span class="w-3 text-center text-slate-400 font-mono text-[10px] shrink-0">×</span>
                  <input
                    v-model.number="counts.c100k"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-11 h-6 text-center font-mono font-bold text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-300 focus:border-blue-500 rounded outline-none shrink-0 transition-colors"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                  <span class="flex-1 text-right font-mono text-[10.5px] font-semibold text-slate-700 shrink-0">
                    {{ formatRupiah(counts.c100k * 100000) }}
                  </span>
                </div>

                <!-- 20k -->
                <div class="flex items-center gap-1.5 py-1 px-1 border-b border-slate-100 hover:bg-slate-50 rounded transition-colors">
                  <span class="w-14 text-right font-mono font-bold text-[11px] text-emerald-700 shrink-0">20.000</span>
                  <span class="w-3 text-center text-slate-400 font-mono text-[10px] shrink-0">×</span>
                  <input
                    v-model.number="counts.c20k"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-11 h-6 text-center font-mono font-bold text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-300 focus:border-blue-500 rounded outline-none shrink-0 transition-colors"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                  <span class="flex-1 text-right font-mono text-[10.5px] font-semibold text-slate-700 shrink-0">
                    {{ formatRupiah(counts.c20k * 20000) }}
                  </span>
                </div>

                <!-- 5k -->
                <div class="flex items-center gap-1.5 py-1 px-1 border-b border-slate-100 hover:bg-slate-50 rounded transition-colors">
                  <span class="w-14 text-right font-mono font-bold text-[11px] text-amber-700 shrink-0">5.000</span>
                  <span class="w-3 text-center text-slate-400 font-mono text-[10px] shrink-0">×</span>
                  <input
                    v-model.number="counts.c5k"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-11 h-6 text-center font-mono font-bold text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-300 focus:border-blue-500 rounded outline-none shrink-0 transition-colors"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                  <span class="flex-1 text-right font-mono text-[10.5px] font-semibold text-slate-700 shrink-0">
                    {{ formatRupiah(counts.c5k * 5000) }}
                  </span>
                </div>

                <!-- 1k -->
                <div class="flex items-center gap-1.5 py-1 px-1 border-b border-slate-100 hover:bg-slate-50 rounded transition-colors">
                  <span class="w-14 text-right font-mono font-bold text-[11px] text-cyan-700 shrink-0">1.000</span>
                  <span class="w-3 text-center text-slate-400 font-mono text-[10px] shrink-0">×</span>
                  <input
                    v-model.number="counts.c1k"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-11 h-6 text-center font-mono font-bold text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-300 focus:border-blue-500 rounded outline-none shrink-0 transition-colors"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                  <span class="flex-1 text-right font-mono text-[10.5px] font-semibold text-slate-700 shrink-0">
                    {{ formatRupiah(counts.c1k * 1000) }}
                  </span>
                </div>
              </div>

              <!-- Kolom Kanan: 50k, 10k, 2k, Koin -->
              <div class="space-y-1">
                <!-- 50k -->
                <div class="flex items-center gap-1.5 py-1 px-1 border-b border-slate-100 hover:bg-slate-50 rounded transition-colors">
                  <span class="w-14 text-right font-mono font-bold text-[11px] text-blue-700 shrink-0">50.000</span>
                  <span class="w-3 text-center text-slate-400 font-mono text-[10px] shrink-0">×</span>
                  <input
                    v-model.number="counts.c50k"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-11 h-6 text-center font-mono font-bold text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-300 focus:border-blue-500 rounded outline-none shrink-0 transition-colors"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                  <span class="flex-1 text-right font-mono text-[10.5px] font-semibold text-slate-700 shrink-0">
                    {{ formatRupiah(counts.c50k * 50000) }}
                  </span>
                </div>

                <!-- 10k -->
                <div class="flex items-center gap-1.5 py-1 px-1 border-b border-slate-100 hover:bg-slate-50 rounded transition-colors">
                  <span class="w-14 text-right font-mono font-bold text-[11px] text-purple-700 shrink-0">10.000</span>
                  <span class="w-3 text-center text-slate-400 font-mono text-[10px] shrink-0">×</span>
                  <input
                    v-model.number="counts.c10k"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-11 h-6 text-center font-mono font-bold text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-300 focus:border-blue-500 rounded outline-none shrink-0 transition-colors"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                  <span class="flex-1 text-right font-mono text-[10.5px] font-semibold text-slate-700 shrink-0">
                    {{ formatRupiah(counts.c10k * 10000) }}
                  </span>
                </div>

                <!-- 2k -->
                <div class="flex items-center gap-1.5 py-1 px-1 border-b border-slate-100 hover:bg-slate-50 rounded transition-colors">
                  <span class="w-14 text-right font-mono font-bold text-[11px] text-gray-700 shrink-0">2.000</span>
                  <span class="w-3 text-center text-slate-400 font-mono text-[10px] shrink-0">×</span>
                  <input
                    v-model.number="counts.c2k"
                    type="number"
                    min="0"
                    placeholder="0"
                    class="w-11 h-6 text-center font-mono font-bold text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-300 focus:border-blue-500 rounded outline-none shrink-0 transition-colors"
                    @focus="($event.target as HTMLInputElement).select()"
                  />
                  <span class="flex-1 text-right font-mono text-[10.5px] font-semibold text-slate-700 shrink-0">
                    {{ formatRupiah(counts.c2k * 2000) }}
                  </span>
                </div>

                <!-- Koin / Receh -->
                <div class="flex items-center gap-1.5 py-1 px-1 border-b border-slate-100 hover:bg-slate-50 rounded transition-colors">
                  <span class="w-14 text-right font-bold text-[11px] text-slate-600 shrink-0 flex items-center justify-end gap-1">
                    <Coins :size="11" class="text-slate-400 shrink-0" /> Koin
                  </span>
                  <div class="flex items-center justify-end gap-1 flex-1">
                    <span class="text-slate-400 font-mono text-[10px]">Rp</span>
                    <input
                      v-model.number="counts.cCoins"
                      type="number"
                      min="0"
                      step="100"
                      placeholder="0"
                      class="w-20 h-6 text-right px-1.5 font-mono font-bold text-xs bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-300 focus:border-blue-500 rounded outline-none transition-colors"
                      @focus="($event.target as HTMLInputElement).select()"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Total Fisik Terhitung Ringkas -->
            <div class="flex items-center justify-between pt-1.5 px-1 border-t border-slate-200 text-xs">
              <span class="text-slate-500 font-semibold text-[11px]">Total Fisik Terhitung:</span>
              <span class="font-mono font-black text-xs text-slate-900">Rp {{ formatRupiah(denominationTotal) }}</span>
            </div>
          </div>

          <!-- Mode 2: Direct Input (Compact Inline) -->
          <div v-else class="flex items-center justify-between py-2 px-1 text-xs">
            <label class="font-semibold text-gray-700">
              Total Uang Fisik di Laci:
            </label>
            <div class="relative w-44">
              <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 font-mono">Rp</span>
              <input
                :value="formatRupiah(directCash)"
                @input="onDirectInput"
                type="text"
                placeholder="0"
                class="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-gray-300 rounded font-bold font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none text-right"
              />
            </div>
          </div>
        </div>

        <!-- 3. REAL-TIME RECONCILIATION RESULT BADGE (Compact) -->
        <div
          class="py-2.5 px-3 rounded-lg border transition-all flex items-center justify-between"
          :class="
            discrepancy === 0
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : discrepancy < 0
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
          "
        >
          <div class="flex items-center gap-2.5">
            <div
              class="p-1.5 rounded-full shrink-0"
              :class="
                discrepancy === 0
                  ? 'bg-emerald-200 text-emerald-800'
                  : discrepancy < 0
                    ? 'bg-rose-200 text-rose-800'
                    : 'bg-amber-200 text-amber-800'
              "
            >
              <CheckCircle2 v-if="discrepancy === 0" :size="18" />
              <AlertCircle v-else-if="discrepancy < 0" :size="18" />
              <AlertTriangle v-else :size="18" />
            </div>
            <div>
              <span class="text-xs font-bold uppercase tracking-wider block">
                {{
                  discrepancy === 0
                    ? 'KAS PAS (100% BALANCE)'
                    : discrepancy < 0
                      ? 'KAS MINUS / TEKOR'
                      : 'KAS LEBIH'
                }}
              </span>
              <p class="text-[10.5px] opacity-80">
                Fisik: <strong>Rp {{ formatRupiah(actualCashTotal) }}</strong> vs Seharusnya: <strong>Rp {{ formatRupiah(expectedCash) }}</strong>
              </p>
            </div>
          </div>

          <div class="text-right shrink-0">
            <span class="text-[9.5px] block opacity-70 font-semibold uppercase">Selisih</span>
            <span
              class="text-sm font-black font-mono"
              :class="
                discrepancy === 0
                  ? 'text-emerald-700'
                  : discrepancy < 0
                    ? 'text-rose-700'
                    : 'text-amber-700'
              "
            >
              {{ discrepancy > 0 ? '+' : '' }}Rp {{ formatRupiah(discrepancy) }}
            </span>
          </div>
        </div>

        <!-- 4. PEMINDAHAN KAS KE BENDAHARA (Compact, Tanpa Box Container) -->
        <div class="space-y-1.5 pt-1.5 border-t border-gray-200">
          <div class="flex items-center justify-between pb-1">
            <div class="flex items-center gap-1.5 font-bold text-gray-800 text-xs">
              <Coins :size="13" class="text-blue-700" />
              <span>Pemindahan Kas & Setoran ke Bendahara</span>
            </div>
            <span class="text-[10px] font-mono text-gray-500">
              Alokasi Kas Laci
            </span>
          </div>

          <div class="divide-y divide-gray-100 text-xs">
            <!-- 1. Disetor ke Bendahara -->
            <div class="flex items-center justify-between py-1.5 gap-2">
              <div>
                <span class="text-xs font-bold text-gray-800 block">
                  1. Disetor ke Bendahara (Setoran Tunai)
                </span>
                <span class="text-[10px] text-gray-400 block">
                  Uang fisik yang diserahkan ke bendahara toko
                </span>
              </div>
              <span class="text-sm font-black font-mono text-blue-700 shrink-0">
                Rp {{ formatRupiah(transferredToTreasury) }}
              </span>
            </div>

            <!-- 2. Sisa di Laci Kasir -->
            <div class="flex items-center justify-between py-1.5 gap-2">
              <div>
                <span class="text-xs font-bold text-gray-800 block">
                  2. Sisa di Laci (Modal Shift Berikutnya)
                </span>
                <span class="text-[10px] text-gray-400 block">
                  Ditinggal di register sebagai modal shift kasir berikutnya
                </span>
              </div>
              <div class="relative w-32 shrink-0">
                <span class="absolute left-2 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-400 text-xs">Rp</span>
                <input
                  v-model.number="retainedInDrawer"
                  type="number"
                  min="0"
                  :max="actualCashTotal"
                  step="1000"
                  placeholder="0"
                  class="w-full pl-7 pr-2 py-1 bg-slate-50 border border-gray-300 rounded font-mono font-bold text-xs text-right text-gray-800 focus:ring-1 focus:ring-blue-500 focus:bg-white outline-none"
                />
              </div>
            </div>

            <!-- 3. Rekap Settlement Non-Tunai -->
            <div class="flex items-center justify-between py-1 text-[11px] text-gray-600">
              <span>Rekap Settlement Non-Tunai (QRIS & EDC Bank):</span>
              <span class="font-mono font-bold text-indigo-700">Rp {{ formatRupiah(nonCashSales) }}</span>
            </div>
          </div>
        </div>

        <!-- 5. Notes / Explanation (Compact) -->
        <div class="pt-1 border-t border-gray-200">
          <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1 flex items-center gap-1.5">
            <FileText :size="12" class="text-gray-500" />
            <span>Catatan Penutupan / Penjelasan Selisih (Jika ada)</span>
          </label>
          <textarea
            v-model="notes"
            rows="2"
            placeholder="Contoh: Selisih Rp 2.000 karena pembeli tidak ambil kembalian..."
            class="w-full px-2.5 py-1.5 bg-slate-50 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all resize-none"
          ></textarea>
        </div>
      </div>

      <!-- Modal Footer -->
      <div
        class="px-5 py-3 border-t border-gray-200 flex items-center justify-between gap-3 select-none shrink-0"
        style="background-color: var(--surface-ribbon, #f6f5f2);"
      >
        <span class="text-[10px] text-gray-400 font-mono">Ctrl + Enter untuk tutup shift</span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="isSubmitting"
            class="px-4 py-1.5 rounded text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
            @click="handleConfirmClose"
          >
            <LogOut :size="14" />
            <span>{{ isSubmitting ? 'Memproses...' : 'Tutup & Rekonsiliasi Shift' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
