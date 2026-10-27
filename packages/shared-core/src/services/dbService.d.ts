import { PurchaseReceipt, Product, CategoryMarkupSetting, Transaction, PreOrderSchedule, Buyer, StoreSetting, Discount } from '@sirka/shared-types';
/**
 * Native Tauri Database Service
 * Pure Rust backend IPC communication connecting directly to PostgreSQL.
 */
export declare const dbService: {
    getProducts(): Promise<Product[]>;
    upsertProduct(product: Product): Promise<string>;
    updateStockAndPrice(productId: string, addedStock: number, buyPrice: number, sellPrice: number): Promise<void>;
    deleteProduct(productId: string): Promise<void>;
    generateReceiptText(tx: Record<string, unknown>, storeName?: string, paperWidth?: string): Promise<string>;
    printToNetworkPrinter(text: string, address?: string): Promise<string>;
    getBluetoothDevices(): Promise<Array<{
        name: string;
        mac: string;
    }>>;
    printToBluetoothPrinter(text: string, mac?: string, channel?: number): Promise<string>;
    detectPrinterStatus(): Promise<{
        recommended_mode: "usb" | "bluetooth" | "system";
        usb_available: boolean;
        usb_device_path: string | null;
        bluetooth_available: boolean;
        bluetooth_device_name: string | null;
        bluetooth_mac: string | null;
        status_text: string;
    }>;
    printToUsbPrinter(text: string, devicePath?: string): Promise<string>;
    getMarkups(): Promise<CategoryMarkupSetting[]>;
    updateMarkup(category: string, markupPercent: number): Promise<void>;
    createMarkup(category: string, markupPercent: number, description?: string, color?: string): Promise<void>;
    /**
     * BUG FIX: update kategori harus ikut menyimpan warna + deskripsi.
     * Sebelumnya `dbService.updateMarkup` hanya mengirim margin sehingga warna
     * kategori hilang setiap kali master dimuat ulang dari database.
     */
    updateMarkupFull(category: string, markupPercent: number, description?: string, color?: string): Promise<void>;
    deleteMarkup(category: string): Promise<void>;
    getBuyers(): Promise<Buyer[]>;
    upsertBuyer(buyer: Buyer): Promise<string>;
    deleteBuyer(id: string): Promise<void>;
    getDiscounts(): Promise<Discount[]>;
    upsertDiscount(discount: Discount): Promise<string>;
    deleteDiscount(id: string): Promise<void>;
    toggleDiscount(id: string, isActive: boolean): Promise<void>;
    getSettings(): Promise<StoreSetting[]>;
    updateSetting(key: string, value: string): Promise<void>;
    getTransactions(): Promise<Transaction[]>;
    createTransaction(tx: Transaction, memberId?: string): Promise<string>;
    updateTransactionStatus(id: string, paymentStatus: "LUNAS" | "TEMPO"): Promise<void>;
    deleteTransaction(id: string): Promise<void>;
    deletePreOrder(id: string): Promise<void>;
    getPurchases(): Promise<PurchaseReceipt[]>;
    savePurchase(receipt: PurchaseReceipt): Promise<void>;
    deletePurchase(id: string): Promise<void>;
    importPurchases(receipts: PurchaseReceipt[]): Promise<void>;
    getPreOrders(): Promise<PreOrderSchedule[]>;
    savePreOrder(record: PreOrderSchedule): Promise<string>;
    saveExportFile(filename: string, data: number[]): Promise<string>;
    getSyncStatus(): Promise<{
        is_online: boolean;
        pending_count: number;
        last_sync_time: string | null;
        last_error: string | null;
    }>;
    triggerSync(): Promise<{
        is_online: boolean;
        pending_count: number;
        last_sync_time: string | null;
        last_error: string | null;
    }>;
    resetCache(): Promise<{
        is_online: boolean;
        pending_count: number;
        last_sync_time: string | null;
        last_error: string | null;
    }>;
    wipeAllData(wipeCloud?: boolean): Promise<{
        is_online: boolean;
        pending_count: number;
        last_sync_time: string | null;
        last_error: string | null;
    }>;
    /**
     * BUG FIX: antrean outbox harus bisa diisi dari sisi frontend.
     * Tanpa ini, fallback "offline" pada semua store membuang data karena
     * `syncService.enqueue()` hanya memanggil triggerSync tanpa menyimpan apa pun.
     */
    enqueueOutbox(action: string, payload: unknown): Promise<number>;
};
//# sourceMappingURL=dbService.d.ts.map