<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { useDiscountStore } from '../../stores/discountStore';
import { formatRupiah } from '../../utils/formatters';
import { Tag, X } from 'lucide-vue-next';

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
  }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

function handleApplyCoupon() {
  couponError.value = '';
  couponSuccess.value = '';
  const code = couponInput.value.trim().toUpperCase();
  if (!code) return;
  const ok = posStore.applyDiscount(code);
  if (ok) {
    couponSuccess.value = `Kupon ${code} berhasil dipasang!`;
    couponInput.value = '';
    setTimeout(() => {
      emit('close');
    }, 400);
  } else {
    couponError.value = 'Kupon tidak berlaku atau S&K belanja belum terpenuhi.';
    setTimeout(() => { couponError.value = ''; }, 3500);
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
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none text-xs"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <!-- Header -->
      <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-gray-800">
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
      <div class="p-4 space-y-3">
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
                </div>
              </div>

              <div class="text-right shrink-0 ml-2">
                <span class="font-bold font-mono text-emerald-700 text-xs block">
                  {{ v.type === 'PERCENT' ? `${v.value}%` : `Rp ${formatRupiah(v.value)}` }}
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
