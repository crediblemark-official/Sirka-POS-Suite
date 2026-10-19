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
  RotateCcw
} from 'lucide-vue-next';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import PreOrderFormDrawer from './PreOrderFormDrawer.vue';

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
    const matchSearch =
      !q ||
      s.buyer.toLowerCase().includes(q) ||
      s.dayName.toLowerCase().includes(q) ||
      s.date.includes(q) ||
      s.items.some(i => i.productName.toLowerCase().includes(q));

    return matchDay && matchBuyer && matchSearch;
  });
});

// 6 Metrik Pre-Order Lengkap
const totalPoQty = computed(() => {
  return filteredSchedules.value.reduce((acc, s) => {
    return acc + s.items.reduce((sum, i) => sum + (i.qty || 0), 0);
  }, 0);
});

const totalPoBuy = computed(() => {
  return filteredSchedules.value.reduce((acc, s) => {
    return acc + s.items.reduce((sum, i) => {
      const prod = inventoryStore.products.find(p => p.name.toLowerCase() === i.productName.toLowerCase());
      const buyPrice = prod?.lastBuyPrice || 0;
      return sum + ((i.qty || 0) * buyPrice);
    }, 0);
  }, 0);
});

const totalPoSell = computed(() => {
  return filteredSchedules.value.reduce((acc, s) => {
    return acc + s.items.reduce((sum, i) => {
      const prod = inventoryStore.products.find(p => p.name.toLowerCase() === i.productName.toLowerCase());
      const sellPrice = prod?.lastSellPrice || 0;
      return sum + ((i.qty || 0) * sellPrice);
    }, 0);
  }, 0);
});

const totalPoProfit = computed(() => {
  return Math.max(0, totalPoSell.value - totalPoBuy.value);
});

const averagePoMargin = computed(() => {
  if (totalPoBuy.value === 0) return 0;
  return Number(((totalPoProfit.value / totalPoBuy.value) * 100).toFixed(1));
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
    icon: TrendingUp,
    iconBoxClass: 'bg-amber-50 text-amber-700',
    valClass: 'text-amber-800'
  },
  {
    label: 'Margin Keuntungan',
    value: `+Rp ${formatRupiah(totalPoProfit.value)}`,
    sublabel: `(+${averagePoMargin.value}%)`,
    icon: Coins,
    iconBoxClass: 'bg-teal-50 text-teal-700',
    valClass: 'text-teal-800',
    sublabelClass: 'text-emerald-600 font-semibold font-mono'
  },
  {
    label: 'Pelanggan Pemesan',
    value: `${uniquePoBuyersCount.value} Pelanggan`,
    icon: Users,
    iconBoxClass: 'bg-indigo-50 text-indigo-700',
    valClass: 'text-indigo-800'
  }
]);

async function handleDeletePo(id: string, date: string, buyer: string) {
  if (confirm(`Yakin ingin menghapus catatan pesanan untuk ${buyer} tanggal ${date}?`)) {
    try { await preOrderStore.deleteSchedule(id); }
    catch (error) { alert(`Gagal menghapus pesanan: ${error}`); return; }
    if (preOrderStore.activeScheduleForSidebar?.id === id) {
      preOrderStore.activeScheduleForSidebar = null;
      preOrderStore.showPreOrderSidebar = false;
    }
  }
}

async function handleLoadToPos(schedule: PreOrderSchedule) {
  posStore.loadPreOrderItems(schedule.items, schedule.buyer, schedule.date);
  schedule.isLoadedToPos = true;
  await preOrderStore.updateSchedule({ ...schedule, isLoadedToPos: true });
  emit('switch-to-pos');
}

function handleCardClick(sched: PreOrderSchedule) {
  preOrderStore.activeScheduleForSidebar = sched;
  preOrderStore.showPreOrderSidebar = true;
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Main Workspace: Split Layar (Kiri: Grid & Ribbon, Kanan: Sidebar Form Input) -->
    <main class="flex-1 flex overflow-hidden">
      <!-- Sisi Kiri: Ribbon + Metric Stats Strip + Grid Kartu Rekap Pesanan PO -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- 1. Top Ribbon: Filter Bar (Hari Kirim & Pelanggan) -->
        <div
          v-horizontal-scroll
          class="h-10 relative z-30 flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 select-none shrink-0 gap-3 overflow-x-auto no-scrollbar"
        >
          <!-- Sisi Kiri: Filter Hari & Pelanggan -->
          <div class="flex items-center gap-3 shrink-0">
            <!-- 1. Filter Hari Kirim (Pill Horizontal) -->
            <div class="flex items-center gap-1 shrink-0">
              <button
                v-for="d in days"
                :key="d"
                type="button"
                class="px-2.5 py-1 rounded text-xs cursor-pointer transition-all shrink-0 select-none flex items-center gap-1"
                :class="selectedDay === d ? 'bg-emerald-600 text-white font-bold shadow-2xs' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'"
                @click="selectedDay = d"
              >
                <span>{{ d === 'Semua' ? 'Semua Hari' : d }}</span>
                <span
                  class="text-[10px] px-1 rounded-full"
                  :class="selectedDay === d ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-600'"
                >
                  {{ getDayCount(d) }}
                </span>
              </button>
            </div>

            <div class="h-4 w-px bg-gray-300 shrink-0"></div>

            <!-- 2. Filter Pelanggan Pemesan -->
            <div class="flex items-center gap-1.5">
              <span class="text-gray-500 font-bold text-[11px] uppercase tracking-wider flex items-center gap-1 shrink-0">
                <Users :size="13" class="text-emerald-700" />
                <span>Pelanggan:</span>
              </span>
              <div class="w-56 shrink-0 relative z-40">
                <SearchableSelect
                  v-model="selectedBuyer"
                  :options="buyerOptions"
                  placeholder="Semua Pelanggan"
                  search-placeholder="Ketik nama pelanggan..."
                  size="sm"
                />
              </div>
            </div>
          </div>

          <!-- Sisi Kanan: Reset Filter & Total Hasil -->
          <div class="flex items-center gap-2 shrink-0">
            <button
              v-if="hasActiveFilter"
              type="button"
              class="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded cursor-pointer transition-colors shadow-2xs"
              title="Reset semua filter"
              @click="resetFilters"
            >
              <RotateCcw :size="12" />
              <span>Reset Filter</span>
            </button>

            <div class="font-mono text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded border border-gray-200">
              <span class="font-bold text-gray-800">{{ filteredSchedules.length }}</span> Jadwal PO
            </div>

            <span v-if="props.searchQuery" class="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium">
              Cari: "<span class="font-bold text-gray-800">{{ props.searchQuery }}</span>"
            </span>
          </div>
        </div>

        <!-- Reusable MetricStatsStrip (DRY) di sisi kiri -->
        <MetricStatsStrip :items="metricStats" />

        <div class="flex-1 p-3 overflow-y-auto">
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
  </div>
</template>
