<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { Transaction } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import { dbService } from '../../services/dbService';
import { Printer, Copy, Check, X, Loader2, Bluetooth, Cable, AlertCircle, Settings } from 'lucide-vue-next';
import { formatRupiah } from '../../utils/formatters';
import JsBarcode from 'jsbarcode';
import PrinterConfigModal from '../settings/PrinterConfigModal.vue';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

const props = defineProps<{
  transaction: Transaction | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const settingsStore = useSettingsStore();
const copied = ref(false);
const thermalText = ref<string>('');
const barcodeSvgRef = ref<SVGSVGElement | null>(null);
const showPrinterConfig = ref(false);

function renderBarcode() {
  if (barcodeSvgRef.value && props.transaction?.invoiceNo) {
    try {
      JsBarcode(barcodeSvgRef.value, props.transaction.invoiceNo, {
        format: 'CODE128',
        width: 1.6,
        height: 38,
        displayValue: false,
        margin: 0,
        background: 'transparent',
        lineColor: '#111827',
      });
    } catch (e) {
      console.warn('Gagal render barcode:', e);
    }
  }
}

// Smart Dynamic Hardware Detection State
interface DetectedPrinterState {
  recommended_mode: 'usb' | 'bluetooth' | 'system';
  usb_available: boolean;
  usb_device_path: string | null;
  bluetooth_available: boolean;
  bluetooth_device_name: string | null;
  bluetooth_mac: string | null;
  status_text: string;
}

const printerInfo = ref<DetectedPrinterState>({
  recommended_mode: 'system',
  usb_available: false,
  usb_device_path: null,
  bluetooth_available: false,
  bluetooth_device_name: null,
  bluetooth_mac: null,
  status_text: 'Memeriksa perangkat printer...'
});

const isPrinting = ref(false);
const printFeedback = ref<{ type: 'success' | 'error'; message: string } | null>(null);

// Mode aktif otomatis: USB > Bluetooth > Dialog Sistem / PDF
const activePrintMode = computed(() => {
  return printerInfo.value.recommended_mode;
});

async function refreshPrinterDetection() {
  try {
    const res = await dbService.detectPrinterStatus();
    printerInfo.value = res;
  } catch (e) {
    console.warn('Gagal deteksi printer:', e);
  }
}

async function executeSmartPrint() {
  if (isPrinting.value || !props.transaction) return;
  isPrinting.value = true;
  printFeedback.value = null;

  try {
    // Siapkan teks ESC/POS thermal jika target adalah printer hardware (USB atau Bluetooth)
    if (activePrintMode.value === 'usb' || activePrintMode.value === 'bluetooth') {
      if (!thermalText.value) {
        thermalText.value = await dbService.generateReceiptText(
          props.transaction as unknown as Record<string, unknown>,
          settingsStore.storeName,
          settingsStore.receiptPaperWidth
        );
      }
    }

    if (activePrintMode.value === 'usb') {
      const msg = await dbService.printToUsbPrinter(thermalText.value, printerInfo.value.usb_device_path || undefined);
      printFeedback.value = { type: 'success', message: `✓ ${msg}` };
    } else if (activePrintMode.value === 'bluetooth') {
      const msg = await dbService.printToBluetoothPrinter(thermalText.value, printerInfo.value.bluetooth_mac || undefined);
      printFeedback.value = { type: 'success', message: `✓ ${msg}` };
    } else {
      // Fallback: Membuka dialog cetak sistem / simpan PDF
      handlePrintGraphic();
      printFeedback.value = { type: 'success', message: '✓ Membuka dialog cetak sistem / PDF' };
    }

    setTimeout(() => {
      if (printFeedback.value?.type === 'success') {
        printFeedback.value = null;
      }
    }, 4500);
  } catch (err: any) {
    console.warn('Hardware print encountered issue, auto-falling back to system print:', err);
    printFeedback.value = {
      type: 'error',
      message: `Perangkat hardware tidak merespons. Mengalihkan otomatis ke dialog cetak sistem...`
    };
    handlePrintGraphic();
  } finally {
    isPrinting.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.transaction) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  } else if (e.key === 'Enter') {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }
    e.preventDefault();
    executeSmartPrint();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
  refreshPrinterDetection();
  nextTick(() => {
    renderBarcode();
  });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.body.classList.remove('print-graphic');
});

watch(() => props.transaction, (tx) => {
  thermalText.value = '';
  printFeedback.value = null;
  if (tx) {
    refreshPrinterDetection();
    nextTick(() => {
      renderBarcode();
    });
  }
});

function isPreOrderTx(tx: Transaction): boolean {
  if (tx.isPreOrder) return true;
  if (tx.notes && /pre-?order|po\b/i.test(tx.notes)) return true;
  return false;
}

// Generate neat WhatsApp formatted invoice text
const waText = computed(() => {
  if (!props.transaction) return '';
  const tx = props.transaction;
  const isB2C = tx.customerType === 'B2C';
  let text = isB2C
    ? `*STRUK NOTA TRANSAKSI - ${settingsStore.storeName.toUpperCase()}*\n`
    : `*FAKTUR TAGIHAN - ${settingsStore.storeName.toUpperCase()}*\n`;
  if (settingsStore.storeAddress || settingsStore.storePhone) {
    const contactParts: string[] = [];
    if (settingsStore.storeAddress) contactParts.push(settingsStore.storeAddress);
    if (settingsStore.storePhone) contactParts.push(`Telp/WA: ${settingsStore.storePhone}`);
    text += `_${contactParts.join(' • ')}_\n`;
  }
  text += `No. Nota: *${tx.invoiceNo}*\n`;
  text += `Tanggal: ${tx.date}\n`;
  text += `${isB2C ? 'Pelanggan' : 'Pembeli'}: *${tx.buyer}*\n`;
  text += `Status: *${tx.paymentStatus}* (${tx.paymentMethod})\n`;
  if (tx.picName) {
    text += `PIC Penerima: *${tx.picName}*\n`;
  }
  if (tx.notes) {
    text += `Catatan: *${tx.notes}*\n`;
  }
  text += `------------------------------------\n`;

  tx.items.forEach((item, idx) => {
    text += `${idx + 1}. *${item.name}*\n`;
    text += `   ${item.qty} ${item.unit} x Rp ${formatRupiah(item.sellPrice)} = *Rp ${formatRupiah(item.subtotalSell)}*\n`;
  });

  text += `------------------------------------\n`;
  const hasDiscounts = (tx.discountAmount && tx.discountAmount > 0) || (tx.pointsDiscount && tx.pointsDiscount > 0);
  if (hasDiscounts) {
    text += `Subtotal: Rp ${formatRupiah(tx.totalSell)}\n`;
    if (tx.discountAmount && tx.discountAmount > 0) {
      text += `Diskon Promo (${tx.discountCode || 'Voucher'}): -Rp ${formatRupiah(tx.discountAmount)}\n`;
    }
    if (tx.pointsDiscount && tx.pointsDiscount > 0) {
      text += `Tukar Poin (${tx.pointsUsed || 0} Poin): -Rp ${formatRupiah(tx.pointsDiscount)}\n`;
    }
  }
  const finalAmount = tx.finalTotal ?? (tx.totalSell - (tx.discountAmount || 0) - (tx.pointsDiscount || 0));
  text += `*TOTAL BAYAR: Rp ${formatRupiah(finalAmount)}*\n`;
  if (tx.isSplitPayment) {
    text += `  • Bayar Tunai: Rp ${formatRupiah(tx.cashAmount || 0)}\n`;
    text += `  • Bayar ${tx.nonCashMethod || 'Non-Tunai'}: Rp ${formatRupiah(tx.nonCashAmount || 0)}\n`;
  }
  if (tx.changeAmount && tx.changeAmount > 0) {
    text += `Kembalian Tunai: Rp ${formatRupiah(tx.changeAmount)}\n`;
  }
  if (tx.infaqAmount && tx.infaqAmount > 0) {
    text += `Infaq / Kotak Amal: Rp ${formatRupiah(tx.infaqAmount)}\n`;
  }
  if (tx.pointsEarned && tx.pointsEarned > 0) {
    text += `🎁 Poin Member Diperoleh: +${tx.pointsEarned} Poin\n`;
  }
  if (isPreOrderTx(tx)) {
    text += `_Keterangan: Barang sesuai nota pesanan langganan_\n`;
  }
  if (tx.paymentStatus === 'TEMPO') {
    text += `_Catatan: Transaksi ini tercatat BON / TEMPO (Piutang)_\n`;
  } else {
    text += isB2C
      ? `_Terima kasih telah berbelanja di toko kami (LUNAS)_\n`
      : `_Terima kasih atas kerja samanya (LUNAS)_\n`;
  }
  if (settingsStore.receiptFooter) {
    text += `_${settingsStore.receiptFooter}_\n`;
  }
  return text;
});

function copyToWhatsApp() {
  if (!navigator.clipboard) return;
  // BUG FIX: clipboard ditolak (permission denied / WebView Tauri) ->
  // unhandled promise rejection dan tombol tidak pernah menampilkan "Tersalin".
  navigator.clipboard.writeText(waText.value).then(() => {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }).catch((err: any) => {
    console.warn('[ReceiptModal] Gagal menyalin teks:', err);
    alert('Gagal menyalin ke clipboard. Salin manual dari pratinjau teks.');
  });
}

function handlePrintGraphic() {
  document.body.classList.add('print-graphic');
  window.onafterprint = () => {
    document.body.classList.remove('print-graphic');
  };
  nextTick(() => {
    window.print();
  });
}

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => !!props.transaction);
</script>

<template>
  <div
    v-if="transaction"
    class="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 text-xs select-none overflow-y-auto"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
      <!-- Modal Header (Pinned, Clean, No Tabs) -->
      <div class="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between font-bold text-gray-800 shrink-0">
        <div class="flex items-center gap-2 text-blue-700">
          <Printer :size="16" />
          <span class="text-xs sm:text-sm font-bold">Struk Pembayaran — #{{ transaction.invoiceNo }}</span>
        </div>

        <button
          class="p-1 text-gray-400 hover:text-black rounded cursor-pointer transition-colors"
          title="Tutup (Esc)"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Printable Receipt Body (Scrollable, Clean Single View) -->
      <div
        class="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 bg-white text-gray-900 font-sans"
        id="printableReceipt"
      >
        <!-- Receipt Top Header -->
        <div class="text-center border-b border-gray-300 pb-3 mb-3">
          <div v-if="settingsStore.storeLogo" class="flex justify-center mb-1.5">
            <img :src="settingsStore.storeLogo" alt="Store Logo" class="h-10 max-w-[120px] object-contain" />
          </div>
          <div class="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1 tracking-wider" :class="transaction.customerType === 'B2C' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-blue-100 text-blue-800 border border-blue-300'">
            {{ transaction.customerType === 'B2C' ? '🛒 Struk Belanja Kasir (Eceran / Ritel)' : '🏢 Faktur Pengiriman & Penagihan (B2B / Grosir)' }}
          </div>
          <h2 class="font-extrabold text-base tracking-wide text-gray-900">{{ settingsStore.storeName.toUpperCase() }}</h2>
          <p class="text-[11px] text-gray-500">{{ settingsStore.storeTagline }}</p>
          <p v-if="settingsStore.storeAddress || settingsStore.storePhone" class="text-[10px] text-gray-400 font-mono mt-0.5">
            {{ settingsStore.storeAddress }} {{ settingsStore.storePhone ? '• ' + settingsStore.storePhone : '' }}
          </p>
        </div>

        <!-- Meta Info -->
        <div class="grid grid-cols-2 gap-2 text-xs mb-3 border-b border-gray-200 pb-3 font-mono">
          <div>
            <div><strong>No. Nota:</strong> <span class="text-blue-700 font-bold">{{ transaction.invoiceNo }}</span></div>
            <div><strong>Tanggal:</strong> {{ transaction.date }}</div>
          </div>
          <div class="text-right">
            <div>
              <strong>{{ transaction.customerType === 'B2C' ? 'Pelanggan:' : 'Pembeli:' }}</strong>
              <span class="font-bold text-gray-800 ml-1">{{ transaction.buyer }}</span>
            </div>
            <div>
              <strong>Status:</strong>
              <span
                class="font-bold ml-1 px-1.5 py-0.2 rounded text-[10.5px]"
                :class="transaction.paymentStatus === 'LUNAS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
              >
                {{ transaction.paymentStatus }} ({{ transaction.paymentMethod }})
              </span>
            </div>
            <div v-if="transaction.customerType !== 'B2C' && transaction.picName">
              <strong>PIC:</strong>
              <span class="font-bold text-gray-800 ml-1">{{ transaction.picName }}</span>
            </div>
          </div>
        </div>

        <!-- Table of Items -->
        <table class="w-full text-xs text-left mb-3">
          <thead class="border-b border-gray-300 text-gray-600 font-semibold">
            <tr>
              <th class="py-1">NAMA BARANG</th>
              <th class="py-1 w-16 text-center">QTY</th>
              <th class="py-1 w-24 text-right">HARGA</th>
              <th class="py-1 w-28 text-right">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="item in transaction.items" :key="item.id">
              <td class="py-1.5">
                <span class="font-semibold text-gray-900">{{ item.name }}</span>
                <span class="text-[10px] text-gray-400 block">{{ item.category }}</span>
              </td>
              <td class="py-1.5 text-center font-mono font-medium">{{ item.qty }} {{ item.unit }}</td>
              <td class="py-1.5 text-right font-mono text-gray-600">Rp {{ formatRupiah(item.sellPrice) }}</td>
              <td class="py-1.5 text-right font-mono font-bold text-gray-900">Rp {{ formatRupiah(item.subtotalSell) }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Totals Breakdown -->
        <div class="border-t-2 border-dashed border-gray-300 pt-2.5 space-y-1 font-mono text-xs">
          <div v-if="(transaction.discountAmount && transaction.discountAmount > 0) || (transaction.pointsDiscount && transaction.pointsDiscount > 0)" class="flex justify-between text-gray-600">
            <span>Subtotal:</span>
            <span>Rp {{ formatRupiah(transaction.totalSell) }}</span>
          </div>

          <div v-if="transaction.discountAmount && transaction.discountAmount > 0" class="flex justify-between text-rose-600 font-semibold">
            <span>Diskon Promo ({{ transaction.discountCode || 'Voucher' }}):</span>
            <span>-Rp {{ formatRupiah(transaction.discountAmount) }}</span>
          </div>

          <div v-if="transaction.pointsDiscount && transaction.pointsDiscount > 0" class="flex justify-between text-amber-700 font-semibold">
            <span>Tukar Poin ({{ transaction.pointsUsed || 0 }} Poin):</span>
            <span>-Rp {{ formatRupiah(transaction.pointsDiscount) }}</span>
          </div>

          <div class="flex justify-between font-extrabold text-sm text-gray-900 pt-1 border-t border-gray-200">
            <span>TOTAL AKHIR:</span>
            <span class="text-blue-700">Rp {{ formatRupiah(transaction.finalTotal ?? (transaction.totalSell - (transaction.discountAmount || 0) - (transaction.pointsDiscount || 0))) }}</span>
          </div>

          <!-- Rincian Split Payment jika ada -->
          <div v-if="transaction.isSplitPayment" class="pt-1 border-t border-dashed border-gray-200 text-[11px] space-y-0.5">
            <div class="flex justify-between text-gray-700">
              <span>• Bayar Tunai:</span>
              <span>Rp {{ formatRupiah(transaction.cashAmount || 0) }}</span>
            </div>
            <div class="flex justify-between text-purple-700 font-semibold">
              <span>• Bayar {{ transaction.nonCashMethod || 'Non-Tunai' }}:</span>
              <span>Rp {{ formatRupiah(transaction.nonCashAmount || 0) }}</span>
            </div>
          </div>

          <!-- Kembalian Bersih & Infaq -->
          <div v-if="transaction.changeAmount && transaction.changeAmount > 0" class="flex justify-between text-emerald-700 font-bold text-[11.5px] pt-0.5">
            <span>Kembalian Tunai:</span>
            <span>Rp {{ formatRupiah(transaction.changeAmount) }}</span>
          </div>

          <div v-if="transaction.infaqAmount && transaction.infaqAmount > 0" class="flex justify-between text-teal-700 font-semibold text-[10.5px]">
            <span>Infaq / Kotak Amal:</span>
            <span>+Rp {{ formatRupiah(transaction.infaqAmount) }}</span>
          </div>

          <div v-if="transaction.pointsEarned && transaction.pointsEarned > 0" class="flex justify-between text-[11px] text-amber-600 font-bold pt-0.5">
            <span>🎁 Poin Member Didapat:</span>
            <span>+{{ transaction.pointsEarned }} Poin</span>
          </div>
        </div>

        <!-- Catatan Khusus Transaksi jika ada -->
        <div v-if="transaction.notes" class="mt-2.5 p-2 bg-gray-50 border border-dashed border-gray-300 rounded text-left font-mono text-[11px]">
          <span class="font-bold text-gray-600 block text-[10px]">CATATAN:</span>
          <span class="text-gray-800">{{ transaction.notes }}</span>
        </div>

        <!-- Barcode Faktur Transaksi (Code 128) -->
        <div class="mt-4 pt-3 border-t-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
          <svg ref="barcodeSvgRef" class="max-w-[260px] h-12 my-1"></svg>
          <span class="font-mono text-[11px] font-bold tracking-widest text-gray-800 -mt-0.5">
            {{ transaction.invoiceNo }}
          </span>
          <span class="text-[9.5px] text-gray-400 mt-0.5 font-mono">Scan barcode untuk lacak nota / retur</span>
        </div>

        <!-- Receipt Footer Note -->
        <div class="mt-4 pt-3 border-t border-gray-200 text-center text-[10.5px] text-gray-500 space-y-0.5">
          <p class="font-semibold text-gray-700">
            {{ settingsStore.receiptFooter || (transaction.customerType === 'B2C' ? 'Terima kasih atas kunjungan Anda' : 'Terima kasih atas kerja samanya') }}
          </p>
          <p>
            {{ isPreOrderTx(transaction)
              ? 'Barang yang sudah diterima sesuai nota pesanan pelanggan'
              : 'Barang yang sudah dibeli / diterima sesuai dengan rincian nota transaksi' }}
          </p>
          <p class="text-[9.5px] text-gray-400 font-mono">Struk Resmi Toko</p>
        </div>
      </div>

      <!-- Feedback Banner (Muncul saat mencetak atau jika ada pesan) -->
      <div
        v-if="printFeedback"
        class="px-4 py-2 text-xs font-sans flex items-center justify-between shrink-0 transition-all"
        :class="printFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-t border-b border-emerald-200' : 'bg-rose-50 text-rose-800 border-t border-b border-rose-200'"
      >
        <div class="flex items-center gap-2">
          <Check v-if="printFeedback.type === 'success'" :size="14" class="text-emerald-600" />
          <AlertCircle v-else :size="14" class="text-rose-600" />
          <span>{{ printFeedback.message }}</span>
        </div>
        <button class="text-xs text-gray-400 hover:text-gray-700 cursor-pointer ml-2" @click="printFeedback = null">✕</button>
      </div>

      <!-- Clean Single Modal Footer -->
      <div class="px-3.5 py-2.5 bg-white border-t border-gray-200 flex items-center justify-between gap-3 shrink-0">
        <!-- Left: Quick Actions -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            class="h-8 flex items-center gap-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-md font-semibold text-[11px] whitespace-nowrap cursor-pointer transition-colors shadow-xs shrink-0"
            title="Salin rincian transaksi format WhatsApp"
            @click="copyToWhatsApp"
          >
            <Check v-if="copied" :size="13" />
            <Copy v-else :size="13" />
            <span>{{ copied ? 'Tersalin' : 'Salin WA' }}</span>
          </button>

          <button
            type="button"
            class="h-8 flex items-center gap-1 px-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-md font-semibold text-[11px] whitespace-nowrap cursor-pointer border border-slate-300 transition-colors shadow-2xs shrink-0"
            title="Pengaturan hardware printer & ukuran kertas"
            @click="showPrinterConfig = true"
          >
            <Settings :size="12" />
            <span class="hidden sm:inline">Printer</span>
          </button>
        </div>

        <!-- Right: Actions (Tutup & Cetak Struk) -->
        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            class="h-8 flex items-center gap-1 px-2.5 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 rounded-md font-semibold text-[11px] whitespace-nowrap cursor-pointer border border-gray-300 transition-colors"
            title="Tutup nota (Esc)"
            @click="emit('close')"
          >
            <span>Tutup</span>
            <kbd class="text-[9px] bg-white border border-gray-300 rounded px-1 text-gray-500 font-mono">Esc</kbd>
          </button>

          <!-- Primary Smart Print Button -->
          <button
            type="button"
            class="h-8 flex items-center gap-1.5 px-3 text-white rounded-md font-bold text-[11px] whitespace-nowrap cursor-pointer shadow-xs transition-all active:scale-95 disabled:opacity-50"
            :class="{
              'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800': activePrintMode === 'usb',
              'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800': activePrintMode === 'bluetooth',
              'bg-blue-600 hover:bg-blue-700 active:bg-blue-800': activePrintMode === 'system',
            }"
            :disabled="isPrinting"
            title="Cetak struk (Tekan Enter)"
            @click="executeSmartPrint"
          >
            <Loader2 v-if="isPrinting" :size="13" class="animate-spin" />
            <Cable v-else-if="activePrintMode === 'usb'" :size="13" />
            <Bluetooth v-else-if="activePrintMode === 'bluetooth'" :size="13" />
            <Printer v-else :size="13" />

            <span v-if="isPrinting">Mencetak...</span>
            <span v-else>Cetak</span>

            <kbd class="text-[9px] bg-white/20 rounded px-1 py-0.2 text-white font-mono">↵ Enter</kbd>
          </button>
        </div>
      </div>

    </div>

    <!-- Modal Konfigurasi Hardware Printer (Modular Component) -->
    <PrinterConfigModal
      :is-open="showPrinterConfig"
      @close="showPrinterConfig = false; refreshPrinterDetection()"
    />
  </div>
</template>

<style>
@media print {
  body * {
    visibility: hidden;
  }

  body.print-graphic #printableReceipt,
  body.print-graphic #printableReceipt * {
    visibility: visible !important;
  }
  body.print-graphic #printableReceipt {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    max-width: 80mm;
    margin: 0 auto;
    padding: 8px !important;
    background: white !important;
    color: black !important;
    border: none !important;
    box-shadow: none !important;
    max-height: none !important;
    overflow: visible !important;
    display: block !important;
  }

  @page {
    size: auto;
    margin: 2mm;
  }
}
</style>
