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

  // Struk thermal (teks 32 atau 42 kolom) dibangun di Rust dari data transaksi lengkap
  async generateReceiptText(tx: Record<string, unknown>, storeName?: string, paperWidth?: string): Promise<string> {
    return await invoke<string>('generate_receipt_text', {
      tx,
      storeName: storeName || null,
      paperWidth: paperWidth || null
    });
  },

  // Mengirim byte ESC/POS langsung ke Network Thermal Printer / Simulator (default 127.0.0.1:9100)
  async printToNetworkPrinter(text: string, address?: string): Promise<string> {
    return await invoke<string>('print_to_network_printer', {
      text,
      address: address || null
    });
  },

  // Mendapatkan daftar perangkat Bluetooth yang terpasang di sistem
  async getBluetoothDevices(): Promise<Array<{ name: string; mac: string }>> {
    return await invoke<Array<{ name: string; mac: string }>>('get_bluetooth_devices');
  },

  // Mengirim byte ESC/POS langsung ke Printer Thermal Bluetooth (RFCOMM SPP)
  async printToBluetoothPrinter(text: string, mac?: string, channel?: number): Promise<string> {
    return await invoke<string>('print_to_bluetooth_printer', {
      text,
      mac: mac || null,
      channel: channel || null
    });
  },

  // Mendeteksi printer thermal yang aktif secara dinamis (USB / Bluetooth / System)
  async detectPrinterStatus(): Promise<{
    recommended_mode: 'usb' | 'bluetooth' | 'system';
    usb_available: boolean;
    usb_device_path: string | null;
    bluetooth_available: boolean;
    bluetooth_device_name: string | null;
    bluetooth_mac: string | null;
    status_text: string;
  }> {
    return await invoke('detect_printer_status');
  },

  // Mencetak langsung ke printer USB (/dev/usb/lp0)
  async printToUsbPrinter(text: string, devicePath?: string): Promise<string> {
    return await invoke<string>('print_to_usb_printer', {
      text,
      devicePath: devicePath || null
    });
  },

  // 2. CATEGORIES / VENDORS & MARKUPS
  async getMarkups(): Promise<CategoryMarkupSetting[]> {
    return await invoke<CategoryMarkupSetting[]>('db_get_markups');
  },

  async updateMarkup(category: string, markupPercent: number): Promise<void> {
    await invoke('db_update_markup', { category, markupPercent });
  },

  async createMarkup(
    category: string,
    markupPercent: number,
    description?: string,
    color?: string
  ): Promise<void> {
    await invoke('db_create_markup', {
      category,
      markupPercent,
      description: description || null,
      color: color || null
    });
  },

  /**
   * BUG FIX: update kategori harus ikut menyimpan warna + deskripsi.
   * Sebelumnya `dbService.updateMarkup` hanya mengirim margin sehingga warna
   * kategori hilang setiap kali master dimuat ulang dari database.
   */
  async updateMarkupFull(
    category: string,
    markupPercent: number,
    description?: string,
    color?: string
  ): Promise<void> {
    await invoke('db_update_markup_full', {
      category,
      markupPercent,
      description: description || null,
      color: color || null
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

  // 8. SYSTEM, EXPORT & SYNC STATUS
  async saveExportFile(filename: string, data: number[]): Promise<string> {
    return await invoke<string>('save_export_file', { filename, data });
  },

  async getSyncStatus(): Promise<{
    is_online: boolean;
    pending_count: number;
    last_sync_time: string | null;
    last_error: string | null;
  }> {
    return await invoke('db_get_sync_status');
  },

  async triggerSync(): Promise<{
    is_online: boolean;
    pending_count: number;
    last_sync_time: string | null;
    last_error: string | null;
  }> {
    return await invoke('db_trigger_sync');
  },

  async resetCache(): Promise<{
    is_online: boolean;
    pending_count: number;
    last_sync_time: string | null;
    last_error: string | null;
  }> {
    return await invoke('db_reset_cache');
  },

  async wipeAllData(wipeCloud: boolean = true): Promise<{
    is_online: boolean;
    pending_count: number;
    last_sync_time: string | null;
    last_error: string | null;
  }> {
    return await invoke('db_wipe_all_data', { wipeCloud });
  },

  /**
   * BUG FIX: antrean outbox harus bisa diisi dari sisi frontend.
   * Tanpa ini, fallback "offline" pada semua store membuang data karena
   * `syncService.enqueue()` hanya memanggil triggerSync tanpa menyimpan apa pun.
   */
  async enqueueOutbox(action: string, payload: unknown): Promise<number> {
    return await invoke<number>('db_enqueue_outbox', { action, payload });
  }
};
