<script setup lang="ts">
import { ref, computed } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { formatRupiah } from '../../utils/formatters';
import { PurchaseReceipt } from '../../types';
import {
  Truck,
  CheckCircle,
  Clock,
  PackageCheck,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronsDownUp,
  ChevronsUpDown,
  Boxes,
  TrendingUp,
  Coins,
  Edit2,
  Trash2
} from 'lucide-vue-next';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import ReceivingFormDrawer from './ReceivingFormDrawer.vue';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const inventoryStore = useInventoryStore();
const purchaseStore = usePurchaseStore();

// Suppliers
const suppliers = computed(() => {
  return inventoryStore.categoryMarkups.map(c => c.category);
});

const supplierFilterOptions = computed<SelectOption[]>(() => {
  return [
    { value: 'Semua', label: 'Semua Vendor', badge: `${purchaseStore.purchaseHistory.length} nota` },
    ...suppliers.value.map(s => ({
      value: s,
      label: s,
      badge: `${purchaseStore.purchaseHistory.filter(p => p.supplier === s).length} nota`
    }))
  ];
});

// Auto-select first supplier if none selected
if (!purchaseStore.selectedSupplier && suppliers.value.length > 0) {
  purchaseStore.selectedSupplier = suppliers.value[0] as any;
}

const successMessage = ref<string>('');

// History filter state
const historySupplierFilter = ref<string>('Semua');
const expandedReceiptIds = ref<Set<string>>(new Set());

function toggleReceiptExpand(id: string) {
  if (expandedReceiptIds.value.has(id)) {
    expandedReceiptIds.value.delete(id);
  } else {
    expandedReceiptIds.value.add(id);
  }
}

const isAllExpanded = computed(() => {
  return filteredHistory.value.length > 0 && filteredHistory.value.every(rcp => expandedReceiptIds.value.has(rcp.id));
});

function toggleExpandAll() {
  if (isAllExpanded.value) {
    expandedReceiptIds.value.clear();
  } else {
    filteredHistory.value.forEach(rcp => expandedReceiptIds.value.add(rcp.id));
  }
}

// Filtered purchase history (menggunakan search bar global di header atas)
const filteredHistory = computed(() => {
  return purchaseStore.purchaseHistory.filter(r => {
    const matchSupplier = historySupplierFilter.value === 'Semua' || r.supplier === historySupplierFilter.value;
    const q = (props.searchQuery || '').toLowerCase().trim();
    const matchQ =
      !q ||
      r.supplierInvoiceNo.toLowerCase().includes(q) ||
      r.supplier.toLowerCase().includes(q) ||
      (r.notes && r.notes.toLowerCase().includes(q));
    return matchSupplier && matchQ;
  });
});

const totalHistoricalBuy = computed(() => {
  return filteredHistory.value.reduce((acc, r) => acc + (r.totalBuy || 0), 0);
});

const totalQtyReceived = computed(() => {
  return filteredHistory.value.reduce((acc, r) => {
    return acc + r.items.reduce((s, it) => s + (Number(it.qtyReceived) || 0), 0);
  }, 0);
});

const totalItemTypes = computed(() => {
  return filteredHistory.value.reduce((acc, r) => acc + r.items.length, 0);
});

const totalHistoricalSell = computed(() => {
  return filteredHistory.value.reduce((acc, r) => {
    return acc + r.items.reduce((s, it) => s + ((Number(it.qtyReceived) || 0) * (Number(it.newSellPrice) || 0)), 0);
  }, 0);
});

function getReceiptTotalSell(rcp: PurchaseReceipt) {
  return rcp.items.reduce((acc, it) => acc + ((Number(it.qtyReceived) || 0) * (Number(it.newSellPrice) || 0)), 0);
}

const totalHistoricalMargin = computed(() => {
  return Math.max(0, totalHistoricalSell.value - totalHistoricalBuy.value);
});

const averageMarginPercent = computed(() => {
  if (totalHistoricalBuy.value === 0) return 0;
  return Number(((totalHistoricalMargin.value / totalHistoricalBuy.value) * 100).toFixed(1));
});

// Metric stats configuration (DRY)
const metricStats = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Faktur Nota',
    value: `${filteredHistory.value.length} Faktur`,
    icon: FileText,
    iconBoxClass: 'bg-amber-50 text-amber-700',
    valClass: 'text-gray-800'
  },
  {
    label: 'Fisik Barang Masuk',
    value: `${totalQtyReceived.value} Pcs`,
    sublabel: `(${totalItemTypes.value} jenis)`,
    icon: Boxes,
    iconBoxClass: 'bg-purple-50 text-purple-700',
    valClass: 'text-purple-800',
    sublabelClass: 'text-gray-500 font-sans'
  },
  {
    label: 'Total Modal (HPP)',
    value: `Rp ${formatRupiah(totalHistoricalBuy.value)}`,
    icon: PackageCheck,
    iconBoxClass: 'bg-emerald-50 text-emerald-700',
    valClass: 'text-emerald-700'
  },
  {
    label: 'Estimasi Nilai Jual',
    value: `Rp ${formatRupiah(totalHistoricalSell.value)}`,
    icon: TrendingUp,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-blue-700'
  },
  {
    label: 'Potensi Margin',
    value: `+Rp ${formatRupiah(totalHistoricalMargin.value)}`,
    sublabel: `(+${averageMarginPercent.value}%)`,
    icon: Coins,
    iconBoxClass: 'bg-teal-50 text-teal-700',
    valClass: 'text-teal-800',
    sublabelClass: 'text-emerald-600 font-semibold font-mono'
  },
  {
    label: 'Supplier Terdaftar',
    value: `${suppliers.value.length} Vendor`,
    icon: Truck,
    iconBoxClass: 'bg-amber-50 text-amber-800',
    valClass: 'text-amber-900'
  }
]);

function onReceivingSaved(res: any) {
  successMessage.value = `Nota ${res.supplierInvoiceNo} berhasil disimpan! Stok & HPP barang telah diperbarui.`;
  setTimeout(() => {
    successMessage.value = '';
  }, 4000);
}

function handleEditReceipt(rcp: PurchaseReceipt) {
  purchaseStore.loadReceiptForEdit(rcp);
}

async function handleDeleteReceipt(rcp: PurchaseReceipt) {
  if (confirm(`Yakin ingin menghapus nota kulakan ${rcp.supplierInvoiceNo}? Stok barang akan dikembalikan ke kondisi sebelumnya.`)) {
    let ok = false;
    try { ok = await purchaseStore.deleteReceipt(rcp.id); }
    catch (error) { alert(`Gagal menghapus nota: ${error}`); return; }
    if (ok) {
      successMessage.value = `Nota ${rcp.supplierInvoiceNo} berhasil dihapus & stok barang telah disesuaikan.`;
      setTimeout(() => {
        successMessage.value = '';
      }, 4000);
    }
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Toast Notifikasi Sukses Simpan -->
    <div
      v-if="successMessage"
      class="px-4 py-2 bg-emerald-600 text-white flex items-center justify-between text-xs font-semibold shadow-md shrink-0 transition-all z-20"
    >
      <div class="flex items-center gap-2">
        <CheckCircle :size="16" />
        <span>{{ successMessage }}</span>
      </div>
      <button type="button" class="p-1 hover:bg-emerald-700 rounded cursor-pointer" @click="successMessage = ''">
        <X :size="14" />
      </button>
    </div>

    <!-- Main Container: Kiri Tabel Riwayat Nota (Full Width), Kanan Form Input Sidebar (Gaya Cart) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- SISI KIRI: TABEL UTAMA RIWAYAT & DAFTAR NOTA KULAKAN -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- 1. Top Ribbon & Filter Bar -->
        <div
          v-horizontal-scroll
          class="h-10 relative z-30 flex items-center justify-between px-3 bg-[#f6f5f2] border-b border-gray-200 gap-3 shrink-0 overflow-x-auto no-scrollbar"
        >
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1.5 font-bold text-gray-700 text-xs shrink-0 mr-1">
              <Clock :size="14" class="text-amber-700" />
              <span>Filter Vendor:</span>
            </div>

            <!-- SearchableSelect: Vendor -->
            <div class="w-64 shrink-0 relative z-40">
              <SearchableSelect
                v-model="historySupplierFilter"
                :options="supplierFilterOptions"
                placeholder="Cari / Pilih Vendor..."
                search-placeholder="Ketik nama vendor..."
                size="sm"
              />
            </div>
          </div>

          <!-- Sisi Kanan: Status Pencarian -->
          <div v-if="props.searchQuery" class="flex items-center gap-2 shrink-0">
            <span class="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium">
              Cari: "<span class="font-bold text-gray-800">{{ props.searchQuery }}</span>"
            </span>
          </div>
        </div>

        <!-- 2. Reusable MetricStatsStrip (DRY) -->
        <MetricStatsStrip :items="metricStats" />

        <!-- 3. Tabel Riwayat Nota Masuk -->
        <div class="flex-1 bg-white" :class="purchaseStore.showHistoryDrawer ? 'overflow-auto' : 'overflow-y-auto overflow-x-hidden'">
          <AppEmptyState
            v-if="filteredHistory.length === 0"
            :icon="Truck"
            title="Belum Ada Riwayat Nota Kulakan"
            description="Belum ada riwayat nota kulakan yang cocok dengan filter."
          />

          <table v-else class="table-explorer" :class="purchaseStore.showHistoryDrawer ? 'min-w-[800px]' : ''">
            <thead>
              <tr>
                <th class="w-12 text-center">
                  <button
                    type="button"
                    class="p-1 hover:bg-black/10 rounded cursor-pointer transition-colors"
                    :title="isAllExpanded ? 'Tutup semua rincian nota' : 'Buka semua rincian nota'"
                    @click="toggleExpandAll"
                  >
                    <ChevronsDownUp v-if="isAllExpanded" :size="14" class="text-amber-800" />
                    <ChevronsUpDown v-else :size="14" class="text-gray-600" />
                  </button>
                </th>
                <th class="w-28">TANGGAL</th>
                <th class="w-36">NO. FAKTUR</th>
                <th>SUPPLIER / VENDOR</th>
                <th class="w-24 text-center">ITEM / FISIK</th>
                <th class="w-32 text-right">TOTAL MODAL</th>
                <th class="w-32 text-right">HARGA JUAL</th>
                <!-- Sticky Action Header -->
                <th class="th-action-sticky w-20">AKSI</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="rcp in filteredHistory" :key="rcp.id">
                <tr
                  class="cursor-pointer"
                  :class="expandedReceiptIds.has(rcp.id) ? 'bg-[#fefcf8]' : ''"
                  @click="toggleReceiptExpand(rcp.id)"
                >
                  <td class="text-center text-gray-400">
                    <ChevronUp v-if="expandedReceiptIds.has(rcp.id)" :size="14" class="inline text-amber-700" />
                    <ChevronDown v-else :size="14" class="inline" />
                  </td>
                  <td class="font-mono text-gray-700 whitespace-nowrap">{{ rcp.date }}</td>
                  <td class="font-mono font-bold text-gray-900 whitespace-nowrap">{{ rcp.supplierInvoiceNo }}</td>
                  <td class="font-bold text-gray-800">
                    <span class="inline-flex items-center gap-1">
                      <Truck :size="13" class="text-amber-600 shrink-0" />
                      <span>{{ rcp.supplier }}</span>
                    </span>
                  </td>
                  <td class="text-center font-mono whitespace-nowrap">
                    <span class="font-bold text-gray-800">{{ rcp.items.length }}</span> jenis
                    <span class="text-gray-400 text-[10px]">({{ rcp.items.reduce((s, it) => s + it.qtyReceived, 0) }} pcs)</span>
                  </td>
                  <td class="text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                    Rp {{ formatRupiah(rcp.totalBuy) }}
                  </td>
                  <td class="text-right font-mono font-bold text-blue-700 whitespace-nowrap">
                    Rp {{ formatRupiah(getReceiptTotalSell(rcp)) }}
                  </td>
                  <!-- Sticky Action Cell -->
                  <td class="td-action-sticky whitespace-nowrap" @click.stop>
                    <div class="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        class="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                        title="Edit Nota Kulakan"
                        @click.stop="handleEditReceipt(rcp)"
                      >
                        <Edit2 :size="13" />
                      </button>
                      <button
                        type="button"
                        class="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                        title="Hapus Nota Kulakan"
                        @click.stop="handleDeleteReceipt(rcp)"
                      >
                        <Trash2 :size="13" />
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- Expandable Accordion: Rincian Barang dalam Nota -->
                <tr v-if="expandedReceiptIds.has(rcp.id)" class="subtable-row border-b border-amber-300">
                  <td colspan="8" class="p-0!">
                    <div class="bg-white overflow-hidden border-y border-amber-200/90">
                      <div class="px-4 py-2 bg-[#f6f3eb] border-b border-amber-200/80 font-bold text-gray-700 flex items-center justify-between text-[11px]">
                        <span>Rincian Barang Faktur {{ rcp.supplierInvoiceNo }}</span>
                        <span class="font-mono text-emerald-700 font-bold">Total: Rp {{ formatRupiah(rcp.totalBuy) }}</span>
                      </div>
                      <table class="w-full text-xs">
                        <thead class="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold text-[10.5px]">
                          <tr>
                            <th class="p-2 pl-4">KODE</th>
                            <th class="p-2">NAMA BARANG</th>
                            <th class="p-2 w-20 text-center">QTY</th>
                            <th class="p-2 w-28 text-right">MODAL BELI</th>
                            <th class="p-2 w-24 text-center">MARKUP</th>
                            <th class="p-2 w-28 text-right">HARGA JUAL BARU</th>
                            <th class="p-2 w-32 text-right pr-4">SUBTOTAL MODAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="it in rcp.items" :key="it.id" class="border-b border-gray-100 last:border-0 hover:bg-amber-50/30">
                            <td class="p-2 pl-4 font-mono text-gray-500 text-[10.5px]">{{ it.code }}</td>
                            <td class="p-2 font-bold text-gray-800">{{ it.name }}</td>
                            <td class="p-2 text-center font-mono font-bold">{{ it.qtyReceived }} {{ it.unit }}</td>
                            <td class="p-2 text-right font-mono text-gray-700">Rp {{ formatRupiah(it.buyPrice) }}</td>
                            <td class="p-2 text-center font-mono text-blue-700 font-semibold">+{{ it.markupPercent }}%</td>
                            <td class="p-2 text-right font-mono text-blue-800 font-bold">Rp {{ formatRupiah(it.newSellPrice) }}</td>
                            <td class="p-2 text-right pr-4 font-mono font-bold text-emerald-700">Rp {{ formatRupiah(it.subtotalBuy) }}</td>
                          </tr>
                        </tbody>
                      </table>

                      <div v-if="rcp.notes" class="px-4 py-2 border-t border-amber-200/50 bg-[#fcfbfa] text-xs text-gray-600 flex items-center gap-1.5 whitespace-nowrap">
                        <span class="font-semibold text-gray-700">Catatan Penerimaan:</span>
                        <span class="italic text-gray-800">{{ rcp.notes }}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SISI KANAN: FORM INPUT KULAKAN (SIDEBAR DRAWER) -->
      <ReceivingFormDrawer
        :is-open="purchaseStore.showHistoryDrawer"
        @update:is-open="purchaseStore.showHistoryDrawer = $event"
        @close="purchaseStore.showHistoryDrawer = false"
        @saved="onReceivingSaved"
      />
    </div>
  </div>
</template>
