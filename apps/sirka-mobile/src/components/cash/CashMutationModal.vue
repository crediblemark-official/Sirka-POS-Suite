<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  X,
  ArrowDownRight,
  ArrowLeftRight,
  Wallet,
  QrCode,
  Building,
  AlertCircle
} from 'lucide-vue-next';
import { useCashStore } from '../../stores/cashStore';
import { CashAccountType } from '../../types';
import { formatRupiah, localTodayStr } from '../../utils/formatters';

const props = defineProps<{
  isOpen: boolean;
  initialTab?: 'EXPENSE' | 'TRANSFER';
  initialFromAccount?: CashAccountType;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const cashStore = useCashStore();

type ActiveTab = 'EXPENSE' | 'TRANSFER';
const activeTab = ref<ActiveTab>('EXPENSE');

// Form States
const fromAccount = ref<CashAccountType>('TUNAI');
const toAccount = ref<CashAccountType>('BANK');
const amountInput = ref('');
const category = ref('Operasional Toko');
const customCategory = ref('');
const notes = ref('');
const referenceNo = ref('');
const mutationDate = ref(localTodayStr());
const errorMessage = ref('');

const expenseCategories = [
  'Operasional Toko',
  'Plastik & Kantong Kemasan',
  'Listrik, Air & Internet',
  'Gaji & Uang Makan Karyawan',
  'Bensin & Ongkos Kurir',
  'Perbaikan & Perawatan',
  'Prive (Pengambilan Pemilik)',
  'Lain-lain'
];

const quickAmounts = [10000, 20000, 50000, 100000, 200000, 500000];

const rawAmount = computed(() => {
  return Number(amountInput.value.replace(/[^0-9]/g, '')) || 0;
});

function onAmountInput(e: Event) {
  const val = (e.target as HTMLInputElement).value.replace(/[^0-9]/g, '');
  amountInput.value = val ? Number(val).toLocaleString('id-ID') : '';
  errorMessage.value = '';
}

function addQuickAmount(val: number) {
  const total = rawAmount.value + val;
  amountInput.value = total > 0 ? total.toLocaleString('id-ID') : '';
  errorMessage.value = '';
}

// Quick transfer presets
function applyTransferPreset(from: CashAccountType, to: CashAccountType, cat: string) {
  fromAccount.value = from;
  toAccount.value = to;
  category.value = cat;
  errorMessage.value = '';
}

watch(() => props.isOpen, (open) => {
  if (open) {
    activeTab.value = props.initialTab || 'EXPENSE';
    fromAccount.value = props.initialFromAccount || 'TUNAI';
    toAccount.value = fromAccount.value === 'TUNAI' ? 'BANK' : 'TUNAI';
    amountInput.value = '';
    category.value = activeTab.value === 'EXPENSE' ? 'Operasional Toko' : 'Pencairan / Settlement QRIS';
    customCategory.value = '';
    notes.value = '';
    referenceNo.value = '';
    mutationDate.value = localTodayStr();
    errorMessage.value = '';
  }
});

function handleSave() {
  const amount = rawAmount.value;
  if (!amount || amount <= 0) {
    errorMessage.value = 'Silakan masukkan nominal uang yang valid.';
    return;
  }

  const finalCategory = category.value === 'Lain-lain' && customCategory.value.trim()
    ? customCategory.value.trim()
    : category.value;

  if (activeTab.value === 'EXPENSE') {
    cashStore.addExpense({
      fromAccount: fromAccount.value,
      amount,
      category: finalCategory,
      notes: notes.value.trim(),
      referenceNo: referenceNo.value.trim(),
      date: mutationDate.value
    });
  } else {
    if (fromAccount.value === toAccount.value) {
      errorMessage.value = 'Akun asal dan akun tujuan pemindahan dana tidak boleh sama.';
      return;
    }
    cashStore.transferFunds({
      fromAccount: fromAccount.value,
      toAccount: toAccount.value,
      amount,
      category: finalCategory,
      notes: notes.value.trim(),
      referenceNo: referenceNo.value.trim(),
      date: mutationDate.value
    });
  }

  emit('success');
  emit('close');
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none text-xs animate-in fade-in duration-150"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 w-full sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 sm:zoom-in-95">
      <!-- Mobile Pull Indicator -->
      <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0"></div>

      <!-- Modal Header -->
      <div class="px-5 py-3.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
            <Wallet :size="16" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-gray-900 leading-tight">
              Mutasi &amp; Pengeluaran Kas
            </h3>
            <p class="text-[11px] text-gray-500">
              Catat uang keluar, settlement QRIS, dan pemindahan dana kas
            </p>
          </div>
        </div>
        <button
          type="button"
          class="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors cursor-pointer"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Tab Switcher -->
      <div class="flex border-b border-gray-200 bg-gray-100/70 p-1 gap-1 shrink-0">
        <button
          type="button"
          class="flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
          :class="activeTab === 'EXPENSE' ? 'bg-white text-rose-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'"
          @click="activeTab = 'EXPENSE'"
        >
          <ArrowDownRight :size="14" class="text-rose-600" />
          <span>Catat Uang Keluar (Beban)</span>
        </button>

        <button
          type="button"
          class="flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5"
          :class="activeTab === 'TRANSFER' ? 'bg-white text-blue-700 shadow-2xs' : 'text-gray-600 hover:text-gray-900'"
          @click="activeTab = 'TRANSFER'"
        >
          <ArrowLeftRight :size="14" class="text-blue-600" />
          <span>Pindah Kas &amp; Cairkan QRIS</span>
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-5 flex flex-col gap-4 text-xs overflow-y-auto flex-1">
        <!-- Error Message -->
        <div v-if="errorMessage" class="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
          <AlertCircle :size="14" class="shrink-0 text-rose-600" />
          <span>{{ errorMessage }}</span>
        </div>

        <!-- TAB 1: PENGELUARAN (UANG KELUAR) -->
        <template v-if="activeTab === 'EXPENSE'">
          <!-- Sumber Kas Keluar -->
          <div class="flex flex-col gap-1.5">
            <label class="font-bold text-gray-700">Sumber Kas / Rekening yang Berkurang:</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                class="p-2 rounded-lg border text-left flex flex-col gap-0.5 cursor-pointer transition-all"
                :class="fromAccount === 'TUNAI' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-500' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'"
                @click="fromAccount = 'TUNAI'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs">Kas Tunai</span>
                  <Wallet :size="13" class="text-emerald-600" />
                </div>
                <span class="text-[10px] text-gray-500">Laci fisik kasir / toko</span>
              </button>

              <button
                type="button"
                class="p-2 rounded-lg border text-left flex flex-col gap-0.5 cursor-pointer transition-all"
                :class="fromAccount === 'BANK' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-500' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'"
                @click="fromAccount = 'BANK'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs">Rekening Bank</span>
                  <Building :size="13" class="text-blue-600" />
                </div>
                <span class="text-[10px] text-gray-500">Transfer / M-Banking</span>
              </button>

              <button
                type="button"
                class="p-2 rounded-lg border text-left flex flex-col gap-0.5 cursor-pointer transition-all"
                :class="fromAccount === 'QRIS' ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-1 ring-indigo-500' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'"
                @click="fromAccount = 'QRIS'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs">Saldo QRIS</span>
                  <QrCode :size="13" class="text-purple-600" />
                </div>
                <span class="text-[10px] text-gray-500">Biaya admin / MDR</span>
              </button>
            </div>
          </div>

          <!-- Kategori Pengeluaran -->
          <div class="flex flex-col gap-1.5">
            <label class="font-bold text-gray-700">Kategori Biaya / Beban:</label>
            <select
              v-model="category"
              class="h-8 px-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option v-for="cat in expenseCategories" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
            <input
              v-if="category === 'Lain-lain'"
              v-model="customCategory"
              type="text"
              placeholder="Ketik nama kategori pengeluaran..."
              class="h-8 px-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs focus:outline-none focus:border-indigo-500 mt-1"
            />
          </div>
        </template>

        <!-- TAB 2: PINDAH KAS & CAIRKAN QRIS -->
        <template v-else>
          <!-- Preset Tombol Cepat Transfer -->
          <div class="flex flex-col gap-1.5">
            <label class="font-bold text-gray-700">Pilihan Cepat Mutasi Populer:</label>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                class="p-2 rounded-lg border text-left flex flex-col gap-0.5 cursor-pointer transition-all"
                :class="fromAccount === 'QRIS' && toAccount === 'BANK' ? 'border-purple-600 bg-purple-50 text-purple-900 font-bold' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'"
                @click="applyTransferPreset('QRIS', 'BANK', 'Pencairan / Settlement QRIS')"
              >
                <span class="text-[11px] leading-tight">Cairkan QRIS &rarr; Bank</span>
                <span class="text-[9.5px] text-gray-500">Uang QRIS masuk rekening</span>
              </button>

              <button
                type="button"
                class="p-2 rounded-lg border text-left flex flex-col gap-0.5 cursor-pointer transition-all"
                :class="fromAccount === 'TUNAI' && toAccount === 'BANK' ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'"
                @click="applyTransferPreset('TUNAI', 'BANK', 'Setor Tunai Kasir ke Bank')"
              >
                <span class="text-[11px] leading-tight">Setor Tunai &rarr; Bank</span>
                <span class="text-[9.5px] text-gray-500">Kas laci disetor ke rekening</span>
              </button>

              <button
                type="button"
                class="p-2 rounded-lg border text-left flex flex-col gap-0.5 cursor-pointer transition-all"
                :class="fromAccount === 'BANK' && toAccount === 'TUNAI' ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-700'"
                @click="applyTransferPreset('BANK', 'TUNAI', 'Tarik Tunai Bank ke Kasir')"
              >
                <span class="text-[11px] leading-tight">Tarik Bank &rarr; Kasir</span>
                <span class="text-[9.5px] text-gray-500">Tarik modal kembalian kasir</span>
              </button>
            </div>
          </div>

          <!-- Dari Akun & Ke Akun -->
          <div class="grid grid-cols-2 gap-3 items-center">
            <div class="flex flex-col gap-1">
              <label class="font-bold text-gray-600 text-[11px]">Dari Sumber (Uang Keluar):</label>
              <select
                v-model="fromAccount"
                class="h-8 px-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-semibold"
              >
                <option value="QRIS">Saldo QRIS (Mengendap)</option>
                <option value="TUNAI">Kas Tunai (Laci)</option>
                <option value="BANK">Rekening Bank</option>
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-bold text-gray-600 text-[11px]">Ke Tujuan (Uang Masuk):</label>
              <select
                v-model="toAccount"
                class="h-8 px-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer font-semibold"
              >
                <option value="BANK">Rekening Bank</option>
                <option value="TUNAI">Kas Tunai (Laci)</option>
                <option value="QRIS">Saldo QRIS</option>
              </select>
            </div>
          </div>
        </template>

        <!-- Nominal Uang (Besar & Jelas) -->
        <div class="flex flex-col gap-1.5">
          <label class="font-bold text-gray-700">Nominal Uang (Rp):</label>
          <div class="relative">
            <span class="absolute left-3 top-2.5 font-bold text-gray-400 text-sm">Rp</span>
            <input
              type="text"
              :value="amountInput"
              placeholder="0"
              class="w-full h-10 pl-10 pr-3 rounded-lg border border-gray-300 bg-white text-gray-900 font-mono font-bold text-base focus:outline-none focus:border-indigo-500"
              @input="onAmountInput"
            />
          </div>

          <!-- Quick Amount Buttons -->
          <div class="flex flex-wrap gap-1.5 mt-0.5">
            <button
              v-for="amt in quickAmounts"
              :key="amt"
              type="button"
              class="px-2 py-0.5 rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 font-mono text-[11px] cursor-pointer transition-colors"
              @click="addQuickAmount(amt)"
            >
              +{{ formatRupiah(amt) }}
            </button>
          </div>
        </div>

        <!-- Tanggal Mutasi & Catatan -->
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1">
            <label class="font-bold text-gray-700">Tanggal:</label>
            <input
              v-model="mutationDate"
              type="date"
              class="h-8 px-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label class="font-bold text-gray-700">No. Ref / Bukti (Opsional):</label>
            <input
              v-model="referenceNo"
              type="text"
              placeholder="Mis: Trf 1234 / No Struk"
              class="h-8 px-2 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1">
          <label class="font-bold text-gray-700">Catatan / Keterangan:</label>
          <input
            v-model="notes"
            type="text"
            :placeholder="activeTab === 'EXPENSE' ? 'Mis: Beli plastik 1 ikat di pasar' : 'Mis: Settlement QRIS batch pagi hari'"
            class="h-8 px-2.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-xs focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2 shrink-0">
        <button
          type="button"
          class="px-3.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-700 font-semibold text-xs cursor-pointer transition-colors"
          @click="emit('close')"
        >
          Batal
        </button>
        <button
          type="button"
          class="px-4 py-1.5 rounded-lg font-bold text-xs text-white cursor-pointer transition-all shadow-xs"
          :class="activeTab === 'EXPENSE' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'"
          @click="handleSave"
        >
          Simpan Catatan Mutasi
        </button>
      </div>
    </div>
  </div>
</template>
