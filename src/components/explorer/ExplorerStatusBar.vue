<script setup lang="ts">
import { useInventoryStore } from '../../stores/inventoryStore';
import { useSupplierStore } from '../../stores/supplierStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useDiscountStore } from '../../stores/discountStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { usePosStore } from '../../stores/posStore';
import { useShiftStore } from '../../stores/shiftStore';
import { useUnitStore } from '../../stores/unitStore';
import { formatRupiah } from '../../utils/formatters';
import type { ModuleTab } from './AppLauncherTab.vue';

defineProps<{
  activeTab: ModuleTab;
}>();

const inventoryStore = useInventoryStore();
const buyerStore = useBuyerStore();
const discountStore = useDiscountStore();
const preOrderStore = usePreOrderStore();
const ledgerStore = useLedgerStore();
const posStore = usePosStore();
const shiftStore = useShiftStore();
const supplierStore = useSupplierStore();
const unitStore = useUnitStore();
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
        <span>{{ unitStore.units.length }} master satuan • {{ inventoryStore.categoryMarkups.length }} kategori barang</span>
      </template>
      <template v-else-if="activeTab === 'suppliers'">
        <span>{{ supplierStore.suppliers.length }} mitra supplier pemasok</span>
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
        <span class="text-purple-800 font-bold">Master Satuan Kemasan/Eceran & Kategori Barang</span>
      </template>
      <template v-else-if="activeTab === 'suppliers'">
        <span class="text-rose-800 font-bold">Mitra Supplier & Pemasok Kulakan</span>
      </template>
      <template v-else-if="activeTab === 'buyers'">
        <span class="text-indigo-800 font-bold">Buku Kontak Pelanggan & Member</span>
      </template>
      <template v-else-if="activeTab === 'branding'">
        <span class="text-purple-800 font-bold">Identitas Usaha & Desain Nota Struk</span>
      </template>
      <!--
        BUG FIX: fallback ini (untuk tab pos/reports/returns/launcher) menampilkan
        info kasir POS (shift, pelanggan, total belanja) pada tab yang BUKAN
        POS — mis. tab Laporan Keuangan. Sekarang info POS hanya tampil di tab
        'pos'; tab lain mendapat konteks yang relevan.
      -->
      <template v-else-if="activeTab === 'pos'">
        <span v-if="shiftStore.isShiftActive" class="text-emerald-700 font-semibold flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>Shift: <strong>{{ shiftStore.currentShift?.cashierName }}</strong> ({{ shiftStore.shiftDuration }})</span>
          <span class="text-gray-400">•</span>
          <span>Kas Laci: <strong>Rp {{ formatRupiah(shiftStore.currentShift?.expectedCash || 0) }}</strong></span>
        </span>
        <span v-else class="text-amber-700 font-medium">
          Shift Belum Dibuka
        </span>
        <span class="text-gray-300">|</span>
        <span>Pelanggan: <strong>{{ posStore.selectedBuyer }}</strong></span>
        <span class="text-blue-700 font-bold text-xs">
          Total Belanja: Rp {{ formatRupiah(posStore.totalSell) }}
        </span>
      </template>
      <template v-else-if="activeTab === 'reports'">
        <span class="text-teal-800 font-bold">Laporan Keuangan, Arus Kas &amp; Audit Shift Kasir</span>
      </template>
      <template v-else-if="activeTab === 'launcher'">
        <span class="text-gray-700 font-bold">Launcher Aplikasi &amp; Pintasan Modul</span>
      </template>
      <template v-else>
        <span class="text-gray-700 font-bold">Sistem Kasir Sirka</span>
      </template>
    </div>
  </footer>
</template>
