<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useStockMovementStore } from '../../stores/stockMovementStore';
import { StockAdjustReason } from '../../types';
import SearchableSelect, { SelectOption } from '../common/SearchableSelect.vue';
import { Scale, X } from 'lucide-vue-next';

const inventoryStore = useInventoryStore();
const movementStore = useStockMovementStore();

const selectedProductId = ref<string>('');
const physicalStockInput = ref<number | null>(null);
const selectedReason = ref<StockAdjustReason>('SELISIH_HITUNG');
const notes = ref<string>('');
const isSubmitting = ref<boolean>(false);

const productOptions = computed<SelectOption[]>(() => {
  return inventoryStore.products.map(p => ({
    value: p.id,
    label: p.name,
    code: p.code,
    sublabel: `Kategori: ${p.category} • Stok Sistem: ${p.stock} ${p.unit}`,
    badge: `${p.stock} ${p.unit}`
  }));
});

const currentProduct = computed(() => {
  return inventoryStore.products.find(p => p.id === selectedProductId.value);
});

const systemStock = computed(() => currentProduct.value?.stock ?? 0);

const stockDiff = computed(() => {
  if (physicalStockInput.value === null) return 0;
  return Number(physicalStockInput.value) - systemStock.value;
});

// Watch when modal opens or activeProductForAdjust changes
watch(
  () => movementStore.activeProductForAdjust,
  (prod) => {
    if (prod) {
      selectedProductId.value = prod.id;
      physicalStockInput.value = prod.stock;
    } else {
      selectedProductId.value = '';
      physicalStockInput.value = null;
    }
    selectedReason.value = 'SELISIH_HITUNG';
    notes.value = '';
  },
  { immediate: true }
);

function handleProductChange(prodId: string) {
  selectedProductId.value = prodId;
  const prod = inventoryStore.products.find(p => p.id === prodId);
  if (prod) {
    physicalStockInput.value = prod.stock;
  }
}

async function handleSaveAdjustment() {
  if (!currentProduct.value || physicalStockInput.value === null) return;
  if (isSubmitting.value) return;

  isSubmitting.value = true;
  try {
    await movementStore.adjustStock({
      productId: currentProduct.value.id,
      physicalStock: physicalStockInput.value,
      reason: selectedReason.value,
      notes: notes.value.trim() || undefined,
      adjustedBy: 'Kasir / Owner'
    });
    movementStore.closeAdjustModal();
  } catch (err) {
    alert(`Gagal menyimpan penyesuaian: ${err}`);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div
    v-if="movementStore.isAdjustModalOpen"
    class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none"
    @click.self="movementStore.closeAdjustModal"
  >
    <div
      class="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="px-5 py-3.5 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-xs">
            <Scale :size="18" class="text-white" />
          </div>
          <div>
            <h2 class="text-sm font-bold tracking-tight">Penyesuaian Stok (Stock Opname)</h2>
            <p class="text-[11px] text-purple-100/90">Sinkronkan stok fisik di toko dengan pembukuan sistem</p>
          </div>
        </div>
        <button
          type="button"
          class="p-1 rounded-lg hover:bg-white/15 text-purple-100 hover:text-white cursor-pointer transition-colors"
          @click="movementStore.closeAdjustModal"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- Form Body -->
      <div class="p-5 space-y-4 text-xs">
        <!-- Pilih Barang -->
        <div>
          <label class="text-[11px] font-semibold text-gray-700 block mb-1">Pilih Barang yang Disesuaikan *</label>
          <SearchableSelect
            :model-value="selectedProductId"
            :options="productOptions"
            placeholder="-- Cari nama atau kode barang --"
            search-placeholder="Ketik nama atau kode..."
            hotkey=""
            clearable
            @change="(opt) => opt && handleProductChange(String(opt.value))"
          />
        </div>

        <!-- Kartu Komparasi Stok -->
        <div v-if="currentProduct" class="grid grid-cols-3 gap-2.5 p-3 bg-purple-50/60 border border-purple-200/80 rounded-xl">
          <!-- Stok Tercatat -->
          <div class="text-center">
            <span class="text-[10.5px] text-gray-500 font-medium block">Tercatat Sistem</span>
            <span class="font-mono text-base font-bold text-gray-800">
              {{ systemStock }}
              <span class="text-[11px] font-normal text-gray-500">{{ currentProduct.unit }}</span>
            </span>
          </div>

          <!-- Input Stok Fisik -->
          <div class="text-center bg-white p-1.5 rounded-lg border border-purple-300 shadow-2xs">
            <label class="text-[10px] font-bold text-purple-900 block mb-0.5">Stok Fisik Riil *</label>
            <input
              v-model.number="physicalStockInput"
              type="number"
              min="0"
              placeholder="0"
              class="w-full text-center font-mono text-base font-bold text-purple-700 outline-none"
            />
          </div>

          <!-- Selisih -->
          <div class="text-center flex flex-col justify-center">
            <span class="text-[10.5px] text-gray-500 font-medium block">Selisih Fisik</span>
            <div class="font-mono text-sm font-bold flex items-center justify-center gap-1">
              <span
                v-if="stockDiff < 0"
                class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[11px]"
              >
                {{ stockDiff }} {{ currentProduct.unit }} (Kurang)
              </span>
              <span
                v-else-if="stockDiff > 0"
                class="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[11px]"
              >
                +{{ stockDiff }} {{ currentProduct.unit }} (Lebih)
              </span>
              <span
                v-else
                class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[11px]"
              >
                0 (Sesuai)
              </span>
            </div>
          </div>
        </div>

        <!-- Alasan Penyesuaian -->
        <div>
          <label class="text-[11px] font-semibold text-gray-700 block mb-1">Alasan Penyesuaian *</label>
          <select
            v-model="selectedReason"
            class="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-600 font-medium"
          >
            <option value="SELISIH_HITUNG">Selisih Hitung / Lupa Catat Transaksi</option>
            <option value="HILANG">Barang Hilang / Tidak Ditemukan di Rak</option>
            <option value="RUSAK_KADALUWARSA">Ditemukan Rusak / Bocor / Kedaluwarsa</option>
            <option value="BONUS_SUPPLIER">Bonus Fisik Berlebih dari Supplier</option>
            <option value="AWAL_MIGRASI">Saldo Awal Migrasi Sistem Baru</option>
            <option value="LAINNYA">Alasan Lainnya (Ketik di Catatan)</option>
          </select>
        </div>

        <!-- Catatan Tambahan -->
        <div>
          <label class="text-[11px] font-semibold text-gray-700 block mb-1">Catatan Tambahan (Opsional)</label>
          <input
            v-model="notes"
            type="text"
            placeholder="Contoh: Dihitung saat tutup toko malam, ditemukan selisih di rak display."
            class="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-purple-600"
          />
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
        <button
          type="button"
          class="px-3.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
          @click="movementStore.closeAdjustModal"
        >
          Batal
        </button>
        <button
          type="button"
          class="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-sm"
          :disabled="!currentProduct || physicalStockInput === null || isSubmitting"
          @click="handleSaveAdjustment"
        >
          {{ isSubmitting ? 'Menyimpan...' : 'Terapkan Penyesuaian Stok' }}
        </button>
      </div>
    </div>
  </div>
</template>
