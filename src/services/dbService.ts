import { invoke } from '@tauri-apps/api/core';
import {
  PurchaseReceipt,
  Product,
  CategoryMarkupSetting,
  Transaction,
  PreOrderSchedule,
  Buyer,
  StoreSetting,
  Discount
} from '../types';

/**
 * Native Tauri Database Service
 * Pure Rust backend IPC communication connecting directly to PostgreSQL.
 */
export const dbService = {
  // 1. PRODUCTS & INVENTORY
  async getProducts(): Promise<Product[]> {
    return await invoke<Product[]>('db_get_products');
  },

  async upsertProduct(product: Product): Promise<string> {
    return await invoke<string>('db_upsert_product', { product });
  },

  async updateStockAndPrice(
    productId: string,
    addedStock: number,
    buyPrice: number,
    sellPrice: number
  ): Promise<void> {
    await invoke('db_update_stock_and_price', {
      productId,
      addedStock,
      buyPrice,
      sellPrice
    });
  },

  async deleteProduct(productId: string): Promise<void> {
    await invoke('db_delete_product', { productId });
  },

  // BUG-014 FIX: struk thermal (teks 32 kolom) dibangun di Rust dari data transaksi lengkap
  async generateReceiptText(tx: Record<string, unknown>, storeName?: string): Promise<string> {
    return await invoke<string>('generate_receipt_text', {
      tx,
      storeName: storeName || null
    });
  },

  // 2. CATEGORIES / VENDORS & MARKUPS
  async getMarkups(): Promise<CategoryMarkupSetting[]> {
    return await invoke<CategoryMarkupSetting[]>('db_get_markups');
  },

  async updateMarkup(category: string, markupPercent: number): Promise<void> {
    await invoke('db_update_markup', { category, markupPercent });
  },

  async createMarkup(category: string, markupPercent: number, description?: string): Promise<void> {
    await invoke('db_create_markup', {
      category,
      markupPercent,
      description: description || null
    });
  },

  async deleteMarkup(category: string): Promise<void> {
    await invoke('db_delete_markup', { category });
  },

  // 3. BUYERS / CUSTOMERS & LOYALTY
  async getBuyers(): Promise<Buyer[]> {
    return await invoke<Buyer[]>('db_get_buyers');
  },

  async upsertBuyer(buyer: Buyer): Promise<string> {
    return await invoke<string>('db_upsert_buyer', { buyer });
  },

  async deleteBuyer(id: string): Promise<void> {
    await invoke('db_delete_buyer', { id });
  },

  // 4. DISCOUNTS & PROMO VOUCHERS
  async getDiscounts(): Promise<Discount[]> {
    return await invoke<Discount[]>('db_get_discounts');
  },

  async upsertDiscount(discount: Discount): Promise<string> {
    return await invoke<string>('db_upsert_discount', { discount });
  },

  async deleteDiscount(id: string): Promise<void> {
    await invoke('db_delete_discount', { id });
  },

  async toggleDiscount(id: string, isActive: boolean): Promise<void> {
    await invoke('db_toggle_discount', { id, isActive });
  },

  // 5. WHITE-LABEL STORE SETTINGS & BRANDING
  async getSettings(): Promise<StoreSetting[]> {
    return await invoke<StoreSetting[]>('db_get_settings');
  },

  async updateSetting(key: string, value: string): Promise<void> {
    await invoke('db_update_setting', { key, value });
  },

  // 6. TRANSACTIONS / LEDGER
  async getTransactions(): Promise<Transaction[]> {
    return await invoke<Transaction[]>('db_get_transactions');
  },

  async createTransaction(tx: Transaction, memberId?: string): Promise<string> {
    return await invoke<string>('db_create_transaction', { tx, memberId: memberId || null });
  },

  async updateTransactionStatus(id: string, paymentStatus: 'LUNAS' | 'TEMPO'): Promise<void> {
    await invoke('db_update_transaction_status', { id, paymentStatus });
  },

  async deleteTransaction(id: string): Promise<void> {
    await invoke('db_delete_transaction', { id });
  },
  async deletePreOrder(id: string): Promise<void> {
    await invoke('db_delete_preorder', { id });
  },
  async getPurchases(): Promise<PurchaseReceipt[]> { return invoke('db_get_purchases'); },
  async savePurchase(receipt: PurchaseReceipt): Promise<void> { await invoke('db_save_purchase', { receipt }); },
  async deletePurchase(id: string): Promise<void> { await invoke('db_delete_purchase', { id }); },
  async importPurchases(receipts: PurchaseReceipt[]): Promise<void> { await invoke('db_import_purchases', { receipts }); },
  // 7. PRE-ORDERS
  async getPreOrders(): Promise<PreOrderSchedule[]> {
    return await invoke<PreOrderSchedule[]>('db_get_preorders');
  },

  async savePreOrder(record: PreOrderSchedule): Promise<string> {
    return await invoke<string>('db_save_preorder', { record });
  },

  // 8. SYSTEM & EXPORT
  async saveExportFile(filename: string, data: number[]): Promise<string> {
    return await invoke<string>('save_export_file', { filename, data });
  }
};
