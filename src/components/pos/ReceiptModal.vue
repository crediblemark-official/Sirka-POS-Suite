<script setup lang="ts">
import { ref, computed } from 'vue';
import { Transaction } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import { dbService } from '../../services/dbService';
import { Printer, Copy, Check, X, ScanLine } from 'lucide-vue-next';

const props = defineProps<{
  transaction: Transaction | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

import { formatRupiah } from '../../utils/formatters';

const settingsStore = useSettingsStore();
const copied = ref(false);
const copiedThermal = ref(false);
const thermalPreview = ref(false);

// BUG-014 FIX: Struk thermal (teks 32 kolom) dibuat di Rust dan dikirim ke printer thermal
// atau driver label; hasil dapat dilihat (preview), disalin, atau disimpan ke file lewat sistem.
const thermalText = ref<string>('');

async function handleThermalPrint() {
  if (!props.transaction) return;
  try {
    thermalText.value = await dbService.generateReceiptText(
      props.transaction as unknown as Record<string, unknown>,
      settingsStore.storeName
    );
    thermalPreview.value = true;
  } catch (error) {
    alert(`Gagal membuat struk thermal: ${error}`);
  }
}

async function copyThermalText() {
  if (!navigator.clipboard || !thermalText.value) return;
  try {
    await navigator.clipboard.writeText(thermalText.value);
    copiedThermal.value = true;
    setTimeout(() => { copiedThermal.value = false; }, 2000);
  } catch { /* clipboard tidak tersedia */ }
}

async function saveThermalText() {
  if (!props.transaction) return;
  const filename = `struk_${props.transaction.invoiceNo}.txt`;
  const encoder = new TextEncoder();
  try {
    const msg = await dbService.saveExportFile(filename, Array.from(encoder.encode(thermalText.value)));
    alert(msg);
  } catch (error) {
    alert(`Gagal menyimpan teks struk: ${error}`);
  }
}

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
  return text;
});

function copyToWhatsApp() {
  if (!navigator.clipboard) return;
  navigator.clipboard.writeText(waText.value).then(() => {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  });
}

function handlePrint() {
  window.print();
}
</script>

<template>
  <div
    v-if="transaction"
    class="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 text-xs select-none"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-lg overflow-hidden flex flex-col">
      <!-- Modal Header -->
      <div class="px-4 py-2.5 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-gray-800">
        <div class="flex items-center gap-1.5 text-blue-700">
          <Printer :size="16" />
          <span>Faktur Nota Transaksi Kasir</span>
        </div>
        <button class="p-1 text-gray-400 hover:text-black rounded cursor-pointer" @click="emit('close')">
          <X :size="16" />
        </button>
      </div>

      <!-- Printable Receipt Body -->
      <div class="p-5 overflow-y-auto max-h-[70vh] bg-white text-gray-900 font-sans" id="printableReceipt">
        <!-- Receipt Top Header -->
        <div class="text-center border-b border-gray-300 pb-3 mb-3">
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

        <!-- Tanda Terima Pengiriman (Faktur B2B) — GAP-3: PRD Aturan #4 -->
        <div
          v-if="transaction.customerType !== 'B2C'"
          class="mt-4 pt-2.5 border-t-2 border-dashed border-gray-300"
        >
          <span class="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5 text-center">
            Tanda Terima Pengiriman
          </span>
          <div class="grid grid-cols-2 gap-6 text-center text-[10.5px] text-gray-600">
            <div>
              <div class="pt-6 pb-0.5 border-b border-gray-500">
                {{ transaction.picName || '' }}
              </div>
              <span class="block mt-0.5 font-semibold">Penerima (PIC Dapur)</span>
            </div>
            <div>
              <div class="pt-6 pb-0.5 border-b border-gray-500"></div>
              <span class="block mt-0.5 font-semibold">Pengirim (Toko)</span>
            </div>
          </div>
        </div>

        <!-- Receipt Footer Note -->
        <div class="mt-4 pt-3 border-t border-gray-200 text-center text-[10.5px] text-gray-500 space-y-0.5">
          <p class="font-semibold text-gray-700">
            {{ transaction.customerType === 'B2C' ? 'Terima kasih atas kunjungan Anda' : 'Terima kasih atas kerja samanya' }}
          </p>
          <p>
            {{ isPreOrderTx(transaction)
              ? 'Barang yang sudah diterima sesuai nota pesanan pelanggan'
              : 'Barang yang sudah dibeli / diterima sesuai dengan rincian nota transaksi' }}
          </p>
          <p class="text-[9.5px] text-gray-400 font-mono">Struk Resmi Toko</p>
        </div>
      </div>

      <!-- Action Buttons Footer -->
      <div class="px-4 py-3 bg-[#f6f5f2] border-t border-gray-200 flex items-center justify-between">
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
          @click="copyToWhatsApp"
        >
          <Check v-if="copied" :size="14" />
          <Copy v-else :size="14" />
          <span>{{ copied ? 'Disalin ke Clipboard!' : 'Salin Teks WhatsApp' }}</span>
        </button>

        <div class="flex items-center gap-2">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
            title="Buat struk teks 32 kolom untuk printer thermal 58mm (preview, salin, atau simpan .txt)"
            @click="handleThermalPrint"
          >
            <ScanLine :size="14" />
            <span>Struk Thermal</span>
          </button>
          <button
            class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs cursor-pointer border border-gray-300"
            @click="emit('close')"
          >
            Tutup
          </button>
          <button
            class="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
            @click="handlePrint"
          >
            <Printer :size="14" />
            <span>Cetak Nota</span>
          </button>
        </div>
      </div>

      <!-- Preview Struk Thermal (Teks 32 Kolom) — BUG-014 FIX -->
      <div v-if="thermalPreview" class="border-t border-gray-300 bg-gray-900 px-4 py-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-gray-300 uppercase tracking-wider">
            Struk Thermal (Teks 32 Kolom) — kirim ke printer 58mm / driver label
          </span>
          <button
            class="text-gray-400 hover:text-white cursor-pointer p-0.5"
            title="Tutup preview struk thermal"
            @click="thermalPreview = false"
          >
            <X :size="13" />
          </button>
        </div>
        <pre
          class="bg-black text-emerald-400 font-mono text-[10.5px] leading-relaxed p-3 rounded overflow-x-auto max-h-48"
        >{{ thermalText || '(teks struk belum dibuat)' }}</pre>
        <div class="flex items-center gap-2 mt-2">
          <button
            class="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[11px] cursor-pointer transition-colors"
            @click="copyThermalText"
          >
            <Check v-if="copiedThermal" :size="12" />
            <Copy v-else :size="12" />
            <span>{{ copiedThermal ? 'Tersalin!' : 'Salin Teks' }}</span>
          </button>
          <button
            class="px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded font-semibold text-[11px] text-gray-700 cursor-pointer transition-colors"
            @click="saveThermalText"
          >
            Simpan .txt
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  body * {
    visibility: hidden;
  }
  #printableReceipt,
  #printableReceipt * {
    visibility: visible;
  }
  #printableReceipt {
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
  }
  @page {
    size: auto;
    margin: 4mm;
  }
}
</style>
