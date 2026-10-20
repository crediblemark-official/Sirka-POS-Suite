<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Discount } from '../../types';
import { useDiscountStore } from '../../stores/discountStore';
import { formatRupiah } from '../../utils/formatters';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import DiscountSimulator from './discount/DiscountSimulator.vue';
import DiscountFormDrawer from './discount/DiscountFormDrawer.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import {
  Tag,
  Pencil,
  Trash2,
  Percent,
  DollarSign,
  Copy,
  Users,
  Sparkles,
  Calculator,
  Building,
  UserCheck,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ChevronsDownUp
} from 'lucide-vue-next';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const emit = defineEmits<{
  (e: 'add-discount'): void;
  (e: 'edit-discount', discount: Discount): void;
}>();

const discountStore = useDiscountStore();

// Filter & Search states
type FilterCategory = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'PERCENT' | 'FIXED' | 'MEMBER' | 'B2B' | 'B2C';
const activeFilter = ref<FilterCategory>('ALL');

// Selection & Form Sidebar states
const selectedDiscountId = ref<string>('');

// Counts for ribbon & metric cards
const percentCount = computed(() => discountStore.discounts.filter(d => d.type === 'PERCENT').length);
const fixedCount = computed(() => discountStore.discounts.filter(d => d.type === 'FIXED').length);
const memberCount = computed(() => discountStore.discounts.filter(d => d.scope === 'MEMBER_ONLY').length);
const b2bCount = computed(() => discountStore.discounts.filter(d => d.targetCustomerType === 'B2B').length);
const b2cCount = computed(() => discountStore.discounts.filter(d => d.targetCustomerType === 'B2C').length);
const activeDiscountsCount = computed(() => discountStore.discounts.filter(d => d.isActive).length);
const totalUsageCount = computed(() => discountStore.discounts.reduce((acc, d) => acc + (d.usageCount || 0), 0));

const filteredDiscounts = computed(() => {
  return discountStore.discounts.filter(d => {
    // 1. Search Query
    const q = props.searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      d.code.toLowerCase().includes(q) ||
      d.name.toLowerCase().includes(q) ||
      (d.description && d.description.toLowerCase().includes(q));

    // 2. Category Filter
    let matchesCategory = true;
    switch (activeFilter.value) {
      case 'ACTIVE':
        matchesCategory = d.isActive;
        break;
      case 'INACTIVE':
        matchesCategory = !d.isActive;
        break;
      case 'PERCENT':
        matchesCategory = d.type === 'PERCENT';
        break;
      case 'FIXED':
        matchesCategory = d.type === 'FIXED';
        break;
      case 'MEMBER':
        matchesCategory = d.scope === 'MEMBER_ONLY';
        break;
      case 'B2B':
        matchesCategory = d.targetCustomerType === 'B2B';
        break;
      case 'B2C':
        matchesCategory = d.targetCustomerType === 'B2C';
        break;
      case 'ALL':
      default:
        matchesCategory = true;
    }

    return matchesSearch && matchesCategory;
  });
});

// Metric stats cards for MetricStatsStrip
const discountMetrics = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Kupon Promo',
    value: `${filteredDiscounts.value.length} Kupon`,
    sublabel: 'Voucher Terdaftar',
    icon: Tag,
    iconBoxClass: 'bg-rose-50 text-rose-600'
  },
  {
    label: 'Kupon Aktif Kasir',
    value: `${activeDiscountsCount.value} Aktif`,
    sublabel: 'Siap Pakai POS',
    icon: Sparkles,
    iconBoxClass: 'bg-emerald-50 text-emerald-600',
    valClass: 'text-emerald-700'
  },
  {
    label: 'Diskon Persen (%)',
    value: `${percentCount.value} Kupon`,
    sublabel: 'Potongan Persen',
    icon: Percent,
    iconBoxClass: 'bg-blue-50 text-blue-600',
    valClass: 'text-blue-700'
  },
  {
    label: 'Potongan Tetap (Rp)',
    value: `${fixedCount.value} Kupon`,
    sublabel: 'Nominal Langsung',
    icon: DollarSign,
    iconBoxClass: 'bg-amber-50 text-amber-600',
    valClass: 'text-amber-800'
  },
  {
    label: 'Khusus Member',
    value: `${memberCount.value} Kupon`,
    sublabel: 'Pelanggan Loyal',
    icon: Users,
    iconBoxClass: 'bg-purple-50 text-purple-600',
    valClass: 'text-purple-800'
  },
  {
    label: 'Total Dipakai Kasir',
    value: `${totalUsageCount.value} Transaksi`,
    sublabel: 'Pemakaian Struk',
    icon: Calculator,
    iconBoxClass: 'bg-teal-50 text-teal-600',
    valClass: 'text-teal-800'
  }
]);

// Auto-select first item if available
watch(
  filteredDiscounts,
  (list) => {
    if (list.length > 0) {
      if (!list.some(d => d.id === selectedDiscountId.value)) {
        selectedDiscountId.value = list[0].id;
      }
    } else {
      selectedDiscountId.value = '';
    }
  },
  { immediate: true }
);

const selectedDiscount = computed(() => {
  return discountStore.discounts.find(d => d.id === selectedDiscountId.value) || null;
});

// Expandable row states
const expandedDiscountIds = ref<Set<string>>(new Set());

function toggleDiscountExpand(id: string) {
  if (expandedDiscountIds.value.has(id)) {
    expandedDiscountIds.value.delete(id);
  } else {
    expandedDiscountIds.value.add(id);
  }
}

const isAllExpanded = computed(() => {
  return filteredDiscounts.value.length > 0 &&
    filteredDiscounts.value.every(d => expandedDiscountIds.value.has(d.id));
});

function toggleExpandAll() {
  if (isAllExpanded.value) {
    expandedDiscountIds.value.clear();
  } else {
    expandedDiscountIds.value = new Set(filteredDiscounts.value.map(d => d.id));
  }
}

// Copy code action
const copiedCode = ref<string | null>(null);
function copyCode(code: string) {
  navigator.clipboard.writeText(code);
  copiedCode.value = code;
  setTimeout(() => {
    copiedCode.value = null;
  }, 1500);
}

// Handlers
function handleSelectRow(d: Discount) {
  selectedDiscountId.value = d.id;
  discountStore.openEditDiscount(d);
}

function handleOpenAdd() {
  discountStore.openAddDiscount();
  emit('add-discount');
}

function handleOpenEdit(d: Discount) {
  selectedDiscountId.value = d.id;
  discountStore.openEditDiscount(d);
  emit('edit-discount', d);
}

const { confirm: showConfirm } = useConfirmDialog();

async function handleDelete(id: string, name: string) {
  const isConfirmed = await showConfirm({
    title: 'Hapus Kupon Promo',
    message: `Yakin ingin menghapus kupon promo "${name}"?`,
    details: 'Kupon promo yang dihapus tidak akan dapat digunakan lagi di transaksi kasir.',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger'
  });

  if (isConfirmed) {
    discountStore.deleteDiscount(id);
    discountStore.closeFormSidebar();
    if (selectedDiscountId.value === id) {
      selectedDiscountId.value = filteredDiscounts.value[0]?.id || '';
    }
  }
}

function handleSaved(saved: Discount) {
  selectedDiscountId.value = saved.id;
}

// Keyboard Navigation (↑, ↓, Enter)
function handleKeyDown(e: KeyboardEvent) {
  if (filteredDiscounts.value.length === 0) return;
  const currentIndex = filteredDiscounts.value.findIndex(d => d.id === selectedDiscountId.value);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    const nextIdx = Math.min(currentIndex + 1, filteredDiscounts.value.length - 1);
    const nextItem = filteredDiscounts.value[nextIdx];
    selectedDiscountId.value = nextItem.id;
    if (discountStore.showFormSidebar) {
      discountStore.openEditDiscount(nextItem);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    const prevIdx = Math.max(currentIndex - 1, 0);
    const prevItem = filteredDiscounts.value[prevIdx];
    selectedDiscountId.value = prevItem.id;
    if (discountStore.showFormSidebar) {
      discountStore.openEditDiscount(prevItem);
    }
  } else if (e.key === 'Enter') {
    if (selectedDiscount.value) {
      handleOpenEdit(selectedDiscount.value);
    }
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Main Workspace: Split Layar (Kiri: Tabel Data & Ribbon, Kanan: Drawer Form Input & Edit) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sisi Kiri: Ribbon + MetricStatsStrip + Tabel Data Promo Edge-to-Edge -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- 1. Top Category / Filter Ribbon -->
        <div
          v-horizontal-scroll
          class="h-10 relative flex items-center bg-[#f6f5f2] border-b border-gray-200 px-3 select-none shrink-0 gap-1.5 overflow-x-auto no-scrollbar"
        >
          <span class="text-gray-500 font-bold text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <Tag :size="13" class="text-rose-600" />
            <span>Kategori Diskon:</span>
          </span>

      <!-- Filter Buttons -->
      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="activeFilter === 'ALL' ? 'bg-rose-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="activeFilter = 'ALL'"
      >
        <span>Semua Diskon</span>
        <span class="text-[10px] px-1 rounded-full" :class="activeFilter === 'ALL' ? 'bg-rose-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ discountStore.discounts.length }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="activeFilter === 'ACTIVE' ? 'bg-emerald-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="activeFilter = 'ACTIVE'"
      >
        <span class="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
        <span>Aktif</span>
        <span class="text-[10px] px-1 rounded-full" :class="activeFilter === 'ACTIVE' ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ discountStore.activeDiscounts.length }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="activeFilter === 'INACTIVE' ? 'bg-gray-700 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="activeFilter = 'INACTIVE'"
      >
        <span class="w-2 h-2 rounded-full bg-gray-400 inline-block"></span>
        <span>Nonaktif</span>
      </button>

      <div class="h-4 w-px bg-gray-300 mx-1 shrink-0"></div>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="activeFilter === 'PERCENT' ? 'bg-blue-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="activeFilter = 'PERCENT'"
      >
        <Percent :size="11" />
        <span>Diskon Persen (%)</span>
        <span class="text-[10px] px-1 rounded-full" :class="activeFilter === 'PERCENT' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ percentCount }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="activeFilter === 'FIXED' ? 'bg-amber-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="activeFilter = 'FIXED'"
      >
        <DollarSign :size="11" />
        <span>Potongan Tetap (Rp)</span>
        <span class="text-[10px] px-1 rounded-full" :class="activeFilter === 'FIXED' ? 'bg-amber-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ fixedCount }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="activeFilter === 'MEMBER' ? 'bg-purple-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="activeFilter = 'MEMBER'"
      >
        <Users :size="11" />
        <span>Khusus Member</span>
        <span class="text-[10px] px-1 rounded-full" :class="activeFilter === 'MEMBER' ? 'bg-purple-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ memberCount }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="activeFilter === 'B2B' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="activeFilter = 'B2B'"
      >
        <Building :size="11" />
        <span>Langganan Grosir</span>
        <span class="text-[10px] px-1 rounded-full" :class="activeFilter === 'B2B' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ b2bCount }}
        </span>
      </button>

      <button
        type="button"
        class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
        :class="activeFilter === 'B2C' ? 'bg-teal-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
        @click="activeFilter = 'B2C'"
      >
        <UserCheck :size="11" />
        <span>Pelanggan Eceran</span>
        <span class="text-[10px] px-1 rounded-full" :class="activeFilter === 'B2C' ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600'">
          {{ b2cCount }}
        </span>
      </button>

      <div v-if="props.searchQuery" class="flex items-center gap-2 ml-auto shrink-0">
        <span class="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium">
          Cari: "<span class="font-bold text-gray-800">{{ props.searchQuery }}</span>"
        </span>
      </div>
    </div>

    <!-- Reusable MetricStatsStrip (DRY) di sisi kiri -->
    <MetricStatsStrip :items="discountMetrics" />

        <div
          class="flex-1 outline-none"
          :class="discountStore.showFormSidebar ? 'overflow-auto' : 'overflow-y-auto overflow-x-hidden'"
          tabindex="0"
          @keydown="handleKeyDown"
        >
          <!-- Empty State -->
          <AppEmptyState
            v-if="filteredDiscounts.length === 0"
            :icon="Tag"
            title="Tidak ada kupon promo yang cocok"
            description="Coba ubah kategori filter atau periksa kata kunci pencarian Anda."
          >
            <button
              type="button"
              class="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold cursor-pointer border border-gray-300 transition-colors"
              @click="activeFilter = 'ALL'"
            >
              Reset Filter & Pencarian
            </button>
          </AppEmptyState>

          <!-- Tabel Diskon Rapi Sejajar Edge-to-Edge -->
          <table v-else class="table-explorer" :class="discountStore.showFormSidebar ? 'min-w-[720px]' : ''">
            <thead>
              <tr>
                <th class="w-10 text-center">NO</th>
                <th class="w-32">KODE DISKON</th>
                <th>NAMA DISKON & KETERANGAN</th>
                <th class="w-36 text-center">BESAR POTONGAN</th>
                <th class="w-28 text-right">MIN. BELANJA</th>
                <th class="w-32 text-center">BERLAKU UNTUK</th>
                <th class="w-20 text-center">STATUS</th>
                <th class="th-action-sticky w-20 text-center">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-700 hover:text-rose-800 transition-colors cursor-pointer select-none"
                    @click="toggleExpandAll"
                    :title="isAllExpanded ? 'Tutup semua rincian' : 'Buka semua rincian'"
                  >
                    <ChevronsDownUp v-if="isAllExpanded" :size="11" />
                    <ChevronsUpDown v-else :size="11" />
                    <span>{{ isAllExpanded ? 'Tutup' : 'Expand' }}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(d, idx) in filteredDiscounts" :key="d.id">
                <tr
                  class="border-b border-gray-100 hover:bg-rose-50/40 cursor-pointer transition-colors select-none"
                  :class="expandedDiscountIds.has(d.id) ? 'bg-[#fff5f5]' : (selectedDiscountId === d.id ? 'bg-[#fff1f2]/60' : '')"
                  @click="handleSelectRow(d)"
                  @dblclick="handleOpenEdit(d)"
                >
                  <!-- Nomor Urut -->
                  <td class="text-center font-mono text-gray-400">{{ idx + 1 }}</td>

                  <!-- Kode Promo dengan Tombol Salin Cepat -->
                  <td class="font-mono truncate whitespace-nowrap" :title="d.code">
                    <div class="inline-flex items-center gap-1.5 text-rose-700 truncate">
                      <span class="font-bold tracking-wide truncate">{{ d.code }}</span>
                      <button
                        type="button"
                        class="text-rose-400 hover:text-rose-700 cursor-pointer p-0.5 rounded transition-colors shrink-0"
                        title="Salin Kode Kupon"
                        @click.stop="copyCode(d.code)"
                      >
                        <Copy :size="12" />
                      </button>
                      <span v-if="copiedCode === d.code" class="text-[9px] font-sans text-emerald-600 font-bold shrink-0">Disalin!</span>
                    </div>
                  </td>

                  <!-- Nama Promo & Keterangan -->
                  <td class="truncate" :title="d.name + (d.description ? ' - ' + d.description : '')">
                    <div class="flex items-center gap-1.5 truncate">
                      <Tag :size="13" class="text-rose-500 shrink-0" />
                      <span class="font-bold text-gray-900 truncate">{{ d.name }}</span>
                      <span v-if="d.description" class="text-[11px] text-gray-400 font-normal truncate">({{ d.description }})</span>
                    </div>
                  </td>

                  <!-- Nilai Diskon Badge -->
                  <td class="text-center truncate whitespace-nowrap">
                    <span
                      v-if="d.type === 'PERCENT'"
                      class="inline-flex items-center gap-1 font-bold font-mono text-xs text-amber-700"
                    >
                      <Percent :size="11" />
                      <span>{{ d.value }}% OFF</span>
                    </span>
                    <span
                      v-else
                      class="inline-flex items-center gap-1 font-bold font-mono text-xs text-emerald-700"
                    >
                      <span>-Rp {{ formatRupiah(d.value) }}</span>
                    </span>

                    <span v-if="d.maxDiscount" class="text-[10px] text-gray-400 font-mono ml-1.5 truncate">
                      (Maks Rp {{ formatRupiah(d.maxDiscount) }})
                    </span>
                  </td>

                  <!-- Minimal Belanja -->
                  <td class="text-right font-mono truncate whitespace-nowrap">
                    <span v-if="d.minPurchase > 0" class="text-gray-800 font-semibold text-xs">
                      Rp {{ formatRupiah(d.minPurchase) }}
                    </span>
                    <span v-else class="text-gray-400 italic text-[11px]">Tanpa Minimal</span>
                  </td>

                  <!-- Target / Syarat Berlaku -->
                  <td class="text-center truncate whitespace-nowrap">
                    <span
                      v-if="d.scope === 'ALL'"
                      class="inline-flex items-center gap-1 text-[11px] text-gray-600 font-medium"
                    >
                      Semua Pelanggan
                    </span>
                    <span
                      v-else-if="d.scope === 'MEMBER_ONLY'"
                      class="inline-flex items-center gap-1 text-[11px] text-amber-700 font-bold"
                    >
                      <Users :size="12" />
                      <span>Khusus Member</span>
                    </span>
                    <span
                      v-else-if="d.scope === 'CUSTOMER_TYPE'"
                      class="inline-flex items-center gap-1 text-[11px] font-bold"
                      :class="d.targetCustomerType === 'B2B' ? 'text-indigo-600' : 'text-teal-600'"
                    >
                      <Building v-if="d.targetCustomerType === 'B2B'" :size="12" />
                      <UserCheck v-else :size="12" />
                      <span>{{ d.targetCustomerType === 'B2B' ? 'Langganan Grosir' : 'Pelanggan Eceran' }}</span>
                    </span>
                    <span
                      v-else-if="d.scope === 'CATEGORY'"
                      class="inline-flex items-center gap-1 text-[11px] text-purple-700 font-semibold"
                    >
                      <span>Kategori: {{ d.targetCategory }}</span>
                    </span>
                  </td>

                  <!-- Status Aktif / Nonaktif -->
                  <td class="text-center whitespace-nowrap">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold cursor-pointer transition-colors"
                      :class="d.isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'"
                      :title="d.isActive ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'"
                      @click.stop="discountStore.toggleDiscount(d.id)"
                    >
                      <span class="w-1.5 h-1.5 rounded-full" :class="d.isActive ? 'bg-emerald-600' : 'bg-gray-400'"></span>
                      <span>{{ d.isActive ? 'AKTIF' : 'NONAKTIF' }}</span>
                    </button>
                  </td>

                  <!-- Tombol Expand Rincian -->
                  <td class="td-action-sticky text-center whitespace-nowrap" @click.stop>
                    <button
                      type="button"
                      class="flex items-center justify-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors mx-auto whitespace-nowrap"
                      :class="expandedDiscountIds.has(d.id) ? 'bg-rose-100 text-rose-900 font-bold' : 'text-gray-600 hover:text-rose-800 hover:bg-gray-100'"
                      @click="toggleDiscountExpand(d.id)"
                      :title="expandedDiscountIds.has(d.id) ? 'Tutup rincian' : 'Lihat rincian kupon promo'"
                    >
                      <ChevronUp v-if="expandedDiscountIds.has(d.id)" :size="12" />
                      <ChevronDown v-else :size="12" />
                      <span>{{ expandedDiscountIds.has(d.id) ? 'Tutup' : 'Rincian' }}</span>
                    </button>
                  </td>
                </tr>

                <!-- EXPANDED DETAIL SUBTABLE -->
                <tr v-if="expandedDiscountIds.has(d.id)" class="bg-[#faf8f5] border-b border-gray-200">
                  <td colspan="8" class="px-4 py-2 whitespace-normal">
                    <!-- Subheader Rincian -->
                    <div class="pb-1.5 mb-2 border-b border-gray-200 flex items-center justify-between text-[11px] whitespace-nowrap">
                      <div class="flex items-center gap-2 whitespace-nowrap">
                        <Tag :size="12" class="text-rose-700" />
                        <span class="font-bold text-gray-800">Rincian Kupon: <span class="font-mono text-rose-700 font-bold">{{ d.code }}</span></span>
                        <span class="text-gray-300">|</span>
                        <span class="text-gray-700 font-semibold">{{ d.name }}</span>
                        <span class="text-gray-300">|</span>
                        <span class="text-xs font-mono font-bold" :class="d.isActive ? 'text-emerald-700' : 'text-gray-500'">
                          {{ d.isActive ? '● AKTIF (Siap Pakai Kasir)' : '○ NONAKTIF' }}
                        </span>
                      </div>
                      <div class="flex items-center gap-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          class="px-2 py-0.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 rounded text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                          @click="copyCode(d.code)"
                        >
                          <Copy :size="11" />
                          <span>Salin Kode</span>
                        </button>
                        <button
                          type="button"
                          class="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                          @click="handleOpenEdit(d)"
                        >
                          <Pencil :size="11" />
                          <span>Ubah Aturan</span>
                        </button>
                      </div>
                    </div>

                    <!-- 3 Kolom Panel Terbagi Rata dan Kompak -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                      <!-- Kolom 1: Syarat & Ketentuan -->
                      <div class="space-y-1 divide-y divide-gray-100 bg-white p-2 rounded border border-gray-200 shadow-2xs">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block pb-0.5">1. Syarat & Ketentuan Kupon</span>
                        <div class="pt-1 flex items-center justify-between text-[11px]">
                          <span class="text-gray-500">Tipe Potongan:</span>
                          <span class="font-bold text-gray-800 font-mono">{{ d.type === 'PERCENT' ? 'Persentase (%)' : 'Potongan Tetap (Rp)' }}</span>
                        </div>
                        <div class="pt-1 flex items-center justify-between text-[11px]">
                          <span class="text-gray-500">Besar Nilai:</span>
                          <span class="font-bold text-rose-700 font-mono">{{ d.type === 'PERCENT' ? `${d.value}% OFF` : `Rp ${formatRupiah(d.value)}` }}</span>
                        </div>
                        <div class="pt-1 flex items-center justify-between text-[11px]">
                          <span class="text-gray-500">Minimal Belanja:</span>
                          <span class="font-mono font-semibold text-gray-800">{{ d.minPurchase > 0 ? `Rp ${formatRupiah(d.minPurchase)}` : 'Tanpa Minimal' }}</span>
                        </div>
                        <div class="pt-1 flex items-center justify-between text-[11px]">
                          <span class="text-gray-500">Maks. Potongan:</span>
                          <span class="font-mono text-gray-800">{{ d.maxDiscount ? `Rp ${formatRupiah(d.maxDiscount)}` : 'Tanpa Batas Maksimal' }}</span>
                        </div>
                        <div class="pt-1 flex items-center justify-between text-[11px]">
                          <span class="text-gray-500">Sasaran Pembeli:</span>
                          <span class="font-semibold text-gray-800">
                            {{ d.scope === 'ALL' ? 'Semua Pelanggan' : (d.scope === 'MEMBER_ONLY' ? 'Khusus Pemegang Member' : (d.targetCustomerType === 'B2B' ? 'Langganan Grosir (B2B)' : 'Pelanggan Eceran (B2C)')) }}
                          </span>
                        </div>
                      </div>

                      <!-- Kolom 2: Tes Hitung Diskon Kasir (Modular Component) -->
                      <DiscountSimulator :discount="d" />

                      <!-- Kolom 3: Status Pemakaian & Aksi Cepat -->
                      <div class="space-y-1 divide-y divide-gray-100 bg-white p-2 rounded border border-gray-200 shadow-2xs">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block pb-0.5">3. Statistik & Tindakan</span>
                        <div class="pt-1 flex items-center justify-between text-[11px]">
                          <span class="text-gray-500">Total Dipakai Kasir:</span>
                          <span class="font-bold font-mono text-teal-700">{{ d.usageCount || 0 }} Kali Transaksi</span>
                        </div>
                        <div class="pt-1 flex items-center justify-between text-[11px]">
                          <span class="text-gray-500">Sakelar Status:</span>
                          <button
                            type="button"
                            class="px-2 py-0.5 rounded font-bold text-[10px] cursor-pointer transition-colors shadow-2xs"
                            :class="d.isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                            @click="discountStore.toggleDiscount(d.id)"
                          >
                            {{ d.isActive ? 'Klik Nonaktifkan' : 'Klik Aktifkan' }}
                          </button>
                        </div>
                        <div v-if="d.description" class="pt-1 text-[11px] text-gray-500 italic">
                          "{{ d.description }}"
                        </div>
                        <div class="pt-1.5 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            class="px-2 py-0.5 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 rounded text-[11px] font-semibold cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                            @click="handleDelete(d.id, d.name)"
                          >
                            <Trash2 :size="11" />
                            <span>Hapus Kupon</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sisi Kanan: Form Input & Edit Diskon (Modular Component) -->
      <DiscountFormDrawer
        v-model="discountStore.showFormSidebar"
        :selected-discount="selectedDiscount"
        @switch-to-new="handleOpenAdd"
        @switch-to-edit="handleOpenEdit"
        @saved="handleSaved"
        @deleted="handleDelete"
      />
    </div>
  </div>
</template>
