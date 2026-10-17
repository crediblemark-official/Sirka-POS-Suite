import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Buyer, CustomerType, MembershipTier, LoyaltyProgramSetting } from '../types';
import { dbService } from '../services/dbService';

const STORAGE_KEY_BUYERS = 'kasir_citra_buyers_v3';
const STORAGE_KEY_LOYALTY = 'kasir_citra_loyalty_settings_v1';

export const useBuyerStore = defineStore('buyer', () => {
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
            memberCardNo: 'MBR-BJS-88',
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
            memberCardNo: 'MBR-PHL-21',
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
            memberCardNo: 'MBR-MGH-07',
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
            memberCardNo: 'MBR-UMUM-01',
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
      ? JSON.parse(savedLoyalty)
      : {
          earnPerAmount: 10000,       // Tiap Rp 10.000 belanja dapat 1 poin
          pointValueInRupiah: 100,    // 1 poin = Rp 100 potongan tagihan
          tierDiscounts: {
            REGULAR: 0,
            SILVER: 2,
            GOLD: 5,
            PLATINUM: 8
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
      const data = await dbService.getBuyers();
      if (data && data.length > 0) {
        buyers.value = data;
        saveLocal();
      }
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

  function generateMemberCardNo(prefix = 'CITRA'): string {
    const random = Math.floor(1000 + Math.random() * 9000);
    const year = new Date().getFullYear();
    return `MBR-${prefix}-${year}-${random}`;
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
      console.error('Failed to save buyer to DB:', err);
    }

    return newBuyer;
  }

  async function updateBuyer(buyer: Buyer) {
    const idx = buyers.value.findIndex(b => b.id === buyer.id);
    if (idx !== -1) {
      buyers.value[idx] = { ...buyer };
      saveLocal();
      await dbService.upsertBuyer(buyer);
    }
  }

  async function deleteBuyer(id: string) {
    buyers.value = buyers.value.filter(b => b.id !== id);
    saveLocal();
    await dbService.deleteBuyer(id);
  }

  // Poin Loyalitas & Akumulasi Belanja Otomatis saat Checkout
  async function addPointsAndSpend(buyerName: string, pointsEarned: number, spend: number) {
    const buyer = getBuyerByName(buyerName);
    if (!buyer) return;

    buyer.points = (buyer.points || 0) + pointsEarned;
    buyer.totalSpend = (buyer.totalSpend || 0) + spend;

    // Evaluasi kenaikan tier otomatis berdasarkan total belanja
    if (buyer.totalSpend >= 15000000) {
      buyer.tier = 'PLATINUM';
    } else if (buyer.totalSpend >= 5000000) {
      buyer.tier = 'GOLD';
    } else if (buyer.totalSpend >= 1000000) {
      buyer.tier = 'SILVER';
    } else {
      buyer.tier = 'REGULAR';
    }

    saveLocal();
    await dbService.upsertBuyer(buyer);
  }

  async function deductPoints(buyerName: string, pointsUsed: number) {
    const buyer = getBuyerByName(buyerName);
    if (!buyer || !pointsUsed) return;

    buyer.points = Math.max(0, (buyer.points || 0) - pointsUsed);
    saveLocal();
    await dbService.upsertBuyer(buyer);
  }

  function updateLoyaltySettings(newSettings: LoyaltyProgramSetting) {
    loyaltySettings.value = { ...newSettings };
    saveLocal();
  }

  return {
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
    addPointsAndSpend,
    deductPoints,
    updateLoyaltySettings
  };
});
