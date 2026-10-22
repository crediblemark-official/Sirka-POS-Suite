<script setup lang="ts">
import { ref, computed } from 'vue';
import { Discount, CustomerType, CartItem } from '../../../types';
import { useDiscountStore } from '../../../stores/discountStore';
import { useInventoryStore } from '../../../stores/inventoryStore';
import { formatRupiah } from '../../../utils/formatters';
import { Calculator, AlertTriangle } from 'lucide-vue-next';

const props = defineProps<{
  discount: Discount;
}>();

const discountStore = useDiscountStore();
const inventoryStore = useInventoryStore();

const simSubtotal = ref<number>(100000);
const simIsMember = ref<boolean>(true);
// BUG FIX: `simCustomerType` sebelumnya tidak ada kontrol UI di template ->
// simulasi selalu memakai B2B, sehingga kupon scope CUSTOMER_TYPE/B2C selalu
// tampil "-Rp 0" padahal valid untuk pelanggan eceran.
const simCustomerType = ref<CustomerType>('B2C');
// BUG FIX: kupon scope CATEGORY selalu gagal di simulasi karena `cartItems`
// dikosongkan -> `eligibleSubtotal` = 0. Sekarang memakai item contoh dari
// master (nilai = subtotal simulasi).
const simCategory = ref<string>('');

const categoryOptions = computed(() =>
  inventoryStore.categoryMarkups.map(c => c.category)
);

const simResult = computed(() => {
  const dummyBuyer = {
    id: 'sim-buyer',
    name: 'Pelanggan Simulasi',
    customerType: simCustomerType.value,
    memberCardNo: simIsMember.value ? 'CITRA-SIM' : undefined,
    tier: 'REGULAR' as const
  };

  // Item contoh: seluruh subtotal simulasi diletakkan pada kategori terpilih
  // (atau kategori pertama) supaya kupon kategori bisa diuji.
  const subtotal = Number(simSubtotal.value) || 0;
  const cat = simCategory.value || categoryOptions.value[0] || 'Umum';
  const simItems: CartItem[] = subtotal > 0 ? [{
    id: 'sim-item',
    productId: 'sim-product',
    code: 'SIM',
    name: 'Simulasi Belanja',
    category: cat,
    unit: 'PCS',
    qty: 1,
    baseQty: 1,
    conversionFactor: 1,
    buyPrice: 0,
    markupPercent: 0,
    sellPrice: subtotal,
    subtotalBuy: 0,
    subtotalSell: subtotal,
    profit: 0
  }] : [];

  return discountStore.calculateDiscountAmount(
    props.discount,
    subtotal,
    dummyBuyer,
    simItems,
    simCustomerType.value
  );
});

const simFinalTotal = computed(() =>
  Math.max(0, (Number(simSubtotal.value) || 0) - (simResult.value?.amount || 0))
);
</script>

<template>
  <div class="space-y-1 divide-y divide-blue-50 bg-white p-2 rounded border border-blue-200/70 shadow-2xs">
    <span class="text-[10px] font-bold uppercase tracking-wider text-blue-700 block pb-0.5 flex items-center gap-1">
      <Calculator :size="12" />
      <span>2. Uji Coba Hitung Diskon Kasir</span>
    </span>
    <div class="pt-1 flex items-center justify-between text-[11px] gap-2">
      <span class="text-gray-500 shrink-0">Simulasi Belanja:</span>
      <div class="flex items-center gap-1">
        <span class="text-gray-400 font-mono text-[10px]">Rp</span>
        <input
          v-model.number="simSubtotal"
          type="number"
          step="5000"
          class="w-24 px-1.5 py-0.5 border border-gray-300 rounded font-mono font-bold text-right text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
    </div>
    <div class="pt-1 flex items-center justify-between text-[11px]">
      <span class="text-gray-500">Status Pembeli:</span>
      <label class="inline-flex items-center gap-1 cursor-pointer select-none">
        <input type="checkbox" v-model="simIsMember" class="rounded text-blue-600 focus:ring-0 cursor-pointer" />
        <span class="text-[10px] font-semibold text-gray-700">Pegang Kartu Member</span>
      </label>
    </div>
    <!--
      BUG FIX: kontrol tipe pelanggan & kategori tidak pernah ada -> simulasi
      tidak pernah menguji state yang sebenarnya dipakai di kasir.
    -->
    <div class="pt-1 flex items-center justify-between text-[11px] gap-2">
      <span class="text-gray-500 shrink-0">Tipe Pelanggan:</span>
      <div class="flex rounded border border-gray-300 overflow-hidden">
        <button
          type="button"
          class="px-2 py-0.5 text-[10px] font-bold cursor-pointer"
          :class="simCustomerType === 'B2C' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'"
          @click="simCustomerType = 'B2C'"
        >B2C</button>
        <button
          type="button"
          class="px-2 py-0.5 text-[10px] font-bold cursor-pointer"
          :class="simCustomerType === 'B2B' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'"
          @click="simCustomerType = 'B2B'"
        >B2B</button>
      </div>
    </div>
    <div v-if="discount.scope === 'CATEGORY'" class="pt-1 flex items-center justify-between text-[11px] gap-2">
      <span class="text-gray-500 shrink-0">Kategori Barang:</span>
      <select
        v-model="simCategory"
        class="flex-1 px-1.5 py-0.5 border border-gray-300 rounded text-[10px] bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option v-for="c in categoryOptions" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>
    <div class="pt-1 flex items-center justify-between text-[11px]">
      <span class="text-gray-500">Potongan Didapat:</span>
      <span class="font-bold font-mono text-emerald-700">
        -Rp {{ formatRupiah(simResult?.amount || 0) }}
      </span>
    </div>
    <!-- BUG FIX: alasan penolakan sebelumnya dibuang -> admin tidak tahu kenapa
         kupon tidak berlaku pada skenario yang diuji. -->
    <div v-if="simResult && !simResult.valid" class="pt-1 flex items-start gap-1.5 text-[10px] text-rose-700">
      <AlertTriangle :size="11" class="shrink-0 mt-0.5" />
      <span>{{ simResult.reason || 'Kupon tidak berlaku pada skenario ini.' }}</span>
    </div>
    <div class="pt-1 flex items-center justify-between text-[11px]">
      <span class="text-gray-700 font-bold">Total Bayar Kasir:</span>
      <span class="font-bold font-mono text-blue-800 text-xs">
        Rp {{ formatRupiah(simFinalTotal) }}
      </span>
    </div>
  </div>
</template>
