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
  Sparkles,
  Edit2,
  Phone,
  ArrowUp,
  ArrowDown,
  Plus,
  SlidersHorizontal,
  RotateCcw,
  X
} from 'lucide-vue-next';

import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import AppTableContainer from '../common/AppTableContainer.vue';
import AppFilterDrawer from '../common/AppFilterDrawer.vue';
import MemberPointAdjustModal from './member/MemberPointAdjustModal.vue';
import MemberPrintModal from './member/MemberPrintModal.vue';
import MemberDetailDrawer from './member/MemberDetailDrawer.vue';

type MemberSortField = 'memberCardNo' | 'name' | 'address' | 'customerType' | 'phone' | 'tier' | 'points' | 'totalSpend';
type SortDirection = 'asc' | 'desc';

const sortField = ref<MemberSortField>('name');
const sortDirection = ref<SortDirection>('asc');

function toggleSort(field: MemberSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = ['points', 'totalSpend'].includes(field) ? 'desc' : 'asc';
  }
}

const tierOrder: Record<string, number> = {
  'REGULAR': 1,
  'SILVER': 2,
  'GOLD': 3,
  'PLATINUM': 4
};

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const buyerStore = useBuyerStore();

// Marketplace Filter Drawer States
const showFilterDrawer = ref(false);

type MemberTierFilter = 'ALL' | 'REGULAR' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'UNREGISTERED' | 'EVERYONE';
type MemberMarketFilter = 'ALL' | 'B2B' | 'B2C';

const memberTierFilter = ref<MemberTierFilter>('ALL');
const memberMarketFilter = ref<MemberMarketFilter>('ALL');

const activeFiltersCount = computed(() => {
  let count = 0;
  if (memberTierFilter.value !== 'ALL') count++;
  if (memberMarketFilter.value !== 'ALL') count++;
  return count;
});

function resetAllFilters() {
  memberTierFilter.value = 'ALL';
  memberMarketFilter.value = 'ALL';
}

// Drawer State
const showDetailDrawer = computed({
  get: () => buyerStore.showMemberDrawer,
  set: (val: boolean) => { buyerStore.showMemberDrawer = val; }
});
const drawerInitialTab = ref<'CARD' | 'EDIT' | 'REGISTER' | 'RULES'>('CARD');
const registerInitialBuyerId = ref<string | undefined>(undefined);

// Modals State
const showPrintCardModal = ref(false);
const activeCardPreviewBuyer = ref<Buyer>(buyerStore.buyers[0] || {
  id: 'preview',
  name: 'Budi Santoso',
  memberCardNo: 'SIRKA-8899',
  tier: 'GOLD',
  points: 250,
  totalSpend: 6500000,
  memberSince: '2026-01-01'
});

const showPointAdjustModal = ref(false);
const buyerForPointAdjust = ref<Buyer | null>(null);

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

function openRegisterDrawer(buyerId?: string) {
  // BUG FIX: `registerInitialBuyerId` tidak pernah di-reset -> tab "Baru"
  // selalu auto-memilih buyer terakhir yang dipilih, berisiko salah-target
  // kartu member.
  registerInitialBuyerId.value = buyerId ?? '';
  drawerInitialTab.value = 'REGISTER';
  showDetailDrawer.value = true;
}

function onMemberRegistered(buyer: Buyer) {
  activeCardPreviewBuyer.value = buyer;
  drawerInitialTab.value = 'CARD';
}

const filteredMembers = computed(() => {
  return buyerStore.buyers.filter(b => {
    const isMbr = Boolean(b.memberCardNo);
    const q = props.searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      b.name.toLowerCase().includes(q) ||
      (b.memberCardNo && b.memberCardNo.toLowerCase().includes(q)) ||
      (b.phone && b.phone.includes(q));

    if (!matchesSearch) return false;

    // 1. Tier / Status Kartu Member
    if (memberTierFilter.value === 'UNREGISTERED') {
      if (isMbr) return false;
    } else if (memberTierFilter.value === 'EVERYONE') {
      // Tampilkan seluruh pelanggan tanpa syarat kartu member
    } else if (memberTierFilter.value === 'ALL') {
      // Default: Hanya member yang sudah memiliki kartu
      if (!isMbr) return false;
    } else {
      // Tier spesifik (REGULAR, SILVER, GOLD, PLATINUM)
      if (!isMbr || b.tier !== memberTierFilter.value) return false;
    }

    // 2. Segmentasi Pasar
    if (memberMarketFilter.value === 'B2B' && b.customerType !== 'B2B') return false;
    if (memberMarketFilter.value === 'B2C' && b.customerType !== 'B2C') return false;

    return true;
  });
});

const sortedMembers = computed(() => {
  const list = [...filteredMembers.value];
  const field = sortField.value;
  const dir = sortDirection.value === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    switch (field) {
      case 'memberCardNo':
        return dir * (a.memberCardNo || '').localeCompare(b.memberCardNo || '');
      case 'name':
        return dir * (a.name || '').localeCompare(b.name || '');
      case 'address':
        return dir * (a.address || '').localeCompare(b.address || '');
      case 'customerType':
        return dir * (a.customerType || '').localeCompare(b.customerType || '');
      case 'phone':
        return dir * (a.phone || '').localeCompare(b.phone || '');
      case 'tier': {
        const orderA = tierOrder[a.tier || ''] || 0;
        const orderB = tierOrder[b.tier || ''] || 0;
        return dir * (orderA - orderB);
      }
      case 'points':
        return dir * ((a.points || 0) - (b.points || 0));
      case 'totalSpend':
        return dir * ((a.totalSpend || 0) - (b.totalSpend || 0));
      default:
        return 0;
    }
  });

  return list;
});

// Auto-select first member in preview
watch(
  sortedMembers,
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
  drawerInitialTab.value = 'CARD';
  showDetailDrawer.value = true;
}

function openEditMemberDrawer(buyer: Buyer) {
  activeCardPreviewBuyer.value = buyer;
  drawerInitialTab.value = 'EDIT';
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
  if (sortedMembers.value.length === 0) return;
  const currentIndex = sortedMembers.value.findIndex(b => b.id === activeCardPreviewBuyer.value.id);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIdx = Math.min(currentIndex + 1, sortedMembers.value.length - 1);
    activeCardPreviewBuyer.value = sortedMembers.value[nextIdx];
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prevIdx = Math.max(currentIndex - 1, 0);
    activeCardPreviewBuyer.value = sortedMembers.value[prevIdx];
  }
}

function openRegisterMemberDrawer() {
  drawerInitialTab.value = 'REGISTER';
  showDetailDrawer.value = true;
}

function openRulesDrawer() {
  drawerInitialTab.value = 'RULES';
  showDetailDrawer.value = true;
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Main Workspace: Split Layar (Kiri: Tabel Member & Ribbon, Kanan: Drawer Kartu & Aturan Poin) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sisi Kiri: Ribbon + MetricStatsStrip + Tabel Data Pelanggan & Member Edge-to-Edge -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- 1. Mobile-First Top Header & Filter Controls -->
        <div class="bg-[#f6f5f2] border-b border-gray-200 p-2.5 flex flex-col gap-2 shrink-0 select-none shadow-2xs">
          <!-- Top Row: Title, Member Count & Primary Action Buttons -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <CreditCard :size="16" />
              </div>
              <div class="min-w-0 flex flex-col">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-xs text-gray-900 truncate">Member Loyalty & Poin</span>
                  <span class="text-[10px] px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold font-mono">
                    {{ registeredMembersCount }} Member
                  </span>
                </div>
                <span class="text-[10px] text-gray-500">Tier loyalitas, poin belanja & cetak kartu</span>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              <!-- Tombol Aturan Poin -->
              <button
                type="button"
                @click="openRulesDrawer"
                class="h-8 px-2.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 active:scale-95 text-gray-700 font-bold text-xs flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                title="Atur rasio poin belanja & diskon tier"
              >
                <Sparkles :size="13" class="text-amber-500" />
                <span class="hidden xs:inline">Aturan Poin</span>
              </button>
            </div>
          </div>

          <!-- Bottom Row: Marketplace-Style Filter Drawer Trigger & Quick Filter Pills -->
          <div v-horizontal-scroll class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <!-- Marketplace Filter Drawer Trigger Button -->
            <button
              type="button"
              @click="showFilterDrawer = true"
              class="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 shadow-xs whitespace-nowrap active:scale-95"
              :class="activeFiltersCount > 0
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-amber-500/20 font-bold'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'"
            >
              <SlidersHorizontal :size="13" />
              <span>Filter</span>
              <span
                v-if="activeFiltersCount > 0"
                class="px-1.5 py-0.2 rounded-full bg-slate-950 text-white font-mono text-[10px] font-bold"
              >
                {{ activeFiltersCount }}
              </span>
            </button>

            <!-- Reset Button jika ada filter aktif -->
            <button
              v-if="activeFiltersCount > 0"
              type="button"
              class="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors shrink-0 whitespace-nowrap"
              title="Hapus semua filter"
              @click="resetAllFilters"
            >
              <RotateCcw :size="11" />
              <span>Reset</span>
            </button>

            <div class="h-4 w-px bg-gray-300 shrink-0"></div>

            <!-- Quick Filter Pill: Semua Member -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="memberTierFilter === 'ALL' && memberMarketFilter === 'ALL'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="resetAllFilters"
            >
              <span>Semua Member</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="memberTierFilter === 'ALL' && memberMarketFilter === 'ALL' ? 'bg-amber-700 text-white' : 'bg-gray-200 text-gray-700'">
                {{ buyerStore.memberBuyers.length }}
              </span>
            </button>

            <!-- Quick Filter Pill: Regular -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="memberTierFilter === 'REGULAR'
                ? 'bg-slate-700 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="memberTierFilter = memberTierFilter === 'REGULAR' ? 'ALL' : 'REGULAR'"
            >
              <span>Regular</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="memberTierFilter === 'REGULAR' ? 'bg-slate-800 text-white' : 'bg-gray-200 text-gray-700'">
                {{ regularCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Silver -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="memberTierFilter === 'SILVER'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="memberTierFilter = memberTierFilter === 'SILVER' ? 'ALL' : 'SILVER'"
            >
              <span>Silver</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="memberTierFilter === 'SILVER' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'">
                {{ silverCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Gold -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="memberTierFilter === 'GOLD'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="memberTierFilter = memberTierFilter === 'GOLD' ? 'ALL' : 'GOLD'"
            >
              <span>Gold</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="memberTierFilter === 'GOLD' ? 'bg-amber-600 text-slate-950' : 'bg-amber-50 text-amber-900 border border-amber-200'">
                {{ goldCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Platinum -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="memberTierFilter === 'PLATINUM'
                ? 'bg-purple-700 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="memberTierFilter = memberTierFilter === 'PLATINUM' ? 'ALL' : 'PLATINUM'"
            >
              <span>Platinum</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="memberTierFilter === 'PLATINUM' ? 'bg-purple-800 text-white' : 'bg-purple-50 text-purple-700 border border-purple-200'">
                {{ platinumCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Belum Punya Member -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="memberTierFilter === 'UNREGISTERED'
                ? 'bg-rose-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="memberTierFilter = memberTierFilter === 'UNREGISTERED' ? 'ALL' : 'UNREGISTERED'"
            >
              <span>Belum Member</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="memberTierFilter === 'UNREGISTERED' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200'">
                {{ nonMemberCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Grosir B2B -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="memberMarketFilter === 'B2B'
                ? 'bg-indigo-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="memberMarketFilter = memberMarketFilter === 'B2B' ? 'ALL' : 'B2B'"
            >
              <Building :size="11" />
              <span>Grosir</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="memberMarketFilter === 'B2B' ? 'bg-indigo-700 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'">
                {{ b2bCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Eceran B2C -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="memberMarketFilter === 'B2C'
                ? 'bg-teal-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="memberMarketFilter = memberMarketFilter === 'B2C' ? 'ALL' : 'B2C'"
            >
              <UserCheck :size="11" />
              <span>Eceran</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="memberMarketFilter === 'B2C' ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-700 border border-teal-200'">
                {{ b2cCount }}
              </span>
            </button>

            <div class="h-4 w-px bg-gray-300 shrink-0"></div>

            <!-- Tombol Aturan Poin -->
            <button
              type="button"
              @click="openRulesDrawer"
              class="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border cursor-pointer transition-colors shrink-0 bg-white hover:bg-amber-50 text-amber-800 border-amber-300 shadow-2xs whitespace-nowrap"
              title="Atur rasio poin belanja & diskon tier"
            >
              <Sparkles :size="12" class="text-amber-500" />
              <span>Aturan Poin</span>
            </button>

            <!-- Indikator Query Pencarian -->
            <span v-if="props.searchQuery" class="text-[10.5px] text-gray-600 bg-gray-200/80 px-2 py-0.5 rounded-md font-medium shrink-0 whitespace-nowrap ml-auto">
              Cari: "<strong class="text-gray-900">{{ props.searchQuery }}</strong>"
            </span>
          </div>
        </div>

    <!-- Reusable MetricStatsStrip (DRY) di sisi kiri -->
    <MetricStatsStrip :items="metricStats" />

        <AppTableContainer
          :is-empty="filteredMembers.length === 0"
          :empty-icon="CreditCard"
          empty-title="Tidak ada data pelanggan yang cocok"
          empty-description="Coba ubah tier filter atau periksa kata kunci pencarian Anda."
          tabindex="0"
          @keydown="handleKeyDown"
        >
          <template #empty-action>
            <button
              type="button"
              class="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold cursor-pointer border border-gray-300 transition-colors"
              @click="resetAllFilters"
            >
              Reset Filter & Pencarian
            </button>
          </template>

          <!-- Tabel Data Member Rapi Sejajar Edge-to-Edge -->
          <table class="table-explorer whitespace-nowrap min-w-[900px]">
            <thead>
              <tr>
                <th
                  class="is-sortable w-32 whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'memberCardNo' }"
                  title="Klik untuk mengurutkan no. kartu member"
                  @click="toggleSort('memberCardNo')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>NO. KARTU MEMBER</span>
                    <ArrowUp v-if="sortField === 'memberCardNo' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'memberCardNo' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable min-w-[160px] whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'name' }"
                  title="Klik untuk mengurutkan nama pelanggan"
                  @click="toggleSort('name')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>NAMA PELANGGAN</span>
                    <ArrowUp v-if="sortField === 'name' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'name' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable min-w-[150px] whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'address' }"
                  title="Klik untuk mengurutkan alamat"
                  @click="toggleSort('address')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>ALAMAT</span>
                    <ArrowUp v-if="sortField === 'address' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'address' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-24 text-center whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'customerType' }"
                  title="Klik untuk mengurutkan tipe"
                  @click="toggleSort('customerType')"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <span>TIPE</span>
                    <ArrowUp v-if="sortField === 'customerType' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'customerType' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-32 whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'phone' }"
                  title="Klik untuk mengurutkan no. telepon"
                  @click="toggleSort('phone')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>NO. TELEPON</span>
                    <ArrowUp v-if="sortField === 'phone' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'phone' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-24 text-center whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'tier' }"
                  title="Klik untuk mengurutkan tingkatan"
                  @click="toggleSort('tier')"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <span>TINGKATAN</span>
                    <ArrowUp v-if="sortField === 'tier' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'tier' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-28 text-right whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'points' }"
                  title="Klik untuk mengurutkan poin belanja"
                  @click="toggleSort('points')"
                >
                  <div class="flex items-center justify-end gap-1.5">
                    <span>POIN BELANJA</span>
                    <ArrowUp v-if="sortField === 'points' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'points' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-28 text-right whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'totalSpend' }"
                  title="Klik untuk mengurutkan total belanja"
                  @click="toggleSort('totalSpend')"
                >
                  <div class="flex items-center justify-end gap-1.5">
                    <span>TOTAL BELANJA</span>
                    <ArrowUp v-if="sortField === 'totalSpend' && sortDirection === 'asc'" :size="12" class="text-amber-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'totalSpend' && sortDirection === 'desc'" :size="12" class="text-amber-600 shrink-0" />
                  </div>
                </th>
                <th class="th-action-sticky w-28 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="b in sortedMembers"
                :key="b.id"
                class="hover:bg-amber-50/50 cursor-pointer transition-colors select-none whitespace-nowrap"
                :class="activeCardPreviewBuyer.id === b.id ? 'bg-[#fef9ee] font-semibold ring-1 ring-inset ring-amber-400' : ''"
                title="Klik untuk lihat kartu member, klik ganda untuk edit data"
                @click="selectForPreview(b)"
                @dblclick="openEditMemberDrawer(b)"
              >
                <!-- Nomor Kartu Member -->
                <td class="font-mono truncate whitespace-nowrap" :title="b.memberCardNo || 'Belum Ada Kartu'">
                  <div v-if="b.memberCardNo" class="inline-flex items-center gap-1.5 text-slate-800 text-xs truncate">
                    <CreditCard :size="12" class="text-amber-600 shrink-0" />
                    <span class="font-bold truncate">{{ b.memberCardNo }}</span>
                  </div>
                  <span v-else class="text-gray-400 text-[11px]">-</span>
                </td>

                <!-- Nama Pelanggan -->
                <td class="truncate whitespace-nowrap" :title="b.name">
                  <span class="font-bold text-gray-900 block truncate text-xs">{{ b.name }}</span>
                </td>

                <!-- Alamat -->
                <td class="truncate whitespace-nowrap" :title="b.address || '-'">
                  <span class="text-[11px] text-gray-500 block truncate">{{ b.address || '-' }}</span>
                </td>

                <!-- Tipe Pasar (Grosir / Eceran) -->
                <td class="text-center truncate whitespace-nowrap">
                  <span
                    class="text-[10px] font-bold"
                    :class="b.customerType === 'B2B' ? 'text-indigo-600' : 'text-teal-600'"
                  >
                    {{ b.customerType === 'B2B' ? 'Grosir (B2B)' : 'Eceran (B2C)' }}
                  </span>
                </td>

                <!-- Kontak / No. Telepon -->
                <td class="truncate whitespace-nowrap font-mono" :title="b.phone || '-'">
                  <div v-if="b.phone" class="flex items-center gap-1 text-[11px] text-gray-700 font-semibold truncate">
                    <Phone :size="11" class="text-emerald-600 shrink-0" />
                    <span>{{ b.phone }}</span>
                  </div>
                  <span v-else class="text-gray-400 text-[11px]">-</span>
                </td>

                <!-- Tier Badge -->
                <td class="text-center truncate whitespace-nowrap">
                  <span
                    v-if="b.memberCardNo"
                    class="inline-flex items-center gap-1 font-bold text-[10px] leading-tight"
                    :class="{
                      'text-slate-600': b.tier === 'REGULAR',
                      'text-blue-600': b.tier === 'SILVER',
                      'text-amber-700 font-extrabold': b.tier === 'GOLD',
                      'text-purple-700 font-extrabold': b.tier === 'PLATINUM'
                    }"
                  >
                    <span>⭐ {{ b.tier || 'REGULAR' }}</span>
                  </span>
                  <span v-else class="text-gray-400 text-[10px]">-</span>
                </td>

                <!-- Poin Loyalitas -->
                <td class="text-right font-mono truncate whitespace-nowrap" :title="`Setara Rp ${formatRupiah((b.points || 0) * buyerStore.loyaltySettings.pointValueInRupiah)}`">
                  <div v-if="b.memberCardNo" class="inline-flex items-baseline justify-end gap-1.5 whitespace-nowrap">
                    <span class="font-bold text-amber-700 text-xs">
                      {{ (b.points || 0).toLocaleString('id-ID') }} Pts
                    </span>
                    <span class="text-[10px] text-gray-400 font-sans">
                      (Rp {{ formatRupiah((b.points || 0) * buyerStore.loyaltySettings.pointValueInRupiah) }})
                    </span>
                  </div>
                  <span v-else class="text-gray-400 text-[10px]">-</span>
                </td>

                <!-- Akumulasi Belanja -->
                <td class="text-right font-mono font-bold text-gray-800 truncate whitespace-nowrap text-xs">
                  Rp {{ formatRupiah(b.totalSpend || 0) }}
                </td>

                <!-- Aksi -->
                <td class="td-action-sticky text-center" @click.stop>
                  <div v-if="b.memberCardNo" class="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      class="p-1 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                      title="Edit Data Member (Klik Ganda Baris)"
                      @click="openEditMemberDrawer(b)"
                    >
                      <Edit2 :size="11" />
                    </button>

                    <button
                      type="button"
                      class="px-1.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-semibold text-[10px] cursor-pointer flex items-center gap-0.5 transition-colors"
                      title="Sesuaikan Poin Member (+/-)"
                      @click="openPointAdjustModal(b)"
                    >
                      <Coins :size="10" />
                      <span>Poin</span>
                    </button>

                    <button
                      type="button"
                      class="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded cursor-pointer transition-colors"
                      title="Cetak Kartu Member"
                      @click="printMemberCard(b)"
                    >
                      <Printer :size="11" />
                    </button>
                  </div>

                  <div v-else class="flex items-center justify-center">
                    <button
                      type="button"
                      class="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[10px] cursor-pointer flex items-center gap-1 shadow-2xs transition-transform active:scale-95"
                      @click="openRegisterDrawer(b.id)"
                    >
                      <UserPlus :size="10" />
                      <span>Member</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </AppTableContainer>

        <!-- Marketplace-Style Filter Drawer Component -->
        <AppFilterDrawer
          :is-open="showFilterDrawer"
          title="Filter Member & Pelanggan"
          subtitle="Saring data berdasarkan tier loyalitas, status kepemilikan kartu, dan segmen pasar"
          :active-filters-count="activeFiltersCount"
          :result-count="filteredMembers.length"
          result-label="Pelanggan"
          apply-button-color="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-bold"
          @close="showFilterDrawer = false"
          @reset="resetAllFilters"
          @apply="showFilterDrawer = false"
        >
          <!-- Seksi 1: Tier Loyalitas & Status Kartu -->
          <div class="space-y-2">
            <label class="font-bold text-gray-800 text-xs block">Tier Loyalitas & Status Kartu Member</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="memberTierFilter === 'ALL'
                  ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="memberTierFilter = 'ALL'"
              >
                <span>Semua Member ({{ buyerStore.memberBuyers.length }})</span>
                <span class="w-2 h-2 rounded-full" :class="memberTierFilter === 'ALL' ? 'bg-amber-500' : 'bg-transparent'"></span>
              </button>

              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="memberTierFilter === 'REGULAR'
                  ? 'bg-slate-100 border-slate-700 text-slate-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="memberTierFilter = 'REGULAR'"
              >
                <span>Regular ({{ regularCount }})</span>
                <span class="w-2 h-2 rounded-full" :class="memberTierFilter === 'REGULAR' ? 'bg-slate-700' : 'bg-transparent'"></span>
              </button>

              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="memberTierFilter === 'SILVER'
                  ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="memberTierFilter = 'SILVER'"
              >
                <span>Silver ({{ silverCount }})</span>
                <span class="w-2 h-2 rounded-full" :class="memberTierFilter === 'SILVER' ? 'bg-blue-600' : 'bg-transparent'"></span>
              </button>

              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="memberTierFilter === 'GOLD'
                  ? 'bg-amber-100 border-amber-600 text-amber-950 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="memberTierFilter = 'GOLD'"
              >
                <span>Gold ({{ goldCount }})</span>
                <span class="w-2 h-2 rounded-full" :class="memberTierFilter === 'GOLD' ? 'bg-amber-600' : 'bg-transparent'"></span>
              </button>

              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="memberTierFilter === 'PLATINUM'
                  ? 'bg-purple-50 border-purple-600 text-purple-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="memberTierFilter = 'PLATINUM'"
              >
                <span>Platinum ({{ platinumCount }})</span>
                <span class="w-2 h-2 rounded-full" :class="memberTierFilter === 'PLATINUM' ? 'bg-purple-600' : 'bg-transparent'"></span>
              </button>

              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="memberTierFilter === 'UNREGISTERED'
                  ? 'bg-rose-50 border-rose-600 text-rose-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="memberTierFilter = 'UNREGISTERED'"
              >
                <span>Belum Berkartu ({{ nonMemberCount }})</span>
                <span class="w-2 h-2 rounded-full" :class="memberTierFilter === 'UNREGISTERED' ? 'bg-rose-600' : 'bg-transparent'"></span>
              </button>

              <button
                type="button"
                class="col-span-2 px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="memberTierFilter === 'EVERYONE'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="memberTierFilter = 'EVERYONE'"
              >
                <span>Semua Pelanggan (Member + Reguler) ({{ buyerStore.buyers.length }})</span>
                <span class="w-2 h-2 rounded-full" :class="memberTierFilter === 'EVERYONE' ? 'bg-emerald-600' : 'bg-transparent'"></span>
              </button>
            </div>
          </div>

          <!-- Seksi 2: Segmentasi Pasar -->
          <div class="pt-3 space-y-2">
            <label class="font-bold text-gray-800 text-xs block">Segmentasi Pasar Pelanggan</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-center cursor-pointer transition-all"
                :class="memberMarketFilter === 'ALL'
                  ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="memberMarketFilter = 'ALL'"
              >
                Semua Pasar
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-center cursor-pointer transition-all"
                :class="memberMarketFilter === 'B2B'
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="memberMarketFilter = 'B2B'"
              >
                Grosir B2B ({{ b2bCount }})
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-center cursor-pointer transition-all"
                :class="memberMarketFilter === 'B2C'
                  ? 'bg-teal-50 border-teal-600 text-teal-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="memberMarketFilter = 'B2C'"
              >
                Eceran B2C ({{ b2cCount }})
              </button>
            </div>
          </div>

          <!-- Seksi 3: Urutkan Data Pelanggan -->
          <div class="pt-3 space-y-2">
            <label class="font-bold text-gray-800 text-xs block">Urutkan Tampilan Data</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="sortField === 'name'
                  ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="sortField = 'name'; sortDirection = 'asc'"
              >
                <span>Nama Pelanggan (A - Z)</span>
                <span class="w-2 h-2 rounded-full" :class="sortField === 'name' ? 'bg-amber-500' : 'bg-transparent'"></span>
              </button>

              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="sortField === 'points'
                  ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="sortField = 'points'; sortDirection = 'desc'"
              >
                <span>Poin Terbanyak</span>
                <span class="w-2 h-2 rounded-full" :class="sortField === 'points' ? 'bg-amber-500' : 'bg-transparent'"></span>
              </button>

              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="sortField === 'totalSpend'
                  ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="sortField = 'totalSpend'; sortDirection = 'desc'"
              >
                <span>Belanja Terbanyak</span>
                <span class="w-2 h-2 rounded-full" :class="sortField === 'totalSpend' ? 'bg-amber-500' : 'bg-transparent'"></span>
              </button>

              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="sortField === 'tier'
                  ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="sortField = 'tier'; sortDirection = 'desc'"
              >
                <span>Tier Tertinggi</span>
                <span class="w-2 h-2 rounded-full" :class="sortField === 'tier' ? 'bg-amber-500' : 'bg-transparent'"></span>
              </button>
            </div>
          </div>
        </AppFilterDrawer>
      </div>

      <!-- Sisi Kanan: Panel Drawer Kartu Member & Form Pendaftaran Baru -->
      <MemberDetailDrawer
        :is-open="showDetailDrawer"
        :buyer="activeCardPreviewBuyer"
        :initial-tab="drawerInitialTab"
        :initial-register-buyer-id="registerInitialBuyerId"
        @close="showDetailDrawer = false"
        @adjust-points="openPointAdjustModal"
        @print-card="printMemberCard"
        @registered="onMemberRegistered"
      />
    </div>

    <!-- Modals -->
    <MemberPointAdjustModal
      :is-open="showPointAdjustModal"
      :buyer="buyerForPointAdjust"
      @close="showPointAdjustModal = false"
    />

    <MemberPrintModal
      :is-open="showPrintCardModal"
      :buyer="activeCardPreviewBuyer"
      @close="showPrintCardModal = false"
    />

    <!-- Floating Action Button: Daftarkan Member Baru -->
    <button
      type="button"
      @click="openRegisterMemberDrawer"
      class="fixed right-4 bottom-20 z-30 w-13 h-13 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 shadow-xl flex items-center justify-center transition cursor-pointer border-2 border-white/20"
      title="Daftarkan Member Baru"
    >
      <UserPlus :size="24" />
    </button>
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
