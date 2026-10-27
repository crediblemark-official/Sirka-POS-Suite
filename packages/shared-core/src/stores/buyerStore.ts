import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Buyer, CustomerType, MembershipTier, LoyaltyProgramSetting } from '@sirka/shared-types';
import { dbService } from '../services/dbService';
import { syncService } from '../services/syncService';
import { useSettingsStore } from './settingsStore';
import { localTodayStr } from '@sirka/shared-utils';

const STORAGE_KEY_BUYERS = 'kasir_citra_buyers_v3';
const STORAGE_KEY_LOYALTY = 'kasir_citra_loyalty_settings_v1';

/** BUG FIX: JSON.parse tanpa try/catch membuat 1 nilai korup mematikan boot aplikasi. */
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch (e) {
    console.warn('[BuyerStore] Gagal parse localStorage, memakai nilai default:', e);
    return fallback;
  }
}

/** Default aturan loyalitas — dipakai sebagai fallback di semua jalur muat data. */
const DEFAULT_LOYALTY: LoyaltyProgramSetting = {
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
};

function normalizeLoyaltySettings(raw: unknown): LoyaltyProgramSetting {
  const parsed = (raw && typeof raw === 'object' ? raw : {}) as Partial<LoyaltyProgramSetting>;
  return {
    ...DEFAULT_LOYALTY,
    ...parsed,
    // BUG FIX: field nested harus selalu lengkap. Sebelumnya `tierDiscounts`
    // bisa `undefined` bila baris DB hanya menyimpan sebagian field ->
    // `loyaltySettings.tierDiscounts[tier]` melempar TypeError dan meruntuhkan
    // panel kasir.
    tierDiscounts: { ...DEFAULT_LOYALTY.tierDiscounts, ...(parsed.tierDiscounts || {}) },
    tierMinSpend: {
      SILVER: parsed.tierMinSpend?.SILVER ?? DEFAULT_LOYALTY.tierMinSpend!.SILVER,
      GOLD: parsed.tierMinSpend?.GOLD ?? DEFAULT_LOYALTY.tierMinSpend!.GOLD,
      PLATINUM: parsed.tierMinSpend?.PLATINUM ?? DEFAULT_LOYALTY.tierMinSpend!.PLATINUM,
    }
  };
}

export const useBuyerStore = defineStore('buyer', () => {
  const showMemberDrawer = ref(true);
  const showBuyerSidebar = ref(false);
  const activeBuyerForSidebar = ref<Buyer | null>(null);
  const saved = localStorage.getItem(STORAGE_KEY_BUYERS);
  const buyers = ref<Buyer[]>(safeParse<Buyer[]>(saved, []));

  const savedLoyalty = localStorage.getItem(STORAGE_KEY_LOYALTY);
  const loyaltySettings = ref<LoyaltyProgramSetting>(
    normalizeLoyaltySettings(savedLoyalty ? safeParse<unknown>(savedLoyalty, null) : null)
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
            // BUG FIX: gunakan normalizer agar `tierDiscounts` dsb. selalu lengkap
            loyaltySettings.value = normalizeLoyaltySettings(parsed);
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

  /**
   * BUG FIX: nomor kartu member sebelumnya hanya 4 digit acak (~1/9000
   * peluang bentrok) tanpa pengecekan keunikan. Dua anggota dengan kartu sama
   * membuat `getBuyerByCardNo()` mengembalikan anggota yang salah sehingga
   * poin & tier masuk ke pelanggan yang keliru.
   */
  function generateMemberCardNo(prefix?: string, customerType?: CustomerType): string {
    const settingsStore = useSettingsStore();
    const storeAbbr = (prefix && prefix.trim()) ? prefix.trim().toUpperCase() : settingsStore.storeCode;
    const suffix = customerType === 'B2B' ? 'B2B' : '';
    for (let attempt = 0; attempt < 50; attempt++) {
      const random = Math.floor(10000 + Math.random() * 90000);
      const candidate = suffix ? `${storeAbbr}-${suffix}-${random}` : `${storeAbbr}-${random}`;
      if (!getBuyerByCardNo(candidate)) return candidate;
    }
    // FallbackExtrem: tambahkan counter agar pasti unik
    let counter = 1;
    let candidate = `${storeAbbr}-${suffix ? suffix + '-' : ''}${Date.now().toString().slice(-6)}`;
    while (getBuyerByCardNo(candidate)) {
      counter += 1;
      candidate = `${storeAbbr}-${suffix ? suffix + '-' : ''}${Date.now().toString().slice(-6)}-${counter}`;
    }
    return candidate;
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
      memberSince: localTodayStr()
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

  /**
   * Perbarui data pelanggan.
   *
   * BUG FIX: sebelumnya `buyers.value[idx] = { ...buyer }` — REPLACE PENUH.
   * Field yang tidak dikirim pemanggil (mis. `totalSpend`, `memberSince`)
   * menjadi `undefined` lalu ditulis ke database sebagai 0/NULL. Akibatnya
   * tier member runtuh permanen hanya karena admin memperbaiki satu typo.
   * Sekarang field yang tidak dikirim dipertahankan.
   */
  async function updateBuyer(buyer: Buyer) {
    const idx = buyers.value.findIndex(b => b.id === buyer.id);
    if (idx !== -1) {
      const existing = buyers.value[idx];
      const merged: Buyer = {
        ...existing,
        ...buyer,
        // Field turunan yang TIDAK boleh hilang saat edit
        totalSpend: buyer.totalSpend ?? existing.totalSpend ?? 0,
        memberSince: buyer.memberSince ?? existing.memberSince,
        points: buyer.points ?? existing.points ?? 0,
        memberCardNo: buyer.memberCardNo ?? existing.memberCardNo
      };
      buyers.value[idx] = merged;
      saveLocal();
      try {
        await dbService.upsertBuyer(merged);
      } catch (err) {
        console.warn('[Sync] Offline: enqueued update buyer for sync:', err);
        syncService.enqueue('UPSERT_BUYER', { buyer: merged });
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
    // BUG FIX: normalkan dulu agar field nested tidak pernah `undefined`
    loyaltySettings.value = normalizeLoyaltySettings(newSettings);
    saveLocal();
    try {
      await dbService.updateSetting('loyalty_settings', JSON.stringify(loyaltySettings.value));
    } catch (e) {
      console.warn('[Sync] Offline: enqueued loyalty_settings for sync:', e);
      syncService.enqueue('UPDATE_SETTING', { key: 'loyalty_settings', value: JSON.stringify(loyaltySettings.value) });
    }
  }

  function computeTierFromSpend(totalSpend: number = 0): MembershipTier {
    const minSpend = loyaltySettings.value.tierMinSpend || {
      SILVER: 1000000,
      GOLD: 5000000,
      PLATINUM: 15000000
    };
    // BUG FIX: gunakan `??` supaya ambang 0 (mis. admin ingin semua pelanggan
    // menjadi GOLD) tidak diam-diam diganti nilai default.
    const platMin = Number(minSpend.PLATINUM ?? 15000000);
    const goldMin = Number(minSpend.GOLD ?? 5000000);
    const silverMin = Number(minSpend.SILVER ?? 1000000);

    if (totalSpend >= platMin) return 'PLATINUM';
    if (totalSpend >= goldMin) return 'GOLD';
    if (totalSpend >= silverMin) return 'SILVER';
    return 'REGULAR';
  }

  /**
   * Enkapsulasi: Catat mutasi poin & akumulasi belanja member akibat transaksi kasir.
   */
  function recordPurchase(
    buyerId: string,
    spendAmount: number,
    pointsEarned: number = 0,
    pointsUsed: number = 0
  ) {
    const b = buyers.value.find(x => x.id === buyerId);
    if (!b) return;
    b.points = Math.max(0, (b.points || 0) - pointsUsed + pointsEarned);
    b.totalSpend = (b.totalSpend || 0) + spendAmount;
    b.tier = computeTierFromSpend(b.totalSpend);
    saveLocal();
  }

  /**
   * Enkapsulasi: Balikkan mutasi poin & akumulasi belanja member (mis. saat retur/pembatalan).
   */
  function revertPurchase(
    buyerId: string,
    spendAmount: number,
    pointsEarned: number = 0,
    pointsUsed: number = 0
  ) {
    const b = buyers.value.find(x => x.id === buyerId);
    if (!b) return;
    b.points = Math.max(0, (b.points || 0) + pointsUsed - pointsEarned);
    b.totalSpend = Math.max(0, (b.totalSpend || 0) - spendAmount);
    b.tier = computeTierFromSpend(b.totalSpend);
    saveLocal();
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
    recordPurchase,
    revertPurchase,
    saveLocal
  };
});
