<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';
import { Buyer } from '../../../types';
import { useBuyerStore } from '../../../stores/buyerStore';
import { Coins, X } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  buyer: Buyer | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved', buyer: Buyer): void;
}>();

const buyerStore = useBuyerStore();

const pointAdjustAmount = ref<number>(10);
const pointAdjustType = ref<'ADD' | 'DEDUCT'>('ADD');
const pointAdjustReason = ref('');
const isSaving = ref(false);

function handleKeyDown(e: KeyboardEvent) {
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
      window.addEventListener('keydown', handleKeyDown);
      pointAdjustAmount.value = 10;
      pointAdjustType.value = 'ADD';
      pointAdjustReason.value = '';
      isSaving.value = false;
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

async function handleSave() {
  if (!props.buyer) return;
  // BUG FIX: tidak ada guard double-click -> menekan "Simpan Poin" dua kali
  // cepat menambah poin dua kali. Tidak ada `isSaving` di versi lama.
  if (isSaving.value) return;

  // BUG FIX: input angka negatif membuat mode "Kurangi Poin" justru MENAMBAH
  // poin (delta = -(-5) = +5). `min="1"` hanya validasi native browser dan
  // tidak berlaku karena tidak ada <form> di sini.
  const amount = Number(pointAdjustAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    alert('Jumlah poin harus berupa angka lebih besar dari 0.');
    return;
  }

  const current = props.buyer.points || 0;
  const delta = pointAdjustType.value === 'ADD' ? amount : -amount;
  const newPoints = Math.max(0, current + delta);
  if (pointAdjustType.value === 'DEDUCT' && amount > current) {
    const ok = window.confirm(
      `Saldo poin saat ini hanya ${current}. Kurangi ${amount} akan menjadi 0. Lanjutkan?`
    );
    if (!ok) return;
  }

  isSaving.value = true;
  try {
    // BUG FIX: `props.buyer.points = ...` adalah MUTASI PROPS (state store
    // berubah sebelum persist & muncul sebagai warning Vue). Sekarang objek
    // baru dibuat dan dikirim ke store.
    const updated: Buyer = {
      ...props.buyer,
      points: newPoints,
      // Alasan penyesuaian disimpan di notes supaya jejaknya tidak hilang.
      notes: pointAdjustReason.value.trim()
        ? `${props.buyer.notes ? props.buyer.notes + ' | ' : ''}[Penyesuaian Poin ${pointAdjustType.value === 'ADD' ? '+' : '-'}${amount}${pointAdjustReason.value.trim() ? ': ' + pointAdjustReason.value.trim() : ''}]`
        : props.buyer.notes
    };
    await buyerStore.updateBuyer(updated);
    emit('saved', updated);
    emit('close');
  } catch (err: any) {
    alert(`Gagal menyimpan penyesuaian poin: ${err?.message || err}`);
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div
    v-if="isOpen && buyer"
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none text-xs"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-gray-800">
        <div class="flex items-center gap-2 text-sm">
          <Coins :size="16" class="text-amber-500" />
          <span>Penyesuaian Poin Loyalitas</span>
        </div>
        <button type="button" class="p-1 text-gray-400 hover:text-black cursor-pointer" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>

      <div class="p-4 space-y-3.5">
        <div class="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <span class="text-gray-600 block text-[11px]">Member:</span>
          <span class="font-bold text-gray-800 text-sm block">{{ buyer.name }}</span>
          <span class="font-mono text-xs text-amber-800 font-bold block mt-0.5">
            Saldo Poin Saat Ini: {{ (buyer.points || 0).toLocaleString('id-ID') }} Poin
          </span>
        </div>

        <div>
          <label class="font-semibold text-gray-700 block mb-1">Aksi Penyesuaian</label>
          <div class="flex rounded border border-gray-300 overflow-hidden">
            <button
              type="button"
              class="flex-1 py-1.5 text-center font-bold transition-colors cursor-pointer"
              :class="pointAdjustType === 'ADD' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'"
              @click="pointAdjustType = 'ADD'"
            >
              + Tambah Poin
            </button>
            <button
              type="button"
              class="flex-1 py-1.5 text-center font-bold transition-colors cursor-pointer"
              :class="pointAdjustType === 'DEDUCT' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600'"
              @click="pointAdjustType = 'DEDUCT'"
            >
              - Kurangi Poin
            </button>
          </div>
        </div>

        <div>
          <label class="font-semibold text-gray-700 block mb-1">Jumlah Poin</label>
          <input
            v-model.number="pointAdjustAmount"
            type="number"
            min="1"
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 font-mono font-bold text-sm outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label class="font-semibold text-gray-700 block mb-1">Alasan Penyesuaian (Opsional)</label>
          <input
            v-model="pointAdjustReason"
            type="text"
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-amber-500"
            placeholder="Contoh: Bonus Ulang Tahun, Kompensasi..."
          />
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
          <button
            type="button"
            class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold cursor-pointer"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="button"
            :disabled="isSaving"
            class="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold cursor-pointer disabled:opacity-50"
            @click="handleSave"
          >
            {{ isSaving ? 'Menyimpan...' : 'Simpan Poin' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
