<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { ProductIntelligenceItem, ProductsIntelligenceReport } from '../types';
import { ownerApi } from '../services/api';
import { formatRupiah } from '../utils/formatters';
import HeaderBar from '../components/HeaderBar.vue';
import { Search, Landmark, Package, X, TrendingUp, Coins, AlertTriangle, Zap } from 'lucide-vue-next';

const loading = ref(false);
const intelligenceData = ref<ProductsIntelligenceReport>({
  totalCapitalLocked: 0,
  totalDeadStockSkus: 0,
  fastMovingSkus: 0,
  items: [],
});
const searchQuery = ref('');
const selectedFilter = ref<'ALL' | 'DEAD_STOCK' | 'FAST_MOVING'>('ALL');

async function loadData() {
  loading.value = true;
  try {
    intelligenceData.value = await ownerApi.getProductsIntelligence();
  } catch {
    // Fallback if needed
  } finally {
    loading.value = false;
  }
}

const totalAssetBuyValue = computed(() => {
  return intelligenceData.value.items.reduce((acc, it) => acc + (it.stock * it.buyPrice), 0);
});

const totalPotentialSellValue = computed(() => {
  return intelligenceData.value.items.reduce((acc, it) => acc + (it.stock * it.sellPrice), 0);
});

const potentialProfit = computed(() => {
  return totalPotentialSellValue.value - totalAssetBuyValue.value;
});

const filteredItems = computed(() => {
  return intelligenceData.value.items.filter(it => {
    // Status filter
    if (selectedFilter.value === 'DEAD_STOCK' && it.velocityStatus !== 'DEAD_STOCK') return false;
    if (selectedFilter.value === 'FAST_MOVING' && it.velocityStatus !== 'FAST_MOVING') return false;

    // Search query
    if (!searchQuery.value) return true;
    const q = searchQuery.value.toLowerCase();
    return (
      it.name.toLowerCase().includes(q) ||
      it.code.toLowerCase().includes(q) ||
      it.category.toLowerCase().includes(q)
    );
  });
});

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="min-h-screen bg-[#ecebe9] pb-20 text-[#2e2b28] font-sans flex flex-col">
    <!-- Header Bar (Full Edge) -->
    <HeaderBar
      title="Valuasi &amp; Intelijen Stok"
      subtitle="Gudang &gt; Analisis Aset &amp; Dead Stock"
      :loading="loading"
      @refresh="loadData"
    />

    <!-- Main Content (Full Edge) -->
    <main class="w-full flex-1 flex flex-col">
      <!-- 1. Horizontal Scrollable Desktop Metric Stats Strip -->
      <div class="w-full bg-white border-b border-[#c8c5c0] overflow-x-auto flex items-center divide-x divide-[#e5e3de] select-none no-scrollbar">
        <!-- Metric 1: Modal Tertanam (HPP) -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 flex items-center justify-center shadow-2xs">
            <Landmark class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Modal Tertanam (HPP)
            </div>
            <div class="text-sm font-extrabold font-mono text-[#2e2b28] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(totalAssetBuyValue) }}
            </div>
          </div>
        </div>

        <!-- Metric 2: Modal Terkunci (Dead Stock) -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap bg-amber-50/40">
          <div class="w-8 h-8 rounded bg-amber-100 text-amber-800 border border-amber-300 shrink-0 flex items-center justify-center shadow-2xs">
            <AlertTriangle class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-amber-800 uppercase tracking-wider font-bold whitespace-nowrap leading-tight flex items-center gap-1">
              <span>Modal Terkunci (Mati)</span>
              <span class="px-1 py-0.2 text-[9px] bg-amber-200 text-amber-900 rounded font-mono">{{ intelligenceData.totalDeadStockSkus }} SKU</span>
            </div>
            <div class="text-sm font-extrabold font-mono text-amber-700 whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(intelligenceData.totalCapitalLocked) }}
            </div>
          </div>
        </div>

        <!-- Metric 3: Estimasi Nilai Jual -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0 flex items-center justify-center shadow-2xs">
            <TrendingUp class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Estimasi Nilai Jual
            </div>
            <div class="text-sm font-extrabold font-mono text-[#2563eb] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(totalPotentialSellValue) }}
            </div>
          </div>
        </div>

        <!-- Metric 4: Potensi Margin Untung -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 flex items-center justify-center shadow-2xs">
            <Coins class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Potensi Margin
            </div>
            <div class="text-sm font-extrabold font-mono text-[#16a34a] whitespace-nowrap leading-snug mt-0.5">
              {{ formatRupiah(potentialProfit) }}
            </div>
          </div>
        </div>

        <!-- Metric 5: Total SKU Aktif -->
        <div class="p-2.5 px-3.5 flex items-center gap-2.5 shrink-0 whitespace-nowrap">
          <div class="w-8 h-8 rounded bg-[#f0ede8] text-[#6b655f] border border-[#e5e3de] shrink-0 flex items-center justify-center shadow-2xs">
            <Package class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <div class="text-[10px] text-[#6b655f] uppercase tracking-wider font-bold whitespace-nowrap leading-tight">
              Total Persediaan
            </div>
            <div class="text-xs font-bold font-mono text-[#2e2b28] whitespace-nowrap leading-snug mt-0.5">
              {{ intelligenceData.items.length }} SKU Terdaftar
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Segmented Velocity Filter Bar (Full Edge) -->
      <div class="w-full bg-[#f4f3f0] border-b border-[#c8c5c0] px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        <span class="text-[10px] font-bold text-[#6b655f] uppercase tracking-wider shrink-0 mr-1">Filter Perputaran:</span>
        <button
          @click="selectedFilter = 'ALL'"
          class="px-2.5 py-1 text-xs font-semibold rounded transition-colors shrink-0"
          :class="selectedFilter === 'ALL' ? 'bg-[#2e2b28] text-white shadow-2xs' : 'bg-white border border-[#c8c5c0] text-[#6b655f] hover:text-[#2e2b28]'"
        >
          Semua SKU ({{ intelligenceData.items.length }})
        </button>
        <button
          @click="selectedFilter = 'DEAD_STOCK'"
          class="px-2.5 py-1 text-xs font-semibold rounded transition-colors shrink-0 flex items-center gap-1"
          :class="selectedFilter === 'DEAD_STOCK' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-white border border-[#c8c5c0] text-amber-700 hover:bg-amber-50'"
        >
          <AlertTriangle class="w-3 h-3" />
          <span>Dead Stock / Uang Mati ({{ intelligenceData.totalDeadStockSkus }})</span>
        </button>
        <button
          @click="selectedFilter = 'FAST_MOVING'"
          class="px-2.5 py-1 text-xs font-semibold rounded transition-colors shrink-0 flex items-center gap-1"
          :class="selectedFilter === 'FAST_MOVING' ? 'bg-emerald-600 text-white shadow-2xs' : 'bg-white border border-[#c8c5c0] text-emerald-700 hover:bg-emerald-50'"
        >
          <Zap class="w-3 h-3" />
          <span>Laris / Fast Moving ({{ intelligenceData.fastMovingSkus }})</span>
        </button>
      </div>

      <!-- 3. Full-Cell Search Input Row -->
      <div class="w-full bg-white border-b border-[#c8c5c0] flex items-center h-9 px-3 gap-2">
        <Search class="w-3.5 h-3.5 text-[#6b655f] shrink-0" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari nama komoditas, kode, atau kategori..."
          class="flex-1 bg-transparent border-0 outline-none text-xs text-[#2e2b28] placeholder-[#6b655f] h-full"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="text-[#6b655f] hover:text-[#2e2b28] cursor-pointer p-1"
        >
          <X class="w-3.5 h-3.5" />
        </button>
        <span class="text-[10.5px] text-[#6b655f] font-mono shrink-0 pl-1.5 border-l border-[#e5e3de]">
          {{ filteredItems.length }} SKU
        </span>
      </div>

      <!-- 4. Desktop SKU Table (No Wrap / Whitespace Nowrap) -->
      <div class="w-full bg-white border-b border-[#c8c5c0] overflow-x-auto">
        <table class="table-explorer whitespace-nowrap min-w-full">
          <thead>
            <tr>
              <th class="whitespace-nowrap px-3 py-2 text-left">Kode</th>
              <th class="whitespace-nowrap px-3 py-2 text-left">Nama Komoditas</th>
              <th class="whitespace-nowrap px-3 py-2 text-center">Status Perputaran</th>
              <th class="whitespace-nowrap px-3 py-2 text-right">Margin (%)</th>
              <th class="whitespace-nowrap px-3 py-2 text-right">Stok Fisik</th>
              <th class="whitespace-nowrap px-3 py-2 text-right">HPP Satuan</th>
              <th class="whitespace-nowrap px-3 py-2 text-right">Modal Tertanam</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="it in filteredItems"
              :key="it.id"
              class="hover:bg-[#faf9f7] transition-colors"
            >
              <td class="whitespace-nowrap font-mono font-semibold text-[#6b655f] text-[11px] px-3 py-2">
                {{ it.code }}
              </td>
              <td class="whitespace-nowrap font-bold text-[#2e2b28] text-xs px-3 py-2">
                {{ it.name }}
              </td>
              <td class="whitespace-nowrap text-center text-[10.5px] px-3 py-2">
                <span
                  v-if="it.velocityStatus === 'DEAD_STOCK'"
                  class="px-2 py-0.5 rounded font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 inline-flex items-center gap-1"
                >
                  <AlertTriangle class="w-2.5 h-2.5" />
                  DEAD STOCK (&gt;30hr)
                </span>
                <span
                  v-else-if="it.velocityStatus === 'FAST_MOVING'"
                  class="px-2 py-0.5 rounded font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1"
                >
                  <Zap class="w-2.5 h-2.5" />
                  LARIS / FAST
                </span>
                <span
                  v-else
                  class="px-2 py-0.5 rounded font-mono text-[#6b655f] bg-[#f0ede8] border border-[#e5e3de]"
                >
                  REGULER
                </span>
              </td>
              <td class="whitespace-nowrap text-right font-mono font-bold text-xs px-3 py-2" :class="it.marginPct >= 20 ? 'text-emerald-700' : 'text-[#6b655f]'">
                {{ it.marginPct.toFixed(1) }}%
              </td>
              <td class="whitespace-nowrap text-right font-mono font-bold text-[#2e2b28] text-xs px-3 py-2">
                {{ it.stock }} <span class="text-[10px] font-normal text-[#6b655f]">{{ it.unit }}</span>
              </td>
              <td class="whitespace-nowrap text-right font-mono text-[#6b655f] text-xs px-3 py-2">
                {{ formatRupiah(it.buyPrice) }}
              </td>
              <td class="whitespace-nowrap text-right font-mono font-bold text-[#2563eb] text-xs px-3 py-2">
                {{ formatRupiah(it.capitalLocked) }}
              </td>
            </tr>

            <tr v-if="filteredItems.length === 0">
              <td colspan="7" class="text-center py-10 text-[#6b655f] text-xs">
                Tidak ada komoditas persediaan yang cocok dengan filter yang dipilih.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>
