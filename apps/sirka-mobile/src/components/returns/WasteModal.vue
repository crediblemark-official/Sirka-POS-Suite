<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Trash2,
  X,
  Flame,
  CalendarX,
  Scale
} from 'lucide-vue-next';
import { useReturnStore } from '../../stores/returnStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useShiftStore } from '../../stores/shiftStore';
import { formatRupiah } from '../../utils/formatters';
import type { WasteReason, Product } from '../../types';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import WasteHistoryTable from './WasteHistoryTable.vue';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

const returnStore = useReturnStore();
const inventoryStore = useInventoryStore();
const shiftStore = useShiftStore();
const { confirm: showConfirm } = useConfirmDialog();

const activeTab = ref<'form' | 'history'>('form');
const selectedProductId = ref('');
const qty = ref<number | ''>('');
const reason = ref<WasteReason>('BUSUK');
const notes = ref('');
const isSubmitting = ref(false);

const selectedProduct = computed<Product | undefined>(() => {
  return inventoryStore.products.find(p => p.id === selectedProductId.value);
});

const estimatedLoss = computed(() => {
  if (!selectedProduct.value || !qty.value) return 0;
  const numQty = Number(qty.value) || 0;
  return Math.round(numQty * selectedProduct.value.lastBuyPrice);
});

const reasonOptions: { label: string; value: WasteReason; desc: string; icon: any }[] = [
  {
    label: 'Busuk / Basi',
    value: 'BUSUK',
    desc: 'Kerusakan alami buah, sayur, atau sembako lembap.',
    icon: Flame
  },
  {
    label: 'Kedaluwarsa (Expired)',
    value: 'EXPIRED',
    desc: 'Melewati batas tanggal kedaluwarsa di rak / gudang.',
    icon: CalendarX
  },
  {
    label: 'Pecah / Rusak Fisik',
    value: 'RUSAK_FISIK',
    desc: 'Telur pecah, kemasan bocor/robek saat handling.',
    icon: Trash2
  },
  {
    label: 'Susut Timbangan',
    value: 'SUSUT_TIMBANGAN',
    desc: 'Penguapan kadar air / selisih timbangan kiloan.',
    icon: Scale
  }
];

async function handleSaveWaste() {
  if (!selectedProduct.value || !qty.value || Number(qty.value) <= 0) return;

  const numQty = Number(qty.value);
  if (numQty > selectedProduct.value.stock) {
    const isProceed = await showConfirm({
      title: 'Jumlah Susut Melebihi Stok',
      message: `Jumlah susut (${numQty} ${selectedProduct.value.unit}) melebihi stok tercatat (${selectedProduct.value.stock} ${selectedProduct.value.unit}).`,
      details: 'Lanjutkan pencatatan barang rusak/susut dan penyesuaian stok?',
      confirmText: 'Lanjutkan Penyesuaian',
      cancelText: 'Periksa Kembali',
      type: 'warning'
    });
    if (!isProceed) {
      return;
    }
  }

  isSubmitting.value = true;
  try {
    await returnStore.recordWaste({
      productId: selectedProduct.value.id,
      productName: selectedProduct.value.name,
      category: selectedProduct.value.category,
      qty: numQty,
      unit: selectedProduct.value.unit,
      baseQty: numQty,
      reason: reason.value,
      notes: notes.value.trim(),
      recordedBy: shiftStore.currentShift?.cashierName || 'Petugas Toko'
    });

    // Reset Form
    selectedProductId.value = '';
    qty.value = '';
    notes.value = '';
    reason.value = 'BUSUK';
  } catch (e: any) {
    alert(`Gagal mencatat barang rusak: ${e.message || e}`);
  } finally {
    isSubmitting.value = false;
  }
}

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => returnStore.showWasteModal);
</script>

<template>
  <div
    v-if="returnStore.showWasteModal"
    class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150"
    @click.self="returnStore.closeWasteModal()"
  >
    <div
      class="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden text-gray-800 transition-all duration-200 animate-in slide-in-from-bottom duration-200 sm:zoom-in-95"
      :class="activeTab === 'history' ? 'sm:max-w-4xl' : 'sm:max-w-xl'"
      @click.stop
    >
      <!-- Mobile Pull Indicator -->
      <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0"></div>

      <!-- HEADER -->
      <div class="px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between shrink-0 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
            <Trash2 class="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 class="text-base font-bold tracking-tight">Pencatatan Barang Rusak / Susut (Waste)</h2>
            <p class="text-xs text-amber-100/90 mt-0.5">
              Write-off stok rusak/expired dari batch barang masuk (FIFO) tanpa transaksi kasir
            </p>
          </div>
        </div>
        <button
          type="button"
          class="p-2 text-amber-200 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
          @click="returnStore.closeWasteModal()"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- SUB-TAB SWITCHER -->
      <div class="px-6 py-2 bg-amber-50/80 border-b border-amber-200 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-1.5 bg-gray-200/90 p-0.5 rounded-lg border border-gray-300">
          <button
            type="button"
            class="px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all"
            :class="activeTab === 'form' ? 'bg-white text-amber-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeTab = 'form'"
          >
            + Form Input Susut
          </button>
          <button
            type="button"
            class="px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
            :class="activeTab === 'history' ? 'bg-white text-amber-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeTab = 'history'"
          >
            <span>Riwayat Susut Toko</span>
            <span v-if="returnStore.wasteRecords.length > 0" class="px-1.5 py-0.2 rounded-full text-[9.5px] font-mono bg-amber-100 text-amber-800 font-bold">
              {{ returnStore.wasteRecords.length }}
            </span>
          </button>
        </div>
      </div>

      <!-- TAB 2: TABEL RIWAYAT SUSUT -->
      <div v-if="activeTab === 'history'" class="flex-1 overflow-hidden flex flex-col p-2">
        <WasteHistoryTable />
      </div>

      <!-- TAB 1: BODY FORM SCROLLABLE -->
      <div v-else class="p-6 overflow-y-auto space-y-4 text-xs">
        <!-- 1. PILIH PRODUK -->
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Pilih Barang yang Rusak / Susut <span class="text-rose-500">*</span>
          </label>
          <select
            v-model="selectedProductId"
            class="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          >
            <option value="" disabled>-- Pilih Barang dari Gudang / Toko --</option>
            <option
              v-for="p in inventoryStore.products"
              :key="p.id"
              :value="p.id"
            >
              {{ p.name }} (Stok: {{ p.stock }} {{ p.unit }}) - Modal: Rp {{ formatRupiah(p.lastBuyPrice) }}
            </option>
          </select>
        </div>

        <!-- DETAIL BARANG AKTIF -->
        <div
          v-if="selectedProduct"
          class="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs"
        >
          <div>
            <div class="font-bold text-gray-900">{{ selectedProduct.name }}</div>
            <div class="text-[11px] text-gray-500">
              Kategori: <strong class="text-amber-800">{{ selectedProduct.category }}</strong> | Satuan: {{ selectedProduct.unit }}
            </div>
          </div>
          <div class="text-right">
            <div class="text-[10.5px] text-gray-500">Stok Fisik Saat Ini:</div>
            <div class="font-mono text-sm font-black text-amber-900">
              {{ selectedProduct.stock }} {{ selectedProduct.unit }}
            </div>
          </div>
        </div>

        <!-- 2. JUMLAH SUSUT -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Jumlah Rusak / Susut <span class="text-rose-500">*</span>
            </label>
            <div class="flex items-center gap-1.5">
              <input
                v-model.number="qty"
                type="number"
                min="0.001"
                step="any"
                placeholder="Contoh: 0.5 atau 2"
                class="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
              <span class="px-2.5 py-2 bg-gray-100 rounded-xl font-mono font-semibold text-gray-600 text-xs">
                {{ selectedProduct?.unit || 'SATUAN' }}
              </span>
            </div>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Estimasi Kerugian Modal
            </label>
            <div class="w-full px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl font-mono font-black text-sm text-rose-700 flex items-center justify-between">
              <span>Rp</span>
              <span>{{ formatRupiah(estimatedLoss) }}</span>
            </div>
          </div>
        </div>

        <!-- 3. ALASAN PENYUSUTAN -->
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Penyebab Kerusakan / Write-off
          </label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="opt in reasonOptions"
              :key="opt.value"
              type="button"
              class="p-2.5 rounded-xl border text-left cursor-pointer transition-all flex items-start gap-2.5"
              :class="reason === opt.value
                ? 'border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-400/20'
                : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'"
              @click="reason = opt.value"
            >
              <component :is="opt.icon" :size="16" class="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <div class="font-bold text-xs">{{ opt.label }}</div>
                <div class="text-[10.5px] text-gray-500 leading-tight">{{ opt.desc }}</div>
              </div>
            </button>
          </div>
        </div>

        <!-- 4. CATATAN TAMBAHAN -->
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
            Keterangan Tambahan / Lokasi Rak
          </label>
          <input
            v-model="notes"
            type="text"
            placeholder="Contoh: Peti nomor 3 kena rembesan air hujan"
            class="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
          />
        </div>
      </div>

      <!-- FOOTER -->
      <div class="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2 shrink-0">
        <template v-if="activeTab === 'form'">
          <button
            type="button"
            class="px-4 py-2 border border-gray-200 hover:bg-white text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            @click="returnStore.closeWasteModal()"
          >
            Batal
          </button>
          <button
            type="button"
            class="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-600/20 cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!selectedProduct || !qty || Number(qty) <= 0 || isSubmitting"
            @click="handleSaveWaste"
          >
            <Trash2 :size="14" />
            <span>{{ isSubmitting ? 'Menyimpan...' : 'Catat Penyesuaian Stok' }}</span>
          </button>
        </template>
        <template v-else>
          <button
            type="button"
            class="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
            @click="returnStore.closeWasteModal()"
          >
            Tutup
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
