import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { CashMutation, CashAccountType, CashAccountBalances } from '@sirka/shared-types';
import { useLedgerStore } from './ledgerStore';
import { usePurchaseStore } from './purchaseStore';
import { localTodayStr } from '@sirka/shared-utils';

const STORAGE_KEY_CASH_MUTATIONS = 'kasir_citra_cash_mutations_v1';

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch (e) {
    console.warn('[CashStore] Gagal parse localStorage, memakai nilai default:', e);
    return fallback;
  }
}

export const useCashStore = defineStore('cash', () => {
  const ledgerStore = useLedgerStore();
  const purchaseStore = usePurchaseStore();

  const saved = localStorage.getItem(STORAGE_KEY_CASH_MUTATIONS);
  const mutations = ref<CashMutation[]>(safeParse<CashMutation[]>(saved, []));

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_CASH_MUTATIONS, JSON.stringify(mutations.value));
  }

  // 1. Tambah Catatan Pengeluaran Kas (Beban Operasional / Prive)
  function addExpense(params: {
    fromAccount: CashAccountType;
    amount: number;
    category: string;
    notes?: string;
    referenceNo?: string;
    date?: string;
  }): CashMutation {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const dateStr = params.date || localTodayStr();

    const mutation: CashMutation = {
      id: 'mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: dateStr,
      time: timeStr,
      type: 'EXPENSE',
      fromAccount: params.fromAccount,
      amount: Math.abs(params.amount),
      category: params.category || 'Operasional',
      notes: params.notes || '',
      referenceNo: params.referenceNo || '',
      settled: true,
      createdAt: now.toISOString()
    };

    mutations.value.unshift(mutation);
    saveLocal();
    return mutation;
  }

  // 2. Pemindahan Kas Antar Akun (Settlement QRIS -> Bank, Setor Tunai -> Bank, Tarik Tunai Bank -> Kasir)
  function transferFunds(params: {
    fromAccount: CashAccountType;
    toAccount: CashAccountType;
    amount: number;
    category?: string;
    notes?: string;
    referenceNo?: string;
    date?: string;
    settled?: boolean;
  }): CashMutation {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 8);
    const dateStr = params.date || localTodayStr();

    let defaultCat = 'Pemindahan Kas';
    if (params.fromAccount === 'QRIS' && params.toAccount === 'BANK') {
      defaultCat = 'Pencairan / Settlement QRIS';
    } else if (params.fromAccount === 'TUNAI' && params.toAccount === 'BANK') {
      defaultCat = 'Setor Tunai Kasir ke Bank';
    } else if (params.fromAccount === 'BANK' && params.toAccount === 'TUNAI') {
      defaultCat = 'Tarik Tunai Bank ke Kasir';
    }

    const mutation: CashMutation = {
      id: 'mut_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: dateStr,
      time: timeStr,
      type: 'TRANSFER',
      fromAccount: params.fromAccount,
      toAccount: params.toAccount,
      amount: Math.abs(params.amount),
      category: params.category || defaultCat,
      notes: params.notes || '',
      referenceNo: params.referenceNo || '',
      settled: params.settled !== undefined ? params.settled : true,
      createdAt: now.toISOString()
    };

    mutations.value.unshift(mutation);
    saveLocal();
    return mutation;
  }

  // 3. Hapus Mutasi
  function deleteMutation(id: string) {
    mutations.value = mutations.value.filter(m => m.id !== id);
    saveLocal();
  }

  // 4. Perhitungan Saldo Berjalan & Rekonsiliasi Kas (Berdasarkan Akun)
  function calculateAccountBalances(startDate?: string, endDate?: string): CashAccountBalances {
    // Filter transaksi penjualan lunas
    const txs = ledgerStore.transactions.filter(t => {
      if (t.paymentStatus !== 'LUNAS') return false;
      if (startDate && t.date < startDate) return false;
      if (endDate && t.date > endDate) return false;
      return true;
    });

    // Omzet masuk dari penjualan kasir
    let salesCash = 0;
    let salesBank = 0;
    let salesQris = 0;

    for (const t of txs) {
      const amount = t.finalTotal ?? t.totalSell ?? 0;
      const method = (t.paymentMethod as string) || '';
      if (method === 'Tunai / Kas' || method === 'Tunai') {
        salesCash += amount;
      } else if (method === 'Transfer Bank') {
        salesBank += amount;
      } else if (method === 'QRIS') {
        salesQris += amount;
      }
    }

    // Filter mutasi kas
    const filteredMutations = mutations.value.filter(m => {
      if (startDate && m.date < startDate) return false;
      if (endDate && m.date > endDate) return false;
      return true;
    });

    // Mutasi Tunai
    let expenseCash = 0;
    let transferOutCash = 0;
    let transferInCash = 0;

    // Mutasi Bank
    let expenseBank = 0;
    let transferOutBank = 0;
    let transferInBank = 0;

    // Mutasi QRIS
    let expenseQris = 0;
    let settledQrisToBank = 0;

    for (const m of filteredMutations) {
      if (m.type === 'EXPENSE') {
        if (m.fromAccount === 'TUNAI') expenseCash += m.amount;
        else if (m.fromAccount === 'BANK') expenseBank += m.amount;
        else if (m.fromAccount === 'QRIS') expenseQris += m.amount;
      } else if (m.type === 'TRANSFER') {
        // Dari Akun
        if (m.fromAccount === 'TUNAI') transferOutCash += m.amount;
        else if (m.fromAccount === 'BANK') transferOutBank += m.amount;
        else if (m.fromAccount === 'QRIS') settledQrisToBank += m.amount;

        // Ke Akun
        if (m.toAccount === 'TUNAI') transferInCash += m.amount;
        else if (m.toAccount === 'BANK') transferInBank += m.amount;
      }
    }

    // Biaya Pembelian Kulakan Distributor
    const purchases = purchaseStore.purchaseHistory.filter(p => {
      if (!p?.date) return false;
      if (startDate && p.date < startDate) return false;
      if (endDate && p.date > endDate) return false;
      return true;
    });

    const totalPurchasesCost = purchases.reduce((acc, p) => acc + (p.totalBuy || 0), 0);

    // Saldo Bersih Berjalan Tiap Akun
    const netCashDrawer = salesCash + transferInCash - (expenseCash + transferOutCash);
    const netBankBalance = salesBank + transferInBank - (expenseBank + transferOutBank + totalPurchasesCost);
    const pendingQrisSettlement = salesQris - settledQrisToBank - expenseQris;

    return {
      // Tunai
      salesCash,
      expenseCash,
      transferOutCash,
      transferInCash,
      netCashDrawer,

      // Bank
      salesBank,
      expenseBank,
      transferOutBank,
      transferInBank,
      purchasesCostBank: totalPurchasesCost,
      netBankBalance,

      // QRIS
      salesQris,
      settledQrisToBank,
      expenseQris,
      pendingQrisSettlement,

      // Total
      totalLiquidFunds: netCashDrawer + netBankBalance + pendingQrisSettlement
    };
  }

  // Summary aktif secara keseluruhan
  const overallBalances = computed(() => calculateAccountBalances());

  return {
    mutations,
    addExpense,
    transferFunds,
    deleteMutation,
    calculateAccountBalances,
    overallBalances
  };
});
