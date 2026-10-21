<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { PurchaseReceipt } from '../types';
import { ownerApi } from '../services/api';
import { formatRupiah } from '../utils/formatters';
import HeaderBar from '../components/HeaderBar.vue';

const loading = ref(false);
const purchases = ref<PurchaseReceipt[]>([]);

async function loadPurchases() {
  loading.value = true;
  try {
    purchases.value = await ownerApi.getPurchases();
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadPurchases();
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-24 text-slate-800">
    <HeaderBar
      title="Laporan Kulakan"
      subtitle="Penerimaan Barang Supplier"
      :loading="loading"
      @refresh="loadPurchases"
    />

    <main class="p-4 space-y-3 max-w-md mx-auto">
      <div class="space-y-2">
        <div
          v-for="pr in purchases"
          :key="pr.id"
          class="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs"
        >
          <div class="flex items-start justify-between">
            <div>
              <div class="text-sm font-semibold text-slate-900">{{ pr.supplier }}</div>
              <div class="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span>{{ pr.invoiceNo }}</span>
                <span>•</span>
                <span>{{ pr.date }}</span>
              </div>
            </div>

            <div class="text-right">
              <div class="text-sm font-bold text-blue-600">
                {{ formatRupiah(pr.totalBuy) }}
              </div>
              <span class="text-[10px] text-slate-400 block mt-0.5">
                {{ pr.itemCount }} macam barang
              </span>
            </div>
          </div>
        </div>

        <div v-if="purchases.length === 0" class="text-center py-12 text-slate-400 text-sm">
          Belum ada riwayat kulakan yang dicatat.
        </div>
      </div>
    </main>
  </div>
</template>
