import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Product, CategoryMarkupSetting, SupplierCategory } from '../types';
import { dbService } from '../services/dbService';
import { syncService } from '../services/syncService';

const STORAGE_KEY_PRODUCTS = 'kasir_citra_products_v1';
const STORAGE_KEY_MARKUPS = 'kasir_citra_markups_v1';

export const useInventoryStore = defineStore('inventory', () => {
  const showProductSidebar = ref(false);
  const activeProductForSidebar = ref<Product | null>(null);
  const showVendorSidebar = ref(false);
  const activeVendorForSidebar = ref<CategoryMarkupSetting | null>(null);
  const savedProducts = localStorage.getItem(STORAGE_KEY_PRODUCTS);
  const products = ref<Product[]>(savedProducts ? JSON.parse(savedProducts) : []);

  const savedMarkups = localStorage.getItem(STORAGE_KEY_MARKUPS);
  const categoryMarkups = ref<CategoryMarkupSetting[]>(
    savedMarkups ? JSON.parse(savedMarkups) : []
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

      products.value = prodData || [];
      categoryMarkups.value = markupData || [];
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
        if (updates.defaultMarkupPercent !== undefined) {
          await dbService.updateMarkup(category, updates.defaultMarkupPercent);
        }
      } catch (err) {
        console.warn('[Sync] Offline: enqueued category update for sync:', err);
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
      await dbService.createMarkup(trimmed, defaultMarkupPercent, description);
    } catch (err) {
      console.warn('[Sync] Offline: enqueued create category for sync:', err);
      syncService.enqueue('CREATE_MARKUP', { category: trimmed, markupPercent: defaultMarkupPercent, description });
    }
  }

  async function deleteCategory(category: string): Promise<boolean> {
    categoryMarkups.value = categoryMarkups.value.filter(c => c.category !== category);
    saveLocal();
    try {
      await dbService.deleteMarkup(category);
      return true;
    } catch (err: any) {
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

  async function addProduct(newProd: Omit<Product, 'id'>): Promise<Product> {
    const id = `prod-${Date.now()}`;
    const product: Product = { ...newProd, id };

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
    saveLocal,
  };
});
