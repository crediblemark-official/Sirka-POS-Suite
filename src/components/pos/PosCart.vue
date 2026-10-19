<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { Buyer } from '../../types';
import {
  Trash2,
  Plus,
  Minus,
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
  Percent
} from 'lucide-vue-next';

import { useBuyerStore } from '../../stores/buyerStore';
import { formatRupiah } from '../../utils/formatters';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import BuyerFormModal from '../master/BuyerFormModal.vue';
import MemberScanModal from './MemberScanModal.vue';
import PosPaymentModal from './PosPaymentModal.vue';
import PosVoucherModal from './PosVoucherModal.vue';

const emit = defineEmits<{
  (e: 'show-receipt'): void;
  (e: 'close'): void;
}>();

const posStore = usePosStore();
const buyerStore = useBuyerStore();

// Modal States
const showVoucherModal = ref(false);
const showPaymentModal = ref(false);
const showScanMemberModal = ref(false);

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

// BUG-019 FIX: Preset & custom markup transaksi (PRD baris 101)
const markupPresetOptions = [0, 15, 20, 25, 30] as const;
function handleApplyTransactionMarkup(percent: number) {
  posStore.applyTransactionMarkup(percent);
}

function handleCustomTransactionMarkup(event: Event) {
  const raw = (event.target as HTMLInputElement).value.replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(raw);
  if (!isNaN(num) && num >= 0) {
    posStore.applyTransactionMarkup(Number(num.toFixed(1)));
  } else {
    posStore.applyTransactionMarkup(0);
    (event.target as HTMLInputElement).value = '';
  }
}

function parseRupiahInput(event: Event): number {
  return Number((event.target as HTMLInputElement).value.replace(/\D/g, '')) || 0;
}

function parseMarkupInput(event: Event): number {
  const raw = (event.target as HTMLInputElement).value.replace(/[^0-9.,]/g, '').replace(',', '.');
  const num = parseFloat(raw);
  return isNaN(num) ? 0 : Math.max(0, num);
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
  // F12: Bayar & Cetak Nota -> Buka Modal Pembayaran
  if (e.key === 'F12') {
    e.preventDefault();
    handleOpenPaymentModal();
    return;
  }

  // F3: Scan Kartu Member
  if (e.key === 'F3') {
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
  <div class="flex flex-col h-full text-xs select-none" style="background-color: var(--surface-body); color: var(--surface-text);">
    <!-- Top Buyer & Date Header Bar -->
    <div class="p-2.5 border-b flex flex-col gap-2" style="background-color: var(--surface-ribbon); border-color: var(--surface-ribbon-border);">
      <!-- Top Title & Close Button -->
      <div class="flex items-center justify-between pb-0.5">
        <div class="flex items-center gap-1.5 font-bold text-xs" style="color: var(--surface-text);">
          <ShoppingCart :size="14" class="text-amber-600" />
          <span>Struk & Keranjang Kasir</span>
          <span class="px-1.5 py-0.2 rounded-full font-mono text-[10px] font-bold" style="background-color: var(--surface-tab-bar);">
            {{ posStore.cartItems.length }}
          </span>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-gray-700 hover:bg-black/10 rounded cursor-pointer transition-colors"
          title="Tutup Keranjang Kasir (F3)"
          @click="emit('close')"
        >
          <X :size="14" />
        </button>
      </div>

      <!-- Mode Switcher: B2B Grosir vs B2C Eceran -->
      <div class="flex items-center p-0.5 rounded border shadow-inner" style="background-color: var(--surface-tab-bar); border-color: var(--surface-tab-border);">
        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-bold cursor-pointer transition-all"
          :class="posStore.saleMode === 'B2B' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
          title="Mode Grosir / B2B (Tekan Alt+G)"
          @click="posStore.setSaleMode('B2B')"
        >
          <Building :size="13" />
          <span>🏢 Grosir (B2B)</span>
          <kbd class="px-1 py-0.2 bg-black/5 rounded text-[9px] font-mono opacity-60">Alt+G</kbd>
        </button>
        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-bold cursor-pointer transition-all"
          :class="posStore.saleMode === 'B2C' ? 'bg-white text-teal-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
          title="Mode Eceran / Retail (Tekan Alt+E)"
          @click="posStore.setSaleMode('B2C')"
        >
          <ShoppingBag :size="13" />
          <span>🛒 Eceran (B2C)</span>
          <kbd class="px-1 py-0.2 bg-black/5 rounded text-[9px] font-mono opacity-60">Alt+E</kbd>
        </button>
      </div>

      <!-- Buyer Selection Bar (Search and Select + Fast Keyboard Shortcuts) -->
      <div class="flex flex-col gap-2 bg-white p-2.5 rounded border border-[#dedbd6] shadow-2xs">
        <div class="flex items-center justify-between gap-1">
          <div class="flex items-center gap-1.5 font-bold text-[10.5px] text-gray-700 uppercase tracking-wider">
            <Building v-if="posStore.saleMode === 'B2B'" :size="12" class="text-indigo-600" />
            <ShoppingBag v-else :size="12" class="text-teal-600" />
            <span>{{ posStore.saleMode === 'B2B' ? 'Pembeli Grosir / B2B' : 'Pembeli / Pelanggan Eceran' }}</span>
          </div>

          <!-- Tombol Aksi Scan Kartu Member F3 -->
          <button
            type="button"
            class="flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10.5px] cursor-pointer shadow-xs transition-all active:scale-95"
            title="Scan Barcode / QR / Nomor Kartu Member (Tekan F3)"
            @click="showScanMemberModal = true"
          >
            <QrCode :size="12" />
            <span>Scan Member (F3)</span>
          </button>
        </div>

        <!-- Search & Select Combobox with Auto-Create on Enter -->
        <SearchableSelect
          ref="buyerSelectRef"
          v-model="posStore.selectedBuyer"
          :options="buyerOptions"
          :placeholder="posStore.saleMode === 'B2B' ? 'Cari / Pilih Pembeli...' : 'Cari / Pilih Pelanggan...'"
          :search-placeholder="posStore.saleMode === 'B2B' ? 'Ketik nama pembeli atau kode...' : 'Ketik nama / no. telepon...'"
          hotkey="F4"
          allow-create
          @create="handleOpenCreateBuyerModal"
        >
          <template #icon>
            <Building v-if="posStore.saleMode === 'B2B'" :size="13" class="text-indigo-600 shrink-0" />
            <ShoppingBag v-else :size="13" class="text-teal-600 shrink-0" />
          </template>
        </SearchableSelect>

        <!-- Member Information Compact Pill (Aktif Hanya Jika Kartu Di-scan) -->
        <div
          v-if="posStore.isMember"
          class="mt-1 px-2.5 py-1.5 bg-amber-50/90 border border-amber-300 rounded flex items-center justify-between text-[11px] animate-in fade-in duration-150"
        >
          <div class="flex items-center gap-1.5 font-bold text-amber-950 truncate">
            <CreditCard :size="12" class="text-amber-600 shrink-0" />
            <span class="font-mono text-[10.5px]">{{ posStore.selectedBuyerData?.memberCardNo }}</span>
            <span
              class="px-1.5 py-0.2 rounded text-[8.5px] uppercase font-black tracking-wider"
              :class="{
                'bg-slate-200 text-slate-800': posStore.memberTier === 'REGULAR',
                'bg-slate-300 text-slate-900 border border-slate-400': posStore.memberTier === 'SILVER',
                'bg-amber-400 text-amber-950 shadow-2xs': posStore.memberTier === 'GOLD',
                'bg-purple-900 text-purple-100': posStore.memberTier === 'PLATINUM'
              }"
            >
              {{ posStore.memberTier }}
            </span>
            <span class="text-amber-800 font-mono font-semibold">({{ posStore.memberPoints }} Poin)</span>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <!-- Tukar Poin Quick Action -->
            <button
              v-if="posStore.memberPoints > 0 && posStore.cartItems.length > 0"
              type="button"
              class="px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
              :class="posStore.pointsToRedeem > 0 ? 'bg-amber-600 text-white shadow-2xs' : 'bg-white text-amber-800 hover:bg-amber-100 border border-amber-300'"
              @click="toggleRedeemPoints"
            >
              <Coins :size="11" />
              <span>{{ posStore.pointsToRedeem > 0 ? `Batal (${posStore.pointsToRedeem} P)` : 'Tukar Poin' }}</span>
            </button>

            <!-- Lepas / Batal Member Button -->
            <button
              type="button"
              class="p-0.5 text-gray-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
              title="Lepas Kartu Member (Batal Member untuk Transaksi Ini)"
              @click="unlinkMember"
            >
              <X :size="13" />
            </button>
          </div>
        </div>

        <!-- Indikator Kartu Belum Di-scan -->
        <div
          v-else-if="posStore.selectedBuyerData?.memberCardNo && !posStore.isMember"
          class="mt-1 px-2.5 py-1 bg-slate-50 border border-dashed border-slate-300 rounded flex items-center justify-between text-[10.5px] text-slate-500 animate-in fade-in duration-100"
        >
          <div class="flex items-center gap-1.5 truncate">
            <CreditCard :size="12" class="text-slate-400 shrink-0" />
            <span>Member: <strong class="font-mono text-slate-700">{{ posStore.selectedBuyerData.memberCardNo }}</strong></span>
          </div>
          <span class="text-[9.5px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded font-semibold shrink-0">
            Belum Scan
          </span>
        </div>

      </div>

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-blue-700 font-semibold">
          <Receipt :size="14" />
          <span>Struk Penjualan Kasir</span>
        </div>
        <input
          v-model="posStore.transactionDate"
          type="date"
          class="bg-white border border-gray-300 rounded px-2 py-0.5 text-xs font-mono text-gray-700 outline-none"
          title="Tanggal Transaksi"
        />
      </div>
    </div>

    <!-- Baris Kontrol Markup Dinamis (PRD baris 101) — BUG-019 FIX -->
    <div
      v-if="posStore.cartItems.length > 0"
      class="flex items-center flex-wrap gap-1.5 px-3 py-1.5 border-b bg-indigo-50/50"
      style="border-color: var(--surface-tab-border, #dedbd6);"
    >
      <span class="text-[10px] font-bold text-indigo-800 uppercase tracking-wider shrink-0">
        Markup Transaksi:
      </span>
      <button
        v-for="preset in markupPresetOptions"
        :key="preset"
        type="button"
        class="px-2 py-0.5 rounded border text-[10.5px] font-bold font-mono cursor-pointer transition-all"
        :class="posStore.transactionMarkupPercent === preset
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
          : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-100'"
        :title="`Terapkan markup ${preset}% ke semua baris (hapus override manual tetap dipertahankan)`"
        @click="handleApplyTransactionMarkup(preset)"
      >
        {{ preset === 0 ? '0%' : `+${preset}%` }}
      </button>
      <span class="text-[9.5px] text-gray-400 shrink-0">/</span>
      <input
        type="text"
        inputmode="decimal"
        placeholder="% bebas, mis. 12.5"
        class="w-24 h-5 px-1.5 text-[10.5px] border border-indigo-300 rounded bg-white font-mono focus:border-indigo-500 focus:outline-none"
        title="Markup custom dalam persen (bisa desimal), diterapkan ke semua baris non-manual"
        @change="handleCustomTransactionMarkup"
      />
      <span
        v-if="posStore.cartItems.some((it: any) => it.isManualSellPrice)"
        class="text-[9px] text-amber-700 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.2 font-semibold truncate"
        title="Baris dengan harga jual edit-manual tidak ikut diubah oleh preset markup"
      >
        ⚙ {{ posStore.cartItems.filter((it: any) => it.isManualSellPrice).length }} baris di-override manual
      </span>
    </div>

    <!-- Items List Area (Clean Divider Lines, No Box Cards) -->
    <div class="flex-1 overflow-y-auto bg-white divide-y divide-[#dedbd6]">
      <!-- Empty Cart State -->
      <div v-if="posStore.cartItems.length === 0" class="h-full flex flex-col items-center justify-center text-center p-4 text-gray-400 gap-2">
        <div class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
          <ShoppingBag :size="24" />
        </div>
        <span class="font-semibold text-gray-600">Keranjang Kasir Masih Kosong</span>
        <span class="text-[11px] text-gray-400 max-w-[200px]">
          Pilih folder atau klik 2x barang di sebelah kiri untuk memasukkan ke struk.
        </span>
      </div>

      <!-- Item Rows -->
      <div
        v-for="item in posStore.cartItems"
        :key="item.id"
        class="flex items-center justify-between px-3 py-2 hover:bg-[#faf9f6] transition-colors gap-2"
      >
        <!-- Item Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-semibold text-gray-900 truncate" :title="item.name">{{ item.name }}</span>
            <span class="px-1 py-0.2 bg-amber-100 text-amber-800 rounded text-[9.5px] font-bold shrink-0">
              {{ item.unit }}
            </span>
            <span class="truncate text-[10px] text-gray-400">{{ item.category }}</span>
          </div>
          <!-- BUG-019 FIX: Inline editing Harga Beli / Markup / Harga Jual (PRD baris 101-102, Zero-Modal) -->
          <div class="flex items-center gap-1 mt-1 text-[10px]">
            <label class="flex items-center gap-0.5 font-mono" title="Harga Beli dari nota supplier (Aturan #3)">
              <span class="text-gray-400 text-[9px] font-sans">Beli</span>
              <input
                type="text"
                inputmode="numeric"
                placeholder="0"
                :value="item.buyPrice || ''"
                class="w-14 h-5 text-right font-mono text-gray-700 bg-gray-50 hover:bg-white focus:bg-white border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 rounded outline-none px-1"
                @change="(e: any) => posStore.updateItemBuyPrice(item.id, parseRupiahInput(e))"
              />
            </label>
            <label class="flex items-center gap-0.5 font-mono" title="% Markup baris ini — jual dihitung otomatis dari beli (Aturan #2)">
              <span class="text-gray-400 text-[9px] font-sans">%</span>
              <input
                type="text"
                inputmode="decimal"
                :value="item.markupPercent"
                class="w-9 h-5 text-center font-mono text-indigo-700 bg-indigo-50 hover:bg-white focus:bg-white border border-indigo-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400 rounded outline-none px-0.5"
                @change="(e: any) => posStore.updateItemMarkup(item.id, parseMarkupInput(e))"
              />
            </label>
            <label class="flex items-center gap-0.5 font-mono" title="Harga Jual per unit (Aturan #2 level 3)">
              <span class="text-gray-400 text-[9px] font-sans">Jual</span>
              <input
                type="text"
                inputmode="numeric"
                placeholder="0"
                :value="item.sellPrice || ''"
                class="w-14 h-5 text-right font-mono font-bold text-blue-700 bg-white hover:bg-blue-50 focus:bg-white border border-blue-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 rounded outline-none px-1"
                @change="(e: any) => posStore.updateItemSellPrice(item.id, parseRupiahInput(e))"
              />
            </label>
            <span
              v-if="item.isManualSellPrice"
              class="text-[8.5px] text-amber-700 bg-amber-100 border border-amber-300 rounded px-1 py-0 font-bold shrink-0"
              title="Harga jual diketik manual — tidak ikut preset markup transaksi"
            >
              edit
            </span>
          </div>
        </div>

        <!-- Simple Qty Input (No Bulky Pill, No Native Spin Arrow) -->
        <div class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            class="w-5 h-5 rounded text-gray-400 hover:text-black hover:bg-gray-200 flex items-center justify-center cursor-pointer transition-colors"
            title="Kurang 1"
            @click="posStore.updateItemQty(item.id, item.qty - 1)"
          >
            <Minus :size="11" />
          </button>
          <input
            type="text"
            inputmode="numeric"
            :value="item.qty"
            class="w-12 h-6 text-center font-mono font-bold text-xs bg-gray-50 hover:bg-white focus:bg-white border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-400 rounded outline-none transition-all"
            @input="(e: any) => {
              const val = Number(e.target.value.replace(/\D/g, '')) || 1;
              posStore.updateItemQty(item.id, val);
            }"
            @keydown.up.prevent="posStore.updateItemQty(item.id, item.qty + 1)"
            @keydown.down.prevent="posStore.updateItemQty(item.id, item.qty - 1)"
          />
          <button
            type="button"
            class="w-5 h-5 rounded text-gray-400 hover:text-black hover:bg-gray-200 flex items-center justify-center cursor-pointer transition-colors"
            title="Tambah 1"
            @click="posStore.updateItemQty(item.id, item.qty + 1)"
          >
            <Plus :size="11" />
          </button>
        </div>

        <!-- Subtotal & Trash -->
        <div class="flex items-center gap-2 text-right">
          <span class="font-bold font-mono text-gray-800 text-xs w-20">
            {{ formatRupiah(item.subtotalSell) }}
          </span>
          <button
            class="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
            title="Hapus item"
            @click="posStore.removeItem(item.id)"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Grand Total & Checkout Action -->
    <div class="p-3 bg-white border-t border-gray-300 shadow-md flex flex-col gap-2.5">
      <!-- Sleek Voucher & Kupon Promo Bar (Tidak Menumpuk) -->
      <div v-if="posStore.cartItems.length > 0">
        <!-- If coupon applied -->
        <div
          v-if="posStore.appliedDiscount"
          class="flex items-center justify-between px-2.5 py-1.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900"
        >
          <div class="flex items-center gap-1.5 font-bold truncate">
            <Tag :size="13" class="text-rose-600 shrink-0" />
            <span class="font-mono">{{ posStore.appliedDiscount.code }}</span>
            <span class="text-rose-700 font-semibold text-[11px] truncate">({{ posStore.appliedDiscount.name }})</span>
            <span class="font-mono text-emerald-800 text-[11px] shrink-0">• -Rp {{ formatRupiah(posStore.voucherDiscountAmount) }}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0 ml-1.5">
            <button
              type="button"
              class="text-[10px] text-blue-600 hover:underline cursor-pointer font-bold"
              @click="showVoucherModal = true"
            >
              Ganti
            </button>
            <button
              type="button"
              class="text-gray-400 hover:text-rose-600 cursor-pointer p-0.5 rounded transition-colors"
              title="Hapus Kupon"
              @click="handleRemoveCoupon"
            >
              <X :size="13" />
            </button>
          </div>
        </div>

        <!-- If NO coupon applied: clean compact trigger -->
        <div
          v-else
          class="flex items-center justify-between px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-xs transition-colors cursor-pointer"
          @click="showVoucherModal = true"
        >
          <span class="text-[11px] text-gray-600 flex items-center gap-1.5 font-medium">
            <Tag :size="12" class="text-rose-500" />
            <span>Kupon & Voucher Promo</span>
          </span>
          <span class="text-[10.5px] font-bold text-rose-600 flex items-center gap-0.5 hover:underline">
            <span>+ Gunakan Voucher</span>
          </span>
        </div>
        <!-- Diskon Manual Kasir (% atau Rp) -->
        <div class="flex items-center justify-between px-2.5 py-1 bg-gray-50 border border-gray-200 rounded text-xs mt-1.5">
          <span class="text-[11px] text-gray-600 flex items-center gap-1 font-medium">
            <Percent :size="11" class="text-indigo-500" />
            <span>Diskon Kasir:</span>
          </span>
          <div class="flex items-center gap-1.5 font-mono text-xs">
            <input
              type="text"
              placeholder="% Disc"
              :value="posStore.manualDiscountPercent || ''"
              class="w-12 h-5 text-center text-[11px] border border-gray-300 rounded bg-white font-mono focus:border-indigo-500 focus:outline-none"
              @change="(e: any) => {
                const p = Number(e.target.value.replace(/\D/g, '')) || 0;
                posStore.setManualDiscount(p, 0);
              }"
            />
            <span class="text-[10px] text-gray-400">atau</span>
            <input
              type="text"
              placeholder="Rp Disc"
              :value="posStore.manualDiscountNominal ? formatRupiah(posStore.manualDiscountNominal) : ''"
              class="w-20 h-5 text-right px-1 text-[11px] border border-gray-300 rounded bg-white font-mono focus:border-indigo-500 focus:outline-none"
              @change="(e: any) => {
                const rp = Number(e.target.value.replace(/\D/g, '')) || 0;
                posStore.setManualDiscount(0, rp);
              }"
            />
            <button
              v-if="posStore.manualDiscountAmount > 0"
              type="button"
              class="text-gray-400 hover:text-rose-600 cursor-pointer p-0.5"
              title="Reset diskon manual"
              @click="posStore.setManualDiscount(0, 0)"
            >
              <X :size="11" />
            </button>
          </div>
        </div>
      </div>

      <!-- Totals Breakdown -->
      <div class="space-y-1 text-xs">
        <!-- Subtotal if any discount or points active -->
        <div v-if="posStore.totalDiscountAmount > 0 || posStore.pointsDiscountAmount > 0" class="flex items-center justify-between text-gray-500 text-[11px]">
          <span>Subtotal Barang:</span>
          <span class="font-mono">Rp {{ formatRupiah(posStore.totalSell) }}</span>
        </div>

        <!-- Member tier discount -->
        <div v-if="posStore.memberTierDiscountAmount > 0" class="flex items-center justify-between text-amber-800 font-medium text-[11px]">
          <span class="flex items-center gap-1">
            <Sparkles :size="11" class="text-amber-500" />
            <span>Diskon Member ({{ posStore.memberTier }} {{ posStore.memberTierDiscountPercent }}%):</span>
          </span>
          <span class="font-mono font-bold">-Rp {{ formatRupiah(posStore.memberTierDiscountAmount) }}</span>
        </div>

        <!-- Voucher discount -->
        <div v-if="posStore.voucherDiscountAmount > 0" class="flex items-center justify-between text-rose-700 font-medium text-[11px]">
          <span class="flex items-center gap-1">
            <Tag :size="11" class="text-rose-500" />
            <span>Diskon Kupon ({{ posStore.appliedDiscount?.code }}):</span>
          </span>
          <span class="font-mono font-bold">-Rp {{ formatRupiah(posStore.voucherDiscountAmount) }}</span>
        </div>

        <!-- Manual discount row -->
        <div v-if="posStore.manualDiscountAmount > 0" class="flex items-center justify-between text-indigo-700 font-medium text-[11px]">
          <span class="flex items-center gap-1">
            <Percent :size="11" class="text-indigo-500" />
            <span>Diskon Manual Kasir{{ posStore.manualDiscountPercent > 0 ? ` (${posStore.manualDiscountPercent}%)` : '' }}:</span>
          </span>
          <span class="font-mono font-bold">-Rp {{ formatRupiah(posStore.manualDiscountAmount) }}</span>
        </div>

        <!-- Points discount -->
        <div v-if="posStore.pointsDiscountAmount > 0" class="flex items-center justify-between text-amber-700 font-medium text-[11px]">
          <span class="flex items-center gap-1">
            <Coins :size="11" class="text-amber-500" />
            <span>Potongan Poin ({{ posStore.pointsToRedeem }} Poin):</span>
          </span>
          <span class="font-mono font-bold">-Rp {{ formatRupiah(posStore.pointsDiscountAmount) }}</span>
        </div>

        <!-- Grand Total row -->
        <div class="flex items-center justify-between pt-1 border-t border-gray-200">
          <div>
            <span class="text-[11px] text-gray-500 block">Estimasi Margin Laba:</span>
            <span class="text-xs font-bold text-emerald-700 font-mono">
              +Rp {{ formatRupiah(posStore.totalProfit) }} ({{ posStore.profitPercent }}%)
            </span>
            <span v-if="posStore.isMember && posStore.pointsToEarn > 0" class="text-[10px] text-amber-700 block font-bold mt-0.5">
              🎁 +{{ posStore.pointsToEarn }} Poin Didapat
            </span>
          </div>
          <div class="text-right">
            <span class="text-[11px] text-gray-500 block uppercase font-bold tracking-wider">Total Tagihan:</span>
            <span class="text-lg font-black font-mono text-blue-700 leading-none">
              Rp {{ formatRupiah(posStore.finalTotal) }}
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="posStore.cartItems.length > 0"
          class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded font-semibold text-xs cursor-pointer border border-gray-300 transition-colors"
          title="Reset Keranjang"
          @click="posStore.clearCart"
        >
          Reset
        </button>

        <button
          class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="posStore.cartItems.length === 0"
          @click="handleOpenPaymentModal"
        >
          <Printer :size="16" />
          <span>BAYAR & CETAK NOTA (F12)</span>
        </button>
      </div>
    </div>

    <!-- Modal Konfirmasi Pembayaran & Metode (F12) -->
    <PosPaymentModal
      :is-open="showPaymentModal"
      @close="showPaymentModal = false"
      @confirm="handleConfirmPayment"
    />

    <!-- Modal Pilih & Masukkan Kupon Promo -->
    <PosVoucherModal
      :is-open="showVoucherModal"
      @close="showVoucherModal = false"
    />

    <!-- Modal Scan & Input Kartu Member (Komponen Terpisah) -->
    <MemberScanModal
      :is-open="showScanMemberModal"
      @close="showScanMemberModal = false"
      @select="handleSelectScannedMember"
    />

    <!-- Modal Tambah Buyer Langsung dari POS -->
    <BuyerFormModal
      :is-open="showBuyerModal"
      :initial-data="quickBuyerInitialData"
      :default-customer-type="posStore.saleMode"
      @close="showBuyerModal = false"
      @save="handleSaveNewBuyer"
    />
  </div>
</template>
