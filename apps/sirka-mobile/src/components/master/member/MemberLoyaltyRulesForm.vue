<script setup lang="ts">
import { ref } from 'vue';
import { useBuyerStore } from '../../../stores/buyerStore';
import { formatRupiah } from '../../../utils/formatters';
import { Coins, Check, ShieldCheck, Sliders } from 'lucide-vue-next';

const buyerStore = useBuyerStore();

const tempEarnPer = ref(buyerStore.loyaltySettings.earnPerAmount);
const tempPointVal = ref(buyerStore.loyaltySettings.pointValueInRupiah);
const tempTierDiscounts = ref({ ...buyerStore.loyaltySettings.tierDiscounts });
const tempMinSpend = ref({
  SILVER: buyerStore.loyaltySettings.tierMinSpend?.SILVER || 1000000,
  GOLD: buyerStore.loyaltySettings.tierMinSpend?.GOLD || 5000000,
  PLATINUM: buyerStore.loyaltySettings.tierMinSpend?.PLATINUM || 15000000
});
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
    },
    tierMinSpend: {
      SILVER: Number(tempMinSpend.value.SILVER) || 1000000,
      GOLD: Number(tempMinSpend.value.GOLD) || 5000000,
      PLATINUM: Number(tempMinSpend.value.PLATINUM) || 15000000
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
    <!-- 1. Perolehan & Penukaran Poin -->
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

    <!-- 2. Syarat Minimum Akumulasi Belanja per Tier (Bisa di-setting manual) -->
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <div class="flex items-center justify-between">
        <label class="text-[11px] font-semibold text-gray-800 flex items-center gap-1.5">
          <Sliders :size="13" class="text-blue-600" />
          <span>Syarat Minimum Belanja Akumulasi per Tier (Rp)</span>
        </label>
        <span class="text-[9.5px] text-gray-400">Atur batas belanja</span>
      </div>

      <div class="space-y-2">
        <!-- Silver Threshold Input -->
        <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
          <div class="w-28 shrink-0">
            <span class="text-xs font-bold text-blue-700 block">🥈 SILVER</span>
            <span class="text-[10px] text-gray-500">Min. Belanja</span>
          </div>
          <div class="flex-1">
            <input
              v-model.number="tempMinSpend.SILVER"
              type="number"
              min="100000"
              step="100000"
              class="w-full bg-white border border-gray-300 rounded px-2.5 py-1 font-bold font-mono text-xs outline-none focus:border-blue-600 text-blue-900 shadow-2xs"
            />
          </div>
          <div class="w-32 text-right font-mono font-bold text-xs text-blue-800 shrink-0">
            Rp {{ formatRupiah(tempMinSpend.SILVER) }}
          </div>
        </div>

        <!-- Gold Threshold Input -->
        <div class="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
          <div class="w-28 shrink-0">
            <span class="text-xs font-bold text-amber-800 block">🥇 GOLD</span>
            <span class="text-[10px] text-gray-500">Min. Belanja</span>
          </div>
          <div class="flex-1">
            <input
              v-model.number="tempMinSpend.GOLD"
              type="number"
              min="500000"
              step="500000"
              class="w-full bg-white border border-gray-300 rounded px-2.5 py-1 font-bold font-mono text-xs outline-none focus:border-amber-600 text-amber-950 shadow-2xs"
            />
          </div>
          <div class="w-32 text-right font-mono font-bold text-xs text-amber-800 shrink-0">
            Rp {{ formatRupiah(tempMinSpend.GOLD) }}
          </div>
        </div>

        <!-- Platinum Threshold Input -->
        <div class="p-2.5 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-between gap-3">
          <div class="w-28 shrink-0">
            <span class="text-xs font-bold text-purple-800 block">💎 PLATINUM</span>
            <span class="text-[10px] text-gray-500">Min. Belanja</span>
          </div>
          <div class="flex-1">
            <input
              v-model.number="tempMinSpend.PLATINUM"
              type="number"
              min="1000000"
              step="1000000"
              class="w-full bg-white border border-gray-300 rounded px-2.5 py-1 font-bold font-mono text-xs outline-none focus:border-purple-600 text-purple-950 shadow-2xs"
            />
          </div>
          <div class="w-32 text-right font-mono font-bold text-xs text-purple-800 shrink-0">
            Rp {{ formatRupiah(tempMinSpend.PLATINUM) }}
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Diskon Otomatis per Tier Pelanggan (%) -->
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <label class="text-[11px] font-semibold text-gray-700 block">
        Diskon Otomatis per Tier Pelanggan (%)
      </label>
      <div class="grid grid-cols-4 gap-1.5">
        <div class="p-2 rounded-lg bg-slate-100 text-center">
          <span class="text-[9.5px] font-bold text-slate-600 block">REGULAR</span>
          <input
            v-model.number="tempTierDiscounts.REGULAR"
            type="number"
            min="0"
            max="100"
            class="w-full bg-white rounded mt-1 text-center font-bold font-mono text-xs py-1 shadow-2xs outline-none focus:ring-1 focus:ring-slate-400"
          />
          <span class="text-[9px] text-gray-400 block mt-0.5">% diskon</span>
        </div>

        <div class="p-2 rounded-lg bg-blue-50 text-center">
          <span class="text-[9.5px] font-bold text-blue-700 block">SILVER</span>
          <input
            v-model.number="tempTierDiscounts.SILVER"
            type="number"
            min="0"
            max="100"
            class="w-full bg-white rounded mt-1 text-center font-bold font-mono text-xs py-1 text-blue-700 shadow-2xs outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span class="text-[9px] text-blue-700 font-semibold block mt-0.5 font-mono truncate">
            &ge; {{ formatRupiah(tempMinSpend.SILVER) }}
          </span>
        </div>

        <div class="p-2 rounded-lg bg-amber-50 text-center">
          <span class="text-[9.5px] font-bold text-amber-800 block">GOLD</span>
          <input
            v-model.number="tempTierDiscounts.GOLD"
            type="number"
            min="0"
            max="100"
            class="w-full bg-white rounded mt-1 text-center font-bold font-mono text-xs py-1 text-amber-700 shadow-2xs outline-none focus:ring-1 focus:ring-amber-400"
          />
          <span class="text-[9px] text-amber-800 font-semibold block mt-0.5 font-mono truncate">
            &ge; {{ formatRupiah(tempMinSpend.GOLD) }}
          </span>
        </div>

        <div class="p-2 rounded-lg bg-purple-50 text-center">
          <span class="text-[9.5px] font-bold text-purple-800 block">PLATINUM</span>
          <input
            v-model.number="tempTierDiscounts.PLATINUM"
            type="number"
            min="0"
            max="100"
            class="w-full bg-white rounded mt-1 text-center font-bold font-mono text-xs py-1 text-purple-700 shadow-2xs outline-none focus:ring-1 focus:ring-purple-400"
          />
          <span class="text-[9px] text-purple-800 font-semibold block mt-0.5 font-mono truncate">
            &ge; {{ formatRupiah(tempMinSpend.PLATINUM) }}
          </span>
        </div>
      </div>
    </div>

    <!-- 4. Info Syarat Kenaikan Tier Otomatis (Anti-Kecurangan) -->
    <div class="p-3 bg-amber-50/80 border border-amber-200/80 rounded text-[11px] text-amber-950 space-y-1.5">
      <div class="font-bold flex items-center gap-1.5 text-xs text-amber-900">
        <ShieldCheck :size="13" class="text-amber-600 shrink-0" />
        <span>Aturan Kenaikan Tier Otomatis Sesuai Pengaturan Toko:</span>
      </div>
      <div class="grid grid-cols-2 gap-1.5 text-[10.5px] text-amber-900 font-mono">
        <div>• <strong>Regular</strong>: &lt; Rp {{ formatRupiah(tempMinSpend.SILVER) }}</div>
        <div>• <strong>Silver</strong>: &ge; Rp {{ formatRupiah(tempMinSpend.SILVER) }}</div>
        <div>• <strong>Gold</strong>: &ge; Rp {{ formatRupiah(tempMinSpend.GOLD) }}</div>
        <div>• <strong>Platinum</strong>: &ge; Rp {{ formatRupiah(tempMinSpend.PLATINUM) }}</div>
      </div>
      <p class="text-[9.5px] text-amber-700/90 italic pt-1 border-t border-amber-200/60 leading-relaxed">
        * Tier dihitung dan diperbarui otomatis oleh sistem saat transaksi selesai berdasarkan riwayat akumulasi belanja di atas. Operator kasir tidak dapat memanipulasi tier secara manual.
      </p>
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
