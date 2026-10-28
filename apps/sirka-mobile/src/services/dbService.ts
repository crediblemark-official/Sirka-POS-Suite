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
 * Deteksi apakah runtime Tauri (Desktop / Mobile IPC) tersedia.
 * Di web browser biasa (Chrome, Firefox dev preview), window.__TAURI_INTERNALS__ tidak ada.
 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI_INTERNALS__?.invoke ||
    (window as any).__TAURI__?.invoke ||
    ((window as any).__TAURI_INTERNALS__ && typeof (window as any).__TAURI_INTERNALS__.invoke === 'function')
  );
}

/** Helper localStorage untuk mode Web Browser Dev Preview */
function getLocal<T>(key: string, defaultValue: T): T {
  if (typeof localStorage === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocal<T>(key: string, value: T): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`[dbService] Gagal simpan ke localStorage '${key}':`, err);
  }
}

async function safeInvoke<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  fallback: () => Promise<T> | T
): Promise<T> {
  if (isTauri()) {
    try {
      return await invoke<T>(cmd, args);
    } catch (err) {
      console.warn(`[dbService] Tauri command '${cmd}' gagal, menggunakan fallback:`, err);
      return await fallback();
    }
  }
  return await fallback();
}

/**
 * Native Tauri Database Service dengan Web Preview Fallback
 * Pure Rust backend IPC communication connecting directly to PostgreSQL / SQLite,
 * dengan graceful localStorage fallback untuk browser dev preview.
 */
export const dbService = {
  // 0. ENVIRONMENT
  isTauri(): boolean {
    return isTauri();
  },

  // 1. PRODUCTS & INVENTORY
  async getProducts(): Promise<Product[]> {
    return safeInvoke<Product[]>('db_get_products', undefined, () =>
      getLocal<Product[]>('kasir_citra_products_v1', [])
    );
  },

  async upsertProduct(product: Product): Promise<string> {
    return safeInvoke<string>('db_upsert_product', { product }, () => {
      const list = getLocal<Product[]>('kasir_citra_products_v1', []);
      const idx = list.findIndex(p => p.id === product.id);
      if (idx >= 0) list[idx] = product;
      else list.push(product);
      setLocal('kasir_citra_products_v1', list);
      return product.id;
    });
  },

  async updateStockAndPrice(
    productId: string,
    addedStock: number,
    buyPrice: number,
    sellPrice: number
  ): Promise<void> {
    return safeInvoke('db_update_stock_and_price', {
      productId,
      addedStock,
      buyPrice,
      sellPrice
    }, () => {
      const list = getLocal<Product[]>('kasir_citra_products_v1', []);
      const prod = list.find(p => p.id === productId);
      if (prod) {
        prod.stock += addedStock;
        if (buyPrice > 0) prod.lastBuyPrice = buyPrice;
        if (sellPrice > 0) prod.lastSellPrice = sellPrice;
        setLocal('kasir_citra_products_v1', list);
      }
    });
  },

  async deleteProduct(productId: string): Promise<void> {
    return safeInvoke('db_delete_product', { productId }, () => {
      const list = getLocal<Product[]>('kasir_citra_products_v1', []).filter(p => p.id !== productId);
      setLocal('kasir_citra_products_v1', list);
    });
  },

  // Struk thermal (teks 32 atau 42 kolom) dibangun di Rust dari data transaksi lengkap
  async generateReceiptText(tx: Record<string, unknown>, storeName?: string, paperWidth?: string): Promise<string> {
    return safeInvoke<string>('generate_receipt_text', {
      tx,
      storeName: storeName || null,
      paperWidth: paperWidth || null
    }, () => {
      const name = storeName || 'SIRKA POS';
      const id = String(tx.id || 'TX-DEMO');
      const total = Number(tx.total || 0).toLocaleString('id-ID');
      return `================================\n        ${name}\n================================\nNo: ${id}\nTotal: Rp ${total}\nStatus: LUNAS\n--------------------------------\nTerima Kasih atas Kunjungan Anda\n================================\n`;
    });
  },

  // Tiket Pesanan Dapur / Bar (KOT) tanpa harga finansial
  async generateKitchenTicketText(tx: Record<string, unknown>, storeName?: string, paperWidth?: string): Promise<string> {
    return safeInvoke<string>('generate_kitchen_ticket_text', {
      tx,
      storeName: storeName || null,
      paperWidth: paperWidth || null
    }, () => {
      const name = storeName || 'SIRKA POS';
      const table = String(tx.tableNo || tx.buyer || 'Meja Walk-in');
      return `================================\n        ${name}\n*** TIKET DAPUR / BAR ***\n================================\nMeja: ${table}\nNo: ${tx.invoiceNo || tx.id}\n--------------------------------\nPESANAN MENU\n--------------------------------\n-- Mohon Diproses Segera --\n`;
    });
  },

  // Surat Jalan Pengiriman (Delivery Order - DO) untuk B2B
  async generateDeliveryOrderText(tx: Record<string, unknown>, storeName?: string, paperWidth?: string): Promise<string> {
    return safeInvoke<string>('generate_delivery_order_text', {
      tx,
      storeName: storeName || null,
      paperWidth: paperWidth || null
    }, () => {
      const name = storeName || 'SIRKA POS';
      const buyer = String(tx.buyer || 'Pelanggan');
      return `================================\n        ${name}\nSURAT JALAN PENGIRIMAN\n================================\nNo. DO: DO-${tx.invoiceNo || tx.id}\nPenerima: ${buyer}\n--------------------------------\nPengirim:          Penerima:\n(...............)  (...............)\n`;
    });
  },

  // Mengirim byte ESC/POS langsung ke Network Thermal Printer / Simulator (default 127.0.0.1:9100)
  async printToNetworkPrinter(text: string, address?: string): Promise<string> {
    return safeInvoke<string>('print_to_network_printer', {
      text,
      address: address || null
    }, () => 'OK (Web Simulation: Network Printer)');
  },

  // Mendapatkan daftar perangkat Bluetooth yang terpasang di sistem
  async getBluetoothDevices(): Promise<Array<{ name: string; mac: string }>> {
    return safeInvoke<Array<{ name: string; mac: string }>>('get_bluetooth_devices', undefined, () => []);
  },

  // Mengirim byte ESC/POS langsung ke Printer Thermal Bluetooth (RFCOMM SPP)
  async printToBluetoothPrinter(text: string, mac?: string, channel?: number): Promise<string> {
    return safeInvoke<string>('print_to_bluetooth_printer', {
      text,
      mac: mac || null,
      channel: channel || null
    }, () => 'OK (Web Simulation: Bluetooth Printer)');
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
    return safeInvoke('detect_printer_status', undefined, () => ({
      recommended_mode: 'system',
      usb_available: false,
      usb_device_path: null,
      bluetooth_available: false,
      bluetooth_device_name: null,
      bluetooth_mac: null,
      status_text: isTauri() ? 'Menghubungkan printer...' : 'Mode Web Browser Preview'
    }));
  },

  // Mencetak langsung ke printer USB (/dev/usb/lp0)
  async printToUsbPrinter(text: string, devicePath?: string): Promise<string> {
    return safeInvoke<string>('print_to_usb_printer', {
      text,
      devicePath: devicePath || null
    }, () => 'OK (Web Simulation: USB Printer)');
  },

  // 2. CATEGORIES / VENDORS & MARKUPS
  async getMarkups(): Promise<CategoryMarkupSetting[]> {
    return safeInvoke<CategoryMarkupSetting[]>('db_get_markups', undefined, () =>
      getLocal<CategoryMarkupSetting[]>('kasir_citra_markups_v1', [])
    );
  },

  async updateMarkup(category: string, markupPercent: number): Promise<void> {
    return safeInvoke('db_update_markup', { category, markupPercent }, () => {
      const list = getLocal<CategoryMarkupSetting[]>('kasir_citra_markups_v1', []);
      const item = list.find(c => c.category === category);
      if (item) {
        item.defaultMarkupPercent = markupPercent;
        setLocal('kasir_citra_markups_v1', list);
      }
    });
  },

  async createMarkup(
    category: string,
    markupPercent: number,
    description?: string,
    color?: string
  ): Promise<void> {
    return safeInvoke('db_create_markup', {
      category,
      markupPercent,
      description: description || null,
      color: color || null
    }, () => {
      const list = getLocal<CategoryMarkupSetting[]>('kasir_citra_markups_v1', []);
      const idx = list.findIndex(c => c.category === category);
      const entry: CategoryMarkupSetting = {
        category: category as any,
        defaultMarkupPercent: markupPercent,
        description: description || '',
        color: color || '#64748b'
      };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      setLocal('kasir_citra_markups_v1', list);
    });
  },

  async updateMarkupFull(
    category: string,
    markupPercent: number,
    description?: string,
    color?: string
  ): Promise<void> {
    return safeInvoke('db_update_markup_full', {
      category,
      markupPercent,
      description: description || null,
      color: color || null
    }, () => {
      const list = getLocal<CategoryMarkupSetting[]>('kasir_citra_markups_v1', []);
      const idx = list.findIndex(c => c.category === category);
      const entry: CategoryMarkupSetting = {
        category: category as any,
        defaultMarkupPercent: markupPercent,
        description: description || '',
        color: color || '#64748b'
      };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);
      setLocal('kasir_citra_markups_v1', list);
    });
  },

  async deleteMarkup(category: string): Promise<void> {
    return safeInvoke('db_delete_markup', { category }, () => {
      const list = getLocal<CategoryMarkupSetting[]>('kasir_citra_markups_v1', []).filter(c => c.category !== category);
      setLocal('kasir_citra_markups_v1', list);
    });
  },

  // 3. BUYERS / CUSTOMERS & LOYALTY
  async getBuyers(): Promise<Buyer[]> {
    return safeInvoke<Buyer[]>('db_get_buyers', undefined, () =>
      getLocal<Buyer[]>('kasir_citra_buyers_v3', [])
    );
  },

  async upsertBuyer(buyer: Buyer): Promise<string> {
    return safeInvoke<string>('db_upsert_buyer', { buyer }, () => {
      const list = getLocal<Buyer[]>('kasir_citra_buyers_v3', []);
      const idx = list.findIndex(b => b.id === buyer.id);
      if (idx >= 0) list[idx] = buyer;
      else list.push(buyer);
      setLocal('kasir_citra_buyers_v3', list);
      return buyer.id;
    });
  },

  async deleteBuyer(id: string): Promise<void> {
    return safeInvoke('db_delete_buyer', { id }, () => {
      const list = getLocal<Buyer[]>('kasir_citra_buyers_v3', []).filter(b => b.id !== id);
      setLocal('kasir_citra_buyers_v3', list);
    });
  },

  // 4. DISCOUNTS & PROMO VOUCHERS
  async getDiscounts(): Promise<Discount[]> {
    return safeInvoke<Discount[]>('db_get_discounts', undefined, () =>
      getLocal<Discount[]>('kasir_citra_discounts_v1', [])
    );
  },

  async upsertDiscount(discount: Discount): Promise<string> {
    return safeInvoke<string>('db_upsert_discount', { discount }, () => {
      const list = getLocal<Discount[]>('kasir_citra_discounts_v1', []);
      const idx = list.findIndex(d => d.id === discount.id);
      if (idx >= 0) list[idx] = discount;
      else list.push(discount);
      setLocal('kasir_citra_discounts_v1', list);
      return discount.id;
    });
  },

  async deleteDiscount(id: string): Promise<void> {
    return safeInvoke('db_delete_discount', { id }, () => {
      const list = getLocal<Discount[]>('kasir_citra_discounts_v1', []).filter(d => d.id !== id);
      setLocal('kasir_citra_discounts_v1', list);
    });
  },

  async toggleDiscount(id: string, isActive: boolean): Promise<void> {
    return safeInvoke('db_toggle_discount', { id, isActive }, () => {
      const list = getLocal<Discount[]>('kasir_citra_discounts_v1', []);
      const item = list.find(d => d.id === id);
      if (item) {
        item.isActive = isActive;
        setLocal('kasir_citra_discounts_v1', list);
      }
    });
  },

  // 5. WHITE-LABEL STORE SETTINGS & BRANDING
  async getSettings(): Promise<StoreSetting[]> {
    return safeInvoke<StoreSetting[]>('db_get_settings', undefined, () => {
      const raw = getLocal<any>('kasir_citra_settings_v1', []);
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object') {
        return Object.entries(raw).map(([key, value]) => ({ key, value: String(value) }));
      }
      return [];
    });
  },

  async updateSetting(key: string, value: string): Promise<void> {
    return safeInvoke('db_update_setting', { key, value }, () => {
      const raw = getLocal<any>('kasir_citra_settings_v1', {});
      if (Array.isArray(raw)) {
        const idx = raw.findIndex((s: any) => s && s.key === key);
        if (idx >= 0) raw[idx].value = value;
        else raw.push({ key, value });
        setLocal('kasir_citra_settings_v1', raw);
      } else if (raw && typeof raw === 'object') {
        raw[key] = value;
        setLocal('kasir_citra_settings_v1', raw);
      } else {
        setLocal('kasir_citra_settings_v1', { [key]: value });
      }
    });
  },

  // 6. TRANSACTIONS / LEDGER
  async getTransactions(): Promise<Transaction[]> {
    return safeInvoke<Transaction[]>('db_get_transactions', undefined, () =>
      getLocal<Transaction[]>('kasir_citra_ledger_v1', [])
    );
  },

  async createTransaction(tx: Transaction, memberId?: string): Promise<string> {
    return safeInvoke<string>('db_create_transaction', { tx, memberId: memberId || null }, () => {
      const list = getLocal<Transaction[]>('kasir_citra_ledger_v1', []);
      list.unshift(tx);
      setLocal('kasir_citra_ledger_v1', list);
      return tx.id;
    });
  },

  async updateTransactionStatus(id: string, paymentStatus: 'LUNAS' | 'TEMPO'): Promise<void> {
    return safeInvoke('db_update_transaction_status', { id, paymentStatus }, () => {
      const list = getLocal<Transaction[]>('kasir_citra_ledger_v1', []);
      const tx = list.find(t => t.id === id);
      if (tx) {
        tx.paymentStatus = paymentStatus;
        setLocal('kasir_citra_ledger_v1', list);
      }
    });
  },

  async deleteTransaction(id: string): Promise<void> {
    return safeInvoke('db_delete_transaction', { id }, () => {
      const list = getLocal<Transaction[]>('kasir_citra_ledger_v1', []).filter(t => t.id !== id);
      setLocal('kasir_citra_ledger_v1', list);
    });
  },

  async deletePreOrder(id: string): Promise<void> {
    return safeInvoke('db_delete_preorder', { id }, () => {
      const list = getLocal<PreOrderSchedule[]>('kasir_citra_preorders_v2', []).filter(p => p.id !== id);
      setLocal('kasir_citra_preorders_v2', list);
    });
  },

  async getPurchases(): Promise<PurchaseReceipt[]> {
    return safeInvoke<PurchaseReceipt[]>('db_get_purchases', undefined, () =>
      getLocal<PurchaseReceipt[]>('kasir_citra_purchases_v1', [])
    );
  },

  async savePurchase(receipt: PurchaseReceipt): Promise<void> {
    return safeInvoke('db_save_purchase', { receipt }, () => {
      const list = getLocal<PurchaseReceipt[]>('kasir_citra_purchases_v1', []);
      const idx = list.findIndex(p => p.id === receipt.id);
      if (idx >= 0) list[idx] = receipt;
      else list.push(receipt);
      setLocal('kasir_citra_purchases_v1', list);
    });
  },

  async deletePurchase(id: string): Promise<void> {
    return safeInvoke('db_delete_purchase', { id }, () => {
      const list = getLocal<PurchaseReceipt[]>('kasir_citra_purchases_v1', []).filter(p => p.id !== id);
      setLocal('kasir_citra_purchases_v1', list);
    });
  },

  async importPurchases(receipts: PurchaseReceipt[]): Promise<void> {
    return safeInvoke('db_import_purchases', { receipts }, () => {
      const list = getLocal<PurchaseReceipt[]>('kasir_citra_purchases_v1', []);
      for (const r of receipts) {
        const idx = list.findIndex(p => p.id === r.id);
        if (idx >= 0) list[idx] = r;
        else list.push(r);
      }
      setLocal('kasir_citra_purchases_v1', list);
    });
  },

  // 7. PRE-ORDERS
  async getPreOrders(): Promise<PreOrderSchedule[]> {
    return safeInvoke<PreOrderSchedule[]>('db_get_preorders', undefined, () =>
      getLocal<PreOrderSchedule[]>('kasir_citra_preorders_v2', [])
    );
  },

  async savePreOrder(record: PreOrderSchedule): Promise<string> {
    return safeInvoke<string>('db_save_preorder', { record }, () => {
      const list = getLocal<PreOrderSchedule[]>('kasir_citra_preorders_v2', []);
      const idx = list.findIndex(p => p.id === record.id);
      if (idx >= 0) list[idx] = record;
      else list.push(record);
      setLocal('kasir_citra_preorders_v2', list);
      return record.id;
    });
  },

  // 8. SYSTEM, EXPORT & SYNC STATUS
  async saveExportFile(filename: string, data: number[]): Promise<string> {
    return safeInvoke<string>('save_export_file', { filename, data }, () => {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([new Uint8Array(data)], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return `File ${filename} berhasil diunduh.`;
      }
      return 'OK';
    });
  },

  async getSyncStatus(): Promise<{
    is_online: boolean;
    pending_count: number;
    last_sync_time: string | null;
    last_error: string | null;
  }> {
    return safeInvoke('db_get_sync_status', undefined, () => ({
      is_online: false,
      pending_count: 0,
      last_sync_time: null,
      last_error: null
    }));
  },

  async triggerSync(): Promise<{
    is_online: boolean;
    pending_count: number;
    last_sync_time: string | null;
    last_error: string | null;
  }> {
    return safeInvoke('db_trigger_sync', undefined, () => ({
      is_online: false,
      pending_count: 0,
      last_sync_time: null,
      last_error: null
    }));
  },

  async resetCache(): Promise<{
    is_online: boolean;
    pending_count: number;
    last_sync_time: string | null;
    last_error: string | null;
  }> {
    return safeInvoke('db_reset_cache', undefined, () => ({
      is_online: false,
      pending_count: 0,
      last_sync_time: null,
      last_error: null
    }));
  },

  async wipeAllData(wipeCloud: boolean = true): Promise<{
    is_online: boolean;
    pending_count: number;
    last_sync_time: string | null;
    last_error: string | null;
  }> {
    return safeInvoke('db_wipe_all_data', { wipeCloud }, () => ({
      is_online: false,
      pending_count: 0,
      last_sync_time: null,
      last_error: null
    }));
  },

  async enqueueOutbox(action: string, payload: unknown): Promise<number> {
    return safeInvoke<number>('db_enqueue_outbox', { action, payload }, () => 0);
  }
};
