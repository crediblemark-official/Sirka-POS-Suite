<script setup lang="ts">
import { ref, computed } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { formatRupiah } from '../../utils/formatters';
import {
  Truck,
  Plus,
  Trash2,
  CheckCircle,
  Clock,
  PackageCheck,
  FileText
} from 'lucide-vue-next';

const inventoryStore = useInventoryStore();
const purchaseStore = usePurchaseStore();

const suppliers = computed(() => {
  return inventoryStore.categoryMarkups.map(c => c.category);
});

const selectedProductToAdd = ref<string>('');
const addQty = ref<number>(10);
const addBuyPrice = ref<number>(0);
const successMessage = ref<string>('');

// Produk sesuai vendor yang dipilih
const supplierProducts = computed(() => {
  return inventoryStore.products.filter(p => p.category === purchaseStore.selectedSupplier);
});

function handleSupplierChange() {
  purchaseStore.receivingItems = [];
  selectedProductToAdd.value = '';
}

function handleSelectProduct(prodId: string) {
  const prod = supplierProducts.value.find(p => p.id === prodId);
  if (prod) {
    addBuyPrice.value = prod.lastBuyPrice || 0;
  }
}

function handleAddItem() {
  if (!selectedProductToAdd.value) return;
  const prod = supplierProducts.value.find(p => p.id === selectedProductToAdd.value);
  if (prod) {
    purchaseStore.addItemToReceiving(prod, Number(addQty.value), Number(addBuyPrice.value));
    selectedProductToAdd.value = '';
    addQty.value = 10;
    addBuyPrice.value = 0;
  }
}

async function handleSaveReceiving() {
  if (purchaseStore.receivingItems.length === 0) return;
  const res = await purchaseStore.submitReceiving();
  if (res) {
    successMessage.value = `Nota ${res.supplierInvoiceNo} berhasil disimpan! Stok & HPP barang telah diperbarui.`;
    setTimeout(() => {
      successMessage.value = '';
    }, 4000);
  }
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Top Header Strip -->
    <div class="p-3 bg-white border-b border-[#dedbd6] flex items-center justify-between shadow-xs">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
          <Truck :size="18" />
        </div>
        <div>
          <h2 class="font-bold text-sm text-gray-900 leading-tight">
            Penerimaan Barang & Input Nota Supplier (Nyetok / Inbound)
          </h2>
          <p class="text-[11px] text-gray-500">
            Catat kedatangan fisik dari vendor, perbarui stok gudang, update HPP modal, dan hitung harga jual.
          </p>
        </div>
      </div>

      <div v-if="successMessage" class="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded font-medium text-xs">
        <CheckCircle :size="15" />
        <span>{{ successMessage }}</span>
      </div>
    </div>

    <!-- Main Two-Column Layout -->
    <div class="flex-1 flex overflow-hidden p-3 gap-3">
      <!-- Left Column: Form & Table -->
      <div class="flex-1 flex flex-col gap-3 overflow-hidden">
        <!-- Invoice Metadata Card -->
        <div class="p-3 bg-white border border-[#dedbd6] rounded-lg shadow-xs">
          <div class="flex items-center gap-1.5 font-bold text-xs text-blue-700 mb-2">
            <FileText :size="15" />
            <span>Informasi Nota Fisik Supplier</span>
          </div>

          <div class="grid grid-cols-4 gap-2.5">
            <div>
              <label class="text-[11px] font-semibold text-gray-500 block mb-0.5">Kelompok Vendor *</label>
              <select
                v-model="purchaseStore.selectedSupplier"
                class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
                @change="handleSupplierChange"
              >
                <option v-for="s in suppliers" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <div>
              <label class="text-[11px] font-semibold text-gray-500 block mb-0.5">No. Nota Fisik</label>
              <input
                v-model="purchaseStore.supplierInvoiceNo"
                type="text"
                placeholder="Misal: NOTA-HB-20261016"
                class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label class="text-[11px] font-semibold text-gray-500 block mb-0.5">Tanggal Datang</label>
              <input
                v-model="purchaseStore.receiptDate"
                type="date"
                class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label class="text-[11px] font-semibold text-gray-500 block mb-0.5">Catatan Penerimaan</label>
              <input
                v-model="purchaseStore.receiptNotes"
                type="text"
                placeholder="Misal: Lengkap, kondisi segar"
                class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <!-- Add Item Bar -->
        <div class="p-2.5 bg-white border border-[#dedbd6] rounded-lg shadow-xs flex items-end gap-2">
          <div class="flex-1">
            <label class="text-[11px] font-semibold text-gray-500 block mb-0.5">
              Pilih Barang Datang ({{ purchaseStore.selectedSupplier }})
            </label>
            <select
              v-model="selectedProductToAdd"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
              @change="handleSelectProduct(selectedProductToAdd)"
            >
              <option value="" disabled>-- Pilih barang dari katalog {{ purchaseStore.selectedSupplier }} --</option>
              <option v-for="p in supplierProducts" :key="p.id" :value="p.id">
                {{ p.name }} (Stok saat ini: {{ p.stock }} {{ p.unit }})
              </option>
            </select>
          </div>

          <div class="w-24">
            <label class="text-[11px] font-semibold text-gray-500 block mb-0.5 text-center">Qty Datang</label>
            <input
              v-model.number="addQty"
              type="number"
              min="1"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs font-mono text-center outline-none focus:border-blue-500 font-bold"
            />
          </div>

          <div class="w-36">
            <label class="text-[11px] font-semibold text-gray-500 block mb-0.5 text-right">Harga Beli Nota (Rp)</label>
            <input
              v-model.number="addBuyPrice"
              type="number"
              step="500"
              min="0"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2 py-1 text-xs font-mono text-right outline-none focus:border-blue-500 font-bold"
            />
          </div>

          <button
            class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs cursor-pointer disabled:opacity-40 flex items-center gap-1 shadow-xs transition-colors h-[28px]"
            :disabled="!selectedProductToAdd"
            @click="handleAddItem"
          >
            <Plus :size="14" />
            <span>Masukkan</span>
          </button>
        </div>

        <!-- Table of Items in Receipt -->
        <div class="flex-1 bg-white border border-[#dedbd6] rounded-lg shadow-xs flex flex-col overflow-hidden">
          <div class="px-3 py-2 bg-[#f4f3ef] border-b border-gray-200 flex items-center justify-between">
            <span class="font-bold text-gray-800">
              Daftar Barang yang Masuk ke Gudang ({{ purchaseStore.receivingItems.length }} Item)
            </span>
            <span class="text-[11px] text-gray-500">Harga beli nota akan langsung mengupdate HPP barang</span>
          </div>

          <div class="flex-1 overflow-y-auto">
            <div v-if="purchaseStore.receivingItems.length === 0" class="h-full flex items-center justify-center text-gray-400 p-8">
              Belum ada barang dimasukkan. Pilih barang di form atas untuk mencatat kedatangan supplier.
            </div>

            <table v-else class="w-full text-xs text-left">
              <thead class="bg-[#fcfbfa] border-b border-gray-200 text-gray-600 font-semibold sticky top-0">
                <tr>
                  <th class="p-2">BARANG</th>
                  <th class="p-2 w-24 text-center">QTY MASUK</th>
                  <th class="p-2 w-16 text-center">SATUAN</th>
                  <th class="p-2 w-32 text-right">HARGA BELI NOTA</th>
                  <th class="p-2 w-32 text-right">SUBTOTAL BELI</th>
                  <th class="p-2 w-20 text-center">% MARKUP</th>
                  <th class="p-2 w-32 text-right">HARGA JUAL</th>
                  <th class="p-2 w-12 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in purchaseStore.receivingItems"
                  :key="item.id"
                  class="border-b border-gray-100 hover:bg-[#faf9f7]"
                >
                  <td class="p-2 font-semibold text-gray-900">{{ item.name }}</td>
                  <td class="p-2 text-center">
                    <input
                      type="number"
                      min="1"
                      :value="item.qtyReceived"
                      class="w-16 bg-gray-50 border border-gray-300 rounded px-1.5 py-0.5 text-center font-mono font-bold"
                      @input="(e: any) => purchaseStore.updateItemQty(item.id, Number(e.target.value))"
                    />
                  </td>
                  <td class="p-2 text-center text-gray-500 font-bold">{{ item.unit }}</td>
                  <td class="p-2 text-right">
                    <input
                      type="number"
                      step="500"
                      :value="item.buyPrice"
                      class="w-24 bg-gray-50 border border-gray-300 rounded px-1.5 py-0.5 text-right font-mono font-bold"
                      @input="(e: any) => purchaseStore.updateItemBuyPrice(item.id, Number(e.target.value))"
                    />
                  </td>
                  <td class="p-2 text-right font-mono font-bold text-gray-800">
                    Rp {{ formatRupiah(item.subtotalBuy) }}
                  </td>
                  <td class="p-2 text-center">
                    <span class="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-mono font-bold text-[10px]">
                      +{{ item.markupPercent }}%
                    </span>
                  </td>
                  <td class="p-2 text-right">
                    <input
                      type="number"
                      step="500"
                      :value="item.newSellPrice"
                      class="w-24 bg-blue-50 border border-blue-300 rounded px-1.5 py-0.5 text-right font-mono font-bold text-blue-700"
                      @input="(e: any) => purchaseStore.updateItemSellPrice(item.id, Number(e.target.value))"
                    />
                  </td>
                  <td class="p-2 text-center">
                    <button
                      class="p-1 text-gray-400 hover:text-red-600 rounded cursor-pointer"
                      @click="purchaseStore.removeItem(item.id)"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Table Footer -->
          <div class="p-3 bg-[#f7f5f2] border-t border-gray-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-500 font-medium">Total Modal Pembelian:</span>
              <span class="text-base font-black font-mono text-emerald-700">
                Rp {{ formatRupiah(purchaseStore.totalBuy) }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <button
                v-if="purchaseStore.receivingItems.length > 0"
                class="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-semibold text-xs cursor-pointer"
                @click="purchaseStore.clearReceivingForm"
              >
                Reset
              </button>

              <button
                class="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs disabled:opacity-40"
                :disabled="purchaseStore.receivingItems.length === 0"
                @click="handleSaveReceiving"
              >
                <PackageCheck :size="16" />
                <span>SIMPAN & UPDATE STOK / HPP</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: History -->
      <div class="w-80 bg-white border border-[#dedbd6] rounded-lg shadow-xs flex flex-col overflow-hidden shrink-0">
        <div class="p-2.5 bg-[#f4f3ef] border-b border-gray-200 flex items-center gap-1.5 font-bold text-xs text-purple-700">
          <Clock :size="15" />
          <span>Riwayat Nota Supplier</span>
        </div>

        <div class="flex-1 overflow-y-auto p-2 space-y-2">
          <div v-if="purchaseStore.purchaseHistory.length === 0" class="h-48 flex flex-col items-center justify-center text-gray-400 gap-1 text-center p-4">
            <Truck :size="32" class="opacity-40" />
            <span>Belum ada nota tersimpan</span>
          </div>

          <div
            v-for="rcp in purchaseStore.purchaseHistory"
            :key="rcp.id"
            class="p-2.5 rounded border border-gray-200 bg-[#fcfbfa] hover:border-purple-300 transition-all text-xs"
          >
            <div class="flex items-center justify-between font-bold text-blue-700">
              <span>{{ rcp.supplierInvoiceNo }}</span>
              <span class="text-[10px] text-gray-400 font-mono">{{ rcp.date }}</span>
            </div>
            <div class="text-[11px] text-gray-600 mt-1 flex justify-between">
              <span>Vendor: <strong>{{ rcp.supplier }}</strong></span>
              <span class="font-mono">{{ rcp.items.length }} item</span>
            </div>
            <div class="mt-2 flex justify-between items-center pt-1.5 border-t border-gray-100">
              <span class="text-[11px] text-gray-400">Total Modal:</span>
              <span class="font-bold font-mono text-emerald-700">Rp {{ formatRupiah(rcp.totalBuy) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
