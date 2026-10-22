<script setup lang="ts">
import { watch, onUnmounted } from 'vue';
import { AlertCircle, X, Check } from 'lucide-vue-next';
import { Transaction, PaymentStatus } from '../../types';
import { formatRupiah } from '../../utils/formatters';

const props = defineProps<{
  isOpen: boolean;
  transaction: Transaction | null;
  targetStatus: PaymentStatus;
}>();

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

function handleKeyDown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('cancel');
  } else if (e.key === 'Enter') {
    // BUG FIX: Enter tanpa cek target bisa mengonfirmasi perubahan status
    // dari input yang berada DI BELAKANG modal.
    const target = e.target as HTMLElement | null;
    const inInput = !!(target && (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ));
    const inModal = !!(target && target.closest && target.closest('[data-status-modal]'));
    if (inInput && !inModal) return;
    e.preventDefault();
    e.stopPropagation();
    emit('confirm');
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div
    v-if="isOpen && transaction"
    class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none text-xs"
    @click.self="emit('cancel')"
  >
    <div data-status-modal class="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <!-- Modal Header -->
      <div class="px-4 py-3 bg-[#f8f7f5] border-b border-gray-200 flex items-center justify-between font-bold text-sm text-gray-800">
        <div class="flex items-center gap-2">
          <AlertCircle :size="16" class="text-amber-500" />
          <span>Konfirmasi Status Bayar</span>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-black rounded cursor-pointer transition-colors"
          @click="emit('cancel')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-4 space-y-3">
        <p class="text-gray-600 text-xs leading-relaxed">
          Apakah Anda yakin ingin mengubah status pembayaran untuk transaksi ini?
        </p>

        <div class="p-3 bg-gray-50 rounded-lg space-y-1.5 border border-gray-100 font-mono text-[11px]">
          <div class="flex justify-between">
            <span class="text-gray-500 font-sans">No. Nota:</span>
            <span class="font-bold text-blue-700">{{ transaction.invoiceNo }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 font-sans">Pelanggan:</span>
            <span class="font-bold text-gray-800 font-sans truncate max-w-[180px]">{{ transaction.buyer }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 font-sans">Metode Bayar:</span>
            <span class="font-semibold text-gray-700 font-sans">{{ transaction.paymentMethod || 'Transfer Bank' }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-500 font-sans">Total Tagihan:</span>
            <span class="font-bold text-gray-900">Rp {{ formatRupiah(transaction.finalTotal ?? transaction.totalSell) }}</span>
          </div>
          <div class="flex justify-between items-center pt-1.5 border-t border-gray-200">
            <span class="text-gray-500 font-sans">Ubah Status:</span>
            <div class="flex items-center gap-1.5 font-sans font-bold text-xs">
              <span :class="transaction.paymentStatus === 'LUNAS' ? 'text-emerald-700' : 'text-amber-700'">
                {{ transaction.paymentStatus }}
              </span>
              <span class="text-gray-400">➔</span>
              <span
                class="px-2 py-0.5 rounded text-[10px] font-bold"
                :class="targetStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
              >
                {{ targetStatus }}
              </span>
            </div>
          </div>
        </div>

        <p
          class="text-[11px] leading-relaxed p-2.5 rounded"
          :class="targetStatus === 'LUNAS' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'"
        >
          <span v-if="targetStatus === 'LUNAS'">
            ✓ Nota ini akan ditandai <strong>LUNAS</strong> dan piutang pelanggan terselesaikan.
          </span>
          <span v-else>
            ⚠️ Nota ini akan diubah menjadi <strong>TEMPO (Bon/Hutang)</strong> dan dicatat kembali dalam piutang buku besar.
          </span>
        </p>
      </div>

      <!-- Modal Footer Actions -->
      <div class="px-4 py-2.5 bg-[#f8f7f5] border-t border-gray-200 flex items-center justify-end gap-2">
        <button
          type="button"
          class="px-3 py-1.5 rounded text-gray-600 hover:bg-gray-200 font-semibold text-xs cursor-pointer transition-colors"
          @click="emit('cancel')"
        >
          Batal
        </button>
        <button
          type="button"
          class="px-3.5 py-1.5 rounded font-bold text-xs text-white cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
          :class="targetStatus === 'LUNAS' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'"
          @click="emit('confirm')"
        >
          <Check :size="13" />
          <span>Ya, Ubah ke {{ targetStatus }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
