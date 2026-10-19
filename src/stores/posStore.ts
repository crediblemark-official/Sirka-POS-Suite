import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  BuyerName,
  CartItem,
  Product,
  Transaction,
  PaymentStatus,
  PaymentMethod,
  PreOrderItem,
  CustomerType,
  Discount
} from '../types';
import { useInventoryStore } from './inventoryStore';
import { useLedgerStore } from './ledgerStore';
import { useSettingsStore } from './settingsStore';
import { useBuyerStore } from './buyerStore';
import { useDiscountStore } from './discountStore';

export const usePosStore = defineStore('pos', () => {
  const inventoryStore = useInventoryStore();
  const ledgerStore = useLedgerStore();
  const settingsStore = useSettingsStore();
  const buyerStore = useBuyerStore();
  const discountStore = useDiscountStore();

  const saleMode = ref<CustomerType>('B2B');
  const selectedBuyer = ref<BuyerName>('Pembeli Banjarsari');
  const transactionDate = ref<string>(new Date().toISOString().slice(0, 10));
  const paymentStatus = ref<PaymentStatus>('LUNAS');
  const paymentMethod = ref<PaymentMethod>('Transfer Bank');
  const transactionNotes = ref<string>('');
  const isPreOrder = ref<boolean>(false);
  // Gap-3 (PRD Aturan #4): PIC penerima barang untuk Faktur B2B & tanda terima pengiriman
  const picName = ref<string>('');

  // Diskon & Kupon Promo State
  const appliedDiscount = ref<Discount | null>(null);
  const manualDiscountPercent = ref<number>(0);
  const manualDiscountNominal = ref<number>(0);

  // Loyalty Membership & Poin State
  const pointsToRedeem = ref<number>(0);
  const attachedMemberCard = ref<string | null>(null);

  // Data Member Buyer Aktif
  const selectedBuyerData = computed(() => buyerStore.getBuyerByName(selectedBuyer.value));
  // Kartu member HANYA aktif jika telah di-scan / dihubungkan secara eksplisit
  const isMember = computed(() => {
    if (!attachedMemberCard.value || !selectedBuyerData.value?.memberCardNo) return false;
    return selectedBuyerData.value.memberCardNo.trim().toUpperCase() === attachedMemberCard.value.trim().toUpperCase();
  });
  const memberTier = computed(() => (isMember.value ? selectedBuyerData.value?.tier : undefined) || 'REGULAR');
  const memberPoints = computed(() => (isMember.value ? selectedBuyerData.value?.points : 0) || 0);

  function attachMemberCard(cardNo: string) {
    attachedMemberCard.value = cardNo.trim().toUpperCase();
  }

  function detachMemberCard() {
    attachedMemberCard.value = null;
    pointsToRedeem.value = 0;
  }

  function setSaleMode(mode: CustomerType) {
    saleMode.value = mode;
    attachedMemberCard.value = null;
    pointsToRedeem.value = 0;
    if (mode === 'B2C') {
      const b2c = buyerStore.b2cBuyers[0];
      selectedBuyer.value = b2c ? b2c.name : 'Pelanggan Umum (Eceran)';
      paymentStatus.value = 'LUNAS';
      paymentMethod.value = 'Tunai / Kas';
    } else {
      const b2b = buyerStore.b2bBuyers[0];
      selectedBuyer.value = b2b ? b2b.name : 'Pembeli Banjarsari';
    }
  }

  const cartItems = ref<CartItem[]>([]);
  const lastProcessedTransaction = ref<Transaction | null>(null);

  function recalculateItem(item: CartItem) {
    item.subtotalBuy = Math.round(item.qty * item.buyPrice);
    item.subtotalSell = Math.round(item.qty * item.sellPrice);
    item.profit = item.subtotalSell - item.subtotalBuy;
  }

  // Tambah produk ke keranjang kasir POS
  function addProductToCart(product: Product, qtyToAdd = 1) {
    const existing = cartItems.value.find(i => i.productId === product.id);
    if (existing) {
      existing.qty += qtyToAdd;
      recalculateItem(existing);
      return;
    }

    const buyPrice = product.lastBuyPrice || 0;
    const markup = product.defaultMarkupPercent || inventoryStore.getCategoryMarkup(product.category);
    const sellPrice = product.lastSellPrice || Math.round(buyPrice * (100 + markup) / 100);

    const newItem: CartItem = {
      id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      unit: product.unit,
      qty: qtyToAdd,
      buyPrice,
      markupPercent: markup,
      sellPrice,
      isManualSellPrice: false,
      subtotalBuy: 0,
      subtotalSell: 0,
      profit: 0,
    };
    recalculateItem(newItem);
    cartItems.value.push(newItem);
  }

  function updateItemQty(itemId: string, newQty: number) {
    const item = cartItems.value.find(i => i.id === itemId);
    if (item) {
      item.qty = Math.max(0, newQty);
      if (item.qty === 0) {
        removeItem(itemId);
      } else {
        recalculateItem(item);
      }
    }
  }

  function updateItemSellPrice(itemId: string, newSellPrice: number) {
    const item = cartItems.value.find(i => i.id === itemId);
    if (item) {
      item.sellPrice = Math.max(0, newSellPrice);
      item.isManualSellPrice = true;
      if (item.buyPrice > 0) {
        item.markupPercent = Number((((item.sellPrice - item.buyPrice) / item.buyPrice) * 100).toFixed(1));
      }
      recalculateItem(item);
    }
  }

  // BUG-019 FIX: Inline input `Harga Beli (Nota)` per baris keranjang. Harga jual dihitung ulang
  // otomatis dari markup baris, KECUALI harga jual sudah di-override manual.
  // Catatan: formula `buy * (100 + pct) / 100` menghindari error float `buy * 1.pct`
  // (mis. 50 * 1.15 = 57.4999... → dibulatkan salah jadi 57, sewajarnya 58).
  function updateItemBuyPrice(itemId: string, newBuyPrice: number) {
    const item = cartItems.value.find(i => i.id === itemId);
    if (item) {
      item.buyPrice = Math.max(0, newBuyPrice);
      if (!item.isManualSellPrice && item.buyPrice > 0) {
        item.sellPrice = Math.round(item.buyPrice * (100 + item.markupPercent) / 100);
      }
      recalculateItem(item);
    }
  }

  // Override `% Markup` per baris keranjang (melanggar manual jika jual sudah manual).
  function updateItemMarkup(itemId: string, newPercent: number) {
    const item = cartItems.value.find(i => i.id === itemId);
    if (item) {
      item.markupPercent = newPercent;
      if (!item.isManualSellPrice && item.buyPrice > 0) {
        item.sellPrice = Math.round(item.buyPrice * (100 + item.markupPercent) / 100);
      }
      recalculateItem(item);
    }
  }

  // Baris Kontrol Markup Dinamis (PRD baris 101): preset % transaksi diterapkan
  // ke semua baris kecuali baris yang harga jualnya sudah di-override manual.
  const transactionMarkupPercent = ref<number | null>(null);
  const transactionMarkupNominal = ref<number | null>(null);

  function applyTransactionMarkup(percent: number) {
    transactionMarkupPercent.value = percent;
    transactionMarkupNominal.value = null;
    for (const item of cartItems.value) {
      if (item.isManualSellPrice) continue;
      item.markupPercent = percent;
      if (item.buyPrice > 0) {
        item.sellPrice = Math.round(item.buyPrice * (100 + item.markupPercent) / 100);
      }
      recalculateItem(item);
    }
  }

  function applyTransactionMarkupNominal(nominalRp: number) {
    transactionMarkupNominal.value = nominalRp;
    transactionMarkupPercent.value = null;
    for (const item of cartItems.value) {
      if (item.isManualSellPrice) continue;
      item.sellPrice = Math.max(0, item.buyPrice + nominalRp);
      if (item.buyPrice > 0) {
        item.markupPercent = Number((((item.sellPrice - item.buyPrice) / item.buyPrice) * 100).toFixed(1));
      }
      recalculateItem(item);
    }
  }

  function resetToMasterPrice() {
    transactionMarkupPercent.value = null;
    transactionMarkupNominal.value = null;
    for (const item of cartItems.value) {
      item.isManualSellPrice = false;
      const orig = inventoryStore.products.find(p => p.id === item.id);
      if (orig) {
        item.buyPrice = orig.lastBuyPrice;
        item.sellPrice = orig.lastSellPrice;
        item.markupPercent = orig.defaultMarkupPercent;
      }
      recalculateItem(item);
    }
  }

  function removeItem(itemId: string) {
    cartItems.value = cartItems.value.filter(i => i.id !== itemId);
  }

  function clearCart() {
    cartItems.value = [];
    isPreOrder.value = false;
    appliedDiscount.value = null;
    manualDiscountPercent.value = 0;
    manualDiscountNominal.value = 0;
    transactionMarkupPercent.value = null;
    pointsToRedeem.value = 0;
    attachedMemberCard.value = null;
  }

  function applyDiscount(discountOrCode: Discount | string | null): boolean {
    if (!discountOrCode) {
      appliedDiscount.value = null;
      return true;
    }
    let disc: Discount | undefined;
    if (typeof discountOrCode === 'string') {
      disc = discountStore.findDiscountByCode(discountOrCode);
    } else {
      disc = discountOrCode;
    }
    if (!disc) {
      return false;
    }
    const check = discountStore.calculateDiscountAmount(
      disc,
      totalSell.value,
      selectedBuyerData.value,
      cartItems.value
    );
    if (!check.valid) {
      return false;
    }
    appliedDiscount.value = disc;
    return true;
  }

  function removeDiscount() {
    appliedDiscount.value = null;
  }

  function setManualDiscount(percent: number, nominal: number) {
    manualDiscountPercent.value = Math.max(0, percent);
    manualDiscountNominal.value = Math.max(0, nominal);
  }

  function setPointsToRedeem(points: number) {
    const max = Math.min(memberPoints.value, maxRedeemablePoints.value);
    pointsToRedeem.value = Math.max(0, Math.min(points, max));
  }

  // Muat pesanan dari Rekap Pre-Order pembeli
  function loadPreOrderItems(items: PreOrderItem[], buyer: BuyerName, date: string) {
    selectedBuyer.value = buyer;
    transactionDate.value = date;
    isPreOrder.value = true;
    if (!transactionNotes.value) {
      transactionNotes.value = `Pre-Order ${buyer}`;
    }

    for (const poi of items) {
      const prod = inventoryStore.products.find(
        p => p.name.trim().toLowerCase() === poi.productName.trim().toLowerCase()
      );

      if (prod) {
        addProductToCart(prod, poi.qty);
      } else {
        const defaultMarkup = inventoryStore.getCategoryMarkup(poi.category);
        const newItem: CartItem = {
          id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          productId: `temp-${Date.now()}`,
          code: 'PO-ITEM',
          name: poi.productName,
          category: poi.category,
          unit: poi.unit,
          qty: poi.qty,
          buyPrice: 0,
          markupPercent: defaultMarkup,
          sellPrice: 0,
          isManualSellPrice: false,
          subtotalBuy: 0,
          subtotalSell: 0,
          profit: 0,
        };
        recalculateItem(newItem);
        cartItems.value.push(newItem);
      }
    }
  }

  // Total Belanja & Kalkulasi Diskon / Member
  const totalBuy = computed(() => cartItems.value.reduce((acc, i) => acc + i.subtotalBuy, 0));
  const totalSell = computed(() => cartItems.value.reduce((acc, i) => acc + i.subtotalSell, 0));

  // 1. Diskon Member Berdasarkan Tier (%)
  const memberTierDiscountPercent = computed(() => {
    if (!isMember.value) return 0;
    return buyerStore.loyaltySettings.tierDiscounts[memberTier.value] || 0;
  });

  const memberTierDiscountAmount = computed(() => {
    if (memberTierDiscountPercent.value <= 0 || totalSell.value <= 0) return 0;
    return Math.round(totalSell.value * (memberTierDiscountPercent.value / 100));
  });

  // 2. Diskon Voucher / Kupon Promo
  const voucherDiscountAmount = computed(() => {
    if (!appliedDiscount.value || totalSell.value <= 0) return 0;
    const res = discountStore.calculateDiscountAmount(
      appliedDiscount.value,
      totalSell.value,
      selectedBuyerData.value,
      cartItems.value
    );
    return res.amount;
  });

  // 3. Diskon Manual Kasir (% atau Rp)
  const manualDiscountAmount = computed(() => {
    if (totalSell.value <= 0) return 0;
    if (manualDiscountPercent.value > 0) {
      return Math.round(totalSell.value * (manualDiscountPercent.value / 100));
    }
    return Math.min(manualDiscountNominal.value, totalSell.value);
  });

  // Total Diskon Gabungan
  const totalDiscountAmount = computed(() => {
    const sum = voucherDiscountAmount.value + memberTierDiscountAmount.value + manualDiscountAmount.value;
    return Math.min(sum, totalSell.value);
  });

  // 4. Potongan Poin Loyalitas Member
  const maxRedeemablePoints = computed(() => {
    const remainingToPay = Math.max(0, totalSell.value - totalDiscountAmount.value);
    const pointVal = buyerStore.loyaltySettings.pointValueInRupiah || 100;
    return Math.floor(remainingToPay / pointVal);
  });

  const pointsDiscountAmount = computed(() => {
    const pointVal = buyerStore.loyaltySettings.pointValueInRupiah || 100;
    return pointsToRedeem.value * pointVal;
  });

  // Total Akhir Bersih Tagihan Kasir
  const finalTotal = computed(() => {
    return Math.max(0, totalSell.value - totalDiscountAmount.value - pointsDiscountAmount.value);
  });

  // Estimasi Poin Baru yang Diperoleh dari Transaksi Ini
  const pointsToEarn = computed(() => {
    if (!isMember.value || finalTotal.value <= 0) return 0;
    const earnPer = buyerStore.loyaltySettings.earnPerAmount || 10000;
    return Math.floor(finalTotal.value / earnPer);
  });

  // Laba Bersih Setelah Diskon
  const totalProfit = computed(() => finalTotal.value - totalBuy.value);
  const profitPercent = computed(() =>
    totalBuy.value > 0 ? Number(((totalProfit.value / totalBuy.value) * 100).toFixed(1)) : 0
  );
  const totalItemsCount = computed(() => cartItems.value.reduce((acc, i) => acc + i.qty, 0));

  function generateInvoiceNumber(dateStr: string): string {
    const cleanDate = dateStr.replace(/-/g, '');
    const prefix = settingsStore.invoicePrefix || 'INV';
    // BUG-001 FIX: Hitung urutan transaksi berdasarkan tanggal yang sama
    const countToday = ledgerStore.transactions.filter(t => t.date === dateStr).length + 1;
    let seq = countToday;
    let candidate = `${prefix}-${cleanDate}-${String(seq).padStart(4, '0')}`;
    while (ledgerStore.transactions.some(t => t.invoiceNo === candidate)) {
      seq++;
      candidate = `${prefix}-${cleanDate}-${String(seq).padStart(4, '0')}`;
    }
    return candidate;
  }

  // Proses Checkout Penjualan (F12)
  const isCheckingOut = ref(false);
  async function processCheckout(): Promise<Transaction | null> {
    if (isCheckingOut.value) return null;
    if (cartItems.value.length === 0) return null;

    setPointsToRedeem(isMember.value ? pointsToRedeem.value : 0);
    const invoiceNo = generateInvoiceNumber(transactionDate.value);
    const discountCodeUsed = appliedDiscount.value
      ? appliedDiscount.value.code
      : manualDiscountAmount.value > 0
        ? 'MANUAL'
        : memberTierDiscountAmount.value > 0
          ? `MEMBER-${memberTier.value}`
          : undefined;

    const tx: Transaction = {
      id: `tx-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      invoiceNo,
      date: transactionDate.value,
      buyer: selectedBuyer.value,
      items: JSON.parse(JSON.stringify(cartItems.value)),
      totalBuy: totalBuy.value,
      totalSell: totalSell.value,
      totalProfit: totalProfit.value,
      profitPercent: profitPercent.value,
      paymentStatus: paymentStatus.value,
      paymentMethod: paymentMethod.value,
      customerType: saleMode.value,
      isPreOrder: isPreOrder.value,
      picName: picName.value.trim() || undefined,
      notes: transactionNotes.value || undefined,
      discountAmount: totalDiscountAmount.value,
      discountCode: discountCodeUsed,
      pointsUsed: pointsToRedeem.value,
      pointsDiscount: pointsDiscountAmount.value,
      pointsEarned: pointsToEarn.value,
      finalTotal: finalTotal.value,
      createdAt: new Date().toISOString(),
    };

    isCheckingOut.value = true;
    try {
      await ledgerStore.addTransaction(tx, isMember.value ? selectedBuyerData.value?.id : undefined);
    } catch (error) {
      isCheckingOut.value = false;
      throw error;
    }
    lastProcessedTransaction.value = tx;
    await Promise.all([inventoryStore.fetchFromDb(), buyerStore.fetchBuyers()]);

    clearCart();
    transactionNotes.value = '';
    isPreOrder.value = false;
    picName.value = '';

    isCheckingOut.value = false;
    return tx;
  }

  return {
    saleMode,
    setSaleMode,
    selectedBuyer,
    selectedBuyerData,
    attachedMemberCard,
    isMember,
    memberTier,
    memberPoints,
    attachMemberCard,
    detachMemberCard,
    transactionDate,
    paymentStatus,
    paymentMethod,
    transactionNotes,
    isPreOrder,
    picName,
    cartItems,
    lastProcessedTransaction,
    appliedDiscount,
    manualDiscountPercent,
    manualDiscountNominal,
    pointsToRedeem,
    memberTierDiscountPercent,
    memberTierDiscountAmount,
    voucherDiscountAmount,
    manualDiscountAmount,
    totalDiscountAmount,
    maxRedeemablePoints,
    pointsDiscountAmount,
    pointsToEarn,
    finalTotal,
    addProductToCart,
    updateItemQty,
    updateItemSellPrice,
    updateItemBuyPrice,
    updateItemMarkup,
    applyTransactionMarkup,
    applyTransactionMarkupNominal,
    resetToMasterPrice,
    transactionMarkupPercent,
    transactionMarkupNominal,
    removeItem,
    clearCart,
    loadPreOrderItems,
    applyDiscount,
    removeDiscount,
    setManualDiscount,
    setPointsToRedeem,
    totalBuy,
    totalSell,
    totalProfit,
    profitPercent,
    totalItemsCount,
    processCheckout,
    isCheckingOut,
  };
});
