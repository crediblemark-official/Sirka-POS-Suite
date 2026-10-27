import { beforeEach, expect, mock, test } from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';

const mockStorage = new Map<string, string>();
if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => mockStorage.set(key, value),
      removeItem: (key: string) => mockStorage.delete(key),
      clear: () => mockStorage.clear(),
    },
  });
}

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

import { useSettingsStore } from '../src/stores/settingsStore';
import { usePosStore } from '../src/stores/posStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { useShiftStore } from '../src/stores/shiftStore';
import { useBuyerStore } from '../src/stores/buyerStore';
import { Product } from '../src/types';

beforeEach(() => {
  mockStorage.clear();
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear();
  }
  setActivePinia(createPinia());
});

test('Universal Business Mode: settingsStore switches business mode and updates flags and terminology', async () => {
  const settingsStore = useSettingsStore();

  // Default is universal
  expect(settingsStore.businessType).toBe('universal');
  expect(settingsStore.businessFeatures.tableManagement).toBe(true);
  expect(settingsStore.businessFeatures.serviceStaff).toBe(true);
  expect(settingsStore.businessFeatures.wholesaleTiers).toBe(true);

  // Switch to F&B
  await settingsStore.setBusinessType('fnb');
  expect(settingsStore.businessType).toBe('fnb');
  expect(settingsStore.isFnb).toBe(true);
  expect(settingsStore.businessFeatures.tableManagement).toBe(true);
  expect(settingsStore.businessFeatures.kitchenTicket).toBe(true);
  expect(settingsStore.businessFeatures.serviceStaff).toBe(false);
  expect(settingsStore.businessTerminology.productLabel).toBe('Menu');

  // Switch to Service
  await settingsStore.setBusinessType('service');
  expect(settingsStore.businessType).toBe('service');
  expect(settingsStore.isService).toBe(true);
  expect(settingsStore.businessFeatures.tableManagement).toBe(false);
  expect(settingsStore.businessFeatures.serviceStaff).toBe(true);
  expect(settingsStore.businessFeatures.serviceStatus).toBe(true);
  expect(settingsStore.businessTerminology.productLabel).toBe('Layanan / Jasa');
  expect(settingsStore.businessTerminology.cartTitle).toBe('Tiket Servis');

  // Switch to Retail
  await settingsStore.setBusinessType('retail');
  expect(settingsStore.businessType).toBe('retail');
  expect(settingsStore.isRetail).toBe(true);
  expect(settingsStore.businessFeatures.barcodeScanner).toBe(true);
  expect(settingsStore.businessFeatures.multiUnits).toBe(true);
  expect(settingsStore.businessFeatures.tableManagement).toBe(false);
  expect(settingsStore.businessTerminology.productLabel).toBe('Barang');
});

test('F&B Mode: transaction captures orderType (DINE_IN) and tableNo', async () => {
  const settingsStore = useSettingsStore();
  await settingsStore.setBusinessType('fnb');

  const shiftStore = useShiftStore();
  shiftStore.openShift('Kasir Resto', 100000);

  const inventoryStore = useInventoryStore();
  const menu: Product = {
    id: 'fnb-1',
    code: 'FNB-01',
    name: 'Nasi Goreng Spesial',
    category: 'Makanan',
    unit: 'PORSI',
    defaultMarkupPercent: 30,
    lastBuyPrice: 15000,
    lastSellPrice: 25000,
    stock: 50,
    productType: 'FNB_MENU',
    availableModifiers: ['Pedas Sedang', 'Telur Ceplok']
  };
  await inventoryStore.addProduct(menu);

  const posStore = usePosStore();
  posStore.orderType = 'DINE_IN';
  posStore.tableNo = 'Meja 07';
  posStore.addProductToCart(menu, 2, 'PORSI', ['Pedas Sedang']);

  expect(posStore.cartItems.length).toBe(1);
  expect(posStore.cartItems[0].modifiers).toEqual(['Pedas Sedang']);

  const tx = await posStore.processCheckout();
  expect(tx).not.toBeNull();
  expect(tx?.orderType).toBe('DINE_IN');
  expect(tx?.tableNo).toBe('Meja 07');
  expect(tx?.businessType).toBe('fnb');
  expect(tx?.items[0].modifiers).toEqual(['Pedas Sedang']);
});

test('Service Mode: service product does NOT deduct physical inventory stock', async () => {
  const settingsStore = useSettingsStore();
  await settingsStore.setBusinessType('service');

  const shiftStore = useShiftStore();
  shiftStore.openShift('Barber Agus', 50000);

  const inventoryStore = useInventoryStore();
  const service: Product = {
    id: 'svc-1',
    code: 'SVC-01',
    name: 'Potong Rambut + Cuci',
    category: 'Grooming',
    unit: 'SESI',
    defaultMarkupPercent: 0,
    lastBuyPrice: 0,
    lastSellPrice: 40000,
    stock: 0, // 0 stock for services
    productType: 'SERVICE',
    serviceDurationMinutes: 30
  };
  await inventoryStore.addProduct(service);

  const posStore = usePosStore();
  posStore.staffName = 'Kapster Hendra';
  posStore.serviceStatus = 'DONE';
  posStore.addProductToCart(service, 1);

  expect(posStore.cartItems[0].productType).toBe('SERVICE');

  const initialStock = inventoryStore.products.find(p => p.id === 'svc-1')?.stock;
  const tx = await posStore.processCheckout();

  expect(tx).not.toBeNull();
  expect(tx?.staffName).toBe('Kapster Hendra');
  expect(tx?.serviceStatus).toBe('DONE');

  // Stok tidak boleh berkurang jadi minus
  const finalStock = inventoryStore.products.find(p => p.id === 'svc-1')?.stock;
  expect(finalStock).toBe(initialStock);
});

test('Wholesale Tier Pricing: automatic price adjustment on volume thresholds', async () => {
  const settingsStore = useSettingsStore();
  await settingsStore.setBusinessType('wholesale');

  const inventoryStore = useInventoryStore();
  const product: Product = {
    id: 'grosir-1',
    code: 'MINYAK-1L',
    name: 'Minyak Goreng 1L',
    category: 'Sembako',
    unit: 'POUCH',
    defaultMarkupPercent: 10,
    lastBuyPrice: 14000,
    lastSellPrice: 17000, // Harga eceran
    stock: 200,
    tierPricing: [
      { minQty: 12, price: 15500, label: 'Grosir 1 Lusin' },
      { minQty: 48, price: 14800, label: 'Grosir Kartonan' }
    ]
  };
  await inventoryStore.addProduct(product);

  const posStore = usePosStore();

  // Beli 5 pcs -> harga eceran 17.000
  posStore.addProductToCart(product, 5);
  expect(posStore.cartItems[0].sellPrice).toBe(17000);

  // Ubah qty menjadi 12 pcs -> harga grosir 15.500 otomatis terpasang!
  posStore.updateItemQty(posStore.cartItems[0].id, 12);
  expect(posStore.cartItems[0].sellPrice).toBe(15500);

  // Ubah qty menjadi 50 pcs -> tier tertinggi 14.800 otomatis terpasang!
  posStore.updateItemQty(posStore.cartItems[0].id, 50);
  expect(posStore.cartItems[0].sellPrice).toBe(14800);
});

test('Hold and Recall Cart: preserves orderType, tableNo, and staffName', () => {
  const posStore = usePosStore();
  const inventoryStore = useInventoryStore();

  const prod: Product = {
    id: 'p-1',
    code: 'P01',
    name: 'Kopi Susu Gula Aren',
    category: 'Minuman',
    unit: 'CUP',
    defaultMarkupPercent: 50,
    lastBuyPrice: 8000,
    lastSellPrice: 18000,
    stock: 100
  };

  posStore.orderType = 'DINE_IN';
  posStore.tableNo = '05';
  posStore.staffName = 'Barista Doni';
  posStore.addProductToCart(prod, 2);

  expect(posStore.cartItems.length).toBe(1);

  // Parkir keranjang
  const held = posStore.holdCurrentCart();
  expect(held).toBe(true);
  expect(posStore.cartItems.length).toBe(0);
  expect(posStore.heldCarts.length).toBe(1);

  // Restore keranjang
  const heldId = posStore.heldCarts[0].id;
  posStore.recallHeldCart(heldId);

  expect(posStore.cartItems.length).toBe(1);
  expect(posStore.orderType).toBe('DINE_IN');
  expect(posStore.tableNo).toBe('05');
  expect(posStore.staffName).toBe('Barista Doni');
});
