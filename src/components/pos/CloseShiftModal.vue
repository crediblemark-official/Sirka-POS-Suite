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
      <div class="p-5 overflow-y-auto space-y-4 text-xs">
        <!-- 1. Expected Cash Breakdown Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div class="p-2.5 bg-gray-50 border border-gray-200 rounded-md">
            <span class="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">1. Modal Awal</span>
            <span class="text-xs font-bold font-mono text-gray-800 block mt-1">
              Rp {{ formatRupiah(startingCash) }}
            </span>
          </div>

          <div class="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded-md">
            <span class="text-[10px] text-emerald-700 uppercase tracking-wider block font-semibold flex items-center gap-1">
              <TrendingUp :size="11" />
              2. (+) Jual Tunai & Tip
            </span>
            <span class="text-xs font-bold font-mono text-emerald-800 block mt-1">
              Rp {{ formatRupiah(cashSales + cashInflow) }}
            </span>
            <span v-if="cashInflow > 0" class="text-[9.5px] text-emerald-600 block mt-0.5">
              (Termasuk Infaq/Tip: Rp {{ formatRupiah(cashInflow) }})
            </span>
          </div>

          <div class="p-2.5 bg-amber-50/60 border border-amber-200 rounded-md">
            <span class="text-[10px] text-amber-700 uppercase tracking-wider block font-semibold flex items-center gap-1">
              <ArrowDownRight :size="11" />
              3. (-) Keluar & Retur
            </span>
            <span class="text-xs font-bold font-mono text-amber-800 block mt-1">
              Rp {{ formatRupiah(cashOutflow + refundOutflow) }}
            </span>
            <span v-if="refundOutflow > 0" class="text-[9.5px] text-rose-600 block mt-0.5">
              (Retur Tunai: Rp {{ formatRupiah(refundOutflow) }})
            </span>
          </div>

          <div class="p-2.5 bg-blue-50/80 border border-blue-200 rounded-md">
            <span class="text-[10px] text-blue-700 uppercase tracking-wider block font-bold">Total Kas Seharusnya</span>
            <span class="text-xs font-extrabold font-mono text-blue-900 block mt-1">
              Rp {{ formatRupiah(expectedCash) }}
            </span>
          </div>
        </div>

        <!-- Non-Cash Sales Note -->
        <div class="flex items-center justify-between px-3 py-1.5 bg-gray-100/70 border border-gray-200 rounded text-[11px] text-gray-600">
          <div class="flex items-center gap-1.5">
            <Receipt :size="13" class="text-gray-400" />
            <span>Non-Tunai (Transfer Bank & QRIS - masuk rekening langsung):</span>
          </div>
          <span class="font-bold font-mono text-gray-800">Rp {{ formatRupiah(nonCashSales) }}</span>
        </div>

        <!-- 2. Physical Cash Counting Section -->
        <div class="border border-gray-300 rounded-lg p-3.5 bg-white">
          <div class="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
            <div class="flex items-center gap-2">
              <Calculator :size="15" class="text-gray-600" />
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

          <!-- Mode 1: Denomination Counter -->
          <div v-if="countMode === 'denominations'" class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <!-- 100k -->
            <div class="p-2 border border-gray-200 rounded bg-gray-50/50">
              <div class="flex justify-between items-center text-[10px] text-gray-600 mb-1">
                <span class="font-bold text-rose-700">Rp 100.000</span>
                <span class="font-mono text-gray-400">x lembar</span>
              </div>
              <input
                v-model.number="counts.c100k"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono font-bold text-center focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span class="block text-[10px] text-right font-mono text-gray-500 mt-1">
                Rp {{ formatRupiah(counts.c100k * 100000) }}
              </span>
            </div>

            <!-- 50k -->
            <div class="p-2 border border-gray-200 rounded bg-gray-50/50">
              <div class="flex justify-between items-center text-[10px] text-gray-600 mb-1">
                <span class="font-bold text-blue-700">Rp 50.000</span>
                <span class="font-mono text-gray-400">x lembar</span>
              </div>
              <input
                v-model.number="counts.c50k"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono font-bold text-center focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span class="block text-[10px] text-right font-mono text-gray-500 mt-1">
                Rp {{ formatRupiah(counts.c50k * 50000) }}
              </span>
            </div>

            <!-- 20k -->
            <div class="p-2 border border-gray-200 rounded bg-gray-50/50">
              <div class="flex justify-between items-center text-[10px] text-gray-600 mb-1">
                <span class="font-bold text-emerald-700">Rp 20.000</span>
                <span class="font-mono text-gray-400">x lembar</span>
              </div>
              <input
                v-model.number="counts.c20k"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono font-bold text-center focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span class="block text-[10px] text-right font-mono text-gray-500 mt-1">
                Rp {{ formatRupiah(counts.c20k * 20000) }}
              </span>
            </div>

            <!-- 10k -->
            <div class="p-2 border border-gray-200 rounded bg-gray-50/50">
              <div class="flex justify-between items-center text-[10px] text-gray-600 mb-1">
                <span class="font-bold text-purple-700">Rp 10.000</span>
                <span class="font-mono text-gray-400">x lembar</span>
              </div>
              <input
                v-model.number="counts.c10k"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono font-bold text-center focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span class="block text-[10px] text-right font-mono text-gray-500 mt-1">
                Rp {{ formatRupiah(counts.c10k * 10000) }}
              </span>
            </div>

            <!-- 5k -->
            <div class="p-2 border border-gray-200 rounded bg-gray-50/50">
              <div class="flex justify-between items-center text-[10px] text-gray-600 mb-1">
                <span class="font-bold text-amber-700">Rp 5.000</span>
                <span class="font-mono text-gray-400">x lembar</span>
              </div>
              <input
                v-model.number="counts.c5k"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono font-bold text-center focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span class="block text-[10px] text-right font-mono text-gray-500 mt-1">
                Rp {{ formatRupiah(counts.c5k * 5000) }}
              </span>
            </div>

            <!-- 2k -->
            <div class="p-2 border border-gray-200 rounded bg-gray-50/50">
              <div class="flex justify-between items-center text-[10px] text-gray-600 mb-1">
                <span class="font-bold text-gray-700">Rp 2.000</span>
                <span class="font-mono text-gray-400">x lembar</span>
              </div>
              <input
                v-model.number="counts.c2k"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono font-bold text-center focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span class="block text-[10px] text-right font-mono text-gray-500 mt-1">
                Rp {{ formatRupiah(counts.c2k * 2000) }}
              </span>
            </div>

            <!-- 1k -->
            <div class="p-2 border border-gray-200 rounded bg-gray-50/50">
              <div class="flex justify-between items-center text-[10px] text-gray-600 mb-1">
                <span class="font-bold text-cyan-700">Rp 1.000</span>
                <span class="font-mono text-gray-400">x lembar</span>
              </div>
              <input
                v-model.number="counts.c1k"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono font-bold text-center focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span class="block text-[10px] text-right font-mono text-gray-500 mt-1">
                Rp {{ formatRupiah(counts.c1k * 1000) }}
              </span>
            </div>

            <!-- Coins -->
            <div class="p-2 border border-gray-200 rounded bg-gray-50/50">
              <div class="flex justify-between items-center text-[10px] text-gray-600 mb-1">
                <span class="font-bold text-slate-700 flex items-center gap-1">
                  <Coins :size="11" /> Koin / Receh
                </span>
                <span class="font-mono text-gray-400">Rp total</span>
              </div>
              <input
                v-model.number="counts.cCoins"
                type="number"
                min="0"
                class="w-full px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono font-bold text-center focus:ring-1 focus:ring-blue-500 outline-none"
              />
              <span class="block text-[10px] text-right font-mono text-gray-500 mt-1">
                Rp {{ formatRupiah(counts.cCoins || 0) }}
              </span>
            </div>
          </div>

          <!-- Mode 2: Direct Input -->
          <div v-else class="space-y-2 py-2">
            <label class="block text-[11px] font-semibold text-gray-700">
              Total Uang Fisik yang Dihitung di Laci Kasir:
            </label>
            <div class="relative max-w-sm">
              <span class="absolute left-3 top-2.5 text-xs font-bold text-gray-400 font-mono">Rp</span>
              <input
                :value="formatRupiah(directCash)"
                @input="onDirectInput"
                type="text"
                placeholder="0"
                class="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-sm font-bold font-mono focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              />
            </div>
          </div>
        </div>

        <!-- 3. REAL-TIME RECONCILIATION RESULT BADGE -->
        <div
          class="p-4 rounded-lg border transition-all flex items-center justify-between"
          :class="
            discrepancy === 0
              ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
              : discrepancy < 0
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
          "
        >
          <div class="flex items-center gap-3">
            <div
              class="p-2 rounded-full shrink-0"
              :class="
                discrepancy === 0
                  ? 'bg-emerald-200 text-emerald-800'
                  : discrepancy < 0
                    ? 'bg-rose-200 text-rose-800'
                    : 'bg-amber-200 text-amber-800'
              "
            >
              <CheckCircle2 v-if="discrepancy === 0" :size="24" />
              <AlertCircle v-else-if="discrepancy < 0" :size="24" />
              <AlertTriangle v-else :size="24" />
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase tracking-wider">
                  {{
                    discrepancy === 0
                      ? 'KAS COCOK / PAS (100% BALANCE)'
                      : discrepancy < 0
                        ? 'KAS MINUS / TEKOR (UANG FISIK KURANG)'
                        : 'KAS LEBIH (UANG FISIK LEBIH BANYAK)'
                  }}
                </span>
              </div>
              <p class="text-[11px] opacity-80 mt-0.5">
                Uang Fisik Aktual: <strong>Rp {{ formatRupiah(actualCashTotal) }}</strong> vs Seharusnya: <strong>Rp {{ formatRupiah(expectedCash) }}</strong>
              </p>
            </div>
          </div>

          <div class="text-right">
            <span class="text-[10px] block opacity-70 font-semibold uppercase">Selisih Kas</span>
            <span
              class="text-base font-extrabold font-mono"
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

        <!-- 4. PEMINDAHAN KAS KE BENDAHARA (Poin 10) -->
        <div class="p-3.5 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/90 rounded-xl space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Coins :size="16" class="text-blue-700" />
              <h3 class="font-bold text-gray-900 text-xs">Pemindahan Kas & Setoran ke Bendahara</h3>
            </div>
            <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
              Alokasi Kas Fisik Laci
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Disetor ke Bendahara -->
            <div class="p-3 bg-white border border-blue-200 rounded-lg shadow-2xs">
              <span class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block">
                1. Disetor ke Bendahara (Setoran Tunai)
              </span>
              <span class="text-base font-black font-mono text-blue-700 block mt-1">
                Rp {{ formatRupiah(transferredToTreasury) }}
              </span>
              <span class="text-[10px] text-gray-400 block mt-0.5">
                Uang yang diserahkan fisik ke bendahara toko
              </span>
            </div>

            <!-- Sisa di Laci Kasir -->
            <div class="p-3 bg-white border border-blue-200 rounded-lg shadow-2xs">
              <label class="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">
                2. Sisa di Laci (Modal Shift Berikutnya)
              </label>
              <div class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-gray-400 text-xs">Rp</span>
                <input
                  v-model.number="retainedInDrawer"
                  type="number"
                  min="0"
                  :max="actualCashTotal"
                  step="1000"
                  placeholder="0"
                  class="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded font-mono font-bold text-xs text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <span class="text-[10px] text-gray-400 block mt-1">
                Ditinggal di register sebagai modal kasir berikutnya
              </span>
            </div>
          </div>

          <!-- Rekap QRIS & Non Tunai -->
          <div class="flex items-center justify-between px-3 py-2 bg-white/80 border border-blue-100 rounded text-[11px] text-gray-700">
            <span>Rekap Settlement Non-Tunai (QRIS & EDC Bank untuk Bendahara):</span>
            <span class="font-mono font-bold text-indigo-700">Rp {{ formatRupiah(nonCashSales) }}</span>
          </div>
        </div>

        <!-- 5. Notes / Explanation -->
        <div>
          <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <FileText :size="13" class="text-gray-500" />
            Catatan Penutupan / Penjelasan Selisih (Jika ada)
          </label>
          <textarea
            v-model="notes"
            rows="2"
            placeholder="Contoh: Selisih Rp 2.000 karena pembeli tidak ambil kembalian / selisih tekor Rp 1.000 salah hitung..."
            class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
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
