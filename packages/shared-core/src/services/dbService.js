import { invoke } from '@tauri-apps/api/core';
/**
 * Native Tauri Database Service
 * Pure Rust backend IPC communication connecting directly to PostgreSQL.
 */
export const dbService = {
    // 1. PRODUCTS & INVENTORY
    async getProducts() {
        return await invoke('db_get_products');
    },
    async upsertProduct(product) {
        return await invoke('db_upsert_product', { product });
    },
    async updateStockAndPrice(productId, addedStock, buyPrice, sellPrice) {
        await invoke('db_update_stock_and_price', {
            productId,
            addedStock,
            buyPrice,
            sellPrice
        });
    },
    async deleteProduct(productId) {
        await invoke('db_delete_product', { productId });
    },
    // Struk thermal (teks 32 atau 42 kolom) dibangun di Rust dari data transaksi lengkap
    async generateReceiptText(tx, storeName, paperWidth) {
        return await invoke('generate_receipt_text', {
            tx,
            storeName: storeName || null,
            paperWidth: paperWidth || null
        });
    },
    // Mengirim byte ESC/POS langsung ke Network Thermal Printer / Simulator (default 127.0.0.1:9100)
    async printToNetworkPrinter(text, address) {
        return await invoke('print_to_network_printer', {
            text,
            address: address || null
        });
    },
    // Mendapatkan daftar perangkat Bluetooth yang terpasang di sistem
    async getBluetoothDevices() {
        return await invoke('get_bluetooth_devices');
    },
    // Mengirim byte ESC/POS langsung ke Printer Thermal Bluetooth (RFCOMM SPP)
    async printToBluetoothPrinter(text, mac, channel) {
        return await invoke('print_to_bluetooth_printer', {
            text,
            mac: mac || null,
            channel: channel || null
        });
    },
    // Mendeteksi printer thermal yang aktif secara dinamis (USB / Bluetooth / System)
    async detectPrinterStatus() {
        return await invoke('detect_printer_status');
    },
    // Mencetak langsung ke printer USB (/dev/usb/lp0)
    async printToUsbPrinter(text, devicePath) {
        return await invoke('print_to_usb_printer', {
            text,
            devicePath: devicePath || null
        });
    },
    // 2. CATEGORIES / VENDORS & MARKUPS
    async getMarkups() {
        return await invoke('db_get_markups');
    },
    async updateMarkup(category, markupPercent) {
        await invoke('db_update_markup', { category, markupPercent });
    },
    async createMarkup(category, markupPercent, description, color) {
        await invoke('db_create_markup', {
            category,
            markupPercent,
            description: description || null,
            color: color || null
        });
    },
    /**
     * BUG FIX: update kategori harus ikut menyimpan warna + deskripsi.
     * Sebelumnya `dbService.updateMarkup` hanya mengirim margin sehingga warna
     * kategori hilang setiap kali master dimuat ulang dari database.
     */
    async updateMarkupFull(category, markupPercent, description, color) {
        await invoke('db_update_markup_full', {
            category,
            markupPercent,
            description: description || null,
            color: color || null
        });
    },
    async deleteMarkup(category) {
        await invoke('db_delete_markup', { category });
    },
    // 3. BUYERS / CUSTOMERS & LOYALTY
    async getBuyers() {
        return await invoke('db_get_buyers');
    },
    async upsertBuyer(buyer) {
        return await invoke('db_upsert_buyer', { buyer });
    },
    async deleteBuyer(id) {
        await invoke('db_delete_buyer', { id });
    },
    // 4. DISCOUNTS & PROMO VOUCHERS
    async getDiscounts() {
        return await invoke('db_get_discounts');
    },
    async upsertDiscount(discount) {
        return await invoke('db_upsert_discount', { discount });
    },
    async deleteDiscount(id) {
        await invoke('db_delete_discount', { id });
    },
    async toggleDiscount(id, isActive) {
        await invoke('db_toggle_discount', { id, isActive });
    },
    // 5. WHITE-LABEL STORE SETTINGS & BRANDING
    async getSettings() {
        return await invoke('db_get_settings');
    },
    async updateSetting(key, value) {
        await invoke('db_update_setting', { key, value });
    },
    // 6. TRANSACTIONS / LEDGER
    async getTransactions() {
        return await invoke('db_get_transactions');
    },
    async createTransaction(tx, memberId) {
        return await invoke('db_create_transaction', { tx, memberId: memberId || null });
    },
    async updateTransactionStatus(id, paymentStatus) {
        await invoke('db_update_transaction_status', { id, paymentStatus });
    },
    async deleteTransaction(id) {
        await invoke('db_delete_transaction', { id });
    },
    async deletePreOrder(id) {
        await invoke('db_delete_preorder', { id });
    },
    async getPurchases() { return invoke('db_get_purchases'); },
    async savePurchase(receipt) { await invoke('db_save_purchase', { receipt }); },
    async deletePurchase(id) { await invoke('db_delete_purchase', { id }); },
    async importPurchases(receipts) { await invoke('db_import_purchases', { receipts }); },
    // 7. PRE-ORDERS
    async getPreOrders() {
        return await invoke('db_get_preorders');
    },
    async savePreOrder(record) {
        return await invoke('db_save_preorder', { record });
    },
    // 8. SYSTEM, EXPORT & SYNC STATUS
    async saveExportFile(filename, data) {
        return await invoke('save_export_file', { filename, data });
    },
    async getSyncStatus() {
        return await invoke('db_get_sync_status');
    },
    async triggerSync() {
        return await invoke('db_trigger_sync');
    },
    async resetCache() {
        return await invoke('db_reset_cache');
    },
    async wipeAllData(wipeCloud = true) {
        return await invoke('db_wipe_all_data', { wipeCloud });
    },
    /**
     * BUG FIX: antrean outbox harus bisa diisi dari sisi frontend.
     * Tanpa ini, fallback "offline" pada semua store membuang data karena
     * `syncService.enqueue()` hanya memanggil triggerSync tanpa menyimpan apa pun.
     */
    async enqueueOutbox(action, payload) {
        return await invoke('db_enqueue_outbox', { action, payload });
    }
};
