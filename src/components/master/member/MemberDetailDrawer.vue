<script setup lang="ts">
import { ref, watch } from 'vue';
import { Buyer } from '../../../types';
import { useBuyerStore } from '../../../stores/buyerStore';
import { formatRupiah } from '../../../utils/formatters';
import {
  CreditCard,
  Sliders,
  X,
  Users,
  Coins,
  Printer,
  Plus,
  Pencil,
  Edit2
} from 'lucide-vue-next';
import MemberCardVisual from './MemberCardVisual.vue';
import MemberLoyaltyRulesForm from './MemberLoyaltyRulesForm.vue';
import MemberRegisterForm from './MemberRegisterForm.vue';
import MemberEditForm from './MemberEditForm.vue';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  buyer: Buyer;
  initialTab?: 'CARD' | 'EDIT' | 'REGISTER' | 'RULES';
  initialRegisterBuyerId?: string;
}>(), {
  initialTab: 'CARD'
});

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'adjust-points', buyer: Buyer): void;
  (e: 'print-card', buyer: Buyer): void;
  (e: 'registered', buyer: Buyer): void;
}>();

const buyerStore = useBuyerStore();
type DrawerTab = 'CARD' | 'EDIT' | 'REGISTER' | 'RULES';
const activeDrawerTab = ref<DrawerTab>(props.initialTab);

watch(
  () => props.initialTab,
  (newTab) => {
    if (newTab) {
      activeDrawerTab.value = newTab;
    }
  },
  // BUG FIX: tanpa `immediate`, tab drawer tidak mengikuti `initialTab` saat
  // drawer dibuka untuk buyer lain (state tab lama bertahan).
  { immediate: true }
);

function onMemberRegistered(newBuyer: Buyer) {
  emit('registered', newBuyer);
  activeDrawerTab.value = 'CARD';
}

function onMemberUpdated(updated: Buyer) {
  emit('registered', updated);
  activeDrawerTab.value = 'CARD';
}
</script>

<template>
  <div
    v-if="isOpen"
    class="w-[380px] lg:w-[420px] border-l border-gray-300 bg-white flex flex-col shrink-0 shadow-lg overflow-hidden select-none text-xs"
  >
    <!-- Drawer Header Strip (h-10 standar FormSidebarDrawer) -->
    <div class="h-10 px-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between shrink-0">
      <!-- Drawer Sub-Tabs (Segmented Baru vs Edit, ditambah Kartu & Aturan) -->
      <div class="flex items-center gap-1.5">
        <!-- Segmented Control Baru & Edit -->
        <div class="flex items-center p-0.5 bg-gray-200/80 rounded-md text-[11px] font-semibold select-none">
          <button
            type="button"
            class="px-2.5 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 select-none"
            :class="activeDrawerTab === 'REGISTER'
              ? 'bg-white text-slate-800 shadow-xs font-bold'
              : 'text-gray-600 hover:text-gray-900 font-medium'"
            title="Daftar Member Baru"
            @click="activeDrawerTab = 'REGISTER'"
          >
            <Plus :size="11" class="stroke-[2.5]" />
            <span>Baru</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 select-none"
            :class="activeDrawerTab === 'EDIT'
              ? 'bg-white text-[#b45309] shadow-xs font-bold'
              : 'text-gray-600 hover:text-gray-900 font-medium'"
            title="Edit Data Member"
            @click="activeDrawerTab = 'EDIT'"
          >
            <Pencil :size="11" :class="activeDrawerTab === 'EDIT' ? 'text-[#b45309]' : 'text-gray-500'" class="stroke-[2]" />
            <span>Edit</span>
          </button>
        </div>

        <button
          type="button"
          class="px-2 py-1 rounded text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
          :class="activeDrawerTab === 'CARD' ? 'bg-white text-slate-900 shadow-2xs' : 'text-gray-600 hover:text-black'"
          @click="activeDrawerTab = 'CARD'"
        >
          <CreditCard :size="12" class="text-amber-600" />
          <span>Kartu</span>
        </button>

        <button
          type="button"
          class="px-2 py-1 rounded text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
          :class="activeDrawerTab === 'RULES' ? 'bg-white text-slate-900 shadow-2xs' : 'text-gray-600 hover:text-black'"
          @click="activeDrawerTab = 'RULES'"
        >
          <Sliders :size="12" class="text-indigo-600" />
          <span>Aturan</span>
        </button>
      </div>

      <!-- Close Button -->
      <button
        type="button"
        class="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded cursor-pointer transition-colors"
        title="Tutup Panel Member"
        @click="emit('close')"
      >
        <X :size="14" />
      </button>
    </div>

    <!-- Drawer Body 1: Tab Form Pendaftaran Member Baru -->
    <!--
      BUG FIX: form ini di-`v-if` per tab -> berpindah tab MEMBUAT & MEMECAH
      ulang form sehingga watcher `immediate` jalan lagi dan isian pengguna
      (nomor kartu, nama) HILANG. Sekarang form tetap ter-mount (v-show)
      sehingga isian tidak hilang saat berpindah tab.
    -->
    <MemberRegisterForm
      v-show="activeDrawerTab === 'REGISTER'"
      :initial-buyer-id="initialRegisterBuyerId"
      @registered="onMemberRegistered"
      @cancel="emit('close')"
    />

    <!-- Drawer Body 2: Tab Edit Data Member -->
    <MemberEditForm
      v-if="activeDrawerTab === 'EDIT'"
      :buyer="buyer"
      @saved="onMemberUpdated"
      @cancel="activeDrawerTab = 'CARD'"
      @adjust-points="emit('adjust-points', buyer)"
    />

    <!-- Drawer Body 3: Tab Kartu Member Digital -->
    <template v-else-if="activeDrawerTab === 'CARD'">
      <div class="flex-1 overflow-y-auto px-4 py-3.5 space-y-4 bg-white">
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
      </div>

      <!-- Sticky Footer Standar FormSidebarDrawer -->
      <div class="p-2.5 bg-white border-t border-gray-200 shrink-0">
        <div class="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            class="flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded font-bold text-xs cursor-pointer shadow-2xs transition-colors"
            @click="activeDrawerTab = 'EDIT'"
          >
            <Edit2 :size="12" class="text-blue-700" />
            <span>Edit Data</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded font-bold text-xs cursor-pointer shadow-2xs transition-colors"
            @click="emit('adjust-points', buyer)"
          >
            <Coins :size="12" class="text-amber-600" />
            <span>Atur Poin</span>
          </button>

          <button
            type="button"
            class="flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded font-bold text-xs cursor-pointer shadow-2xs transition-colors"
            @click="emit('print-card', buyer)"
          >
            <Printer :size="12" />
            <span>Cetak</span>
          </button>
        </div>
      </div>
    </template>

    <!-- Drawer Body 4: Tab Aturan Poin & Tier Diskon -->
    <div v-else-if="activeDrawerTab === 'RULES'" class="flex-1 overflow-y-auto px-4 py-3.5 bg-white">
      <MemberLoyaltyRulesForm />
    </div>
  </div>
</template>
