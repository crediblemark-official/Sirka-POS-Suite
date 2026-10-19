<script setup lang="ts">
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useDiscountStore } from '../../stores/discountStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { usePosStore } from '../../stores/posStore';
import { formatRupiah } from '../../utils/formatters';
import type { ModuleTab } from './AppLauncherTab.vue';

defineProps<{
  activeTab: ModuleTab;
}>();

const inventoryStore = useInventoryStore();
const purchaseStore = usePurchaseStore();
const buyerStore = useBuyerStore();
const discountStore = useDiscountStore();
const preOrderStore = usePreOrderStore();
const ledgerStore = useLedgerStore();
const posStore = usePosStore();
</script>

<template>
  <footer
    class="explorer-statusbar flex items-center justify-between px-3 py-1 border-t text-[11px] shrink-0 font-mono select-none"
    style="color: var(--surface-text-muted);"
  >
    <div class="flex items-center gap-3">
      <template v-if="activeTab === 'loyalty'">
        <span>{{ buyerStore.memberBuyers.length }} member terdaftar</span>
      </template>
      <template v-else-if="activeTab === 'discounts'">
        <span>{{ discountStore.discounts.length }} kupon promo ({{ discountStore.activeDiscounts.length }} aktif)</span>
      </template>
      <template v-else-if="activeTab === 'receiving'">
        <span>{{ purchaseStore.receivingItems.length }} barang di nota kulakan ({{ purchaseStore.purchaseHistory.length }} riwayat belanja)</span>
      </template>
      <template v-else-if="activeTab === 'preorder'">
        <span>{{ preOrderStore.schedules.length }} daftar pesanan aktif</span>
      </template>
      <template v-else-if="activeTab === 'ledger'">
        <span>{{ ledgerStore.transactions.length }} nota penjualan tercatat</span>
      </template>
      <template v-else-if="activeTab === 'products' || activeTab === 'master'">
        <span>{{ inventoryStore.products.length }} katalog barang aktif</span>
      </template>
      <template v-else-if="activeTab === 'vendors'">
        <span>{{ inventoryStore.categoryMarkups.length }} kategori supplier terdaftar</span>
      </template>
      <template v-else-if="activeTab === 'buyers'">
        <span>{{ buyerStore.buyers.length }} pelanggan & mitra ({{ buyerStore.b2bBuyers.length }} B2B • {{ buyerStore.b2cBuyers.length }} B2C)</span>
      </template>
      <template v-else-if="activeTab === 'branding'">
        <span>Profil Toko & Desain Nota Struk</span>
      </template>
      <template v-else>
        <span>{{ inventoryStore.products.length }} katalog barang aktif</span>
      </template>
    </div>

    <div class="flex items-center gap-4">
      <template v-if="activeTab === 'loyalty'">
        <span class="text-amber-800 font-bold">Program Member & Saldo Poin Pelanggan</span>
      </template>
      <template v-else-if="activeTab === 'discounts'">
        <span class="text-rose-700 font-bold">Kupon Diskon & Promo Potongan Harga</span>
      </template>
      <template v-else-if="activeTab === 'receiving'">
        <span>Supplier: <strong>{{ purchaseStore.selectedSupplier }}</strong></span>
        <span class="text-emerald-800 font-bold text-xs">
          Total Modal Kulakan: Rp {{ formatRupiah(purchaseStore.totalBuy) }}
        </span>
      </template>
      <template v-else-if="activeTab === 'preorder'">
        <span class="text-emerald-800 font-bold">Daftar Titip Pesan & Pengiriman Langganan</span>
      </template>
      <template v-else-if="activeTab === 'ledger'">
        <span>Total Omset: <strong class="text-blue-700">Rp {{ formatRupiah(ledgerStore.totalRevenue) }}</strong></span>
        <span class="text-emerald-800 font-bold text-xs">
          Untung Bersih: Rp {{ formatRupiah(ledgerStore.totalProfit) }}
        </span>
      </template>
      <template v-else-if="activeTab === 'products' || activeTab === 'master'">
        <span class="text-blue-800 font-bold">Katalog Barang & Stok Fisik SKU</span>
      </template>
      <template v-else-if="activeTab === 'vendors'">
        <span class="text-teal-800 font-bold">Daftar Supplier & Aturan Margin Laba</span>
      </template>
      <template v-else-if="activeTab === 'buyers'">
        <span class="text-indigo-800 font-bold">Buku Kontak Pelanggan & Member</span>
      </template>
      <template v-else-if="activeTab === 'branding'">
        <span class="text-purple-800 font-bold">Identitas Usaha & Desain Nota Struk</span>
      </template>
      <template v-else>
        <span>Pelanggan: <strong>{{ posStore.selectedBuyer }}</strong></span>
        <span class="text-blue-700 font-bold text-xs">
          Total Belanja: Rp {{ formatRupiah(posStore.totalSell) }}
        </span>
      </template>
    </div>
  </footer>
</template>
