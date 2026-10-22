<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  RotateCcw,
  X,
  PackageCheck,
  PackageX,
  CreditCard,
  Banknote,
  Info
} from 'lucide-vue-next';
import { useReturnStore } from '../../stores/returnStore';
import { useShiftStore } from '../../stores/shiftStore';
import { formatRupiah } from '../../utils/formatters';
import type { RefundType, RefundItem } from '../../types';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

const returnStore = useReturnStore();
const shiftStore = useShiftStore();

const tx = computed(() => returnStore.activeTransactionForRefund);

const refundType = ref<RefundType>('DAMAGED_GOODS');
const refundPaymentMethod = ref<'TUNAI' | 'TRANSFER'>('TUNAI');
const reason = ref('');
const isSubmitting = ref(false);

interface EditableRefundRow {
  productId: string;
  productName: string;
  unit: string;
  baseUnit?: string;
  conversionFactor: number;
  originalQty: number;
  qtyToRefund: number;
  unitPrice: number;
  returnToStock: boolean;
  batchDeductions?: any[];
}

const itemRows = ref<EditableRefundRow[]>([]);

// Reset state when modal opens or active transaction changes
watch(
  () => returnStore.activeTransactionForRefund,
  (newTx) => {
    if (!newTx) {
      itemRows.value = [];
      reason.value = '';
      return;
    }

    refundType.value = 'DAMAGED_GOODS';
    refundPaymentMethod.value = 'TUNAI';
    reason.value = '';

    itemRows.value = newTx.items.map(item => ({
      // BUG FIX: `item.id` adalah ID baris keranjang, bukan ID produk.
      // Harus memakai `item.productId` agar stok retur kembali ke produk yang benar.
      productId: item.productId,
      productName: item.name,
      unit: item.unit,
      baseUnit: item.baseUnit,
      conversionFactor: item.conversionFactor || 1,
      originalQty: item.qty,
      qtyToRefund: 0,
      unitPrice: item.sellPrice,
      returnToStock: false, // Default false jika barang rusak
      batchDeductions: item.batchDeductions
    }));
  },
  { immediate: true }
);

// Toggle all default returnToStock based on refund type
watch(refundType, (newType) => {
  const shouldReturn = newType !== 'DAMAGED_GOODS';
  itemRows.value.forEach(row => {
    row.returnToStock = shouldReturn;
  });
});

function setFullRefundForItem(row: EditableRefundRow) {
  row.qtyToRefund = row.originalQty;
}

function clearRefundForItem(row: EditableRefundRow) {
  row.qtyToRefund = 0;
}

const totalRefundAmount = computed(() => {
  return itemRows.value.reduce((sum, row) => {
    const q = Math.max(0, Math.min(row.originalQty, Number(row.qtyToRefund) || 0));
    return sum + Math.round(q * row.unitPrice);
  }, 0);
});

const hasValidItems = computed(() => {
  return itemRows.value.some(r => Number(r.qtyToRefund) > 0);
});

async function handleConfirmRefund() {
  if (!tx.value || !hasValidItems.value) return;

  const validItems: RefundItem[] = itemRows.value
    .filter(r => Number(r.qtyToRefund) > 0)
    .map(r => {
      const q = Math.max(0, Math.min(r.originalQty, Number(r.qtyToRefund) || 0));
      // BUG FIX: batch deduction hanya dikembalikan SESUAI PROPORSI barang yang
      // diretur. Sebelumnya seluruh batch deduction baris nota dikembalikan
      // kembali sehingga retur sebagian (mis. 10 dari 40) mengembalikan 40 PCS
      // ke batch -> stok batch lebih besar dari stok master.
      const ratio = r.originalQty > 0 ? q / r.originalQty : 1;
      return {
        productId: r.productId,
        productName: r.productName,
        unit: r.unit,
        baseUnit: r.baseUnit,
        conversionFactor: r.conversionFactor,
        qty: q,
        baseQty: q * r.conversionFactor,
        unitPrice: r.unitPrice,
        refundAmount: Math.round(q * r.unitPrice),
        returnToStock: r.returnToStock,
        batchDeductions: r.batchDeductions?.map(d => ({
          ...d,
          qtyDeducted: Number(((d.qtyDeducted || 0) * ratio).toFixed(4))
        }))
      };
    });

  isSubmitting.value = true;
  try {
    await returnStore.processRefund({
      transaction: tx.value,
      refundType: refundType.value,
      reason: reason.value.trim() || 'Pengembalian barang kasir',
      items: validItems,
      refundPaymentMethod: refundPaymentMethod.value,
      cashierName: shiftStore.currentShift?.cashierName || 'Kasir Toko'
    });
  } catch (e: any) {
    alert(`Gagal memproses refund: ${e.message || e}`);
  } finally {
    isSubmitting.value = false;
  }
}

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => returnStore.showRefundModal);
</script>

<template>
  <div
    v-if="returnStore.showRefundModal && tx"
    class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none animate-in fade-in duration-150"
  >
    <div
      class="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-gray-800"
      @click.stop
    >
      <!-- HEADER -->
      <div class="px-6 py-4 bg-gradient-to-r from-rose-700 to-rose-800 text-white flex items-center justify-between shrink-0 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
            <RotateCcw class="w-5 h-5 text-white" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-bold tracking-tight">Pengembalian Barang & Retur Dana</h2>
              <span class="px-2 py-0.5 rounded-md text-[11px] font-mono bg-white/20 text-white font-semibold">
                {{ tx.invoiceNo }}
              </span>
            </div>
            <p class="text-xs text-rose-100/90 mt-0.5">
              Pelanggan: <strong class="text-white">{{ tx.buyer }}</strong> | Tanggal: {{ tx.date }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="p-2 text-rose-200 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer transition-colors"
          @click="returnStore.closeRefundModal()"
        >
          <X :size="18" />
        </button>
      </div>

      <!-- BODY SCROLLABLE -->
      <div class="p-6 overflow-y-auto space-y-5 text-xs">
        <!-- 1. KATEGORI / JENIS RETUR -->
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
            Pilih Jenis Masalah / Retur
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              class="p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between"
              :class="refundType === 'DAMAGED_GOODS'
                ? 'border-rose-500 bg-rose-50/70 text-rose-900 ring-2 ring-rose-400/20'
                : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'"
              @click="refundType = 'DAMAGED_GOODS'"
            >
              <div class="flex items-center gap-2 mb-1">
                <PackageX :size="16" class="text-rose-600" />
                <span class="font-bold text-xs">Barang Rusak / Busuk</span>
              </div>
              <p class="text-[11px] text-gray-500 leading-tight">
                Uang dikembalikan, barang <strong>TIDAK</strong> masuk stok (masuk buku susut).
              </p>
            </button>

            <button
              type="button"
              class="p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between"
              :class="refundType === 'RESTOCK'
                ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-400/20'
                : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'"
              @click="refundType = 'RESTOCK'"
            >
              <div class="flex items-center gap-2 mb-1">
                <PackageCheck :size="16" class="text-emerald-600" />
                <span class="font-bold text-xs">Barang Layak Jual</span>
              </div>
              <p class="text-[11px] text-gray-500 leading-tight">
                Batal beli / tukar. Uang kembali, barang <strong>MASUK KEMBALI</strong> ke batch FIFO.
              </p>
            </button>

            <button
              type="button"
              class="p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between"
              :class="refundType === 'CORRECTION'
                ? 'border-blue-500 bg-blue-50/70 text-blue-900 ring-2 ring-blue-400/20'
                : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'"
              @click="refundType = 'CORRECTION'"
            >
              <div class="flex items-center gap-2 mb-1">
                <RotateCcw :size="16" class="text-blue-600" />
                <span class="font-bold text-xs">Koreksi Salah Input</span>
              </div>
              <p class="text-[11px] text-gray-500 leading-tight">
                Kasir salah ketik qty atau salah item. Stok & selisih uang dikoreksi akurat.
              </p>
            </button>
          </div>
        </div>

        <!-- 2. TABEL DAFTAR BARANG YANG AKAN DIRETUR -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Item Barang dalam Nota
            </label>
            <span class="text-gray-400 text-[11px]">Masukkan jumlah barang yang diretur/dikoreksi</span>
          </div>

          <div class="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-semibold text-[11px]">
                <tr>
                  <th class="py-2.5 px-3">Nama Barang</th>
                  <th class="py-2.5 px-3 text-center w-24">Terjual</th>
                  <th class="py-2.5 px-3 text-center w-36">Jml Retur</th>
                  <th class="py-2.5 px-3 text-center w-32">Masuk Stok?</th>
                  <th class="py-2.5 px-3 text-right w-32">Nominal Retur</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr
                  v-for="row in itemRows"
                  :key="row.productId"
                  class="hover:bg-gray-50/60 transition-colors"
                  :class="row.qtyToRefund > 0 ? 'bg-rose-50/30' : ''"
                >
                  <td class="py-2.5 px-3">
                    <div class="font-semibold text-gray-900">{{ row.productName }}</div>
                    <div class="text-[10.5px] text-gray-400 font-mono">
                      @ Rp {{ formatRupiah(row.unitPrice) }} / {{ row.unit }}
                    </div>
                  </td>
                  <td class="py-2.5 px-3 text-center font-mono font-bold text-gray-700">
                    {{ row.originalQty }} {{ row.unit }}
                  </td>
                  <td class="py-2.5 px-3 text-center">
                    <div class="flex items-center justify-center gap-1">
                      <input
                        v-model.number="row.qtyToRefund"
                        type="number"
                        min="0"
                        :max="row.originalQty"
                        step="any"
                        placeholder="0"
                        class="w-20 px-2 py-1 text-center font-mono font-bold border rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                        :class="row.qtyToRefund > 0 ? 'border-rose-400 bg-white text-rose-700' : 'border-gray-200 text-gray-400'"
                      />
                      <button
                        type="button"
                        class="px-1.5 py-1 text-[10px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 rounded cursor-pointer transition-colors"
                        title="Retur semua"
                        @click="row.qtyToRefund === row.originalQty ? clearRefundForItem(row) : setFullRefundForItem(row)"
                      >
                        {{ row.qtyToRefund === row.originalQty ? 'Batal' : 'Semua' }}
                      </button>
                    </div>
                  </td>
                  <td class="py-2.5 px-3 text-center">
                    <label class="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        v-model="row.returnToStock"
                        type="checkbox"
                        class="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer"
                        :disabled="row.qtyToRefund <= 0"
                      />
                      <span
                        class="text-[11px] font-medium"
                        :class="row.returnToStock ? 'text-emerald-700 font-bold' : 'text-gray-400'"
                      >
                        {{ row.returnToStock ? 'Kembali' : 'Tidak' }}
                      </span>
                    </label>
                  </td>
                  <td class="py-2.5 px-3 text-right font-mono font-bold" :class="row.qtyToRefund > 0 ? 'text-rose-600' : 'text-gray-400'">
                    Rp {{ formatRupiah(Math.round((Number(row.qtyToRefund) || 0) * row.unitPrice)) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. METODE KAS & ALASAN -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Metode Pengembalian Uang
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all"
                :class="refundPaymentMethod === 'TUNAI'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-400/20'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                @click="refundPaymentMethod = 'TUNAI'"
              >
                <Banknote :size="16" class="text-emerald-600" />
                <span>Kas Tunai Register</span>
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all"
                :class="refundPaymentMethod === 'TRANSFER'
                  ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-400/20'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'"
                @click="refundPaymentMethod = 'TRANSFER'"
              >
                <CreditCard :size="16" class="text-blue-600" />
                <span>Transfer / Rekening</span>
              </button>
            </div>
            <p v-if="refundPaymentMethod === 'TUNAI'" class="text-[10.5px] text-amber-700 mt-1.5 flex items-center gap-1">
              <Info :size="12" />
              Uang tunai akan otomatis dipotong dari kas shift kasir aktif.
            </p>
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Alasan Retur / Catatan Petugas
            </label>
            <input
              v-model="reason"
              type="text"
              placeholder="Contoh: Telur pecah 3 butir / Beras bau apek"
              class="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      <!-- FOOTER -->
      <div class="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <div class="text-gray-500 text-xs">Total Pengembalian Dana:</div>
          <div class="font-mono text-lg font-black text-rose-600">
            Rp {{ formatRupiah(totalRefundAmount) }}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-4 py-2 border border-gray-200 hover:bg-white text-gray-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
            @click="returnStore.closeRefundModal()"
          >
            Batal
          </button>
          <button
            type="button"
            class="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 cursor-pointer transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!hasValidItems || isSubmitting"
            @click="handleConfirmRefund"
          >
            <RotateCcw :size="14" />
            <span>{{ isSubmitting ? 'Memproses...' : 'Konfirmasi Retur Nota' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
