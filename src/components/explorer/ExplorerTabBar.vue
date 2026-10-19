<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { useDiscountStore } from '../../stores/discountStore';
import type { ModuleTab } from './AppLauncherTab.vue';
import {
  Plus,
  X,
  ShoppingCart,
  Truck,
  Calendar,
  BookOpen,
  Tag,
  CreditCard,
  Package,
  Percent,
  Users,
  Store,
  LayoutGrid
} from 'lucide-vue-next';

const props = defineProps<{
  openTabIds: ModuleTab[];
  activeTab: ModuleTab;
}>();

const emit = defineEmits<{
  (e: 'select-tab', tabId: ModuleTab): void;
  (e: 'close-tab', tabId: ModuleTab, event: MouseEvent): void;
  (e: 'open-launcher'): void;
}>();

const posStore = usePosStore();
const inventoryStore = useInventoryStore();
const buyerStore = useBuyerStore();
const ledgerStore = useLedgerStore();
const purchaseStore = usePurchaseStore();
const preOrderStore = usePreOrderStore();
const discountStore = useDiscountStore();

const tabBarRef = ref<HTMLDivElement | null>(null);
const measurerRef = ref<HTMLDivElement | null>(null);
const isCrowded = ref(false);
let resizeObserver: ResizeObserver | null = null;

function hasBadge(tabId: ModuleTab): boolean {
  if (tabId === 'pos') return posStore.cartItems.length > 0;
  if (tabId === 'products' || tabId === 'master') return inventoryStore.products.length > 0;
  if (tabId === 'vendors') return inventoryStore.categoryMarkups.length > 0;
  if (tabId === 'buyers') return buyerStore.buyers.length > 0;
  if (tabId === 'ledger') return ledgerStore.totalReceivables > 0;
  if (tabId === 'receiving') return purchaseStore.receivingItems.length > 0 || purchaseStore.purchaseHistory.length > 0;
  if (tabId === 'preorder') return preOrderStore.schedules.length > 0;
  if (tabId === 'discounts') return discountStore.activeDiscounts.length > 0;
  if (tabId === 'loyalty') return buyerStore.memberBuyers.length > 0;
  return false;
}

function getBadgeText(tabId: ModuleTab): string {
  if (tabId === 'pos') return String(posStore.cartItems.length);
  if (tabId === 'products' || tabId === 'master') return String(inventoryStore.products.length);
  if (tabId === 'vendors') return String(inventoryStore.categoryMarkups.length);
  if (tabId === 'buyers') return String(buyerStore.buyers.length);
  if (tabId === 'ledger') return `${ledgerStore.transactions.filter(t => t.paymentStatus === 'TEMPO').length} tempo`;
  if (tabId === 'receiving') return String(purchaseStore.receivingItems.length > 0 ? purchaseStore.receivingItems.length : purchaseStore.purchaseHistory.length);
  if (tabId === 'preorder') return String(preOrderStore.schedules.length);
  if (tabId === 'discounts') return String(discountStore.activeDiscounts.length);
  if (tabId === 'loyalty') return String(buyerStore.memberBuyers.length);
  return '';
}

function updateFit() {
  if (!tabBarRef.value || !measurerRef.value) return;
  const availableWidth = tabBarRef.value.clientWidth;
  const neededWidth = measurerRef.value.getBoundingClientRect().width;
  // If exact needed width for all full titles exceeds available tab bar space, or 3 or more tabs open, switch to compact mode
  isCrowded.value = props.openTabIds.length >= 3 || neededWidth > (availableWidth - 10);
}

onMounted(() => {
  nextTick(() => {
    updateFit();
  });

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      updateFit();
    });
    if (tabBarRef.value) resizeObserver.observe(tabBarRef.value);
    if (measurerRef.value) resizeObserver.observe(measurerRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});

watch(
  () => [
    props.openTabIds,
    props.activeTab,
    posStore.selectedBuyer,
    posStore.cartItems.length,
    purchaseStore.receivingItems.length,
    preOrderStore.schedules.length,
    discountStore.activeDiscounts.length,
    buyerStore.memberBuyers.length
  ],
  () => {
    nextTick(updateFit);
  },
  { deep: true }
);

function handleWheel(e: WheelEvent) {
  if (tabBarRef.value && e.deltaY !== 0) {
    tabBarRef.value.scrollLeft += e.deltaY;
  }
}

function getTabShortTitle(tabId: ModuleTab): string {
  switch (tabId) {
    case 'pos':
      return 'Kasir';
    case 'discounts':
      return 'Diskon';
    case 'loyalty':
      return 'Member';
    case 'receiving':
      return 'Kulakan';
    case 'preorder':
      return 'Pesanan';
    case 'ledger':
      return 'Buku Kas';
    case 'products':
    case 'master':
      return 'Barang';
    case 'vendors':
      return 'Supplier';
    case 'buyers':
      return 'Pelanggan';
    case 'branding':
      return 'Profile';
    default:
      return tabId;
  }
}

function getTabFullTitle(tabId: ModuleTab): string {
  switch (tabId) {
    case 'pos':
      return `Kasir & Penjualan (${posStore.selectedBuyer})`;
    case 'discounts':
      return 'Diskon & Kupon Promo';
    case 'loyalty':
      return 'Member & Poin Belanja';
    case 'receiving':
      return 'Kulakan & Barang Masuk';
    case 'preorder':
      return 'Rekap Pesanan Mingguan';
    case 'ledger':
      return 'Buku Kas & Piutang';
    case 'products':
    case 'master':
      return 'Daftar Barang (SKU)';
    case 'vendors':
      return 'Supplier & Margin Untung';
    case 'buyers':
      return 'Data Pelanggan & Mitra';
    case 'branding':
      return 'Profil Toko & Struk';
    default:
      return tabId;
  }
}

function getTabDisplayTitle(tabId: ModuleTab): string {
  return isCrowded.value ? getTabShortTitle(tabId) : getTabFullTitle(tabId);
}
</script>

<template>
  <div
    ref="tabBarRef"
    class="explorer-tab-bar relative flex items-center px-1.5 pt-1 border-b gap-0.5 overflow-x-auto no-scrollbar select-none text-xs"
    @wheel="handleWheel"
  >
    <!-- Hidden Ruler: Measures exact real pixel width needed if all tabs use FULL titles -->
    <div
      ref="measurerRef"
      aria-hidden="true"
      class="invisible absolute -top-[9999px] left-0 flex items-center px-1.5 pt-1 gap-0.5 pointer-events-none select-none text-xs font-medium"
      style="width: max-content;"
    >
      <div class="p-1 shrink-0"><Plus :size="15" /></div>
      <div
        v-for="tabId in openTabIds"
        :key="'measurer-' + tabId"
        class="flex items-center gap-1.5 px-2.5 py-1 border-t border-l border-r shrink-0"
      >
        <span class="w-[13px] shrink-0"></span>
        <span class="whitespace-nowrap">{{ getTabFullTitle(tabId) }}</span>
        <span
          v-if="hasBadge(tabId)"
          class="rounded-full px-1 text-[9px] font-bold shrink-0 font-mono"
        >
          {{ getBadgeText(tabId) }}
        </span>
        <span class="w-[11px] p-0.5 ml-0.5 shrink-0"></span>
      </div>
      <div
        v-if="activeTab === 'launcher'"
        class="flex items-center gap-1.5 px-3 py-1 border-t border-l border-r text-xs shrink-0"
      >
        <span class="w-[13px] shrink-0"></span>
        <span class="whitespace-nowrap">Menu Baru</span>
        <span class="w-[11px] ml-1 shrink-0"></span>
      </div>
    </div>

    <!-- Add New Tab Button (+) -->
    <button
      type="button"
      class="p-1 hover:bg-black/10 rounded mb-1 cursor-pointer transition-colors shrink-0"
      style="color: var(--surface-text);"
      title="Buka Menu Baru / New Tab (+)"
      @click="emit('open-launcher')"
    >
      <Plus :size="15" />
    </button>

    <!-- Elastic Dynamic Open Tabs (Adaptive Chrome/Edge Style) -->
    <div
      v-for="tabId in openTabIds"
      :key="tabId"
      class="group relative flex items-center gap-1.5 py-1 rounded-t border-t border-l border-r cursor-pointer text-xs font-medium transition-all select-none"
      :class="[
        activeTab === tabId ? 'shadow-xs font-semibold z-10' : 'border-transparent hover:opacity-90',
        isCrowded
          ? 'flex-1 min-w-[95px] max-w-[170px] px-2'
          : 'flex-initial shrink-0 min-w-fit max-w-[340px] px-2.5'
      ]"
      :style="activeTab === tabId ? { backgroundColor: 'var(--surface-tab-active)', borderColor: 'var(--surface-tab-border)', color: 'var(--surface-text)' } : { backgroundColor: 'var(--surface-tab-inactive)', color: 'var(--surface-text-muted)' }"
      :title="getTabFullTitle(tabId)"
      @click="emit('select-tab', tabId)"
    >
      <!-- Icon per tab -->
      <ShoppingCart v-if="tabId === 'pos'" :size="13" class="text-blue-600 shrink-0" />
      <Tag v-else-if="tabId === 'discounts'" :size="13" class="text-rose-600 shrink-0" />
      <CreditCard v-else-if="tabId === 'loyalty'" :size="13" class="text-amber-600 shrink-0" />
      <Truck v-else-if="tabId === 'receiving'" :size="13" class="text-amber-600 shrink-0" />
      <Calendar v-else-if="tabId === 'preorder'" :size="13" class="text-emerald-600 shrink-0" />
      <BookOpen v-else-if="tabId === 'ledger'" :size="13" class="text-indigo-600 shrink-0" />
      <Package v-else-if="tabId === 'products' || tabId === 'master'" :size="13" class="text-purple-600 shrink-0" />
      <Percent v-else-if="tabId === 'vendors'" :size="13" class="text-emerald-600 shrink-0" />
      <Users v-else-if="tabId === 'buyers'" :size="13" class="text-indigo-600 shrink-0" />
      <Store v-else-if="tabId === 'branding'" :size="13" class="text-amber-600 shrink-0" />

      <!-- Title: Full name when roomy, short name when crowded, auto-truncated -->
      <span class="truncate flex-1">
        {{ getTabDisplayTitle(tabId) }}
      </span>

      <!-- Dynamic Badge per tab -->
      <span
        v-if="tabId === 'pos' && posStore.cartItems.length > 0"
        class="bg-blue-600 text-white rounded-full px-1 text-[9px] font-bold shrink-0 font-mono"
      >
        {{ posStore.cartItems.length }}
      </span>
      <span
        v-else-if="!isCrowded && (tabId === 'products' || tabId === 'master')"
        class="bg-purple-100 text-purple-800 rounded-full px-1 text-[9px] font-bold shrink-0 font-mono hidden sm:inline-block"
      >
        {{ inventoryStore.products.length }}
      </span>
      <span
        v-else-if="!isCrowded && tabId === 'vendors'"
        class="bg-emerald-100 text-emerald-800 rounded-full px-1 text-[9px] font-bold shrink-0 font-mono hidden sm:inline-block"
      >
        {{ inventoryStore.categoryMarkups.length }}
      </span>
      <span
        v-else-if="!isCrowded && tabId === 'buyers'"
        class="bg-indigo-100 text-indigo-800 rounded-full px-1 text-[9px] font-bold shrink-0 font-mono hidden sm:inline-block"
      >
        {{ buyerStore.buyers.length }}
      </span>
      <span
        v-else-if="tabId === 'ledger' && ledgerStore.totalReceivables > 0"
        class="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
        title="Ada Piutang/Tempo Aktif"
      ></span>

      <!-- Close Tab Button: Always visible on active, or on hover for background tabs -->
      <button
        type="button"
        class="rounded p-0.5 cursor-pointer transition-opacity shrink-0 ml-0.5"
        :class="activeTab === tabId ? 'opacity-60 hover:opacity-100 hover:bg-black/10' : 'opacity-0 group-hover:opacity-100 hover:bg-black/10'"
        style="color: var(--surface-text-muted);"
        :title="`Tutup Tab`"
        @click.stop="emit('close-tab', tabId, $event)"
      >
        <X :size="11" />
      </button>
    </div>

    <!-- New Tab / Launcher Tab indicator if active -->
    <div
      v-if="activeTab === 'launcher'"
      class="flex items-center gap-1.5 px-3 py-1 rounded-t border-t border-l border-r font-semibold text-xs shadow-xs shrink-0 select-none max-w-[150px]"
      style="background-color: var(--surface-tab-active); border-color: var(--surface-tab-border); color: var(--surface-text);"
    >
      <LayoutGrid :size="13" class="text-blue-600 shrink-0" />
      <span class="truncate">Menu Baru</span>
      <button
        type="button"
        class="hover:bg-black/10 rounded p-0.5 ml-1 cursor-pointer shrink-0"
        style="color: var(--surface-text-muted);"
        title="Tutup"
        @click="emit('select-tab', openTabIds[0] || 'pos')"
      >
        <X :size="11" />
      </button>
    </div>
  </div>
</template>
