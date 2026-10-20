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
  getProducts: mock(async () => []),
  getMarkups: mock(async () => []),
  getBuyers: mock(async () => []),
  getSettings: mock(async () => []),
  getDiscounts: mock(async () => []),
  getTransactions: mock(async () => []),
  getPreOrders: mock(async () => []),
  getPurchases: mock(async () => []),
  createTransaction: mock(async (_tx: any, _member?: string) => 'INV'),
  deleteTransaction: mock(async (_id: string) => {}),
  deletePreOrder: mock(async (_id: string) => {}),
  savePreOrder: mock(async (_record: any) => 'po'),
  importPurchases: mock(async (_records: any[]) => {}),
  savePurchase: mock(async (_record: any) => {}),
  deletePurchase: mock(async (_id: string) => {}),
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

beforeEach(() => {
  data.clear();
  setActivePinia(createPinia());
  for (const fn of Object.values(db)) fn.mockClear();
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
