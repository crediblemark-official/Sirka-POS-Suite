<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useShiftStore } from '../../stores/shiftStore';
import { formatRupiah } from '../../utils/formatters';
import { LogIn, X, Banknote, User, FileText, CheckCircle2 } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const shiftStore = useShiftStore();

const cashierName = ref('');
const startingCash = ref<number>(200000);
const startingCashInput = ref('200000');
const notes = ref('');
const isSubmitting = ref(false);

const quickCashAmounts = [100000, 200000, 300000, 500000];

function selectQuickCash(amount: number) {
  startingCash.value = amount;
  startingCashInput.value = amount.toString();
}

function onCashInput(e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
  startingCashInput.value = val;
  startingCash.value = Number(val) || 0;
}

async function handleConfirm() {
  if (isSubmitting.value) return;
  if (!cashierName.value.trim()) {
    alert('Harap isi nama kasir yang bertugas!');
    return;
  }
  isSubmitting.value = true;
  try {
    await shiftStore.openShift(cashierName.value, startingCash.value, notes.value);
    emit('close');
  } catch (err: any) {
    alert(err?.message || 'Gagal membuka shift kasir');
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
    handleConfirm();
  }
}

watch(() => props.isOpen, (open) => {
  if (open) {
    cashierName.value = '';
    notes.value = '';
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
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header (Native Explorer Theme) -->
      <div
        class="px-4 py-3 flex items-center justify-between border-b border-gray-200 select-none"
        style="background-color: var(--surface-ribbon, #f6f5f2);"
      >
        <div class="flex items-center gap-2">
          <div class="p-1.5 bg-blue-100 text-blue-700 rounded-md">
            <LogIn :size="18" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-gray-800 leading-tight">Buka Shift Kasir Baru</h2>
            <p class="text-[11px] text-gray-500">Mulai sesi kerja kasir & hitung modal awal laci</p>
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

      <!-- Modal Body -->
      <div class="p-5 space-y-4 text-xs">
        <!-- 1. Nama Kasir -->
        <div>
          <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <User :size="13" class="text-gray-500" />
            Nama Kasir Bertugas
          </label>
          <input
            v-model="cashierName"
            type="text"
            placeholder="Contoh: Siti Nurhaliza / Shift Pagi"
            class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            autofocus
          />
        </div>

        <!-- 2. Modal Awal Uang Kembalian (Starting Cash) -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <Banknote :size="13" class="text-emerald-600" />
              Modal Awal Uang Kembalian
            </label>
            <span class="text-[10px] text-gray-500 font-mono">Uang fisik di laci saat buka</span>
          </div>
          
          <div class="relative">
            <span class="absolute left-3 top-2.5 text-xs font-bold text-gray-400 font-mono">Rp</span>
            <input
              :value="formatRupiah(startingCash)"
              @input="onCashInput"
              type="text"
              class="w-full pl-9 pr-3 py-2.5 bg-emerald-50/40 border border-emerald-300 rounded-md text-sm font-bold font-mono text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <!-- Quick Buttons -->
          <div class="grid grid-cols-4 gap-1.5 mt-2">
            <button
              v-for="amt in quickCashAmounts"
              :key="amt"
              type="button"
              @click="selectQuickCash(amt)"
              class="px-2 py-1.5 rounded border text-[11px] font-mono font-semibold transition-all cursor-pointer"
              :class="startingCash === amt ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'"
            >
              {{ formatRupiah(amt) }}
            </button>
          </div>
        </div>

        <!-- 3. Catatan / Catatan Serah Terima Awal -->
        <div>
          <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
            <FileText :size="13" class="text-gray-500" />
            Catatan Buka Shift (Opsional)
          </label>
          <textarea
            v-model="notes"
            rows="2"
            placeholder="Contoh: Pecahan 10rb ada 10 lbr, 5rb ada 20 lbr..."
            class="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          ></textarea>
        </div>

        <!-- Info Box -->
        <div class="p-2.5 bg-blue-50 border border-blue-200 rounded-md flex items-start gap-2 text-blue-900 text-[11px] leading-relaxed">
          <CheckCircle2 :size="15" class="text-blue-600 shrink-0 mt-0.5" />
          <span>
            Setelah shift dibuka, semua transaksi penjualan <strong>Tunai</strong> dan <strong>Non-Tunai</strong> akan otomatis direkam ke buku shift kasir ini sampai ditutup.
          </span>
        </div>
      </div>

      <!-- Modal Footer (Dirapikan: Tinggi Tombol Seragam & Shortcut Rapi 1 Baris) -->
      <div
        class="px-5 py-3.5 border-t border-gray-200 flex items-center justify-between gap-4 select-none shrink-0"
        style="background-color: var(--surface-ribbon, #f6f5f2);"
      >
        <!-- Shortcut Hint (Satu Baris Bersih & Elegan) -->
        <div class="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
          <kbd class="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono text-gray-600 shadow-2xs font-semibold">Ctrl + Enter</kbd>
          <span class="text-[11px] text-gray-500">Konfirmasi</span>
        </div>

        <!-- Tombol Aksi: Tinggi Identik (h-9), Padding Seimbang & Selaras -->
        <div class="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            class="h-9 px-4 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 cursor-pointer transition-colors shadow-2xs flex items-center justify-center"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="isSubmitting"
            class="h-9 px-5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 cursor-pointer shadow-xs flex items-center justify-center gap-2 transition-all"
            @click="handleConfirm"
          >
            <LogIn :size="15" />
            <span>{{ isSubmitting ? 'Membuka...' : 'Buka Shift Sekarang' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
