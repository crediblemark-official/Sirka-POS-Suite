<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { usePosStore } from '../../stores/posStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { BuyerName, PreOrderSchedule } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  Calendar,
  Building,
  ArrowRight,
  Layers,
  Truck,
  Trash2,
  FileText,
  Boxes,
  PackageCheck,
  TrendingUp,
  Coins,
  Users,
  RotateCcw,
  Plus
} from 'lucide-vue-next';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import PreOrderFormDrawer from './PreOrderFormDrawer.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const emit = defineEmits<{
  (e: 'switch-to-pos'): void;
}>();

const preOrderStore = usePreOrderStore();
const posStore = usePosStore();
const inventoryStore = useInventoryStore();
const buyerStore = useBuyerStore();

const selectedDay = ref<string>('Semua');
const selectedBuyer = ref<BuyerName | 'Semua'>('Semua');
// BUG FIX: `localSearchQuery` sebelumnya tidak pernah di-bind ke input mana pun
// -> state mati; pencarian hanya bisa lewat `props.searchQuery` (bar pencarian
// global toolbar). Sekarang dipakai sebagai sumber pencarian lokal.
const localSearchQuery = ref<string>('');

const days = ['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const buyers = computed(() => ['Semua', ...buyerStore.buyers.map(b => b.name)]);

function getDayCount(d: string) {
  if (d === 'Semua') return preOrderStore.schedules.length;
  return preOrderStore.schedules.filter(s => s.dayName === d).length;
}


function getBuyerCount(b: string) {
  if (b === 'Semua') return preOrderStore.schedules.length;
  return preOrderStore.schedules.filter(s => s.buyer === b).length;
}

const buyerOptions = computed<SelectOption[]>(() => {
  return buyers.value.map(b => ({
    value: b,
    label: b === 'Semua' ? 'Semua Pelanggan' : b,
    badge: `${getBuyerCount(b)} PO`
  }));
});

const hasActiveFilter = computed(() => {
  return selectedDay.value !== 'Semua' || selectedBuyer.value !== 'Semua';
});

function resetFilters() {
  selectedDay.value = 'Semua';
  selectedBuyer.value = 'Semua';
}

const filteredSchedules = computed(() => {
  return preOrderStore.schedules.filter(s => {
    const matchDay = selectedDay.value === 'Semua' || s.dayName === selectedDay.value;
    const matchBuyer = selectedBuyer.value === 'Semua' || s.buyer === selectedBuyer.value;

    const q = (props.searchQuery || localSearchQuery.value).toLowerCase().trim();
    // BUG FIX: `s.items` bisa tidak berupa array (data lama / JSON valid tapi
    // bukan array) -> `.some` melempar TypeError yang mematikan SELURUH tab
    // Pre-Order. Guard sama seperti di `preOrderStore.filterSchedules`.
    const items = Array.isArray(s.items) ? s.items : [];
    const matchSearch =
      !q ||
      (s.buyer || '').toLowerCase().includes(q) ||
      (s.dayName || '').toLowerCase().includes(q) ||
      (s.date || '').includes(q) ||
      items.some(i => (i.productName || '').toLowerCase().includes(q));

    return matchDay && matchBuyer && matchSearch;
  });
});

// 6 Metrik Pre-Order Lengkap
const totalPoQty = computed(() => {
  return filteredSchedules.value.reduce((acc, s) => {
    const items = Array.isArray(s.items) ? s.items : [];
    return acc + items.reduce((sum, i) => sum + (i.qty || 0), 0);
  }, 0);
});

/**
 * BUG FIX: item pre-order yang produknya sudah di-rename atau dihapus dari
 * master menghasilkan HPP/omzet 0 TANPA PERINGATAN, sehingga margin PO
 * terlihat jauh lebih besar dari kenyataan. Sekarang item yang tidak
 * ditemukan dihitung dan dilaporkan.
 */
const unmatchedPoItems = computed(() => {
  const unmatched: string[] = [];
  for (const s of filteredSchedules.value) {
    const items = Array.isArray(s.items) ? s.items : [];
    for (const i of items) {
      const prod = inventoryStore.products.find(
        p => (p.name || '').toLowerCase() === (i.productName || '').toLowerCase()
      );
      if (!prod) unmatched.push(i.productName);
    }
  }
  return [...new Set(unmatched)];
});

const totalPoBuy = computed(() => {
  return filteredSchedules.value.reduce((acc, s) => {
    const items = Array.isArray(s.items) ? s.items : [];
    return acc + items.reduce((sum, i) => {
      const prod = inventoryStore.products.find(p => p.name.toLowerCase() === i.productName.toLowerCase());
      const buyPrice = prod?.lastBuyPrice || 0;
      return sum + ((i.qty || 0) * buyPrice);
    }, 0);
  }, 0);
});

const totalPoSell = computed(() => {
  return filteredSchedules.value.reduce((acc, s) => {
    const items = Array.isArray(s.items) ? s.items : [];
    return acc + items.reduce((sum, i) => {
      const prod = inventoryStore.products.find(p => p.name.toLowerCase() === i.productName.toLowerCase());
      const sellPrice = prod?.lastSellPrice || 0;
      return sum + ((i.qty || 0) * sellPrice);
    }, 0);
  }, 0);
});

/**
 * BUG FIX: PO yang merugi disembunyikan jadi "Rp 0 / 0%" sehingga admin tidak
 * tahu pesanan itu merugi. Sekarang nilai negatif ditampilkan apa adanya.
 */
const totalPoProfit = computed(() => {
  return totalPoSell.value - totalPoBuy.value;
});

const averagePoMargin = computed(() => {
  if (totalPoBuy.value === 0) return 0;
  // BUG FIX: ini menghitung MARKUP (profit/HPP), bukan MARGIN (profit/HJ).
  // Jual 100 / beli 80 -> markup 25%, margin sebenarnya 20%. Label di UI
  // menyebut "Margin Keuntungan" sehingga angkanya menyesatkan.
  return Number(((totalPoProfit.value / totalPoSell.value) * 100).toFixed(1));
});

const uniquePoBuyersCount = computed(() => {
  return new Set(filteredSchedules.value.map(s => s.buyer)).size;
});

// DRY Metric Stats configuration
const metricStats = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Pesanan PO',
    value: `${filteredSchedules.value.length} Pesanan`,
    icon: FileText,
    iconBoxClass: 'bg-emerald-50 text-emerald-700',
    valClass: 'text-gray-800'
  },
  {
    label: 'Fisik Barang PO',
    value: `${totalPoQty.value} Pcs`,
    icon: Boxes,
    iconBoxClass: 'bg-purple-50 text-purple-700',
    valClass: 'text-purple-800'
  },
  {
    label: 'Modal Belanja (HPP)',
    value: `Rp ${formatRupiah(totalPoBuy.value)}`,
    icon: PackageCheck,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-blue-700'
  },
  {
    label: 'Estimasi Omzet PO',
    value: `Rp ${formatRupiah(totalPoSell.value)}`,
    // BUG FIX: bila ada item PO yang produknya tidak ada di master, estimasi
    // HPP/omzet PO tidak akurat — user perlu diberi tahu.
    sublabel: unmatchedPoItems.value.length > 0
      ? `${unmatchedPoItems.value.length} item tidak ada di master`
      : undefined,
    icon: TrendingUp,
    iconBoxClass: unmatchedPoItems.value.length > 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700',
    valClass: unmatchedPoItems.value.length > 0 ? 'text-rose-800' : 'text-amber-800'
  },
  {
    label: 'Margin Keuntungan',
    // BUG FIX: tanda +/- sebelumnya selalu "+" sehingga PO yang RUGI tampil
    // sebagai "+Rp -500.000" (salah baca).
    value: `${totalPoProfit.value >= 0 ? '+' : '-'}Rp ${formatRupiah(Math.abs(totalPoProfit.value))}`,
    sublabel: `(${averagePoMargin.value >= 0 ? '+' : ''}${averagePoMargin.value}%)`,
    icon: Coins,
    iconBoxClass: totalPoProfit.value >= 0 ? 'bg-teal-50 text-teal-700' : 'bg-rose-50 text-rose-700',
    valClass: totalPoProfit.value >= 0 ? 'text-teal-800' : 'text-rose-700',
    sublabelClass: totalPoProfit.value >= 0 ? 'text-emerald-600 font-semibold font-mono' : 'text-rose-600 font-semibold font-mono'
  },
  {
    label: 'Pelanggan Pemesan',
    value: `${uniquePoBuyersCount.value} Pelanggan`,
    icon: Users,
    iconBoxClass: 'bg-indigo-50 text-indigo-700',
    valClass: 'text-indigo-800'
  }
]);

const { confirm: showConfirm } = useConfirmDialog();

async function handleDeletePo(id: string, date: string, buyer: string) {
  const isConfirmed = await showConfirm({
    title: 'Hapus Catatan Pesanan',
    message: `Yakin ingin menghapus catatan pesanan untuk "${buyer}" tanggal ${date}?`,
    details: 'Pesanan yang dihapus akan dihilangkan dari jadwal pre-order.',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger'
  });

  if (isConfirmed) {
    try {
      await preOrderStore.deleteSchedule(id);
    } catch (error) {
      console.error('Gagal menghapus pesanan:', error);
      return;
    }
    if (preOrderStore.activeScheduleForSidebar?.id === id) {
      preOrderStore.activeScheduleForSidebar = null;
      preOrderStore.showPreOrderSidebar = false;
    }
  }
}

async function handleLoadToPos(schedule: PreOrderSchedule) {
  // BUG FIX: "Tarik ke Kasir" sebelumnya menambah qty ke item yang SUDAH ada di
  // keranjang (addProductToCart menjumlahkan qty). Menarik PO 10 KG dua kali
  // -> keranjang 20 KG -> pelanggan ditagih 2x jumlah pesanan.
  // Sekarang: refuse bila item yang sama sudah ada di keranjang.
  const items = Array.isArray(schedule.items) ? schedule.items : [];
  const existingNames = new Set(
    posStore.cartItems.map(ci => (ci.name || '').trim().toLowerCase())
  );
  const duplicates = items.filter(i => existingNames.has((i.productName || '').trim().toLowerCase()));
  if (duplicates.length > 0) {
    const ok = window.confirm(
      `Item berikut sudah ada di keranjang kasir:\n` +
      duplicates.map(i => `• ${i.productName} (${i.qty} ${i.unit || ''})`).join('\n') +
      `\n\nTarik ke kasir akan MENAMBAHKAN qty-nya. Lanjutkan?`
    );
    if (!ok) return;
  }

  posStore.loadPreOrderItems(items, schedule.buyer, schedule.date);
  schedule.isLoadedToPos = true;
  await preOrderStore.updateSchedule({ ...schedule, isLoadedToPos: true });
  emit('switch-to-pos');
}

function handleCardClick(sched: PreOrderSchedule) {
  preOrderStore.activeScheduleForSidebar = sched;
  preOrderStore.showPreOrderSidebar = true;
}

function handleOpenAddPo() {
  preOrderStore.activeScheduleForSidebar = null;
  preOrderStore.showPreOrderSidebar = true;
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Main Workspace: Split Layar (Kiri: Grid & Ribbon, Kanan: Sidebar Form Input) -->
    <main class="flex-1 flex overflow-hidden">
      <!-- Sisi Kiri: Ribbon + Metric Stats Strip + Grid Kartu Rekap Pesanan PO -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- 1. Mobile-First Top Header & Filter Controls -->
        <div class="bg-[#f6f5f2] border-b border-gray-200 p-2.5 flex flex-col gap-2 shrink-0 select-none shadow-2xs">
          <!-- Top Row: Title, Total PO Count & Primary Add PO Button -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Calendar :size="16" />
              </div>
              <div class="min-w-0 flex flex-col">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-xs text-gray-900 truncate">Jadwal Pesanan & PO</span>
                  <span class="text-[10px] px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono">
                    {{ filteredSchedules.length }} PO
                  </span>
                </div>
                <span class="text-[10px] text-gray-500">Matriks pesanan berkala & tarik ke kasir</span>
              </div>
            </div>

            <!-- Tombol Catat Pesanan Baru -->
            <button
              type="button"
              @click="handleOpenAddPo"
              class="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <Plus :size="14" />
              <span>+ Pesanan</span>
            </button>
          </div>

          <!-- Bottom Row: Horizontal Chips (Hari Kirim) + Pelanggan Select -->
          <div v-horizontal-scroll class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            <!-- Filter Hari Kirim Chips -->
            <div class="flex items-center gap-1 shrink-0">
              <button
                v-for="d in days"
                :key="d"
                type="button"
                class="px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1 shadow-2xs"
                :class="selectedDay === d ? 'bg-emerald-600 text-white font-bold' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
                @click="selectedDay = d"
              >
                <span>{{ d === 'Semua' ? 'Semua Hari' : d }}</span>
                <span
                  class="text-[10px] px-1 rounded-full font-mono font-bold"
                  :class="selectedDay === d ? 'bg-emerald-700 text-white' : 'bg-gray-200 text-gray-700'"
                >
                  {{ getDayCount(d) }}
                </span>
              </button>
            </div>

            <div class="h-4 w-px bg-gray-300 shrink-0"></div>

            <!-- Filter Pelanggan Pemesan -->
            <div class="w-48 shrink-0 relative z-30">
              <SearchableSelect
                v-model="selectedBuyer"
                :options="buyerOptions"
                placeholder="Semua Pelanggan"
                search-placeholder="Ketik nama pelanggan..."
                size="sm"
              />
            </div>

            <button
              v-if="hasActiveFilter"
              type="button"
              class="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0 whitespace-nowrap"
              title="Reset semua filter"
              @click="resetFilters"
            >
              <RotateCcw :size="12" />
              <span>Reset</span>
            </button>

            <span v-if="props.searchQuery" class="text-[10.5px] text-gray-600 bg-gray-200/80 px-2 py-0.5 rounded-md font-medium shrink-0 whitespace-nowrap ml-auto">
              Cari: "<strong class="text-gray-900">{{ props.searchQuery }}</strong>"
            </span>
          </div>
        </div>

        <!-- Reusable MetricStatsStrip (DRY) di sisi kiri -->
        <MetricStatsStrip :items="metricStats" />

        <div class="flex-1 p-3 overflow-y-auto flex flex-col">
          <!-- Empty State -->

        <AppEmptyState
          v-if="filteredSchedules.length === 0"
          :icon="Calendar"
          title="Tidak ada jadwal pesanan yang sesuai"
          description="Coba ubah tanggal, status filter, atau kata kunci pencarian Anda."
        >
          <button
            type="button"
            class="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold cursor-pointer border border-gray-300 transition-colors"
            @click="resetFilters"
          >
            Reset Semua Filter
          </button>
        </AppEmptyState>

        <!-- Grid Kartu Pesanan -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <div
            v-for="sched in filteredSchedules"
            :key="sched.id"
            class="bg-white border rounded shadow-2xs hover:shadow-md transition-all flex flex-col overflow-hidden cursor-pointer"
            :class="preOrderStore.activeScheduleForSidebar?.id === sched.id ? 'border-emerald-500 ring-2 ring-emerald-400/50' : 'border-gray-300 hover:border-gray-400'"
            @click="handleCardClick(sched)"
          >
            <!-- Card Header: Hari, Tanggal, Pembeli -->
            <div class="p-2.5 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 bg-emerald-700 text-white rounded font-bold text-xs uppercase font-mono">
                  {{ sched.dayName }}
                </span>
                <span class="font-mono text-xs text-gray-600 font-semibold">{{ sched.date }}</span>
                <span
                  v-if="sched.isLoadedToPos"
                  class="px-1.5 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 rounded text-[10px] font-bold tracking-tight"
                >
                  ✓ Dimuat Kasir
                </span>
              </div>

              <div class="flex items-center gap-1.5">
                <div class="flex items-center gap-1 font-bold text-gray-800 text-xs truncate max-w-[150px]">
                  <Building :size="11" />
                  <span>{{ sched.buyer }}</span>
                </div>

                <!-- Quick Delete Control -->
                <div class="flex items-center gap-0.5">
                  <button
                    type="button"
                    class="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                    title="Hapus Catatan Pesanan"
                    @click.stop="handleDeletePo(sched.id, sched.date, sched.buyer)"
                  >
                    <Trash2 :size="12" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Items in Schedule List -->
            <div class="flex-1 p-2 space-y-1 overflow-y-auto max-h-56">
              <div
                v-for="item in sched.items"
                :key="item.id"
                class="flex items-center justify-between p-1.5 rounded bg-gray-50 border border-gray-100 text-xs hover:bg-emerald-50/30 transition-colors"
              >
                <div class="flex flex-col min-w-0 pr-2">
                  <span class="font-bold text-gray-900 truncate leading-tight">{{ item.productName }}</span>
                </div>
                <div class="font-mono text-right shrink-0">
                  <span class="font-black text-blue-700 text-xs">{{ item.qty }} {{ item.unit }}</span>
                  <span
                    v-if="item.packagingNote && item.packagingNote !== `${item.qty} ${item.unit}`"
                    class="block text-[10px] text-gray-500"
                  >
                    ({{ item.packagingNote }})
                  </span>
                </div>
              </div>
            </div>

            <!-- Bottom Action: Tarik ke Kasir -->
            <div class="p-2 bg-[#faf9f7] border-t border-gray-200 flex items-center justify-between">
              <div class="flex items-center gap-1 text-[11px] text-gray-500">
                <Layers :size="12" />
                <span><strong>{{ sched.items.length }}</strong> Barang Dipesan</span>
              </div>

              <button
                type="button"
                class="flex items-center gap-1 px-2.5 py-1 text-white rounded font-bold text-xs cursor-pointer shadow-2xs transition-colors"
                :class="sched.isLoadedToPos ? 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800' : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'"
                :title="sched.isLoadedToPos ? 'Pesanan sudah pernah dimuat. Klik untuk memuat ulang ke kasir.' : 'Tarik barang pesanan ini langsung ke kasir untuk proses pembayaran'"
                @click.stop="handleLoadToPos(sched)"
              >
                <Truck :size="12" />
                <span>{{ sched.isLoadedToPos ? 'Tarik Ulang' : 'Tarik ke Kasir' }}</span>
                <ArrowRight :size="12" />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      <!-- Sisi Kanan: Form Input & Edit Pesanan PO (Modular Drawer) -->
      <PreOrderFormDrawer
        :is-open="preOrderStore.showPreOrderSidebar"
        @update:is-open="preOrderStore.showPreOrderSidebar = $event"
      />
    </main>

    <!-- Floating Action Button: Tambah Pesanan Baru -->
    <button
      type="button"
      @click="handleOpenAddPo"
      class="fixed right-4 bottom-20 z-30 w-13 h-13 rounded-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-xl flex items-center justify-center transition cursor-pointer border-2 border-white/20"
      title="Catat Pesanan Baru"
    >
      <Plus :size="24" />
    </button>
  </div>
</template>
