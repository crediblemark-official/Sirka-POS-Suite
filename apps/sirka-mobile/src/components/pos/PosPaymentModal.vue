<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { PaymentMethod } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

import {
  Receipt,
  X,
  Coins,
  CheckCircle2,
  Clock,
  Printer,
  Landmark,
  Banknote,
  QrCode,
  FileText,
  Heart,
  Check
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'confirm'): void;
}>();

const posStore = usePosStore();
const buyerStore = useBuyerStore();
const settingsStore = useSettingsStore();

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  icon: any;
}

const paymentMethodOptions: PaymentMethodOption[] = [
  { id: 'Tunai / Kas', label: 'Tunai / Kas', icon: Banknote },
  { id: 'Transfer Bank', label: 'Transfer Bank', icon: Landmark },
  { id: 'QRIS', label: 'QRIS', icon: QrCode },
  { id: 'Nota Tempo', label: 'Nota Tempo', icon: FileText }
];

function toggleRedeemPoints() {
  if (posStore.pointsToRedeem > 0) {
    posStore.setPointsToRedeem(0);
  } else {
    posStore.setPointsToRedeem(posStore.maxRedeemablePoints);
  }
}

// Logika Split Payment (Bayar Campur: Sebagian Tunai + Sebagian Non-Tunai)
function toggleSplitPayment() {
  posStore.isSplitPayment = !posStore.isSplitPayment;
  if (posStore.isSplitPayment) {
    // Default: Separuh tunai (atau 0) dan sisa non-tunai
    const total = posStore.finalTotal;
    if (posStore.splitCashAmount <= 0) {
      posStore.splitCashAmount = Math.round(total / 2);
    }
    posStore.splitNonCashAmount = Math.max(0, total - posStore.splitCashAmount);
    posStore.cashTendered = posStore.splitCashAmount;
  } else {
    posStore.splitCashAmount = 0;
    posStore.splitNonCashAmount = 0;
    posStore.cashTendered = posStore.finalTotal;
    posStore.infaqAmount = 0;
  }
}

function onSplitCashChange() {
  const cash = Math.max(0, Number(posStore.splitCashAmount) || 0);
  posStore.splitNonCashAmount = Math.max(0, posStore.finalTotal - cash);
  if (posStore.cashTendered < cash) {
    posStore.cashTendered = cash;
  }
}

function onSplitNonCashChange() {
  const nonCash = Math.max(0, Number(posStore.splitNonCashAmount) || 0);
  posStore.splitCashAmount = Math.max(0, posStore.finalTotal - nonCash);
  posStore.cashTendered = posStore.splitCashAmount;
}

const splitTotalCalculated = computed(() => {
  return (Number(posStore.splitCashAmount) || 0) + (Number(posStore.splitNonCashAmount) || 0);
});

const isSplitValid = computed(() => {
  if (!posStore.isSplitPayment) return true;
  return splitTotalCalculated.value >= posStore.finalTotal;
});

// Target Nominal Tunai yang harus dibayar
const requiredCash = computed(() => {
  if (posStore.isSplitPayment) {
    return Number(posStore.splitCashAmount) || 0;
  }
  return posStore.paymentMethod === 'Tunai / Kas' ? posStore.finalTotal : 0;
});

// Kalkulator Kembalian Uang Tunai
const rawChange = computed(() => {
  if (requiredCash.value <= 0) return 0;
  const tendered = Number(posStore.cashTendered) || 0;
  return Math.max(0, tendered - requiredCash.value);
});

const netChange = computed(() => {
  return Math.max(0, rawChange.value - (posStore.infaqAmount || 0));
});

function setExactCash() {
  posStore.cashTendered = requiredCash.value;
  posStore.infaqAmount = 0;
}

function addCashTendered(amount: number) {
  posStore.cashTendered = (Number(posStore.cashTendered) || 0) + amount;
}

function toggleInfaqChange() {
  if (posStore.infaqAmount > 0) {
    posStore.infaqAmount = 0;
  } else if (rawChange.value > 0) {
    posStore.infaqAmount = rawChange.value;
  }
}

function handleConfirm() {
  if (posStore.isCheckingOut) return;
  if (posStore.isSplitPayment && !isSplitValid.value) return;
  emit('confirm');
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    if (!posStore.isCheckingOut) {
      e.preventDefault();
      e.stopPropagation();
      emit('close');
    }
  } else if (e.key === 'Enter') {
    if (!posStore.isCheckingOut && isSplitValid.value) {
      e.preventDefault();
      handleConfirm();
    }
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeydown);
      if (!posStore.isSplitPayment && posStore.paymentMethod === 'Tunai / Kas') {
        posStore.cashTendered = posStore.finalTotal;
      }
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => props.isOpen);
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 select-none text-xs animate-in fade-in duration-150"
    @click.self="!posStore.isCheckingOut && emit('close')"
  >
    <div class="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom duration-200">
      <!-- Mobile Pull Indicator & Header -->
      <div class="pt-2 px-4 pb-3 bg-slate-100 border-b border-slate-200 flex flex-col shrink-0">
        <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-2 sm:hidden"></div>
        <div class="flex items-center justify-between font-bold text-slate-800">
          <div class="flex items-center gap-2 text-sm">
            <Receipt :size="18" class="text-blue-600" />
            <span>Pembayaran Kasir</span>
          </div>
          <button
            type="button"
            class="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg cursor-pointer transition-colors"
            @click="!posStore.isCheckingOut && emit('close')"
          >
            <X :size="18" />
          </button>
        </div>
      </div>

      <!-- Modal Body -->
      <div class="p-4 space-y-4 flex-1 overflow-y-auto touch-pan-y">
        <!-- Total Tagihan Display -->
        <div class="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-center">
          <span class="text-[11px] font-semibold text-gray-600 block mb-0.5">TOTAL TAGIHAN AKHIR:</span>
          <span class="text-2xl font-black font-mono text-blue-700">
            Rp {{ formatRupiah(posStore.finalTotal) }}
          </span>
          <div v-if="posStore.totalDiscountAmount > 0 || posStore.pointsDiscountAmount > 0" class="text-[10.5px] text-rose-600 font-mono mt-0.5">
            (Hemat Rp {{ formatRupiah(posStore.totalDiscountAmount + posStore.pointsDiscountAmount) }} dari normal Rp {{ formatRupiah(posStore.totalSell) }})
          </div>
          <span class="text-[10.5px] text-gray-500 block mt-1 font-mono">
            {{ posStore.selectedBuyer }} ({{ posStore.saleMode === 'B2B' ? 'Grosir / B2B' : 'Eceran' }}) • {{ posStore.cartItems.length }} Barang
          </span>
        </div>

        <!-- Opsi Tukar Poin Member Langsung di Modal Bayar -->
        <div
          v-if="posStore.isMember && posStore.memberPoints > 0"
          class="p-2.5 bg-amber-50/90 border border-amber-200 rounded-lg space-y-1.5"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
              <Coins :size="14" class="text-amber-600" />
              <span>Poin Member: {{ posStore.memberPoints }} Poin</span>
            </div>
            <span class="text-[10.5px] font-mono text-amber-800 font-semibold">
              (Senilai Rp {{ formatRupiah(posStore.memberPoints * buyerStore.loyaltySettings.pointValueInRupiah) }})
            </span>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1 border-t border-amber-200/70 text-xs">
            <label class="flex items-center gap-2 cursor-pointer font-semibold text-gray-800 select-none">
              <input
                type="checkbox"
                :checked="posStore.pointsToRedeem > 0"
                @change="toggleRedeemPoints"
                class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span>Tukar Poin untuk Potongan Bayar</span>
            </label>

            <div v-if="posStore.pointsToRedeem > 0" class="flex items-center gap-1 font-mono text-xs text-amber-900 font-bold">
              <span>-Rp {{ formatRupiah(posStore.pointsDiscountAmount) }}</span>
              <span class="text-[10px] text-gray-500 font-normal">({{ posStore.pointsToRedeem }} P)</span>
            </div>
          </div>
        </div>

        <!-- Status Bayar -->
        <div>
          <label class="text-[11px] font-bold text-gray-700 block mb-1">Status Pembayaran:</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex items-center justify-center gap-2 py-1.5 px-3 rounded-md border text-xs font-bold cursor-pointer transition-all"
              :class="posStore.paymentStatus === 'LUNAS' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'"
              @click="posStore.paymentStatus = 'LUNAS'"
            >
              <CheckCircle2 :size="14" />
              <span>Lunas</span>
            </button>

            <button
              type="button"
              class="flex items-center justify-center gap-2 py-1.5 px-3 rounded-md border text-xs font-bold cursor-pointer transition-all"
              :class="posStore.paymentStatus === 'TEMPO' ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'"
              @click="posStore.paymentStatus = 'TEMPO'"
            >
              <Clock :size="14" />
              <span>Tempo (Piutang)</span>
            </button>
          </div>
        </div>

        <!-- FITUR SPLIT PAYMENT: BAYAR CAMPUR (TUNAI + NON-TUNAI) -->
        <div v-if="posStore.paymentStatus === 'LUNAS'" class="space-y-2">
          <div class="flex items-center justify-between p-2 bg-purple-50/70 border border-purple-200 rounded-lg">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                :checked="posStore.isSplitPayment"
                @change="toggleSplitPayment"
                class="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
              />
              <div>
                <span class="text-xs font-bold text-purple-950 block">Bayar Campur (Split Payment)</span>
                <span class="text-[10px] text-purple-700 block">Sebagian Tunai + Sebagian Non-Tunai (QRIS / Bank)</span>
              </div>
            </label>
            <span
              class="text-[10px] font-bold px-2 py-0.5 rounded"
              :class="posStore.isSplitPayment ? 'bg-purple-600 text-white shadow-2xs' : 'bg-gray-200 text-gray-600'"
            >
              {{ posStore.isSplitPayment ? 'Aktif' : 'Tunggal' }}
            </span>
          </div>

          <!-- Form Input Rincian Split Payment -->
          <div v-if="posStore.isSplitPayment" class="p-3 bg-white border border-purple-300 rounded-lg space-y-2.5 animate-in fade-in duration-100">
            <div class="grid grid-cols-2 gap-2 text-xs">
              <!-- Bagian 1: Uang Tunai -->
              <div class="space-y-1">
                <label class="text-[10.5px] font-bold text-gray-700 block">Nominal Tunai (Rp):</label>
                <div class="relative">
                  <span class="absolute left-2 top-1.5 text-gray-400 font-mono text-[10.5px]">Rp</span>
                  <input
                    v-model.number="posStore.splitCashAmount"
                    type="number"
                    min="0"
                    step="1000"
                    class="w-full bg-[#fcfbfa] border border-gray-300 rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-purple-600 font-mono font-bold text-gray-900"
                    @input="onSplitCashChange"
                  />
                </div>
              </div>

              <!-- Bagian 2: Non-Tunai (QRIS / Transfer) -->
              <div class="space-y-1">
                <div class="flex items-center justify-between">
                  <label class="text-[10.5px] font-bold text-gray-700 block">Non-Tunai:</label>
                  <select
                    v-model="posStore.splitNonCashMethod"
                    class="text-[10px] bg-purple-50 border border-purple-200 text-purple-900 font-bold rounded px-1 py-0.2 outline-none cursor-pointer"
                  >
                    <option value="QRIS">QRIS</option>
                    <option value="Transfer Bank">Transfer Bank</option>
                  </select>
                </div>
                <div class="relative">
                  <span class="absolute left-2 top-1.5 text-gray-400 font-mono text-[10.5px]">Rp</span>
                  <input
                    v-model.number="posStore.splitNonCashAmount"
                    type="number"
                    min="0"
                    step="1000"
                    class="w-full bg-[#fcfbfa] border border-gray-300 rounded pl-7 pr-2 py-1 text-xs outline-none focus:border-purple-600 font-mono font-bold text-purple-900"
                    @input="onSplitNonCashChange"
                  />
                </div>
              </div>
            </div>

            <!-- Feedback Kalkulasi Total Split -->
            <div
              class="p-2 rounded text-[11px] font-mono flex items-center justify-between"
              :class="isSplitValid ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'"
            >
              <span>Total Campur: <strong>Rp {{ formatRupiah(splitTotalCalculated) }}</strong></span>
              <span v-if="splitTotalCalculated === posStore.finalTotal" class="font-bold text-emerald-700 flex items-center gap-1">
                <Check :size="12" /> Pas Sesuai Tagihan
              </span>
              <span v-else-if="splitTotalCalculated > posStore.finalTotal" class="text-emerald-700 font-bold">
                Lebih Rp {{ formatRupiah(splitTotalCalculated - posStore.finalTotal) }}
              </span>
              <span v-else class="font-bold text-rose-600">
                Kurang Rp {{ formatRupiah(posStore.finalTotal - splitTotalCalculated) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Metode Pembayaran Tunggal (Tampil jika BUKAN Split Payment) -->
        <div v-if="!posStore.isSplitPayment">
          <label class="text-[11px] font-bold text-gray-700 block mb-1">Metode Pembayaran:</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="item in paymentMethodOptions"
              :key="item.id"
              type="button"
              class="flex items-center justify-center gap-2 py-1.5 px-2.5 rounded-md border text-xs font-medium cursor-pointer transition-all"
              :class="posStore.paymentMethod === item.id ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs ring-2 ring-blue-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'"
              @click="posStore.paymentMethod = item.id"
            >
              <component :is="item.icon" :size="14" class="shrink-0" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </div>

        <!-- KALKULATOR UANG DITERIMA & KEMBALIAN (Untuk Tunai Biasa atau Bagian Tunai Split) -->
        <div
          v-if="requiredCash > 0"
          class="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2 text-xs"
        >
          <div class="flex items-center justify-between">
            <span class="font-bold text-amber-950 text-[11px]">
              {{ posStore.isSplitPayment ? 'Uang Tunai Diserahkan Pembeli:' : 'Uang Tunai Pembeli (Cash Tendered):' }}
            </span>
            <span class="text-[10px] text-gray-500 font-mono">Tagihan Tunai: Rp {{ formatRupiah(requiredCash) }}</span>
          </div>

          <div class="flex items-center gap-1.5">
            <div class="relative flex-1">
              <span class="absolute left-2.5 top-1.5 text-gray-400 font-mono text-[11px]">Rp</span>
              <input
                v-model.number="posStore.cashTendered"
                type="number"
                min="0"
                step="1000"
                class="w-full bg-white border border-amber-300 rounded pl-8 pr-2 py-1 text-sm font-mono font-bold text-amber-950 outline-none focus:border-amber-600"
              />
            </div>
            <button
              type="button"
              class="px-2 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 rounded font-bold text-[10.5px] cursor-pointer"
              @click="setExactCash"
            >
              Uang Pas
            </button>
          </div>

          <!-- Pintasan Pecahan Rupiah Cepat -->
          <div class="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
            <span class="text-[9.5px] text-gray-400 shrink-0">+Pecahan:</span>
            <button
              v-for="amt in [10000, 20000, 50000, 100000]"
              :key="amt"
              type="button"
              class="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white hover:bg-amber-100 border border-amber-200 text-amber-800 cursor-pointer shrink-0 font-semibold"
              @click="addCashTendered(amt)"
            >
              +{{ formatRupiah(amt) }}
            </button>
          </div>

          <!-- Tampilan Kembalian & Tombol Infaqkan Kembalian Koin -->
          <div
            v-if="rawChange > 0"
            class="pt-2 border-t border-amber-200/80 flex items-center justify-between"
          >
            <div>
              <span class="text-[10px] text-gray-500 block">Kembalian Bersih:</span>
              <strong class="font-mono text-emerald-700 text-base font-black">
                Rp {{ formatRupiah(netChange) }}
              </strong>
            </div>

            <!-- Tombol 1-Klik Infaqkan Kembalian Koin (GAP-4) -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-2xs"
              :class="posStore.infaqAmount > 0
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'"
              :title="posStore.infaqAmount > 0 ? 'Batalkan infaq kembalian' : 'Alokasikan kembalian receh ke kotak amal kasir'"
              @click="toggleInfaqChange"
            >
              <Heart :size="13" class="fill-current" />
              <span>{{ posStore.infaqAmount > 0 ? 'Batal Infaq' : `+ Infaqkan Rp ${formatRupiah(rawChange)}` }}</span>
            </button>
          </div>

          <div v-if="posStore.infaqAmount > 0" class="text-[10px] font-mono text-emerald-800 bg-emerald-100/70 p-1.5 rounded flex items-center gap-1">
            <Heart :size="11" class="text-emerald-700 fill-emerald-600" />
            <span>Kembalian Rp {{ formatRupiah(posStore.infaqAmount) }} dialokasikan ke Kotak Amal / Infaq Toko (Kas Masuk).</span>
          </div>
        </div>

        <!-- PIC Penerima Barang (B2B / Faktur Pengiriman) — GAP-3 -->
        <div v-if="posStore.saleMode === 'B2B'">
          <label class="text-[11px] font-bold text-gray-700 block mb-1">PIC Penerima Barang (opsional):</label>
          <input
            v-model="posStore.picName"
            type="text"
            placeholder="Nama Pihak Penerima (tercetak di faktur & tanda terima)"
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-300 rounded focus:border-blue-500 focus:outline-none placeholder:text-gray-400"
          />
        </div>

        <!-- Catatan / Keterangan Transaksi -->
        <div>
          <label class="text-[11px] font-bold text-gray-700 block mb-1">Catatan / Keterangan Nota (opsional):</label>
          <input
            v-model="posStore.transactionNotes"
            type="text"
            placeholder="Contoh: Titipan Bu Siti, pesanan arisan, antar jam 4 sore, dll..."
            class="w-full px-2.5 py-1 text-xs bg-white border border-gray-300 rounded focus:border-blue-500 focus:outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      <!-- Modal Footer Actions (Mobile-First Touch Zone) -->
      <div
        class="p-4 pt-3.5 pb-8 sm:pb-3.5 bg-slate-50 border-t border-slate-200 shrink-0 space-y-2.5 pb-safe"
        style="padding-bottom: max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem));"
      >
        <div v-if="posStore.isSplitPayment && !isSplitValid" class="text-[11px] font-bold text-rose-600 font-mono text-center">
          ⚠️ Nominal campur belum mencapai total tagihan
        </div>

        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            class="col-span-1 py-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl font-bold text-xs text-slate-700 cursor-pointer transition-all active:scale-95 flex items-center justify-center"
            @click="!posStore.isCheckingOut && emit('close')"
          >
            Batal
          </button>
          <button
            type="button"
            class="col-span-2 py-3 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all disabled:opacity-50 active:scale-95"
            :style="{ backgroundColor: settingsStore.primaryColor || '#2563eb' }"
            :disabled="posStore.isCheckingOut || (posStore.isSplitPayment && !isSplitValid)"
            @click="handleConfirm"
          >
            <Printer :size="16" />
            <span>{{ posStore.isCheckingOut ? 'Memproses Transaksi...' : 'Bayar & Cetak Struk' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pb-safe {
  padding-bottom: max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem));
}
</style>

