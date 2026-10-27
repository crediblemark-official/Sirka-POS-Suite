import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Product, CategoryMarkupSetting, SupplierCategory } from '@sirka/shared-types';
import { dbService } from '../services/dbService';
import { syncService } from '../services/syncService';
import { safeParse } from '@sirka/shared-utils';
import { resolveProductSupplier } from '@sirka/shared-utils';

const STORAGE_KEY_PRODUCTS = 'kasir_citra_products_v1';
const STORAGE_KEY_MARKUPS = 'kasir_citra_markups_v1';

export const useInventoryStore = defineStore('inventory', () => {
  const showProductSidebar = ref(false);
  const activeProductForSidebar = ref<Product | null>(null);
  const showVendorSidebar = ref(false);
  const activeVendorForSidebar = ref<CategoryMarkupSetting | null>(null);
  const savedProducts = localStorage.getItem(STORAGE_KEY_PRODUCTS);
  const initialProducts = safeParse<Product[]>(savedProducts, [], 'InventoryStore');
  const products = ref<Product[]>(
    initialProducts.map(p => ({
      ...p,
      supplier: resolveProductSupplier(p)
    }))
  );

  const savedMarkups = localStorage.getItem(STORAGE_KEY_MARKUPS);
  const categoryMarkups = ref<CategoryMarkupSetting[]>(
    safeParse<CategoryMarkupSetting[]>(savedMarkups, [], 'InventoryStore')
  );

  const isConnectedToPg = ref(false);

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products.value));
    localStorage.setItem(STORAGE_KEY_MARKUPS, JSON.stringify(categoryMarkups.value));
  }

  // Fetch initial data from PostgreSQL via Rust Backend
  async function fetchFromDb() {
    try {
      const [prodData, markupData] = await Promise.all([
        dbService.getProducts(),
        dbService.getMarkups()
      ]);

      // BUG FIX: `fetchFromDb()` sebelumnya mengganti SELURUH array sehingga field
      // yang hanya tersimpan lokal (units multi-satuan, warna kategori) hilang
      // setiap kali app start / setelah setiap penjualan. Sekarang digabung:
      // data dari DB dipakai, tetapi field lokal dipertahankan bila DB belum
      // memilikinya (mis. database lama sebelum migrasi).
      const dbProducts = prodData || [];
      const localById = new Map(products.value.map(p => [p.id, p]));
      const merged = dbProducts.map(p => {
        const local = localById.get(p.id);
        const resolvedSupplier = p.supplier || (local && local.supplier) || resolveProductSupplier(p);
        if (!local) return { ...p, supplier: resolvedSupplier };
        return {
          ...local,
          ...p,
          supplier: resolvedSupplier,
          units: (p.units && p.units.length) ? p.units : local.units,
          isPerishable: p.isPerishable ?? local.isPerishable ?? false
        };
      });
      // BUG FIX: produk/kategori yang HANYA ada di lokal (mis. upsert ke DB
      // gagal saat offline) sebelumnya HILANG dari UI setiap kali
      // `fetchFromDb()` dipanggil — dan itu terjadi setelah SETIAP penjualan.
      // Sekarang entri lokal yang tidak ada di DB tetap dipertahankan.
      const dbIds = new Set(dbProducts.map(p => p.id));
      const localOnly = products.value
        .filter(p => p && p.id && !dbIds.has(p.id))
        .map(p => ({ ...p, supplier: resolveProductSupplier(p) }));
      products.value = [...merged, ...localOnly];

      const dbMarkups = markupData || [];
      const localMarkupByCat = new Map(categoryMarkups.value.map(c => [c.category, c]));
      const mergedMarkups = dbMarkups.map(c => {
        const local = localMarkupByCat.get(c.category);
        if (!local) return c;
        return {
          ...local,
          ...c,
          color: c.color || local.color,
          description: c.description ?? local.description ?? ''
        };
      });
      const dbCats = new Set(dbMarkups.map(c => c.category));
      const localOnlyMarkups = categoryMarkups.value.filter(
        c => c && c.category && !dbCats.has(c.category)
      );
      categoryMarkups.value = [...mergedMarkups, ...localOnlyMarkups];

      isConnectedToPg.value = true;
      saveLocal();
    } catch (e) {
      console.warn('[Sync] Offline or fallback:', e);
      isConnectedToPg.value = false;
    }
  }

  // Auto-fetch on store creation
  fetchFromDb();

  function getCategoryMarkup(category: SupplierCategory): number {
    const found = categoryMarkups.value.find(c => c.category === category);
    return found ? found.defaultMarkupPercent : 20;
  }

  function getCategoryColor(category: SupplierCategory): string | undefined {
    const found = categoryMarkups.value.find(c => c.category === category);
    return found?.color;
  }

  async function updateCategoryMarkup(category: SupplierCategory, percent: number) {
    const found = categoryMarkups.value.find(c => c.category === category);
    if (found) {
      found.defaultMarkupPercent = percent;
      saveLocal();
      try {
        await dbService.updateMarkup(category, percent);
      } catch (err) {
        console.warn('[Sync] Offline: enqueued category markup update for sync:', err);
        syncService.enqueue('UPDATE_MARKUP', { category, markupPercent: percent });
      }
    }
  }

  async function updateCategory(category: SupplierCategory, updates: Partial<CategoryMarkupSetting>) {
    const found = categoryMarkups.value.find(c => c.category === category);
    if (found) {
      Object.assign(found, updates);
      saveLocal();
      try {
        // BUG FIX: warna kategori harus ikut disimpan ke DB, kalau tidak fitur
        // kisi produk berwarna kategori selalu kembali ke warna acak.
        await dbService.updateMarkupFull(
          category,
          found.defaultMarkupPercent,
          found.description,
          found.color
        );
      } catch (err) {
        console.warn('[Sync] Offline: enqueued category update for sync:', err);
        syncService.enqueue('UPDATE_MARKUP', {
          category,
          markupPercent: found.defaultMarkupPercent,
          description: found.description,
          color: found.color
        });
      }
    }
  }

  async function addCategory(category: string, defaultMarkupPercent = 20, description?: string, color?: string) {
    const trimmed = category.trim();
    if (!trimmed) return;
    const existing = categoryMarkups.value.find(c => c.category.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      if (color) existing.color = color;
      if (description) existing.description = description;
      saveLocal();
      try {
        await dbService.updateMarkupFull(
          existing.category,
          existing.defaultMarkupPercent,
          existing.description,
          existing.color
        );
      } catch (err) {
        console.warn('[Sync] Offline: enqueued category update for sync:', err);
        syncService.enqueue('UPDATE_MARKUP', {
          category: existing.category,
          markupPercent: existing.defaultMarkupPercent,
          description: existing.description,
          color: existing.color
        });
      }
      return;
    }

    const newMarkup: CategoryMarkupSetting = {
      category: trimmed,
      defaultMarkupPercent,
      description: description || '',
      color
    };

    categoryMarkups.value.push(newMarkup);
    saveLocal();

    try {
      await dbService.createMarkup(trimmed, defaultMarkupPercent, description, color);
    } catch (err) {
      console.warn('[Sync] Offline: enqueued create category for sync:', err);
      syncService.enqueue('CREATE_MARKUP', {
        category: trimmed,
        markupPercent: defaultMarkupPercent,
        description,
        color
      });
    }
  }

  async function deleteCategory(category: string): Promise<boolean> {
    // BUG FIX: error PostgreSQL (mis. FK constraint — produk masih memakai
    // kategori ini) sebelumnya ditelan & fungsi tetap mengembalikan `true`.
    // Akibatnya state lokal menghapus kategori sementara cloud tetap
    // menyimpannya -> kategori muncul lagi setelah restart & margin produk
    // kembali ke fallback 20%. Sekarang error FATAL (constraint) dilempar,
    // sedangkan error offline tetap di-enqueue.
    const removed = categoryMarkups.value.filter(c => c.category !== category);
    const previous = categoryMarkups.value;
    categoryMarkups.value = removed;
    saveLocal();
    try {
      await dbService.deleteMarkup(category);
      return true;
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isConstraint = /foreign key|violates|still referenced|does not exist/i.test(msg);
      if (isConstraint) {
        // Kembalikan state lokal — kategori masih dipakai.
        categoryMarkups.value = previous;
        saveLocal();
        throw new Error(
          `Kategori "${category}" masih digunakan oleh produk sehingga tidak bisa dihapus.`
        );
      }
      console.warn('[Sync] Offline: enqueued delete category for sync:', err);
      syncService.enqueue('DELETE_MARKUP', { category });
      return true;
    }
  }

  async function updateProductPrices(productId: string, lastBuyPrice: number, lastSellPrice: number) {
    const prod = products.value.find(p => p.id === productId);
    if (prod) {
      prod.lastBuyPrice = lastBuyPrice;
      prod.lastSellPrice = lastSellPrice;
      saveLocal();
      try {
        await dbService.upsertProduct(prod);
      } catch (err) {
        console.warn('[Sync] Offline: enqueued product price update for sync:', err);
        syncService.enqueue('UPSERT_PRODUCT', { product: prod });
      }
    }
  }

  async function updateStockAndPrice(productId: string, addedStock: number, buyPrice: number, sellPrice: number) {
    const prod = products.value.find(p => p.id === productId);
    if (prod) {
      prod.stock += addedStock;
      if (buyPrice > 0) prod.lastBuyPrice = buyPrice;
      if (sellPrice > 0) prod.lastSellPrice = sellPrice;
      saveLocal();
      try {
        await dbService.updateStockAndPrice(productId, addedStock, buyPrice, sellPrice);
      } catch (err) {
        console.warn('[Sync] Offline: enqueued stock update for sync:', err);
        syncService.enqueue('UPDATE_STOCK_AND_PRICE', { productId, addedStock, buyPrice, sellPrice });
      }
    }
  }

  async function addProduct(newProd: Omit<Product, 'id'> & { id?: string }): Promise<Product> {
    // BUG FIX: id yang diberikan pemanggil harus dihormati. Sebelumnya id selalu
    // di-override dengan `prod-${Date.now()}` sehingga batch / kartu stok / nota
    // kulakan yang memakai id tersebut menunjuk produk yang tidak pernah ada.
    const id = newProd.id || `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const product: Product = { ...newProd, id } as Product;

    products.value.push(product);
    saveLocal();

    try {
      await dbService.upsertProduct(product);
    } catch (err) {
      console.warn('[Sync] Offline: enqueued new product for sync:', err);
      syncService.enqueue('UPSERT_PRODUCT', { product });
    }
    return product;
  }

  async function updateProduct(product: Product) {
    const idx = products.value.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      products.value[idx] = { ...product };
      saveLocal();
      try {
        await dbService.upsertProduct(product);
      } catch (e) {
        console.warn('[Sync] Offline: enqueued update product for sync:', e);
        syncService.enqueue('UPSERT_PRODUCT', { product });
      }
    }
  }

  async function deleteProduct(id: string): Promise<boolean> {
    products.value = products.value.filter(p => p.id !== id);
    saveLocal();
    try {
      await dbService.deleteProduct(id);
      return true;
    } catch (err: any) {
      console.warn('[Sync] Offline: enqueued delete product for sync:', err);
      syncService.enqueue('DELETE_PRODUCT', { id });
      return true;
    }
  }

  function resetToDefaults() {
    products.value = [];
    categoryMarkups.value = [];
    saveLocal();
  }

  /**
   * Enkapsulasi: Kurangi stok produk saat transaksi penjualan.
   * Mengembalikan snapshot status stok sebelum dan sesudah untuk audit log.
   */
  function deductStock(
    productId: string,
    qtyToDeduct: number,
    lastSellPrice?: number
  ): { product: Product; stockBefore: number; stockAfter: number } | null {
    const prod = products.value.find(p => p.id === productId);
    if (!prod) return null;
    const stockBefore = prod.stock;
    prod.stock = Math.max(0, Number((prod.stock - qtyToDeduct).toFixed(4)));
    if (lastSellPrice !== undefined && lastSellPrice > 0) {
      prod.lastSellPrice = lastSellPrice;
    }
    return { product: prod, stockBefore, stockAfter: prod.stock };
  }

  /**
   * Enkapsulasi: Kembalikan stok produk (misalnya saat pembatalan atau retur).
   */
  function restoreStock(
    productId: string,
    qtyToRestore: number
  ): { product: Product; stockBefore: number; stockAfter: number } | null {
    const prod = products.value.find(p => p.id === productId);
    if (!prod) return null;
    const stockBefore = prod.stock;
    prod.stock = Number((prod.stock + qtyToRestore).toFixed(4));
    return { product: prod, stockBefore, stockAfter: prod.stock };
  }

  return {
    showProductSidebar,
    activeProductForSidebar,
    showVendorSidebar,
    activeVendorForSidebar,
    products,
    categoryMarkups,
    isConnectedToPg,
    fetchFromDb,
    getCategoryMarkup,
    getCategoryColor,
    updateCategoryMarkup,
    updateCategory,
    addCategory,
    deleteCategory,
    updateProductPrices,
    updateStockAndPrice,
    addProduct,
    updateProduct,
    deleteProduct,
    resetToDefaults,
    deductStock,
    restoreStock,
    saveLocal,
  };
});
