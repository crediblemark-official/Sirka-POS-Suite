import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Product, CategoryMarkupSetting, SupplierCategory } from '../types';
import { INITIAL_PRODUCTS, INITIAL_CATEGORY_MARKUPS } from '../data/initialProducts';
import { dbService } from '../services/dbService';

const STORAGE_KEY_PRODUCTS = 'kasir_citra_products_v1';
const STORAGE_KEY_MARKUPS = 'kasir_citra_markups_v1';

export const useInventoryStore = defineStore('inventory', () => {
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
      found.defaultMarkupPercent = percent;
      saveLocal();

      try {
        await dbService.updateMarkup(category, percent);
      } catch (err) {
        console.error('Failed to sync markup to Rust backend:', err);
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
    categoryMarkups.value.push(newMarkup);
    saveLocal();

    try {
      await dbService.createMarkup(trimmed, defaultMarkupPercent, description);
    } catch (err) {
      console.error('Failed to create category in Rust backend:', err);
    }
  }

  async function deleteCategory(category: string) {
    categoryMarkups.value = categoryMarkups.value.filter(c => c.category !== category);
    saveLocal();

    try {
      await dbService.deleteMarkup(category);
    } catch (err) {
      console.error('Failed to delete category in Rust backend:', err);
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
        console.error('Failed to sync price update to Rust backend:', err);
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
        console.error('Failed to sync stock to Rust backend:', err);
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
      console.error('Failed to sync new product to Rust backend:', err);
    }

    return product;
  }

  function updateProduct(product: Product) {
    const idx = products.value.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      products.value[idx] = { ...product };
      saveLocal();
      dbService.upsertProduct(product).catch(e => console.warn(e));
    }
  }

  function deleteProduct(id: string) {
    products.value = products.value.filter(p => p.id !== id);
    saveLocal();
  }

  function resetToDefaults() {
    products.value = [...INITIAL_PRODUCTS];
    categoryMarkups.value = [...INITIAL_CATEGORY_MARKUPS];
    saveLocal();
  }

  return {
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
