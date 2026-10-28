<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Discount } from '../../types';
import { useDiscountStore } from '../../stores/discountStore';
import { formatRupiah } from '../../utils/formatters';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import AppTableContainer from '../common/AppTableContainer.vue';
import AppFilterDrawer from '../common/AppFilterDrawer.vue';
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
  ChevronsDownUp,
  Plus,
  SlidersHorizontal,
  RotateCcw,
  X
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

// Marketplace Filter Drawer States
const showFilterDrawer = ref(false);

type DiscountStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type DiscountTypeFilter = 'ALL' | 'PERCENT' | 'FIXED';
type DiscountScopeFilter = 'ALL' | 'MEMBER' | 'B2B' | 'B2C';

const filterStatus = ref<DiscountStatusFilter>('ALL');
const filterType = ref<DiscountTypeFilter>('ALL');
const filterScope = ref<DiscountScopeFilter>('ALL');

const activeFiltersCount = computed(() => {
  let count = 0;
  if (filterStatus.value !== 'ALL') count++;
  if (filterType.value !== 'ALL') count++;
  if (filterScope.value !== 'ALL') count++;
  return count;
});

function resetAllFilters() {
  filterStatus.value = 'ALL';
  filterType.value = 'ALL';
  filterScope.value = 'ALL';
}

// Selection & Form Sidebar states
const selectedDiscountId = ref<string>('');

// Counts for ribbon & metric cards
const percentCount = computed(() => discountStore.discounts.filter(d => d.type === 'PERCENT').length);
const fixedCount = computed(() => discountStore.discounts.filter(d => d.type === 'FIXED').length);
const memberCount = computed(() => discountStore.discounts.filter(d => d.scope === 'MEMBER_ONLY').length);
// BUG FIX: hitungan B2B/B2C sebelumnya menghitung SEMUA kupon yang punya
// targetCustomerType, termasuk scope 'ALL' & 'CATEGORY' yang tidak begrup
// customer type sama sekali -> angka di ribbon != jumlah baris saat filter diklik.
const b2bCount = computed(() => discountStore.discounts.filter(
  d => d.scope === 'CUSTOMER_TYPE' && d.targetCustomerType === 'B2B'
).length);
const b2cCount = computed(() => discountStore.discounts.filter(
  d => d.scope === 'CUSTOMER_TYPE' && d.targetCustomerType === 'B2C'
).length);
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

    if (!matchesSearch) return false;

    // 2. Status Filter
    if (filterStatus.value === 'ACTIVE' && !d.isActive) return false;
    if (filterStatus.value === 'INACTIVE' && d.isActive) return false;

    // 3. Type Filter
    if (filterType.value === 'PERCENT' && d.type !== 'PERCENT') return false;
    if (filterType.value === 'FIXED' && d.type !== 'FIXED') return false;

    // 4. Scope Filter
    if (filterScope.value === 'MEMBER' && d.scope !== 'MEMBER_ONLY') return false;
    if (filterScope.value === 'B2B' && d.targetCustomerType !== 'B2B') return false;
    if (filterScope.value === 'B2C' && d.targetCustomerType !== 'B2C') return false;

    return true;
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
/**
 * BUG FIX: `navigator.clipboard.writeText` tanpa await/catch -> unhandled
 * rejection di WebView Tauri / konteks non-secure, dan UI tetap menampilkan
 * "Disalin!" padahal sebenarnya gagal.
 */
async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    copiedCode.value = code;
    setTimeout(() => {
      copiedCode.value = null;
    }, 1500);
  } catch (err: any) {
    console.warn('[MasterDiscountTab] Gagal menyalin kode kupon:', err);
    alert('Gagal menyalin ke clipboard. Salin manual: ' + code);
  }
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
    // BUG FIX: `deleteDiscount` melempar error bila gagal. Tanpa await/catch
    // terjadi unhandled rejection dan user TIDAK diberi tahu bahwa kupon
    // gagal dihapus (baris tetap di layar).
    try {
      await discountStore.deleteDiscount(id);
      discountStore.closeFormSidebar();
      if (selectedDiscountId.value === id) {
        selectedDiscountId.value = filteredDiscounts.value[0]?.id || '';
      }
    } catch (err: any) {
      alert(`Gagal menghapus kupon: ${err?.message || err}`);
    }
  }
}

/**
 * BUG FIX: `toggleDiscount` melempar error bila gagal (dan me-rollback state
 * lokal). Dipanggil langsung dari template tanpa catch -> unhandled rejection
 * tanpa pesan ke user.
 */
async function handleToggleDiscount(id: string) {
  try {
    await discountStore.toggleDiscount(id);
  } catch (err: any) {
    alert(`Gagal mengubah status kupon: ${err?.message || err}`);
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
        <!-- 1. Mobile-First Top Header & Filter Controls -->
        <div class="bg-[#f6f5f2] border-b border-gray-200 p-2.5 flex flex-col gap-2 shrink-0 select-none shadow-2xs">
          <!-- Top Row: Title, Total Discounts & Primary Add Button -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <Tag :size="16" />
              </div>
              <div class="min-w-0 flex flex-col">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-xs text-gray-900 truncate">Kupon Promo & Diskon</span>
                  <span class="text-[10px] px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 font-bold font-mono">
                    {{ discountStore.discounts.length }} Kupon
                  </span>
                </div>
                <span class="text-[10px] text-gray-500">Program diskon persen, nominal, & member</span>
              </div>
            </div>

            <!-- Tombol Tambah Diskon Baru -->
            <button
              type="button"
              @click="handleOpenAdd"
              class="h-8 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus :size="14" />
              <span>+ Diskon</span>
            </button>
          </div>

          <!-- Bottom Row: Marketplace-Style Filter Drawer Trigger & Quick Filter Pills -->
          <div v-horizontal-scroll class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <!-- Marketplace Filter Drawer Trigger Button -->
            <button
              type="button"
              @click="showFilterDrawer = true"
              class="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer shrink-0 shadow-xs whitespace-nowrap active:scale-95"
              :class="activeFiltersCount > 0
                ? 'bg-rose-600 text-white border-rose-600 shadow-rose-500/20'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'"
            >
              <SlidersHorizontal :size="13" />
              <span>Filter</span>
              <span
                v-if="activeFiltersCount > 0"
                class="px-1.5 py-0.2 rounded-full bg-white text-rose-700 font-mono text-[10px] font-bold"
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

            <!-- Quick Filter Pill: Semua Diskon -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="filterStatus === 'ALL' && filterType === 'ALL' && filterScope === 'ALL'
                ? 'bg-rose-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="resetAllFilters"
            >
              <span>Semua</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="filterStatus === 'ALL' && filterType === 'ALL' && filterScope === 'ALL' ? 'bg-rose-700 text-white' : 'bg-gray-200 text-gray-700'">
                {{ discountStore.discounts.length }}
              </span>
            </button>

            <!-- Quick Filter Pill: Aktif -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="filterStatus === 'ACTIVE'
                ? 'bg-emerald-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="filterStatus = filterStatus === 'ACTIVE' ? 'ALL' : 'ACTIVE'"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
              <span>Aktif</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="filterStatus === 'ACTIVE' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'">
                {{ activeDiscountsCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Nonaktif -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="filterStatus === 'INACTIVE'
                ? 'bg-gray-700 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="filterStatus = filterStatus === 'INACTIVE' ? 'ALL' : 'INACTIVE'"
            >
              <span>Nonaktif</span>
            </button>

            <!-- Quick Filter Pill: Persen (%) -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="filterType === 'PERCENT'
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="filterType = filterType === 'PERCENT' ? 'ALL' : 'PERCENT'"
            >
              <Percent :size="11" />
              <span>Persen (%)</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="filterType === 'PERCENT' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700 border border-blue-200'">
                {{ percentCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Tetap (Rp) -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="filterType === 'FIXED'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="filterType = filterType === 'FIXED' ? 'ALL' : 'FIXED'"
            >
              <DollarSign :size="11" />
              <span>Tetap (Rp)</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="filterType === 'FIXED' ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200'">
                {{ fixedCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Khusus Member -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="filterScope === 'MEMBER'
                ? 'bg-purple-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="filterScope = filterScope === 'MEMBER' ? 'ALL' : 'MEMBER'"
            >
              <Users :size="11" />
              <span>Member</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="filterScope === 'MEMBER' ? 'bg-purple-700 text-white' : 'bg-purple-50 text-purple-700 border border-purple-200'">
                {{ memberCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Grosir B2B -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="filterScope === 'B2B'
                ? 'bg-indigo-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="filterScope = filterScope === 'B2B' ? 'ALL' : 'B2B'"
            >
              <Building :size="11" />
              <span>Grosir B2B</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="filterScope === 'B2B' ? 'bg-indigo-700 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'">
                {{ b2bCount }}
              </span>
            </button>

            <!-- Quick Filter Pill: Eceran B2C -->
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 select-none flex items-center gap-1.5 shadow-2xs"
              :class="filterScope === 'B2C'
                ? 'bg-teal-600 text-white font-bold'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
              @click="filterScope = filterScope === 'B2C' ? 'ALL' : 'B2C'"
            >
              <UserCheck :size="11" />
              <span>Eceran B2C</span>
              <span class="text-[10px] px-1 rounded-full font-mono font-bold" :class="filterScope === 'B2C' ? 'bg-teal-700 text-white' : 'bg-teal-50 text-teal-700 border border-teal-200'">
                {{ b2cCount }}
              </span>
            </button>

            <div class="h-4 w-px bg-gray-300 shrink-0"></div>

            <!-- Toggle Expand All Rows -->
            <button
              type="button"
              class="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border cursor-pointer transition-colors shrink-0 bg-white hover:bg-gray-100 text-gray-700 border-gray-300 shadow-2xs whitespace-nowrap"
              @click="toggleExpandAll"
            >
              <component :is="isAllExpanded ? ChevronsDownUp : ChevronsUpDown" :size="12" />
              <span>{{ isAllExpanded ? 'Tutup Detail' : 'Buka Semua' }}</span>
            </button>

            <!-- Indikator Query Pencarian -->
            <span v-if="props.searchQuery" class="text-[10.5px] text-gray-600 bg-gray-200/80 px-2 py-0.5 rounded-md font-medium shrink-0 whitespace-nowrap ml-auto">
              Cari: "<strong class="text-gray-900">{{ props.searchQuery }}</strong>"
            </span>
          </div>
        </div>

    <!-- Reusable MetricStatsStrip (DRY) di sisi kiri -->
    <MetricStatsStrip :items="discountMetrics" />

        <AppTableContainer
          class="outline-none"
          tabindex="0"
          :is-empty="filteredDiscounts.length === 0"
          :empty-icon="Tag"
          empty-title="Tidak ada kupon promo yang cocok"
          empty-description="Coba ubah kategori filter atau periksa kata kunci pencarian Anda."
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

          <!-- Tabel Diskon Rapi Sejajar Edge-to-Edge -->
          <table class="table-explorer whitespace-nowrap min-w-[800px]">
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
                      @click.stop="handleToggleDiscount(d.id)"
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
                            @click="handleToggleDiscount(d.id)"
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
        </AppTableContainer>

        <!-- Marketplace-Style Filter Drawer Component -->
        <AppFilterDrawer
          :is-open="showFilterDrawer"
          title="Filter Kupon Promo"
          subtitle="Saring kupon berdasarkan status, tipe potongan, dan sasaran pelanggan"
          :active-filters-count="activeFiltersCount"
          :result-count="filteredDiscounts.length"
          result-label="Kupon Promo"
          apply-button-color="bg-rose-600 hover:bg-rose-700 active:bg-rose-800"
          @close="showFilterDrawer = false"
          @reset="resetAllFilters"
          @apply="showFilterDrawer = false"
        >
          <!-- Seksi 1: Status Kupon Promo -->
          <div class="space-y-2">
            <label class="font-bold text-gray-800 text-xs block">Status Kupon Promo</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-center cursor-pointer transition-all"
                :class="filterStatus === 'ALL'
                  ? 'bg-rose-50 border-rose-600 text-rose-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="filterStatus = 'ALL'"
              >
                Semua
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-center cursor-pointer transition-all"
                :class="filterStatus === 'ACTIVE'
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="filterStatus = 'ACTIVE'"
              >
                Aktif ({{ activeDiscountsCount }})
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-center cursor-pointer transition-all"
                :class="filterStatus === 'INACTIVE'
                  ? 'bg-gray-100 border-gray-600 text-gray-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="filterStatus = 'INACTIVE'"
              >
                Nonaktif
              </button>
            </div>
          </div>

          <!-- Seksi 2: Jenis Potongan Harga -->
          <div class="pt-3 space-y-2">
            <label class="font-bold text-gray-800 text-xs block">Jenis Potongan Harga</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-center cursor-pointer transition-all"
                :class="filterType === 'ALL'
                  ? 'bg-rose-50 border-rose-600 text-rose-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="filterType = 'ALL'"
              >
                Semua Tipe
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-center cursor-pointer transition-all"
                :class="filterType === 'PERCENT'
                  ? 'bg-blue-50 border-blue-600 text-blue-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="filterType = 'PERCENT'"
              >
                Persen (%) ({{ percentCount }})
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-center cursor-pointer transition-all"
                :class="filterType === 'FIXED'
                  ? 'bg-amber-50 border-amber-600 text-amber-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="filterType = 'FIXED'"
              >
                Tetap (Rp) ({{ fixedCount }})
              </button>
            </div>
          </div>

          <!-- Seksi 3: Sasaran / Target Pasar -->
          <div class="pt-3 space-y-2">
            <label class="font-bold text-gray-800 text-xs block">Target Sasaran Pelanggan</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="filterScope === 'ALL'
                  ? 'bg-rose-50 border-rose-600 text-rose-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="filterScope = 'ALL'"
              >
                <span>Semua Sasaran</span>
                <span class="w-2 h-2 rounded-full" :class="filterScope === 'ALL' ? 'bg-rose-600' : 'bg-transparent'"></span>
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="filterScope === 'MEMBER'
                  ? 'bg-purple-50 border-purple-600 text-purple-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="filterScope = 'MEMBER'"
              >
                <span>Khusus Member ({{ memberCount }})</span>
                <span class="w-2 h-2 rounded-full" :class="filterScope === 'MEMBER' ? 'bg-purple-600' : 'bg-transparent'"></span>
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="filterScope === 'B2B'
                  ? 'bg-indigo-50 border-indigo-600 text-indigo-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="filterScope = 'B2B'"
              >
                <span>Grosir B2B ({{ b2bCount }})</span>
                <span class="w-2 h-2 rounded-full" :class="filterScope === 'B2B' ? 'bg-indigo-600' : 'bg-transparent'"></span>
              </button>
              <button
                type="button"
                class="px-3 py-2 rounded-lg text-xs font-semibold border text-left flex items-center justify-between cursor-pointer transition-all"
                :class="filterScope === 'B2C'
                  ? 'bg-teal-50 border-teal-600 text-teal-900 font-bold shadow-2xs'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'"
                @click="filterScope = 'B2C'"
              >
                <span>Eceran B2C ({{ b2cCount }})</span>
                <span class="w-2 h-2 rounded-full" :class="filterScope === 'B2C' ? 'bg-teal-600' : 'bg-transparent'"></span>
              </button>
            </div>
          </div>
        </AppFilterDrawer>
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

    <!-- Floating Action Button: Tambah Diskon Baru -->
    <button
      type="button"
      @click="handleOpenAdd"
      class="fixed right-4 bottom-20 z-30 w-13 h-13 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-95 text-white shadow-xl flex items-center justify-center transition cursor-pointer border-2 border-white/20"
      title="Tambah Diskon Baru"
    >
      <Plus :size="24" />
    </button>
  </div>
</template>
