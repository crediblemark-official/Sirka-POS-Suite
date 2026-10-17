import { invoke } from '@tauri-apps/api/core';
import { Product, CategoryMarkupSetting, Transaction, PreOrderSchedule, Buyer, StoreSetting, Discount } from '../types';

// Check if running inside native Tauri environment
const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const dbService = {
  // 1. PRODUCTS
  async getProducts(): Promise<Product[]> {
    if (isTauri) {
      try {
        const res = await invoke<Product[]>('db_get_products');
        return res;
      } catch (err) {
        console.warn('[Rust DB] db_get_products fallback:', err);
      }
    }
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to fetch products');
    return res.json();
  },

  async upsertProduct(product: Product): Promise<string> {
    if (isTauri) {
      try {
        return await invoke<string>('db_upsert_product', { product });
      } catch (err) {
        console.warn('[Rust DB] db_upsert_product fallback:', err);
      }
    }
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (!res.ok) throw new Error('Failed to save product');
    const data = await res.json();
    return data.id;
  },

  async updateStockAndPrice(productId: string, addedStock: number, buyPrice: number, sellPrice: number): Promise<void> {
    if (isTauri) {
      try {
        await invoke('db_update_stock_and_price', {
          productId,
          addedStock,
          buyPrice,
          sellPrice
        });
        return;
      } catch (err) {
        console.warn('[Rust DB] db_update_stock_and_price fallback:', err);
      }
    }
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: productId, lastBuyPrice: buyPrice, lastSellPrice: sellPrice, stock: addedStock })
    });
  },

  // 2. CATEGORIES / VENDORS & MARKUPS
  async getMarkups(): Promise<CategoryMarkupSetting[]> {
    if (isTauri) {
      try {
        return await invoke<CategoryMarkupSetting[]>('db_get_markups');
      } catch (err) {
        console.warn('[Rust DB] db_get_markups fallback:', err);
      }
    }
    const res = await fetch('/api/markups');
    if (!res.ok) throw new Error('Failed to fetch markups');
    return res.json();
  },

  async updateMarkup(category: string, markupPercent: number): Promise<void> {
    if (isTauri) {
      try {
        await invoke('db_update_markup', { category, markupPercent });
        return;
      } catch (err) {
        console.warn('[Rust DB] db_update_markup fallback:', err);
      }
    }
    await fetch('/api/markups', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, defaultMarkupPercent: markupPercent })
    });
  },

  async createMarkup(category: string, markupPercent: number, description?: string): Promise<void> {
    if (isTauri) {
      try {
        await invoke('db_create_markup', { category, markupPercent, description: description || null });
        return;
      } catch (err) {
        console.warn('[Rust DB] db_create_markup fallback:', err);
      }
    }
  },

  async deleteMarkup(category: string): Promise<void> {
    if (isTauri) {
      try {
        await invoke('db_delete_markup', { category });
        return;
      } catch (err) {
        console.warn('[Rust DB] db_delete_markup fallback:', err);
      }
    }
  },

  // 3. BUYERS / CUSTOMERS (DYNAMIC)
  async getBuyers(): Promise<Buyer[]> {
    if (isTauri) {
      try {
        return await invoke<Buyer[]>('db_get_buyers');
      } catch (err) {
        console.warn('[Rust DB] db_get_buyers fallback:', err);
      }
    }
    try {
      const res = await fetch('/api/buyers');
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('[HTTP API] /api/buyers fallback:', err);
    }
    const saved = localStorage.getItem('kasir_citra_buyers_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  },

  async upsertBuyer(buyer: Buyer): Promise<string> {
    if (isTauri) {
      try {
        return await invoke<string>('db_upsert_buyer', { buyer });
      } catch (err) {
        console.warn('[Rust DB] db_upsert_buyer fallback:', err);
      }
    }
    try {
      const res = await fetch('/api/buyers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buyer)
      });
      if (res.ok) {
        const data = await res.json();
        return data.id || buyer.id;
      }
    } catch (err) {
      console.warn('[HTTP API] /api/buyers save fallback:', err);
    }
    return buyer.id;
  },

  async deleteBuyer(id: string): Promise<void> {
    if (isTauri) {
      try {
        await invoke('db_delete_buyer', { id });
        return;
      } catch (err) {
        console.warn('[Rust DB] db_delete_buyer fallback:', err);
      }
    }
  },

  // 4. DISCOUNTS & PROMO VOUCHERS (DYNAMIC)
  async getDiscounts(): Promise<Discount[]> {
    if (isTauri) {
      try {
        return await invoke<Discount[]>('db_get_discounts');
      } catch (err) {
        console.warn('[Rust DB] db_get_discounts fallback:', err);
      }
    }
    try {
      const res = await fetch('/api/discounts');
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn('[HTTP API] /api/discounts fallback:', err);
    }
    const saved = localStorage.getItem('kasir_citra_discounts_v1');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  },

  async upsertDiscount(discount: Discount): Promise<string> {
    if (isTauri) {
      try {
        return await invoke<string>('db_upsert_discount', { discount });
      } catch (err) {
        console.warn('[Rust DB] db_upsert_discount fallback:', err);
      }
    }
    try {
      const res = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(discount)
      });
      if (res.ok) {
        const data = await res.json();
        return data.id || discount.id;
      }
    } catch (err) {
      console.warn('[HTTP API] /api/discounts save fallback:', err);
    }
    return discount.id;
  },

  async deleteDiscount(id: string): Promise<void> {
    if (isTauri) {
      try {
        await invoke('db_delete_discount', { id });
        return;
      } catch (err) {
        console.warn('[Rust DB] db_delete_discount fallback:', err);
      }
    }
    try {
      await fetch(`/api/discounts/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('[HTTP API] delete discount fallback:', err);
    }
  },

  async toggleDiscount(id: string, isActive: boolean): Promise<void> {
    if (isTauri) {
      try {
        await invoke('db_toggle_discount', { id, isActive });
        return;
      } catch (err) {
        console.warn('[Rust DB] db_toggle_discount fallback:', err);
      }
    }
    try {
      await fetch(`/api/discounts/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });
    } catch (err) {
      console.warn('[HTTP API] toggle discount fallback:', err);
    }
  },

  // 5. WHITE-LABEL STORE SETTINGS & BRANDING
  async getSettings(): Promise<StoreSetting[]> {
    if (isTauri) {
      try {
        return await invoke<StoreSetting[]>('db_get_settings');
      } catch (err) {
        console.warn('[Rust DB] db_get_settings fallback:', err);
      }
    }
    return [
      { key: 'store_name', value: 'Kasir Citra' },
      { key: 'store_tagline', value: 'Distribusi B2B & Hub Pengadaan' },
      { key: 'store_address', value: 'Jl. Sentral Distribusi No. 8' },
      { key: 'store_phone', value: '0812-3456-7890' },
      { key: 'invoice_prefix', value: 'INV-B2B' }
    ];
  },

  async updateSetting(key: string, value: string): Promise<void> {
    if (isTauri) {
      try {
        await invoke('db_update_setting', { key, value });
        return;
      } catch (err) {
        console.warn('[Rust DB] db_update_setting fallback:', err);
      }
    }
  },

  // 5. TRANSACTIONS / LEDGER
  async getTransactions(): Promise<Transaction[]> {
    if (isTauri) {
      try {
        return await invoke<Transaction[]>('db_get_transactions');
      } catch (err) {
        console.warn('[Rust DB] db_get_transactions fallback:', err);
      }
    }
    const res = await fetch('/api/transactions');
    if (!res.ok) throw new Error('Failed to fetch transactions');
    return res.json();
  },

  async createTransaction(tx: Transaction): Promise<string> {
    if (isTauri) {
      try {
        return await invoke<string>('db_create_transaction', { tx });
      } catch (err) {
        console.warn('[Rust DB] db_create_transaction fallback:', err);
      }
    }
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx)
    });
    if (!res.ok) throw new Error('Failed to create transaction');
    const data = await res.json();
    return data.invoiceNo;
  },

  async updateTransactionStatus(id: string, paymentStatus: 'LUNAS' | 'TEMPO'): Promise<void> {
    if (isTauri) {
      try {
        await invoke('db_update_transaction_status', { id, paymentStatus });
        return;
      } catch (err) {
        console.warn('[Rust DB] db_update_transaction_status fallback:', err);
      }
    }
    await fetch(`/api/transactions/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus })
    });
  },

  // 6. PRE-ORDERS
  async getPreOrders(): Promise<PreOrderSchedule[]> {
    if (isTauri) {
      try {
        return await invoke<PreOrderSchedule[]>('db_get_preorders');
      } catch (err) {
        console.warn('[Rust DB] db_get_preorders fallback:', err);
      }
    }
    const res = await fetch('/api/preorders');
    if (!res.ok) throw new Error('Failed to fetch preorders');
    return res.json();
  },

  async savePreOrder(record: PreOrderSchedule): Promise<string> {
    if (isTauri) {
      try {
        return await invoke<string>('db_save_preorder', { record });
      } catch (err) {
        console.warn('[Rust DB] db_save_preorder fallback:', err);
      }
    }
    return record.id;
  }
};
