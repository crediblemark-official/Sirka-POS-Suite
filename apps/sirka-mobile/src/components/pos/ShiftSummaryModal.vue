<script setup lang="ts">
import { computed } from 'vue';
import { useShiftStore } from '../../stores/shiftStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatRupiah } from '../../utils/formatters';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

import {
  Printer,
  X,
  CheckCircle2
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const shiftStore = useShiftStore();
const settingsStore = useSettingsStore();

const shift = computed(() => shiftStore.lastClosedShift);

const formatDateTime = (iso?: string) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const durationText = computed(() => {
  if (!shift.value?.startTime || !shift.value?.endTime) return '-';
  const start = new Date(shift.value.startTime).getTime();
  const end = new Date(shift.value.endTime).getTime();
  const diffMin = Math.floor((end - start) / 60000);
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return `${hours} Jam ${mins} Menit`;
});

function handlePrint() {
  window.print();
}

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => props.isOpen);
</script>

<template>
  <div
    v-if="isOpen && shift"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header -->
      <div
        class="px-5 py-3.5 flex items-center justify-between border-b border-gray-200 select-none shrink-0"
        style="background-color: var(--surface-ribbon, #f6f5f2);"
      >
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 bg-emerald-100 text-emerald-700 rounded-md">
            <CheckCircle2 :size="18" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-gray-800 leading-tight">Rekapitulasi Serah Terima Shift</h2>
            <p class="text-[11px] text-gray-500">Bukti resmi tutup shift & rekonsiliasi kasir</p>
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

      <!-- Printable Receipt Content Area -->
      <div class="p-5 overflow-y-auto space-y-4 text-xs">
        <!-- Thermal Receipt Paper View -->
        <div
          id="shift-receipt-paper"
          class="bg-gray-50/70 border border-dashed border-gray-300 rounded-lg p-5 font-mono text-[11px] text-gray-800 shadow-inner space-y-3"
        >
          <!-- Store Header -->
          <div class="text-center pb-2 border-b border-dashed border-gray-300">
            <h3 class="font-bold text-sm tracking-wide">{{ settingsStore.storeName.toUpperCase() }}</h3>
            <p class="text-[10px] text-gray-500">LAPORAN PENUTUPAN SHIFT KASIR</p>
            <p class="text-[9px] text-gray-400 font-mono mt-0.5">ID: {{ shift.id }}</p>
          </div>

          <!-- Metadata -->
          <div class="space-y-1 text-[11px] pb-2 border-b border-dashed border-gray-300">
            <div class="flex justify-between">
              <span class="text-gray-500">Kasir:</span>
              <span class="font-bold">{{ shift.cashierName }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Mulai:</span>
              <span>{{ formatDateTime(shift.startTime) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Selesai:</span>
              <span>{{ formatDateTime(shift.endTime) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Durasi:</span>
              <span>{{ durationText }}</span>
            </div>
          </div>

          <!-- Cash Reconciliation Breakdown -->
          <div class="space-y-1.5 pb-2 border-b border-dashed border-gray-300">
            <div class="flex justify-between">
              <span class="text-gray-600">Modal Awal Kembalian:</span>
              <span class="font-bold">Rp {{ formatRupiah(shift.startingCash) }}</span>
            </div>
            <div class="flex justify-between text-emerald-700">
              <span>(+) Penjualan Tunai:</span>
              <span class="font-bold">Rp {{ formatRupiah(shift.cashSales) }}</span>
            </div>
            <div class="flex justify-between text-teal-700" v-if="shift.cashInflow && shift.cashInflow > 0">
              <span>(+) Infaq / Tip Non-Jual:</span>
              <span class="font-bold">+Rp {{ formatRupiah(shift.cashInflow) }}</span>
            </div>
            <div class="flex justify-between text-amber-700" v-if="shift.cashOutflow > 0">
              <span>(-) Kas Keluar Operasional:</span>
              <span class="font-bold">-Rp {{ formatRupiah(shift.cashOutflow) }}</span>
            </div>
            <div class="flex justify-between text-rose-700" v-if="shift.refundOutflow && shift.refundOutflow > 0">
              <span>(-) Retur Tunai Kasir:</span>
              <span class="font-bold">-Rp {{ formatRupiah(shift.refundOutflow) }}</span>
            </div>
            <div class="flex justify-between pt-1 border-t border-dotted border-gray-300 font-bold">
              <span>Total Kas Seharusnya:</span>
              <span>Rp {{ formatRupiah(shift.expectedCash) }}</span>
            </div>
            <div class="flex justify-between font-bold text-blue-800">
              <span>Uang Fisik Dihitung:</span>
              <span>Rp {{ formatRupiah(shift.actualCash || 0) }}</span>
            </div>
          </div>

          <!-- Discrepancy Box -->
          <div
            class="p-2.5 rounded border text-center space-y-1"
            :class="
              (shift.discrepancy || 0) === 0
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : (shift.discrepancy || 0) < 0
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
            "
          >
            <span class="text-[10px] font-bold uppercase tracking-wider block">
              STATUS SELISIH KAS:
            </span>
            <div class="text-sm font-extrabold font-mono">
              {{
                (shift.discrepancy || 0) === 0
                  ? 'KAS COCOK / PAS (Rp 0)'
                  : `${(shift.discrepancy || 0) < 0 ? 'TEKOR' : 'LEBIH'}: ${(shift.discrepancy || 0) > 0 ? '+' : ''}Rp ${formatRupiah(shift.discrepancy || 0)}`
              }}
            </div>
          </div>

          <!-- Poin 10: ALOKASI PEMINDAHAN KE BENDAHARA -->
          <div class="p-2.5 bg-blue-50/70 border border-blue-200 rounded space-y-1 text-[11px]">
            <span class="font-bold text-blue-900 block text-[10px] uppercase tracking-wider">
              ALOKASI PEMINDAHAN KAS KE BENDAHARA:
            </span>
            <div class="flex justify-between text-blue-950">
              <span>1. Disetor ke Bendahara:</span>
              <span class="font-bold font-mono">
                Rp {{ formatRupiah(shift.transferredToTreasury ?? (shift.actualCash || 0)) }}
              </span>
            </div>
            <div class="flex justify-between text-blue-800">
              <span>2. Sisa di Laci (Modal Kasir):</span>
              <span class="font-bold font-mono">
                Rp {{ formatRupiah(shift.retainedInDrawer || 0) }}
              </span>
            </div>
          </div>

          <!-- Non-Cash Summary -->
          <div class="space-y-1 text-[10px] text-gray-500 pt-1">
            <div class="flex justify-between">
              <span>Penjualan Non-Tunai (QRIS/Bank):</span>
              <span class="font-mono text-gray-700">Rp {{ formatRupiah(shift.nonCashSales) }}</span>
            </div>
            <div class="flex justify-between font-bold text-gray-800 pt-1 border-t border-dotted border-gray-300">
              <span>TOTAL OMSET SHIFT:</span>
              <span class="font-mono">Rp {{ formatRupiah(shift.cashSales + shift.nonCashSales) }}</span>
            </div>
          </div>

          <!-- Notes -->
          <div v-if="shift.notes" class="pt-2 border-t border-dashed border-gray-300 text-[10px] text-gray-600">
            <span class="font-bold block">Catatan:</span>
            <p class="italic break-words">{{ shift.notes }}</p>
          </div>

          <!-- Signature lines -->
          <div class="pt-6 grid grid-cols-2 gap-4 text-center text-[10px] text-gray-500">
            <div>
              <div class="border-b border-gray-400 h-8 mb-1"></div>
              <span>Kasir ({{ shift.cashierName }})</span>
            </div>
            <div>
              <div class="border-b border-gray-400 h-8 mb-1"></div>
              <span>Bendahara / Supervisor</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div
        class="px-5 py-3 border-t border-gray-200 flex items-center justify-between gap-3 select-none shrink-0"
        style="background-color: var(--surface-ribbon, #f6f5f2);"
      >
        <button
          type="button"
          class="px-3.5 py-1.5 border border-gray-300 rounded text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 cursor-pointer flex items-center gap-1.5 transition-colors"
          @click="handlePrint"
        >
          <Printer :size="14" />
          <span>Cetak Bukti Shift</span>
        </button>

        <button
          type="button"
          class="px-5 py-1.5 rounded text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-xs transition-colors"
          @click="emit('close')"
        >
          Selesai
        </button>
      </div>
    </div>
  </div>
</template>

<!--
  BUG FIX: aturan cetak tidak boleh memakai `scoped`.
  Vue mengubah `body *` menjadi `body *[data-v-hash]`, sehingga elemen di luar
  komponen ini TIDAK ikut disembunyikan -> hasil cetak berisi seluruh tampilan
  aplikasi di belakang struk. ReceiptModal memakai blok `<style>` (tanpa
  scoped) untuk alasan yang sama.
-->
<style>
@media print {
  body * {
    visibility: hidden;
  }
  #shift-receipt-paper,
  #shift-receipt-paper * {
    visibility: visible;
  }
  #shift-receipt-paper {
    position: absolute;
    left: 0;
    top: 0;
    width: 80mm;
    margin: 0;
    padding: 10px;
    border: none;
    box-shadow: none;
    background: white;
  }
}
</style>
