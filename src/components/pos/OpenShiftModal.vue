<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useShiftStore } from '../../stores/shiftStore';
import { formatRupiah, formatDateIndo } from '../../utils/formatters';
import { LogIn, X, User, FileText, CheckCircle2, Check, Plus, Pencil, RotateCcw, Banknote, AlertCircle } from 'lucide-vue-next';
import { useModalLock } from '../../composables/useModalLock';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const shiftStore = useShiftStore();
const { confirm: showConfirm } = useConfirmDialog();

const cashierName = ref('');
const notes = ref('');
const isSubmitting = ref(false);
const nameError = ref(false);
const errorMessage = ref('');
const cashierInputRef = ref<HTMLInputElement | null>(null);

// State Saldo Laci Kasir
const baseCash = ref<number>(0);
const addedCash = ref<number>(0);
const startingCash = ref<number>(0);

// State Form Tambah Uang & Koreksi Saldo
const showAddCashInput = ref(false);
const addCashAmountInput = ref('');
const addCashInputRef = ref<HTMLInputElement | null>(null);

const showEditBaseInput = ref(false);
const editBaseAmountInput = ref('');
const editBaseInputRef = ref<HTMLInputElement | null>(null);

// Shift terakhir yang ditutup kasir sebelumnya
const previousShift = computed(() => {
  return shiftStore.lastClosedShift || (shiftStore.shiftHistory && shiftStore.shiftHistory.length > 0 ? shiftStore.shiftHistory[0] : null);
});

// Rekomendasi modal awal berdasarkan sisa uang laci kasir shift sebelumnya
const recommendedStartingCash = computed(() => {
  if (!previousShift.value) return 0;
  if (previousShift.value.retainedInDrawer !== undefined && previousShift.value.retainedInDrawer > 0) {
    return previousShift.value.retainedInDrawer;
  }
  if (previousShift.value.actualCash !== undefined && previousShift.value.actualCash > 0) {
    return previousShift.value.actualCash;
  }
  return previousShift.value.expectedCash || 0;
});

// Catatan manual kasir sebelumnya yang telah dibersihkan dari log sistem internal
const cleanPreviousNotes = computed(() => {
  if (!previousShift.value?.notes) return '';
  const raw = previousShift.value.notes;

  // 1. Cek apakah ada tag catatan penutupan manual [Tutup: ...]
  const tutupMatch = raw.match(/\[Tutup:\s*(.*?)\]/i);
  if (tutupMatch && tutupMatch[1]?.trim()) {
    return tutupMatch[1].trim();
  }

  // 2. Bersihkan tag log sistem [Pemasukan...], [Pengeluaran...], [Retur...], [Setor...], [Sisa Kasir...]
  const cleaned = raw
    .replace(/\[(Pemasukan Non-Jual|Pengeluaran Kas|Retur Tunai|Setor Bendahara|Sisa Kasir)[^\]]*\]/gi, '')
    .replace(/\|\s*\|/g, '|')
    .replace(/^[\s|]+|[\s|]+$/g, '')
    .trim();

  if (cleaned && !cleaned.startsWith('[') && cleaned.length > 2) {
    return cleaned;
  }
  return '';
});

// Inisialisasi kas laci saat modal dibuka
function resetDrawerCash() {
  const initial = recommendedStartingCash.value;
  baseCash.value = initial;
  addedCash.value = 0;
  startingCash.value = initial;
  showAddCashInput.value = false;
  addCashAmountInput.value = '';
  showEditBaseInput.value = false;
  editBaseAmountInput.value = '';
}

// Buka input tambah uang ke laci
function openAddCash() {
  showEditBaseInput.value = false;
  showAddCashInput.value = true;
  addCashAmountInput.value = '';
  nextTick(() => {
    addCashInputRef.value?.focus();
  });
}

function onAddCashInput(e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
  addCashAmountInput.value = val ? Number(val).toLocaleString('id-ID') : '';
}

function confirmAddCash() {
  const num = Number(addCashAmountInput.value.replace(/[^0-9]/g, '')) || 0;
  if (num > 0) {
    addedCash.value += num;
    startingCash.value = baseCash.value + addedCash.value;
  }
  showAddCashInput.value = false;
  addCashAmountInput.value = '';
}

function cancelAddCash() {
  showAddCashInput.value = false;
  addCashAmountInput.value = '';
}

function resetAddedCash() {
  addedCash.value = 0;
  startingCash.value = baseCash.value;
}

// Buka input koreksi saldo dasar laci
function openEditBase() {
  showAddCashInput.value = false;
  showEditBaseInput.value = true;
  editBaseAmountInput.value = baseCash.value ? baseCash.value.toLocaleString('id-ID') : '';
  nextTick(() => {
    editBaseInputRef.value?.focus();
  });
}

function onEditBaseInput(e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
  editBaseAmountInput.value = val ? Number(val).toLocaleString('id-ID') : '';
}

function confirmEditBase() {
  const num = Number(editBaseAmountInput.value.replace(/[^0-9]/g, '')) || 0;
  baseCash.value = num;
  startingCash.value = baseCash.value + addedCash.value;
  showEditBaseInput.value = false;
  editBaseAmountInput.value = '';
}

function cancelEditBase() {
  showEditBaseInput.value = false;
  editBaseAmountInput.value = '';
}

function restoreOriginalBase() {
  baseCash.value = recommendedStartingCash.value;
  startingCash.value = baseCash.value + addedCash.value;
  showEditBaseInput.value = false;
}

async function handleConfirm() {
  if (isSubmitting.value) return;
  errorMessage.value = '';
  if (!cashierName.value.trim()) {
    nameError.value = true;
    nextTick(() => {
      cashierInputRef.value?.focus();
    });
    return;
  }
  if (shiftStore.isShiftActive) {
    const ok = await showConfirm({
      title: 'Shift Masih Aktif',
      message: `Shift "${shiftStore.currentShift?.cashierName}" masih terbuka. Membuka shift baru akan mengakhiri shift lama secara otomatis.`,
      details: 'Pastikan shift lama sudah direkonsiliasi (tutup shift) sebelum membuka shift baru.',
      confirmText: 'Ya, Buka Shift Baru',
      cancelText: 'Batal',
      type: 'warning'
    });
    if (!ok) return;
  }
  isSubmitting.value = true;
  try {
    await shiftStore.openShift(cashierName.value, startingCash.value, notes.value);
    emit('close');
  } catch (err: any) {
    errorMessage.value = err?.message || 'Gagal membuka shift kasir';
  } finally {
    isSubmitting.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    if (showAddCashInput.value) {
      cancelAddCash();
      return;
    }
    if (showEditBaseInput.value) {
      cancelEditBase();
      return;
    }
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
    nameError.value = false;
    errorMessage.value = '';
    resetDrawerCash();
    window.addEventListener('keydown', handleKeydown);
    nextTick(() => {
      cashierInputRef.value?.focus();
    });
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
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Modal Header (Native Explorer Theme) -->
      <div
        class="px-5 py-3.5 flex items-center justify-between border-b border-gray-200 select-none shrink-0"
        style="background-color: var(--surface-ribbon, #f6f5f2);"
      >
        <div class="flex items-center gap-2.5">
          <div class="p-1.5 bg-blue-100 text-blue-700 rounded-md">
            <LogIn :size="18" />
          </div>
          <div>
            <h2 class="text-sm font-bold text-gray-800 leading-tight">Buka Shift Kasir Baru</h2>
            <p class="text-[11px] text-gray-500">
              <template v-if="previousShift">
                Shift sebelumnya ditutup oleh: <strong class="text-gray-700 font-semibold">{{ previousShift.cashierName }}</strong>
                <span v-if="previousShift.endTime" class="text-gray-400 font-mono"> ({{ formatDateIndo(previousShift.endTime) }})</span>
                <span v-if="cleanPreviousNotes" class="italic text-gray-600"> • "{{ cleanPreviousNotes }}"</span>
              </template>
              <template v-else>
                Mulai sesi kerja kasir & hitung modal awal laci
              </template>
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

      <!-- Modal Body (Compact 2 Kolom Seimbang) -->
      <div class="p-4 overflow-y-auto">
        <!-- Banner Pesan Error (Pengganti alert browser) -->
        <div
          v-if="errorMessage"
          class="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs text-rose-800 animate-in fade-in duration-150"
        >
          <div class="flex items-center gap-2 min-w-0">
            <AlertCircle :size="15" class="text-rose-600 shrink-0" />
            <span class="font-medium truncate">{{ errorMessage }}</span>
          </div>
          <button
            type="button"
            @click="errorMessage = ''"
            class="text-rose-400 hover:text-rose-600 p-1 rounded hover:bg-rose-100 cursor-pointer transition-colors"
          >
            <X :size="14" />
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch text-xs">
          <!-- Kolom Kiri: Kasir & Modal Kas Laci (Compact) -->
          <div class="space-y-3">
            <!-- 1. Nama Kasir Bertugas -->
            <div>
              <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1 flex items-center justify-between">
                <span class="flex items-center gap-1.5">
                  <User :size="13" :class="nameError ? 'text-rose-600' : 'text-blue-600'" />
                  Nama Kasir Bertugas
                </span>
                <span
                  class="text-[10px] font-semibold tracking-normal transition-colors"
                  :class="nameError ? 'text-rose-600 font-bold' : 'text-rose-500 lowercase'"
                >
                  {{ nameError ? 'Wajib diisi!' : '*wajib diisi' }}
                </span>
              </label>
              <input
                ref="cashierInputRef"
                v-model="cashierName"
                @input="nameError = false; errorMessage = ''"
                type="text"
                placeholder="Contoh: Siti Nurhaliza / Shift Pagi"
                class="w-full px-3 py-2 border rounded-md text-xs font-semibold focus:outline-none transition-all shadow-2xs"
                :class="nameError
                  ? 'bg-rose-50/60 border-rose-400 text-rose-900 placeholder-rose-300 focus:ring-2 focus:ring-rose-400 focus:bg-white'
                  : 'bg-gray-50 border-gray-300 text-gray-800 focus:ring-2 focus:ring-blue-500 focus:bg-white'"
                autofocus
              />
              <!-- Inline Error Feedback -->
              <div
                v-if="nameError"
                class="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-600 animate-in fade-in duration-150"
              >
                <AlertCircle :size="13" class="shrink-0 text-rose-500" />
                <span>Harap isi nama kasir yang bertugas!</span>
              </div>
            </div>

            <!-- 2. Kas Modal Laci (FinTech Card Bergaya Modern & Seimbang) -->
            <div class="bg-white border border-emerald-200/90 rounded-xl shadow-2xs overflow-hidden transition-all">
              <!-- Zona Atas: Status & Display Saldo Laci -->
              <div class="p-3.5 bg-gradient-to-b from-emerald-50/50 to-white">
                <div class="flex items-center justify-between gap-3">
                  <!-- Info Laci -->
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs border border-emerald-200/70">
                      <Banknote :size="16" />
                    </div>
                    <div class="min-w-0">
                      <span class="text-xs font-bold text-slate-800 block leading-tight truncate">Uang sudah di Laci</span>
                      <span v-if="addedCash > 0" class="text-[10px] text-emerald-700 block mt-0.5 font-semibold truncate">
                        (Dasar: Rp {{ formatRupiah(baseCash) }} + Tambah: Rp {{ formatRupiah(addedCash) }})
                      </span>
                      <span v-else class="text-[10px] text-slate-500 block mt-0.5 font-medium truncate">
                        Modal fisik untuk uang kembalian
                      </span>
                    </div>
                  </div>

                  <!-- Display Nominal Hero -->
                  <div class="shrink-0 flex items-center gap-1">
                    <div class="px-2.5 py-1 bg-emerald-50/90 border border-emerald-200/80 rounded-lg flex items-baseline gap-1 shadow-2xs">
                      <span class="font-mono text-xs font-bold text-emerald-600">Rp</span>
                      <span class="font-mono font-black text-emerald-800 text-lg tracking-tight">
                        {{ formatRupiah(startingCash) }}
                      </span>
                    </div>
                    <button
                      v-if="addedCash > 0"
                      type="button"
                      @click="resetAddedCash"
                      title="Kembalikan uang tambahan"
                      class="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 cursor-pointer transition-colors"
                    >
                      <RotateCcw :size="13" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Zona Bawah: Baris Aksi Sederajat (50/50 Seimbang) / Form Kontekstual -->
              <div class="border-t border-slate-100 bg-slate-50/60 p-2.5">
                <!-- 1. Tombol Aksi Normal: Grid 2 Kolom Seimbang -->
                <div v-if="!showAddCashInput && !showEditBaseInput" class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    @click="openAddCash"
                    class="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Plus :size="13" class="stroke-[2.5]" />
                    <span>Tambah Uang</span>
                  </button>

                  <button
                    type="button"
                    @click="openEditBase"
                    title="Ubah angka jika uang fisik di laci tidak pas"
                    class="h-8 px-3 bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Pencil :size="12" class="text-slate-500" />
                    <span>Koreksi Saldo</span>
                  </button>
                </div>

                <!-- 2. Form Kontekstual: Tambah Uang ke Laci -->
                <div
                  v-else-if="showAddCashInput"
                  class="p-2 bg-emerald-50/90 border border-emerald-300 rounded-lg space-y-2 animate-in fade-in duration-150"
                >
                  <label class="block text-[11px] font-bold text-emerald-900">
                    Tambah Uang ke Laci:
                  </label>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-xs font-bold text-gray-400 font-mono">Rp</span>
                    <input
                      ref="addCashInputRef"
                      :value="addCashAmountInput"
                      @input="onAddCashInput"
                      @keyup.enter="confirmAddCash"
                      type="text"
                      placeholder="Contoh: 50.000"
                      class="w-full pl-9 pr-3 py-1.5 bg-white border border-emerald-400 rounded-md text-sm font-bold font-mono text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div class="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      type="button"
                      @click="cancelAddCash"
                      class="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200/70 rounded cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      @click="confirmAddCash"
                      class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <Check :size="12" />
                      <span>Tambahkan</span>
                    </button>
                  </div>
                </div>

                <!-- 3. Form Kontekstual: Koreksi Uang Fisik Sebenarnya di Laci -->
                <div
                  v-else-if="showEditBaseInput"
                  class="p-2 bg-amber-50/90 border border-amber-300 rounded-lg space-y-2 animate-in fade-in duration-150"
                >
                  <div class="flex items-center justify-between">
                    <label class="block text-[11px] font-bold text-amber-900">
                      Koreksi Uang Fisik Laci:
                    </label>
                    <button
                      v-if="previousShift && baseCash !== recommendedStartingCash"
                      type="button"
                      @click="restoreOriginalBase"
                      class="text-[10px] text-amber-700 hover:underline cursor-pointer"
                    >
                      Reset (Rp {{ formatRupiah(recommendedStartingCash) }})
                    </button>
                  </div>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-xs font-bold text-gray-400 font-mono">Rp</span>
                    <input
                      ref="editBaseInputRef"
                      :value="editBaseAmountInput"
                      @input="onEditBaseInput"
                      @keyup.enter="confirmEditBase"
                      type="text"
                      placeholder="0"
                      class="w-full pl-9 pr-3 py-1.5 bg-white border border-amber-400 rounded-md text-sm font-bold font-mono text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div class="flex items-center justify-end gap-2 pt-0.5">
                    <button
                      type="button"
                      @click="cancelEditBase"
                      class="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200/70 rounded cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      @click="confirmEditBase"
                      class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded shadow-2xs cursor-pointer flex items-center gap-1"
                    >
                      <Check :size="12" />
                      <span>Simpan Koreksi</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. Ketentuan Shift (Info Box) -->
            <div class="p-2.5 bg-blue-50/80 border border-blue-200 rounded-md flex items-start gap-2 text-blue-900 text-[11px] leading-relaxed">
              <CheckCircle2 :size="14" class="text-blue-600 shrink-0 mt-0.5" />
              <span>
                Setelah shift dibuka, semua transaksi penjualan <strong>Tunai</strong> dan <strong>Non-Tunai</strong> akan otomatis direkam ke sesi buku shift kasir ini sampai ditutup.
              </span>
            </div>
          </div>

          <!-- Kolom Kanan: Catatan & Ringkasan Info (Dinamis Mengisi Tinggi Penuh) -->
          <div class="flex flex-col h-full space-y-3">
            <!-- 1. Catatan Buka Shift (Flex-1 Dinamis ke bawah) -->
            <div class="flex-1 flex flex-col min-h-0">
              <label class="block text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-1 flex items-center gap-1.5 shrink-0">
                <FileText :size="13" class="text-gray-500" />
                Catatan Buka Shift (Opsional)
              </label>
              <textarea
                v-model="notes"
                placeholder="Contoh: Pecahan 10rb ada 10 lbr, 5rb ada 20 lbr, koin..."
                class="w-full flex-1 min-h-[90px] p-2.5 bg-gray-50 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none shadow-2xs"
              ></textarea>
            </div>

            <!-- 2. Status Ringkasan Kesiapan Shift -->
            <div class="p-2.5 bg-gray-50 border border-gray-200 rounded-md flex items-center justify-between text-xs shrink-0">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full" :class="cashierName.trim() ? 'bg-emerald-500' : 'bg-amber-400'"></div>
                <span class="text-[11px] text-gray-600">
                  Kasir: <strong class="text-gray-800">{{ cashierName.trim() || 'Belum diisi' }}</strong>
                </span>
              </div>
              <div class="text-[11px] font-mono font-bold text-emerald-800">
                Modal Laci: Rp {{ formatRupiah(startingCash) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer (Native Explorer Theme) -->
      <div
        class="px-5 py-3.5 border-t border-gray-200 flex items-center justify-between gap-4 select-none shrink-0"
        style="background-color: var(--surface-ribbon, #f6f5f2);"
      >
        <!-- Shortcut Hint -->
        <div class="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
          <kbd class="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[10px] font-mono text-gray-600 shadow-2xs font-semibold">Ctrl + Enter</kbd>
          <span class="text-[11px] text-gray-500">Konfirmasi</span>
        </div>

        <!-- Tombol Aksi -->
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
