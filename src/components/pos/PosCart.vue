<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePosStore } from '../../stores/posStore';
import { PaymentMethod, Buyer } from '../../types';
import {
  Trash2,
  Plus,
  Minus,
  Printer,
  ShoppingBag,
  CheckCircle2,
  Clock,
  Receipt,
  Building,
  Tag,
  CreditCard,
  Sparkles,
  Coins,
  X,
  QrCode
} from 'lucide-vue-next';

import { useBuyerStore } from '../../stores/buyerStore';
import { useDiscountStore } from '../../stores/discountStore';
import { formatRupiah } from '../../utils/formatters';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import BuyerFormModal from '../master/BuyerFormModal.vue';
import MemberScanModal from './MemberScanModal.vue';

const emit = defineEmits<{
  (e: 'show-receipt'): void;
}>();

const posStore = usePosStore();
const buyerStore = useBuyerStore();
const discountStore = useDiscountStore();

// Kupon & Diskon State
const couponInput = ref('');
const couponError = ref('');
const couponSuccess = ref('');
const showVoucherModal = ref(false);

function handleApplyCoupon() {
  couponError.value = '';
  couponSuccess.value = '';
  const code = couponInput.value.trim().toUpperCase();
  if (!code) return;
  const ok = posStore.applyDiscount(code);
  if (ok) {
    couponSuccess.value = `Kupon ${code} berhasil dipasang!`;
    couponInput.value = '';
    showVoucherModal.value = false;
    setTimeout(() => { couponSuccess.value = ''; }, 3000);
  } else {
    couponError.value = 'Kupon tidak berlaku atau S&K belanja belum terpenuhi.';
    setTimeout(() => { couponError.value = ''; }, 3500);
  }
}

function handleSelectVoucher(code: string) {
  couponInput.value = code;
  handleApplyCoupon();
}

function handleRemoveCoupon() {
  posStore.removeDiscount();
  couponError.value = '';
  couponSuccess.value = '';
}

// Tukar Poin State
function toggleRedeemPoints() {
  if (posStore.pointsToRedeem > 0) {
    posStore.setPointsToRedeem(0);
  } else {
    posStore.setPointsToRedeem(posStore.maxRedeemablePoints);
  }
}

// Modal Scan Kartu Member (F3 - Menggunakan Komponen Terpisah)
const showScanMemberModal = ref(false);

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

const paymentMethods: PaymentMethod[] = [
  'Transfer Bank',
  'Tunai / Kas',
  'QRIS',
  'Nota Tempo'
];

const showPaymentModal = ref(false);

function handleOpenPaymentModal() {
  if (posStore.cartItems.length === 0) return;
  showPaymentModal.value = true;
}

function handleConfirmPayment() {
  showPaymentModal.value = false;
  const tx = posStore.processCheckout();
  if (tx) {
    emit('show-receipt');
  }
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
  <div class="flex flex-col h-full bg-[#fcfbfa] text-[#2e2b28] text-xs select-none">
    <!-- Top Buyer & Date Header Bar -->
    <div class="p-2.5 bg-[#f3f1ed] border-b border-[#dedbd6] flex flex-col gap-2">
      <!-- Mode Switcher: B2B Grosir vs B2C Eceran -->
      <div class="flex items-center bg-[#e2dfd9] p-0.5 rounded border border-[#cac6be] shadow-inner">
        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-1.5 py-1 px-2 rounded text-[11px] font-bold cursor-pointer transition-all"
          :class="posStore.saleMode === 'B2B' ? 'bg-white text-blue-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
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
          :class="posStore.saleMode === 'B2C' ? 'bg-white text-emerald-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
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
            <Building v-if="posStore.saleMode === 'B2B'" :size="12" class="text-blue-600" />
            <ShoppingBag v-else :size="12" class="text-emerald-600" />
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
            <Building v-if="posStore.saleMode === 'B2B'" :size="13" class="text-blue-600 shrink-0" />
            <ShoppingBag v-else :size="13" class="text-emerald-600 shrink-0" />
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
          </div>
          <div class="flex items-center gap-1.5 text-[11px] text-gray-500 font-mono mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
            <span class="truncate max-w-[120px]">{{ item.category }}</span>
            <span class="text-gray-300">•</span>
            <span class="text-blue-700 font-medium shrink-0">@ {{ formatRupiah(item.sellPrice) }}</span>
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

    <!-- Modal Konfirmasi Pembayaran & Metode (Muncul setelah klik Bayar / F12) -->
    <div
      v-if="showPaymentModal"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none text-xs"
      @click.self="showPaymentModal = false"
    >
      <div class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <!-- Modal Header -->
        <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-gray-800">
          <div class="flex items-center gap-2 text-sm">
            <Receipt :size="17" class="text-blue-600" />
            <span>Konfirmasi Pembayaran Kasir</span>
          </div>
          <button
            type="button"
            class="p-1 text-gray-400 hover:text-black rounded cursor-pointer"
            @click="showPaymentModal = false"
          >
            <X :size="16" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-5 space-y-4">
          <!-- Total Tagihan Display -->
          <div class="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg text-center">
            <span class="text-xs font-semibold text-gray-600 block mb-0.5">TOTAL BAYAR AKHIR:</span>
            <span class="text-2xl font-black font-mono text-blue-700">
              Rp {{ formatRupiah(posStore.finalTotal) }}
            </span>
            <div v-if="posStore.totalDiscountAmount > 0 || posStore.pointsDiscountAmount > 0" class="text-[11px] text-rose-600 font-mono mt-0.5">
              (Hemat Rp {{ formatRupiah(posStore.totalDiscountAmount + posStore.pointsDiscountAmount) }} dari normal Rp {{ formatRupiah(posStore.totalSell) }})
            </div>
            <span class="text-[11px] text-gray-500 block mt-1 font-mono">
              {{ posStore.selectedBuyer }} ({{ posStore.saleMode === 'B2B' ? 'Grosir / B2B' : 'Eceran' }}) • {{ posStore.cartItems.length }} Barang
            </span>
          </div>

          <!-- Opsi Tukar Poin Member Langsung di Modal Bayar -->
          <div
            v-if="posStore.isMember && posStore.memberPoints > 0"
            class="p-3 bg-amber-50/90 border border-amber-200 rounded-lg space-y-2"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                <Coins :size="15" class="text-amber-600" />
                <span>Poin Member: {{ posStore.memberPoints }} Poin</span>
              </div>
              <span class="text-[11px] font-mono text-amber-800 font-semibold">
                (Senilai Rp {{ formatRupiah(posStore.memberPoints * buyerStore.loyaltySettings.pointValueInRupiah) }})
              </span>
            </div>

            <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-amber-200/70 text-xs">
              <label class="flex items-center gap-2 cursor-pointer font-semibold text-gray-800 select-none">
                <input
                  type="checkbox"
                  :checked="posStore.pointsToRedeem > 0"
                  @change="toggleRedeemPoints"
                  class="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <span>Tukar Poin untuk Potongan Bayar</span>
              </label>

              <div v-if="posStore.pointsToRedeem > 0" class="flex items-center gap-1 font-mono text-xs text-amber-900 font-bold">
                <span>-Rp {{ formatRupiah(posStore.pointsDiscountAmount) }}</span>
                <span class="text-[10px] text-gray-500 font-normal">({{ posStore.pointsToRedeem }} P)</span>
              </div>
            </div>
          </div>

          <!-- Status Bayar -->
          <div>
            <label class="text-xs font-bold text-gray-700 block mb-1.5">Status Pembayaran:</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-xs font-bold cursor-pointer transition-all"
                :class="posStore.paymentStatus === 'LUNAS' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'"
                @click="posStore.paymentStatus = 'LUNAS'"
              >
                <CheckCircle2 :size="15" />
                <span>Lunas</span>
              </button>

              <button
                type="button"
                class="flex items-center justify-center gap-2 py-2 px-3 rounded-md border text-xs font-bold cursor-pointer transition-all"
                :class="posStore.paymentStatus === 'TEMPO' ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'"
                @click="posStore.paymentStatus = 'TEMPO'"
              >
                <Clock :size="15" />
                <span>Tempo (Piutang)</span>
              </button>
            </div>
          </div>

          <!-- Metode Pembayaran -->
          <div>
            <label class="text-xs font-bold text-gray-700 block mb-1.5">Metode Pembayaran:</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="m in paymentMethods"
                :key="m"
                type="button"
                class="py-2 px-2.5 rounded-md border text-xs font-medium text-center cursor-pointer transition-all truncate"
                :class="posStore.paymentMethod === m ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs ring-2 ring-blue-300' : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'"
                @click="posStore.paymentMethod = m"
              >
                {{ m }}
              </button>
            </div>
          </div>

          <!-- Catatan / Keterangan Transaksi -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-bold text-gray-700">Catatan / Keterangan Nota:</label>
              <label class="flex items-center gap-1.5 text-[11px] text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  v-model="posStore.isPreOrder"
                  class="rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span :class="posStore.isPreOrder ? 'text-blue-700 font-bold' : ''">Pesanan Pre-Order</span>
              </label>
            </div>
            <input
              v-model="posStore.transactionNotes"
              type="text"
              placeholder="Contoh: Pre-order Pembeli, Titipan Bu Siti, dll (opsional)..."
              class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-300 rounded focus:border-blue-500 focus:outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div class="px-4 py-3 bg-[#f6f5f2] border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            type="button"
            class="px-3 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 rounded text-xs font-semibold text-gray-700 cursor-pointer transition-colors"
            @click="showPaymentModal = false"
          >
            Batal (Esc)
          </button>
          <button
            type="button"
            class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
            @click="handleConfirmPayment"
          >
            <Printer :size="14" />
            <span>Selesaikan & Cetak Struk ↵</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Pilih & Masukkan Kupon Promo (Terpisah rapi & tidak menumpuk) -->
    <div
      v-if="showVoucherModal"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none text-xs"
      @click.self="showVoucherModal = false"
    >
      <div class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <!-- Header -->
        <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-gray-800">
          <div class="flex items-center gap-2 text-sm text-rose-700">
            <Tag :size="16" />
            <span>Gunakan Kupon / Voucher Promo</span>
          </div>
          <button
            type="button"
            class="p-1 text-gray-400 hover:text-black rounded cursor-pointer"
            @click="showVoucherModal = false"
          >
            <X :size="16" />
          </button>
        </div>

        <!-- Body -->
        <div class="p-4 space-y-3">
          <!-- Manual Code Input -->
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Punya Kode Kupon Khusus?</label>
            <div class="flex gap-1.5">
              <input
                v-model="couponInput"
                type="text"
                placeholder="Misal: HEMAT5K"
                class="flex-1 bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold uppercase outline-none focus:border-rose-500 focus:bg-white"
                @keydown.enter.prevent="handleApplyCoupon"
              />
              <button
                type="button"
                class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors shrink-0"
                @click="handleApplyCoupon"
              >
                Gunakan
              </button>
            </div>
            <div v-if="couponError" class="text-[10.5px] text-rose-600 font-semibold mt-1">
              {{ couponError }}
            </div>
            <div v-if="couponSuccess" class="text-[10.5px] text-emerald-600 font-semibold mt-1">
              {{ couponSuccess }}
            </div>
          </div>

          <!-- Active Promo List -->
          <div>
            <div class="text-[11px] font-semibold text-gray-600 mb-1.5 flex items-center justify-between">
              <span>Atau Pilih Promo yang Tersedia:</span>
              <span class="text-gray-400 font-mono text-[10px]">{{ discountStore.activeDiscounts.length }} Voucher</span>
            </div>

            <div class="space-y-2 max-h-56 overflow-y-auto pr-0.5">
              <div
                v-for="v in discountStore.activeDiscounts"
                :key="v.id"
                class="p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between"
                :class="posStore.appliedDiscount?.id === v.id ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-400' : 'bg-gray-50/70 border-gray-200 hover:bg-rose-50/40 hover:border-rose-200'"
                @click="() => { handleSelectVoucher(v.code); showVoucherModal = false; }"
              >
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-mono font-bold text-xs text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">{{ v.code }}</span>
                    <span class="font-bold text-gray-800 text-xs">{{ v.name }}</span>
                  </div>
                  <div class="text-[10px] text-gray-500 mt-0.5">
                    <span v-if="v.minPurchase > 0">Min. Belanja: Rp {{ formatRupiah(v.minPurchase) }}</span>
                    <span v-else>Tanpa minimal belanja</span>
                    <span v-if="v.scope === 'MEMBER_ONLY'" class="ml-1 text-amber-700 font-bold">• Khusus Member</span>
                  </div>
                </div>

                <div class="text-right shrink-0 ml-2">
                  <span class="font-bold font-mono text-emerald-700 text-xs block">
                    {{ v.type === 'PERCENT' ? `${v.value}%` : `Rp ${formatRupiah(v.value)}` }}
                  </span>
                  <span class="text-[9.5px] text-rose-600 font-bold underline">
                    {{ posStore.appliedDiscount?.id === v.id ? 'Terpasang' : 'Pilih' }}
                  </span>
                </div>
              </div>

              <div v-if="discountStore.activeDiscounts.length === 0" class="text-center py-6 text-gray-400">
                <Tag :size="24" class="mx-auto mb-1 opacity-40" />
                <p>Belum ada kupon promo aktif saat ini.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-4 py-2.5 bg-[#f6f5f2] border-t border-gray-200 flex items-center justify-between">
          <button
            v-if="posStore.appliedDiscount"
            type="button"
            class="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
            @click="() => { handleRemoveCoupon(); showVoucherModal = false; }"
          >
            Hapus Kupon Terpasang
          </button>
          <div v-else></div>

          <button
            type="button"
            class="px-3 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded text-xs font-semibold text-gray-700 cursor-pointer"
            @click="showVoucherModal = false"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>

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
