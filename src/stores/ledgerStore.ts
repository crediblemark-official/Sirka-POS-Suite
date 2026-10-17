import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Transaction, PaymentStatus } from '../types';
import { dbService } from '../services/dbService';
import * as XLSX from 'xlsx';

const STORAGE_KEY_LEDGER = 'kasir_citra_ledger_v1';

export const useLedgerStore = defineStore('ledger', () => {
  const saved = localStorage.getItem(STORAGE_KEY_LEDGER);
  const transactions = ref<Transaction[]>(saved ? JSON.parse(saved) : []);

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY_LEDGER, JSON.stringify(transactions.value));
  }

  async function fetchTransactionsFromDb() {
    try {
      const data = await dbService.getTransactions();
      if (data && data.length > 0) {
        transactions.value = data;
        saveLocal();
      }
    } catch (e) {
      console.warn('[Sync] Using local transactions cache:', e);
    }
  }

  fetchTransactionsFromDb();

  async function addTransaction(tx: Transaction) {
    transactions.value.unshift(tx);
    saveLocal();

    try {
      await dbService.createTransaction(tx);
    } catch (err) {
      console.error('Failed to sync transaction to Rust backend:', err);
    }
  }

  async function togglePaymentStatus(transactionId: string) {
    const tx = transactions.value.find(t => t.id === transactionId);
    if (tx) {
      const nextStatus = tx.paymentStatus === 'LUNAS' ? 'TEMPO' : 'LUNAS';
      tx.paymentStatus = nextStatus;
      saveLocal();

      try {
        await dbService.updateTransactionStatus(transactionId, nextStatus);
      } catch (err) {
        console.error('Failed to sync status update to Rust backend:', err);
      }
    }
  }

  function setPaymentStatus(transactionId: string, status: PaymentStatus) {
    const tx = transactions.value.find(t => t.id === transactionId);
    if (tx) {
      tx.paymentStatus = status;
      saveLocal();
    }
  }

  function deleteTransaction(transactionId: string) {
    transactions.value = transactions.value.filter(t => t.id !== transactionId);
    saveLocal();
  }

  // Summary Metrics
  const totalRevenue = computed(() => transactions.value.reduce((acc, t) => acc + t.totalSell, 0));
  const totalCost = computed(() => transactions.value.reduce((acc, t) => acc + t.totalBuy, 0));
  const totalProfit = computed(() => transactions.value.reduce((acc, t) => acc + t.totalProfit, 0));
  const totalReceivables = computed(() =>
    transactions.value
      .filter(t => t.paymentStatus === 'TEMPO')
      .reduce((acc, t) => acc + t.totalSell, 0)
  );

  // Flat ledger rows for spreadsheet-like view & export
  const flatLedgerRows = computed(() => {
    const rows: Array<{
      txId: string;
      invoiceNo: string;
      date: string;
      buyer: string;
      category: string;
      productName: string;
      qty: number;
      unit: string;
      buyPrice: number;
      totalBuy: number;
      sellPrice: number;
      totalSell: number;
      profit: number;
      paymentStatus: PaymentStatus;
      paymentMethod: string;
    }> = [];

    for (const tx of transactions.value) {
      for (const item of tx.items) {
        rows.push({
          txId: tx.id,
          invoiceNo: tx.invoiceNo,
          date: tx.date,
          buyer: tx.buyer,
          category: item.category,
          productName: item.name,
          qty: item.qty,
          unit: item.unit,
          buyPrice: item.buyPrice,
          totalBuy: item.subtotalBuy,
          sellPrice: item.sellPrice,
          totalSell: item.subtotalSell,
          profit: item.profit,
          paymentStatus: tx.paymentStatus,
          paymentMethod: tx.paymentMethod,
        });
      }
    }
    return rows;
  });

  function exportToExcel() {
    const data = flatLedgerRows.value.map((r, idx) => ({
      'NO': idx + 1,
      'NO NOTA': r.invoiceNo,
      'TANGGAL': r.date,
      'PEMBELI': r.buyer,
      'KATEGORI / SUPPLIER': r.category,
      'NAMA BARANG': r.productName,
      'JUMLAH': r.qty,
      'SATUAN': r.unit,
      'HARGA BELI SATUAN': r.buyPrice,
      'TOTAL BELI': r.totalBuy,
      'HARGA JUAL SATUAN': r.sellPrice,
      'TOTAL JUAL': r.totalSell,
      'LABA BERSIH': r.profit,
      'STATUS BAYAR': r.paymentStatus,
      'METODE BAYAR': r.paymentMethod,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Buku Besar Penjualan');
    XLSX.writeFile(wb, `BUKU_BESAR_PENJUALAN_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return {
    transactions,
    fetchTransactionsFromDb,
    addTransaction,
    togglePaymentStatus,
    setPaymentStatus,
    deleteTransaction,
    totalRevenue,
    totalCost,
    totalProfit,
    totalReceivables,
    flatLedgerRows,
    exportToExcel,
  };
});
