<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  Search,
  X,
  ShoppingCart,
  Plus,
  Minus,
  Clock,
  ArrowRight,
  User,
  Coins,
  Package,
  CreditCard
} from 'lucide-vue-next';

import { usePosStore } from '../../stores/posStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatRupiah } from '../../utils/formatters';
import { getCategoryTheme } from '../../utils/categoryColor';
import type { Product, SupplierCategory, Transaction } from '../../types';

import PosPaymentModal from '../pos/PosPaymentModal.vue';
import ReceiptModal from '../pos/ReceiptModal.vue';
import HeldCartsModal from '../pos/HeldCartsModal.vue';
import OpenShiftModal from '../pos/OpenShiftModal.vue';
import CloseShiftModal from '../pos/CloseShiftModal.vue';
import CashInflowModal from '../pos/CashInflowModal.vue';

const posStore = usePosStore();
const inventoryStore = useInventoryStore();
const shiftStore = useShiftStore();
const settingsStore = useSettingsStore();

// Search & Category
const searchQuery = ref('');
const selectedCategory = ref<SupplierCategory | 'Semua'>('Semua');

// Modals
const showPaymentModal = ref(false);
const showReceiptModal = ref(false);
const activeReceiptTx = ref<Transaction | null>(null);
const showHeldCartsModal = ref(false);
const showCashInflowModal = ref(false);

// Category List
const categoryList = computed<(SupplierCategory | 'Semua')[]>(() => {
  const cats = new Set<SupplierCategory>();
  inventoryStore.products.forEach(p => {
    if (p.category) cats.add(p.category);
  });
  return ['Semua', ...Array.from(cats)];
});

// Filtered Products
const filteredProducts = computed(() => {
  let prods = inventoryStore.products;
  if (selectedCategory.value !== 'Semua') {
    prods = prods.filter(p => p.category === selectedCategory.value);
  }
  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    prods = prods.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }
  return prods;
});

// Cart helper
function getCartQty(productId: string): number {
  const item = posStore.cartItems.find(i => i.productId === productId);
  return item ? item.qty : 0;
}

function handleAddProduct(product: Product) {
  posStore.addProductToCart(product);
}

function handleOpenCheckout() {
  if (posStore.cartItems.length === 0) return;
  showPaymentModal.value = true;
}

async function handleConfirmPayment() {
  try {
    const tx = await posStore.processCheckout();
    if (tx) {
      showPaymentModal.value = false;
      activeReceiptTx.value = tx;
      showReceiptModal.value = true;
    }
  } catch (err) {
    alert(`Pembayaran gagal disimpan: ${err}`);
  }
}

function handleHoldOrder() {
  const note = prompt('Masukkan catatan antrean (No. Meja / Nama Pelanggan):', posStore.tableNo || posStore.selectedBuyer || '');
  if (note !== null) {
    posStore.holdCurrentCart(note);
  }
}
</script>

<template>
  <div class="w-full h-full flex flex-col bg-slate-100 text-slate-800 select-none overflow-hidden font-sans">
    <!-- 1. TABLET TOP BAR (Slim, Countertop POS Header) -->
    <header class="h-12 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 shadow-2xs">
      <!-- Kiri: Brand Toko & Mode Bisnis -->
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
          <span v-if="!settingsStore.hasCustomLogo">{{ settingsStore.storeAbbreviation }}</span>
          <img v-else :src="settingsStore.storeLogo" alt="Logo" class="w-full h-full object-contain rounded-lg p-0.5" />
        </div>
        <div>
          <div class="font-bold text-sm text-slate-900 leading-tight flex items-center gap-2">
            <span>{{ settingsStore.storeName }}</span>
            <span class="px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded text-[9.5px] uppercase tracking-wider">
              {{ settingsStore.currentBusinessConfig.title }}
            </span>
          </div>
          <div class="text-[10px] text-slate-500 font-medium">
            Kasir Tablet Stand Mode • v0.2.3
          </div>
        </div>
      </div>

      <!-- Kanan: Shift, Laci Kas, Antrean, Switcher Shell -->
      <div class="flex items-center gap-2">
        <!-- Antrean Pesanan / Held Carts -->
        <button
          type="button"
          @click="showHeldCartsModal = true"
          class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <Clock class="w-3.5 h-3.5 text-amber-600" />
          <span>Antrean</span>
          <span
            v-if="posStore.heldCarts.length > 0"
            class="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold"
          >
            {{ posStore.heldCarts.length }}
          </span>
        </button>

        <!-- Kelola Kas -->
        <button
          type="button"
          @click="showCashInflowModal = true"
          class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <Coins class="w-3.5 h-3.5 text-emerald-600" />
          <span>Kas Laci</span>
        </button>

        <!-- Status Shift -->
        <div class="flex items-center gap-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <span
            class="w-2.5 h-2.5 rounded-full"
            :class="shiftStore.isShiftActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"
          ></span>
          <span class="font-medium text-slate-700">
            {{ shiftStore.isShiftActive ? `Kasir: ${shiftStore.currentShift?.cashierName}` : 'Shift Tutup' }}
          </span>
          <span v-if="shiftStore.isShiftActive" class="font-mono text-emerald-700 font-bold pl-1 border-l border-slate-200">
            Rp {{ formatRupiah(shiftStore.currentShift?.expectedCash || 0) }}
          </span>
        </div>

        <!-- Buka/Tutup Shift Button -->
        <button
          v-if="!shiftStore.isShiftActive"
          @click="shiftStore.showOpenShiftModal = true"
          class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-xs transition cursor-pointer"
        >
          Buka Shift
        </button>
        <button
          v-else
          @click="shiftStore.showCloseShiftModal = true"
          class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs rounded-lg border border-slate-200 transition cursor-pointer"
        >
          Tutup Shift
        </button>

        <!-- Shell Mode Switcher Pill -->
        <div class="flex border border-slate-200 rounded-lg overflow-hidden text-[10.5px] font-bold">
          <button
            type="button"
            @click="settingsStore.setUiShellMode('desktop')"
            class="px-2 py-1 transition cursor-pointer"
            :class="settingsStore.uiShellMode === 'desktop' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'"
            title="Pindah ke Mode Desktop"
          >
            PC
          </button>
          <button
            type="button"
            @click="settingsStore.setUiShellMode('tablet')"
            class="px-2 py-1 transition cursor-pointer"
            :class="settingsStore.uiShellMode === 'tablet' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'"
            title="Mode Tablet Stand"
          >
            Tab
          </button>
          <button
            type="button"
            @click="settingsStore.setUiShellMode('mobile')"
            class="px-2 py-1 transition cursor-pointer"
            :class="settingsStore.uiShellMode === 'mobile' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'"
            title="Pindah ke Mode Smartphone"
          >
            HP
          </button>
        </div>
      </div>
    </header>

    <!-- 2. TABLET 2-PANE WORKSPACE -->
    <div class="flex-1 flex overflow-hidden">
      <!-- LEFT PANE: TOUCH CATALOG (60-65% LEBAR) -->
      <section class="flex-1 flex flex-col overflow-hidden bg-slate-100 border-r border-slate-200">
        <!-- Search Bar & Category Strip -->
        <div class="bg-white border-b border-slate-200 p-3 space-y-2 shrink-0">
          <!-- Search Input -->
          <div class="relative flex items-center">
            <Search class="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Cari cepat nama produk, barcode, atau SKU..."
              class="w-full pl-10 pr-9 py-2 bg-slate-50 focus:bg-white text-xs font-medium text-slate-800 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            />
            <button
              v-if="searchQuery"
              @click="searchQuery = ''"
              class="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Category Pills Strip -->
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            <button
              v-for="cat in categoryList"
              :key="cat"
              @click="selectedCategory = cat"
              class="px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0"
              :class="selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            >
              {{ cat }}
            </button>
          </div>
        </div>

        <!-- Product Cards Grid (3 Columns on Tablet) -->
        <div class="flex-1 overflow-y-auto p-3">
          <div v-if="filteredProducts.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 text-center">
            <Package class="w-12 h-12 mb-2 stroke-[1.5] text-slate-300" />
            <div class="font-bold text-sm text-slate-600">Tidak ada produk ditemukan</div>
            <div class="text-xs text-slate-400 mt-1">Coba kata kunci pencarian atau kategori lain</div>
          </div>

          <div v-else class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            <button
              v-for="prod in filteredProducts"
              :key="prod.id"
              type="button"
              @click="handleAddProduct(prod)"
              class="bg-white rounded-xl border border-slate-200 p-3 flex flex-col justify-between text-left shadow-2xs hover:border-blue-500 hover:shadow-xs active:scale-[0.98] transition cursor-pointer relative group min-h-[110px]"
              :class="{ 'ring-2 ring-blue-500/80 border-blue-500 bg-blue-50/20': getCartQty(prod.id) > 0 }"
            >
              <!-- Cart Qty Badge on Top Right -->
              <span
                v-if="getCartQty(prod.id) > 0"
                class="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-blue-600 text-white font-mono font-bold text-xs flex items-center justify-center shadow-md border-2 border-white"
              >
                {{ getCartQty(prod.id) }}
              </span>

              <!-- Category & Stock Pill -->
              <div>
                <div class="flex items-center justify-between gap-1 mb-1.5">
                  <span
                    class="text-[9px] font-bold px-1.5 py-0.2 rounded-xs uppercase tracking-wider"
                    :style="{
                      backgroundColor: getCategoryTheme(prod.category).badgeBg,
                      color: getCategoryTheme(prod.category).badgeText
                    }"
                  >
                    {{ prod.category || 'PRODUK' }}
                  </span>
                  <span
                    v-if="prod.productType !== 'SERVICE'"
                    class="text-[10px] font-mono font-bold"
                    :class="prod.stock <= 0 ? 'text-rose-600' : 'text-slate-500'"
                  >
                    Stok {{ prod.stock }}
                  </span>
                  <span v-else class="text-[10px] font-bold text-purple-600">
                    JASA
                  </span>
                </div>

                <div class="font-bold text-xs text-slate-900 line-clamp-2 leading-snug">
                  {{ prod.name }}
                </div>
                <div class="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                  {{ prod.code }}
                </div>
              </div>

              <!-- Price -->
              <div class="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                <div class="font-black font-mono text-xs text-blue-700">
                  Rp {{ formatRupiah(prod.lastSellPrice || 0) }}
                </div>
                <div class="w-6 h-6 rounded-md bg-slate-100 group-hover:bg-blue-600 group-hover:text-white text-slate-500 flex items-center justify-center transition">
                  <Plus class="w-3.5 h-3.5" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </section>

      <!-- RIGHT PANE: ORDER BILL & REGISTER (~38% LEBAR) -->
      <aside class="w-[380px] lg:w-[420px] bg-white flex flex-col shrink-0 border-l border-slate-200 shadow-lg">
        <!-- Order Header (F&B / Service / Buyer Selector) -->
        <div class="p-3 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2">
          <!-- F&B Order Type Pills -->
          <div v-if="settingsStore.isFnb" class="flex items-center justify-between gap-2">
            <div class="flex gap-1">
              <button
                v-for="ot in ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const"
                :key="ot"
                type="button"
                @click="posStore.orderType = ot"
                class="px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer"
                :class="posStore.orderType === ot ? 'bg-amber-600 text-white shadow-2xs' : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-50'"
              >
                {{ ot === 'DINE_IN' ? '🍽️ Makan Sini' : (ot === 'TAKEAWAY' ? '🥡 Bungkus' : '🛵 Antar') }}
              </button>
            </div>
            <input
              v-if="posStore.orderType === 'DINE_IN'"
              v-model="posStore.tableNo"
              type="text"
              placeholder="No. Meja"
              class="w-20 px-2 py-1 text-xs bg-white border border-amber-300 rounded font-bold text-center focus:border-amber-500 outline-none"
            />
          </div>

          <!-- Pelanggan / Member Pill -->
          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-1.5 text-slate-700 font-semibold truncate">
              <User class="w-3.5 h-3.5 text-slate-400" />
              <span class="truncate">{{ posStore.selectedBuyer || 'Pelanggan Umum' }}</span>
            </div>
            <div class="flex items-center gap-1">
              <button
                v-if="posStore.cartItems.length > 0"
                @click="handleHoldOrder"
                class="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 cursor-pointer"
              >
                Tahan Nota
              </button>
              <button
                v-if="posStore.cartItems.length > 0"
                @click="posStore.clearCart"
                class="text-[11px] font-bold text-rose-600 hover:text-rose-800 px-2 py-0.5 rounded hover:bg-rose-50 cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>

        <!-- Cart Items List (Scrollable) -->
        <div class="flex-1 overflow-y-auto divide-y divide-slate-100 p-3">
          <div v-if="posStore.cartItems.length === 0" class="h-full flex flex-col items-center justify-center text-slate-400 text-center p-6">
            <ShoppingCart class="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
            <div class="font-bold text-sm text-slate-600">Keranjang Masih Kosong</div>
            <div class="text-xs text-slate-400 mt-1">Ketuk produk di katalog untuk menambahkan ke nota</div>
          </div>

          <div
            v-for="item in posStore.cartItems"
            :key="item.id"
            class="py-2.5 flex items-center justify-between gap-2 group"
          >
            <div class="min-w-0 flex-1">
              <div class="font-bold text-xs text-slate-900 truncate">{{ item.name }}</div>
              <div class="text-[11px] text-slate-500 font-mono mt-0.5">
                Rp {{ formatRupiah(item.sellPrice) }} × {{ item.qty }} {{ item.unit }}
              </div>
            </div>

            <!-- Stepper -->
            <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                @click="posStore.updateItemQty(item.id, item.qty - 1)"
                class="w-6 h-6 rounded bg-white text-slate-700 hover:bg-slate-200 active:scale-95 flex items-center justify-center font-bold shadow-2xs transition cursor-pointer"
              >
                <Minus class="w-3 h-3" />
              </button>
              <span class="w-5 text-center font-bold font-mono text-xs">{{ item.qty }}</span>
              <button
                type="button"
                @click="posStore.updateItemQty(item.id, item.qty + 1)"
                class="w-6 h-6 rounded bg-blue-600 text-white hover:bg-blue-700 active:scale-95 flex items-center justify-center font-bold shadow-2xs transition cursor-pointer"
              >
                <Plus class="w-3 h-3" />
              </button>
            </div>

            <!-- Subtotal -->
            <div class="font-mono font-bold text-xs text-slate-900 text-right w-20 shrink-0">
              Rp {{ formatRupiah(item.subtotalSell) }}
            </div>
          </div>
        </div>

        <!-- Bill Calculation Summary -->
        <div class="border-t border-slate-200 bg-slate-50 p-4 space-y-2 shrink-0">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">Subtotal ({{ posStore.totalItemsCount }} item)</span>
            <span class="font-mono font-bold text-slate-800">Rp {{ formatRupiah(posStore.totalSell) }}</span>
          </div>

          <div v-if="posStore.totalDiscountAmount > 0" class="flex items-center justify-between text-xs text-rose-600">
            <span>Diskon Total</span>
            <span class="font-mono font-bold">- Rp {{ formatRupiah(posStore.totalDiscountAmount) }}</span>
          </div>

          <!-- Total Tagihan -->
          <div class="pt-2 border-t border-slate-200 flex items-baseline justify-between">
            <span class="font-bold text-sm text-slate-900">Total Tagihan</span>
            <span class="font-black font-mono text-xl text-blue-700">
              Rp {{ formatRupiah(posStore.finalTotal) }}
            </span>
          </div>

          <!-- GIANT GREEN ACTION BUTTON (Countertop Touch) -->
          <button
            type="button"
            @click="handleOpenCheckout"
            :disabled="posStore.cartItems.length === 0"
            class="w-full mt-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] text-white font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <CreditCard class="w-5 h-5" />
            <span>BAYAR (Rp {{ formatRupiah(posStore.finalTotal) }})</span>
            <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </aside>
    </div>

    <!-- Modals -->
    <PosPaymentModal
      :is-open="showPaymentModal"
      @close="showPaymentModal = false"
      @confirm="handleConfirmPayment"
    />

    <ReceiptModal
      v-if="showReceiptModal && activeReceiptTx"
      :transaction="activeReceiptTx"
      @close="showReceiptModal = false"
    />

    <HeldCartsModal
      :is-open="showHeldCartsModal"
      @close="showHeldCartsModal = false"
    />

    <OpenShiftModal
      :is-open="shiftStore.showOpenShiftModal"
      @close="shiftStore.showOpenShiftModal = false"
    />

    <CloseShiftModal
      :is-open="shiftStore.showCloseShiftModal"
      @close="shiftStore.showCloseShiftModal = false"
    />

    <CashInflowModal
      :is-open="showCashInflowModal"
      @close="showCashInflowModal = false"
    />
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
