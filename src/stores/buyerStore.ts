import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Buyer, CustomerType, MembershipTier, LoyaltyProgramSetting } from '../types';
import { dbService } from '../services/dbService';
import { useSettingsStore } from './settingsStore';

const STORAGE_KEY_BUYERS = 'kasir_citra_buyers_v3';
const STORAGE_KEY_LOYALTY = 'kasir_citra_loyalty_settings_v1';

export const useBuyerStore = defineStore('buyer', () => {
  const showMemberDrawer = ref(true);
  const showBuyerSidebar = ref(false);
  const activeBuyerForSidebar = ref<Buyer | null>(null);
  const saved = localStorage.getItem(STORAGE_KEY_BUYERS);
  const buyers = ref<Buyer[]>(
    saved
      ? JSON.parse(saved)
      : [
          {
            id: 'buyer-1',
            name: 'Pembeli Banjarsari',
            code: 'BUYER-BJS',
            customerType: 'B2B',
            memberCardNo: 'CITRA-BJS-88',
            tier: 'GOLD',
            points: 150,
            totalSpend: 7500000,
            memberSince: '2026-01-15'
          },
          {
            id: 'buyer-2',
            name: 'Pembeli Pahlawan',
            code: 'BUYER-PHL',
            customerType: 'B2B',
            memberCardNo: 'CITRA-PHL-21',
            tier: 'SILVER',
            points: 80,
            totalSpend: 3200000,
            memberSince: '2026-03-10'
          },
          {
            id: 'buyer-3',
            name: 'Pembeli Mangunharjo',
            code: 'BUYER-MGH',
            customerType: 'B2B',
            memberCardNo: 'CITRA-MGH-07',
            tier: 'REGULAR',
            points: 25,
            totalSpend: 850000,
            memberSince: '2026-06-01'
          },
          {
            id: 'buyer-b2c-umum',
            name: 'Pelanggan Umum (Eceran)',
            code: 'ECERAN',
            customerType: 'B2C',
            address: 'Walk-in Customer / Eceran Toko',
            memberCardNo: 'CITRA-UMUM-01',
            tier: 'REGULAR',
            points: 10,
            totalSpend: 250000,
            memberSince: '2026-08-01'
          }
        ]
  );

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
      if (data && data.length > 0) {
        buyers.value = data;
      }
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

    try {
      await dbService.upsertBuyer(newBuyer);
      buyers.value.push(newBuyer);
      saveLocal();
      return newBuyer;
    } catch (err) {
      console.error('Failed to save buyer to DB:', err);
      throw err;
    }
  }

  async function updateBuyer(buyer: Buyer) {
    const idx = buyers.value.findIndex(b => b.id === buyer.id);
    if (idx !== -1) {
      const old = { ...buyers.value[idx] };
      try {
        await dbService.upsertBuyer(buyer);
        buyers.value[idx] = { ...buyer };
        saveLocal();
      } catch (err) {
        buyers.value[idx] = old;
        console.error('Failed to update buyer in DB:', err);
        throw err;
      }
    }
  }

  async function deleteBuyer(id: string) {
    const old = [...buyers.value];
    try {
      await dbService.deleteBuyer(id);
      buyers.value = buyers.value.filter(b => b.id !== id);
      saveLocal();
    } catch (err) {
      buyers.value = old;
      console.error('Failed to delete buyer in DB:', err);
      throw err;
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
      console.warn('[BuyerStore] Failed to persist loyalty_settings to DB:', e);
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
    computeTierFromSpend
  };
});
