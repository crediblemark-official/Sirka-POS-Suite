<script setup lang="ts">
import { ref } from 'vue';
import { useBuyerStore } from '../../../stores/buyerStore';
import { formatRupiah } from '../../../utils/formatters';
import { Coins, Check } from 'lucide-vue-next';

const buyerStore = useBuyerStore();

const tempEarnPer = ref(buyerStore.loyaltySettings.earnPerAmount);
const tempPointVal = ref(buyerStore.loyaltySettings.pointValueInRupiah);
const tempTierDiscounts = ref({ ...buyerStore.loyaltySettings.tierDiscounts });
const isSettingsSaved = ref(false);

function saveProgramSettings() {
  buyerStore.updateLoyaltySettings({
    earnPerAmount: Number(tempEarnPer.value) || 10000,
    pointValueInRupiah: Number(tempPointVal.value) || 100,
    tierDiscounts: {
      REGULAR: Number(tempTierDiscounts.value.REGULAR) || 0,
      SILVER: Number(tempTierDiscounts.value.SILVER) || 2,
      GOLD: Number(tempTierDiscounts.value.GOLD) || 5,
      PLATINUM: Number(tempTierDiscounts.value.PLATINUM) || 8,
    }
  });
  isSettingsSaved.value = true;
  setTimeout(() => {
    isSettingsSaved.value = false;
  }, 2000);
}
</script>

<template>
  <div class="space-y-4">
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <span class="font-bold text-xs text-gray-800 flex items-center gap-1.5">
          <Coins :size="14" class="text-amber-500" />
          <span>Aturan Perolehan & Penukaran Poin</span>
        </span>
        <span v-if="isSettingsSaved" class="text-[11px] text-emerald-600 font-bold">
          ✓ Berhasil Disimpan
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">
            Belanja per Poin (Rp)
          </label>
          <input
            v-model.number="tempEarnPer"
            type="number"
            min="1000"
            step="1000"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs font-mono font-bold outline-none focus:border-amber-500 shadow-2xs"
          />
          <span class="text-[9.5px] text-gray-400 mt-0.5 block">
            Belanja Rp {{ formatRupiah(tempEarnPer) }} = 1 poin
          </span>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">
            Nilai 1 Poin (Rp)
          </label>
          <input
            v-model.number="tempPointVal"
            type="number"
            min="10"
            step="10"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs font-mono font-bold outline-none focus:border-amber-500 shadow-2xs"
          />
          <span class="text-[9.5px] text-gray-400 mt-0.5 block">
            1 poin = Rp {{ formatRupiah(tempPointVal) }} potongan
          </span>
        </div>
      </div>
    </div>

    <!-- Tier Automatic Discounts -->
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <label class="text-[11px] font-semibold text-gray-700 block">
        Diskon Otomatis per Tier Pelanggan (%)
      </label>
      <div class="grid grid-cols-4 gap-1.5">
        <div class="p-1.5 rounded bg-slate-50 border border-slate-200 text-center">
          <span class="text-[9px] font-bold text-slate-600 block">REGULAR</span>
          <input
            v-model.number="tempTierDiscounts.REGULAR"
            type="number"
            min="0"
            max="100"
            class="w-full bg-white border border-gray-300 rounded mt-1 text-center font-bold font-mono text-xs py-0.5"
          />
          <span class="text-[9px] text-gray-400 block mt-0.5">% diskon</span>
        </div>

        <div class="p-1.5 rounded bg-slate-100 border border-slate-300 text-center">
          <span class="text-[9px] font-bold text-slate-700 block">SILVER</span>
          <input
            v-model.number="tempTierDiscounts.SILVER"
            type="number"
            min="0"
            max="100"
            class="w-full bg-white border border-gray-300 rounded mt-1 text-center font-bold font-mono text-xs py-0.5 text-blue-700"
          />
          <span class="text-[9px] text-gray-400 block mt-0.5">> 1 Juta</span>
        </div>

        <div class="p-1.5 rounded bg-amber-50 border border-amber-200 text-center">
          <span class="text-[9px] font-bold text-amber-800 block">GOLD</span>
          <input
            v-model.number="tempTierDiscounts.GOLD"
            type="number"
            min="0"
            max="100"
            class="w-full bg-white border border-gray-300 rounded mt-1 text-center font-bold font-mono text-xs py-0.5 text-amber-700"
          />
          <span class="text-[9px] text-gray-400 block mt-0.5">> 5 Juta</span>
        </div>

        <div class="p-1.5 rounded bg-purple-50 border border-purple-200 text-center">
          <span class="text-[9px] font-bold text-purple-800 block">PLATINUM</span>
          <input
            v-model.number="tempTierDiscounts.PLATINUM"
            type="number"
            min="0"
            max="100"
            class="w-full bg-white border border-gray-300 rounded mt-1 text-center font-bold font-mono text-xs py-0.5 text-purple-700"
          />
          <span class="text-[9px] text-gray-400 block mt-0.5">> 15 Juta</span>
        </div>
      </div>
    </div>

    <div class="flex justify-end">
      <button
        type="button"
        class="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
        @click="saveProgramSettings"
      >
        <Check :size="13" />
        <span>Simpan Aturan Loyalitas</span>
      </button>
    </div>
  </div>
</template>
