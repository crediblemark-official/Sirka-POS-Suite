import { dbService, isTauri } from './dbService';
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
   * Tangguh terhadap base path dev server dan SPA route fallback
   */
  async fetchDemoData(): Promise<DemoDataPayload> {
    const urlsToTry = [
      '/demo-data.json',
      './demo-data.json',
      `${(typeof window !== 'undefined' && window.location.origin) ? window.location.origin : ''}/demo-data.json`
    ];

    for (const url of urlsToTry) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const text = await res.text();
          if (text.trim().startsWith('{')) {
            return JSON.parse(text) as DemoDataPayload;
          }
        }
      } catch {
        // Coba url berikutnya
      }
    }
    throw new Error('Gagal membaca file demo-data.json. Pastikan file tersedia di direktori public.');
  },

  /**
   * Mengisi database / localStorage dengan data demo dari file eksternal /demo-data.json
   */
  async loadDemoData(customPayload?: DemoDataPayload): Promise<void> {
    const payload = customPayload || (await this.fetchDemoData());

    if (!isTauri()) {
      // MODE WEB BROWSER: Simpan langsung ke localStorage untuk performa instan tanpa IPC
      if (payload.categoryMarkups && Array.isArray(payload.categoryMarkups)) {
        localStorage.setItem('kasir_citra_markups_v1', JSON.stringify(payload.categoryMarkups));
      }
      if (payload.products && Array.isArray(payload.products)) {
        localStorage.setItem('kasir_citra_products_v1', JSON.stringify(payload.products));
      }
      if (payload.buyers && Array.isArray(payload.buyers)) {
        localStorage.setItem('kasir_citra_buyers_v3', JSON.stringify(payload.buyers));
      }
      if (payload.discounts && Array.isArray(payload.discounts)) {
        localStorage.setItem('kasir_citra_discounts_v1', JSON.stringify(payload.discounts));
      }
      if (payload.preOrders && Array.isArray(payload.preOrders)) {
        localStorage.setItem('kasir_citra_preorders_v2', JSON.stringify(payload.preOrders));
      }
      if (payload.suppliers && Array.isArray(payload.suppliers)) {
        localStorage.setItem('kasir_citra_suppliers_v1', JSON.stringify(payload.suppliers));
      }
    } else {
      // MODE TAURI: Tulis ke backend database lokal SQLite / PostgreSQL
      // 1. Masukkan Kategori Markup
      if (payload.categoryMarkups && Array.isArray(payload.categoryMarkups)) {
        for (const markup of payload.categoryMarkups) {
          await dbService.createMarkup(markup.category, markup.defaultMarkupPercent, markup.description, markup.color);
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

      // 6. Masukkan Mitra Supplier
      if (payload.suppliers && Array.isArray(payload.suppliers)) {
        const supplierStore = useSupplierStore();
        supplierStore.suppliers = [...payload.suppliers];
        localStorage.setItem('kasir_citra_suppliers_v1', JSON.stringify(supplierStore.suppliers));
      }
    }

    // Tandai bahwa demo data telah dimuat
    localStorage.setItem('kasir_citra_demo_loaded_v1', 'true');

    // Refresh seluruh state store Pinia
    await this.refreshAllStores();

    // Picu background sync ke PostgreSQL Cloud jika di Tauri
    if (isTauri()) {
      syncService.triggerSync().catch(() => {});
    }
  },

  /**
   * Mengosongkan seluruh database (Fresh Clean / 0 data)
   */
  async resetAllDataToFresh(wipeCloud: boolean = true): Promise<void> {
    // 1. Kosongkan database lokal & cloud jika di Tauri
    if (isTauri()) {
      await dbService.wipeAllData(wipeCloud);
    }

    // 2. Bersihkan seluruh localStorage
    const keysToRemove = [
      'kasir_citra_products_v1',
      'kasir_citra_markups_v1',
      'kasir_citra_buyers_v3',
      'kasir_citra_loyalty_settings_v1',
      'kasir_citra_discounts_v1',
      'kasir_citra_ledger_v1',
      'kasir_citra_preorders_v2',
      'kasir_citra_purchases_v1',
      'kasir_citra_held_carts_v1',
      'kasir_citra_suppliers_v1',
      'kasir_citra_units_v1',
      'kasir_citra_stock_movements_v1',
      'kasir_citra_stock_adjustments_v1',
      'kasir_citra_batches_v1',
      'kasir_citra_refunds_v1',
      'kasir_citra_waste_v1',
      'kasir_citra_settings_v1',
      'kasir_citra_current_shift_v1',
      'kasir_citra_shift_history_v1',
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
