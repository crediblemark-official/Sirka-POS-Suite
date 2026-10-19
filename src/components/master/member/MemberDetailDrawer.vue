<script setup lang="ts">
import { ref } from 'vue';
import { Buyer } from '../../../types';
import { useBuyerStore } from '../../../stores/buyerStore';
import { formatRupiah } from '../../../utils/formatters';
import {
  CreditCard,
  Sliders,
  X,
  Users,
  Coins,
  Printer
} from 'lucide-vue-next';
import MemberCardVisual from '../MemberCardVisual.vue';
import MemberLoyaltyRulesForm from './MemberLoyaltyRulesForm.vue';

defineProps<{
  isOpen: boolean;
  buyer: Buyer;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'adjust-points', buyer: Buyer): void;
  (e: 'print-card', buyer: Buyer): void;
}>();

const buyerStore = useBuyerStore();
type DrawerTab = 'CARD' | 'RULES';
const activeDrawerTab = ref<DrawerTab>('CARD');
</script>

<template>
  <div
    v-if="isOpen"
    class="w-[410px] lg:w-[430px] border-l border-gray-300 bg-white flex flex-col shrink-0 shadow-lg overflow-hidden select-none text-xs"
  >
    <!-- Drawer Header Strip (Tinggi & Background Selaras 100% dengan Header Tabel thead di Kiri) -->
    <div class="h-9 px-3 bg-[#f0ede8] border-b border-gray-200 flex items-center justify-between shrink-0">
      <!-- Drawer Sub-Tabs (Kartu Digital vs Aturan Poin) -->
      <div class="flex items-center gap-1">
        <button
          type="button"
          class="px-2.5 py-0.5 rounded text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
          :class="activeDrawerTab === 'CARD' ? 'bg-white text-slate-900 shadow-2xs' : 'text-gray-600 hover:text-black'"
          @click="activeDrawerTab = 'CARD'"
        >
          <CreditCard :size="12" class="text-amber-600" />
          <span>Kartu Digital</span>
        </button>

        <button
          type="button"
          class="px-2.5 py-0.5 rounded text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
          :class="activeDrawerTab === 'RULES' ? 'bg-white text-slate-900 shadow-2xs' : 'text-gray-600 hover:text-black'"
          @click="activeDrawerTab = 'RULES'"
        >
          <Sliders :size="12" class="text-indigo-600" />
          <span>Aturan Poin & Tier</span>
        </button>
      </div>

      <!-- Close Drawer Button -->
      <button
        type="button"
        class="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/80 rounded cursor-pointer transition-colors"
        title="Tutup Panel"
        @click="emit('close')"
      >
        <X :size="13" />
      </button>
    </div>

    <!-- Drawer Body: Tab 1 - Kartu Member & Data Terpilih -->
    <div v-if="activeDrawerTab === 'CARD'" class="flex-1 overflow-y-auto px-4 py-3.5 space-y-4 bg-white">
      <!-- Seksi 1: Visual Kartu Member Digital -->
      <div class="pb-4 border-b border-gray-200 flex flex-col items-center">
        <MemberCardVisual :buyer="buyer" />
      </div>

      <!-- Seksi 2: Informasi Pemegang Kartu -->
      <div class="space-y-2.5 pb-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <span class="font-bold text-[11px] text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
            <Users :size="13" class="text-amber-600" />
            <span>Informasi Pemegang Kartu</span>
          </span>
          <span
            class="px-2 py-0.5 rounded-full font-black text-[10px] border shadow-2xs"
            :class="{
              'bg-slate-100 text-slate-700 border-slate-300': buyer.tier === 'REGULAR',
              'bg-blue-50 text-blue-800 border-blue-300': buyer.tier === 'SILVER',
              'bg-amber-100 text-amber-900 border-amber-300': buyer.tier === 'GOLD',
              'bg-purple-100 text-purple-900 border-purple-300': buyer.tier === 'PLATINUM'
            }"
          >
            ⭐ {{ buyer.tier || 'REGULAR' }}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-[11px]">
          <div class="p-2 bg-[#fcfbfa] rounded border border-gray-200">
            <span class="text-gray-400 block text-[10px]">Nama Member</span>
            <span class="font-bold text-gray-800 truncate block">{{ buyer.name }}</span>
          </div>

          <div class="p-2 bg-[#fcfbfa] rounded border border-gray-200">
            <span class="text-gray-400 block text-[10px]">Nomor Kartu</span>
            <span class="font-mono font-bold text-gray-800 truncate block">
              {{ buyer.memberCardNo || 'Belum Terbit' }}
            </span>
          </div>

          <div class="p-2 bg-[#fcfbfa] rounded border border-gray-200">
            <span class="text-gray-400 block text-[10px]">Saldo Poin Aktif</span>
            <span class="font-mono font-black text-amber-700 text-xs block">
              {{ (buyer.points || 0).toLocaleString('id-ID') }} Pts
            </span>
            <span class="text-[9.5px] text-gray-400 block font-mono">
              (Nilai: Rp {{ formatRupiah((buyer.points || 0) * buyerStore.loyaltySettings.pointValueInRupiah) }})
            </span>
          </div>

          <div class="p-2 bg-[#fcfbfa] rounded border border-gray-200">
            <span class="text-gray-400 block text-[10px]">Total Belanja</span>
            <span class="font-mono font-bold text-gray-800 text-xs block">
              Rp {{ formatRupiah(buyer.totalSpend || 0) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Seksi 3: Aksi Member -->
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-xs cursor-pointer shadow-2xs transition-colors"
          @click="emit('adjust-points', buyer)"
        >
          <Coins :size="13" class="text-amber-600" />
          <span>Sesuaikan Poin</span>
        </button>

        <button
          type="button"
          class="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs cursor-pointer shadow-2xs transition-colors"
          @click="emit('print-card', buyer)"
        >
          <Printer :size="13" />
          <span>Cetak Kartu</span>
        </button>
      </div>
    </div>

    <!-- Drawer Body: Tab 2 - Aturan Poin & Tier Diskon -->
    <div v-else-if="activeDrawerTab === 'RULES'" class="flex-1 overflow-y-auto px-4 py-3.5 bg-white">
      <MemberLoyaltyRulesForm />
    </div>
  </div>
</template>
