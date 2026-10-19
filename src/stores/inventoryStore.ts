import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Product, CategoryMarkupSetting, SupplierCategory } from '../types';
import { INITIAL_PRODUCTS, INITIAL_CATEGORY_MARKUPS } from '../data/initialProducts';
import { dbService } from '../services/dbService';

const STORAGE_KEY_PRODUCTS = 'kasir_citra_products_v1';
const STORAGE_KEY_MARKUPS = 'kasir_citra_markups_v1';

export const useInventoryStore = defineStore('inventory', () => {
  const showProductSidebar = ref(false);
  const activeProductForSidebar = ref<Product | null>(null);
  const showVendorSidebar = ref(false);
  const activeVendorForSidebar = ref<CategoryMarkupSetting | null>(null);
  const savedProducts = localStorage.getItem(STORAGE_KEY_PRODUCTS);
  const products = ref<Product[]>(savedProducts ? JSON.parse(savedProducts) : INITIAL_PRODUCTS);

  const savedMarkups = localStorage.getItem(STORAGE_KEY_MARKUPS);
  const categoryMarkups = ref<CategoryMarkupSetting[]>(
    savedMarkups ? JSON.parse(savedMarkups) : INITIAL_CATEGORY_MARKUPS
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

      if (prodData && prodData.length > 0) {
        products.value = prodData;
      }
      if (markupData && markupData.length > 0) {
        categoryMarkups.value = markupData;
      }
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

  async function updateCategoryMarkup(category: SupplierCategory, percent: number) {
    const found = categoryMarkups.value.find(c => c.category === category);
    if (found) {
      const oldPercent = found.defaultMarkupPercent;
      try {
        await dbService.updateMarkup(category, percent);
        found.defaultMarkupPercent = percent;
        saveLocal();
      } catch (err) {
        found.defaultMarkupPercent = oldPercent;
        console.error('Failed to sync markup to Rust backend:', err);
        throw err;
      }
    }
  }

  async function addCategory(category: string, defaultMarkupPercent = 20, description?: string) {
    const trimmed = category.trim();
    if (!trimmed) return;
    const existing = categoryMarkups.value.find(c => c.category.toLowerCase() === trimmed.toLowerCase());
    if (existing) return;

    const newMarkup: CategoryMarkupSetting = {
      category: trimmed,
      defaultMarkupPercent,
      description: description || ''
    };

    try {
      await dbService.createMarkup(trimmed, defaultMarkupPercent, description);
      categoryMarkups.value.push(newMarkup);
      saveLocal();
    } catch (err) {
      console.error('Failed to create category in Rust backend:', err);
      throw err;
    }
  }

  // BUG-003 FIX: Hapus kategori hanya setelah DB berhasil (DB-first)
  async function deleteCategory(category: string): Promise<boolean> {
    try {
      await dbService.deleteMarkup(category);
      categoryMarkups.value = categoryMarkups.value.filter(c => c.category !== category);
      saveLocal();
      return true;
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Gagal menghapus kategori';
      alert(msg);
      return false;
    }
  }

  async function updateProductPrices(productId: string, lastBuyPrice: number, lastSellPrice: number) {
    const prod = products.value.find(p => p.id === productId);
    if (prod) {
      const oldBuy = prod.lastBuyPrice;
      const oldSell = prod.lastSellPrice;
      try {
        prod.lastBuyPrice = lastBuyPrice;
        prod.lastSellPrice = lastSellPrice;
        await dbService.upsertProduct(prod);
        saveLocal();
      } catch (err) {
        prod.lastBuyPrice = oldBuy;
        prod.lastSellPrice = oldSell;
        console.error('Failed to sync price update to Rust backend:', err);
        throw err;
      }
    }
  }

  async function updateStockAndPrice(productId: string, addedStock: number, buyPrice: number, sellPrice: number) {
    const prod = products.value.find(p => p.id === productId);
    if (prod) {
      const oldStock = prod.stock;
      const oldBuy = prod.lastBuyPrice;
      const oldSell = prod.lastSellPrice;
      try {
        await dbService.updateStockAndPrice(productId, addedStock, buyPrice, sellPrice);
        prod.stock += addedStock;
        if (buyPrice > 0) prod.lastBuyPrice = buyPrice;
        if (sellPrice > 0) prod.lastSellPrice = sellPrice;
        saveLocal();
      } catch (err) {
        prod.stock = oldStock;
        prod.lastBuyPrice = oldBuy;
        prod.lastSellPrice = oldSell;
        console.error('Failed to sync stock to Rust backend:', err);
        throw err;
      }
    }
  }

  async function addProduct(newProd: Omit<Product, 'id'>): Promise<Product> {
    const id = `prod-${Date.now()}`;
    const product: Product = { ...newProd, id };

    try {
      await dbService.upsertProduct(product);
      products.value.push(product);
      saveLocal();
      return product;
    } catch (err) {
      console.error('Failed to sync new product to Rust backend:', err);
      throw err;
    }
  }

  async function updateProduct(product: Product) {
    const idx = products.value.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      const old = { ...products.value[idx] };
      try {
        await dbService.upsertProduct(product);
        products.value[idx] = { ...product };
        saveLocal();
      } catch (e) {
        products.value[idx] = old;
        console.error('Failed to update product in DB:', e);
        throw e;
      }
    }
  }

  // BUG-002 FIX: Hapus produk dengan sinkronisasi ke DB
  async function deleteProduct(id: string): Promise<boolean> {
    try {
      await dbService.deleteProduct(id);
      products.value = products.value.filter(p => p.id !== id);
      saveLocal();
      return true;
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message || 'Gagal menghapus produk';
      alert(msg);
      return false;
    }
  }

  function resetToDefaults() {
    products.value = [...INITIAL_PRODUCTS];
    categoryMarkups.value = [...INITIAL_CATEGORY_MARKUPS];
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
    updateCategoryMarkup,
    addCategory,
    deleteCategory,
    updateProductPrices,
    updateStockAndPrice,
    addProduct,
    updateProduct,
    deleteProduct,
    resetToDefaults,
  };
});
