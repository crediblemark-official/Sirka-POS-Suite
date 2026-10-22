<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useSupplierStore } from '../../stores/supplierStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useDiscountStore } from '../../stores/discountStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { usePosStore } from '../../stores/posStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useUnitStore } from '../../stores/unitStore';
import { formatRupiah } from '../../utils/formatters';
import { Clock, Timer, Database } from 'lucide-vue-next';
import { syncService } from '../../services/syncService';
import SyncStatusModal from '../common/SyncStatusModal.vue';
import type { ModuleTab } from './AppLauncherTab.vue';

defineProps<{
  activeTab: ModuleTab;
}>();

const showSyncModal = ref(false);

const inventoryStore = useInventoryStore();
const buyerStore = useBuyerStore();
const discountStore = useDiscountStore();
const preOrderStore = usePreOrderStore();
const ledgerStore = useLedgerStore();
const posStore = usePosStore();
const shiftStore = useShiftStore();
const supplierStore = useSupplierStore();
const unitStore = useUnitStore();

// Realtime Timer & Digital Clock
const now = ref(Date.now());
let clockTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
});

// 1. Jam Realtime Digital (HH:mm:ss)
const currentTimeStr = computed(() => {
  const d = new Date(now.value);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
});

// Tooltip Tanggal Lengkap
const currentDateTooltip = computed(() => {
  const d = new Date(now.value);
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
});

// 2. Timer Count: Hitungan Durasi Shift Berjalan (HH:mm:ss)
const liveShiftTimer = computed(() => {
  if (!shiftStore.currentShift?.startTime) return '00:00:00';
  const start = new Date(shiftStore.currentShift.startTime).getTime();
  const end = shiftStore.currentShift.endTime
    ? new Date(shiftStore.currentShift.endTime).getTime()
    : now.value;
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));
  const h = String(Math.floor(diffSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
  const s = String(diffSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
});

// Durasi teks: e.g. "0j 12m 34d"
const liveShiftDurationText = computed(() => {
  if (!shiftStore.currentShift?.startTime) return '-';
  const start = new Date(shiftStore.currentShift.startTime).getTime();
  const end = shiftStore.currentShift.endTime
    ? new Date(shiftStore.currentShift.endTime).getTime()
    : now.value;
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  return `${h}j ${m}m ${s}d`;
});
</script>

<template>
  <footer
    class="explorer-statusbar flex items-center justify-between px-3 py-1 border-t text-[11px] shrink-0 font-mono select-none"
    style="color: var(--surface-text-muted);"
  >
    <div class="flex items-center gap-3 min-w-0 truncate">
      <template v-if="activeTab === 'loyalty'">
        <span>{{ buyerStore.memberBuyers.length }} member terdaftar</span>
      </template>
      <template v-else-if="activeTab === 'discounts'">
        <span>{{ discountStore.discounts.length }} kupon promo ({{ discountStore.activeDiscounts.length }} aktif)</span>
      </template>
      <template v-else-if="activeTab === 'preorder'">
        <span>{{ preOrderStore.schedules.length }} daftar pesanan aktif</span>
      </template>
      <template v-else-if="activeTab === 'ledger'">
        <span>{{ ledgerStore.transactions.length }} nota penjualan tercatat</span>
      </template>
      <template v-else-if="activeTab === 'products' || activeTab === 'master'">
        <span>{{ inventoryStore.products.length }} katalog barang aktif</span>
      </template>
      <template v-else-if="activeTab === 'vendors'">
        <span>{{ unitStore.units.length }} master satuan • {{ inventoryStore.categoryMarkups.length }} kategori barang</span>
      </template>
      <template v-else-if="activeTab === 'suppliers'">
        <span>{{ supplierStore.suppliers.length }} mitra supplier pemasok</span>
      </template>
      <template v-else-if="activeTab === 'buyers'">
        <span>{{ buyerStore.buyers.length }} pelanggan &amp; mitra ({{ buyerStore.b2bBuyers.length }} B2B • {{ buyerStore.b2cBuyers.length }} B2C)</span>
      </template>
      <template v-else-if="activeTab === 'branding'">
        <span>Profil Toko &amp; Desain Nota Struk</span>
      </template>
      <template v-else-if="activeTab === 'home'">
        <span>Dashboard Insight Performa &amp; Statistik Bisnis Toko</span>
      </template>
      <template v-else>
        <span>{{ inventoryStore.products.length }} katalog barang aktif</span>
      </template>
    </div>

    <div class="flex items-center gap-3 shrink-0">
      <template v-if="activeTab === 'loyalty'">
        <span class="text-amber-800 font-bold">Program Member &amp; Saldo Poin Pelanggan</span>
      </template>
      <template v-else-if="activeTab === 'discounts'">
        <span class="text-rose-700 font-bold">Kupon Diskon &amp; Promo Potongan Harga</span>
      </template>
      <template v-else-if="activeTab === 'preorder'">
        <span class="text-emerald-800 font-bold">Daftar Titip Pesan &amp; Pengiriman Langganan</span>
      </template>
      <template v-else-if="activeTab === 'ledger'">
        <span>Total Omset: <strong class="text-blue-700">Rp {{ formatRupiah(ledgerStore.totalRevenue) }}</strong></span>
        <span class="text-emerald-800 font-bold text-xs">
          Untung Bersih: Rp {{ formatRupiah(ledgerStore.totalProfit) }}
        </span>
      </template>
      <template v-else-if="activeTab === 'products' || activeTab === 'master'">
        <span class="text-blue-800 font-bold">Katalog Barang &amp; Stok Fisik SKU</span>
      </template>
      <template v-else-if="activeTab === 'vendors'">
        <span class="text-purple-800 font-bold">Master Satuan Kemasan/Eceran &amp; Kategori Barang</span>
      </template>
      <template v-else-if="activeTab === 'suppliers'">
        <span class="text-rose-800 font-bold">Mitra Supplier &amp; Pemasok Kulakan</span>
      </template>
      <template v-else-if="activeTab === 'buyers'">
        <span class="text-indigo-800 font-bold">Buku Kontak Pelanggan &amp; Member</span>
      </template>
      <template v-else-if="activeTab === 'branding'">
        <span class="text-purple-800 font-bold">Identitas Usaha &amp; Desain Nota Struk</span>
      </template>
      <template v-else-if="activeTab === 'pos'">
        <span v-if="shiftStore.isShiftActive" class="text-emerald-700 font-semibold flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Shift: <strong>{{ shiftStore.currentShift?.cashierName }}</strong> ({{ liveShiftDurationText }})</span>
          <span class="text-gray-400">•</span>
          <span>Kas Laci: <strong>Rp {{ formatRupiah(shiftStore.currentShift?.expectedCash || 0) }}</strong></span>
        </span>
        <span v-else class="text-amber-700 font-medium">
          Shift Belum Dibuka
        </span>
        <span class="text-gray-300">|</span>
        <span>Pelanggan: <strong>{{ posStore.selectedBuyer }}</strong></span>
        <span class="text-blue-700 font-bold text-xs">
          Total Belanja: Rp {{ formatRupiah(posStore.totalSell) }}
        </span>
      </template>
      <template v-else-if="activeTab === 'reports'">
        <span class="text-teal-800 font-bold">Laporan Keuangan, Arus Kas &amp; Audit Shift Kasir</span>
      </template>
      <template v-else-if="activeTab === 'launcher'">
        <span class="text-gray-700 font-bold">Launcher Aplikasi &amp; Pintasan Modul</span>
      </template>
      <template v-else-if="activeTab === 'home'">
        <span class="text-indigo-800 font-bold">Ringkasan Eksekutif Bisnis</span>
      </template>
      <template v-else>
        <span class="text-gray-700 font-bold">Sistem Kasir Sirka</span>
      </template>

      <!-- Separator -->
      <span class="text-gray-300 select-none">|</span>

      <!-- Badge Indikator Status Database (Local-First SQLite + Cloud PG Sync) -->
      <button
        type="button"
        class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border transition-all cursor-pointer hover:opacity-85 active:scale-95 shadow-2xs select-none"
        :class="
          syncService.isOnline.value
            ? (syncService.pendingCount.value > 0
                ? 'bg-amber-500/10 text-amber-700 border-amber-500/25'
                : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25')
            : 'bg-indigo-500/10 text-indigo-700 border-indigo-500/25'
        "
        title="Klik untuk membuka menu Status Database & Hapus Cache"
        @click="showSyncModal = true"
      >
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="
            syncService.isOnline.value
              ? (syncService.pendingCount.value > 0
                  ? 'bg-amber-500 animate-pulse'
                  : 'bg-emerald-500')
              : 'bg-indigo-500'
          "
        ></span>
        <span class="flex items-center gap-1 font-mono">
          <Database :size="10" />
          <span>
            {{
              syncService.isOnline.value
                ? (syncService.pendingCount.value > 0
                    ? `PG Sync (${syncService.pendingCount.value})`
                    : 'Cloud PG Aktif')
                : (syncService.pendingCount.value > 0
                    ? `SQLite Lokal (${syncService.pendingCount.value} pending)`
                    : 'SQLite Lokal (Offline)')
            }}
          </span>
        </span>
      </button>

      <!-- Timer Count (Stopwatch / Durasi Shift Aktif) -->
      <div
        class="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-mono transition-colors shadow-2xs select-none"
        :class="shiftStore.isShiftActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'"
        :title="shiftStore.isShiftActive ? `Timer Durasi Shift Kasir (${liveShiftDurationText})` : 'Shift Kasir Sedang Tutup'"
      >
        <Timer :size="12" :class="shiftStore.isShiftActive ? 'text-emerald-600 animate-pulse' : 'text-gray-400'" />
        <span class="font-bold tracking-tight">{{ shiftStore.isShiftActive ? liveShiftTimer : '--:--:--' }}</span>
      </div>

      <!-- Jam Digital Realtime (Waktu Lokal Sekarang) -->
      <div
        class="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-mono bg-indigo-50/70 text-indigo-900 border border-indigo-200/80 transition-colors shadow-2xs select-none"
        :title="currentDateTooltip"
      >
        <Clock :size="12" class="text-indigo-600" />
        <span class="font-bold tracking-wider">{{ currentTimeStr }}</span>
      </div>
    </div>
  </footer>

  <!-- Modal Dialog Status Database & Manajemen Cache -->
  <SyncStatusModal
    :is-open="showSyncModal"
    @close="showSyncModal = false"
  />
</template>
