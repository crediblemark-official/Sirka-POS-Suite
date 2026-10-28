<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { formatRupiah } from '../../utils/formatters';
import { X, Calculator, Check, RotateCcw, DollarSign, Percent, Tag, Info, ArrowDown } from 'lucide-vue-next';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const posStore = usePosStore();

type AdjustMode = 'finalTotal' | 'discountNominal' | 'discountPercent';
const activeMode = ref<AdjustMode>('finalTotal');

// Base total sebelum diskon manual (setelah kupon & poin)
const baseTotal = computed(() => {
  const otherDiscounts = posStore.voucherDiscountAmount + posStore.memberTierDiscountAmount + posStore.pointsDiscountAmount;
  return Math.max(0, posStore.totalSell - otherDiscounts);
});

const finalTotalInput = ref<number>(0);
const discountNominalInput = ref<number>(0);
const discountPercentInput = ref<number>(0);

const finalInputRef = ref<HTMLInputElement | null>(null);
const nominalInputRef = ref<HTMLInputElement | null>(null);
const percentInputRef = ref<HTMLInputElement | null>(null);

// Estimasi modal barang belanjaan di keranjang
const totalBuyCost = computed(() => posStore.totalBuy);

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      const base = baseTotal.value;
      const currentFinal = posStore.finalTotal;
      const currentDiscNominal = posStore.manualDiscountNominal;
      const currentDiscPercent = posStore.manualDiscountPercent;

      if (currentDiscNominal > 0) {
        activeMode.value = 'discountNominal';
        discountNominalInput.value = currentDiscNominal;
        finalTotalInput.value = Math.max(0, base - currentDiscNominal);
        discountPercentInput.value = base > 0 ? Number(((currentDiscNominal / base) * 100).toFixed(1)) : 0;
      } else if (currentDiscPercent > 0) {
        activeMode.value = 'discountPercent';
        discountPercentInput.value = currentDiscPercent;
        const nom = Math.round(base * (currentDiscPercent / 100));
        discountNominalInput.value = nom;
        finalTotalInput.value = Math.max(0, base - nom);
      } else {
        activeMode.value = 'finalTotal';
        finalTotalInput.value = currentFinal;
        discountNominalInput.value = 0;
        discountPercentInput.value = 0;
      }

      nextTick(() => {
        focusCurrentInput();
      });
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

function switchMode(mode: AdjustMode) {
  activeMode.value = mode;
  nextTick(() => {
    focusCurrentInput();
  });
}

function focusCurrentInput() {
  if (activeMode.value === 'finalTotal') {
    finalInputRef.value?.focus();
    finalInputRef.value?.select();
  } else if (activeMode.value === 'discountNominal') {
    nominalInputRef.value?.focus();
    nominalInputRef.value?.select();
  } else if (activeMode.value === 'discountPercent') {
    percentInputRef.value?.focus();
    percentInputRef.value?.select();
  }
}

function onFinalTotalChange(val: number) {
  const base = baseTotal.value;
  finalTotalInput.value = Math.max(0, val);
  // BUG FIX: total yang diketik LEBIH BESAR dari base tidak mungkin dicapai
  // (diskon tidak boleh negatif). Sebelumnya `Math.max(0, base - final)` membuat
  // diskon 0 sementara pratinjau tetap menampilkan total yang diketik ->
  // kasir mengonfirmasi Rp 600.000 padahal yang ditagih Rp 500.000.
  if (finalTotalInput.value > base) {
    finalTotalInput.value = base;
  }
  const diff = Math.max(0, base - finalTotalInput.value);
  discountNominalInput.value = diff;
  discountPercentInput.value = base > 0 ? Number(((diff / base) * 100).toFixed(1)) : 0;
}

function onDiscountNominalChange(val: number) {
  const base = baseTotal.value;
  discountNominalInput.value = Math.max(0, val);
  finalTotalInput.value = Math.max(0, base - discountNominalInput.value);
  discountPercentInput.value = base > 0 ? Number(((discountNominalInput.value / base) * 100).toFixed(1)) : 0;
}

function onDiscountPercentChange(val: number) {
  const base = baseTotal.value;
  discountPercentInput.value = Math.max(0, val);
  const nom = Math.round(base * (discountPercentInput.value / 100));
  discountNominalInput.value = nom;
  finalTotalInput.value = Math.max(0, base - nom);
}

function resetToDefault() {
  const base = baseTotal.value;
  finalTotalInput.value = base;
  discountNominalInput.value = 0;
  discountPercentInput.value = 0;
}

// Perhitungan profit simulasi saat nego total
const simulatedProfit = computed(() => {
  const finalSell = finalTotalInput.value;
  return Math.max(-totalBuyCost.value, finalSell - totalBuyCost.value);
});

const simulatedProfitPercent = computed(() => {
  if (totalBuyCost.value <= 0) return 0;
  return Number(((simulatedProfit.value / totalBuyCost.value) * 100).toFixed(1));
});

function handleSave() {
  // BUG FIX: simpan NOMINAL hasil pratinjau (bukan persen).
  // Store menghitung diskon manual persen dari `totalSell`, sedangkan modal
  // mempratinjau dari `baseTotal` (setelah kupon/tier/poin) -> nominal yang
  // disetujui kasir berbeda dari yang benar-benar ditagih.
  if (discountNominalInput.value <= 0) {
    posStore.setManualDiscountByNominal(0, 0);
  } else {
    posStore.setManualDiscountByNominal(
      discountNominalInput.value,
      activeMode.value === 'discountPercent' ? discountPercentInput.value : 0
    );
  }
  emit('close');
}

function handleKeyDown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  } else if (e.key === 'Enter') {
    e.preventDefault();
    handleSave();
  }
}

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => props.isOpen);
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 w-full sm:max-w-md max-h-[92vh] sm:max-h-[88vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 sm:zoom-in-95 text-xs"
    >
      <!-- Mobile Pull Indicator -->
      <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0"></div>

      <!-- Header Modal -->
      <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-slate-50 shrink-0">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
            <Calculator :size="16" />
          </div>
          <div>
            <h3 class="font-bold text-gray-900 text-xs sm:text-sm">Negosiasi Total Tagihan / Pembulatan</h3>
            <p class="text-[10.5px] text-gray-500">Sesuaikan total bayar akhir atau beri diskon nota</p>
          </div>
        </div>
        <button
          type="button"
          class="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 cursor-pointer transition-colors"
          @click="emit('close')"
        >
          <X :size="15" />
        </button>
      </div>

      <!-- Info Banner Total Asli & Modal Belanja -->
      <div class="px-4 py-2.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between shrink-0">
        <div>
          <div class="text-[10px] text-gray-500">Total Tagihan Awal (Normal):</div>
          <div class="font-mono font-bold text-sm text-gray-900">
            Rp {{ formatRupiah(baseTotal) }}
          </div>
        </div>
        <div class="text-right font-mono">
          <div class="text-[10px] text-gray-500 font-sans">Total Modal Kulakan:</div>
          <div class="font-bold text-gray-700">
            Rp {{ formatRupiah(totalBuyCost) }}
          </div>
        </div>
      </div>

      <!-- Body Form -->
      <div class="p-4 space-y-4 flex-1 overflow-y-auto">
        <!-- Switch Mode Segmented Buttons -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              PILIH CARA NEGO:
            </span>
            <button
              v-if="discountNominalInput > 0"
              type="button"
              class="text-[10px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
              title="Kembalikan total ke nilai normal"
              @click="resetToDefault"
            >
              <RotateCcw :size="10" />
              <span>Reset ke Total Awal</span>
            </button>
          </div>

          <div class="p-1 bg-gray-100 rounded-lg flex items-center gap-1 border border-gray-200">
            <button
              type="button"
              class="flex-1 py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              :class="activeMode === 'finalTotal'
                ? 'bg-white text-blue-700 shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-800'"
              @click="switchMode('finalTotal')"
            >
              <Tag :size="12" />
              <span>Total Pas</span>
            </button>
            <button
              type="button"
              class="flex-1 py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              :class="activeMode === 'discountNominal'
                ? 'bg-white text-rose-700 shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-800'"
              @click="switchMode('discountNominal')"
            >
              <DollarSign :size="12" />
              <span>-Rp Potongan</span>
            </button>
            <button
              type="button"
              class="flex-1 py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              :class="activeMode === 'discountPercent'
                ? 'bg-white text-emerald-700 shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-800'"
              @click="switchMode('discountPercent')"
            >
              <Percent :size="12" />
              <span>-% Diskon</span>
            </button>
          </div>
        </div>

        <!-- Input Box Sesuai Mode Aktif -->
        <div class="min-h-[105px]">
          <!-- Mode 1: Ketik Langsung Total Akhir -->
          <div
            v-if="activeMode === 'finalTotal'"
            class="p-3 bg-blue-50/50 border border-blue-300 rounded-lg space-y-2 animate-in fade-in duration-150"
          >
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-gray-800">
                Ketik Nominal Total Akhir (yang dibayar):
              </label>
              <span class="text-[10px] text-gray-500">Contoh: pembulatan Rp 80.000</span>
            </div>
            <div class="relative flex items-center">
              <span class="absolute left-3 text-sm font-bold font-mono text-blue-700">Rp</span>
              <input
                ref="finalInputRef"
                type="text"
                inputmode="numeric"
                :value="finalTotalInput ? formatRupiah(finalTotalInput) : ''"
                class="w-full h-10 pl-11 pr-3 text-right font-mono font-bold text-base bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                placeholder="0"
                @input="(e: any) => {
                  const val = Number(e.target.value.replace(/\D/g, '')) || 0;
                  onFinalTotalChange(val);
                }"
              />
            </div>
            <div v-if="discountNominalInput > 0" class="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
              <ArrowDown :size="12" />
              <span>Potongan otomatis: -Rp {{ formatRupiah(discountNominalInput) }} ({{ discountPercentInput }}%)</span>
            </div>
          </div>

          <!-- Mode 2: Nominal Potongan (-Rp) -->
          <div
            v-else-if="activeMode === 'discountNominal'"
            class="p-3 bg-rose-50/50 border border-rose-300 rounded-lg space-y-2 animate-in fade-in duration-150"
          >
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-gray-800">
                Ketik Potongan Harga Nota (-Rp):
              </label>
              <span class="text-[10px] text-gray-500">Dipotong dari total nota</span>
            </div>
            <div class="relative flex items-center">
              <span class="absolute left-3 text-sm font-bold font-mono text-rose-700">-Rp</span>
              <input
                ref="nominalInputRef"
                type="text"
                inputmode="numeric"
                :value="discountNominalInput ? formatRupiah(discountNominalInput) : ''"
                class="w-full h-10 pl-14 pr-3 text-right font-mono font-bold text-base bg-white border border-gray-300 rounded-md outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 transition-all"
                placeholder="0"
                @input="(e: any) => {
                  const val = Number(e.target.value.replace(/\D/g, '')) || 0;
                  onDiscountNominalChange(val);
                }"
              />
            </div>
            <!-- Preset Cepat Potongan Nominal -->
            <div class="flex items-center gap-1.5 pt-1 flex-wrap">
              <span class="text-[10px] text-gray-400">Pilihan cepat:</span>
              <button
                v-for="nom in [1000, 2000, 5000, 10000, 15000, 20000, 50000]"
                :key="nom"
                type="button"
                class="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold cursor-pointer transition-colors"
                :class="discountNominalInput === nom
                  ? 'bg-rose-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-rose-50 hover:border-rose-300'"
                @click="onDiscountNominalChange(nom)"
              >
                -{{ nom >= 1000 ? `${nom / 1000}k` : nom }}
              </button>
            </div>
          </div>

          <!-- Mode 3: Persentase Diskon (-%) -->
          <div
            v-else-if="activeMode === 'discountPercent'"
            class="p-3 bg-emerald-50/50 border border-emerald-300 rounded-lg space-y-2 animate-in fade-in duration-150"
          >
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-gray-800">
                Ketik Diskon Persentase Nota (-%):
              </label>
              <span class="text-[10px] text-gray-500">% dari total tagihan</span>
            </div>
            <div class="relative flex items-center">
              <input
                ref="percentInputRef"
                type="text"
                inputmode="decimal"
                :value="discountPercentInput || ''"
                class="w-full h-10 px-3 pr-9 text-right font-mono font-bold text-base bg-white border border-gray-300 rounded-md outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                placeholder="0"
                @input="(e: any) => {
                  const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                  const num = parseFloat(raw);
                  onDiscountPercentChange(isNaN(num) ? 0 : num);
                }"
              />
              <span class="absolute right-3 text-sm font-bold font-mono text-emerald-700">%</span>
            </div>
            <!-- Preset Cepat Persentase -->
            <div class="flex items-center gap-1.5 pt-1 flex-wrap">
              <span class="text-[10px] text-gray-400">Pilihan cepat:</span>
              <button
                v-for="pct in [2, 3, 5, 10, 15, 20]"
                :key="pct"
                type="button"
                class="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold cursor-pointer transition-colors"
                :class="discountPercentInput === pct
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300'"
                @click="onDiscountPercentChange(pct)"
              >
                -{{ pct }}%
              </button>
            </div>
          </div>
        </div>

        <!-- Hasil Ringkasan Bersih Preview -->
        <div class="p-3 bg-slate-100 rounded-lg flex items-center justify-between text-xs font-mono border border-slate-200">
          <div>
            <div class="text-[10px] text-gray-500 font-sans">Total Tagihan Akhir:</div>
            <div class="flex items-baseline gap-1.5">
              <span v-if="discountNominalInput > 0" class="line-through text-xs text-gray-400 font-normal">
                Rp {{ formatRupiah(baseTotal) }}
              </span>
              <span class="text-base font-bold text-blue-700">
                Rp {{ formatRupiah(finalTotalInput) }}
              </span>
            </div>
            <div v-if="discountNominalInput > 0" class="text-[10.5px] font-bold text-rose-600 font-sans flex items-center gap-1 mt-0.5">
              <Tag :size="11" />
              <span>Potongan: -Rp {{ formatRupiah(discountNominalInput) }} ({{ discountPercentInput }}%)</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[10px] text-gray-500 font-sans">Estimasi Laba Toko:</div>
            <div
              class="text-xs font-bold font-mono"
              :class="simulatedProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'"
            >
              {{ simulatedProfit >= 0 ? '+Rp' : '-Rp' }} {{ formatRupiah(Math.abs(simulatedProfit)) }} ({{ simulatedProfitPercent }}%)
            </div>
            <div class="text-[10px] font-sans font-medium mt-0.5" :class="simulatedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600 font-bold'">
              {{ simulatedProfit >= 0 ? 'Masih untung dari modal' : '⚠️ Di bawah modal kulakan!' }}
            </div>
          </div>
        </div>

        <!-- Info Keamanan Data Master -->
        <div class="flex items-center gap-1.5 text-[10.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
          <Info :size="12" class="text-blue-500 shrink-0" />
          <span>Negosiasi total hanya berlaku untuk transaksi saat ini dan tercatat di nota pembayaran.</span>
        </div>
      </div>

      <!-- Footer Action Buttons -->
      <div class="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded font-medium cursor-pointer transition-colors"
          @click="emit('close')"
        >
          Batal (Esc)
        </button>
        <button
          type="button"
          class="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
          @click="handleSave"
        >
          <Check :size="14" />
          <span>Terapkan Total (Enter)</span>
        </button>
      </div>
    </div>
  </div>
</template>
