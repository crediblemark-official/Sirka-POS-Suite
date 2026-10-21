<script setup lang="ts">
import { computed } from 'vue';
import { useStockMovementStore } from '../../stores/stockMovementStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { formatRupiah } from '../../utils/formatters';
import {
  X,
  FileText,
  TrendingDown,
  TrendingUp,
  Scale,
  Package,
  AlertTriangle,
  RotateCcw,
  Truck
} from 'lucide-vue-next';

const movementStore = useStockMovementStore();
const inventoryStore = useInventoryStore();

const activeProduct = computed(() => movementStore.activeProductForCard);

const movements = computed(() => {
  if (!activeProduct.value) return [];
  return movementStore.getProductMovements(activeProduct.value.id);
});

// Ringkasan KPI Barang Tersebut
const totalIn = computed(() => {
  return movements.value
    .filter(m => m.qtyChange > 0)
    .reduce((acc, m) => acc + m.qtyChange, 0);
});

const totalOut = computed(() => {
  return movements.value
    .filter(m => m.qtyChange < 0)
    .reduce((acc, m) => acc + Math.abs(m.qtyChange), 0);
});

function formatDate(iso: string) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function getTypeBadge(type: string) {
  switch (type) {
    case 'KULAKAN':
      return {
        label: 'Kulakan Masuk',
        class: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        icon: TrendingUp
      };
    case 'PENJUALAN':
      return {
        label: 'Terjual Kasir',
        class: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: TrendingDown
      };
    case 'RUSAK_WASTE':
      return {
        label: 'Barang Rusak / Susut',
        class: 'bg-rose-100 text-rose-800 border-rose-300',
        icon: AlertTriangle
      };
    case 'PENYESUAIAN_OPNAME':
      return {
        label: 'Opname / Adjust',
        class: 'bg-purple-100 text-purple-800 border-purple-300',
        icon: Scale
      };
    case 'RETUR_MASUK':
      return {
        label: 'Retur Pelanggan',
        class: 'bg-amber-100 text-amber-800 border-amber-300',
        icon: RotateCcw
      };
    default:
      return {
        label: type,
        class: 'bg-gray-100 text-gray-800 border-gray-300',
        icon: FileText
      };
  }
}

function handleOpenAdjust() {
  if (activeProduct.value) {
    movementStore.openAdjustModal(activeProduct.value);
  }
}

function handleOpenReceiving() {
  if (activeProduct.value) {
    inventoryStore.activeProductForSidebar = { ...activeProduct.value };
    inventoryStore.showProductSidebar = true;
    movementStore.closeStockCard();
  }
}
</script>

<template>
  <div
    v-if="movementStore.isStockCardOpen && activeProduct"
    class="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs select-none"
    @click.self="movementStore.closeStockCard"
  >
    <div
      class="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
    >
      <!-- 1. Header Drawer -->
      <div class="px-5 py-3.5 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <FileText :size="18" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="text-xs font-bold text-gray-900 truncate uppercase">
                {{ activeProduct.name }}
              </h2>
              <span class="text-[10px] px-1.5 py-0.2 bg-gray-200 text-gray-700 font-mono rounded font-semibold shrink-0">
                {{ activeProduct.code }}
              </span>
            </div>
            <p class="text-[11px] text-gray-500 truncate">
              Kategori: <span class="font-medium text-gray-700">{{ activeProduct.category }}</span>
              {{ activeProduct.supplier ? ` • Mitra: ${activeProduct.supplier}` : '' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded text-xs font-semibold text-amber-800 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Buka form kulakan untuk barang ini"
            @click="handleOpenReceiving"
          >
            <Truck :size="12" class="text-amber-700" />
            <span>+ Kulak</span>
          </button>

          <button
            type="button"
            class="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-xs font-semibold text-gray-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Koreksi stok fisik barang ini"
            @click="handleOpenAdjust"
          >
            <Scale :size="12" class="text-purple-600" />
            <span>Adjust Stok</span>
          </button>

          <button
            type="button"
            class="p-1 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700 cursor-pointer transition-colors"
            @click="movementStore.closeStockCard"
          >
            <X :size="18" />
          </button>
        </div>
      </div>

      <!-- 2. Ringkasan Status Stok & Mutasi -->
      <div class="p-4 bg-gray-50/70 border-b border-gray-200 shrink-0">
        <div class="grid grid-cols-4 gap-2">
          <!-- Stok Fisik Terkini -->
          <div class="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
            <span class="text-[10px] text-gray-500 font-medium block">Sisa Stok Saat Ini</span>
            <span class="font-mono text-base font-bold text-gray-900">
              {{ activeProduct.stock }}
              <span class="text-xs font-normal text-gray-500">{{ activeProduct.unit }}</span>
            </span>
          </div>

          <!-- Total Masuk -->
          <div class="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
            <span class="text-[10px] text-gray-500 font-medium block">Total Masuk (Kulakan)</span>
            <span class="font-mono text-base font-bold text-emerald-600">
              +{{ totalIn }}
              <span class="text-xs font-normal text-gray-500">{{ activeProduct.unit }}</span>
            </span>
          </div>

          <!-- Total Keluar -->
          <div class="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
            <span class="text-[10px] text-gray-500 font-medium block">Total Keluar (Kasir/Waste)</span>
            <span class="font-mono text-base font-bold text-rose-600">
              -{{ totalOut }}
              <span class="text-xs font-normal text-gray-500">{{ activeProduct.unit }}</span>
            </span>
          </div>

          <!-- HPP & Jual -->
          <div class="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
            <span class="text-[10px] text-gray-500 font-medium block">Modal / Jual</span>
            <div class="font-mono text-xs font-bold text-gray-800">
              Rp {{ formatRupiah(activeProduct.lastBuyPrice || 0) }}
            </div>
            <div class="font-mono text-[11px] text-blue-700 font-bold">
              Rp {{ formatRupiah(activeProduct.lastSellPrice || 0) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Tabel Riwayat Mutasi Kartu Stok -->
      <div class="flex-1 flex flex-col overflow-hidden text-xs">
        <div class="px-4 py-2 bg-gray-100/70 border-b border-gray-200 flex items-center justify-between text-[11px] font-bold text-gray-700">
          <span>Riwayat Aliran Stok (Buku Mutasi)</span>
          <span class="text-gray-500 font-normal font-mono">{{ movements.length }} catatan mutasi</span>
        </div>

        <div class="flex-1 overflow-y-auto">
          <!-- Empty State jika belum ada mutasi -->
          <div v-if="movements.length === 0" class="flex flex-col items-center justify-center p-8 text-center text-gray-400 space-y-2">
            <Package :size="32" class="text-gray-300" />
            <p class="font-semibold text-xs text-gray-600">Belum Ada Riwayat Mutasi</p>
            <p class="text-[11px] max-w-xs text-gray-400">
              Mutasi otomatis tercatat saat ada Kulakan, Penjualan Kasir, Barang Rusak, atau Penyesuaian Stok Opname.
            </p>
          </div>

          <!-- Tabel Mutasi -->
          <table v-else class="w-full text-left border-collapse">
            <thead class="bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500 uppercase tracking-wider font-semibold sticky top-0 z-10">
              <tr>
                <th class="py-2 px-3">Waktu</th>
                <th class="py-2 px-3">Jenis Mutasi</th>
                <th class="py-2 px-3">No. Referensi</th>
                <th class="py-2 px-2 text-right">Perubahan</th>
                <th class="py-2 px-3 text-right">Sisa Stok</th>
                <th class="py-2 px-3">Keterangan</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 font-mono text-[11px]">
              <tr
                v-for="m in movements"
                :key="m.id"
                class="hover:bg-amber-50/30 transition-colors"
              >
                <!-- Waktu -->
                <td class="py-2 px-3 text-gray-600 whitespace-nowrap font-sans text-[11px]">
                  {{ formatDate(m.date || m.createdAt) }}
                </td>

                <!-- Jenis Mutasi Badge -->
                <td class="py-2 px-3 whitespace-nowrap">
                  <span
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border font-sans"
                    :class="getTypeBadge(m.type).class"
                  >
                    <component :is="getTypeBadge(m.type).icon" :size="10" />
                    <span>{{ getTypeBadge(m.type).label }}</span>
                  </span>
                </td>

                <!-- No Ref -->
                <td class="py-2 px-3 text-gray-700 font-semibold whitespace-nowrap">
                  {{ m.refNo || '-' }}
                </td>

                <!-- Perubahan Qty -->
                <td class="py-2 px-2 text-right font-bold whitespace-nowrap">
                  <span
                    :class="m.qtyChange > 0 ? 'text-emerald-700' : m.qtyChange < 0 ? 'text-rose-700' : 'text-gray-500'"
                  >
                    {{ m.qtyChange > 0 ? `+${m.qtyChange}` : m.qtyChange }}
                  </span>
                </td>

                <!-- Sisa Stok -->
                <td class="py-2 px-3 text-right font-bold text-gray-900 whitespace-nowrap">
                  {{ m.stockAfter }} {{ m.unit }}
                </td>

                <!-- Keterangan & Operator -->
                <td class="py-2 px-3 text-gray-500 font-sans text-[10.5px] max-w-[180px] truncate" :title="m.notes || ''">
                  {{ m.notes || m.operator || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. Footer Drawer -->
      <div class="px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between shrink-0 text-xs">
        <span class="text-[11px] text-gray-500">
          Stok saat ini: <strong class="font-mono text-gray-800">{{ activeProduct.stock }} {{ activeProduct.unit }}</strong>
        </span>
        <button
          type="button"
          class="px-3 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
          @click="movementStore.closeStockCard"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
