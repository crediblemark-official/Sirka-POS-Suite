<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Buyer, CustomerType, MembershipTier } from '../../types';
import { useBuyerStore } from '../../stores/buyerStore';
import { useSettingsStore } from '../../stores/settingsStore';
import {
  Users,
  Building,
  ShoppingBag,
  CreditCard,
  Coins,
  Sparkles,
  Edit2,
  Trash2,
  Phone,
  MapPin,
  RefreshCw,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next';
import FormSidebarDrawer from '../common/FormSidebarDrawer.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

type BuyerSortField = 'code' | 'name' | 'customerType' | 'phone' | 'address' | 'memberCardNo' | 'tier';
type SortDirection = 'asc' | 'desc';

const sortField = ref<BuyerSortField>('name');
const sortDirection = ref<SortDirection>('asc');

function toggleSort(field: BuyerSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = 'asc';
  }
}

const tierOrder: Record<string, number> = {
  'REGULAR': 1,
  'SILVER': 2,
  'GOLD': 3,
  'PLATINUM': 4
};

const tierOptions: SelectOption[] = [
  { value: 'REGULAR', label: 'REGULAR', badge: '1x Poin' },
  { value: 'SILVER', label: 'SILVER', badge: '1.2x Poin' },
  { value: 'GOLD', label: 'GOLD', badge: '1.5x Poin' },
  { value: 'PLATINUM', label: 'PLATINUM', badge: '2x Poin' }
];

const props = withDefaults(
  defineProps<{
    filterType?: 'ALL' | 'B2B' | 'B2C';
    searchQuery?: string;
  }>(),
  {
    filterType: 'ALL',
    searchQuery: ''
  }
);

const localFilter = ref<'ALL' | 'B2B' | 'B2C'>(props.filterType || 'ALL');

// BUG FIX: `localFilter` di-init dari `props.filterType` tapi TIDAK di-watch
// -> perubahan filterType dari parent tidak pernah terpakai.
watch(
  () => props.filterType,
  (val) => {
    if (val && val !== localFilter.value) localFilter.value = val;
  }
);

const emit = defineEmits<{
  (e: 'add-buyer', defaultType: CustomerType): void;
  (e: 'edit-buyer', buyer: Buyer): void;
}>();

const buyerStore = useBuyerStore();
const settingsStore = useSettingsStore();

// Drawer state for Buyer (Terhubung dengan Header Toolbar Tombol Cart)
const isEditing = ref(false);
const activeBuyerId = ref<string>('');

const showBuyerDrawer = computed({
  get: () => buyerStore.showBuyerSidebar,
  set: (val: boolean) => {
    buyerStore.showBuyerSidebar = val;
    if (!val) {
      isEditing.value = false;
      activeBuyerId.value = '';
    }
  }
});

const buyerForm = ref<{
  name: string;
  code: string;
  phone: string;
  address: string;
  customerType: CustomerType;
  hasMemberCard: boolean;
  memberCardNo: string;
  tier: MembershipTier;
  points: number;
}>({
  name: '',
  code: '',
  phone: '',
  address: '',
  customerType: 'B2B',
  hasMemberCard: false,
  memberCardNo: '',
  tier: 'REGULAR',
  points: 0
});

// Computed Metrics
const totalBuyers = computed(() => buyerStore.buyers.length);
const b2bCount = computed(() => buyerStore.b2bBuyers.length);
const b2cCount = computed(() => buyerStore.b2cBuyers.length);
const memberBuyersCount = computed(() => buyerStore.memberBuyers.length);

const totalPoints = computed(() => {
  return buyerStore.buyers.reduce((acc, b) => acc + (b.points || 0), 0);
});

const buyerMetrics = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Pelanggan',
    value: `${totalBuyers.value} Orang`,
    icon: Users,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-gray-800'
  },
  {
    label: 'Langganan Grosir',
    value: `${b2bCount.value} Mitra (B2B)`,
    icon: Building,
    iconBoxClass: 'bg-indigo-50 text-indigo-700',
    valClass: 'text-indigo-800'
  },
  {
    label: 'Pelanggan Eceran',
    value: `${b2cCount.value} Pembeli (B2C)`,
    icon: ShoppingBag,
    iconBoxClass: 'bg-teal-50 text-teal-700',
    valClass: 'text-teal-800'
  },
  {
    label: 'Member Terdaftar',
    value: `${memberBuyersCount.value} Kartu`,
    icon: CreditCard,
    iconBoxClass: 'bg-purple-50 text-purple-700',
    valClass: 'text-purple-800'
  },
  {
    label: 'Poin Loyalitas',
    value: `${totalPoints.value} Poin`,
    icon: Coins,
    iconBoxClass: 'bg-amber-50 text-amber-700',
    valClass: 'text-amber-800'
  },
  {
    label: 'Database Pelanggan',
    value: 'Siap Kasir POS',
    icon: Sparkles,
    iconBoxClass: 'bg-emerald-50 text-emerald-700',
    valClass: 'text-emerald-800'
  }
]);

const filteredBuyers = computed(() => {
  let list = buyerStore.buyers;
  if (localFilter.value === 'B2B') {
    list = buyerStore.b2bBuyers;
  } else if (localFilter.value === 'B2C') {
    list = buyerStore.b2cBuyers;
  }

  // BUG FIX: query tidak menormalisasi spasi ganda -> "Toko  Barokah" (2 spasi)
  // tidak ditemukan oleh query "toko barokah".
  const q = (props.searchQuery || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!q) return list;

  const norm = (s?: string) => (s || '').toLowerCase().replace(/\s+/g, ' ');

  return list.filter(b =>
    norm(b.name).includes(q) ||
    (b.code && norm(b.code).includes(q)) ||
    (b.phone && b.phone.includes(q)) ||
    (b.address && norm(b.address).includes(q)) ||
    (b.memberCardNo && norm(b.memberCardNo).includes(q))
  );
});

const sortedBuyers = computed(() => {
  const list = [...filteredBuyers.value];
  const field = sortField.value;
  const dir = sortDirection.value === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    switch (field) {
      case 'code':
        return dir * (a.code || '').localeCompare(b.code || '');
      case 'name':
        return dir * (a.name || '').localeCompare(b.name || '');
      case 'customerType':
        return dir * (a.customerType || '').localeCompare(b.customerType || '');
      case 'phone':
        return dir * (a.phone || '').localeCompare(b.phone || '');
      case 'address':
        return dir * (a.address || '').localeCompare(b.address || '');
      case 'memberCardNo':
        return dir * (a.memberCardNo || '').localeCompare(b.memberCardNo || '');
      case 'tier': {
        const orderA = tierOrder[a.tier || ''] || 0;
        const orderB = tierOrder[b.tier || ''] || 0;
        return dir * (orderA - orderB);
      }
      default:
        return 0;
    }
  });

  return list;
});

function handleOpenAdd(defaultType: CustomerType = 'B2B') {
  isEditing.value = false;
  activeBuyerId.value = '';
  buyerForm.value = {
    name: '',
    code: '',
    phone: '',
    address: '',
    customerType: defaultType,
    hasMemberCard: false,
    memberCardNo: '',
    tier: 'REGULAR',
    points: 0
  };
  showBuyerDrawer.value = true;
}

function handleOpenEdit(buyer: Buyer) {
  isEditing.value = true;
  activeBuyerId.value = buyer.id;
  buyerForm.value = {
    name: buyer.name,
    code: buyer.code || '',
    phone: buyer.phone || '',
    address: buyer.address || '',
    customerType: buyer.customerType || 'B2B',
    hasMemberCard: Boolean(buyer.memberCardNo),
    memberCardNo: buyer.memberCardNo || '',
    tier: buyer.tier || 'REGULAR',
    points: buyer.points || 0
  };
  showBuyerDrawer.value = true;
}

watch(
  () => buyerStore.showBuyerSidebar,
  (isOpen) => {
    if (isOpen && !isEditing.value && !activeBuyerId.value) {
      handleOpenAdd(localFilter.value === 'B2C' ? 'B2C' : 'B2B');
    }
  }
);

function generateCardNumber() {
  // BUG FIX: sebelumnya nomor kartu dibuat acak 4 digit (~1/9000 bentrok)
  // TANPA cek keunikan → dua anggota bisa memiliki kartu sama, dan kasir
  // yang memindai akan menempelkan member yang SALAH (poin & tier ikut salah).
  // Sekarang memakai generator aman dari store.
  buyerForm.value.memberCardNo = buyerStore.generateMemberCardNo(
    settingsStore.storeCode || 'SIRKA',
    buyerForm.value.customerType
  );
  buyerForm.value.hasMemberCard = true;
}

async function handleSaveBuyer() {
  const name = buyerForm.value.name.trim();
  if (!name) return;

  // BUG FIX: nama pelanggan dipakai sebagai foreign key di POS
  // (`getBuyerByName`). Dua pelanggan dengan nama sama membuat SEMUA transaksi
  // "Toko Barokah" selalu menunjuk pelanggan pertama -> poin, tier, dan diskon
  // member masuk ke pelanggan yang keliru.
  const duplicate = buyerStore.buyers.find(
    b => b.name.trim().toLowerCase() === name.toLowerCase() && b.id !== activeBuyerId.value
  );
  if (duplicate) {
    alert(
      `Pelanggan dengan nama "${name}" sudah terdaftar (${duplicate.code || duplicate.id}).\n` +
      `Nama pelanggan harus unik karena kasir mengaitkan transaksi berdasarkan nama.`
    );
    return;
  }

  const existingBuyer = isEditing.value && activeBuyerId.value
    ? buyerStore.buyers.find(b => b.id === activeBuyerId.value)
    : undefined;

  const payload: any = {
    name,
    // BUG FIX: kode fallback `BY-xxxx` sebelumnya hanya ditampilkan di tabel
    // tanpa disimpan -> tidak bisa dicari & bentrok bila 2 buyer punya id
    // berakhir sama. Sekarang disimpan ke master.
    code: buyerForm.value.code
      ? buyerForm.value.code.trim().toUpperCase()
      : (existingBuyer?.code || `BY-${(existingBuyer?.id || name).slice(-4).toUpperCase()}`),
    phone: buyerForm.value.phone ? buyerForm.value.phone.trim() : undefined,
    address: buyerForm.value.address ? buyerForm.value.address.trim() : undefined,
    customerType: buyerForm.value.customerType,
    memberCardNo: buyerForm.value.hasMemberCard ? (buyerForm.value.memberCardNo || undefined) : undefined,
    tier: buyerForm.value.hasMemberCard ? buyerForm.value.tier : 'REGULAR',
    points: buyerForm.value.hasMemberCard ? Number(buyerForm.value.points || 0) : 0
  };

  if (isEditing.value && activeBuyerId.value) {
    // BUG FIX: kirim objek buyer yang ada supaya `totalSpend`, `memberSince`,
    // dan field turunan lain tidak hilang (tier member runtuh permanen).
    const existing = existingBuyer;
    try {
      await buyerStore.updateBuyer({
        ...(existing || {}),
        ...payload,
        id: activeBuyerId.value
      } as any);
    } catch (err: any) {
      alert(`Gagal menyimpan data pelanggan: ${err?.message || err}`);
      return;
    }
  } else {
    try {
      await buyerStore.addBuyer(
        payload.name,
        payload.code,
        payload.phone,
        payload.address,
        payload.customerType,
        payload.memberCardNo,
        payload.tier,
        payload.points
      );
    } catch (err: any) {
      alert(`Gagal menyimpan pelanggan: ${err?.message || err}`);
      return;
    }
  }

  showBuyerDrawer.value = false;
}

const { confirm: showConfirm } = useConfirmDialog();

async function handleDeleteBuyer(id: string, name: string) {
  const isConfirmed = await showConfirm({
    title: 'Hapus Data Pelanggan',
    message: `Yakin ingin menghapus data pelanggan "${name}"?`,
    details: 'Riwayat transaksi masa lalu tetap tersimpan, namun pelanggan tidak akan muncul lagi di daftar pilihan kasir.',
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger'
  });

  if (isConfirmed) {
    buyerStore.deleteBuyer(id);
    if (activeBuyerId.value === id) {
      showBuyerDrawer.value = false;
    }
  }
}

defineExpose({
  openAdd: handleOpenAdd
});
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Main Workspace: Split Layar (Kiri: Tabel Pelanggan & Ribbon, Kanan: FormSidebarDrawer) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sisi Kiri: Ribbon + MetricStatsStrip + Tabel Pelanggan Edge-to-Edge -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- Layer 1: Ribbon Header (Standar Kulakan) -->
        <div
          v-horizontal-scroll
          class="h-10 relative flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 select-none shrink-0 gap-1.5 overflow-x-auto no-scrollbar"
        >
          <div class="flex items-center gap-2 shrink-0">
            <Users :size="15" class="text-indigo-700" />
            <span class="font-bold text-xs text-gray-800">Data Pelanggan & Mitra</span>
            <!-- Filter Pills Horizontal -->
            <div class="flex items-center gap-1 ml-2">
              <button
                @click="localFilter = 'ALL'"
                :class="[
                  'px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer',
                  localFilter === 'ALL'
                    ? 'bg-white shadow-2xs border border-gray-300 text-gray-900 font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
                ]"
              >
                Semua
                <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-200 text-gray-700 font-bold">{{ totalBuyers }}</span>
              </button>
              <button
                @click="localFilter = 'B2B'"
                :class="[
                  'px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer',
                  localFilter === 'B2B'
                    ? 'bg-white shadow-2xs border border-gray-300 text-indigo-900 font-bold'
                    : 'text-gray-600 hover:text-indigo-900 hover:bg-gray-200/50'
                ]"
              >
                Grosir B2B
                <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">{{ b2bCount }}</span>
              </button>
              <button
                @click="localFilter = 'B2C'"
                :class="[
                  'px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer',
                  localFilter === 'B2C'
                    ? 'bg-white shadow-2xs border border-gray-300 text-teal-900 font-bold'
                    : 'text-gray-600 hover:text-teal-900 hover:bg-gray-200/50'
                ]"
              >
                Eceran B2C
                <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-800 font-bold">{{ b2cCount }}</span>
              </button>
            </div>
          </div>

          <div v-if="props.searchQuery" class="flex items-center gap-2 shrink-0 ml-auto">
            <span class="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium">
              Cari: "<span class="font-bold text-gray-800">{{ props.searchQuery }}</span>"
            </span>
          </div>
        </div>

        <!-- Reusable MetricStatsStrip (DRY) di sisi kiri -->
        <MetricStatsStrip :items="buyerMetrics" />

        <div class="flex-1" :class="showBuyerDrawer ? 'overflow-auto' : 'overflow-y-auto overflow-x-hidden'">
          <AppEmptyState
            v-if="filteredBuyers.length === 0"
            :icon="Users"
            title="Tidak Ada Pelanggan Ditemukan"
            description="Klik tombol Tambah Pelanggan untuk mendaftarkan kontak baru."
          />

          <table v-else class="table-explorer whitespace-nowrap" :class="showBuyerDrawer ? 'min-w-[700px]' : ''">
            <thead>
              <tr>
                <th
                  class="is-sortable w-24"
                  :class="{ 'is-sorted': sortField === 'code' }"
                  title="Klik untuk mengurutkan kode"
                  @click="toggleSort('code')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>KODE</span>
                    <ArrowUp v-if="sortField === 'code' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'code' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable"
                  :class="{ 'is-sorted': sortField === 'name' }"
                  title="Klik untuk mengurutkan nama pelanggan"
                  @click="toggleSort('name')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>NAMA PELANGGAN</span>
                    <ArrowUp v-if="sortField === 'name' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'name' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-28 text-center"
                  :class="{ 'is-sorted': sortField === 'customerType' }"
                  title="Klik untuk mengurutkan tipe pasar"
                  @click="toggleSort('customerType')"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <span>TIPE PASAR</span>
                    <ArrowUp v-if="sortField === 'customerType' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'customerType' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-36"
                  :class="{ 'is-sorted': sortField === 'phone' }"
                  title="Klik untuk mengurutkan no. telepon"
                  @click="toggleSort('phone')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>NO. WHATSAPP</span>
                    <ArrowUp v-if="sortField === 'phone' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'phone' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable"
                  :class="{ 'is-sorted': sortField === 'address' }"
                  title="Klik untuk mengurutkan alamat"
                  @click="toggleSort('address')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>ALAMAT PENGIRIMAN</span>
                    <ArrowUp v-if="sortField === 'address' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'address' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-32 text-center"
                  :class="{ 'is-sorted': sortField === 'memberCardNo' }"
                  title="Klik untuk mengurutkan no. kartu member"
                  @click="toggleSort('memberCardNo')"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <span>KARTU MEMBER</span>
                    <ArrowUp v-if="sortField === 'memberCardNo' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'memberCardNo' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-24 text-center"
                  :class="{ 'is-sorted': sortField === 'tier' }"
                  title="Klik untuk mengurutkan tier"
                  @click="toggleSort('tier')"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <span>TIER</span>
                    <ArrowUp v-if="sortField === 'tier' && sortDirection === 'asc'" :size="12" class="text-purple-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'tier' && sortDirection === 'desc'" :size="12" class="text-purple-600 shrink-0" />
                  </div>
                </th>
                <!-- Sticky Action Header -->
                <th class="th-action-sticky w-20 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody class="font-mono">
              <tr
                v-for="buyer in sortedBuyers"
                :key="buyer.id"
                class="cursor-pointer group font-sans whitespace-nowrap"
                :class="activeBuyerId === buyer.id && showBuyerDrawer ? 'bg-purple-50/90 font-medium' : ''"
                @click="handleOpenEdit(buyer)"
              >
                <td class="font-mono font-bold text-purple-900 whitespace-nowrap">
                  <!--
                    BUG FIX: kode fallback `BY-xxxx` hanya ditampilkan, tidak
                    disimpan ke master -> kode yang tampil tidak bisa dicari /
                    dipakai di form kupon/PO, dan 2 buyer dengan id berakhir
                    sama menghasilkan kode bentrok. Sekarang disimpan saat
                    pelanggan dibuat/diedit.
                  -->
                  {{ buyer.code || '—' }}
                </td>

                <td class="font-bold text-gray-900 group-hover:text-purple-900 truncate whitespace-nowrap">
                  <div class="flex items-center gap-1.5 whitespace-nowrap">
                    <Building v-if="buyer.customerType === 'B2B'" :size="13" class="text-indigo-600 shrink-0" />
                    <ShoppingBag v-else :size="13" class="text-teal-600 shrink-0" />
                    <span class="truncate whitespace-nowrap">{{ buyer.name }}</span>
                  </div>
                </td>

                <td class="text-center font-sans whitespace-nowrap">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold inline-block"
                    :class="buyer.customerType === 'B2B' ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'"
                  >
                    {{ buyer.customerType === 'B2B' ? 'B2B Grosir' : 'B2C Eceran' }}
                  </span>
                </td>

                <td class="text-gray-600 font-mono text-[11px] whitespace-nowrap">
                  <div v-if="buyer.phone" class="flex items-center gap-1">
                    <Phone :size="11" class="text-emerald-600 shrink-0" />
                    <span>{{ buyer.phone }}</span>
                  </div>
                  <span v-else class="text-gray-300">-</span>
                </td>

                <td class="text-gray-600 text-[11px] truncate">
                  <div v-if="buyer.address" class="flex items-center gap-1">
                    <MapPin :size="11" class="text-rose-500 shrink-0" />
                    <span class="truncate">{{ buyer.address }}</span>
                  </div>
                  <span v-else class="text-gray-300">-</span>
                </td>

                <td class="text-center font-sans whitespace-nowrap">
                  <!--
                    BUG FIX: kolom "KARTU MEMBER" sebelumnya menampilkan TIER
                    (bukan nomor kartu) sehingga admin tidak pernah bisa
                    melihat/mencopy nomor kartu untuk checking. Sekarang
                    nomor kartu ditampilkan, tier dipindah ke kolom terpisah.
                  -->
                  <span
                    v-if="buyer.memberCardNo"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-[10px] font-bold font-mono"
                    :title="`Tier ${buyer.tier || 'REGULAR'}`"
                  >
                    <CreditCard :size="10" />
                    <span>{{ buyer.memberCardNo }}</span>
                  </span>
                  <span v-else class="text-gray-300 text-[10px] font-mono">Bukan Member</span>
                </td>

                <td class="text-center font-sans whitespace-nowrap">
                  <span
                    v-if="buyer.memberCardNo"
                    class="px-2 py-0.5 rounded text-[10px] font-bold inline-block"
                    :class="{
                      'bg-amber-100 text-amber-800': buyer.tier === 'GOLD',
                      'bg-slate-200 text-slate-800': buyer.tier === 'PLATINUM',
                      'bg-gray-100 text-gray-700': !['GOLD', 'PLATINUM'].includes(buyer.tier || '')
                    }"
                  >
                    {{ buyer.tier || 'REGULAR' }}
                  </span>
                  <span v-else class="text-gray-300 text-[10px] font-mono">-</span>
                </td>

                <!-- Sticky Action Cell -->
                <td class="td-action-sticky text-center whitespace-nowrap" @click.stop>
                  <div class="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      class="p-1 text-gray-400 hover:text-purple-700 hover:bg-purple-100 rounded cursor-pointer transition-colors"
                      title="Edit Data Pelanggan"
                      @click="handleOpenEdit(buyer)"
                    >
                      <Edit2 :size="13" />
                    </button>
                    <button
                      type="button"
                      class="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                      title="Hapus Pelanggan"
                      @click="handleDeleteBuyer(buyer.id, buyer.name)"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sisi Kanan: FormSidebarDrawer untuk Input/Edit Pelanggan -->
      <FormSidebarDrawer
        v-model="showBuyerDrawer"
        :is-editing="isEditing"
        title="Data Pelanggan"
        :code-badge="buyerForm.code || (buyerForm.customerType === 'B2B' ? 'B2B-MITRA' : 'B2C-ECERAN')"
        :can-edit="isEditing"
        :can-save="!!buyerForm.name.trim()"
        :save-label="isEditing ? 'SIMPAN PERUBAHAN' : 'SIMPAN PELANGGAN'"
        theme-color="purple"
        @switch-to-new="handleOpenAdd(buyerForm.customerType)"
        @switch-to-edit="isEditing = true"
        @save="handleSaveBuyer"
        @delete="activeBuyerId && handleDeleteBuyer(activeBuyerId, buyerForm.name)"
        @cancel="showBuyerDrawer = false"
      >
        <template #icon>
          <Users :size="14" class="text-purple-700 shrink-0" />
        </template>

        <div class="space-y-4">
          <!-- Tipe Pasar (Pills Segmen) -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Segmen / Jenis Pasar *</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 py-1.5 rounded border text-xs font-semibold cursor-pointer transition-all"
                :class="buyerForm.customerType === 'B2B' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 font-bold shadow-2xs' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'"
                @click="buyerForm.customerType = 'B2B'"
              >
                <Building :size="13" />
                <span>Langganan Grosir (B2B)</span>
              </button>

              <button
                type="button"
                class="flex items-center justify-center gap-1.5 py-1.5 rounded border text-xs font-semibold cursor-pointer transition-all"
                :class="buyerForm.customerType === 'B2C' ? 'bg-teal-50 border-teal-500 text-teal-700 font-bold shadow-2xs' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'"
                @click="buyerForm.customerType = 'B2C'"
              >
                <ShoppingBag :size="13" />
                <span>Pelanggan Eceran (B2C)</span>
              </button>
            </div>
          </div>

          <!-- Nama Pelanggan -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Nama Lengkap / Nama Toko *</label>
            <input
              v-model="buyerForm.name"
              type="text"
              placeholder="Contoh: Toko Barokah / Bpk. Sutrisno"
              required
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-bold text-gray-900"
            />
          </div>

          <!-- Kode & No Telepon / WA -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] font-semibold text-gray-700 block mb-1">Kode Pelanggan</label>
              <input
                v-model="buyerForm.code"
                type="text"
                placeholder="BY-001"
                class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-mono font-bold uppercase"
              />
            </div>
            <div>
              <label class="text-[11px] font-semibold text-gray-700 block mb-1">No. WhatsApp / HP</label>
              <input
                v-model="buyerForm.phone"
                type="text"
                placeholder="0812-3456-7890"
                class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-mono"
              />
            </div>
          </div>

          <!-- Alamat Lengkap -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Alamat Pengiriman / Domisili</label>
            <textarea
              v-model="buyerForm.address"
              rows="2"
              placeholder="Alamat toko atau rumah untuk pengiriman barang"
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 resize-none text-gray-800"
            ></textarea>
          </div>

          <!-- Bagian Kartu Member & Loyalitas -->
          <div class="pt-3 border-t border-gray-200">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5 font-bold text-gray-800 text-xs">
                <CreditCard :size="13" class="text-purple-600" />
                <span>Kartu Member & Loyalitas</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="buyerForm.hasMemberCard"
                  type="checkbox"
                  class="sr-only peer"
                />
                <div class="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <!-- Detail Member Jika Aktif -->
            <div v-if="buyerForm.hasMemberCard" class="space-y-3 p-3 bg-purple-50/50 rounded border border-purple-200/80">
              <div>
                <label class="text-[10px] font-semibold text-gray-600 block mb-1">Nomor Kartu Member</label>
                <div class="flex items-center gap-1.5">
                  <input
                    v-model="buyerForm.memberCardNo"
                    type="text"
                    :placeholder="`${settingsStore.storeCode}-1234`"
                    class="flex-1 bg-white border border-gray-300 rounded px-2.5 py-1 text-xs font-mono font-bold text-purple-900 outline-none focus:border-purple-600 uppercase"
                  />
                  <button
                    type="button"
                    class="flex items-center gap-1 px-2 py-1 bg-white border border-gray-300 hover:bg-gray-100 rounded text-[11px] font-semibold text-gray-700 cursor-pointer"
                    title="Generate Nomor Kartu Otomatis"
                    @click="generateCardNumber"
                  >
                    <RefreshCw :size="11" />
                    <span>Buat</span>
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-[10px] font-semibold text-gray-600 block mb-1">Tier / Level Member</label>
                  <SearchableSelect
                    v-model="buyerForm.tier"
                    :options="tierOptions"
                    placeholder="Pilih Tier..."
                    search-placeholder="Cari tier..."
                    hotkey=""
                  />
                </div>
                <div>
                  <label class="text-[10px] font-semibold text-gray-600 block mb-1">Saldo Poin</label>
                  <input
                    v-model.number="buyerForm.points"
                    type="number"
                    min="0"
                    class="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-mono font-bold text-amber-700 outline-none focus:border-purple-600"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </FormSidebarDrawer>
    </div>
  </div>
</template>
