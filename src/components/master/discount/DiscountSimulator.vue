<script setup lang="ts">
import { ref } from 'vue';
import { Discount, CustomerType } from '../../../types';
import { useDiscountStore } from '../../../stores/discountStore';
import { formatRupiah } from '../../../utils/formatters';
import { Calculator } from 'lucide-vue-next';

const props = defineProps<{
  discount: Discount;
}>();

const discountStore = useDiscountStore();

const simSubtotal = ref<number>(100000);
const simIsMember = ref<boolean>(true);
const simCustomerType = ref<CustomerType>('B2B');

function getSimResult() {
  const dummyBuyer = {
    id: 'sim-buyer',
    name: 'Pelanggan Simulasi',
    customerType: simCustomerType.value,
    memberCardNo: simIsMember.value ? 'CITRA-SIM' : undefined,
    tier: 'REGULAR' as const
  };

  return discountStore.calculateDiscountAmount(
    props.discount,
    Number(simSubtotal.value) || 0,
    dummyBuyer,
    []
  );
}
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
    <div class="pt-1 flex items-center justify-between text-[11px]">
      <span class="text-gray-500">Potongan Didapat:</span>
      <span class="font-bold font-mono text-emerald-700">
        -Rp {{ formatRupiah(getSimResult()?.amount || 0) }}
      </span>
    </div>
    <div class="pt-1 flex items-center justify-between text-[11px]">
      <span class="text-gray-700 font-bold">Total Bayar Kasir:</span>
      <span class="font-bold font-mono text-blue-800 text-xs">
        Rp {{ formatRupiah(Math.max(0, simSubtotal - (getSimResult()?.amount || 0))) }}
      </span>
    </div>
  </div>
</template>
