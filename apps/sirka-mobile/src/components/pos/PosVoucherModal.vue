<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { useDiscountStore } from '../../stores/discountStore';
import { formatRupiah } from '../../utils/formatters';
import { Tag, X } from 'lucide-vue-next';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const posStore = usePosStore();
const discountStore = useDiscountStore();

const couponInput = ref('');
const couponError = ref('');
const couponSuccess = ref('');

function handleKeydown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('close');
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeydown);
      couponInput.value = '';
      couponError.value = '';
      couponSuccess.value = '';
    } else {
      window.removeEventListener('keydown', handleKeydown);
    }
  },
  // BUG FIX: tanpa `immediate`, listener Escape tidak pernah didaftarkan bila
  // modal ter-mount dalam keadaan terbuka.
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (errorTimer) {
    clearTimeout(errorTimer);
    errorTimer = null;
  }
});

let closeTimer: ReturnType<typeof setTimeout> | null = null;
let errorTimer: ReturnType<typeof setTimeout> | null = null;

function handleApplyCoupon() {
  couponError.value = '';
  couponSuccess.value = '';
  const code = couponInput.value.trim().toUpperCase();
  if (!code) return;
  const ok = posStore.applyDiscount(code);
  if (ok) {
    couponSuccess.value = `Kupon ${code} berhasil dipasang!`;
    couponInput.value = '';
    // BUG FIX: timer tidak di-clear -> menerapkan kupon kedua dalam 400 ms tetap
    // menutup modal, dan timer tetap hidup setelah unmount.
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      closeTimer = null;
      emit('close');
    }, 400);
  } else {
    // BUG FIX: pesan generik membuang alasan spesifik dari
    // `calculateDiscountAmount` ("Minimal belanja Rp …", "Khusus member",
    // "Khusus transaksi Eceran (B2C)") sehingga kasir tidak tahu kenapa
    // kupon ditolak.
    const disc = discountStore.findDiscountByCode(code);
    let reason = 'Kupon tidak berlaku atau S&K belanja belum terpenuhi.';
    if (disc) {
      const check = discountStore.calculateDiscountAmount(
        disc,
        posStore.totalSell,
        posStore.selectedBuyerData,
        posStore.cartItems,
        posStore.saleMode
      );
      if (!check.valid && check.reason) reason = check.reason;
    } else {
      reason = `Kupon "${code}" tidak ditemukan.`;
    }
    couponError.value = reason;
    if (errorTimer) clearTimeout(errorTimer);
    errorTimer = setTimeout(() => {
      errorTimer = null;
      couponError.value = '';
    }, 3500);
  }
}

function handleSelectVoucher(code: string) {
  couponInput.value = code;
  handleApplyCoupon();
}

function handleRemoveCoupon() {
  posStore.removeDiscount();
  emit('close');
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
    <div class="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 w-full sm:max-w-md max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200 sm:zoom-in-95">
      <!-- Mobile Pull Indicator -->
      <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0"></div>

      <!-- Header -->
      <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-gray-800 shrink-0">
        <div class="flex items-center gap-2 text-sm text-rose-700">
          <Tag :size="16" />
          <span>Gunakan Kupon / Voucher Promo</span>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-black rounded cursor-pointer"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-4 space-y-3 flex-1 overflow-y-auto">
        <!-- Manual Code Input -->
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-1">Punya Kode Kupon Khusus?</label>
          <div class="flex gap-1.5">
            <input
              v-model="couponInput"
              type="text"
              placeholder="Misal: HEMAT5K"
              class="flex-1 bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold uppercase outline-none focus:border-rose-500 focus:bg-white"
              @keydown.enter.prevent="handleApplyCoupon"
            />
            <button
              type="button"
              class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors shrink-0"
              @click="handleApplyCoupon"
            >
              Gunakan
            </button>
          </div>
          <div v-if="couponError" class="text-[10.5px] text-rose-600 font-semibold mt-1">
            {{ couponError }}
          </div>
          <div v-if="couponSuccess" class="text-[10.5px] text-emerald-600 font-semibold mt-1">
            {{ couponSuccess }}
          </div>
        </div>

        <!-- Active Promo List -->
        <div>
          <div class="text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center justify-between">
            <span>Atau Pilih Promo yang Tersedia:</span>
            <span class="text-gray-400 font-mono text-[10px]">{{ discountStore.activeDiscounts.length }} Voucher</span>
          </div>

          <div class="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            <div
              v-for="v in discountStore.activeDiscounts"
              :key="v.id"
              class="p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between"
              :class="posStore.appliedDiscount?.id === v.id ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-400' : 'bg-gray-50/70 border-gray-200 hover:bg-rose-50/40 hover:border-rose-200'"
              @click="handleSelectVoucher(v.code)"
            >
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-mono font-bold text-xs text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">{{ v.code }}</span>
                  <span class="font-bold text-gray-800 text-xs">{{ v.name }}</span>
                </div>
                <div class="text-[10px] text-gray-500 mt-0.5">
                  <span v-if="v.minPurchase > 0">Min. Belanja: Rp {{ formatRupiah(v.minPurchase) }}</span>
                  <span v-else>Tanpa minimal belanja</span>
                  <span v-if="v.scope === 'MEMBER_ONLY'" class="ml-1 text-amber-700 font-bold">• Khusus Member</span>
                  <span v-if="v.scope === 'CUSTOMER_TYPE'" class="ml-1 text-amber-700 font-bold">
                    • Khusus {{ v.targetCustomerType === 'B2B' ? 'Grosir' : 'Eceran' }}
                  </span>
                  <span v-if="v.scope === 'CATEGORY'" class="ml-1 text-amber-700 font-bold">• Kategori {{ v.targetCategory }}</span>
                </div>
              </div>

              <div class="text-right shrink-0 ml-2">
                <span class="font-bold font-mono text-emerald-700 text-xs block">
                  {{ v.type === 'PERCENT' ? `${v.value}%` : `Rp ${formatRupiah(v.value)}` }}
                </span>
                <!-- BUG FIX: plafon (maxDiscount) & hasil potongan aktual harus
                     ditampilkan. Sebelumnya kupon 50% ber-plafon Rp 5.000 hanya
                     tertulis "50%" sehingga kasir salah paham mengira potongannya
                     50% dari seluruh belanja. -->
                <span v-if="v.type === 'PERCENT' && v.maxDiscount && v.maxDiscount > 0" class="text-[9.5px] text-amber-700 font-bold block">
                  Maks. Rp {{ formatRupiah(v.maxDiscount) }}
                </span>
                <span class="text-[9.5px] text-rose-600 font-bold underline">
                  {{ posStore.appliedDiscount?.id === v.id ? 'Terpasang' : 'Pilih' }}
                </span>
              </div>
            </div>

            <div v-if="discountStore.activeDiscounts.length === 0" class="text-center py-6 text-gray-400">
              <Tag :size="24" class="mx-auto mb-1 opacity-40" />
              <p>Belum ada kupon promo aktif saat ini.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-4 py-2.5 bg-[#f6f5f2] border-t border-gray-200 flex items-center justify-between">
        <button
          v-if="posStore.appliedDiscount"
          type="button"
          class="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
          @click="handleRemoveCoupon"
        >
          Hapus Kupon Terpasang
        </button>
        <div v-else></div>

        <button
          type="button"
          class="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-xs font-semibold text-gray-700 cursor-pointer"
          @click="emit('close')"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
