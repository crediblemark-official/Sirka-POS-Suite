<script setup lang="ts">
import { computed } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { useBuyerStore } from '../../stores/buyerStore';
import { useDiscountStore } from '../../stores/discountStore';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import {
  ShoppingCart,
  Truck,
  Package,
  Percent,
  Users,
  Tag,
  CreditCard,
  Calendar,
  BookOpen,
  Store,
  ChevronRight,
  ArrowRight
} from 'lucide-vue-next';

export type ModuleTab =
  | 'pos'
  | 'discounts'
  | 'loyalty'
  | 'receiving'
  | 'preorder'
  | 'ledger'
  | 'products'
  | 'vendors'
  | 'buyers'
  | 'branding'
  | 'master'
  | 'launcher';

const props = withDefaults(defineProps<{
  openTabIds: ModuleTab[];
  searchQuery?: string;
}>(), {
  openTabIds: () => [],
  searchQuery: ''
});

const emit = defineEmits<{
  (e: 'open-tab', id: ModuleTab): void;
}>();

const inventoryStore = useInventoryStore();
const purchaseStore = usePurchaseStore();
const buyerStore = useBuyerStore();
const discountStore = useDiscountStore();
const preOrderStore = usePreOrderStore();
const ledgerStore = useLedgerStore();

export interface MenuItem {
  id: ModuleTab;
  title: string;
  category: string;
  description: string;
  icon: any;
  iconBoxBg: string;
  statBadge?: () => string;
}

const availableMenuItems: MenuItem[] = [
  {
    id: 'pos',
    title: 'Kasir & Penjualan',
    category: 'Transaksi Utama',
    description: 'Transaksi kasir cepat, hitung kembalian, diskon nota, dan cetak struk kasir.',
    icon: ShoppingCart,
    iconBoxBg: 'bg-blue-50 text-blue-600 border border-blue-200/80',
    statBadge: () => `${inventoryStore.products.length} SKU Barang`
  },
  {
    id: 'receiving',
    title: 'Kulakan & Barang Masuk',
    category: 'Manajemen Stok',
    description: 'Penerimaan stok dari supplier, update HPP modal, dan riwayat faktur pembelian.',
    icon: Truck,
    iconBoxBg: 'bg-amber-50 text-amber-600 border border-amber-200/80',
    statBadge: () => `${purchaseStore.purchaseHistory.length} Faktur Masuk`
  },
  {
    id: 'products',
    title: 'Daftar Barang (SKU)',
    category: 'Inventori',
    description: 'Master data barang dagangan, stok fisik gudang, satuan, dan margin harga jual.',
    icon: Package,
    iconBoxBg: 'bg-purple-50 text-purple-600 border border-purple-200/80',
    statBadge: () => `${inventoryStore.products.length} Produk`
  },
  {
    id: 'vendors',
    title: 'Supplier & Margin Untung',
    category: 'Mitra Pemasok',
    description: 'Kelola mitra distributor, kategori supplier, dan margin laba persentase otomatis.',
    icon: Percent,
    iconBoxBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/80',
    statBadge: () => `${inventoryStore.categoryMarkups.length} Kategori Supplier`
  },
  {
    id: 'buyers',
    title: 'Data Pelanggan & Mitra',
    category: 'Pelanggan',
    description: 'Database mitra grosir B2B, pelanggan eceran B2C, kontak telepon, dan riwayat belanja.',
    icon: Users,
    iconBoxBg: 'bg-indigo-50 text-indigo-600 border border-indigo-200/80',
    statBadge: () => `${buyerStore.buyers.length} Mitra / Pelanggan`
  },
  {
    id: 'discounts',
    title: 'Diskon & Kupon Promo',
    category: 'Promosi',
    description: 'Atur kupon voucher, diskon persentase, potongan rupiah tetap, dan syarat minimal belanja.',
    icon: Tag,
    iconBoxBg: 'bg-rose-50 text-rose-600 border border-rose-200/80',
    statBadge: () => `${discountStore.discounts.length} Kupon Promo`
  },
  {
    id: 'loyalty',
    title: 'Member & Poin Belanja',
    category: 'Loyalitas',
    description: 'Program member loyalitas, perolehan & penukaran poin, dan cetak kartu barcode member.',
    icon: CreditCard,
    iconBoxBg: 'bg-amber-50 text-amber-700 border border-amber-200/80',
    statBadge: () => `${buyerStore.memberBuyers.length} Member Terdaftar`
  },
  {
    id: 'preorder',
    title: 'Rekap Pesanan Mingguan',
    category: 'Pre-Order',
    description: 'Jadwal titip pesan langganan mingguan, rekap kebutuhan, dan load otomatis ke kasir.',
    icon: Calendar,
    iconBoxBg: 'bg-teal-50 text-teal-600 border border-teal-200/80',
    statBadge: () => `${preOrderStore.schedules.length} Jadwal Titip`
  },
  {
    id: 'ledger',
    title: 'Buku Kas & Piutang',
    category: 'Keuangan',
    description: 'Laporan omset penjualan, pembukuan laba kotor, monitoring utang tempo, dan ekspor data.',
    icon: BookOpen,
    iconBoxBg: 'bg-sky-50 text-sky-600 border border-sky-200/80',
    statBadge: () => `${ledgerStore.transactions.length} Nota Tercatat`
  },
  {
    id: 'branding',
    title: 'Profil Toko & Struk',
    category: 'Pengaturan',
    description: 'Kustomisasi identitas toko, nomor faktur nota struk kasir, dan penyesuaian tema UI.',
    icon: Store,
    iconBoxBg: 'bg-slate-100 text-slate-700 border border-slate-200/80',
    statBadge: () => 'Profil & Cetak'
  }
];

const filteredMenuItems = computed(() => {
  const q = (props.searchQuery || '').toLowerCase().trim();
  if (!q) return availableMenuItems;
  return availableMenuItems.filter(
    m =>
      m.title.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
  );
});
</script>

<template>
  <div class="flex-1 flex flex-col bg-[#f8f9fa] overflow-y-auto select-none">
    <div class="max-w-6xl mx-auto w-full p-6 md:p-8">
      <!-- Modern Dashboard Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div
          v-for="menu in filteredMenuItems"
          :key="menu.id"
          class="group relative bg-white border rounded-xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden hover:-translate-y-0.5"
          :class="openTabIds.includes(menu.id) ? 'border-blue-400/80 ring-1 ring-blue-500/20 bg-gradient-to-b from-blue-50/20 to-white' : 'border-gray-200/90 hover:border-blue-300'"
          @click="emit('open-tab', menu.id)"
        >
          <div>
            <!-- Top Row: Icon Box & Status Badge -->
            <div class="flex items-start justify-between">
              <div
                class="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs shrink-0"
                :class="menu.iconBoxBg"
              >
                <component :is="menu.icon" :size="20" />
              </div>

              <!-- Status Badge: Minimalist & Clean -->
              <div class="flex items-center">
                <span
                  v-if="openTabIds.includes(menu.id)"
                  class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs"
                  title="Sudah terbuka di tab kerja"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Terbuka</span>
                </span>
                <span
                  v-else
                  class="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-semibold text-gray-400 group-hover:text-blue-600 flex items-center gap-0.5"
                >
                  <span>Buka</span>
                  <ChevronRight :size="12" />
                </span>
              </div>
            </div>

            <!-- Middle: Category, Title, Description -->
            <div class="mt-3.5">
              <span class="text-[9.5px] font-bold uppercase tracking-wider text-gray-400 block mb-0.5">
                {{ menu.category }}
              </span>
              <h3 class="text-xs font-bold text-gray-900 group-hover:text-blue-600 transition-colors leading-snug line-clamp-1" :title="menu.title">
                {{ menu.title }}
              </h3>
              <p class="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed" :title="menu.description">
                {{ menu.description }}
              </p>
            </div>
          </div>

          <!-- Bottom: Module Stat & Quick Action Link -->
          <div class="mt-4 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10.5px]">
            <span class="font-mono text-gray-400 truncate max-w-[120px]">
              {{ menu.statBadge ? menu.statBadge() : '' }}
            </span>
            <span class="text-blue-600 font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
              <span>{{ openTabIds.includes(menu.id) ? 'Ke Tab' : 'Buka' }}</span>
              <ArrowRight :size="11" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
