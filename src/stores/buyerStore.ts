import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Buyer, CustomerType, MembershipTier, LoyaltyProgramSetting } from '../types';
import { dbService } from '../services/dbService';
import { syncService } from '../services/syncService';
import { useSettingsStore } from './settingsStore';

const STORAGE_KEY_BUYERS = 'kasir_citra_buyers_v3';
const STORAGE_KEY_LOYALTY = 'kasir_citra_loyalty_settings_v1';

export const useBuyerStore = defineStore('buyer', () => {
  const showMemberDrawer = ref(true);
  const showBuyerSidebar = ref(false);
  const activeBuyerForSidebar = ref<Buyer | null>(null);
  const saved = localStorage.getItem(STORAGE_KEY_BUYERS);
  const buyers = ref<Buyer[]>(saved ? JSON.parse(saved) : []);

  const savedLoyalty = localStorage.getItem(STORAGE_KEY_LOYALTY);
  const loyaltySettings = ref<LoyaltyProgramSetting>(
    savedLoyalty
      ? {
          earnPerAmount: 10000,
          pointValueInRupiah: 100,
          tierDiscounts: { REGULAR: 0, SILVER: 2, GOLD: 5, PLATINUM: 8 },
          tierMinSpend: { SILVER: 1000000, GOLD: 5000000, PLATINUM: 15000000 },
          ...JSON.parse(savedLoyalty)
        }
      : {
          earnPerAmount: 10000,       // Tiap Rp 10.000 belanja dapat 1 poin
          pointValueInRupiah: 100,    // 1 poin = Rp 100 potongan tagihan
          tierDiscounts: {
            REGULAR: 0,
            SILVER: 2,
            GOLD: 5,
            PLATINUM: 8
          },
          tierMinSpend: {
            SILVER: 1000000,
            GOLD: 5000000,
            PLATINUM: 15000000
          }
        }
  );

  const b2bBuyers = computed(() => buyers.value.filter(b => b.customerType !== 'B2C'));
  const b2cBuyers = computed(() => buyers.value.filter(b => b.customerType === 'B2C'));
  const memberBuyers = computed(() => buyers.value.filter(b => Boolean(b.memberCardNo)));

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_BUYERS, JSON.stringify(buyers.value));
    localStorage.setItem(STORAGE_KEY_LOYALTY, JSON.stringify(loyaltySettings.value));
  }

  async function fetchBuyers() {
    try {
      const [data, settings] = await Promise.all([
        dbService.getBuyers(),
        dbService.getSettings().catch(() => [])
      ]);
      buyers.value = data || [];
      if (settings && settings.length > 0) {
        const loyalty = settings.find(s => s.key === 'loyalty_settings');
        if (loyalty && loyalty.value) {
          try {
            const parsed = JSON.parse(loyalty.value);
            loyaltySettings.value = {
              tierMinSpend: { SILVER: 1000000, GOLD: 5000000, PLATINUM: 15000000 },
              ...parsed
            };
          } catch (e) {
            console.warn('[BuyerStore] Failed to parse loyalty_settings from DB:', e);
          }
        }
      }
      saveLocal();
    } catch (e) {
      console.warn('[BuyerStore] Failed to fetch buyers:', e);
    }
  }

  // Auto-fetch on mount
  fetchBuyers();

  function getBuyerByName(name: string): Buyer | undefined {
    const clean = name.trim().toLowerCase();
    return buyers.value.find(b => b.name.trim().toLowerCase() === clean);
  }

  function getBuyerByCardNo(cardNo: string): Buyer | undefined {
    const clean = cardNo.trim().toUpperCase();
    return buyers.value.find(b => b.memberCardNo && b.memberCardNo.trim().toUpperCase() === clean);
  }

  function generateMemberCardNo(prefix?: string, customerType?: CustomerType): string {
    const settingsStore = useSettingsStore();
    const storeAbbr = (prefix && prefix.trim()) ? prefix.trim().toUpperCase() : settingsStore.storeCode;
    const random = Math.floor(1000 + Math.random() * 9000);
    if (customerType === 'B2B') {
      return `${storeAbbr}-B2B-${random}`;
    }
    return `${storeAbbr}-${random}`;
  }

  async function addBuyer(
    name: string,
    code?: string,
    phone?: string,
    address?: string,
    customerType: CustomerType = 'B2B',
    memberCardNo?: string,
    tier: MembershipTier = 'REGULAR',
    points: number = 0
  ): Promise<Buyer> {
    const newBuyer: Buyer = {
      id: `buyer-${Date.now()}`,
      name: name.trim(),
      code: code ? code.trim().toUpperCase() : undefined,
      phone: phone ? phone.trim() : undefined,
      address: address ? address.trim() : undefined,
      customerType,
      memberCardNo: memberCardNo ? memberCardNo.trim().toUpperCase() : undefined,
      tier,
      points: points || 0,
      totalSpend: 0,
      memberSince: new Date().toISOString().slice(0, 10)
    };

    buyers.value.push(newBuyer);
    saveLocal();

    try {
      await dbService.upsertBuyer(newBuyer);
    } catch (err) {
      console.warn('[Sync] Offline: enqueued new buyer for sync:', err);
      syncService.enqueue('UPSERT_BUYER', { buyer: newBuyer });
    }
    return newBuyer;
  }

  async function updateBuyer(buyer: Buyer) {
    const idx = buyers.value.findIndex(b => b.id === buyer.id);
    if (idx !== -1) {
      buyers.value[idx] = { ...buyer };
      saveLocal();
      try {
        await dbService.upsertBuyer(buyer);
      } catch (err) {
        console.warn('[Sync] Offline: enqueued update buyer for sync:', err);
        syncService.enqueue('UPSERT_BUYER', { buyer });
      }
    }
  }

  async function deleteBuyer(id: string) {
    buyers.value = buyers.value.filter(b => b.id !== id);
    saveLocal();
    try {
      await dbService.deleteBuyer(id);
    } catch (err) {
      console.warn('[Sync] Offline: enqueued delete buyer for sync:', err);
      syncService.enqueue('DELETE_BUYER', { id });
    }
  }

  // Poin loyalitas kini diurus backend (db_create_transaction / db_delete_transaction)
  // secara atomik dalam satu transaksi DB — sinkronisasi JS manual diganti Rust (BUG-015 FIX).

  async function updateLoyaltySettings(newSettings: LoyaltyProgramSetting) {
    loyaltySettings.value = { ...newSettings };
    saveLocal();
    try {
      await dbService.updateSetting('loyalty_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.warn('[Sync] Offline: enqueued loyalty_settings for sync:', e);
      syncService.enqueue('UPDATE_SETTING', { key: 'loyalty_settings', value: JSON.stringify(newSettings) });
    }
  }

  function computeTierFromSpend(totalSpend: number = 0): MembershipTier {
    const minSpend = loyaltySettings.value.tierMinSpend || {
      SILVER: 1000000,
      GOLD: 5000000,
      PLATINUM: 15000000
    };
    const platMin = Number(minSpend.PLATINUM) || 15000000;
    const goldMin = Number(minSpend.GOLD) || 5000000;
    const silverMin = Number(minSpend.SILVER) || 1000000;

    if (totalSpend >= platMin) return 'PLATINUM';
    if (totalSpend >= goldMin) return 'GOLD';
    if (totalSpend >= silverMin) return 'SILVER';
    return 'REGULAR';
  }

  return {
    showMemberDrawer,
    showBuyerSidebar,
    activeBuyerForSidebar,
    buyers,
    b2bBuyers,
    b2cBuyers,
    memberBuyers,
    loyaltySettings,
    fetchBuyers,
    getBuyerByName,
    getBuyerByCardNo,
    generateMemberCardNo,
    addBuyer,
    updateBuyer,
    deleteBuyer,
    updateLoyaltySettings,
    computeTierFromSpend,
    saveLocal
  };
});
