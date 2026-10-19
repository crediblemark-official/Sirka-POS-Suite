<script setup lang="ts">
import { Buyer } from '../../../types';
import { Printer, X, CreditCard } from 'lucide-vue-next';
import MemberCardVisual from './MemberCardVisual.vue';

defineProps<{
  isOpen: boolean;
  buyer: Buyer;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function handleTriggerPrint() {
  window.print();
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none text-xs"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-2xl shadow-2xl border border-gray-300 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[90vh]">
      <!-- Header Modal -->
      <div class="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center">
            <Printer :size="18" />
          </div>
          <div>
            <h3 class="font-bold text-sm tracking-tight">Cetak Kartu Member Pelanggan</h3>
            <p class="text-[11px] text-slate-300">Format Standar ID-1 ISO 7810 (Ukuran Kartu ATM / KTP)</p>
          </div>
        </div>
        <button type="button" class="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <!-- Body Preview -->
      <div class="p-6 overflow-y-auto space-y-4 bg-slate-50/50 flex-1">
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-[11.5px] flex items-center justify-between">
          <div class="flex items-center gap-2">
            <CreditCard :size="16" class="text-amber-600 shrink-0" />
            <span>
              Mencetak kartu untuk <strong>{{ buyer.name }}</strong> (No: <strong>{{ buyer.memberCardNo || '-' }}</strong>).
              Sisi belakang sudah dilengkapi <strong>QR Code Asli</strong> untuk scan kasir.
            </span>
          </div>
          <span class="px-2 py-0.5 rounded bg-amber-200/80 font-bold text-[10px] uppercase">
            {{ buyer.tier || 'REGULAR' }}
          </span>
        </div>

        <!-- Printable Area (Dua Sisi Berdampingan) -->
        <div id="print-member-card-area" class="flex flex-col md:flex-row items-center justify-center gap-6 p-4 bg-white rounded-xl border border-slate-200 shadow-inner">
          <!-- Sisi Depan -->
          <div class="flex flex-col items-center gap-2">
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              [ 1. Tampak Depan ]
            </span>
            <MemberCardVisual
              :buyer="buyer"
              :model-value="false"
              :interactive="false"
              :show-controls="false"
            />
          </div>

          <!-- Sisi Belakang (QR Code) -->
          <div class="flex flex-col items-center gap-2">
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              [ 2. Tampak Belakang (QR Code Kasir) ]
            </span>
            <MemberCardVisual
              :buyer="buyer"
              :model-value="true"
              :interactive="false"
              :show-controls="false"
            />
          </div>
        </div>

        <!-- Tips Cetak -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-600">
          <div class="p-3 bg-white rounded-lg border border-slate-200">
            <p class="font-bold text-slate-800 mb-0.5">🖨️ Printer Kartu PVC / Kertas Foto</p>
            <p class="leading-relaxed">Gunakan kertas foto tebal (230-260 gsm) atau printer khusus kartu PVC (Evolis/Zebra/Fargo) untuk hasil fisik terbaik.</p>
          </div>
          <div class="p-3 bg-white rounded-lg border border-slate-200">
            <p class="font-bold text-slate-800 mb-0.5">📱 Digital Member Card</p>
            <p class="leading-relaxed">QR Code pada sisi belakang dapat disimpan atau di-screenshot oleh pelanggan di smartphone untuk di-scan kasir.</p>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
        <button
          type="button"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold cursor-pointer transition-colors"
          @click="emit('close')"
        >
          Tutup
        </button>

        <button
          type="button"
          class="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-2"
          @click="handleTriggerPrint"
        >
          <Printer :size="16" />
          <span>Cetak Kartu Sekarang</span>
        </button>
      </div>
    </div>
  </div>
</template>
