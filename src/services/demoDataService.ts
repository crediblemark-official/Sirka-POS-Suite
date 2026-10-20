import { dbService } from './dbService';
import { syncService } from './syncService';
import { CategoryMarkupSetting, Product, Buyer, Discount, PreOrderSchedule } from '../types';
import { useInventoryStore } from '../stores/inventoryStore';
import { useBuyerStore } from '../stores/buyerStore';
import { useLedgerStore } from '../stores/ledgerStore';
import { useDiscountStore } from '../stores/discountStore';
import { usePreOrderStore } from '../stores/preOrderStore';
import { usePurchaseStore } from '../stores/purchaseStore';
import { useSettingsStore } from '../stores/settingsStore';

export interface DemoDataPayload {
  version?: string;
  categoryMarkups?: CategoryMarkupSetting[];
  products?: Product[];
  buyers?: Buyer[];
  discounts?: Discount[];
  preOrders?: PreOrderSchedule[];
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

    // 6. Refresh seluruh state store Pinia
    await this.refreshAllStores();

    // 7. Picu background sync ke PostgreSQL Cloud
    syncService.triggerSync().catch(() => {});
  },

  /**
   * Mengosongkan seluruh database (Fresh Clean / 0 data)
   */
  async resetAllDataToFresh(wipeCloud: boolean = true): Promise<void> {
    // 1. Kosongkan database lokal & cloud
    await dbService.wipeAllData(wipeCloud);

    // 2. Bersihkan seluruh localStorage
    const keysToRemove = [
      'kasir_citra_products_v2',
      'kasir_citra_markups_v2',
      'kasir_citra_buyers_v3',
      'kasir_citra_loyalty_settings_v1',
      'kasir_citra_discounts_v1',
      'kasir_citra_ledger_v1',
      'kasir_citra_preorders_v2',
      'kasir_citra_purchases_v1',
      'kasir_citra_pos_cart_v1'
    ];
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }

    // 3. Reset langsung nilai ref store ke kosong []
    const inventoryStore = useInventoryStore();
    inventoryStore.products = [];
    inventoryStore.categoryMarkups = [];

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
