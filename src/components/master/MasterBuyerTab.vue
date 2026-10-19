<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Buyer, CustomerType, MembershipTier } from '../../types';
import { useBuyerStore } from '../../stores/buyerStore';
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
  RefreshCw
} from 'lucide-vue-next';
import FormSidebarDrawer from '../common/FormSidebarDrawer.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';

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

const emit = defineEmits<{
  (e: 'add-buyer', defaultType: CustomerType): void;
  (e: 'edit-buyer', buyer: Buyer): void;
}>();

const buyerStore = useBuyerStore();

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

const filteredBuyers = computed(() => {
  let list = buyerStore.buyers;
  if (localFilter.value === 'B2B') {
    list = buyerStore.b2bBuyers;
  } else if (localFilter.value === 'B2C') {
    list = buyerStore.b2cBuyers;
  }

  const q = (props.searchQuery || '').trim().toLowerCase();
  if (!q) return list;

  return list.filter(b =>
    b.name.toLowerCase().includes(q) ||
    (b.code && b.code.toLowerCase().includes(q)) ||
    (b.phone && b.phone.includes(q)) ||
    (b.address && b.address.toLowerCase().includes(q)) ||
    (b.memberCardNo && b.memberCardNo.toLowerCase().includes(q))
  );
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
  const rand = Math.floor(1000 + Math.random() * 9000);
  const prefix = buyerForm.value.customerType === 'B2B' ? 'MBR-B2B' : 'MBR-CITRA';
  buyerForm.value.memberCardNo = `${prefix}-${rand}`;
  buyerForm.value.hasMemberCard = true;
}

function handleSaveBuyer() {
  if (!buyerForm.value.name.trim()) return;

  const payload: any = {
    name: buyerForm.value.name.trim(),
    code: buyerForm.value.code ? buyerForm.value.code.trim().toUpperCase() : undefined,
    phone: buyerForm.value.phone ? buyerForm.value.phone.trim() : undefined,
    address: buyerForm.value.address ? buyerForm.value.address.trim() : undefined,
    customerType: buyerForm.value.customerType,
    memberCardNo: buyerForm.value.hasMemberCard ? (buyerForm.value.memberCardNo || undefined) : undefined,
    tier: buyerForm.value.hasMemberCard ? buyerForm.value.tier : 'REGULAR',
    points: buyerForm.value.hasMemberCard ? Number(buyerForm.value.points || 0) : 0
  };

  if (isEditing.value && activeBuyerId.value) {
    buyerStore.updateBuyer({
      ...payload,
      id: activeBuyerId.value
    });
  } else {
    buyerStore.addBuyer(
      payload.name,
      payload.code,
      payload.phone,
      payload.address,
      payload.customerType,
      payload.memberCardNo,
      payload.tier,
      payload.points
    );
  }

  showBuyerDrawer.value = false;
}

function handleDeleteBuyer(id: string, name: string) {
  if (confirm(`Yakin ingin menghapus data pelanggan "${name}"?`)) {
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
  <div class="flex-1 flex flex-col h-full bg-white select-none text-xs overflow-hidden">
    <!-- Layer 1: Ribbon Header (Standar Kulakan) -->
    <div class="relative flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 py-1.5 select-none shrink-0 gap-1.5 overflow-x-auto no-scrollbar">
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

      <div class="flex items-center gap-2 shrink-0 ml-auto">
        <span v-if="props.searchQuery" class="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
          Cari: "<span class="font-semibold text-gray-700">{{ props.searchQuery }}</span>"
        </span>
      </div>
    </div>

    <!-- 1. Ringkasan Metrik Cepat Pelanggan (Seimbang Terbagi Rata 6 Kolom, Identik Kulakan) -->
    <div class="flex items-center divide-x divide-gray-200 px-2 py-2 border-b border-gray-200 bg-white shrink-0">
      <!-- 1. Total Pelanggan -->
      <div class="flex items-center gap-2 px-2.5 first:pl-1 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <Users :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Total Pelanggan</div>
          <div class="text-xs font-bold text-gray-800 font-mono mt-0.5 truncate">{{ totalBuyers }} Orang</div>
        </div>
      </div>

      <!-- 2. Mitra Grosir B2B -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
          <Building :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Langganan Grosir</div>
          <div class="text-xs font-bold text-indigo-800 font-mono mt-0.5 truncate">{{ b2bCount }} Mitra (B2B)</div>
        </div>
      </div>

      <!-- 3. Pelanggan Eceran B2C -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
          <ShoppingBag :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Pelanggan Eceran</div>
          <div class="text-xs font-bold text-teal-800 font-mono mt-0.5 truncate">{{ b2cCount }} Pembeli (B2C)</div>
        </div>
      </div>

      <!-- 4. Member Terdaftar -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
          <CreditCard :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Member Terdaftar</div>
          <div class="text-xs font-bold text-purple-800 font-mono mt-0.5 truncate">{{ memberBuyersCount }} Kartu</div>
        </div>
      </div>

      <!-- 5. Total Poin Loyalitas -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          <Coins :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Poin Loyalitas</div>
          <div class="text-xs font-bold text-amber-800 font-mono mt-0.5 truncate">{{ totalPoints }} Poin</div>
        </div>
      </div>

      <!-- 6. Status Sinkronisasi -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <Sparkles :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Database Pelanggan</div>
          <div class="text-xs font-bold text-emerald-800 font-mono mt-0.5 truncate">Siap Kasir POS</div>
        </div>
      </div>
    </div>

    <!-- 2. Workspace: Edge-to-Edge Table on Left, FormSidebarDrawer on Right -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Tabel Pelanggan Edge-to-Edge -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <div class="flex-1" :class="showBuyerDrawer ? 'overflow-auto' : 'overflow-y-auto overflow-x-hidden'">
          <AppEmptyState
            v-if="filteredBuyers.length === 0"
            :icon="Users"
            title="Tidak Ada Pelanggan Ditemukan"
            description="Klik tombol Tambah Pelanggan untuk mendaftarkan kontak baru."
          />

          <table v-else class="table-explorer" :class="showBuyerDrawer ? 'min-w-[700px]' : ''">
            <thead>
              <tr>
                <th class="w-24">KODE</th>
                <th>NAMA PELANGGAN</th>
                <th class="w-28 text-center">TIPE PASAR</th>
                <th class="w-36">NO. WHATSAPP</th>
                <th>ALAMAT PENGIRIMAN</th>
                <th class="w-32 text-center">KARTU MEMBER</th>
                <!-- Sticky Action Header -->
                <th class="th-action-sticky w-20 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody class="font-mono">
              <tr
                v-for="buyer in filteredBuyers"
                :key="buyer.id"
                class="cursor-pointer group font-sans"
                :class="activeBuyerId === buyer.id && showBuyerDrawer ? 'bg-purple-50/90 font-medium' : ''"
                @click="handleOpenEdit(buyer)"
              >
                <td class="font-mono font-bold text-purple-900 whitespace-nowrap">
                  {{ buyer.code || `BY-${buyer.id.slice(-4)}` }}
                </td>

                <td class="font-bold text-gray-900 group-hover:text-purple-900 truncate">
                  <div class="flex items-center gap-1.5">
                    <Building v-if="buyer.customerType === 'B2B'" :size="13" class="text-indigo-600 shrink-0" />
                    <ShoppingBag v-else :size="13" class="text-teal-600 shrink-0" />
                    <span class="truncate">{{ buyer.name }}</span>
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
                  <span
                    v-if="buyer.memberCardNo"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-800 text-[10px] font-bold"
                  >
                    <CreditCard :size="10" />
                    <span>{{ buyer.tier || 'REGULAR' }}</span>
                  </span>
                  <span v-else class="text-gray-300 text-[10px] font-mono">Bukan Member</span>
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
                    placeholder="MBR-CITRA-1234"
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
