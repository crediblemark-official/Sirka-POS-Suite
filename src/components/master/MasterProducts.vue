<script setup lang="ts">
import { Product } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';

// Modular Sub-Tabs & Drawers
import MasterSkuTab from './MasterSkuTab.vue';
import ProductReceivingDrawer from './ProductReceivingDrawer.vue';
import StockAdjustModal from '../inventory/StockAdjustModal.vue';
import StockCardModal from '../inventory/StockCardModal.vue';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const inventoryStore = useInventoryStore();

function handleOpenAddProduct() {
  inventoryStore.activeProductForSidebar = null;
  inventoryStore.showProductSidebar = true;
}

function handleOpenEditProduct(prod: Product) {
  inventoryStore.activeProductForSidebar = { ...prod };
  inventoryStore.showProductSidebar = true;
}

function handleProductSaved(_prod: Product) {
  // Sinkronisasi otomatis dari ProductReceivingDrawer
}

function handleProductDeleted(_id: string) {
  inventoryStore.activeProductForSidebar = null;
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Main Workspace: Split Layar (Kiri: Tabel SKU, Kanan: Form Terpadu Barang & Kulakan) -->
    <main class="flex-1 flex overflow-hidden">
      <div class="flex-1 flex flex-col overflow-hidden">
        <MasterSkuTab
          :search-query="props.searchQuery"
          @add-product="handleOpenAddProduct"
          @edit-product="handleOpenEditProduct"
        />
      </div>

      <!-- Sisi Kanan: Form Terpadu Input Barang & Kulakan (Menggunakan SearchableSelect) -->
      <ProductReceivingDrawer
        v-model="inventoryStore.showProductSidebar"
        :active-product="inventoryStore.activeProductForSidebar"
        @saved="handleProductSaved"
        @deleted="handleProductDeleted"
      />
    </main>

    <StockCardModal />
    <StockAdjustModal />
  </div>
</template>
