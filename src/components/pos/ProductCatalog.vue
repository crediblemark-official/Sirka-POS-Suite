<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePosStore } from '../../stores/posStore';
import { SupplierCategory, Product } from '../../types';
import { Search, LayoutGrid, List, Plus, Package } from 'lucide-vue-next';

const inventoryStore = useInventoryStore();
const posStore = usePosStore();

const searchQuery = ref('');
const selectedCategory = ref<SupplierCategory | 'Semua'>('Semua');
const viewMode = ref<'grid' | 'table'>('grid');
const activeMultiplier = ref<number>(1);
const searchInputRef = ref<HTMLInputElement | null>(null);

const categories: Array<SupplierCategory | 'Semua'> = [
  'Semua',
  'Hari Barokah',
  'Sayur Tufel',
  'Haff Pro Jaya',
  'Pantry Co',
  'Koko Didid',
  'Fadhil Food',
  'Pak Agus',
  'APD & Sabun',
  'ATK & Kertas'
];

const multipliers = [1, 5, 10, 25, 50];

const filteredProducts = computed(() => {
  return inventoryStore.products.filter(p => {
    const matchCat = selectedCategory.value === 'Semua' || p.category === selectedCategory.value;
    const q = searchQuery.value.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });
});

function handleAddProduct(product: Product) {
  posStore.addProductToCart(product, activeMultiplier.value);
}

const formatRupiah = (val: number) => {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val);
};

// Global keyboard shortcut '/' to focus search
function handleKeydown(e: KeyboardEvent) {
  if (e.key === '/' && document.activeElement !== searchInputRef.value) {
    e.preventDefault();
    searchInputRef.value?.focus();
    searchInputRef.value?.select();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div class="product-catalog-panel">
    <!-- Top Search & Quick Action Toolbar -->
    <div class="catalog-toolbar">
      <div class="search-box">
        <Search :size="16" class="search-icon" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          type="text"
          placeholder="Cari barang, kode, atau satuan... (tekan '/')"
          class="search-input"
        />
        <kbd class="shortcut-kbd">/</kbd>
      </div>

      <!-- Quick Multiplier Chips -->
      <div class="multiplier-group">
        <span class="multiplier-label">Qty:</span>
        <button
          v-for="m in multipliers"
          :key="m"
          class="mult-chip"
          :class="{ active: activeMultiplier === m }"
          @click="activeMultiplier = m"
        >
          +{{ m }}
        </button>
      </div>

      <!-- View Toggle -->
      <div class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'grid' }"
          @click="viewMode = 'grid'"
          title="Tampilan Grid Kartu"
        >
          <LayoutGrid :size="16" />
        </button>
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'table' }"
          @click="viewMode = 'table'"
          title="Tampilan Tabel Baris Padat"
        >
          <List :size="16" />
        </button>
      </div>
    </div>

    <!-- 1-Click Supplier / Category Filter Tabs -->
    <div class="category-filters">
      <button
        v-for="cat in categories"
        :key="cat"
        class="cat-chip"
        :class="{ active: selectedCategory === cat }"
        @click="selectedCategory = cat"
      >
        <span>{{ cat }}</span>
        <span v-if="cat !== 'Semua'" class="cat-count">
          {{ inventoryStore.products.filter(p => p.category === cat).length }}
        </span>
      </button>
    </div>

    <!-- Catalog Content -->
    <div class="catalog-scroll-area">
      <!-- Empty State -->
      <div v-if="filteredProducts.length === 0" class="empty-state">
        <Package :size="36" class="empty-icon" />
        <p>Tidak ada barang yang cocok dengan pencarian <strong>"{{ searchQuery }}"</strong></p>
      </div>

      <!-- Grid View (Default) -->
      <div v-else-if="viewMode === 'grid'" class="products-grid">
        <div
          v-for="prod in filteredProducts"
          :key="prod.id"
          class="product-card"
          @click="handleAddProduct(prod)"
        >
          <div class="card-header">
            <span class="card-code">{{ prod.code }}</span>
            <span class="card-unit">{{ prod.unit }}</span>
          </div>

          <h3 class="card-name" :title="prod.name">{{ prod.name }}</h3>
          
          <div class="card-category">
            <span class="cat-tag">{{ prod.category }}</span>
            <span class="markup-tag">+{{ prod.defaultMarkupPercent || inventoryStore.getCategoryMarkup(prod.category) }}%</span>
          </div>

          <div class="card-pricing">
            <div class="price-col">
              <span class="price-label">Stok Gudang</span>
              <span class="stock-badge num-mono" :class="{ 'low-stock': prod.stock < 10 }">
                {{ prod.stock }} {{ prod.unit }}
              </span>
            </div>
            <div class="price-col text-right">
              <span class="price-label">Harga Jual</span>
              <span class="price-val sell-primary num-mono">Rp {{ formatRupiah(prod.lastSellPrice) }}</span>
            </div>
          </div>

          <button class="card-add-btn" title="Tambah ke Keranjang">
            <Plus :size="14" />
            <span>+{{ activeMultiplier }} Masuk Struk</span>
          </button>
        </div>
      </div>

      <!-- Dense Table View -->
      <div v-else class="products-table-wrapper">
        <table class="dense-table">
          <thead>
            <tr>
              <th style="width: 80px">KODE</th>
              <th>NAMA BARANG</th>
              <th style="width: 110px">SUPPLIER</th>
              <th style="width: 70px">SATUAN</th>
              <th style="width: 110px" class="text-right">BELI TERAKHIR</th>
              <th style="width: 70px" class="text-center">MARKUP</th>
              <th style="width: 110px" class="text-right">HARGA JUAL</th>
              <th style="width: 90px" class="text-center">AKSI</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="prod in filteredProducts"
              :key="prod.id"
              class="table-row"
              @click="handleAddProduct(prod)"
            >
              <td class="num-mono font-medium text-dim">{{ prod.code }}</td>
              <td class="font-semibold">{{ prod.name }}</td>
              <td><span class="cat-tag-sm">{{ prod.category }}</span></td>
              <td><span class="unit-badge">{{ prod.unit }}</span></td>
              <td class="text-right num-mono text-dim">Rp {{ formatRupiah(prod.lastBuyPrice) }}</td>
              <td class="text-center font-semibold text-emerald-400">
                +{{ prod.defaultMarkupPercent || inventoryStore.getCategoryMarkup(prod.category) }}%
              </td>
              <td class="text-right num-mono font-bold text-blue-400">Rp {{ formatRupiah(prod.lastSellPrice) }}</td>
              <td class="text-center">
                <button class="table-add-btn">
                  <Plus :size="13" /> +{{ activeMultiplier }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.product-catalog-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-subtle);
  overflow: hidden;
}

/* Toolbar */
.catalog-toolbar {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-app);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.search-box {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  color: var(--text-dim);
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding-left: 32px;
  padding-right: 36px;
  height: 36px;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  font-size: 0.84rem;
}

.shortcut-kbd {
  position: absolute;
  right: 10px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 0.72rem;
  font-family: var(--font-mono);
  color: var(--text-dim);
}

.multiplier-group {
  display: flex;
  align-items: center;
  gap: 3px;
  background: var(--bg-surface-elevated);
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}

.multiplier-label {
  font-size: 0.72rem;
  color: var(--text-dim);
  padding: 0 4px;
}

.mult-chip {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 4px;
  color: var(--text-muted);
}

.mult-chip:hover {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.06);
}

.mult-chip.active {
  background: var(--primary);
  color: white;
}

.view-toggle {
  display: flex;
  background: var(--bg-surface-elevated);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
  padding: 2px;
}

.toggle-btn {
  padding: 4px 7px;
  color: var(--text-muted);
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.toggle-btn.active {
  background: var(--bg-surface-hover);
  color: white;
}

/* Category Filter Chips */
.category-filters {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  overflow-x: auto;
  white-space: nowrap;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.cat-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.76rem;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: var(--bg-surface-elevated);
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
}

.cat-chip:hover {
  color: var(--text-main);
  border-color: var(--border-medium);
}

.cat-chip.active {
  background: #1e3a8a;
  color: #93c5fd;
  border-color: #3b82f6;
  font-weight: 600;
}

.cat-count {
  font-size: 0.65rem;
  opacity: 0.75;
}

/* Scroll Area */
.catalog-scroll-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

/* Grid Layout */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
  gap: 10px;
}

.product-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 11px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}

.product-card:hover {
  transform: translateY(-2px);
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-code {
  font-size: 0.7rem;
  font-family: var(--font-mono);
  color: var(--text-dim);
}

.card-unit {
  font-size: 0.68rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 5px;
  border-radius: 4px;
  color: #d1d5db;
}

.card-name {
  font-size: 0.82rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-main);
  min-height: 32px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-category {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cat-tag {
  font-size: 0.68rem;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 110px;
}

.markup-tag {
  font-size: 0.68rem;
  font-weight: 700;
  color: #34d399;
}

.card-pricing {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 6px;
  margin-top: 2px;
}

.price-col {
  display: flex;
  flex-direction: column;
}

.price-label {
  font-size: 0.62rem;
  color: var(--text-dim);
}

.sell-primary {
  color: #60a5fa;
  font-weight: 800;
  font-size: 0.88rem;
}

.stock-badge {
  font-size: 0.72rem;
  color: #34d399;
  font-weight: 600;
}

.stock-badge.low-stock {
  color: #f87171;
}

.card-add-btn {
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  padding: 5px 0;
  background: rgba(59, 130, 246, 0.12);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: var(--radius-sm);
  font-size: 0.74rem;
  font-weight: 600;
}

.product-card:hover .card-add-btn {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}

/* Dense Table View */
.products-table-wrapper {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.dense-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.dense-table th {
  background: var(--bg-app);
  padding: 8px 10px;
  font-size: 0.68rem;
  color: var(--text-dim);
  font-weight: 600;
  border-bottom: 1px solid var(--border-subtle);
  text-align: left;
}

.dense-table td {
  padding: 7px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.table-row {
  cursor: pointer;
  transition: background var(--transition-fast);
}

.table-row:hover {
  background: rgba(59, 130, 246, 0.08);
}

.cat-tag-sm {
  font-size: 0.68rem;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  color: #94a3b8;
}

.unit-badge {
  font-size: 0.7rem;
  color: var(--text-dim);
}

.table-add-btn {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.table-row:hover .table-add-btn {
  background: var(--primary);
  color: white;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-dim);
  gap: 10px;
  font-size: 0.85rem;
}

.empty-icon {
  opacity: 0.4;
}

.text-right { text-align: right; }
.text-center { text-align: center; }
.text-dim { color: var(--text-dim); }
</style>
