import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { Transaction, PaymentStatus } from '../types';
import { dbService } from '../services/dbService';
import * as XLSX from 'xlsx';

import { syncService } from '../services/syncService';

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
      if (data) {
        transactions.value = data;
        saveLocal();
      }
    } catch (e) {
      console.warn('[Sync] Using local transactions cache:', e);
    }
  }

  fetchTransactionsFromDb();

  async function addTransaction(tx: Transaction, memberId?: string) {
    transactions.value = [tx, ...transactions.value.filter(t => t.id !== tx.id)];
    saveLocal();

    try {
      await dbService.createTransaction(tx, memberId);
    } catch (err) {
      console.warn('[Sync] Offline: enqueued transaction for sync:', err);
      syncService.enqueue('CREATE_TRANSACTION', { tx, memberId });
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
        console.warn('[Sync] Offline: enqueued payment status update for sync:', err);
        syncService.enqueue('UPDATE_TRANSACTION_STATUS', { id: transactionId, paymentStatus: nextStatus });
      }
    }
  }

  async function deleteTransaction(transactionId: string) {
    transactions.value = transactions.value.filter(t => t.id !== transactionId);
    saveLocal();

    try {
      await dbService.deleteTransaction(transactionId);
    } catch (err) {
      console.warn('[Sync] Offline: enqueued delete transaction for sync:', err);
      syncService.enqueue('DELETE_TRANSACTION', { id: transactionId });
    }
  }

  // Summary Metrics
  const totalRevenue = computed(() => transactions.value.reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell), 0));
  const totalCost = computed(() => transactions.value.reduce((acc, t) => acc + t.totalBuy, 0));
  const totalProfit = computed(() => transactions.value.reduce((acc, t) => acc + t.totalProfit, 0));
  const totalReceivables = computed(() =>
    transactions.value
      .filter(t => t.paymentStatus === 'TEMPO')
      .reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell), 0)
  );

  // Flat ledger rows for spreadsheet-like view & export
  const flatLedgerRows = computed(() => {
    const rows: Array<{
      txId: string;
      invoiceNo: string;
      date: string;
      buyer: string;
      customerType?: 'B2B' | 'B2C';
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
          customerType: tx.customerType,
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

  async function exportToExcel() {
    const data = flatLedgerRows.value.map((r, idx) => ({
      'NO': idx + 1,
      'NO NOTA': r.invoiceNo,
      'TANGGAL': r.date,
      'PEMBELI': r.buyer,
      'TIPE TRANSAKSI': r.customerType || 'B2B',
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
    const filename = `BUKU_BESAR_PENJUALAN_${new Date().toISOString().slice(0, 10)}.xlsx`;

    try {
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const msg = await dbService.saveExportFile(filename, Array.from(new Uint8Array(buffer)));
      if (msg) alert(msg);
    } catch (e: any) {
      const errStr = String(e?.message || e);
      if (errStr.includes('CANCELLED')) {
        return; // Pengguna membatalkan pemilihan folder/file
      }
      console.warn('Native export fallback ke browser download:', e);
      XLSX.writeFile(wb, filename);
    }
  }

  return {
    transactions,
    fetchTransactionsFromDb,
    addTransaction,
    togglePaymentStatus,
    deleteTransaction,
    totalRevenue,
    totalCost,
    totalProfit,
    totalReceivables,
    flatLedgerRows,
    exportToExcel,
  };
});
