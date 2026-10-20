import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Discount, Buyer, CartItem } from '../types';
import { dbService } from '../services/dbService';

const STORAGE_KEY_DISCOUNTS = 'kasir_citra_discounts_v1';

export const useDiscountStore = defineStore('discount', () => {
  const saved = localStorage.getItem(STORAGE_KEY_DISCOUNTS);
  const discounts = ref<Discount[]>(saved ? JSON.parse(saved) : []);

  const activeDiscounts = computed(() => discounts.value.filter(d => d.isActive));

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_DISCOUNTS, JSON.stringify(discounts.value));
  }

  async function fetchDiscounts() {
    try {
      const data = await dbService.getDiscounts();
      discounts.value = data || [];
      saveLocal();
    } catch (e) {
      console.warn('[DiscountStore] Failed to fetch discounts:', e);
    }
  }

  // Auto-fetch on mount
  fetchDiscounts();

  function findDiscountByCode(code: string): Discount | undefined {
    const clean = code.trim().toUpperCase();
    return discounts.value.find(d => d.code.toUpperCase() === clean);
  }

  function calculateDiscountAmount(
    discount: Discount,
    subtotal: number,
    buyer?: Buyer | null,
    cartItems: CartItem[] = []
  ): { amount: number; valid: boolean; reason?: string } {
    if (!discount.isActive) {
      return { amount: 0, valid: false, reason: 'Kupon diskon sedang tidak aktif' };
    }

    if (discount.minPurchase > 0 && subtotal < discount.minPurchase) {
      return {
        amount: 0,
        valid: false,
        reason: `Minimal belanja Rp ${discount.minPurchase.toLocaleString('id-ID')}`
      };
    }

    // Validasi Scope Member Only
    if (discount.scope === 'MEMBER_ONLY') {
      if (!buyer || !buyer.memberCardNo) {
        return {
          amount: 0,
          valid: false,
          reason: 'Kupon ini khusus pelanggan pemegang Kartu Member'
        };
      }
    }

    // Validasi Scope Customer Type (B2B vs B2C)
    if (discount.scope === 'CUSTOMER_TYPE' && discount.targetCustomerType) {
      const bType = buyer?.customerType || 'B2B';
      if (bType !== discount.targetCustomerType) {
        return {
          amount: 0,
          valid: false,
          reason: `Khusus transaksi ${discount.targetCustomerType === 'B2B' ? 'Grosir (B2B)' : 'Eceran (B2C)'}`
        };
      }
    }

    // Hitung basis nilai belanja
    let eligibleSubtotal = subtotal;
    if (discount.scope === 'CATEGORY' && discount.targetCategory) {
      eligibleSubtotal = cartItems
        .filter(i => i.category === discount.targetCategory)
        .reduce((sum, i) => sum + i.subtotalSell, 0);

      if (eligibleSubtotal === 0) {
        return {
          amount: 0,
          valid: false,
          reason: `Kupon hanya berlaku untuk kategori ${discount.targetCategory}`
        };
      }
    }

    let cut = 0;
    if (discount.type === 'PERCENT') {
      cut = Math.round(eligibleSubtotal * (discount.value / 100));
      if (discount.maxDiscount && discount.maxDiscount > 0) {
        cut = Math.min(cut, discount.maxDiscount);
      }
    } else {
      cut = Math.min(discount.value, eligibleSubtotal);
    }

    return { amount: cut, valid: true };
  }

  async function addDiscount(discountData: Omit<Discount, 'id'>): Promise<Discount> {
    const newDiscount: Discount = {
      ...discountData,
      id: `disc-${Date.now()}`,
      code: discountData.code.trim().toUpperCase(),
      usageCount: 0,
      createdAt: new Date().toISOString()
    };
    try {
      await dbService.upsertDiscount(newDiscount);
      discounts.value.unshift(newDiscount);
      saveLocal();
      return newDiscount;
    } catch (e) {
      console.error('[DiscountStore] Failed to sync new discount to DB:', e);
      throw e;
    }
  }

  async function updateDiscount(updated: Discount): Promise<void> {
    const idx = discounts.value.findIndex(d => d.id === updated.id);
    if (idx !== -1) {
      const old = { ...discounts.value[idx] };
      const formatted = {
        ...updated,
        code: updated.code.trim().toUpperCase()
      };
      try {
        await dbService.upsertDiscount(formatted);
        discounts.value[idx] = formatted;
        saveLocal();
      } catch (e) {
        discounts.value[idx] = old;
        console.error('[DiscountStore] Failed to sync updated discount to DB:', e);
        throw e;
      }
    }
  }

  async function deleteDiscount(id: string): Promise<void> {
    const old = [...discounts.value];
    try {
      await dbService.deleteDiscount(id);
      discounts.value = discounts.value.filter(d => d.id !== id);
      saveLocal();
    } catch (e) {
      discounts.value = old;
      console.error('[DiscountStore] Failed to delete discount in DB:', e);
      throw e;
    }
  }

  async function toggleDiscount(id: string): Promise<void> {
    const d = discounts.value.find(item => item.id === id);
    if (d) {
      d.isActive = !d.isActive;
      saveLocal();
      try {
        await dbService.toggleDiscount(id, d.isActive);
      } catch (e) {
        console.warn('[DiscountStore] Failed to toggle discount in DB:', e);
      }
    }
  }

  async function upsertDiscount(data: Omit<Discount, 'id' | 'createdAt' | 'usageCount'> | Discount): Promise<Discount> {
    if ('id' in data && (data as any).id) {
      await updateDiscount(data as Discount);
      return data as Discount;
    } else {
      return await addDiscount(data as Omit<Discount, 'id'>);
    }
  }

  const showFormSidebar = ref<boolean>(false);
  const activeDiscountForEdit = ref<Discount | null>(null);

  function openAddDiscount() {
    activeDiscountForEdit.value = null;
    showFormSidebar.value = true;
  }

  function openEditDiscount(discount: Discount) {
    activeDiscountForEdit.value = { ...discount };
    showFormSidebar.value = true;
  }

  function closeFormSidebar() {
    showFormSidebar.value = false;
    activeDiscountForEdit.value = null;
  }

  return {
    discounts,
    activeDiscounts,
    showFormSidebar,
    activeDiscountForEdit,
    openAddDiscount,
    openEditDiscount,
    closeFormSidebar,
    fetchDiscounts,
    findDiscountByCode,
    calculateDiscountAmount,
    addDiscount,
    updateDiscount,
    upsertDiscount,
    deleteDiscount,
    toggleDiscount
  };
});
