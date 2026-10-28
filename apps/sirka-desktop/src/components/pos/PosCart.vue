<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { Buyer, CartItem } from '../../types';
import {
  Printer,
  Receipt,
  Building,
  Tag,
  CreditCard,
  Sparkles,
  Coins,
  X,
  QrCode,
  ShoppingBag,
  ShoppingCart,
  Percent,
  Pencil,
  Clock,
  LogIn,
  AlertTriangle,
  UtensilsCrossed,
  Wrench
} from 'lucide-vue-next';

import { useBuyerStore } from '../../stores/buyerStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatRupiah } from '../../utils/formatters';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';

// Lazy-loaded Modals
const BuyerFormModal = defineAsyncComponent(() => import('../master/BuyerFormModal.vue'));
const MemberScanModal = defineAsyncComponent(() => import('./MemberScanModal.vue'));
const PosPaymentModal = defineAsyncComponent(() => import('./PosPaymentModal.vue'));
const PosVoucherModal = defineAsyncComponent(() => import('./PosVoucherModal.vue'));
const ItemPriceAdjustModal = defineAsyncComponent(() => import('./ItemPriceAdjustModal.vue'));
const TotalAdjustModal = defineAsyncComponent(() => import('./TotalAdjustModal.vue'));
const HeldCartsModal = defineAsyncComponent(() => import('./HeldCartsModal.vue'));
import PosCartItemRow from './PosCartItemRow.vue';
import { useModalLock } from '../../composables/useModalLock';

const emit = defineEmits<{
  (e: 'show-receipt'): void;
  (e: 'close'): void;
}>();

const posStore = usePosStore();
const settingsStore = useSettingsStore();
const { isAnyModalOpen } = useModalLock();
const buyerStore = useBuyerStore();
const inventoryStore = useInventoryStore();
const shiftStore = useShiftStore();

function getMasterPrice(productId: string): number {
  const prod = inventoryStore.products.find(p => p.id === productId);
  return prod?.lastSellPrice || 0;
}

function getProductUnits(productId: string) {
  const prod = inventoryStore.products.find(p => p.id === productId);
  return prod ? posStore.getAvailableUnitsForProduct(prod) : [];
}

// Modal States
const showVoucherModal = ref(false);
const showPaymentModal = ref(false);
const showScanMemberModal = ref(false);
const showTotalAdjustModal = ref(false);
const showHeldCartsModal = ref(false);

function handleHoldCart() {
  if (posStore.cartItems.length === 0) return;
  posStore.holdCurrentCart();
}

function toggleRedeemPoints() {
  if (posStore.pointsToRedeem > 0) {
    posStore.setPointsToRedeem(0);
  } else {
    posStore.setPointsToRedeem(posStore.maxRedeemablePoints);
  }
}

function handleRemoveCoupon() {
  posStore.removeDiscount();
}

function handleSelectScannedMember(buyer: Buyer) {
  if (buyer.customerType && buyer.customerType !== posStore.saleMode) {
    posStore.setSaleMode(buyer.customerType);
  }
  posStore.selectedBuyer = buyer.name;
  if (buyer.memberCardNo) {
    posStore.attachMemberCard(buyer.memberCardNo);
  }
  showScanMemberModal.value = false;
}

function unlinkMember() {
  posStore.detachMemberCard();
}

function handleOpenPaymentModal() {
  if (posStore.cartItems.length === 0) return;
  // Syarat Operasional: Shift Kasir wajib dibuka terlebih dahulu sebelum bayar
  if (!shiftStore.isShiftActive) {
    shiftStore.showOpenShiftModal = true;
    return;
  }
  showPaymentModal.value = true;
}

async function handleConfirmPayment() {
  try {
    const tx = await posStore.processCheckout();
    if (tx) {
      showPaymentModal.value = false;
      emit('show-receipt');
    }
  } catch (error) {
    alert(`Pembayaran gagal disimpan. Keranjang tetap tersedia. ${error}`);
  }
}

// Modal Edit Harga Per-Item (3 Cara: Harga Jual Langsung, Markup Rp, Markup %)
const showItemPriceModal = ref(false);
const selectedItemForPriceAdjust = ref<CartItem | null>(null);

function openPriceAdjustModal(item: CartItem) {
  selectedItemForPriceAdjust.value = item;
  showItemPriceModal.value = true;
}

function handleSaveItemPrice(payload: { itemId: string; sellPrice: number; markupPercent: number }) {
  posStore.updateItemSellPrice(payload.itemId, payload.sellPrice);
}

const buyerSelectRef = ref<InstanceType<typeof SearchableSelect> | null>(null);
const showBuyerModal = ref(false);
const quickBuyerInitialData = ref<Buyer | null>(null);

function handleOpenCreateBuyerModal(typedName: string) {
  quickBuyerInitialData.value = {
    id: '',
    name: typedName,
    customerType: posStore.saleMode
  };
  showBuyerModal.value = true;
}

async function handleSaveNewBuyer(buyerData: Omit<Buyer, 'id'> | Buyer) {
  const newBuyer = await buyerStore.addBuyer(
    buyerData.name,
    buyerData.code,
    buyerData.phone,
    buyerData.address,
    buyerData.customerType || posStore.saleMode,
    buyerData.memberCardNo,
    buyerData.tier,
    buyerData.points
  );
  if (newBuyer) {
    posStore.selectedBuyer = newBuyer.name;
  }
  showBuyerModal.value = false;
}

const currentBuyers = computed(() =>
  posStore.saleMode === 'B2B' ? buyerStore.b2bBuyers : buyerStore.b2cBuyers
);

const buyerOptions = computed<SelectOption[]>(() =>
  currentBuyers.value.map(b => {
    let sublabel = b.phone ? `Telp: ${b.phone}` : (b.address || undefined);
    if (b.memberCardNo) {
      sublabel = `💳 [${b.tier || 'REGULAR'}] ${b.points || 0} Poin • ${sublabel || ''}`;
    }
    return {
      value: b.name,
      label: b.name,
      code: b.code || (b.memberCardNo ? b.memberCardNo : undefined),
      sublabel,
      badge: b.memberCardNo ? `★ ${b.tier || 'MEMBER'}` : (b.customerType === 'B2C' ? 'Eceran' : 'B2B')
    };
  })
);

// Global POS Keyboard Shortcuts
function handleKeydown(e: KeyboardEvent) {
  // BUG FIX: shortcut global tidak boleh aktif ketika ada modal terbuka.
  // Sebelumnya F6 (parkir keranjang) bisa mengosongkan keranjang di tengah
  // proses pembayaran, dan Alt+G/Alt+E mengganti mode penjualan sehingga
  // transaksi yang sedang dikonfirmasi berubah buyer/tipe pelanggan.
  if (isAnyModalOpen.value) return;

  // F12: Bayar & Cetak Nota -> Buka Modal Pembayaran
  if (e.key === 'F12') {
    e.preventDefault();
    handleOpenPaymentModal();
    return;
  }

  // F7 / Alt+M: Scan Kartu Member (F3 untuk Search Bar Universal)
  if (e.key === 'F7' || (e.altKey && (e.key.toLowerCase() === 'm'))) {
    e.preventDefault();
    showScanMemberModal.value = true;
    return;
  }

  // F4: Focus Dropdown Buyer / Pelanggan
  if (e.key === 'F4') {
    e.preventDefault();
    buyerSelectRef.value?.open();
    return;
  }

  // Alt+G / Alt+B: Mode B2B (Grosir)
  if (e.altKey && (e.key.toLowerCase() === 'g' || e.key.toLowerCase() === 'b')) {
    e.preventDefault();
    posStore.setSaleMode('B2B');
    return;
  }

  // Alt+E / Alt+C: Mode B2C (Eceran)
  if (e.altKey && (e.key.toLowerCase() === 'e' || e.key.toLowerCase() === 'c')) {
    e.preventDefault();
    posStore.setSaleMode('B2C');
    return;
  }

  // F6: Parkir Keranjang / Tahan Antrean (Hold Cart)
  if (e.key === 'F6') {
    e.preventDefault();
    if (posStore.cartItems.length > 0) {
      handleHoldCart();
    } else if (posStore.heldCarts.length > 0) {
      showHeldCartsModal.value = true;
    }
    return;
  }

  // Alt+1 .. Alt+9: Pilihan cepat buyer (opsional)
  if (e.altKey && e.key >= '1' && e.key <= '9') {
    const idx = Number(e.key) - 1;
    if (idx < currentBuyers.value.length) {
      e.preventDefault();
      posStore.selectedBuyer = currentBuyers.value[idx].name;
      return;
    }
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
  <div class="flex flex-col h-full text-xs select-none"
    style="background-color: var(--surface-body); color: var(--surface-text);">
    <!-- Top Buyer & Date Header Bar -->
    <div class="p-2.5 border-b flex flex-col gap-2"
      style="background-color: var(--surface-ribbon); border-color: var(--surface-ribbon-border);">
      <!-- Top Title & Close Button -->
      <div class="flex items-center justify-between pb-0.5">
        <div class="flex items-center gap-1.5 font-bold text-xs" style="color: var(--surface-text);">
          <ShoppingCart :size="14" class="text-amber-600" />
          <span>Struk & Keranjang Kasir</span>
          <span class="px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold"
            style="background-color: var(--surface-tab-bar);">
            {{ posStore.cartItems.length }}
          </span>
        </div>
        <button type="button"
          class="p-1 text-gray-400 hover:text-gray-100 hover:bg-black/10 dark:hover:bg-white/10 rounded cursor-pointer transition-colors"
          title="Tutup Keranjang Kasir" @click="emit('close')">
          <X :size="14" />
        </button>
      </div>

      <!-- Mode Switcher: B2B Grosir vs B2C Eceran -->
      <div class="flex items-center p-0.5 rounded border shadow-inner"
        style="background-color: var(--surface-tab-bar); border-color: var(--surface-tab-border);">
        <button type="button"
          class="pos-mode-switch-btn flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-bold cursor-pointer transition-all"
          :class="posStore.saleMode === 'B2B' ? 'active bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
          title="Mode Grosir / B2B (Tekan Alt+G)" @click="posStore.setSaleMode('B2B')">
          <Building :size="13" />
          <span>🏢 Grosir (B2B)</span>
          <kbd class="px-1 py-0.2 bg-black/10 rounded text-[9px] font-mono opacity-70">Alt+G</kbd>
        </button>
        <button type="button"
          class="pos-mode-switch-btn flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-bold cursor-pointer transition-all"
          :class="posStore.saleMode === 'B2C' ? 'active bg-white text-teal-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
          title="Mode Eceran / Retail (Tekan Alt+E)" @click="posStore.setSaleMode('B2C')">
          <ShoppingBag :size="13" />
          <span>🛒 Eceran (B2C)</span>
          <kbd class="px-1 py-0.2 bg-black/10 rounded text-[9px] font-mono opacity-70">Alt+E</kbd>
        </button>
      </div>

      <!-- F&B Order Type & Table Bar (Muncul bila mode F&B / Universal aktif) -->
      <div v-if="settingsStore.businessFeatures.tableManagement"
        class="flex items-center gap-1.5 p-2 bg-amber-50/80 border border-amber-200 rounded-lg text-xs">
        <div class="flex items-center gap-1 shrink-0">
          <UtensilsCrossed :size="13" class="text-amber-700" />
          <span class="font-bold text-[10.5px] text-amber-950">Pesanan:</span>
        </div>
        <div class="flex items-center gap-1 flex-1">
          <button type="button" @click="posStore.orderType = 'DINE_IN'"
            class="px-2 py-0.5 rounded text-[10.5px] font-semibold cursor-pointer transition-all"
            :class="posStore.orderType === 'DINE_IN' ? 'bg-amber-600 text-white shadow-2xs font-bold' : 'bg-white text-slate-700 hover:bg-amber-100/70 border border-amber-200'">
            🍽 Meja
          </button>
          <button type="button" @click="posStore.orderType = 'TAKEAWAY'"
            class="px-2 py-0.5 rounded text-[10.5px] font-semibold cursor-pointer transition-all"
            :class="posStore.orderType === 'TAKEAWAY' ? 'bg-amber-600 text-white shadow-2xs font-bold' : 'bg-white text-slate-700 hover:bg-amber-100/70 border border-amber-200'">
            🥡 Bungkus
          </button>
          <button type="button" @click="posStore.orderType = 'DELIVERY'"
            class="px-2 py-0.5 rounded text-[10.5px] font-semibold cursor-pointer transition-all"
            :class="posStore.orderType === 'DELIVERY' ? 'bg-amber-600 text-white shadow-2xs font-bold' : 'bg-white text-slate-700 hover:bg-amber-100/70 border border-amber-200'">
            🛵 Antar
          </button>
        </div>
        <div v-if="posStore.orderType === 'DINE_IN'" class="flex items-center gap-1 shrink-0">
          <span class="text-[10px] text-amber-900 font-bold">No.</span>
          <input v-model="posStore.tableNo" type="text" placeholder="Meja 01"
            class="w-16 px-1.5 py-0.5 bg-white border border-amber-300 rounded text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-amber-500" />
        </div>
      </div>

      <!-- Service Staff & Service Status Bar (Muncul bila mode Jasa / Universal aktif) -->
      <div v-if="settingsStore.businessFeatures.serviceStaff"
        class="flex items-center justify-between gap-1.5 p-2 bg-indigo-50/80 border border-indigo-200 rounded-lg text-xs">
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <Wrench :size="13" class="text-indigo-700 shrink-0" />
          <span class="font-bold text-[10.5px] text-indigo-950 shrink-0">Staf/Teknisi:</span>
          <input v-model="posStore.staffName" type="text" placeholder="Nama teknisi / staf..."
            class="flex-1 min-w-[70px] px-1.5 py-0.5 bg-white border border-indigo-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500" />
        </div>
        <div v-if="settingsStore.businessFeatures.serviceStatus" class="flex items-center gap-1 shrink-0">
          <select v-model="posStore.serviceStatus"
            class="px-1.5 py-0.5 bg-white border border-indigo-300 rounded text-[10.5px] font-bold text-indigo-900 focus:outline-none">
            <option value="QUEUED">Antre</option>
            <option value="IN_PROGRESS">Proses</option>
            <option value="DONE">Selesai</option>
            <option value="COLLECTED">Diambil</option>
          </select>
        </div>
      </div>

      <!-- Buyer Selection Bar (Search and Select + Fast Keyboard Shortcuts) -->
      <div class="flex flex-col gap-2 bg-white p-2.5 rounded border border-[#dedbd6] shadow-2xs">
        <div class="flex items-center justify-between gap-1">
          <div class="flex items-center gap-1.5 font-bold text-[10.5px] text-slate-800 uppercase tracking-wider">
            <Building v-if="posStore.saleMode === 'B2B'" :size="12" class="text-indigo-600" />
            <ShoppingBag v-else :size="12" class="text-teal-600" />
            <span>{{ posStore.saleMode === 'B2B' ? 'Pembeli Grosir / B2B' : 'Pembeli / Pelanggan Eceran' }}</span>
          </div>

          <!-- Tombol Aksi Scan Kartu Member F7 -->
          <button type="button"
            class="flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10.5px] cursor-pointer shadow-xs transition-all active:scale-95"
            title="Scan Barcode / QR / Nomor Kartu Member (Tekan F7)" @click="showScanMemberModal = true">
            <QrCode :size="12" />
            <span>Scan Member (F7)</span>
          </button>
        </div>

        <!-- Search & Select Combobox with Auto-Create on Enter -->
        <SearchableSelect ref="buyerSelectRef" v-model="posStore.selectedBuyer" :options="buyerOptions"
          :placeholder="posStore.saleMode === 'B2B' ? 'Cari / Pilih Pembeli...' : 'Cari / Pilih Pelanggan...'"
          :search-placeholder="posStore.saleMode === 'B2B' ? 'Ketik nama pembeli atau kode...' : 'Ketik nama / no. telepon...'"
          hotkey="F4" allow-create @create="handleOpenCreateBuyerModal">
          <template #icon>
            <Building v-if="posStore.saleMode === 'B2B'" :size="13" class="text-indigo-600 shrink-0" />
            <ShoppingBag v-else :size="13" class="text-teal-600 shrink-0" />
          </template>
        </SearchableSelect>

        <!-- Member Information Compact Pill (Aktif Hanya Jika Kartu Di-scan) -->
        <div v-if="posStore.isMember"
          class="mt-1 px-2.5 py-1.5 bg-amber-50/90 border border-amber-300 rounded flex items-center justify-between text-[11px] animate-in fade-in duration-150">
          <div class="flex items-center gap-1.5 font-bold text-amber-950 truncate">
            <CreditCard :size="12" class="text-amber-600 shrink-0" />
            <span class="font-mono text-[10.5px]">{{ posStore.selectedBuyerData?.memberCardNo }}</span>
            <span class="px-1.5 py-0.2 rounded text-[8.5px] uppercase font-black tracking-wider" :class="{
              'bg-slate-200 text-slate-800': posStore.memberTier === 'REGULAR',
              'bg-slate-300 text-slate-900 border border-slate-400': posStore.memberTier === 'SILVER',
              'bg-amber-400 text-amber-950 shadow-2xs': posStore.memberTier === 'GOLD',
              'bg-purple-900 text-purple-100': posStore.memberTier === 'PLATINUM'
            }">
              {{ posStore.memberTier }}
            </span>
            <span class="text-amber-800 font-mono font-semibold">({{ posStore.memberPoints }} Poin)</span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <!-- Tukar Poin Quick Action -->
            <button v-if="posStore.memberPoints > 0 && posStore.cartItems.length > 0" type="button"
              class="px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
              :class="posStore.pointsToRedeem > 0 ? 'bg-amber-600 text-white shadow-2xs' : 'bg-white text-amber-800 hover:bg-amber-100 border border-amber-300'"
              @click="toggleRedeemPoints">
              <Coins :size="11" />
              <span>{{ posStore.pointsToRedeem > 0 ? `Batal (${posStore.pointsToRedeem} P)` : 'Tukar Poin' }}</span>
            </button>

            <!-- Lepas / Batal Member Button -->
            <button type="button"
              class="p-0.5 text-gray-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
              title="Lepas Kartu Member (Batal Member untuk Transaksi Ini)" @click="unlinkMember">
              <X :size="13" />
            </button>
          </div>
        </div>

        <!-- Indikator Kartu Belum Di-scan -->
        <div v-else-if="posStore.selectedBuyerData?.memberCardNo && !posStore.isMember"
          class="mt-1 px-2.5 py-1 bg-slate-50 border border-dashed border-slate-300 rounded flex items-center justify-between text-[10.5px] text-slate-500 animate-in fade-in duration-100">
          <div class="flex items-center gap-1.5 truncate">
            <CreditCard :size="12" class="text-slate-400 shrink-0" />
            <span>Member: <strong class="font-mono text-slate-700">{{ posStore.selectedBuyerData.memberCardNo
                }}</strong></span>
          </div>
          <span
            class="text-[9.5px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-semibold shrink-0">
            Belum Scan
          </span>
        </div>

      </div>

      <div class="flex items-center justify-between gap-1.5 pt-0.5">
        <!-- Judul Ringkas & Rapi (Satu baris, no-wrap) -->
        <div class="flex items-center gap-1.5 font-bold text-xs shrink-0 whitespace-nowrap"
          style="color: var(--surface-text, #1e293b);">
          <Receipt :size="14" class="text-amber-500 shrink-0" />
          <span>Struk Kasir</span>
        </div>

        <!-- Tombol Aksi Parkir & Tanggal -->
        <div class="flex items-center gap-1.5 shrink-0">
          <!-- Tombol Parkir / Hold Cart (F6) -->
          <button v-if="posStore.cartItems.length > 0" type="button"
            class="btn-parkir px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap transition-all"
            title="Tahan keranjang belanja saat ini untuk melayani pembeli lain (F6)" @click="handleHoldCart">
            <Clock :size="11" class="text-amber-700" />
            <span>Parkir (F6)</span>
          </button>

          <!-- Tombol / Badge Antrean Parkir jika ada keranjang yang ditahan -->
          <button v-if="posStore.heldCarts.length > 0" type="button"
            class="px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white shadow-2xs cursor-pointer whitespace-nowrap transition-all"
            title="Buka daftar antrean yang sedang diparkir" @click="showHeldCartsModal = true">
            <span>Parkir</span>
            <span
              class="w-3.5 h-3.5 rounded-full bg-white text-purple-900 text-[9.5px] flex items-center justify-center font-black">
              {{ posStore.heldCarts.length }}
            </span>
          </button>

          <!-- Input Tanggal Transaksi (Ukuran proporsional, tidak terpotong) -->
          <input v-model="posStore.transactionDate" type="date"
            class="w-[115px] bg-white border border-gray-300 rounded px-1.5 py-0.5 text-[11px] font-mono text-slate-900 outline-none focus:border-blue-500 shadow-2xs"
            title="Tanggal Transaksi" />
        </div>
      </div>
    </div>

    <!-- Items List Area (Clean Divider Lines, No Box Cards) -->
    <div class="flex-1 overflow-y-auto bg-white divide-y divide-[#dedbd6]">
      <!-- Empty Cart State -->
      <div v-if="posStore.cartItems.length === 0"
        class="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400 gap-2">
        <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
          <ShoppingBag :size="24" />
        </div>
        <span class="font-semibold text-gray-600">Keranjang Kasir Masih Kosong</span>
        <span class="text-[11px] text-gray-400 max-w-[200px]">
          Pilih folder atau klik 2x barang di sebelah kiri untuk memasukkan ke struk.
        </span>
      </div>

      <!-- Item Rows -->
      <PosCartItemRow v-for="item in posStore.cartItems" :key="item.id" :item="item"
        :master-price="getMasterPrice(item.productId)" :available-units="getProductUnits(item.productId)"
        @open-adjust-price="openPriceAdjustModal(item)" @remove="posStore.removeItem(item.id)"
        @change-unit="(u: string) => posStore.setItemUnit(item.id, u)"
        @update-qty="(q: number) => posStore.updateItemQty(item.id, q)" />
    </div>

    <!-- Bottom Grand Total & Checkout Action -->
    <div class="p-3 bg-white border-t border-gray-300 shadow-md flex flex-col gap-2.5">
      <!-- Sleek Voucher & Kupon Promo Bar (Tidak Menumpuk) -->
      <div v-if="posStore.cartItems.length > 0">
        <!-- If coupon applied -->
        <div v-if="posStore.appliedDiscount"
          class="flex items-center justify-between px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900">
          <div class="flex items-center gap-1.5 font-bold truncate">
            <Tag :size="13" class="text-rose-600 shrink-0" />
            <span class="font-mono">{{ posStore.appliedDiscount.code }}</span>
            <span class="text-rose-700 font-semibold text-[11px] truncate">({{ posStore.appliedDiscount.name }})</span>
            <span class="font-mono text-emerald-800 text-[11px] shrink-0">• -Rp {{
              formatRupiah(posStore.voucherDiscountAmount) }}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0 ml-1.5">
            <button type="button" class="text-[10px] text-blue-600 hover:underline cursor-pointer font-bold"
              @click="showVoucherModal = true">
              Ganti
            </button>
            <button type="button"
              class="text-gray-400 hover:text-rose-600 cursor-pointer p-0.5 rounded transition-colors"
              title="Hapus Kupon" @click="handleRemoveCoupon">
              <X :size="13" />
            </button>
          </div>
        </div>

        <!-- If NO coupon applied: clean compact trigger -->
        <div v-else
          class="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-xs transition-colors cursor-pointer"
          @click="showVoucherModal = true">
          <span class="text-[11px] text-gray-600 flex items-center gap-1.5 font-medium">
            <Tag :size="12" class="text-rose-500" />
            <span>Kupon & Voucher Promo</span>
          </span>
          <span class="text-[10.5px] font-bold text-rose-600 flex items-center gap-0.5 hover:underline">
            <span>+ Gunakan Voucher</span>
          </span>
        </div>
      </div>

      <!-- Totals Breakdown -->
      <div class="space-y-1 text-xs">
        <!-- Subtotal if any discount or points active -->
        <div v-if="posStore.totalDiscountAmount > 0 || posStore.pointsDiscountAmount > 0"
          class="flex items-center justify-between text-gray-500 text-[11px]">
          <span>Subtotal Barang:</span>
          <span class="font-mono">Rp {{ formatRupiah(posStore.totalSell) }}</span>
        </div>

        <!-- Member tier discount -->
        <div v-if="posStore.memberTierDiscountAmount > 0"
          class="flex items-center justify-between text-amber-800 font-medium text-[11px]">
          <span class="flex items-center gap-1">
            <Sparkles :size="11" class="text-amber-500" />
            <span>Diskon Member ({{ posStore.memberTier }} {{ posStore.memberTierDiscountPercent }}%):</span>
          </span>
          <span class="font-mono font-bold">-Rp {{ formatRupiah(posStore.memberTierDiscountAmount) }}</span>
        </div>

        <!-- Voucher discount -->
        <div v-if="posStore.voucherDiscountAmount > 0"
          class="flex items-center justify-between text-rose-700 font-medium text-[11px]">
          <span class="flex items-center gap-1">
            <Tag :size="11" class="text-rose-500" />
            <span>Diskon Kupon ({{ posStore.appliedDiscount?.code }}):</span>
          </span>
          <span class="font-mono font-bold">-Rp {{ formatRupiah(posStore.voucherDiscountAmount) }}</span>
        </div>

        <!-- Manual discount row -->
        <div v-if="posStore.manualDiscountAmount > 0"
          class="flex items-center justify-between text-indigo-700 font-medium text-[11px]">
          <span class="flex items-center gap-1">
            <Percent :size="11" class="text-indigo-500" />
            <span>Diskon Manual Kasir{{ posStore.manualDiscountPercent > 0 ? ` (${posStore.manualDiscountPercent}%)` :
              ''
              }}:</span>
          </span>
          <span class="font-mono font-bold">-Rp {{ formatRupiah(posStore.manualDiscountAmount) }}</span>
        </div>

        <!-- Points discount -->
        <div v-if="posStore.pointsDiscountAmount > 0"
          class="flex items-center justify-between text-amber-700 font-medium text-[11px]">
          <span class="flex items-center gap-1">
            <Coins :size="11" class="text-amber-500" />
            <span>Potongan Poin ({{ posStore.pointsToRedeem }} Poin):</span>
          </span>
          <span class="font-mono font-bold">-Rp {{ formatRupiah(posStore.pointsDiscountAmount) }}</span>
        </div>

        <!-- Grand Total row -->
        <div class="flex items-center justify-between pt-2 border-t border-gray-200">
          <div>
            <span class="text-[11px] text-gray-500 block">Estimasi Margin Laba:</span>
            <span class="text-xs font-bold text-emerald-700 font-mono">
              +Rp {{ formatRupiah(posStore.totalProfit) }} ({{ posStore.profitPercent }}%)
            </span>
            <span v-if="posStore.isMember && posStore.pointsToEarn > 0"
              class="text-[10px] text-amber-700 block font-bold mt-0.5">
              🎁 +{{ posStore.pointsToEarn }} Poin Didapat
            </span>
          </div>

          <div
            class="text-right cursor-pointer group/total py-1 px-2 rounded-lg hover:bg-black/5 transition-all select-none flex items-center justify-end gap-1.5"
            title="Klik angka total untuk negosiasi / pembulatan tagihan"
            @click="posStore.cartItems.length > 0 && (showTotalAdjustModal = true)">
            <!-- Cukup 2 harga: harga coret dan harga nego aktif -->
            <div v-if="posStore.manualDiscountAmount > 0" class="flex items-baseline justify-end gap-2">
              <span class="line-through text-gray-400 text-xs font-mono">
                Rp {{ formatRupiah(posStore.totalSell - posStore.voucherDiscountAmount -
                  posStore.memberTierDiscountAmount -
                posStore.pointsDiscountAmount) }}
              </span>
              <span class="text-xl font-black font-mono text-blue-700 leading-none">
                Rp {{ formatRupiah(posStore.finalTotal) }}
              </span>
            </div>
            <!-- Normal -->
            <div v-else class="text-xl font-black font-mono text-blue-700 leading-none group-hover/total:underline">
              Rp {{ formatRupiah(posStore.finalTotal) }}
            </div>

            <Pencil :size="12"
              class="text-gray-400 group-hover/total:text-blue-600 opacity-60 group-hover/total:opacity-100 transition-all shrink-0" />
          </div>
        </div>
      </div>

      <!-- Banner Wajib Buka Shift jika belum aktif -->
      <div v-if="!shiftStore.isShiftActive"
        class="mb-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 flex items-center justify-between gap-2 shadow-2xs cursor-pointer hover:bg-amber-100/90 transition-colors"
        @click="shiftStore.showOpenShiftModal = true" title="Klik untuk membuka shift kasir dan memasukkan modal awal">
        <div class="flex items-center gap-2 text-xs">
          <AlertTriangle :size="16" class="text-amber-600 shrink-0" />
          <div>
            <p class="font-bold leading-tight text-amber-900">Shift Kasir Belum Dibuka</p>
            <p class="text-[11px] text-amber-700 leading-tight">Buka Shift & Tambah Uang ke CashBox</p>
          </div>
        </div>
        <button type="button"
          class="px-2 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded shadow-xs shrink-0 flex items-center gap-1 cursor-pointer">
          <LogIn :size="12" />
          <span>Buka Shift</span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button v-if="posStore.cartItems.length > 0"
          class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded font-semibold text-xs cursor-pointer border border-gray-300 transition-colors"
          title="Reset Keranjang" @click="posStore.clearCart">
          Reset
        </button>

        <!-- Tombol Bayar: Jika shift belum buka, mengarahkan untuk Buka Shift -->
        <button v-if="!shiftStore.isShiftActive"
          class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded font-bold text-xs cursor-pointer shadow-sm transition-all"
          @click="shiftStore.showOpenShiftModal = true"
          title="Buka shift kasir terlebih dahulu untuk memproses transaksi (F12)">
          <LogIn :size="15" />
          <span>BUKA SHIFT DULU UNTUK BAYAR (F12)</span>
        </button>

        <button v-else
          class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 text-white rounded font-bold text-xs cursor-pointer shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:brightness-95"
          :style="{ backgroundColor: settingsStore.primaryColor }" :disabled="posStore.cartItems.length === 0"
          @click="handleOpenPaymentModal">
          <Printer :size="16" />
          <span>BAYAR & CETAK NOTA (F12)</span>
        </button>
      </div>
    </div>

    <!-- Modal Konfirmasi Pembayaran & Metode (F12) -->
    <PosPaymentModal :is-open="showPaymentModal" @close="showPaymentModal = false" @confirm="handleConfirmPayment" />

    <!-- Modal Pilih & Masukkan Kupon Promo -->
    <PosVoucherModal :is-open="showVoucherModal" @close="showVoucherModal = false" />

    <!-- Modal Scan & Input Kartu Member (Komponen Terpisah) -->
    <MemberScanModal :is-open="showScanMemberModal" @close="showScanMemberModal = false"
      @select="handleSelectScannedMember" />

    <!-- Modal Tambah Buyer Langsung dari POS -->
    <BuyerFormModal :is-open="showBuyerModal" :initial-data="quickBuyerInitialData"
      :default-customer-type="posStore.saleMode" @close="showBuyerModal = false" @save="handleSaveNewBuyer" />

    <!-- Modal 3 Cara Penyesuaian Harga Per-Item -->
    <ItemPriceAdjustModal :is-open="showItemPriceModal" :item="selectedItemForPriceAdjust"
      @close="showItemPriceModal = false" @save="handleSaveItemPrice" />

    <!-- Modal Negosiasi Total Tagihan Akhir -->
    <TotalAdjustModal :is-open="showTotalAdjustModal" @close="showTotalAdjustModal = false" />

    <!-- Modal Antrean Belanjaan yang Diparkir (F6) -->
    <HeldCartsModal :is-open="showHeldCartsModal" @close="showHeldCartsModal = false" />
  </div>
</template>
