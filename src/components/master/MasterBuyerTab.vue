<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Buyer, CustomerType } from '../../types';
import { useBuyerStore } from '../../stores/buyerStore';
import { Plus, Edit2, Trash2, Building, ShoppingBag, Search, Users } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    filterType?: 'ALL' | 'B2B' | 'B2C';
    hideFilterTabs?: boolean;
  }>(),
  {
    filterType: 'ALL',
    hideFilterTabs: false
  }
);

const emit = defineEmits<{
  (e: 'add-buyer', defaultType: CustomerType): void;
  (e: 'edit-buyer', buyer: Buyer): void;
}>();

const buyerStore = useBuyerStore();
const activeFilter = ref<'ALL' | 'B2B' | 'B2C'>(props.filterType);
const searchQuery = ref('');

watch(
  () => props.filterType,
  (newVal) => {
    activeFilter.value = newVal;
  }
);

const filteredBuyers = computed(() => {
  let list = buyerStore.buyers;
  if (activeFilter.value === 'B2B') {
    list = buyerStore.b2bBuyers;
  } else if (activeFilter.value === 'B2C') {
    list = buyerStore.b2cBuyers;
  }

  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return list;

  return list.filter(b =>
    b.name.toLowerCase().includes(q) ||
    (b.code && b.code.toLowerCase().includes(q)) ||
    (b.phone && b.phone.includes(q)) ||
    (b.address && b.address.toLowerCase().includes(q))
  );
});

function handleDeleteBuyer(id: string, name: string) {
  if (confirm(`Yakin ingin menghapus data pelanggan "${name}"?`)) {
    buyerStore.deleteBuyer(id);
  }
}

function handleAddClick() {
  emit('add-buyer', activeFilter.value === 'B2C' ? 'B2C' : 'B2B');
}
</script>

<template>
  <div class="bg-white border border-[#dedbd6] rounded-lg shadow-xs flex flex-col overflow-hidden text-xs select-none">
    <!-- Header -->
    <div class="p-3 bg-[#f6f5f2] border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
      <div>
        <div class="flex items-center gap-1.5 font-bold text-xs" :class="activeFilter === 'B2C' ? 'text-emerald-700' : 'text-blue-700'">
          <component :is="activeFilter === 'B2C' ? ShoppingBag : (activeFilter === 'B2B' ? Building : Users)" :size="15" />
          <span>
            {{
              activeFilter === 'B2C'
                ? `Daftar Pelanggan Eceran (B2C) — ${buyerStore.b2cBuyers.length} Terdaftar`
                : activeFilter === 'B2B'
                ? `Daftar Pembeli Grosir (B2B) — ${buyerStore.b2bBuyers.length} Terdaftar`
                : `Daftar Semua Pembeli & Pelanggan (${buyerStore.buyers.length} Terdaftar)`
            }}
          </span>
        </div>
        <p class="text-[11px] text-gray-500 mt-0.5">
          {{
            activeFilter === 'B2C'
              ? 'Kelola pelanggan umum eceran toko, kontak WhatsApp, dan catatan member pembeli.'
              : activeFilter === 'B2B'
              ? 'Kelola entitas pembeli grosir untuk faktur nota tagihan kasir.'
              : 'Kelola seluruh entitas pembeli baik grosir (B2B) maupun eceran (B2C).'
          }}
        </p>
      </div>

      <!-- Action & Search Group -->
      <div class="flex items-center gap-2">
        <!-- Sub Filter Tabs (If enabled) -->
        <div v-if="!hideFilterTabs" class="flex items-center bg-gray-200/80 p-0.5 rounded border border-gray-300">
          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all"
            :class="activeFilter === 'ALL' ? 'bg-white text-gray-900 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeFilter = 'ALL'"
          >
            Semua ({{ buyerStore.buyers.length }})
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
            :class="activeFilter === 'B2B' ? 'bg-white text-blue-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeFilter = 'B2B'"
          >
            <Building :size="12" />
            <span>Grosir ({{ buyerStore.b2bBuyers.length }})</span>
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
            :class="activeFilter === 'B2C' ? 'bg-white text-emerald-700 shadow-2xs font-bold' : 'text-gray-600 hover:text-black'"
            @click="activeFilter = 'B2C'"
          >
            <ShoppingBag :size="12" />
            <span>Eceran ({{ buyerStore.b2cBuyers.length }})</span>
          </button>
        </div>

        <!-- Quick Filter Input -->
        <div class="relative w-40">
          <Search :size="12" class="absolute left-2 top-2 text-gray-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Cari pembeli..."
            class="w-full pl-6 pr-2 py-1 text-xs bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-500"
          />
        </div>

        <!-- Add Button -->
        <button
          type="button"
          class="flex items-center gap-1 px-3 py-1.5 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors shrink-0"
          :class="activeFilter === 'B2C' ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'"
          @click="handleAddClick"
        >
          <Plus :size="14" />
          <span>
            {{ activeFilter === 'B2C' ? 'Tambah Pelanggan Eceran' : (activeFilter === 'B2B' ? 'Tambah Pembeli Grosir (B2B)' : 'Tambah Pembeli Baru') }}
          </span>
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-xs text-left">
        <thead class="bg-[#fcfbfa] border-b border-gray-200 text-gray-600 font-semibold">
          <tr>
            <th class="p-2 w-28">KODE</th>
            <th class="p-2">NAMA PELANGGAN / BUYER</th>
            <th class="p-2 w-28 text-center">TIPE PASAR</th>
            <th class="p-2 w-36">NO. TELEPON / WA</th>
            <th class="p-2">ALAMAT / KETERANGAN</th>
            <th class="p-2 w-20 text-center">AKSI</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-if="filteredBuyers.length === 0"
            class="border-b border-gray-100"
          >
            <td colspan="6" class="p-6 text-center text-gray-400">
              Belum ada data pelanggan untuk filter ini. Silakan klik tombol tambah di atas.
            </td>
          </tr>
          <tr
            v-for="b in filteredBuyers"
            :key="b.id"
            class="border-b border-gray-100 hover:bg-[#faf9f7] transition-colors"
          >
            <td class="p-2 font-mono text-gray-500 font-bold">{{ b.code || '-' }}</td>
            <td class="p-2 font-semibold text-gray-900 flex items-center gap-1.5">
              <component
                :is="b.customerType === 'B2C' ? ShoppingBag : Building"
                :size="14"
                :class="b.customerType === 'B2C' ? 'text-emerald-600' : 'text-blue-500'"
              />
              <span>{{ b.name }}</span>
            </td>
            <td class="p-2 text-center">
              <span
                class="px-2 py-0.5 rounded text-[10px] font-bold border"
                :class="b.customerType === 'B2C' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-blue-50 text-blue-700 border-blue-300'"
              >
                {{ b.customerType === 'B2C' ? '🛒 B2C (Eceran)' : '🏢 B2B (Grosir)' }}
              </span>
            </td>
            <td class="p-2 font-mono text-gray-600">{{ b.phone || '-' }}</td>
            <td class="p-2 text-gray-500">{{ b.address || '-' }}</td>
            <td class="p-2 text-center">
              <div class="flex items-center justify-center gap-1">
                <button
                  type="button"
                  class="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                  :title="`Edit ${b.name}`"
                  @click="emit('edit-buyer', b)"
                >
                  <Edit2 :size="13" />
                </button>
                <button
                  type="button"
                  class="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                  :title="`Hapus ${b.name}`"
                  @click="handleDeleteBuyer(b.id, b.name)"
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
</template>
