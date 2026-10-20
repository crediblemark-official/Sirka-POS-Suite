<script setup lang="ts">
import { watch, onUnmounted } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { PaymentMethod } from '../../types';
import { formatRupiah } from '../../utils/formatters';
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
  FileText
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

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  icon: any;
}

const paymentMethodOptions: PaymentMethodOption[] = [
  { id: 'Transfer Bank', label: 'Transfer Bank', icon: Landmark },
  { id: 'Tunai / Kas', label: 'Tunai / Kas', icon: Banknote },
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

function handleConfirm() {
  if (!posStore.isCheckingOut) emit('confirm');
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
    if (!posStore.isCheckingOut) {
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
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none text-xs"
    @click.self="!posStore.isCheckingOut && emit('close')"
  >
    <div class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <!-- Modal Header -->
      <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-gray-800">
        <div class="flex items-center gap-2 text-sm">
          <Receipt :size="17" class="text-blue-600" />
          <span>Konfirmasi Pembayaran Kasir</span>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-black rounded cursor-pointer"
          @click="!posStore.isCheckingOut && emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-5 space-y-4">
        <!-- Total Tagihan Display -->
        <div class="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg text-center">
          <span class="text-xs font-semibold text-gray-600 block mb-0.5">TOTAL BAYAR AKHIR:</span>
          <span class="text-2xl font-black font-mono text-blue-700">
            Rp {{ formatRupiah(posStore.finalTotal) }}
          </span>
          <div v-if="posStore.totalDiscountAmount > 0 || posStore.pointsDiscountAmount > 0" class="text-[11px] text-rose-600 font-mono mt-0.5">
            (Hemat Rp {{ formatRupiah(posStore.totalDiscountAmount + posStore.pointsDiscountAmount) }} dari normal Rp {{ formatRupiah(posStore.totalSell) }})
          </div>
          <span class="text-[11px] text-gray-500 block mt-1 font-mono">
            {{ posStore.selectedBuyer }} ({{ posStore.saleMode === 'B2B' ? 'Grosir / B2B' : 'Eceran' }}) • {{ posStore.cartItems.length }} Barang
          </span>
        </div>

        <!-- Opsi Tukar Poin Member Langsung di Modal Bayar -->
        <div
          v-if="posStore.isMember && posStore.memberPoints > 0"
          class="p-3 bg-amber-50/90 border border-amber-200 rounded-lg space-y-2"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
              <Coins :size="15" class="text-amber-600" />
              <span>Poin Member: {{ posStore.memberPoints }} Poin</span>
            </div>
            <span class="text-[11px] font-mono text-amber-800 font-semibold">
              (Senilai Rp {{ formatRupiah(posStore.memberPoints * buyerStore.loyaltySettings.pointValueInRupiah) }})
            </span>
          </div>

          <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-amber-200/70 text-xs">
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
          <label class="text-xs font-bold text-gray-700 block mb-1.5">Status Pembayaran:</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-xs font-bold cursor-pointer transition-all"
              :class="posStore.paymentStatus === 'LUNAS' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'"
              @click="posStore.paymentStatus = 'LUNAS'"
            >
              <CheckCircle2 :size="15" />
              <span>Lunas</span>
            </button>

            <button
              type="button"
              class="flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-xs font-bold cursor-pointer transition-all"
              :class="posStore.paymentStatus === 'TEMPO' ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'"
              @click="posStore.paymentStatus = 'TEMPO'"
            >
              <Clock :size="15" />
              <span>Tempo (Piutang)</span>
            </button>
          </div>
        </div>

        <!-- Metode Pembayaran -->
        <div>
          <label class="text-xs font-bold text-gray-700 block mb-1.5">Metode Pembayaran:</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="item in paymentMethodOptions"
              :key="item.id"
              type="button"
              class="flex items-center justify-center gap-2 py-2 px-2.5 rounded-md border text-xs font-medium cursor-pointer transition-all"
              :class="posStore.paymentMethod === item.id ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs ring-2 ring-blue-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'"
              @click="posStore.paymentMethod = item.id"
            >
              <component :is="item.icon" :size="15" class="shrink-0" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </div>

        <!-- PIC Penerima Barang (B2B / Faktur Pengiriman) — GAP-3 -->
        <div v-if="posStore.saleMode === 'B2B'">
          <label class="text-xs font-bold text-gray-700 block mb-1.5">PIC Penerima Barang (opsional):</label>
          <input
            v-model="posStore.picName"
            type="text"
            placeholder="Nama Pihak Penerima (tercetak di faktur & tanda terima)"
            class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded focus:border-blue-500 focus:outline-none placeholder:text-gray-400"
          />
        </div>

        <!-- Catatan / Keterangan Transaksi -->
        <div>
          <label class="text-xs font-bold text-gray-700 block mb-1.5">Catatan / Keterangan Nota (opsional):</label>
          <input
            v-model="posStore.transactionNotes"
            type="text"
            placeholder="Contoh: Titipan Bu Siti, pesanan arisan, antar jam 4 sore, dll..."
            class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded focus:border-blue-500 focus:outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      <!-- Modal Footer Actions -->
      <div class="px-4 py-3 bg-[#f6f5f2] border-t border-gray-200 flex items-center justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded text-xs font-semibold text-gray-700 cursor-pointer transition-colors"
          @click="!posStore.isCheckingOut && emit('close')"
        >
          Batal (Esc)
        </button>
        <button
          type="button"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
          :disabled="posStore.isCheckingOut"
          @click="handleConfirm"
        >
          <Printer :size="14" />
          <span>{{ posStore.isCheckingOut ? 'Menyimpan…' : 'Selesaikan & Cetak Struk ↵' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
