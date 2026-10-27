import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { dbService } from '../services/dbService';
import * as XLSX from 'xlsx';
import { localTodayStr } from '@sirka/shared-utils';
import { syncService } from '../services/syncService';
const STORAGE_KEY_LEDGER = 'kasir_citra_ledger_v1';
/** BUG FIX: JSON.parse tanpa try/catch membuat 1 nilai korup mematikan boot aplikasi. */
function safeParse(raw, fallback) {
    if (!raw)
        return fallback;
    try {
        const parsed = JSON.parse(raw);
        if (parsed === null || parsed === undefined)
            return fallback;
        return parsed;
    }
    catch (e) {
        console.warn('[LedgerStore] Gagal parse localStorage, memakai nilai default:', e);
        return fallback;
    }
}
export const useLedgerStore = defineStore('ledger', () => {
    const saved = localStorage.getItem(STORAGE_KEY_LEDGER);
    const transactions = ref(safeParse(saved, []));
    function saveLocal() {
        localStorage.setItem(STORAGE_KEY_LEDGER, JSON.stringify(transactions.value));
    }
    async function fetchTransactionsFromDb() {
        try {
            const data = await dbService.getTransactions();
            if (data) {
                // BUG FIX: jangan menimpa transaksi yang dibuat lokal tapi belum
                // tersimpan di DB (mis. fallback offline) — menggabungkan keduanya.
                const dbIds = new Set(data.map((t) => t.id));
                const localOnly = transactions.value.filter(t => t && t.id && !dbIds.has(t.id));
                transactions.value = [...data, ...localOnly];
                saveLocal();
            }
        }
        catch (e) {
            console.warn('[Sync] Using local transactions cache:', e);
        }
    }
    fetchTransactionsFromDb();
    async function addTransaction(tx, memberId) {
        transactions.value = [tx, ...transactions.value.filter(t => t.id !== tx.id)];
        saveLocal();
        try {
            await dbService.createTransaction(tx, memberId);
        }
        catch (err) {
            console.warn('[Sync] Offline: enqueued transaction for sync:', err);
            syncService.enqueue('CREATE_TRANSACTION', { tx, memberId });
        }
    }
    async function togglePaymentStatus(transactionId) {
        const tx = transactions.value.find(t => t.id === transactionId);
        if (tx) {
            const nextStatus = tx.paymentStatus === 'LUNAS' ? 'TEMPO' : 'LUNAS';
            tx.paymentStatus = nextStatus;
            saveLocal();
            try {
                await dbService.updateTransactionStatus(transactionId, nextStatus);
            }
            catch (err) {
                console.warn('[Sync] Offline: enqueued payment status update for sync:', err);
                syncService.enqueue('UPDATE_TRANSACTION_STATUS', { id: transactionId, paymentStatus: nextStatus });
            }
        }
    }
    async function deleteTransaction(transactionId) {
        transactions.value = transactions.value.filter(t => t.id !== transactionId);
        saveLocal();
        try {
            await dbService.deleteTransaction(transactionId);
        }
        catch (err) {
            console.warn('[Sync] Offline: enqueued delete transaction for sync:', err);
            syncService.enqueue('DELETE_TRANSACTION', { id: transactionId });
        }
    }
    // Summary Metrics
    // BUG FIX: guard `|| 0` supaya 1 transaksi lama tanpa `totalBuy`/`totalProfit`
    // tidak membuat seluruh metrik menjadi NaN.
    const totalRevenue = computed(() => transactions.value.reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));
    const totalCost = computed(() => transactions.value.reduce((acc, t) => acc + (t.totalBuy || 0), 0));
    const totalProfit = computed(() => transactions.value.reduce((acc, t) => acc + (t.totalProfit || 0), 0));
    const totalReceivables = computed(() => transactions.value
        .filter(t => t.paymentStatus === 'TEMPO')
        .reduce((acc, t) => acc + (t.finalTotal ?? t.totalSell ?? 0), 0));
    // Flat ledger rows for spreadsheet-like view & export
    const flatLedgerRows = computed(() => {
        const rows = [];
        for (const tx of transactions.value) {
            // BUG FIX: diskon kupon & potong poin loyalitas harus ikut diekspor
            // supaya kolom LABA BERSIH bisa direkonsiliasi dengan TOTAL BAYAR.
            const txDiscount = (tx.discountAmount || 0) + (tx.pointsDiscount || 0);
            const txFinal = tx.finalTotal ?? tx.totalSell ?? 0;
            const itemCount = (tx.items || []).length || 1;
            for (const item of tx.items || []) {
                // BUG FIX: HPP (`buyPrice`) disimpan per SATUAN DASAR sedangkan `qty`
                // adalah jumlah dalam SATUAN AKTIF. Ekspor keduanya apa adanya
                // membuat baris tidak konsisten secara aritmetika (2 x 10.000 !=
                // 800.000). Sekarang keduanya diekspor dalam satuan yang sama
                // (satuan aktif) dan satuan dasar disediakan sebagai kolom terpisah.
                const factor = item.conversionFactor || 1;
                const baseQty = item.baseQty ?? item.qty * factor;
                const buyPricePerActiveUnit = Math.round((item.buyPrice || 0) * factor);
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
                    baseQty,
                    baseUnit: item.baseUnit,
                    conversionFactor: factor,
                    buyPrice: buyPricePerActiveUnit,
                    totalBuy: item.subtotalBuy,
                    sellPrice: item.sellPrice,
                    totalSell: item.subtotalSell,
                    profit: item.subtotalSell - item.subtotalBuy - (txDiscount / itemCount),
                    // Diskon yang dialokasikan ke baris item ini (agar LABA = SUBTOTAL - MODAL - DISKON)
                    discountAmount: txDiscount / itemCount,
                    pointsDiscount: tx.pointsDiscount || 0,
                    finalTotal: txFinal,
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
            'JUMLAH (SATUAN DASAR)': r.baseQty,
            'SATUAN DASAR': r.baseUnit || r.unit,
            'FAKTOR KONVERSI': r.conversionFactor,
            'HARGA BELI SATUAN': r.buyPrice,
            'TOTAL BELI': r.totalBuy,
            'HARGA JUAL SATUAN': r.sellPrice,
            'TOTAL JUAL': r.totalSell,
            'DISKON (KUPON + POIN)': r.discountAmount,
            'TOTAL BAYAR': r.finalTotal,
            'LABA BERSIH': r.profit,
            'STATUS BAYAR': r.paymentStatus,
            'METODE BAYAR': r.paymentMethod,
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Buku Besar Penjualan');
        // BUG FIX: gunakan tanggal LOKAL, bukan UTC.
        const filename = `BUKU_BESAR_PENJUALAN_${localTodayStr()}.xlsx`;
        try {
            const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const msg = await dbService.saveExportFile(filename, Array.from(new Uint8Array(buffer)));
            if (msg)
                alert(msg);
        }
        catch (e) {
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
