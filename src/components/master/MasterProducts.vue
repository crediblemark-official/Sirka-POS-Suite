<script setup lang="ts">
import { ref, computed } from 'vue';
import { Product, Buyer, CustomerType } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { Settings, Package, Percent, Store, Users } from 'lucide-vue-next';

// Modular Sub-Tabs
import MasterSkuTab from './MasterSkuTab.vue';
import MasterVendorTab from './MasterVendorTab.vue';
import MasterBuyerTab from './MasterBuyerTab.vue';
import MasterBrandingTab from './MasterBrandingTab.vue';

// Modular DRY Modals
import ProductFormModal from './ProductFormModal.vue';
import BuyerFormModal from './BuyerFormModal.vue';
import VendorFormModal from './VendorFormModal.vue';

const inventoryStore = useInventoryStore();
const buyerStore = useBuyerStore();

// Sub-tabs in Master Settings
type MasterTab = 'sku' | 'vendors' | 'buyers' | 'branding';
const activeMasterTab = ref<MasterTab>('buyers');

// Modals State
const showProductModal = ref(false);
const activeProductForEdit = ref<Product | null>(null);

const showBuyerModal = ref(false);
const activeBuyerForEdit = ref<Buyer | null>(null);
const defaultCustomerTypeForModal = ref<CustomerType>('B2B');

const showVendorModal = ref(false);

const categories = computed(() => inventoryStore.categoryMarkups.map(c => c.category));

// Product Modal Handlers
function handleOpenAddProduct() {
  activeProductForEdit.value = null;
  showProductModal.value = true;
}

function handleOpenEditProduct(prod: Product) {
  activeProductForEdit.value = { ...prod };
  showProductModal.value = true;
}

function handleSaveProduct(prodData: Omit<Product, 'id'> | Product) {
  if ('id' in prodData && prodData.id) {
    inventoryStore.updateProduct(prodData as Product);
  } else {
    inventoryStore.addProduct(prodData);
  }
}

// Buyer Modal Handlers
function handleOpenAddBuyer(type: CustomerType = 'B2B') {
  activeBuyerForEdit.value = null;
  defaultCustomerTypeForModal.value = type;
  showBuyerModal.value = true;
}

function handleOpenEditBuyer(buyer: Buyer) {
  activeBuyerForEdit.value = { ...buyer };
  defaultCustomerTypeForModal.value = buyer.customerType || 'B2B';
  showBuyerModal.value = true;
}

function handleSaveBuyer(buyerData: Omit<Buyer, 'id'> | Buyer) {
  if ('id' in buyerData && buyerData.id) {
    buyerStore.updateBuyer(buyerData as Buyer);
  } else {
    buyerStore.addBuyer(
      buyerData.name,
      buyerData.code,
      buyerData.phone,
      buyerData.address,
      buyerData.customerType || 'B2B',
      buyerData.memberCardNo,
      buyerData.tier,
      buyerData.points
    );
  }
}

// Vendor Modal Handlers
function handleSaveVendor(data: { name: string; defaultMarkup: number; description: string }) {
  inventoryStore.addCategory(data.name, data.defaultMarkup, data.description);
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Top Header -->
    <header class="p-3 bg-white border-b border-[#dedbd6] flex items-center justify-between shadow-xs">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
          <Settings :size="18" />
        </div>
        <div>
          <h2 class="font-bold text-sm text-gray-900 leading-tight">
            Master Data & Pengaturan Toko (White-Label Ready)
          </h2>
          <p class="text-[11px] text-gray-500">
            Kelola katalog SKU barang, vendor supplier, pembeli grosir B2B, pelanggan eceran B2C, dan profil usaha.
          </p>
        </div>
      </div>

      <!-- Navigation Sub-Tabs -->
      <nav class="flex bg-gray-100 p-0.5 rounded border border-gray-300">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all"
          :class="activeMasterTab === 'sku' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-black'"
          @click="activeMasterTab = 'sku'"
        >
          <Package :size="13" />
          <span>Katalog SKU ({{ inventoryStore.products.length }})</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all"
          :class="activeMasterTab === 'vendors' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-black'"
          @click="activeMasterTab = 'vendors'"
        >
          <Percent :size="13" />
          <span>Vendor & Markup ({{ inventoryStore.categoryMarkups.length }})</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all"
          :class="activeMasterTab === 'buyers' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-black'"
          @click="activeMasterTab = 'buyers'"
        >
          <Users :size="13" />
          <span>Pelanggan / Buyer ({{ buyerStore.buyers.length }})</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all"
          :class="activeMasterTab === 'branding' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-black'"
          @click="activeMasterTab = 'branding'"
        >
          <Store :size="13" />
          <span>Profil Toko & Branding</span>
        </button>
      </nav>
    </header>

    <!-- Body Scrollable Content -->
    <main class="flex-1 overflow-y-auto p-3">
      <!-- 1. TAB SKU BARANG -->
      <MasterSkuTab
        v-if="activeMasterTab === 'sku'"
        @add-product="handleOpenAddProduct"
        @edit-product="handleOpenEditProduct"
      />

      <!-- 2. TAB VENDOR & MARKUP -->
      <MasterVendorTab
        v-if="activeMasterTab === 'vendors'"
        @add-vendor="showVendorModal = true"
      />

      <!-- 3. TAB PELANGGAN / BUYER (PEMBELI B2B & ECERAN B2C DENGAN FILTER TAB) -->
      <MasterBuyerTab
        v-if="activeMasterTab === 'buyers'"
        @add-buyer="(type) => handleOpenAddBuyer(type || 'B2B')"
        @edit-buyer="handleOpenEditBuyer"
      />

      <!-- 4. TAB PROFIL TOKO & WHITE-LABEL BRANDING -->
      <MasterBrandingTab
        v-if="activeMasterTab === 'branding'"
      />
    </main>

    <!-- Reusable DRY Modals -->
    <ProductFormModal
      :is-open="showProductModal"
      :initial-data="activeProductForEdit"
      :categories="categories"
      @close="showProductModal = false"
      @save="handleSaveProduct"
    />

    <BuyerFormModal
      :is-open="showBuyerModal"
      :initial-data="activeBuyerForEdit"
      :default-customer-type="defaultCustomerTypeForModal"
      @close="showBuyerModal = false"
      @save="handleSaveBuyer"
    />

    <VendorFormModal
      :is-open="showVendorModal"
      @close="showVendorModal = false"
      @save="handleSaveVendor"
    />
  </div>
</template>
