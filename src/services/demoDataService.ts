import { dbService } from './dbService';
import { syncService } from './syncService';
import { CategoryMarkupSetting, Product, Buyer, Discount, PreOrderSchedule, Supplier } from '../types';
import { useInventoryStore } from '../stores/inventoryStore';
import { useBuyerStore } from '../stores/buyerStore';
import { useLedgerStore } from '../stores/ledgerStore';
import { useDiscountStore } from '../stores/discountStore';
import { usePreOrderStore } from '../stores/preOrderStore';
import { usePurchaseStore } from '../stores/purchaseStore';
import { useSupplierStore } from '../stores/supplierStore';
import { useSettingsStore } from '../stores/settingsStore';

export interface DemoDataPayload {
  version?: string;
  categoryMarkups?: CategoryMarkupSetting[];
  products?: Product[];
  buyers?: Buyer[];
  discounts?: Discount[];
  preOrders?: PreOrderSchedule[];
  suppliers?: Supplier[];
}

export const demoDataService = {
  /**
   * Mengambil file eksternal /demo-data.json dari folder public
   */
  async fetchDemoData(): Promise<DemoDataPayload> {
    const res = await fetch('/demo-data.json');
    if (!res.ok) {
      throw new Error(`Gagal membaca file demo-data.json (Status: ${res.status})`);
    }
    return await res.json();
  },

  /**
   * Mengisi database dengan data demo dari file eksternal /demo-data.json (atau payload kustom)
   */
  async loadDemoData(customPayload?: DemoDataPayload): Promise<void> {
    const payload = customPayload || (await this.fetchDemoData());

    // 1. Masukkan Kategori Markup
    if (payload.categoryMarkups && Array.isArray(payload.categoryMarkups)) {
      for (const markup of payload.categoryMarkups) {
        await dbService.createMarkup(markup.category, markup.defaultMarkupPercent, markup.description);
      }
    }

    // 2. Masukkan Produk
    if (payload.products && Array.isArray(payload.products)) {
      for (const prod of payload.products) {
        await dbService.upsertProduct(prod);
      }
    }

    // 3. Masukkan Pembeli & Member
    if (payload.buyers && Array.isArray(payload.buyers)) {
      for (const buyer of payload.buyers) {
        await dbService.upsertBuyer(buyer);
      }
    }

    // 4. Masukkan Diskon Promo
    if (payload.discounts && Array.isArray(payload.discounts)) {
      for (const disc of payload.discounts) {
        await dbService.upsertDiscount(disc);
      }
    }

    // 5. Masukkan Jadwal Pre-Order
    if (payload.preOrders && Array.isArray(payload.preOrders)) {
      for (const po of payload.preOrders) {
        await dbService.savePreOrder(po);
      }
    }

    // 6. Masukkan Mitra Supplier (murni dari demo-data.json)
    if (payload.suppliers && Array.isArray(payload.suppliers)) {
      const supplierStore = useSupplierStore();
      supplierStore.suppliers = [...payload.suppliers];
      localStorage.setItem('kasir_citra_suppliers_v1', JSON.stringify(supplierStore.suppliers));
    }

    // 7. Refresh seluruh state store Pinia
    await this.refreshAllStores();

    // 8. Picu background sync ke PostgreSQL Cloud
    syncService.triggerSync().catch(() => {});
  },

  /**
   * Mengosongkan seluruh database (Fresh Clean / 0 data)
   */
  async resetAllDataToFresh(wipeCloud: boolean = true): Promise<void> {
    // 1. Kosongkan database lokal & cloud
    await dbService.wipeAllData(wipeCloud);

    // 2. Bersihkan seluruh localStorage
    // BUG FIX: kunci-kunci di bawah TIDAK sesuai dengan yang benar-benar dipakai
    // store (`kasir_citra_products_v1`, `kasir_citra_markups_v1`,
    // `kasir_citra_held_carts_v1`). Akibatnya "Kosongkan Database" tidak
    // menghapus katalog lama, dan saat app dibuka lagi katalog lama muncul
    // kembali seolah-olah tidak pernah dikosongkan.
    const keysToRemove = [
      // inventoryStore
      'kasir_citra_products_v1',
      'kasir_citra_markups_v1',
      // buyerStore
      'kasir_citra_buyers_v3',
      'kasir_citra_loyalty_settings_v1',
      // discountStore
      'kasir_citra_discounts_v1',
      // ledgerStore
      'kasir_citra_ledger_v1',
      // preOrderStore
      'kasir_citra_preorders_v2',
      // purchaseStore
      'kasir_citra_purchases_v1',
      // posStore (keranjang parkir)
      'kasir_citra_held_carts_v1',
      // supplierStore
      'kasir_citra_suppliers_v1',
      // unitStore
      'kasir_citra_units_v1',
      // stockMovementStore
      'kasir_citra_stock_movements_v1',
      'kasir_citra_stock_adjustments_v1',
      // batchStore
      'kasir_citra_batches_v1',
      // returnStore
      'kasir_citra_refunds_v1',
      'kasir_citra_waste_v1',
      // settingsStore
      'kasir_citra_settings_v1',
      // shiftStore
      'kasir_citra_current_shift_v1',
      'kasir_citra_shift_history_v1',
      // demoDataService sendiri
      'kasir_citra_demo_loaded_v1'
    ];
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }

    // 3. Reset langsung nilai ref store ke kosong []
    const inventoryStore = useInventoryStore();
    inventoryStore.products = [];
    inventoryStore.categoryMarkups = [];

    const supplierStore = useSupplierStore();
    supplierStore.suppliers = [];

    const buyerStore = useBuyerStore();
    buyerStore.buyers = [];

    const ledgerStore = useLedgerStore();
    ledgerStore.transactions = [];

    const discountStore = useDiscountStore();
    discountStore.discounts = [];

    const preOrderStore = usePreOrderStore();
    preOrderStore.schedules = [];

    const purchaseStore = usePurchaseStore();
    purchaseStore.purchaseHistory = [];

    // 4. Ambil ulang dari DB (akan mengembalikan [])
    await this.refreshAllStores();
  },

  /**
   * Helper untuk menyegarkan seluruh store
   */
  async refreshAllStores(): Promise<void> {
    await Promise.allSettled([
      useInventoryStore().fetchFromDb(),
      useBuyerStore().fetchBuyers(),
      useLedgerStore().fetchTransactionsFromDb(),
      useDiscountStore().fetchDiscounts(),
      usePreOrderStore().fetchPreOrdersFromDb(),
      usePurchaseStore().fetchPurchases(),
      useSettingsStore().fetchSettings()
    ]);
  }
};
