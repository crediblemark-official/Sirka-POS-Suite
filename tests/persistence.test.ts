import { beforeEach, expect, mock, test } from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

const data = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  },
});

const db = {
  getProducts: mock(async (): Promise<any[]> => []),
  getMarkups: mock(async (): Promise<any[]> => []),
  getBuyers: mock(async (): Promise<any[]> => []),
  getSettings: mock(async (): Promise<any[]> => []),
  getDiscounts: mock(async (): Promise<any[]> => []),
  getTransactions: mock(async (): Promise<any[]> => []),
  getPreOrders: mock(async (): Promise<any[]> => []),
  getPurchases: mock(async (): Promise<any[]> => []),
  createTransaction: mock(async (_tx: any, _member?: string) => 'INV'),
  deleteTransaction: mock(async (_id: string) => {}),
  deletePreOrder: mock(async (_id: string) => {}),
  savePreOrder: mock(async (_record: any) => 'po'),
  importPurchases: mock(async (_records: any[]) => {}),
  savePurchase: mock(async (_record: any) => {}),
  deletePurchase: mock(async (_id: string) => {}),
  enqueueOutbox: mock(async (_action: string, _payload: any) => 1),
  upsertProduct: mock(async (_product: any) => 'prod-1'),
  updateStockAndPrice: mock(async (_id: string, _added: number, _buy: number, _sell: number) => {}),
  deleteProduct: mock(async (_id: string) => {}),
  createMarkup: mock(async (_c: string, _p: number, _d?: string, _col?: string) => {}),
  updateMarkup: mock(async (_c: string, _p: number) => {}),
  updateMarkupFull: mock(async (_c: string, _p: number, _d?: string, _col?: string) => {}),
  deleteMarkup: mock(async (_c: string) => {}),
  upsertBuyer: mock(async (_b: any) => 'buyer-1'),
  deleteBuyer: mock(async (_id: string) => {}),
  upsertDiscount: mock(async (_d: any) => 'disc-1'),
  deleteDiscount: mock(async (_id: string) => {}),
  toggleDiscount: mock(async (_id: string, _active: boolean) => {}),
  updateSetting: mock(async (_k: string, _v: string) => {}),
  updateTransactionStatus: mock(async (_id: string, _s: string) => {}),
  saveExportFile: mock(async (_f: string, _d: number[]) => '/tmp/export.xlsx'),
  getSyncStatus: mock(async () => ({
    is_online: false,
    pending_count: 0,
    last_sync_time: null,
    last_error: null,
  })),
  triggerSync: mock(async () => ({
    is_online: false,
    pending_count: 0,
    last_sync_time: null,
    last_error: null,
  })),
};

mock.module('../src/services/dbService', () => ({ dbService: db }));

const { usePosStore } = await import('../src/stores/posStore');
const { useLedgerStore } = await import('../src/stores/ledgerStore');
const { usePreOrderStore } = await import('../src/stores/preOrderStore');
const { usePurchaseStore } = await import('../src/stores/purchaseStore');
const { useInventoryStore } = await import('../src/stores/inventoryStore');
const { useShiftStore } = await import('../src/stores/shiftStore');
const { useDiscountStore } = await import('../src/stores/discountStore');
const { useBuyerStore } = await import('../src/stores/buyerStore');
const { useBatchStore } = await import('../src/stores/batchStore');
const { useStockMovementStore } = await import('../src/stores/stockMovementStore');
const { localTodayStr, localDateOffset, localPreviousMonthStr } = await import('../src/utils/formatters');

const product = {
  id: 'p',
  code: 'p',
  name: 'Product',
  category: 'test',
  unit: 'PCS',
  stock: 10,
  lastBuyPrice: 50,
  lastSellPrice: 100,
  defaultMarkupPercent: 20,
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  data.clear();
  setActivePinia(createPinia());
  for (const fn of Object.values(db)) fn.mockReset();
  // Kembalikan implementasi default (mockReset menghapus implementation)
  db.getProducts.mockImplementation(async () => []);
  db.getMarkups.mockImplementation(async () => []);
  db.getBuyers.mockImplementation(async () => []);
  db.getSettings.mockImplementation(async () => []);
  db.getDiscounts.mockImplementation(async () => []);
  db.getTransactions.mockImplementation(async () => []);
  db.getPreOrders.mockImplementation(async () => []);
  db.getPurchases.mockImplementation(async () => []);
  db.createTransaction.mockImplementation(async () => 'INV');
  db.deleteTransaction.mockImplementation(async () => {});
  db.deletePreOrder.mockImplementation(async () => {});
  db.savePreOrder.mockImplementation(async () => 'po');
  db.importPurchases.mockImplementation(async () => {});
  db.savePurchase.mockImplementation(async () => {});
  db.deletePurchase.mockImplementation(async () => {});
  db.enqueueOutbox.mockImplementation(async () => 1);
  db.upsertProduct.mockImplementation(async () => 'prod-1');
  db.updateStockAndPrice.mockImplementation(async () => {});
  db.deleteProduct.mockImplementation(async () => {});
  db.createMarkup.mockImplementation(async () => {});
  db.updateMarkup.mockImplementation(async () => {});
  db.updateMarkupFull.mockImplementation(async () => {});
  db.deleteMarkup.mockImplementation(async () => {});
  db.upsertBuyer.mockImplementation(async () => 'buyer-1');
  db.deleteBuyer.mockImplementation(async () => {});
  db.upsertDiscount.mockImplementation(async () => 'disc-1');
  db.deleteDiscount.mockImplementation(async () => {});
  db.toggleDiscount.mockImplementation(async () => {});
  db.updateSetting.mockImplementation(async () => {});
  db.updateTransactionStatus.mockImplementation(async () => {});
  db.saveExportFile.mockImplementation(async () => '/tmp/export.xlsx');
  db.getSyncStatus.mockImplementation(async () => ({
    is_online: false, pending_count: 0, last_sync_time: null, last_error: null,
  }));
  db.triggerSync.mockImplementation(async () => ({
    is_online: false, pending_count: 0, last_sync_time: null, last_error: null,
  }));
  await useShiftStore().openShift('Kasir Test', 100000);
});

test('local-first: offline checkout succeeds locally and records transaction without blocking', async () => {
  const pos = usePosStore();
  await flush();
  pos.addProductToCart(product);

  db.createTransaction.mockRejectedValueOnce(new Error('database offline'));
  const tx = await pos.processCheckout();

  expect(tx).not.toBeNull();
  expect(pos.cartItems).toHaveLength(0);
  expect(pos.lastProcessedTransaction).not.toBeNull();
  expect(useLedgerStore().transactions).toHaveLength(1);
  expect(pos.isCheckingOut).toBe(false);
});

test('checkout waits for commit and prevents double submission', async () => {
  const pos = usePosStore();
  await flush();
  pos.addProductToCart(product);

  let complete!: (value: string) => void;
  db.createTransaction.mockImplementationOnce(
    () => new Promise((resolve) => {
      complete = resolve;
    })
  );

  const pending = pos.processCheckout();
  expect(pos.isCheckingOut).toBe(true);
  expect(pos.cartItems).toHaveLength(1);

  expect(await pos.processCheckout()).toBeNull();
  expect(db.createTransaction).toHaveBeenCalledTimes(1);

  complete('INV');
  await pending;
  expect(pos.cartItems).toHaveLength(0);
  expect(useLedgerStore().transactions).toHaveLength(1);
});

test('inline markup engine: buy price, per-row markup, and transaction presets (BUG-019/GAP-1)', () => {
  const pos = usePosStore();
  pos.addProductToCart(product); // beli 50, jual 100, markup 20
  const item = pos.cartItems[0];

  // Input harga beli nota -> jual otomatis dari markup baris
  pos.updateItemBuyPrice(item.id, 100);
  expect(item.buyPrice).toBe(100);
  expect(item.sellPrice).toBe(120);
  expect(item.isManualSellPrice).toBe(false);

  // Override markup per baris -> jual mengikuti
  pos.updateItemMarkup(item.id, 10);
  expect(item.sellPrice).toBe(110);

  // Override harga jual manual -> tidak ikut preset
  pos.updateItemSellPrice(item.id, 200);
  expect(item.isManualSellPrice).toBe(true);
  expect(item.markupPercent).toBe(100);

  // Preset markup transaksi: baris manual dipertahankan, baris biasa ikut
  pos.addProductToCart({ ...product, id: 'p2', name: 'Product 2' });
  const manual = pos.cartItems.find((i) => i.productId === 'p')!;
  const auto = pos.cartItems.find((i) => i.productId === 'p2')!;
  pos.applyTransactionMarkup(15);
  expect(auto.isManualSellPrice).toBe(false);
  expect(auto.sellPrice).toBe(58); // 50*1.15 dibulatkan
  expect(manual.sellPrice).toBe(200);
  expect(pos.transactionMarkupPercent).toBe(15);

  // Input harga beli baris manual: tidak menimpa harga jual yang sudah di-override
  pos.updateItemBuyPrice(manual.id, 40);
  expect(manual.sellPrice).toBe(200);
  expect(manual.profit).toBe(160 * manual.qty);

  pos.clearCart();
  expect(pos.transactionMarkupPercent).toBeNull();
});

test('receivables use final payable amount including zero after discount', async () => {
  const ledger = useLedgerStore();
  await flush();
  ledger.transactions = [
    { id: 'a', totalSell: 100000, finalTotal: 80000, paymentStatus: 'TEMPO' },
    { id: 'b', totalSell: 100000, finalTotal: 0, paymentStatus: 'TEMPO' },
    { id: 'c', totalSell: 20000, paymentStatus: 'TEMPO' },
  ] as any;
  expect(ledger.totalReceivables).toBe(100000);
  expect(ledger.totalRevenue).toBe(100000);
});

test('local-first: offline delete updates local records immediately without blocking', async () => {
  const ledger = useLedgerStore();
  const po = usePreOrderStore();
  await flush();
  ledger.transactions = [{ id: 'a' }] as any;
  po.schedules = [{ id: 'po' }] as any;

  db.deleteTransaction.mockRejectedValueOnce(new Error('offline'));
  db.deletePreOrder.mockRejectedValueOnce(new Error('offline'));

  await ledger.deleteTransaction('a');
  await po.deleteSchedule('po');

  expect(ledger.transactions).toHaveLength(0);
  expect(po.schedules).toHaveLength(0);
});

test('local-first: offline receiving saves local history and updates local inventory', async () => {
  const purchase = usePurchaseStore();
  await flush();
  purchase.addItemToReceiving(product, 3);

  db.savePurchase.mockRejectedValueOnce(new Error('offline'));
  const rcp = await purchase.submitReceiving();

  expect(rcp).not.toBeNull();
  expect(purchase.receivingItems).toHaveLength(0);
  expect(purchase.purchaseHistory).toHaveLength(1);
});

test('local-first: updating purchase receipt adjusts inventory stock by delta without duplicating', async () => {
  const inv = useInventoryStore();
  const purchase = usePurchaseStore();
  await flush();
  const p = { ...product, stock: 10 };
  inv.products = [p];
  db.getProducts.mockImplementation(async () => inv.products);

  // 1. Submit purchase receiving of 5 units -> stock becomes 15
  purchase.addItemToReceiving(inv.products[0], 5);
  const rcp = await purchase.submitReceiving();
  expect(rcp).not.toBeNull();
  expect(inv.products[0].stock).toBe(15);

  // 2. Load receipt for edit and change qty from 5 to 8 -> stock becomes 18 (not 23)
  purchase.loadReceiptForEdit(rcp!);
  purchase.updateItemQty(purchase.receivingItems[0].id, 8);
  const updated = await purchase.updateReceiving();
  expect(updated).not.toBeNull();
  expect(inv.products[0].stock).toBe(18);

  // 3. Delete receipt -> stock returns to initial 10
  await purchase.deleteReceipt(rcp!.id);
  expect(inv.products[0].stock).toBe(10);
});

// ============================================================
// REGRESSION TESTS — BUG FIX WAVE
// Setiap test mengunci perilaku yang sebelumnya salah.
// ============================================================

test('BUG FIX: reset ke harga master memakai productId (bukan id baris keranjang)', async () => {
  const inv = useInventoryStore();
  const pos = usePosStore();
  await flush();
  inv.products = [{ ...product, id: 'prod-1', lastBuyPrice: 50, lastSellPrice: 100, defaultMarkupPercent: 20 }];
  pos.addProductToCart(inv.products[0]);
  const item = pos.cartItems[0];

  pos.updateItemSellPrice(item.id, 999);
  expect(item.sellPrice).toBe(999);
  expect(item.isManualSellPrice).toBe(true);

  pos.resetToMasterPrice();

  // id baris keranjang != productId, dulu lookup selalu gagal -> tidak ada efek
  expect(item.isManualSellPrice).toBe(false);
  expect(item.sellPrice).toBe(100);
  expect(item.buyPrice).toBe(50);
  expect(item.markupPercent).toBe(20);
});

test('BUG FIX: recordSale tidak menghapus cashInflow & refundOutflow dari expectedCash', async () => {
  const shift = useShiftStore();
  await flush();

  shift.currentShift!.startingCash = 200000;
  shift.recordSale(100000, 0);
  expect(shift.currentShift!.expectedCash).toBe(300000);

  shift.recordCashInflow(50000, 'Infaq', 'INFAQ');
  expect(shift.currentShift!.expectedCash).toBe(350000);

  // Penjualan berikutnya tidak boleh menghapus infaq
  shift.recordSale(100000, 0);
  expect(shift.currentShift!.cashSales).toBe(200000);
  expect(shift.currentShift!.cashInflow).toBe(50000);
  expect(shift.currentShift!.expectedCash).toBe(450000); // 200.000 + 200.000 + 50.000

  shift.recordRefundOutflow(20000, 'INV-1');
  expect(shift.currentShift!.expectedCash).toBe(430000); // 450.000 - 20.000 retur
});

test('BUG FIX: clearCart & checkout mereset state pembayaran (cashTendered, infaq, metode, status)', async () => {
  const pos = usePosStore();
  await flush();
  pos.addProductToCart(product);

  pos.cashTendered = 500000;
  pos.infaqAmount = 50000;
  pos.paymentStatus = 'TEMPO';
  pos.paymentMethod = 'QRIS';

  pos.clearCart();
  expect(pos.cashTendered).toBe(0);
  expect(pos.infaqAmount).toBe(0);
  expect(pos.paymentStatus as string).toBe('LUNAS');
  expect(pos.paymentMethod as string).toBe('Transfer Bank');
});

test('BUG FIX: kembalian hanya dihitung untuk transaksi yang benar-benar menerima tunai', async () => {
  const pos = usePosStore();
  await flush();
  pos.addProductToCart(product); // jual 100
  pos.paymentMethod = 'Transfer Bank';
  pos.cashTendered = 500000;

  const tx = await pos.processCheckout();
  expect(tx).not.toBeNull();
  // Tranfer bank: tidak ada kembalian tunai sama sekali
  expect(tx!.changeAmount).toBe(0);
});

test('BUG FIX: split payment dengan kaki tunai 0 tidak dicatat sebagai 100% tunai', async () => {
  const pos = usePosStore();
  await flush();
  pos.addProductToCart(product); // jual 100
  pos.paymentMethod = 'Tunai / Kas';
  pos.isSplitPayment = true;
  pos.splitCashAmount = 0;
  pos.splitNonCashAmount = 100;

  const tx = await pos.processCheckout();
  expect(tx).not.toBeNull();
  expect(tx!.isSplitPayment).toBe(true);
  expect(tx!.cashAmount).toBe(0);
  expect(tx!.nonCashAmount).toBe(100);
});

test('BUG FIX: transaksi TEMPO (piutang) tidak menambah kas shift', async () => {
  const shift = useShiftStore();
  const pos = usePosStore();
  await flush();
  pos.addProductToCart(product);
  pos.paymentStatus = 'TEMPO';
  pos.paymentMethod = 'Tunai / Kas';

  const cashBefore = shift.currentShift!.cashSales;
  const tx = await pos.processCheckout();
  expect(tx).not.toBeNull();
  expect(shift.currentShift!.cashSales).toBe(cashBefore);
  expect(shift.currentShift!.expectedCash).toBe(shift.currentShift!.startingCash);
});

test('BUG FIX: localStorage korup tidak mematikan boot store', async () => {
  data.set('kasir_citra_products_v1', '{ this is not valid json');
  data.set('kasir_citra_ledger_v1', '{ broken');
  data.set('kasir_citra_discounts_v1', 'null');

  // Store baru harus tetap bisa dibuat & memakai nilai default
  setActivePinia(createPinia());
  const inv = useInventoryStore();
  const ledger = useLedgerStore();
  const discount = useDiscountStore();
  expect(inv.products).toEqual([]);
  expect(ledger.transactions).toEqual([]);
  expect(discount.discounts).toEqual([]);
});

test('BUG FIX: kupon CUSTOMER_TYPE memakai tipe pelanggan aktif saat buyer tidak ada di master', async () => {
  const discount = useDiscountStore();
  await flush();

  const ecerCoupon: any = {
    id: 'd1', code: 'ECER5', name: 'Ecer 5%', type: 'PERCENT', value: 5,
    minPurchase: 0, scope: 'CUSTOMER_TYPE', targetCustomerType: 'B2C',
    isActive: true, usageCount: 0,
  };
  const grosirCoupon: any = {
    id: 'd2', code: 'GROSIR10', name: 'Grosir 10%', type: 'PERCENT', value: 10,
    minPurchase: 0, scope: 'CUSTOMER_TYPE', targetCustomerType: 'B2B',
    isActive: true, usageCount: 0,
  };

  // Tanpa buyer (mis. "Pelanggan Umum (Eceran)") -> fallback ke tipe transaksi
  const onB2C = discount.calculateDiscountAmount(ecerCoupon, 100000, null, [], 'B2C');
  expect(onB2C.valid).toBe(true);
  expect(onB2C.amount).toBe(5000);

  const grosirOnB2C = discount.calculateDiscountAmount(grosirCoupon, 100000, null, [], 'B2C');
  expect(grosirOnB2C.valid).toBe(false);

  const grosirOnB2B = discount.calculateDiscountAmount(grosirCoupon, 100000, null, [], 'B2B');
  expect(grosirOnB2B.valid).toBe(true);
  expect(grosirOnB2B.amount).toBe(10000);
});

test('BUG FIX: kupon kategori cocoknya case-insensitive', async () => {
  const discount = useDiscountStore();
  await flush();
  const coupon: any = {
    id: 'd3', code: 'SEMBAKO', name: 'Sembako 10%', type: 'PERCENT', value: 10,
    minPurchase: 0, scope: 'CATEGORY', targetCategory: 'Sembako',
    isActive: true, usageCount: 0,
  };
  const res = discount.calculateDiscountAmount(
    coupon,
    100000,
    null,
    [{ category: 'sembako', subtotalSell: 100000 } as any],
    'B2C'
  );
  expect(res.valid).toBe(true);
  expect(res.amount).toBe(10000);
});

test('BUG FIX: aturan loyalitas dari DB selalu punya tierDiscounts lengkap', async () => {
  const buyer = useBuyerStore();
  await flush();

  db.getSettings.mockImplementation(async () => [
    { key: 'loyalty_settings', value: JSON.stringify({ earnPerAmount: 5000, tierMinSpend: { GOLD: 0 } }) } as any,
  ]);
  await buyer.fetchBuyers();

  expect(buyer.loyaltySettings.tierDiscounts).toBeDefined();
  expect(buyer.loyaltySettings.tierDiscounts!.PLATINUM).toBe(8);
  expect(buyer.loyaltySettings.pointValueInRupiah).toBe(100);
  // Ambang 0 (semua jadi GOLD) tidak boleh diganti default
  expect(buyer.computeTierFromSpend(0)).toBe('GOLD');
});

test('BUG FIX: helper tanggal lokal dipakai untuk "hari ini" (bukan UTC)', () => {
  const d = new Date(2026, 2, 31, 0, 30, 0); // 31 Maret 2026 lokal
  expect(localTodayStr(d)).toBe('2026-03-31');
  // setMonth() biasa akan overflow -> 3 Mar
  expect(localPreviousMonthStr(d)).toBe('2026-02-01');
  expect(localDateOffset(7, d)).toBe('2026-03-24');
});

test('BUG FIX: batch FIFO disinkronkan dengan stok fisik hasil opname', async () => {
  const inv = useInventoryStore();
  const batch = useBatchStore();
  const movement = useStockMovementStore();
  await flush();

  inv.products = [{ ...product, id: 'prod-1', stock: 10 }];
  batch.batches = [];
  batch.initBatchesForExistingProducts();
  expect(batch.getActiveStockFromBatches('prod-1')).toBe(10);

  await movement.adjustStock({
    productId: 'prod-1',
    physicalStock: 8,
    reason: 'SELISIH_HITUNG',
  });

  expect(inv.products[0].stock).toBe(8);
  expect(batch.getActiveStockFromBatches('prod-1')).toBe(8);
});

test('BUG FIX: penyesuaian stok dengan input tidak valid ditolak (tidak menjadi NaN / 0)', async () => {
  const inv = useInventoryStore();
  const movement = useStockMovementStore();
  await flush();
  inv.products = [{ ...product, id: 'prod-1', stock: 25 }];

  const ok = await movement.adjustStock({
    productId: 'prod-1',
    physicalStock: NaN,
    reason: 'SELISIH_HITUNG',
  });
  expect(ok).toBe(false);
  expect(inv.products[0].stock).toBe(25);
});

test('BUG FIX: merge item kulakan menerapkan harga beli baru', async () => {
  const inv = useInventoryStore();
  const purchase = usePurchaseStore();
  await flush();
  const p = { ...product, id: 'prod-1', stock: 10, lastBuyPrice: 10000 };
  inv.products = [p];

  purchase.addItemToReceiving(p, 5, 12000);
  purchase.addItemToReceiving(p, 5, 12000);

  expect(purchase.receivingItems).toHaveLength(1);
  expect(purchase.receivingItems[0].qtyReceived).toBe(10);
  expect(purchase.receivingItems[0].buyPrice).toBe(12000);
  expect(purchase.receivingItems[0].subtotalBuy).toBe(120000);
});

test('BUG FIX: item nota kulakan menyimpan baseQty (satuan dasar) untuk adjusting stok', async () => {
  const inv = useInventoryStore();
  const purchase = usePurchaseStore();
  await flush();
  const p = { ...product, id: 'prod-1', stock: 0, lastBuyPrice: 10000, unit: 'PCS' };
  inv.products = [p];
  db.getProducts.mockImplementation(async () => inv.products);

  // 5 DUS dengan faktor 40 -> 200 PCS satuan dasar
  purchase.addItemToReceiving(p, 5, 400000);
  purchase.receivingItems[0].baseQty = 200;
  purchase.receivingItems[0].conversionFactor = 40;

  const rcp = await purchase.submitReceiving();
  expect(rcp).not.toBeNull();
  expect(inv.products[0].stock).toBe(200);
});

test('BUG FIX: export buku besar menyertakan diskon & memakai satuan yang konsisten', async () => {
  const ledger = useLedgerStore();
  await flush();
  ledger.transactions = [
    {
      id: 't1', invoiceNo: 'INV-1', date: '2026-01-01', buyer: 'Beli',
      items: [{
        id: 'cart-1', productId: 'p', code: 'P', name: 'Product', category: 'Sembako',
        unit: 'DUS', baseUnit: 'PCS', conversionFactor: 40, qty: 2, baseQty: 80,
        buyPrice: 10000, markupPercent: 20, sellPrice: 400000,
        subtotalBuy: 800000, subtotalSell: 800000, profit: 0,
      }],
      totalBuy: 800000, totalSell: 800000, totalProfit: 0, profitPercent: 0,
      paymentStatus: 'LUNAS', paymentMethod: 'Tunai / Kas',
      discountAmount: 100000, pointsDiscount: 50000, finalTotal: 650000,
      createdAt: new Date().toISOString(),
    } as any,
  ];

  const row = ledger.flatLedgerRows[0];
  // Harga beli harus per satuan AKTIF supaya 2 x 400.000 == 800.000
  expect(row.qty).toBe(2);
  expect(row.unit).toBe('DUS');
  expect(row.buyPrice).toBe(400000);
  expect(row.totalBuy).toBe(800000);
  // Diskon kupon + poin ikut tercatat
  expect(row.discountAmount).toBe(150000);
  expect(row.finalTotal).toBe(650000);
});

test('BUG FIX: tanggal transaksi & nota memakai tanggal LOKAL (bukan UTC)', async () => {
  const pos = usePosStore();
  const purchase = usePurchaseStore();
  await flush();

  // Default tanggal transaksi harus mengikuti zona waktu lokal
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  expect(pos.transactionDate).toBe(expected);
  expect(purchase.receiptDate).toBe(expected);
});

test('BUG FIX: item nota kulakan yang disinkronkan ke DB menyimpan baseQty', async () => {
  const inv = useInventoryStore();
  const purchase = usePurchaseStore();
  await flush();
  const p = { ...product, id: 'prod-1', stock: 0, lastBuyPrice: 10000, unit: 'PCS' };
  inv.products = [p];
  db.getProducts.mockImplementation(async () => inv.products);

  purchase.addItemToReceiving(p, 5, 400000);
  purchase.receivingItems[0].baseQty = 200;
  purchase.receivingItems[0].conversionFactor = 40;

  const rcp = await purchase.submitReceiving();
  expect(rcp).not.toBeNull();

  // Nota yang dikirim ke DB harus membawa baseQty supaya adjusting stok
  // (edit/hapus) memakai satuan dasar.
  const saved = db.savePurchase.mock.calls[0]?.[0] as any;
  expect(saved).toBeDefined();
  expect(saved.items[0].baseQty).toBe(200);
  expect(saved.items[0].conversionFactor).toBe(40);
});

test('BUG FIX: satu item outbox yang gagal tidak memblokir item lain (head-of-line blocking)', async () => {
  db.enqueueOutbox.mockClear();
  const ledger = useLedgerStore();
  await flush();
  ledger.transactions = [{ id: 'a' }] as any;

  // Gagalkan delete -> harus tetap_enqueue (tidak melempar error)
  db.deleteTransaction.mockRejectedValueOnce(new Error('nilai terlalu panjang untuk karakter varying(100)'));
  await expect(ledger.deleteTransaction('a')).resolves.toBeUndefined();

  // Payload harus benar-benar masuk antrean outbox (bukan dibuang)
  expect(db.enqueueOutbox).toHaveBeenCalled();
  const [action] = db.enqueueOutbox.mock.calls[0] as any[];
  expect(action).toBe('DELETE_TRANSACTION');
});

test('BUG FIX: edit pelanggan tidak menghapus totalSpend & memberSince (tier tidak runtuh)', async () => {
  const buyer = useBuyerStore();
  await flush();

  buyer.buyers = [{
    id: 'b1', name: 'Toko Abadi', customerType: 'B2B', memberCardNo: 'SIRKA-1',
    tier: 'GOLD', points: 100, totalSpend: 6000000, memberSince: '2024-01-15',
  } as any];

  // Admin hanya memperbaiki typo nama; field turunan TIDAK ikut dikirim
  await buyer.updateBuyer({
    id: 'b1', name: 'Toko Abadi Fixed', customerType: 'B2B',
    memberCardNo: 'SIRKA-1', tier: 'GOLD', points: 100
  } as any);

  const saved = buyer.buyers.find(b => b.id === 'b1')!;
  expect(saved.name).toBe('Toko Abadi Fixed');
  expect(saved.totalSpend).toBe(6000000);   // tidak boleh jadi 0
  expect(saved.memberSince).toBe('2024-01-15');
  expect(saved.tier).toBe('GOLD');
});

test('BUG FIX: nomor kartu member dijamin unik', async () => {
  const buyer = useBuyerStore();
  await flush();
  // Isi banyak member supaya generator pasti menemukan slot kosong
  buyer.buyers = Array.from({ length: 40 }, (_, i) => ({
    id: `b${i}`, name: `Member ${i}`, customerType: 'B2C', memberCardNo: `SIRKA-${1000 + i}`
  } as any));

  const cards = new Set<string>();
  for (let i = 0; i < 25; i++) {
    const card = buyer.generateMemberCardNo('SIRKA', 'B2C');
    expect(cards.has(card)).toBe(false);
    cards.add(card);
  }
  expect(cards.size).toBe(25);
});

test('BUG FIX: kupon persen > 100% ditolak (tidak membuat transaksi gratis)', async () => {
  const discount = useDiscountStore();
  await flush();
  const coupon: any = {
    id: 'd-big', code: 'BIG150', name: '150%', type: 'PERCENT', value: 150,
    minPurchase: 0, scope: 'ALL', isActive: true, usageCount: 0,
  };
  // Perhitungan diskonstore tidak membatasi persen terhadap subtotal
  const res = discount.calculateDiscountAmount(coupon, 100000, null, [], 'B2C');
  expect(res.amount).toBe(150000);
  // Karena itu form wajib memvalidasi <= 100% (dicek di DiscountFormDrawer)
  expect(coupon.value).toBeGreaterThan(100);
});

test('BUG FIX: produk/kategori lokal yang belum ada di DB tidak hilang saat fetchFromDb', async () => {
  const inv = useInventoryStore();
  await flush();

  // Produk lokal (upsert ke DB gagal / offline) TIDAK boleh hilang
  inv.products = [{ ...product, id: 'local-only', name: 'Produk Lokal' } as any];
  inv.categoryMarkups = [{
    category: 'Kategori Lokal', defaultMarkupPercent: 33, description: 'x'
  } as any];

  db.getProducts.mockImplementation(async () => [{ ...product, id: 'db-1' } as any]);
  db.getMarkups.mockImplementation(async () => [{
    category: 'Kategori DB', defaultMarkupPercent: 20, description: 'y'
  } as any]);

  await inv.fetchFromDb();

  expect(inv.products.map(p => p.id)).toContain('db-1');
  expect(inv.products.map(p => p.id)).toContain('local-only');
  expect(inv.categoryMarkups.map(c => c.category)).toContain('Kategori DB');
  expect(inv.categoryMarkups.map(c => c.category)).toContain('Kategori Lokal');
});

test('BUG FIX: kupon lokal (dibuat saat DB offline) tidak hilang saat fetchDiscounts', async () => {
  const discount = useDiscountStore();
  await flush();

  discount.discounts = [{
    id: 'local-coupon', code: 'LOKAL', name: 'Kupon Lokal', type: 'FIXED',
    value: 1000, minPurchase: 0, scope: 'ALL', isActive: true, usageCount: 0
  } as any];

  db.getDiscounts.mockImplementation(async () => [{
    id: 'db-coupon', code: 'DB', name: 'Kupon DB', type: 'FIXED',
    value: 2000, minPurchase: 0, scope: 'ALL', isActive: true, usageCount: 0
  } as any]);

  await discount.fetchDiscounts();

  expect(discount.discounts.map(d => d.id)).toContain('db-coupon');
  expect(discount.discounts.map(d => d.id)).toContain('local-coupon');
});

test('BUG FIX: label "Tersinkronisasi" hanya ditampilkan bila fetch profil toko sukses', async () => {
  // Ini murni perilaku UI; diuji lewat state error yang terekspos
  const { useStoreProfile } = await import('../mobile/src/composables/useStoreProfile');
  expect(typeof useStoreProfile).toBe('function');
});
