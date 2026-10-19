<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Buyer, MembershipTier } from '../../types';
import { useBuyerStore } from '../../stores/buyerStore';
import { formatRupiah } from '../../utils/formatters';
import {
  CreditCard,
  Printer,
  Coins,
  UserPlus,
  Building,
  ShoppingBag,
  UserCheck,
  Users,
  Sparkles
} from 'lucide-vue-next';

import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import MemberRegisterModal from './member/MemberRegisterModal.vue';
import MemberPointAdjustModal from './member/MemberPointAdjustModal.vue';
import MemberPrintModal from './member/MemberPrintModal.vue';
import MemberDetailDrawer from './member/MemberDetailDrawer.vue';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const buyerStore = useBuyerStore();

const localSearchQuery = ref('');
type MemberFilterTier = MembershipTier | 'ALL' | 'UNREGISTERED' | 'B2B' | 'B2C';
const selectedTierFilter = ref<MemberFilterTier>('ALL');

// Drawer State
const showDetailDrawer = computed({
  get: () => buyerStore.showMemberDrawer,
  set: (val: boolean) => { buyerStore.showMemberDrawer = val; }
});

// Modals State
const showPrintCardModal = ref(false);
const activeCardPreviewBuyer = ref<Buyer>(buyerStore.buyers[0] || {
  id: 'preview',
  name: 'Budi Santoso',
  memberCardNo: 'MBR-CITRA-8899',
  tier: 'GOLD',
  points: 250,
  totalSpend: 6500000,
  memberSince: '2026-01-01'
});

const showPointAdjustModal = ref(false);
const buyerForPointAdjust = ref<Buyer | null>(null);

const showRegisterMemberModal = ref(false);
const registerInitialBuyerId = ref<string | undefined>(undefined);

// Counts for filter pills
const regularCount = computed(() => buyerStore.buyers.filter(b => b.memberCardNo && b.tier === 'REGULAR').length);
const silverCount = computed(() => buyerStore.buyers.filter(b => b.memberCardNo && b.tier === 'SILVER').length);
const goldCount = computed(() => buyerStore.buyers.filter(b => b.memberCardNo && b.tier === 'GOLD').length);
const platinumCount = computed(() => buyerStore.buyers.filter(b => b.memberCardNo && b.tier === 'PLATINUM').length);
const b2bCount = computed(() => buyerStore.buyers.filter(b => b.customerType === 'B2B').length);
const b2cCount = computed(() => buyerStore.buyers.filter(b => b.customerType === 'B2C').length);
const registeredMembersCount = computed(() => buyerStore.buyers.filter(b => b.memberCardNo).length);
const nonMemberCount = computed(() => buyerStore.buyers.filter(b => !b.memberCardNo).length);
const totalPointsAccumulated = computed(() => buyerStore.buyers.reduce((sum, b) => sum + (b.points || 0), 0));
const totalMemberSpend = computed(() => buyerStore.buyers.reduce((sum, b) => sum + (b.totalSpend || 0), 0));

// DRY Metric Stats configuration
const metricStats = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Pelanggan',
    value: buyerStore.buyers.length,
    sublabel: 'Database Toko',
    icon: Users,
    iconBoxClass: 'bg-blue-50 text-blue-600',
    valClass: 'text-gray-900',
  },
  {
    label: 'Member Terdaftar',
    value: registeredMembersCount.value,
    sublabel: 'Pegang Kartu',
    icon: CreditCard,
    iconBoxClass: 'bg-emerald-50 text-emerald-600',
    valClass: 'text-emerald-700',
    sublabelClass: 'text-emerald-600 font-medium',
  },
  {
    label: 'Belum Berkartu',
    value: nonMemberCount.value,
    sublabel: 'Pelanggan Reguler',
    icon: UserCheck,
    iconBoxClass: 'bg-rose-50 text-rose-600',
    valClass: 'text-rose-600',
    sublabelClass: 'text-rose-500',
  },
  {
    label: 'Total Poin Beredar',
    value: totalPointsAccumulated.value.toLocaleString('id-ID'),
    sublabel: 'Saldo Poin Member',
    icon: Coins,
    iconBoxClass: 'bg-amber-50 text-amber-600',
    valClass: 'text-amber-700',
    sublabelClass: 'text-amber-600 font-medium',
  },
  {
    label: 'Akumulasi Belanja',
    value: formatRupiah(totalMemberSpend.value),
    sublabel: 'Total Transaksi Member',
    icon: ShoppingBag,
    iconBoxClass: 'bg-purple-50 text-purple-600',
    valClass: 'text-purple-700',
  },
  {
    label: 'Member VIP',
    value: goldCount.value + platinumCount.value,
    sublabel: 'Tier Gold & Platinum',
    icon: Sparkles,
    iconBoxClass: 'bg-indigo-50 text-indigo-600',
    valClass: 'text-indigo-700',
    sublabelClass: 'text-indigo-600',
  }
]);

function openRegisterModal(buyerId?: string) {
  registerInitialBuyerId.value = buyerId;
  showRegisterMemberModal.value = true;
}

function onMemberRegistered(buyer: Buyer) {
  activeCardPreviewBuyer.value = buyer;
}

const filteredMembers = computed(() => {
  return buyerStore.buyers.filter(b => {
    const isMbr = Boolean(b.memberCardNo);
    const q = (props.searchQuery || localSearchQuery.value).toLowerCase().trim();
    const matchesSearch =
      !q ||
      b.name.toLowerCase().includes(q) ||
      (b.memberCardNo && b.memberCardNo.toLowerCase().includes(q)) ||
      (b.phone && b.phone.includes(q));

    if (selectedTierFilter.value === 'UNREGISTERED') {
      return !isMbr && matchesSearch;
    }
    if (selectedTierFilter.value === 'B2B') {
      return b.customerType === 'B2B' && matchesSearch;
    }
    if (selectedTierFilter.value === 'B2C') {
      return b.customerType === 'B2C' && matchesSearch;
    }

    const matchesTier = selectedTierFilter.value === 'ALL' || b.tier === selectedTierFilter.value;
    return isMbr && matchesSearch && matchesTier;
  });
});

// Auto-select first member in preview
watch(
  filteredMembers,
  (list) => {
    if (list.length > 0) {
      if (!list.some(b => b.id === activeCardPreviewBuyer.value.id)) {
        const firstMbr = list.find(b => b.memberCardNo) || list[0];
        activeCardPreviewBuyer.value = firstMbr;
      }
    }
  },
  { immediate: true }
);

function selectForPreview(buyer: Buyer) {
  activeCardPreviewBuyer.value = buyer;
  showDetailDrawer.value = true;
}

function openPointAdjustModal(buyer: Buyer) {
  buyerForPointAdjust.value = buyer;
  showPointAdjustModal.value = true;
}

function printMemberCard(buyer?: Buyer) {
  if (buyer) {
    activeCardPreviewBuyer.value = buyer;
  }
  showPrintCardModal.value = true;
}

// Keyboard Navigation (↑, ↓)
function handleKeyDown(e: KeyboardEvent) {
  if (filteredMembers.value.length === 0) return;
  const currentIndex = filteredMembers.value.findIndex(b => b.id === activeCardPreviewBuyer.value.id);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIdx = Math.min(currentIndex + 1, filteredMembers.value.length - 1);
    activeCardPreviewBuyer.value = filteredMembers.value[nextIdx];
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prevIdx = Math.max(currentIndex - 1, 0);
    activeCardPreviewBuyer.value = filteredMembers.value[prevIdx];
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- 1. Top Ribbon: Filter Kategori & Tier -->
    <div class="relative flex items-center bg-[#f6f5f2] border-b border-gray-200 px-3 py-1.5 select-none shrink-0 gap-1.5 overflow-x-auto no-scrollbar">
      <span class="text-gray-500 font-bold text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
        <CreditCard :size="13" class="text-amber-600" />
        <span>Filter Member:</span>
      </span>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="selectedTierFilter === 'ALL' ? 'bg-amber-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="selectedTierFilter = 'ALL'"
      >
        <span>Semua Member</span>
        <span class="text-[10px] px-1 rounded-full" :class="selectedTierFilter === 'ALL' ? 'bg-amber-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ buyerStore.memberBuyers.length }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="selectedTierFilter === 'REGULAR' ? 'bg-slate-700 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="selectedTierFilter = 'REGULAR'"
      >
        <span>Regular</span>
        <span class="text-[10px] px-1 rounded-full" :class="selectedTierFilter === 'REGULAR' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600'">
          {{ regularCount }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="selectedTierFilter === 'SILVER' ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="selectedTierFilter = 'SILVER'"
      >
        <span>Silver</span>
        <span class="text-[10px] px-1 rounded-full" :class="selectedTierFilter === 'SILVER' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ silverCount }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="selectedTierFilter === 'GOLD' ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="selectedTierFilter = 'GOLD'"
      >
        <span>Gold</span>
        <span class="text-[10px] px-1 rounded-full" :class="selectedTierFilter === 'GOLD' ? 'bg-amber-600 text-slate-950' : 'bg-gray-100 text-gray-600'">
          {{ goldCount }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="selectedTierFilter === 'PLATINUM' ? 'bg-purple-700 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="selectedTierFilter = 'PLATINUM'"
      >
        <span>Platinum</span>
        <span class="text-[10px] px-1 rounded-full" :class="selectedTierFilter === 'PLATINUM' ? 'bg-purple-800 text-white' : 'bg-gray-100 text-gray-600'">
          {{ platinumCount }}
        </span>
      </button>

      <div class="h-4 w-px bg-gray-300 mx-1 shrink-0"></div>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="selectedTierFilter === 'UNREGISTERED' ? 'bg-rose-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="selectedTierFilter = 'UNREGISTERED'"
      >
        <span>Belum Punya Member</span>
        <span class="text-[10px] px-1 rounded-full" :class="selectedTierFilter === 'UNREGISTERED' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-700 font-bold border border-rose-200'">
          {{ nonMemberCount }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="selectedTierFilter === 'B2B' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="selectedTierFilter = 'B2B'"
      >
        <Building :size="11" />
        <span>Langganan Grosir</span>
        <span class="text-[10px] px-1 rounded-full" :class="selectedTierFilter === 'B2B' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ b2bCount }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="selectedTierFilter === 'B2C' ? 'bg-teal-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="selectedTierFilter = 'B2C'"
      >
        <UserCheck :size="11" />
        <span>Pelanggan Eceran</span>
        <span class="text-[10px] px-1 rounded-full" :class="selectedTierFilter === 'B2C' ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ b2cCount }}
        </span>
      </button>

      <!-- Sisi Kanan: Search, Cetak & Tombol Daftarkan Member -->
      <div class="flex items-center gap-2 ml-auto shrink-0">
        <span v-if="props.searchQuery" class="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          Cari: "{{ props.searchQuery }}"
        </span>

        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded font-semibold text-xs cursor-pointer shadow-2xs transition-colors shrink-0"
          title="Cetak Kartu Member Pelanggan Terpilih"
          @click="printMemberCard()"
        >
          <Printer :size="13" class="text-gray-600" />
          <span>Cetak</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold text-xs cursor-pointer shadow-2xs transition-colors shrink-0 active:scale-95"
          @click="openRegisterModal()"
        >
          <UserPlus :size="14" />
          <span>Member</span>
        </button>
      </div>
    </div>

    <!-- 2. Reusable MetricStatsStrip (DRY) -->
    <MetricStatsStrip :items="metricStats" />

    <!-- 3. Main Workspace: Split Layar (Kiri: Tabel Member, Kanan: Drawer Kartu & Aturan Poin) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sisi Kiri: Tabel Data Pelanggan & Member Edge-to-Edge -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <div
          class="flex-1 outline-none"
          :class="showDetailDrawer ? 'overflow-auto' : 'overflow-y-auto overflow-x-hidden'"
          tabindex="0"
          @keydown="handleKeyDown"
        >
          <!-- Empty State -->
          <div
            v-if="filteredMembers.length === 0"
            class="h-64 flex flex-col items-center justify-center text-gray-400 gap-2 select-none"
          >
            <CreditCard :size="48" class="text-gray-300" />
            <p class="font-medium">Tidak ada data pelanggan yang cocok dengan kriteria pencarian.</p>
            <button
              type="button"
              class="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold cursor-pointer border border-gray-300 transition-colors"
              @click="selectedTierFilter = 'ALL'"
            >
              Reset Filter & Pencarian
            </button>
          </div>

          <!-- Tabel Data Member Rapi Sejajar Edge-to-Edge -->
          <table v-else class="w-full table-fixed text-xs text-left border-collapse" :class="showDetailDrawer ? 'min-w-[720px]' : ''">
            <thead class="bg-[#f0ede8] border-b border-gray-200 text-gray-600 font-semibold sticky top-0 z-10 shadow-2xs">
              <tr class="h-9">
                <th class="px-2.5 h-9 align-middle w-36">NO. KARTU MEMBER</th>
                <th class="px-2.5 h-9 align-middle">NAMA PELANGGAN</th>
                <th class="px-2.5 h-9 align-middle w-32">TIPE & KONTAK</th>
                <th class="px-2.5 h-9 align-middle w-24 text-center">TINGKATAN</th>
                <th class="px-2.5 h-9 align-middle w-28 text-right">POIN BELANJA</th>
                <th class="px-2.5 h-9 align-middle w-28 text-right">TOTAL BELANJA</th>
                <th class="px-2.5 h-9 align-middle w-28 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="b in filteredMembers"
                :key="b.id"
                class="border-b border-gray-100 hover:bg-amber-50/50 cursor-pointer transition-colors select-none"
                :class="activeCardPreviewBuyer.id === b.id ? 'bg-[#fef9ee] font-semibold ring-1 ring-inset ring-amber-400 z-10' : ''"
                @click="selectForPreview(b)"
              >
                <!-- Nomor Kartu Member -->
                <td class="p-2.5 font-mono truncate" :title="b.memberCardNo || 'Belum Ada Kartu'">
                  <div v-if="b.memberCardNo" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300 truncate">
                    <CreditCard :size="12" class="text-amber-600 shrink-0" />
                    <span class="font-bold truncate">{{ b.memberCardNo }}</span>
                  </div>
                  <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-semibold">
                    Belum Ada Kartu
                  </span>
                </td>

                <!-- Nama Pelanggan -->
                <td class="p-2.5 truncate" :title="b.name + (b.address ? ' - ' + b.address : '')">
                  <span class="font-bold text-gray-900 block leading-tight truncate">{{ b.name }}</span>
                  <span v-if="b.address" class="text-[10px] text-gray-400 block truncate font-normal mt-0.5">
                    {{ b.address }}
                  </span>
                </td>

                <!-- Tipe & Kontak -->
                <td class="p-2.5 truncate" :title="b.phone">
                  <span class="font-mono text-[11px] text-gray-700 block font-semibold truncate">{{ b.phone || '-' }}</span>
                  <span class="text-[10px] text-gray-500 block truncate">{{ b.customerType === 'B2B' ? 'Grosir (B2B)' : 'Eceran (B2C)' }}</span>
                </td>

                <!-- Tier Badge -->
                <td class="p-2.5 text-center truncate">
                  <span
                    v-if="b.memberCardNo"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10px] border shadow-2xs"
                    :class="{
                      'bg-slate-100 text-slate-700 border-slate-300': b.tier === 'REGULAR',
                      'bg-blue-50 text-blue-800 border-blue-300': b.tier === 'SILVER',
                      'bg-amber-100 text-amber-900 border-amber-300': b.tier === 'GOLD',
                      'bg-purple-100 text-purple-900 border-purple-300': b.tier === 'PLATINUM'
                    }"
                  >
                    <span>⭐ {{ b.tier || 'REGULAR' }}</span>
                  </span>
                  <span v-else class="text-gray-400 text-[10px] italic">
                    Non-Member
                  </span>
                </td>

                <!-- Poin Loyalitas -->
                <td class="p-2.5 text-right font-mono truncate">
                  <template v-if="b.memberCardNo">
                    <span class="font-black text-amber-700 text-xs block truncate">
                      {{ (b.points || 0).toLocaleString('id-ID') }} Pts
                    </span>
                    <span class="text-[10px] text-gray-400 block truncate">
                      = Rp {{ formatRupiah((b.points || 0) * buyerStore.loyaltySettings.pointValueInRupiah) }}
                    </span>
                  </template>
                  <span v-else class="text-gray-400 text-[10px]">-</span>
                </td>

                <!-- Akumulasi Belanja -->
                <td class="p-2.5 text-right font-mono font-bold text-gray-800 truncate">
                  Rp {{ formatRupiah(b.totalSpend || 0) }}
                </td>

                <!-- Aksi -->
                <td class="p-2.5 text-center" @click.stop>
                  <div v-if="b.memberCardNo" class="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      class="px-2 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-semibold text-[10.5px] cursor-pointer flex items-center gap-1 shadow-2xs transition-colors"
                      title="Sesuaikan Poin Member (+/-)"
                      @click="openPointAdjustModal(b)"
                    >
                      <Coins :size="11" />
                      <span>Atur Poin</span>
                    </button>

                    <button
                      type="button"
                      class="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                      title="Cetak Kartu Member"
                      @click="printMemberCard(b)"
                    >
                      <Printer :size="13" />
                    </button>
                  </div>

                  <div v-else class="flex items-center justify-center">
                    <button
                      type="button"
                      class="px-2.5 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] cursor-pointer flex items-center gap-1 shadow-2xs transition-transform active:scale-95"
                      @click="openRegisterModal(b.id)"
                    >
                      <UserPlus :size="11" />
                      <span>Member</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sisi Kanan: Panel Drawer Kartu Member & Aturan Poin -->
      <MemberDetailDrawer
        :is-open="showDetailDrawer"
        :buyer="activeCardPreviewBuyer"
        @close="showDetailDrawer = false"
        @adjust-points="openPointAdjustModal"
        @print-card="printMemberCard"
      />
    </div>

    <!-- Modals -->
    <MemberPointAdjustModal
      :is-open="showPointAdjustModal"
      :buyer="buyerForPointAdjust"
      @close="showPointAdjustModal = false"
    />

    <MemberRegisterModal
      :is-open="showRegisterMemberModal"
      :initial-buyer-id="registerInitialBuyerId"
      @close="showRegisterMemberModal = false"
      @registered="onMemberRegistered"
    />

    <MemberPrintModal
      :is-open="showPrintCardModal"
      :buyer="activeCardPreviewBuyer"
      @close="showPrintCardModal = false"
    />
  </div>
</template>

<style>
@media print {
  body * {
    visibility: hidden;
  }
  #print-member-card-area,
  #print-member-card-area * {
    visibility: visible;
  }
  #print-member-card-area {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 20px;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    display: flex !important;
    flex-direction: row !important;
    justify-content: center !important;
    gap: 30px !important;
  }
}
</style>
