<script setup lang="ts">
import { formatRupiah } from '../../utils/formatters';
import {
  type ProductUnitFormItem,
  formatUnitQty,
  getParentUnitOptionsForList,
  recalculateAllUnitFactors,
  getEquivalentTotalStock,
  getProportionalSellPrice,
  isUnitFactorInvalid,
  isUnitNameInvalid,
  isUnitPriceInvalid,
  isUnitRowPartiallyFilled
} from '../../utils/multiUnits';
import { HelpCircle, Plus, Trash2 } from 'lucide-vue-next';

const props = defineProps<{
  hasMultiUnits: boolean;
  units: ProductUnitFormItem[];
  baseUnit: string;
  currentStock: number;
  lastSellPrice: number;
}>();

const emit = defineEmits<{
  (e: 'update:hasMultiUnits', value: boolean): void;
  (e: 'unit-changed'): void;
}>();

function getParentUnitOptions(idx: number): string[] {
  return getParentUnitOptionsForList(props.units, props.baseUnit, idx);
}

function handleRecalculate() {
  recalculateAllUnitFactors(props.units, props.baseUnit);
  emit('unit-changed');
}

function onUnitFactorChange() {
  handleRecalculate();
}

function onUnitParentChange() {
  handleRecalculate();
}

function onUnitNameChange() {
  handleRecalculate();
}

function addCustomUnit() {
  emit('update:hasMultiUnits', true);
  const idx = props.units.length;
  const availableParents = getParentUnitOptions(idx);
  const defaultParent = availableParents[availableParents.length - 1] || props.baseUnit || 'PCS';

  const item: ProductUnitFormItem = {
    id: `u-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    unitName: '',
    parentUnitName: defaultParent,
    conversionFactor: 0,
    displayFactor: undefined,
    mode: 'fraction',
    sellPrice: 0
  };
  props.units.push(item);
  handleRecalculate();
}

function removeUnit(index: number) {
  props.units.splice(index, 1);
  if (props.units.length === 0) {
    emit('update:hasMultiUnits', false);
  } else {
    handleRecalculate();
  }
}

defineExpose({
  recalculateAllUnitFactors: () => recalculateAllUnitFactors(props.units, props.baseUnit),
  isUnitRowPartiallyFilled
});
</script>

<template>
  <div class="space-y-2.5 pb-4 border-b border-gray-200">
    <!-- Toggle Header Minimalis dengan Tooltip -->
    <div class="flex items-center justify-between">
      <label class="flex items-center gap-2 cursor-pointer select-none">
        <input
          :checked="props.hasMultiUnits"
          type="checkbox"
          class="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500 cursor-pointer"
          @change="emit('update:hasMultiUnits', ($event.target as HTMLInputElement).checked)"
        />
        <div class="flex items-center gap-1.5">
          <span class="text-xs font-bold text-gray-800">Jual Eceran / Multi-Satuan</span>
          <div class="relative group flex items-center">
            <span class="text-gray-400 group-hover:text-purple-600 cursor-help transition-colors">
              <HelpCircle :size="13" />
            </span>
            <!-- Tooltip Instan -->
            <div
              class="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:block z-50 w-56 p-2 bg-gray-900 text-white text-[10.5px] leading-tight rounded-md shadow-xl pointer-events-none animate-in fade-in duration-75"
            >
              Untuk barang kulakan Dus/Peti yang diecer (contoh: Mie Dus, Telur Peti, Rokok Slop), satuan perlu diatur ke satuan lebih kecil.
              <div class="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
            </div>
          </div>
        </div>
      </label>
      <span
        class="text-[9.5px] font-bold px-2 py-0.5 rounded font-mono"
        :class="props.hasMultiUnits ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'text-gray-400 bg-gray-100'"
      >
        {{ props.hasMultiUnits ? 'Aktif' : 'Nonaktif' }}
      </span>
    </div>

    <!-- Detail Konfigurasi Satuan Turunan (Tampil jika hasMultiUnits aktif) -->
    <div v-if="props.hasMultiUnits" class="space-y-2 pt-1">
      <!-- Daftar Kemasan / Eceran Turunan -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <span class="text-[11px] font-bold text-gray-800">
            Jumlah {{ formatUnitQty(props.currentStock) }} {{ props.baseUnit || 'Satuan' }}:
          </span>
          <button
            type="button"
            class="text-purple-700 hover:text-purple-900 font-bold text-[10.5px] flex items-center gap-0.5 cursor-pointer"
            @click="addCustomUnit"
          >
            <Plus :size="11" />
            <span>Tambah Satuan</span>
          </button>
        </div>

        <div v-if="props.units.length === 0" class="text-center py-2.5 text-gray-400 text-xs italic bg-gray-50/70 rounded border border-dashed border-gray-200">
          Klik "+ Tambah Satuan" untuk menambahkan satuan eceran/pecahan.
        </div>

        <!-- Baris Item Satuan Pecahan Bertingkat -->
        <div
          v-for="(u, idx) in props.units"
          :key="u.id || idx"
          class="py-2.5 space-y-1.5 border-b border-gray-100 last:border-b-0"
        >
          <!-- Input Fields: [Per 1 Satuan Induk isi] -> [Satuan Baru] -> [Harga Jual] -> [Hapus] -->
          <div class="grid grid-cols-12 gap-2 items-center">
            <!-- Kolom 1: Jumlah Stock Pecahan dari Per 1 Satuan Induk -->
            <div class="col-span-4">
              <div class="flex items-center gap-1 mb-0.5 truncate">
                <span class="text-[9.5px] text-gray-500 font-medium">Per 1</span>
                <select
                  v-if="getParentUnitOptions(idx).length > 1"
                  v-model="u.parentUnitName"
                  class="bg-purple-50 text-purple-900 font-bold text-[9.5px] border border-purple-200 rounded px-1 py-0.5 outline-none cursor-pointer hover:border-purple-400"
                  title="Pilih satuan induk acuan pecahan bertingkat"
                  @change="onUnitParentChange"
                >
                  <option v-for="pOpt in getParentUnitOptions(idx)" :key="pOpt" :value="pOpt">
                    {{ pOpt }}
                  </option>
                </select>
                <span v-else class="text-[9.5px] font-bold text-purple-800">
                  {{ props.baseUnit || 'Satuan' }}
                </span>
                <span class="text-[9.5px] text-gray-500 font-medium">isi:</span>
              </div>
              <input
                v-model.number="u.displayFactor"
                type="number"
                step="any"
                min="1"
                placeholder="0"
                class="w-full rounded px-2 py-1 text-xs font-mono font-bold outline-none text-center shadow-2xs transition-colors"
                :class="isUnitFactorInvalid(u)
                  ? 'bg-rose-50 border border-rose-400 text-rose-900 focus:border-rose-600'
                  : 'bg-[#fcfbfa] border border-gray-300 text-gray-900 focus:border-purple-600'"
                @input="onUnitFactorChange"
              />
            </div>

            <!-- Kolom 2: Satuan Baru -->
            <div class="col-span-3">
              <label class="text-[9.5px] text-gray-500 block mb-0.5 font-medium">Satuan Baru</label>
              <input
                v-model="u.unitName"
                list="standard-units-list"
                type="text"
                placeholder="SATUAN"
                class="w-full rounded px-2 py-1 text-xs font-mono font-bold uppercase outline-none text-center shadow-2xs transition-colors"
                :class="isUnitNameInvalid(u)
                  ? 'bg-rose-50 border border-rose-400 text-rose-900 focus:border-rose-600 placeholder:text-rose-300'
                  : 'bg-[#fcfbfa] border border-gray-300 text-gray-900 focus:border-purple-600'"
                @input="onUnitNameChange"
              />
            </div>

            <!-- Kolom 3: Harga Jual Eceran (Opsional) -->
            <div class="col-span-4">
              <div class="flex items-center justify-between mb-0.5">
                <label class="text-[9.5px] text-gray-600 font-semibold shrink-0">
                  Harga Eceran
                </label>
                <button
                  v-if="u.displayFactor && u.displayFactor > 0 && getProportionalSellPrice(u, props.lastSellPrice) > 0"
                  type="button"
                  class="text-[9px] text-purple-700 hover:text-purple-900 underline font-mono cursor-pointer shrink-0 ml-1"
                  title="Klik untuk pasang harga proporsional ini"
                  @click="u.sellPrice = getProportionalSellPrice(u, props.lastSellPrice)"
                >
                  Set: Rp {{ formatRupiah(getProportionalSellPrice(u, props.lastSellPrice)) }}
                </button>
              </div>
              <div class="relative">
                <span class="absolute left-1.5 top-1 text-[10px] text-gray-400 font-mono">Rp</span>
                <input
                  v-model.number="u.sellPrice"
                  type="number"
                  min="0"
                  step="100"
                  :placeholder="getProportionalSellPrice(u, props.lastSellPrice) ? String(getProportionalSellPrice(u, props.lastSellPrice)) : '0'"
                  class="w-full rounded pl-6 pr-1 py-1 text-xs font-mono font-bold outline-none shadow-2xs transition-colors"
                  :class="isUnitPriceInvalid(u)
                    ? 'bg-rose-50 border border-rose-400 text-rose-900 focus:border-rose-600'
                    : 'bg-white border border-gray-300 text-gray-800 focus:border-purple-600'"
                />
              </div>
            </div>

            <!-- Kolom 4: Tombol Hapus -->
            <div class="col-span-1 flex justify-center pt-3.5">
              <button
                type="button"
                class="p-1 text-gray-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                title="Hapus baris satuan ini"
                @click="removeUnit(idx)"
              >
                <Trash2 :size="14" />
              </button>
            </div>
          </div>

          <!-- Rumus / Info Konversi Otomatis & Real-time (Tanpa Border) -->
          <div class="flex items-center justify-between gap-2 text-[10px] font-mono px-2 py-1 rounded bg-purple-50/70">
            <template v-if="u.displayFactor && u.displayFactor > 0 && u.unitName && u.unitName.trim()">
              <div class="text-purple-900 font-medium flex items-center gap-1.5 flex-wrap">
                <span>✓ 1 {{ u.parentUnitName || props.baseUnit || 'Satuan' }} = {{ u.displayFactor }} {{ u.unitName }}</span>
                <span v-if="(Number(props.currentStock) || 0) > 0" class="text-purple-600 font-normal">
                  (Stok: <strong>{{ getEquivalentTotalStock(u, props.currentStock) }}</strong> {{ u.unitName }})
                </span>
              </div>

              <div class="text-emerald-700 font-bold shrink-0 whitespace-nowrap">
                <span v-if="u.sellPrice && u.sellPrice > 0">
                  Rp {{ formatRupiah(u.sellPrice) }} / {{ u.unitName }}
                  <span v-if="u.sellPrice !== getProportionalSellPrice(u, props.lastSellPrice)" class="text-[9px] text-gray-500 font-normal ml-0.5">
                    (Khusus)
                  </span>
                </span>
                <span v-else-if="getProportionalSellPrice(u, props.lastSellPrice) > 0" class="text-purple-700 font-medium">
                  Rp {{ formatRupiah(getProportionalSellPrice(u, props.lastSellPrice)) }} / {{ u.unitName }} <span class="text-[9px] font-normal">(Otomatis)</span>
                </span>
                <span v-else class="text-gray-400 font-normal italic">
                  Belum ada harga
                </span>
              </div>
            </template>
            <div v-else class="italic text-[9.5px]">
              <span v-if="isUnitRowPartiallyFilled(u)" class="text-rose-600 font-medium">
                ⚠️ Ketiga kolom (isi pecahan, nama satuan, dan harga) wajib diisi lengkap
              </span>
              <span v-else class="text-gray-400">
                Masukkan angka isi pecahan & nama satuan di atas...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
