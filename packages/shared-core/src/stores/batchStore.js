import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useInventoryStore } from './inventoryStore';
import { localTodayStr } from '@sirka/shared-utils';
const STORAGE_KEY_BATCHES = 'kasir_citra_batches_v1';
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
        console.warn('[BatchStore] Gagal parse localStorage, memakai nilai default:', e);
        return fallback;
    }
}
export const useBatchStore = defineStore('batch', () => {
    const inventoryStore = useInventoryStore();
    const saved = localStorage.getItem(STORAGE_KEY_BATCHES);
    const batches = ref(safeParse(saved, []));
    function saveLocal() {
        localStorage.setItem(STORAGE_KEY_BATCHES, JSON.stringify(batches.value));
    }
    /**
     * Inisialisasi batch awal untuk produk yang sudah memiliki stok namun belum ada riwayat batch
     */
    function initBatchesForExistingProducts() {
        let hasNew = false;
        for (const prod of inventoryStore.products) {
            const existing = batches.value.filter(b => b.productId === prod.id && b.remainingQty > 0);
            if (existing.length === 0 && prod.stock > 0) {
                const initialBatch = {
                    id: `batch-init-${prod.id}`,
                    productId: prod.id,
                    batchNo: `BATCH-AWAL-${prod.code}`,
                    initialQty: prod.stock,
                    remainingQty: prod.stock,
                    buyPrice: prod.lastBuyPrice || 0,
                    sellPrice: prod.lastSellPrice || 0,
                    createdAt: new Date().toISOString()
                };
                batches.value.push(initialBatch);
                hasNew = true;
            }
        }
        if (hasNew) {
            saveLocal();
        }
    }
    // Jalankan inisialisasi awal
    initBatchesForExistingProducts();
    /**
     * Mengambil semua batch milik produk tertentu
     */
    function getBatchesForProduct(productId) {
        return batches.value.filter(b => b.productId === productId);
    }
    /**
     * Mengambil total stok aktif dari akumulasi batch
     */
    function getActiveStockFromBatches(productId) {
        const list = batches.value.filter(b => b.productId === productId && b.remainingQty > 0);
        return list.reduce((acc, b) => acc + b.remainingQty, 0);
    }
    /**
     * ENGINE DEDUKSI STOK FIFO / FEFO:
     * 1. FEFO (First Expired First Out): Prioritaskan batch dengan expiry_date paling dekat.
     * 2. FIFO (First In First Out): Untuk batch tanpa expiry_date, urutkan berdasarkan created_at paling lama.
     * 3. Hitung HPP murni berdasarkan harga modal batch riil yang terpotong.
     */
    function deductFifoFefo(product, requiredBaseQty) {
        // Pastikan jika belum ada batch tapi stok master ada, buatkan batch awal
        initBatchesForExistingProducts();
        const availableBatches = batches.value
            .filter(b => b.productId === product.id && b.remainingQty > 0)
            .sort((a, b) => {
            // Jika keduanya punya tanggal expired: urutkan FEFO (yang mau expired keluar duluan)
            if (a.expiryDate && b.expiryDate) {
                return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            }
            // Jika salah satu punya expired: yang ada expired didahulukan
            if (a.expiryDate && !b.expiryDate)
                return -1;
            if (!a.expiryDate && b.expiryDate)
                return 1;
            // Jika tidak ada expired: urutkan FIFO (pertama masuk keluar duluan)
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        const deductions = [];
        let remainingNeeded = requiredBaseQty;
        let totalHpp = 0;
        for (const batch of availableBatches) {
            if (remainingNeeded <= 0)
                break;
            const qtyToTake = Math.min(batch.remainingQty, remainingNeeded);
            batch.remainingQty = Math.max(0, Number((batch.remainingQty - qtyToTake).toFixed(4)));
            deductions.push({
                batchId: batch.id,
                batchNo: batch.batchNo,
                qtyDeducted: qtyToTake,
                buyPrice: batch.buyPrice,
                expiryDate: batch.expiryDate
            });
            totalHpp += qtyToTake * batch.buyPrice;
            remainingNeeded = Number((remainingNeeded - qtyToTake).toFixed(4));
        }
        // Jika stok batch habis namun kasir tetap menjual (shortage/minus)
        const isShortage = remainingNeeded > 0;
        if (isShortage) {
            const fallbackBuyPrice = product.lastBuyPrice || 0;
            totalHpp += remainingNeeded * fallbackBuyPrice;
        }
        saveLocal();
        const effectiveAverageBuyPrice = requiredBaseQty > 0 ? Number((totalHpp / requiredBaseQty).toFixed(2)) : product.lastBuyPrice || 0;
        return {
            deductions,
            totalHpp,
            effectiveAverageBuyPrice,
            isShortage
        };
    }
    /**
     * Menambahkan batch baru (misal saat Kulakan/Restock diterima)
     */
    function addBatch(batchData) {
        const cleanBatchNo = batchData.batchNo ||
            `BATCH-${localTodayStr().replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const newBatch = {
            id: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            productId: batchData.productId,
            batchNo: cleanBatchNo,
            purchaseReceiptId: batchData.purchaseReceiptId,
            initialQty: batchData.qty,
            remainingQty: batchData.qty,
            buyPrice: batchData.buyPrice,
            sellPrice: batchData.sellPrice,
            expiryDate: batchData.expiryDate || undefined,
            createdAt: new Date().toISOString()
        };
        batches.value.unshift(newBatch);
        saveLocal();
        return newBatch;
    }
    /**
     * Mengembalikan stok batch (untuk proses Retur/Refund barang yang layak jual kembali ke rak)
     */
    function restoreBatchDeductions(deductions) {
        for (const d of deductions) {
            const batch = batches.value.find(b => b.id === d.batchId);
            if (batch) {
                batch.remainingQty = Number((batch.remainingQty + d.qtyDeducted).toFixed(4));
            }
        }
        saveLocal();
    }
    /**
     * Penyesuaian stok rusak/afkir langsung memotong batch tertentu (Waste & Spoilage)
     */
    function deductDamagedFromBatch(batchId, damagedQty) {
        const batch = batches.value.find(b => b.id === batchId);
        if (!batch)
            return false;
        batch.remainingQty = Math.max(0, Number((batch.remainingQty - damagedQty).toFixed(4)));
        saveLocal();
        return true;
    }
    /**
     * Memotong stok rusak/susut secara otomatis dari batch FIFO/FEFO terawal produk
     */
    function deductProductWaste(productId, wasteQty) {
        const prod = inventoryStore.products.find(p => p.id === productId);
        if (!prod)
            return [];
        const deductions = deductFifoFefo(prod, wasteQty);
        saveLocal();
        return deductions.deductions;
    }
    /**
     * Hapus seluruh batch yang berasal dari satu nota kulakan.
     *
     * BUG FIX: saat nota kulakan diedit atau dihapus, batch FIFO lama tidak
     * pernah dibatalkan. Akibatnya `batch.remainingQty` tetap berisi kuantitas
     * yang sudah dibatalkan sehingga HPP penjualan berikutnya dihitung dari
     * batch yang tidak relevan dan stok batch melenceng dari stok master.
     */
    function removeBatchesForReceipt(receiptId) {
        if (!receiptId)
            return 0;
        const before = batches.value.length;
        batches.value = batches.value.filter(b => b.purchaseReceiptId !== receiptId);
        const removed = before - batches.value.length;
        if (removed > 0)
            saveLocal();
        return removed;
    }
    /**
     * Sinkronkan remainingQty seluruh batch produk dengan stok fisik hasil opname.
     * BUG FIX: penyesuaian stok (opname) sebelumnya hanya mengubah `product.stock`
     * sehingga `batch.remainingQty` tidak pernah sama -> HPP penjualan berikutnya
     * dihitung dari batch yang sudah tidak relevan dan stok batch vs master melenceng.
     *
     * Aturan: selisihPositive ditambahkan ke batch termuda (FIFO), selisih negatif
     * dipotong dari batch paling lama (FIFO/FEFO) — sama dengan urutan pemotongan.
     */
    function syncStockWithBatches(productId, physicalStock) {
        const target = Math.max(0, Number(physicalStock) || 0);
        const owned = batches.value.filter(b => b.productId === productId);
        if (owned.length === 0) {
            // Belum ada batch: buat batch awal berisi stok fisik saat ini.
            const prod = inventoryStore.products.find(p => p.id === productId);
            if (!prod || target <= 0)
                return false;
            batches.value.push({
                id: `batch-init-${prod.id}`,
                productId: prod.id,
                batchNo: `BATCH-AWAL-${prod.code}`,
                initialQty: target,
                remainingQty: target,
                buyPrice: prod.lastBuyPrice || 0,
                sellPrice: prod.lastSellPrice || 0,
                createdAt: new Date().toISOString()
            });
            saveLocal();
            return true;
        }
        const currentTotal = owned.reduce((acc, b) => acc + (b.remainingQty || 0), 0);
        let diff = Number((target - currentTotal).toFixed(4));
        if (diff === 0)
            return false;
        const ordered = [...owned].sort((a, b) => {
            // Batch dengan kadaluwarsa lebih dulu (FEFO), lalu batch terlama (FIFO)
            if (a.expiryDate && b.expiryDate) {
                return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
            }
            if (a.expiryDate && !b.expiryDate)
                return -1;
            if (!a.expiryDate && b.expiryDate)
                return 1;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        if (diff > 0) {
            //Kelebihan stok fisik: masukkan ke batch paling awal (FIFO) agar HPP stabil
            const target_batch = ordered[0];
            target_batch.remainingQty = Number((target_batch.remainingQty + diff).toFixed(4));
            target_batch.initialQty = Number((target_batch.initialQty + diff).toFixed(4));
        }
        else {
            // Kekurangan stok fisik: potong dari batch paling awal
            let toRemove = Math.abs(diff);
            for (const b of ordered) {
                if (toRemove <= 0)
                    break;
                const take = Math.min(b.remainingQty, toRemove);
                b.remainingQty = Number((b.remainingQty - take).toFixed(4));
                toRemove = Number((toRemove - take).toFixed(4));
            }
        }
        saveLocal();
        return true;
    }
    return {
        batches,
        initBatchesForExistingProducts,
        getBatchesForProduct,
        getActiveStockFromBatches,
        deductFifoFefo,
        addBatch,
        restoreBatchDeductions,
        deductDamagedFromBatch,
        deductProductWaste,
        syncStockWithBatches,
        removeBatchesForReceipt,
        saveLocal
    };
});
