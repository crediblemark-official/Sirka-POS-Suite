<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted } from 'vue';
import { CartItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { useInventoryStore } from '../../stores/inventoryStore';
import { X, Calculator, Check, Tag, DollarSign, Percent, RotateCcw, Info } from 'lucide-vue-next';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

const props = defineProps<{
  isOpen: boolean;
  item: CartItem | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', payload: { itemId: string; sellPrice: number; markupPercent: number }): void;
}>();

const inventoryStore = useInventoryStore();

type AdjustMode = 'sellPrice' | 'markupNominal' | 'markupPercent';
const activeMode = ref<AdjustMode>('sellPrice');

const sellPriceInput = ref<number>(0);
const markupNominalInput = ref<number>(0);
const markupPercentInput = ref<number>(0);

const priceInputRef = ref<HTMLInputElement | null>(null);
const nominalInputRef = ref<HTMLInputElement | null>(null);
const percentInputRef = ref<HTMLInputElement | null>(null);

// BUG FIX: harga pada baris keranjang expressed dalam SATUAN AKTIF (mis. 1 DUS),
// sedangkan `CartItem.buyPrice` & `Product.lastSellPrice` disimpan per SATUAN
// DASAR. Tanpa konversi, "Reset ke Harga Master" untuk penjualan per DUS
// menulis harga 1 satuan dasar (harga jual DUS jadi 40x terlalu murah) dan
// perhitungan margin menampilkan diskon palsu.
const conversionFactor = computed(() => props.item?.conversionFactor || 1);

/** Harga modal per satuan AKTIF (dikalikan faktor konversi). */
const buyPrice = computed(() => Math.round((props.item?.buyPrice || 0) * conversionFactor.value));

// Ambil data harga baku master barang asli
const masterProduct = computed(() => {
  if (!props.item?.productId) return null;
  return inventoryStore.products.find(p => p.id === props.item?.productId) || null;
});

/** Harga jual master per satuan AKTIF. */
const masterSellPrice = computed(() => {
  return Math.round((masterProduct.value?.lastSellPrice || 0) * conversionFactor.value);
});

const isPriceModifiedFromMaster = computed(() => {
  return masterSellPrice.value > 0 && sellPriceInput.value !== masterSellPrice.value;
});

const discountFromMaster = computed(() => {
  if (masterSellPrice.value > 0 && sellPriceInput.value < masterSellPrice.value) {
    const nominal = masterSellPrice.value - sellPriceInput.value;
    const percent = Number(((nominal / masterSellPrice.value) * 100).toFixed(1));
    return { nominal, percent };
  }
  return null;
});

watch(
  () => [props.isOpen, props.item],
  ([open]) => {
    if (open && props.item) {
      window.addEventListener('keydown', handleKeyDown);
      const sp = props.item.sellPrice || 0;
      const bp = props.item.buyPrice || 0;
      sellPriceInput.value = sp;
      markupNominalInput.value = Math.max(0, sp - bp);
      markupPercentInput.value = bp > 0 ? Number((((sp - bp) / bp) * 100).toFixed(1)) : 0;
      activeMode.value = 'sellPrice';
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
  if (activeMode.value === 'sellPrice') {
    priceInputRef.value?.focus();
    priceInputRef.value?.select();
  } else if (activeMode.value === 'markupNominal') {
    nominalInputRef.value?.focus();
    nominalInputRef.value?.select();
  } else if (activeMode.value === 'markupPercent') {
    percentInputRef.value?.focus();
    percentInputRef.value?.select();
  }
}

function onSellPriceChange(val: number) {
  sellPriceInput.value = Math.max(0, val);
  const bp = buyPrice.value;
  markupNominalInput.value = Math.max(0, sellPriceInput.value - bp);
  markupPercentInput.value = bp > 0 ? Number((((sellPriceInput.value - bp) / bp) * 100).toFixed(1)) : 0;
}

function onMarkupNominalChange(val: number) {
  markupNominalInput.value = Math.max(0, val);
  const bp = buyPrice.value;
  sellPriceInput.value = bp + markupNominalInput.value;
  markupPercentInput.value = bp > 0 ? Number(((markupNominalInput.value / bp) * 100).toFixed(1)) : 0;
}

function onMarkupPercentChange(val: number) {
  markupPercentInput.value = Math.max(0, val);
  const bp = buyPrice.value;
  sellPriceInput.value = Math.round(bp * (100 + markupPercentInput.value) / 100);
  markupNominalInput.value = Math.max(0, sellPriceInput.value - bp);
}

function resetToMasterPrice() {
  if (masterSellPrice.value > 0) {
    onSellPriceChange(masterSellPrice.value);
  }
}

function handleSave() {
  if (!props.item) return;
  emit('save', {
    itemId: props.item.id,
    sellPrice: sellPriceInput.value,
    markupPercent: markupPercentInput.value
  });
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
    v-if="isOpen && item"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150"
    @click.self="emit('close')"
  >
    <div
      class="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 w-full sm:max-w-md max-h-[92vh] sm:max-h-[88vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 sm:zoom-in-95"
    >
      <!-- Mobile Pull Indicator -->
      <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0"></div>

      <!-- Header -->
      <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-slate-50 shrink-0">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded bg-amber-100 text-amber-800 flex items-center justify-center">
            <Calculator :size="15" />
          </div>
          <div>
            <h3 class="font-bold text-gray-900 text-xs">Negosiasi Harga / Ubah Harga Khusus</h3>
            <p class="text-[10px] text-gray-500">Harga master di menu barang tetap aman dan tidak berubah</p>
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

      <!-- Item Info Banner -->
      <div class="px-4 py-2.5 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between text-xs">
        <div class="min-w-0 flex-1 pr-2">
          <div class="font-bold text-gray-900 truncate text-xs">{{ item.name }}</div>
          <div class="text-[10.5px] text-gray-500 flex items-center gap-2 mt-0.5 font-mono">
            <span>Satuan: <strong class="text-amber-800 font-sans uppercase font-bold">{{ item.unit }}</strong></span>
            <span>•</span>
            <span>Kategori: {{ item.category }}</span>
          </div>
        </div>
        <div class="text-right shrink-0 font-mono text-xs">
          <div class="text-[9.5px] text-gray-400 font-sans">Harga Master Asli</div>
          <div class="font-bold text-gray-800">
            Rp {{ formatRupiah(masterSellPrice || buyPrice) }}
          </div>
          <div class="text-[9px] text-gray-400 font-sans">Modal: Rp {{ formatRupiah(buyPrice) }}</div>
        </div>
      </div>

      <!-- Body Content -->
      <div class="p-4 space-y-4 flex-1 overflow-y-auto">
        <!-- Switch Mode Buttons (Segmented Controls) -->
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              PILIH CARA HITUNG:
            </span>
            <button
              v-if="isPriceModifiedFromMaster"
              type="button"
              class="text-[10px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
              title="Kembalikan harga ke patokan master barang"
              @click="resetToMasterPrice"
            >
              <RotateCcw :size="10" />
              <span>Reset ke Harga Master</span>
            </button>
          </div>

          <div class="p-1 bg-gray-100 rounded-lg flex items-center gap-1 border border-gray-200">
            <button
              type="button"
              class="flex-1 py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              :class="activeMode === 'sellPrice'
                ? 'bg-white text-amber-800 shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-800'"
              @click="switchMode('sellPrice')"
            >
              <Tag :size="12" />
              <span>Harga Jual</span>
            </button>
            <button
              type="button"
              class="flex-1 py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              :class="activeMode === 'markupNominal'
                ? 'bg-white text-indigo-800 shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-800'"
              @click="switchMode('markupNominal')"
            >
              <DollarSign :size="12" />
              <span>+Rp Markup</span>
            </button>
            <button
              type="button"
              class="flex-1 py-1.5 px-2 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              :class="activeMode === 'markupPercent'
                ? 'bg-white text-emerald-800 shadow-xs border border-gray-200'
                : 'text-gray-500 hover:text-gray-800'"
              @click="switchMode('markupPercent')"
            >
              <Percent :size="12" />
              <span>% Persentase</span>
            </button>
          </div>
        </div>

        <!-- Input Box Tunggal Sesuai Mode Aktif -->
        <div class="min-h-[105px]">
          <!-- Mode 1: Harga Jual Langsung -->
          <div
            v-if="activeMode === 'sellPrice'"
            class="p-3 bg-amber-50/50 border border-amber-300 rounded-lg space-y-2 animate-in fade-in duration-150"
          >
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-gray-800">
                Ketik Langsung Harga Jual:
              </label>
              <span class="text-[10px] text-gray-500">Nominal yang dibayar pembeli</span>
            </div>
            <div class="relative flex items-center">
              <span class="absolute left-3 text-sm font-bold font-mono text-gray-500">Rp</span>
              <input
                ref="priceInputRef"
                type="text"
                inputmode="numeric"
                :value="sellPriceInput ? formatRupiah(sellPriceInput) : ''"
                class="w-full h-10 pl-11 pr-3 text-right font-mono font-bold text-base bg-white border border-gray-300 rounded-md outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all"
                placeholder="0"
                @input="(e: any) => {
                  const val = Number(e.target.value.replace(/\D/g, '')) || 0;
                  onSellPriceChange(val);
                }"
              />
            </div>
          </div>

          <!-- Mode 2: Nominal Markup (+Rp) -->
          <div
            v-else-if="activeMode === 'markupNominal'"
            class="p-3 bg-indigo-50/50 border border-indigo-300 rounded-lg space-y-2 animate-in fade-in duration-150"
          >
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-gray-800">
                Ketik Nominal Keuntungan (+Rp):
              </label>
              <span class="text-[10px] text-gray-500">Ditambahkan di atas harga modal</span>
            </div>
            <div class="relative flex items-center">
              <span class="absolute left-3 text-sm font-bold font-mono text-indigo-700">+Rp</span>
              <input
                ref="nominalInputRef"
                type="text"
                inputmode="numeric"
                :value="markupNominalInput ? formatRupiah(markupNominalInput) : ''"
                class="w-full h-10 pl-14 pr-3 text-right font-mono font-bold text-base bg-white border border-gray-300 rounded-md outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
                placeholder="0"
                @input="(e: any) => {
                  const val = Number(e.target.value.replace(/\D/g, '')) || 0;
                  onMarkupNominalChange(val);
                }"
              />
            </div>
            <!-- Preset Cepat Nominal -->
            <div class="flex items-center gap-1.5 pt-1 flex-wrap">
              <span class="text-[10px] text-gray-400">Pilihan cepat:</span>
              <button
                v-for="nom in [1000, 2000, 5000, 10000, 15000, 20000]"
                :key="nom"
                type="button"
                class="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold cursor-pointer transition-colors"
                :class="markupNominalInput === nom
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-indigo-50 hover:border-indigo-300'"
                @click="onMarkupNominalChange(nom)"
              >
                +{{ nom >= 1000 ? `${nom / 1000}k` : nom }}
              </button>
            </div>
          </div>

          <!-- Mode 3: Persentase Markup (%) -->
          <div
            v-else-if="activeMode === 'markupPercent'"
            class="p-3 bg-emerald-50/50 border border-emerald-300 rounded-lg space-y-2 animate-in fade-in duration-150"
          >
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-gray-800">
                Ketik Persentase Keuntungan (%):
              </label>
              <span class="text-[10px] text-gray-500">% margin dari harga modal</span>
            </div>
            <div class="relative flex items-center">
              <input
                ref="percentInputRef"
                type="text"
                inputmode="decimal"
                :value="markupPercentInput || ''"
                class="w-full h-10 px-3 pr-9 text-right font-mono font-bold text-base bg-white border border-gray-300 rounded-md outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all"
                placeholder="0"
                @input="(e: any) => {
                  const raw = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                  const num = parseFloat(raw);
                  onMarkupPercentChange(isNaN(num) ? 0 : num);
                }"
              />
              <span class="absolute right-3 text-sm font-bold font-mono text-emerald-700">%</span>
            </div>
            <!-- Preset Cepat Persentase -->
            <div class="flex items-center gap-1.5 pt-1 flex-wrap">
              <span class="text-[10px] text-gray-400">Pilihan cepat:</span>
              <button
                v-for="pct in [0, 10, 15, 20, 25, 30]"
                :key="pct"
                type="button"
                class="px-2 py-0.5 rounded text-[10.5px] font-mono font-bold cursor-pointer transition-colors"
                :class="markupPercentInput === pct
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:border-emerald-300'"
                @click="onMarkupPercentChange(pct)"
              >
                {{ pct === 0 ? '0% (Modal)' : `+${pct}%` }}
              </button>
            </div>
          </div>
        </div>

        <!-- Hasil Ringkasan Bersih -->
        <div class="p-3 bg-slate-100 rounded-lg flex items-center justify-between text-xs font-mono border border-slate-200">
          <div>
            <div class="text-[10px] text-gray-500 font-sans">Hasil Akhir Struk Ini:</div>
            <div class="flex items-baseline gap-1.5">
              <span v-if="discountFromMaster" class="line-through text-xs text-gray-400 font-normal">
                Rp {{ formatRupiah(masterSellPrice) }}
              </span>
              <span class="text-base font-bold text-amber-800">
                Rp {{ formatRupiah(sellPriceInput) }}
              </span>
              <span class="text-xs text-gray-500 font-normal">/ {{ item.unit }}</span>
            </div>
            <div v-if="discountFromMaster" class="text-[10.5px] font-bold text-rose-600 font-sans flex items-center gap-1 mt-0.5">
              <Tag :size="11" />
              <span>Diskon: -Rp {{ formatRupiah(discountFromMaster.nominal) }} ({{ discountFromMaster.percent }}%)</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[10px] text-gray-500 font-sans">Margin Untung:</div>
            <div class="text-xs font-bold text-emerald-700">
              +Rp {{ formatRupiah(markupNominalInput) }} ({{ markupPercentInput }}%)
            </div>
            <div v-if="discountFromMaster" class="text-[10px] text-emerald-600 font-sans font-medium mt-0.5">
              Masih untung dari modal
            </div>
          </div>
        </div>

        <!-- Info Keamanan Data Master -->
        <div class="flex items-center gap-1.5 text-[10.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
          <Info :size="12" class="text-blue-500 shrink-0" />
          <span>Perubahan harga ini <strong>hanya berlaku untuk transaksi struk saat ini</strong>. Data harga patokan di Menu Barang tetap aman dan tidak berubah.</span>
        </div>
      </div>

      <!-- Footer Buttons -->
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
          class="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded font-bold cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
          @click="handleSave"
        >
          <Check :size="14" />
          <span>Terapkan Harga (Enter)</span>
        </button>
      </div>
    </div>
  </div>
</template>
