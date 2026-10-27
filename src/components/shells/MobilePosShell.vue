<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  ShoppingCart,
  Search,
  X,
  Plus,
  Minus,
  Receipt,
  Package,
  Wallet,
  Settings,
  ChevronRight,
  ArrowRight
} from 'lucide-vue-next';

import { usePosStore } from '../../stores/posStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { formatRupiah, localTodayStr } from '../../utils/formatters';
import { getCategoryTheme } from '../../utils/categoryColor';
import type { Product, SupplierCategory, Transaction } from '../../types';

import ReceiptModal from '../pos/ReceiptModal.vue';
import OpenShiftModal from '../pos/OpenShiftModal.vue';
import CloseShiftModal from '../pos/CloseShiftModal.vue';
import PosPaymentModal from '../pos/PosPaymentModal.vue';
import CashInflowModal from '../pos/CashInflowModal.vue';

const posStore = usePosStore();
const inventoryStore = useInventoryStore();
const shiftStore = useShiftStore();
const settingsStore = useSettingsStore();
const ledgerStore = useLedgerStore();

// Tabs: 'pos' | 'history' | 'inventory' | 'cash' | 'settings'
const currentTab = ref<'pos' | 'history' | 'inventory' | 'cash' | 'settings'>('pos');

// POS Catalog State
const searchQuery = ref('');
const selectedCategory = ref<SupplierCategory | 'Semua'>('Semua');

// Bottom Sheet & Modals
const showCartSheet = ref(false);
const showPaymentModal = ref(false);
const showReceiptModal = ref(false);
const activeReceiptTx = ref<Transaction | null>(null);
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

// Today Transactions in Ledger
const todayStr = localTodayStr();
const todayTransactions = computed(() =>
  ledgerStore.transactions.filter(t => t.date === todayStr)
);

// Helper: Get cart qty for product
function getCartQty(productId: string): number {
  const item = posStore.cartItems.find(i => i.productId === productId);
  return item ? item.qty : 0;
}

// Add/Decrement to cart
function handleProductAdd(product: Product) {
  posStore.addProductToCart(product);
}

function handleProductDecrement(productId: string) {
  const item = posStore.cartItems.find(i => i.productId === productId);
  if (!item) return;
  if (item.qty <= 1) {
    posStore.removeItem(item.id);
  } else {
    posStore.updateItemQty(item.id, item.qty - 1);
  }
}

// Checkout Flow
function handleOpenCheckout() {
  if (posStore.cartItems.length === 0) return;
  showPaymentModal.value = true;
}

async function handleConfirmPayment() {
  try {
    const tx = await posStore.processCheckout();
    if (tx) {
      showPaymentModal.value = false;
      showCartSheet.value = false;
      activeReceiptTx.value = tx;
      showReceiptModal.value = true;
    }
  } catch (err) {
    alert(`Pembayaran gagal disimpan: ${err}`);
  }
}

function handleViewReceipt(tx: Transaction) {
  activeReceiptTx.value = tx;
  showReceiptModal.value = true;
}
</script>

<template>
  <div class="w-full h-full flex flex-col bg-slate-50 text-slate-800 select-none overflow-hidden font-sans">
    <!-- 1. MOBILE TOP HEADER -->
    <header class="bg-white border-b border-slate-200 px-4 pt-2.5 pb-2 shrink-0 shadow-2xs">
      <div class="flex items-center justify-between gap-2 mb-2">
        <!-- Brand & Business Mode -->
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
            <span v-if="!settingsStore.hasCustomLogo">{{ settingsStore.storeAbbreviation }}</span>
            <img v-else :src="settingsStore.storeLogo" alt="Logo" class="w-full h-full object-contain rounded-lg p-0.5" />
          </div>
          <div class="min-w-0">
            <div class="font-bold text-sm text-slate-900 leading-tight truncate">
              {{ settingsStore.storeName }}
            </div>
            <div class="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
              <span class="px-1.5 py-0.2 bg-blue-50 text-blue-700 font-bold rounded-xs uppercase tracking-wider text-[9px]">
                {{ settingsStore.currentBusinessConfig.title }}
              </span>
              <span>•</span>
              <span :class="shiftStore.isShiftActive ? 'text-emerald-600 font-bold' : 'text-amber-600'">
                {{ shiftStore.isShiftActive ? (shiftStore.currentShift?.cashierName || 'Kasir Aktif') : 'Shift Tutup' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Shift Button -->
        <div class="shrink-0 flex items-center gap-1.5">
          <button
            v-if="!shiftStore.isShiftActive"
            @click="shiftStore.showOpenShiftModal = true"
            class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-md shadow-2xs transition cursor-pointer"
          >
            Buka Shift
          </button>
          <button
            v-else
            @click="shiftStore.showCloseShiftModal = true"
            class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-md border border-slate-200 transition cursor-pointer"
          >
            Tutup Shift
          </button>
        </div>
      </div>

      <!-- Search Input (Only on POS or Inventory Tab) -->
      <div v-if="currentTab === 'pos' || currentTab === 'inventory'" class="relative flex items-center">
        <Search class="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="currentTab === 'pos' ? 'Cari nama barang, barcode, SKU...' : 'Cek stok barang...'"
          class="w-full pl-9 pr-8 py-2 bg-slate-100 focus:bg-white text-xs text-slate-800 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
        />
        <button
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
        >
          <X class="w-3.5 h-3.5" />
        </button>
      </div>
    </header>

    <!-- 2. MAIN VIEW BODY -->
    <main class="flex-1 overflow-hidden relative flex flex-col pb-14">
      <!-- TAB 1: KASIR (POS) -->
      <section v-show="currentTab === 'pos'" class="flex-1 flex flex-col overflow-hidden">
        <!-- Category Filter Pills -->
        <div class="bg-white border-b border-slate-200 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
          <button
            v-for="cat in categoryList"
            :key="cat"
            @click="selectedCategory = cat"
            class="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer shrink-0"
            :class="selectedCategory === cat
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          >
            {{ cat }}
          </button>
        </div>

        <!-- Product Grid Feed (2 Columns on Phone) -->
        <div class="flex-1 overflow-y-auto p-3">
          <div v-if="filteredProducts.length === 0" class="h-64 flex flex-col items-center justify-center text-slate-400 text-center px-4">
            <Package class="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
            <div class="font-bold text-sm text-slate-600">Tidak ada produk ditemukan</div>
            <div class="text-xs text-slate-400 mt-1">Coba kata kunci pencarian atau kategori lain</div>
          </div>

          <div v-else class="grid grid-cols-2 gap-2.5 pb-20">
            <div
              v-for="prod in filteredProducts"
              :key="prod.id"
              class="bg-white rounded-xl border border-slate-200 p-2.5 flex flex-col justify-between shadow-2xs active:border-blue-300 transition"
            >
              <!-- Info Atas -->
              <div>
                <div class="flex items-center justify-between gap-1 mb-1">
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
                    class="text-[9.5px] font-mono font-bold"
                    :class="prod.stock <= 0 ? 'text-rose-600' : 'text-slate-500'"
                  >
                    Stok {{ prod.stock }}
                  </span>
                  <span v-else class="text-[9.5px] font-bold text-purple-600">
                    JASA
                  </span>
                </div>

                <div class="font-bold text-xs text-slate-900 line-clamp-2 leading-snug">
                  {{ prod.name }}
                </div>
                <div class="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
                  SKU: {{ prod.code }}
                </div>
              </div>

              <!-- Harga & Stepper Tambah -->
              <div class="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                <div class="font-black font-mono text-xs text-blue-700">
                  Rp {{ formatRupiah(prod.lastSellPrice || 0) }}
                </div>

                <!-- Tombol Tambah / Stepper Langsung di Kartu -->
                <div v-if="getCartQty(prod.id) === 0">
                  <button
                    type="button"
                    @click="handleProductAdd(prod)"
                    class="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-90 text-white flex items-center justify-center font-bold shadow-2xs transition cursor-pointer"
                  >
                    <Plus class="w-4 h-4" />
                  </button>
                </div>
                <div v-else class="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg p-0.5">
                  <button
                    type="button"
                    @click="handleProductDecrement(prod.id)"
                    class="w-6 h-6 rounded-md bg-white text-blue-700 hover:bg-blue-100 active:scale-90 flex items-center justify-center font-bold transition cursor-pointer shadow-2xs"
                  >
                    <Minus class="w-3.5 h-3.5" />
                  </button>
                  <span class="w-4 text-center font-bold font-mono text-xs text-blue-800">
                    {{ getCartQty(prod.id) }}
                  </span>
                  <button
                    type="button"
                    @click="handleProductAdd(prod)"
                    class="w-6 h-6 rounded-md bg-blue-600 text-white hover:bg-blue-700 active:scale-90 flex items-center justify-center font-bold transition cursor-pointer shadow-2xs"
                  >
                    <Plus class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sticky Floating Cart Pill -->
        <div
          v-if="posStore.cartItems.length > 0"
          class="fixed bottom-16 inset-x-3 z-30 animate-in fade-in slide-from-bottom-2 duration-200"
        >
          <button
            type="button"
            @click="showCartSheet = true"
            class="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white shadow-xl rounded-xl px-4 py-3 flex items-center justify-between font-semibold transition cursor-pointer"
          >
            <div class="flex items-center gap-2.5">
              <div class="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                <ShoppingCart class="w-3.5 h-3.5" />
                <span>{{ posStore.totalItemsCount }}</span>
              </div>
              <div class="text-left">
                <div class="text-[10px] text-blue-100 font-medium leading-tight">Total Belanja</div>
                <div class="text-sm font-black font-mono">Rp {{ formatRupiah(posStore.finalTotal) }}</div>
              </div>
            </div>
            <div class="flex items-center gap-1 text-xs font-bold text-blue-100">
              <span>Lihat & Bayar</span>
              <ChevronRight class="w-4 h-4 text-white" />
            </div>
          </button>
        </div>
      </section>

      <!-- TAB 2: TRANSAKSI (RIWAYAT HARI INI) -->
      <section v-show="currentTab === 'history'" class="flex-1 flex flex-col overflow-y-auto p-3">
        <div class="flex items-center justify-between mb-3">
          <div class="font-bold text-sm text-slate-800">Riwayat Penjualan Hari Ini</div>
          <span class="text-xs font-mono font-bold text-slate-500">{{ todayTransactions.length }} Nota</span>
        </div>

        <div v-if="todayTransactions.length === 0" class="h-64 flex flex-col items-center justify-center text-slate-400 text-center">
          <Receipt class="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
          <div class="font-bold text-sm text-slate-600">Belum ada transaksi hari ini</div>
          <div class="text-xs text-slate-400 mt-1">Transaksi yang selesai akan tampil di sini</div>
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="tx in todayTransactions"
            :key="tx.id"
            @click="handleViewReceipt(tx)"
            class="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs hover:border-blue-400 transition cursor-pointer"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-xs text-slate-900 font-mono">{{ tx.invoiceNo }}</span>
                <span
                  class="text-[9px] font-bold px-1.5 py-0.2 rounded-xs"
                  :class="tx.paymentMethod === 'Tunai / Kas' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'"
                >
                  {{ tx.paymentMethod }}
                </span>
              </div>
              <div class="text-[11px] text-slate-500 mt-0.5 truncate">
                {{ tx.items.length }} Barang • {{ tx.buyer || 'Pelanggan Umum' }}
              </div>
            </div>

            <div class="text-right shrink-0">
              <div class="font-mono font-black text-sm text-slate-900">
                Rp {{ formatRupiah(tx.finalTotal || tx.totalSell) }}
              </div>
              <div class="text-[10px] text-blue-600 font-semibold flex items-center justify-end gap-0.5 mt-0.5">
                <span>Struk</span>
                <ChevronRight class="w-3 h-3" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 3: STOK & INVENTARIS CEPAT -->
      <section v-show="currentTab === 'inventory'" class="flex-1 flex flex-col overflow-y-auto p-3">
        <div class="flex items-center justify-between mb-3">
          <div class="font-bold text-sm text-slate-800">Cek Stok Produk</div>
          <span class="text-xs font-mono font-bold text-slate-500">{{ filteredProducts.length }} SKU</span>
        </div>

        <div class="space-y-2 pb-6">
          <div
            v-for="item in filteredProducts"
            :key="item.id"
            class="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between shadow-2xs"
          >
            <div class="min-w-0 pr-2">
              <div class="font-bold text-xs text-slate-900 truncate">{{ item.name }}</div>
              <div class="text-[10.5px] text-slate-500 font-mono mt-0.5">
                SKU: {{ item.code }} • {{ item.category }}
              </div>
              <div class="font-mono font-bold text-xs text-blue-700 mt-1">
                Rp {{ formatRupiah(item.lastSellPrice || 0) }}
              </div>
            </div>

            <div class="text-right shrink-0">
              <div
                class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold inline-block"
                :class="item.stock <= 5 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'"
              >
                Sisa {{ item.stock }} {{ item.unit }}
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- TAB 4: KAS & LACI (CASH) -->
      <section v-show="currentTab === 'cash'" class="flex-1 flex flex-col overflow-y-auto p-4 space-y-4">
        <!-- Status Laci Kas -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Status Laci Kasir</div>
          <div class="text-2xl font-black font-mono text-emerald-700">
            Rp {{ formatRupiah(shiftStore.currentShift?.expectedCash || 0) }}
          </div>
          <div class="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <span
              class="w-2 h-2 rounded-full"
              :class="shiftStore.isShiftActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"
            ></span>
            <span>{{ shiftStore.isShiftActive ? `Kasir: ${shiftStore.currentShift?.cashierName}` : 'Laci Belum Dibuka' }}</span>
          </div>

          <div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100">
            <button
              v-if="!shiftStore.isShiftActive"
              @click="shiftStore.showOpenShiftModal = true"
              class="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              Buka Shift
            </button>
            <button
              v-else
              @click="shiftStore.showCloseShiftModal = true"
              class="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition cursor-pointer"
            >
              Tutup Shift Kasir
            </button>
            <button
              @click="showCashInflowModal = true"
              class="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition cursor-pointer"
            >
              Uang Masuk / Keluar
            </button>
          </div>
        </div>

        <!-- Ringkasan Penjualan Shift Ini -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2.5">
          <div class="font-bold text-xs text-slate-800 uppercase tracking-wider">Ringkasan Hari Ini</div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-500">Omset Hari Ini</span>
            <span class="font-mono font-bold text-slate-900">Rp {{ formatRupiah(ledgerStore.totalRevenue) }}</span>
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="text-slate-500">Total Transaksi</span>
            <span class="font-mono font-bold text-slate-900">{{ todayTransactions.length }} Nota</span>
          </div>
        </div>
      </section>

      <!-- TAB 5: PENGATURAN (SETTINGS) -->
      <section v-show="currentTab === 'settings'" class="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 pb-8">
        <!-- Mode Usaha -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div class="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2">Pilih Mode Usaha</div>
          <div class="p-3 rounded-xl border-2 border-blue-600 bg-blue-50/50 text-left">
            <div class="font-bold text-xs text-blue-900">{{ settingsStore.currentBusinessConfig.title }}</div>
            <div class="text-[10.5px] text-blue-700 mt-0.5">{{ settingsStore.currentBusinessConfig.description }}</div>
          </div>
        </div>

        <!-- Switcher Shell (Pratinjau) -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <div class="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2">Tampilan Antarmuka</div>
          <div class="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              @click="settingsStore.setUiShellMode('desktop')"
              class="py-2 px-1 text-center font-bold text-[11px] rounded-lg border transition cursor-pointer"
              :class="settingsStore.uiShellMode === 'desktop' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'"
            >
              Desktop
            </button>
            <button
              type="button"
              @click="settingsStore.setUiShellMode('tablet')"
              class="py-2 px-1 text-center font-bold text-[11px] rounded-lg border transition cursor-pointer"
              :class="settingsStore.uiShellMode === 'tablet' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'"
            >
              Tablet Stand
            </button>
            <button
              type="button"
              @click="settingsStore.setUiShellMode('mobile')"
              class="py-2 px-1 text-center font-bold text-[11px] rounded-lg border transition cursor-pointer"
              :class="settingsStore.uiShellMode === 'mobile' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200'"
            >
              Smartphone
            </button>
          </div>
          <div class="mt-2 text-[10px] text-slate-400">
            Pilih mode manual atau biarkan sistem mendeteksi ukuran layar otomatis.
          </div>
        </div>

        <!-- Info Toko & Lisensi -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2 text-xs">
          <div class="font-bold text-xs text-slate-800 uppercase tracking-wider mb-1">Informasi Aplikasi</div>
          <div class="flex justify-between">
            <span class="text-slate-500">Toko</span>
            <span class="font-bold text-slate-800">{{ settingsStore.storeName }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Versi</span>
            <span class="font-mono text-slate-700">Sirka POS Suite v0.2.3</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Status Database</span>
            <span class="text-emerald-700 font-bold">SQLite Offline-First (Aktif)</span>
          </div>
        </div>
      </section>
    </main>

    <!-- 3. MOBILE BOTTOM SHEET CART & CHECKOUT -->
    <div
      v-if="showCartSheet"
      class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-150"
    >
      <div class="bg-white w-full max-h-[88vh] rounded-t-3xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
        <!-- Handle & Header -->
        <div class="px-4 pt-3 pb-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
              <ShoppingCart class="w-4 h-4" />
            </div>
            <div>
              <div class="font-bold text-sm text-slate-900">Keranjang Kasir</div>
              <div class="text-[11px] text-slate-500">{{ posStore.totalItemsCount }} item belanjaan</div>
            </div>
          </div>
          <button
            type="button"
            @click="showCartSheet = false"
            class="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-full bg-slate-200 hover:bg-slate-300 transition cursor-pointer"
          >
            ✕ Tutup
          </button>
        </div>

        <!-- F&B / Service Mode Options in Mobile Cart -->
        <div v-if="settingsStore.isFnb" class="px-4 py-2 bg-amber-50/70 border-b border-amber-200 flex items-center gap-2 text-xs">
          <span class="font-bold text-amber-900 shrink-0">Tipe:</span>
          <div class="flex gap-1">
            <button
              v-for="ot in ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const"
              :key="ot"
              type="button"
              @click="posStore.orderType = ot"
              class="px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer"
              :class="posStore.orderType === ot ? 'bg-amber-600 text-white' : 'bg-white text-amber-800 border border-amber-300'"
            >
              {{ ot === 'DINE_IN' ? 'Meja' : (ot === 'TAKEAWAY' ? 'Bungkus' : 'Antar') }}
            </button>
          </div>
          <input
            v-if="posStore.orderType === 'DINE_IN'"
            v-model="posStore.tableNo"
            type="text"
            placeholder="No. Meja"
            class="w-20 px-2 py-0.5 text-xs bg-white border border-amber-300 rounded font-bold text-center"
          />
        </div>

        <!-- Item List -->
        <div class="flex-1 overflow-y-auto divide-y divide-slate-100 p-4 space-y-2">
          <div
            v-for="item in posStore.cartItems"
            :key="item.id"
            class="flex items-center justify-between gap-2 py-1.5"
          >
            <div class="min-w-0 flex-1">
              <div class="font-bold text-xs text-slate-900 truncate">{{ item.name }}</div>
              <div class="text-[11px] text-slate-500 font-mono">
                Rp {{ formatRupiah(item.sellPrice) }} × {{ item.qty }} {{ item.unit }}
              </div>
            </div>

            <!-- Stepper -->
            <div class="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                @click="posStore.updateItemQty(item.id, item.qty - 1)"
                class="w-7 h-7 rounded-md bg-white text-slate-700 active:scale-95 flex items-center justify-center font-bold shadow-2xs"
              >
                <Minus class="w-3.5 h-3.5" />
              </button>
              <span class="w-5 text-center font-bold font-mono text-xs">{{ item.qty }}</span>
              <button
                type="button"
                @click="posStore.updateItemQty(item.id, item.qty + 1)"
                class="w-7 h-7 rounded-md bg-blue-600 text-white active:scale-95 flex items-center justify-center font-bold shadow-2xs"
              >
                <Plus class="w-3.5 h-3.5" />
              </button>
            </div>

            <div class="font-mono font-bold text-xs text-slate-900 text-right w-20 shrink-0">
              Rp {{ formatRupiah(item.subtotalSell) }}
            </div>
          </div>
        </div>

        <!-- Summary & Bayar Button -->
        <div class="border-t border-slate-200 bg-slate-50 p-4 space-y-3 shrink-0">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-500">Subtotal</span>
            <span class="font-mono font-bold text-slate-800">Rp {{ formatRupiah(posStore.totalSell) }}</span>
          </div>
          <div v-if="posStore.totalDiscountAmount > 0" class="flex items-center justify-between text-xs text-rose-600">
            <span>Diskon</span>
            <span class="font-mono font-bold">- Rp {{ formatRupiah(posStore.totalDiscountAmount) }}</span>
          </div>
          <div class="flex items-center justify-between text-sm pt-2 border-t border-slate-200">
            <span class="font-bold text-slate-900">Total Tagihan</span>
            <span class="font-black font-mono text-lg text-blue-700">
              Rp {{ formatRupiah(posStore.finalTotal) }}
            </span>
          </div>

          <!-- Tombol Bayar -->
          <button
            type="button"
            @click="handleOpenCheckout"
            class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <span>PROSES PEMBAYARAN</span>
            <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- 4. MOBILE BOTTOM NAVIGATION BAR -->
    <nav class="h-14 bg-white border-t border-slate-200 fixed bottom-0 inset-x-0 z-40 flex items-center justify-around px-2 shadow-lg">
      <button
        type="button"
        @click="currentTab = 'pos'"
        class="flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer"
        :class="currentTab === 'pos' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'"
      >
        <ShoppingCart class="w-5 h-5 mb-0.5" />
        <span class="text-[10px]">Kasir</span>
      </button>

      <button
        type="button"
        @click="currentTab = 'history'"
        class="flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer"
        :class="currentTab === 'history' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'"
      >
        <Receipt class="w-5 h-5 mb-0.5" />
        <span class="text-[10px]">Transaksi</span>
      </button>

      <button
        type="button"
        @click="currentTab = 'inventory'"
        class="flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer"
        :class="currentTab === 'inventory' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'"
      >
        <Package class="w-5 h-5 mb-0.5" />
        <span class="text-[10px]">Stok</span>
      </button>

      <button
        type="button"
        @click="currentTab = 'cash'"
        class="flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer"
        :class="currentTab === 'cash' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'"
      >
        <Wallet class="w-5 h-5 mb-0.5" />
        <span class="text-[10px]">Kas & Shift</span>
      </button>

      <button
        type="button"
        @click="currentTab = 'settings'"
        class="flex-1 flex flex-col items-center justify-center py-1 transition cursor-pointer"
        :class="currentTab === 'settings' ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'"
      >
        <Settings class="w-5 h-5 mb-0.5" />
        <span class="text-[10px]">Setelan</span>
      </button>
    </nav>

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
