<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { formatRupiah } from '../../utils/formatters';
import { useModalLock } from '../../composables/useModalLock';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

import {
  Clock,
  X,
  ShoppingCart,
  Trash2,
  ArrowRight,
  User,
  PackageCheck
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const posStore = usePosStore();
const { confirm: showConfirm } = useConfirmDialog();

// BUG FIX: tombol "Tutup (Esc)" sebelumnya tidak punya handler Esc,
// sehingga modal hanya bisa ditutup dengan klik mouse.
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('close');
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

/**
 * BUG FIX: `recallHeldCart` menimpa SELURUH keranjang. Kalau kasir sudah
 * memindai beberapa barang untuk pelanggan lain, barang-barang itu hilang
 * tanpa konfirmasi dan tanpa kemungkinan dibatalkan.
 */
async function handleRecall(heldId: string) {
  if (posStore.cartItems.length > 0) {
    const ok = await showConfirm({
      title: 'Ganti Keranjang Aktif?',
      message: `Keranjang saat ini berisi ${posStore.cartItems.length} item. Keranjang aktif akan DITIMPA oleh keranjang yang diparkir. Lanjutkan?`,
      confirmText: 'Ya, Ganti Keranjang',
      cancelText: 'Batal',
      type: 'warning'
    });
    if (!ok) return;
  }
  posStore.recallHeldCart(heldId);
  emit('close');
}

function handleDelete(heldId: string) {
  posStore.deleteHeldCart(heldId);
  if (posStore.heldCarts.length === 0) {
    emit('close');
  }
}

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => props.isOpen);
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none text-xs animate-in fade-in duration-150"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 sm:zoom-in-95">
      <!-- Mobile Pull Indicator -->
      <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0"></div>

      <!-- Modal Header -->
      <div class="px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center justify-between font-bold text-amber-950 shrink-0">
        <div class="flex items-center gap-2 text-sm">
          <Clock :size="18" class="text-amber-600" />
          <span>Antrean Belanjaan yang Diparkir (Hold Queue)</span>
          <span class="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-xs font-mono font-bold">
            {{ posStore.heldCarts.length }} Antrean
          </span>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-gray-700 rounded-lg cursor-pointer transition-colors"
          @click="emit('close')"
        >
          <X :size="17" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-4 flex-1 overflow-y-auto space-y-3">
        <div v-if="posStore.heldCarts.length === 0" class="py-12 text-center text-gray-400 space-y-2">
          <PackageCheck :size="36" class="mx-auto text-gray-300" />
          <p class="font-semibold text-gray-600">Tidak ada antrean belanjaan yang sedang diparkir</p>
          <p class="text-[11px] text-gray-400">Tekan tombol <strong>Parkir (F6)</strong> di meja kasir saat ada pembeli yang ingin mengambil barang tambahan.</p>
        </div>

        <div
          v-for="held in posStore.heldCarts"
          :key="held.id"
          class="p-3.5 bg-[#fcfbfa] hover:bg-amber-50/40 rounded-xl border border-amber-200 transition-colors space-y-2.5 shadow-2xs"
        >
          <!-- Header Baris Antrean -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded bg-amber-600 text-white font-mono font-black text-xs">
                #{{ held.cartNumber }}
              </span>
              <div class="flex items-center gap-1 font-bold text-gray-800 text-xs">
                <User :size="13" class="text-gray-500" />
                <span>{{ held.buyer }}</span>
              </div>
              <span class="text-[10px] text-gray-400 font-mono">({{ held.saleMode }})</span>
            </div>

            <div class="flex items-center gap-2">
              <span class="text-[10.5px] text-gray-400 font-mono flex items-center gap-1">
                <Clock :size="11" />
                <span>{{ held.createdAt }}</span>
              </span>
              <strong class="text-sm font-mono font-black text-blue-700">
                Rp {{ formatRupiah(held.finalTotal || held.totalSell) }}
              </strong>
            </div>
          </div>

          <!-- Rincian Barang di Keranjang yang Diparkir -->
          <div class="p-2 bg-white rounded-lg border border-gray-200 text-[11px] space-y-1">
            <div class="text-[10.5px] text-gray-500 font-semibold mb-1 flex items-center gap-1">
              <ShoppingCart :size="11" />
              <span>Daftar Barang ({{ held.items.length }} macam):</span>
            </div>
            <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              <span
                v-for="item in held.items"
                :key="item.id"
                class="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 text-gray-800 text-[10px] font-mono"
              >
                {{ item.qty }} {{ item.unit }} <strong>{{ item.name }}</strong>
              </span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-between pt-1">
            <button
              type="button"
              class="px-2.5 py-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1"
              title="Hapus antrean parkir ini tanpa diproses"
              @click="handleDelete(held.id)"
            >
              <Trash2 :size="13" />
              <span>Hapus Antrean</span>
            </button>

            <button
              type="button"
              class="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              title="Kembalikan barang ini ke meja kasir dan lanjutkan pembayaran"
              @click="handleRecall(held.id)"
            >
              <span>Buka & Lanjut Kasir</span>
              <ArrowRight :size="14" />
            </button>
          </div>
        </div>
      </div>

      <!-- Modal Footer -->
      <div class="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
        <span>Gunakan tombol ini agar antrean kasir tidak terhambat.</span>
        <button
          type="button"
          class="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-xs font-semibold text-gray-700 cursor-pointer transition-colors"
          @click="emit('close')"
        >
          Tutup (Esc)
        </button>
      </div>
    </div>
  </div>
</template>
