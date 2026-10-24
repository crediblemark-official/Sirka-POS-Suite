import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import {
  BuyerName,
  CartItem,
  Product,
  Transaction,
  PaymentStatus,
  PaymentMethod,
  PreOrderItem,
  CustomerType,
  Discount,
  HeldCart
} from '../types';
import { useInventoryStore } from './inventoryStore';
import { useLedgerStore } from './ledgerStore';
import { useSettingsStore } from './settingsStore';
import { useBuyerStore } from './buyerStore';
import { useDiscountStore } from './discountStore';
import { useShiftStore } from './shiftStore';
import { useBatchStore } from './batchStore';
import { useStockMovementStore } from './stockMovementStore';
import { safeParse, safeClone } from '../utils/storage';
import { localTodayStr } from '../utils/formatters';

export const usePosStore = defineStore('pos', () => {
  const inventoryStore = useInventoryStore();
  const ledgerStore = useLedgerStore();
  const settingsStore = useSettingsStore();
  const buyerStore = useBuyerStore();
  const discountStore = useDiscountStore();
  const shiftStore = useShiftStore();
  const batchStore = useBatchStore();

  const saleMode = ref<CustomerType>('B2B');
  const selectedBuyer = ref<BuyerName>(
    buyerStore.b2bBuyers[0]?.name || ''
  );
  const transactionDate = ref<string>(localTodayStr());
  const paymentStatus = ref<PaymentStatus>('LUNAS');
  const paymentMethod = ref<PaymentMethod>('Transfer Bank');
  const transactionNotes = ref<string>('');
  const isPreOrder = ref<boolean>(false);
  // Gap-3 (PRD Aturan #4): PIC penerima barang untuk Faktur B2B & tanda terima pengiriman
  const picName = ref<string>('');

  // Fitur Parkir / Tahan Keranjang (Hold & Recall Cart - F6)
  const STORAGE_KEY_HELD_CARTS = 'kasir_citra_held_carts_v1';
  const savedHeldCarts = localStorage.getItem(STORAGE_KEY_HELD_CARTS);
  const heldCarts = ref<HeldCart[]>(safeParse<HeldCart[]>(savedHeldCarts, [], 'PosStore'));

  function saveHeldCartsLocal() {
    localStorage.setItem(STORAGE_KEY_HELD_CARTS, JSON.stringify(heldCarts.value));
  }

  // Fitur Split Payment (Bayar Campur) & Infaq Kembalian Koin
  const isSplitPayment = ref<boolean>(false);
  const splitCashAmount = ref<number>(0);
  const splitNonCashAmount = ref<number>(0);
  const splitNonCashMethod = ref<'Transfer Bank' | 'QRIS'>('QRIS');
  const cashTendered = ref<number>(0);
  const infaqAmount = ref<number>(0);

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
      selectedBuyer.value = b2b ? b2b.name : 'Pelanggan Grosir / B2B';
    }
  }

  // Sinkronisasi otomatis saat master pembeli selesai dimuat
  watch(
    () => buyerStore.buyers,
    (newList) => {
      if (newList.length > 0) {
        const exists = newList.some(b => b.name === selectedBuyer.value);
        if (!exists) {
          if (saleMode.value === 'B2C') {
            selectedBuyer.value = buyerStore.b2cBuyers[0]?.name || newList[0].name;
          } else {
            selectedBuyer.value = buyerStore.b2bBuyers[0]?.name || newList[0].name;
          }
        }
      }
    },
    { immediate: true }
  );

  const cartItems = ref<CartItem[]>([]);
  const lastProcessedTransaction = ref<Transaction | null>(null);

  function recalculateItem(item: CartItem) {
    item.conversionFactor = item.conversionFactor || 1;
    item.baseQty = Number(((item.qty || 0) * item.conversionFactor).toFixed(4));
    item.subtotalSell = Math.round(item.qty * item.sellPrice);
    item.subtotalBuy = Math.round(item.baseQty * item.buyPrice);
    item.profit = item.subtotalSell - item.subtotalBuy;
  }

  function getAvailableUnitsForProduct(product: Product): { unitName: string; factor: number; price?: number }[] {
    const list: { unitName: string; factor: number; price?: number }[] = [
      { unitName: product.unit, factor: 1, price: product.lastSellPrice }
    ];

    // Satuan tambahan HANYA berasal dari kemasan/konversi nyata yang dikonfigurasi di Master
    // (misal: BUNGKUS vs DUS, BUNGKUS vs SLOP, KG vs SAK, atau KG vs BUTIR untuk telur).
    // Pecahan berat (1/2 kg, 1/4 kg, dll) adalah KUANTITAS (Qty desimal), BUKAN SATUAN!
    if (product.units && Array.isArray(product.units)) {
      for (const cu of product.units) {
        if (!list.some(x => x.unitName.toUpperCase() === cu.unitName.toUpperCase())) {
          list.push({
            unitName: cu.unitName,
            factor: cu.conversionFactor,
            price: cu.sellPrice
          });
        }
      }
    }

    return list;
  }

  // Tambah produk ke keranjang kasir POS (Mendukung pilihan satuan awal)
  function addProductToCart(product: Product, qtyToAdd = 1, unitName?: string) {
    const targetUnit = unitName || product.unit;
    const avail = getAvailableUnitsForProduct(product);
    const unitDef = avail.find(u => u.unitName.toUpperCase() === targetUnit.toUpperCase()) || avail[0];

    const existing = cartItems.value.find(
      i => i.productId === product.id && i.unit.toUpperCase() === unitDef.unitName.toUpperCase()
    );

    if (existing) {
      existing.qty = Number((existing.qty + qtyToAdd).toFixed(3));
      recalculateItem(existing);
      return;
    }

    const buyPrice = product.lastBuyPrice || 0;
    const markup = product.defaultMarkupPercent || inventoryStore.getCategoryMarkup(product.category);
    let sellPrice = unitDef.price && unitDef.price > 0
      ? unitDef.price
      : Math.round((product.lastSellPrice || Math.round(buyPrice * (100 + markup) / 100)) * unitDef.factor);

    const newItem: CartItem = {
      id: `cart-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: product.id,
      code: product.code,
      name: product.name,
      category: product.category,
      unit: unitDef.unitName,
      baseUnit: product.unit,
      conversionFactor: unitDef.factor,
      qty: qtyToAdd,
      baseQty: Number((qtyToAdd * unitDef.factor).toFixed(4)),
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

  function setItemUnit(itemId: string, unitName: string) {
    const item = cartItems.value.find(i => i.id === itemId);
    if (!item) return;

    const prod = inventoryStore.products.find(p => p.id === item.productId);
    if (!prod) return;

    const avail = getAvailableUnitsForProduct(prod);
    const target = avail.find(u => u.unitName.toUpperCase() === unitName.toUpperCase());

    if (target) {
      item.unit = target.unitName;
      item.conversionFactor = target.factor;
      if (target.price && target.price > 0) {
        item.sellPrice = target.price;
      } else {
        item.sellPrice = Math.round(prod.lastSellPrice * target.factor);
      }
      recalculateItem(item);
    }
  }

  function updateItemQty(itemId: string, newQty: number) {
    const item = cartItems.value.find(i => i.id === itemId);
    if (item) {
      item.qty = Math.max(0, Number(newQty.toFixed(3)));
      if (item.qty === 0) {
        removeItem(itemId);
      } else {
        recalculateItem(item);
      }
    }
  }

  /**
   * BUG FIX (satuan multi-unit): `CartItem.buyPrice` (HPP) disimpan per SATUAN
   * DASAR sedangkan `CartItem.sellPrice` (harga jual) per SATUAN AKTIF.
   * Untuk penjualan per DUS (faktor 40) keduanya harus diselaraskan lewat
   * faktor konversi, kalau tidak margin jadi 40x lebih besar dan
   * "reset ke harga master" menulis harga 1 satuan dasar.
   */
  function sellPricePerBaseUnit(item: CartItem): number {
    const factor = item.conversionFactor || 1;
    return factor > 0 ? item.sellPrice / factor : item.sellPrice;
  }

  function updateItemSellPrice(itemId: string, newSellPrice: number) {
    const item = cartItems.value.find(i => i.id === itemId);
    if (item) {
      item.sellPrice = Math.max(0, newSellPrice);
      item.isManualSellPrice = true;
      if (item.buyPrice > 0) {
        const sellBase = sellPricePerBaseUnit(item);
        item.markupPercent = Number((((sellBase - item.buyPrice) / item.buyPrice) * 100).toFixed(1));
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
      const factor = item.conversionFactor || 1;
      if (!item.isManualSellPrice && item.buyPrice > 0) {
        item.sellPrice = Math.round(item.buyPrice * factor * (100 + item.markupPercent) / 100);
      }
      recalculateItem(item);
    }
  }

  // Override `% Markup` per baris keranjang (melanggar manual jika jual sudah manual).
  function updateItemMarkup(itemId: string, newPercent: number) {
    const item = cartItems.value.find(i => i.id === itemId);
    if (item) {
      item.markupPercent = newPercent;
      const factor = item.conversionFactor || 1;
      if (!item.isManualSellPrice && item.buyPrice > 0) {
        item.sellPrice = Math.round(item.buyPrice * factor * (100 + item.markupPercent) / 100);
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
      const factor = item.conversionFactor || 1;
      if (item.buyPrice > 0) {
        item.sellPrice = Math.round(item.buyPrice * factor * (100 + item.markupPercent) / 100);
      }
      recalculateItem(item);
    }
  }

  function applyTransactionMarkupNominal(nominalRp: number) {
    transactionMarkupNominal.value = nominalRp;
    transactionMarkupPercent.value = null;
    for (const item of cartItems.value) {
      if (item.isManualSellPrice) continue;
      const factor = item.conversionFactor || 1;
      // Nominal ditambahkan pada harga modal SATUAN DASAR lalu dikonversi ke
      // satuan aktif, supaya konsisten dengan basis perhitungan margin.
      item.sellPrice = Math.max(0, (item.buyPrice + nominalRp) * factor);
      if (item.buyPrice > 0) {
        const sellBase = sellPricePerBaseUnit(item);
        item.markupPercent = Number((((sellBase - item.buyPrice) / item.buyPrice) * 100).toFixed(1));
      }
      recalculateItem(item);
    }
  }

  function resetToMasterPrice() {
    transactionMarkupPercent.value = null;
    transactionMarkupNominal.value = null;
    for (const item of cartItems.value) {
      item.isManualSellPrice = false;
      // BUG FIX: `item.id` adalah ID baris keranjang ("cart-..."), bukan ID produk.
      // Akibatnya reset ke harga master tidak pernah menemukan produk & diam-diam tidak berefek.
      const orig = inventoryStore.products.find(p => p.id === item.productId);
      if (orig) {
        item.buyPrice = orig.lastBuyPrice;
        // Harga master disimpan per satuan DASAR; harga jual baris keranjang per satuan AKTIF.
        item.sellPrice = Math.round(orig.lastSellPrice * (item.conversionFactor || 1));
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
    transactionMarkupNominal.value = null;
    pointsToRedeem.value = 0;
    attachedMemberCard.value = null;
    // BUG FIX: state pembayaran harus ikut dibersihkan. Sebelumnya `cashTendered`,
    // `infaqAmount`, dan nominal split bocor ke transaksi berikutnya sehingga
    // kembalian fiktif & infaq palsu ikut tercatat pada shift kasir.
    cashTendered.value = 0;
    infaqAmount.value = 0;
    isSplitPayment.value = false;
    splitCashAmount.value = 0;
    splitNonCashAmount.value = 0;
    // Status & metode bayar juga di-reset supaya penjualan berikutnya tidak
    // diam-diam mewarisi "TEMPO"/"Transfer Bank" dari penjualan sebelumnya.
    paymentStatus.value = 'LUNAS';
    paymentMethod.value = saleMode.value === 'B2C' ? 'Tunai / Kas' : 'Transfer Bank';
  }

  /**
   * Reset seluruh state transaksi (dipakai setelah checkout sukses maupun
   * saat keranjang dikosongkan manual) agar tidak ada kebocoran antar transaksi.
   */
  function resetTransactionState() {
    clearCart();
    transactionNotes.value = '';
    isPreOrder.value = false;
    picName.value = '';
    isSplitPayment.value = false;
    splitCashAmount.value = 0;
    splitNonCashAmount.value = 0;
    cashTendered.value = 0;
    infaqAmount.value = 0;
    // BUG FIX: status & metode bayar harus di-reset. Kalau tidak, penjualan
    // berikutnya diam-diam mewarisi "TEMPO" / "Transfer Bank" dari penjualan
    // sebelumnya sehingga klasifikasi piutang & rekonsiliasi kas jadi salah.
    paymentStatus.value = 'LUNAS';
    paymentMethod.value = 'Transfer Bank';
  }

  // Logika Parkir / Tahan Keranjang (Hold & Recall Cart - F6)
  function holdCurrentCart(customLabel?: string): boolean {
    if (cartItems.value.length === 0) return false;

    // BUG FIX: nomor antrean bisa kembar. `length + 1` menghasilkan nomor yang
    // sama setelah ada keranjang dihapus (mis. antrean 1,2,3 -> hapus 2 ->
    // panjang 2 -> nomor baru 3, bentrok dengan antrean 3 yang sudah ada).
    const usedNumbers = new Set(heldCarts.value.map(h => h.cartNumber));
    let cartNumber = 1;
    while (usedNumbers.has(cartNumber)) cartNumber += 1;
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const autoLabel = customLabel?.trim() || `${selectedBuyer.value || 'Pelanggan'} (${cartItems.value.length} item) - ${timeStr}`;

    const held: HeldCart = {
      id: `hold-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      cartNumber,
      label: autoLabel,
      items: safeClone(cartItems.value, []),
      buyer: selectedBuyer.value,
      saleMode: saleMode.value,
      totalSell: totalSell.value,
      finalTotal: finalTotal.value,
      createdAt: timeStr
    };

    heldCarts.value.unshift(held);
    saveHeldCartsLocal();
    clearCart();
    return true;
  }

  function recallHeldCart(heldCartId: string): boolean {
    const idx = heldCarts.value.findIndex(h => h.id === heldCartId);
    if (idx === -1) return false;

    const held = heldCarts.value[idx];
    cartItems.value = safeClone(held.items, []);
    selectedBuyer.value = held.buyer;
    saleMode.value = held.saleMode;

    heldCarts.value.splice(idx, 1);
    saveHeldCartsLocal();
    return true;
  }

  function deleteHeldCart(heldCartId: string) {
    heldCarts.value = heldCarts.value.filter(h => h.id !== heldCartId);
    saveHeldCartsLocal();
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
      cartItems.value,
      saleMode.value
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

  /**
   * BUG FIX: set diskon manual dari NOMINAL final (hasil pratinjau modal nego).
   *
   * Store menghitung diskon manual persen dari `totalSell`, sedangkan modal
   * Total Adjust mempratinjau dari `baseTotal` (total setelah kupon, tier, dan
   * potong poin). Akibatnya nominal yang disetujui kasir berbeda dari yang
   * benar-benar ditagih (contoh: pratinjau Rp 810.000, ditagih Rp 800.000).
   *
   * `displayPercent` hanya untuk label di keranjang — nilainya TIDAK dipakai
   * menghitung nominal (yang sudah final dari modal).
   */
  function setManualDiscountByNominal(nominal: number, displayPercent = 0) {
    manualDiscountNominal.value = Math.max(0, Math.min(nominal, totalSell.value));
    manualDiscountPercent.value = Math.max(0, displayPercent);
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
      cartItems.value,
      saleMode.value
    );
    return res.amount;
  });

  // 3. Diskon Manual Kasir (% atau Rp)
  const manualDiscountAmount = computed(() => {
    if (totalSell.value <= 0) return 0;
    // BUG FIX: bila nominal sudah diisi (hasil modal nego), nominal itu yang
    // dipakai supaya yang ditagih = yang disetujui kasir. Persen hanya dipakai
    // bila nominal kosong (panel diskon inline di keranjang).
    if (manualDiscountNominal.value > 0) {
      return Math.min(manualDiscountNominal.value, totalSell.value);
    }
    if (manualDiscountPercent.value > 0) {
      return Math.round(totalSell.value * (manualDiscountPercent.value / 100));
    }
    return 0;
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

    // VALIDASI KASIR: Shift Kasir wajib sudah dibuka sebelum melakukan transaksi penjualan
    if (!shiftStore.isShiftActive) {
      shiftStore.showOpenShiftModal = true;
      throw new Error('Shift kasir belum dibuka. Harap buka shift kasir dan masukkan modal awal terlebih dahulu.');
    }

    setPointsToRedeem(isMember.value ? pointsToRedeem.value : 0);
    const invoiceNo = generateInvoiceNumber(transactionDate.value);
    const discountCodeUsed = appliedDiscount.value
      ? appliedDiscount.value.code
      : manualDiscountAmount.value > 0
        ? 'MANUAL'
        : memberTierDiscountAmount.value > 0
          ? `MEMBER-${memberTier.value}`
          : undefined;

    // BUG FIX: `isSplit` sebelumnya mensyaratkan kedua kaki > 0. Bila kaki tunai
    // diisi 0 (mis. pelanggan bayar 100% QRIS) transaksi degradasi menjadi
    // "Tunai / Kas" sehingga laci kasir dikreditkan uang yang tidak pernah masuk.
    // Sekarang: bila mode campur aktif, kaki yang bernilai 0 tetap dianggap
    // sebagai bagian dari pembayaran (dinyatakan eksplisit oleh UI).
    const isSplit = isSplitPayment.value;
    const finalSale = finalTotal.value;
    // BUG FIX: kembalian hanya boleh dihitung untuk transaksi yang benar-benar
    // menerima uang tunai. Sebelumnya `cashTendered` tidak dicek terhadap metode
    // bayar sehingga penjualan transfer bank ikut mencetak "Kembalian Tunai".
    const isCashTransaction = isSplit
      ? splitCashAmount.value > 0
      : paymentMethod.value === 'Tunai / Kas';
    const change = isCashTransaction && cashTendered.value > 0
      ? Math.max(0, cashTendered.value - (isSplit ? splitCashAmount.value : finalSale))
      : 0;
    const netChange = Math.max(0, change - infaqAmount.value);

    const tx: Transaction = {
      id: `tx-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      invoiceNo,
      date: transactionDate.value,
      buyer: selectedBuyer.value,
      items: safeClone(cartItems.value, []),
      totalBuy: totalBuy.value,
      totalSell: totalSell.value,
      totalProfit: totalProfit.value,
      profitPercent: profitPercent.value,
      paymentStatus: paymentStatus.value,
      paymentMethod: isSplit ? 'Tunai / Kas' : paymentMethod.value,
      isSplitPayment: isSplit,
      cashAmount: isSplit ? splitCashAmount.value : (paymentMethod.value === 'Tunai / Kas' ? finalSale : undefined),
      nonCashAmount: isSplit ? splitNonCashAmount.value : undefined,
      nonCashMethod: isSplit ? splitNonCashMethod.value : undefined,
      changeAmount: netChange,
      infaqAmount: infaqAmount.value > 0 ? infaqAmount.value : undefined,
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
      shiftId: shiftStore.currentShift?.id,
      createdAt: new Date().toISOString(),
    };

    // 1. Eksekusi Deduksi FIFO / FEFO murni untuk setiap item transaksi
    let computedTotalBuy = 0;
    for (const item of tx.items) {
      const prod = inventoryStore.products.find(p => p.id === item.productId);
      const qtyToDeduct = item.baseQty || (item.qty * (item.conversionFactor || 1));
      if (prod) {
        const fifoResult = batchStore.deductFifoFefo(prod, qtyToDeduct);
        item.batchDeductions = fifoResult.deductions;
        item.buyPrice = fifoResult.effectiveAverageBuyPrice;
        item.subtotalBuy = Math.round(fifoResult.totalHpp);
        item.profit = item.subtotalSell - item.subtotalBuy;
        computedTotalBuy += item.subtotalBuy;

        // Kurangi stok fisik master lewat action resmi inventoryStore (Enkapsulasi)
        const updatedSellPrice = (item.sellPrice > 0 && (!item.conversionFactor || item.conversionFactor === 1))
          ? item.sellPrice
          : undefined;
        const deductResult = inventoryStore.deductStock(prod.id, qtyToDeduct, updatedSellPrice);

        const movementStore = useStockMovementStore();
        movementStore.recordMovement({
          product: prod,
          type: 'PENJUALAN',
          refNo: tx.invoiceNo,
          qtyChange: -qtyToDeduct,
          stockBefore: deductResult ? deductResult.stockBefore : prod.stock,
          stockAfter: deductResult ? deductResult.stockAfter : prod.stock,
          costPrice: item.buyPrice,
          notes: `Terjual di Kasir (${tx.paymentMethod}${isSplit ? ' + ' + splitNonCashMethod.value : ''})`,
          operator: shiftStore.currentShift?.cashierName || 'Kasir'
        });
      } else {
        computedTotalBuy += item.subtotalBuy;
      }
    }

    tx.totalBuy = computedTotalBuy;
    tx.totalProfit = (tx.finalTotal ?? tx.totalSell) - tx.totalBuy;
    tx.profitPercent = tx.totalBuy > 0 ? Number(((tx.totalProfit / tx.totalBuy) * 100).toFixed(1)) : 0;

    isCheckingOut.value = true;
    try {
      await ledgerStore.addTransaction(tx, isMember.value ? selectedBuyerData.value?.id : undefined);

      // Local-First: Catat akumulasi penjualan ke Shift Kasir aktif.
      // BUG FIX: transaksi TEMPO (piutang) & metode "Nota Tempo" TIDAK boleh
      // menambah kas yang diharapkan — uangnya belum diterima. Sebelumnya
      // penjualan piutang ikut menambah `cashSales` sehingga saat tutup shift
      // kasir diminta menyediakan uang yang tidak pernah dibayarkan pelanggan.
      const saleAmount = tx.finalTotal ?? tx.totalSell;
      const isReceivable = tx.paymentStatus === 'TEMPO' || tx.paymentMethod === 'Nota Tempo';
      if (!isReceivable) {
        if (tx.isSplitPayment) {
          shiftStore.recordSale(tx.cashAmount || 0, tx.nonCashAmount || 0);
        } else if (tx.paymentMethod === 'Tunai / Kas') {
          shiftStore.recordSale(saleAmount, 0);
        } else if (tx.paymentMethod === 'Transfer Bank' || tx.paymentMethod === 'QRIS') {
          shiftStore.recordSale(0, saleAmount);
        }
      }

      // Jika ada alokasi infaq dari sisa kembalian receh kasir, catat kas masuk
      if (infaqAmount.value > 0) {
        shiftStore.recordCashInflow(infaqAmount.value, `Infaq kembalian nota ${tx.invoiceNo}`, 'INFAQ');
      }

      inventoryStore.saveLocal();

      // Local-First: Update poin dan akumulasi belanja member lokal via aksi resmi buyerStore (Enkapsulasi)
      if (isMember.value && selectedBuyerData.value) {
        buyerStore.recordPurchase(
          selectedBuyerData.value.id,
          tx.finalTotal ?? tx.totalSell,
          tx.pointsEarned || 0,
          tx.pointsUsed || 0
        );
      }
    } catch (error) {
      isCheckingOut.value = false;
      throw error;
    }
    lastProcessedTransaction.value = tx;
    await Promise.all([inventoryStore.fetchFromDb(), buyerStore.fetchBuyers()]).catch(() => {});

    // BUG FIX: gunakan resetTransactionState() agar status/metode bayar, nominal
    // split, cashTendered, dan infaq ikut ter-reset (tidak bocor ke transaksi berikutnya).
    resetTransactionState();

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
    // Fitur Hold / Parkir Keranjang
    heldCarts,
    holdCurrentCart,
    recallHeldCart,
    deleteHeldCart,
    // Fitur Split Payment & Infaq
    isSplitPayment,
    splitCashAmount,
    splitNonCashAmount,
    splitNonCashMethod,
    cashTendered,
    infaqAmount,
    addProductToCart,
    getAvailableUnitsForProduct,
    setItemUnit,
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
    resetTransactionState,
    loadPreOrderItems,
    applyDiscount,
    removeDiscount,
    setManualDiscount,
    setManualDiscountByNominal,
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
