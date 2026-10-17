<script setup lang="ts">
import { ref, computed } from 'vue';
import { Discount } from '../../types';
import { useDiscountStore } from '../../stores/discountStore';
import { formatRupiah } from '../../utils/formatters';
import {
  Tag,
  Plus,
  Search,
  CheckCircle,
  Pencil,
  Trash2,
  Percent,
  DollarSign,
  Copy,
  Users,
  Layers,
  Sparkles
} from 'lucide-vue-next';

import DiscountFormModal from './DiscountFormModal.vue';
import { useInventoryStore } from '../../stores/inventoryStore';

const emit = defineEmits<{
  (e: 'add-discount'): void;
  (e: 'edit-discount', discount: Discount): void;
}>();

const discountStore = useDiscountStore();
const inventoryStore = useInventoryStore();

const searchQuery = ref('');
const filterStatus = ref<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

const categories = computed(() => inventoryStore.categoryMarkups.map(c => c.category));

const showModal = ref(false);
const activeDiscountForEdit = ref<Discount | null>(null);

function handleOpenAdd() {
  activeDiscountForEdit.value = null;
  showModal.value = true;
  emit('add-discount');
}

function handleOpenEdit(d: Discount) {
  activeDiscountForEdit.value = { ...d };
  showModal.value = true;
  emit('edit-discount', d);
}

async function handleSaveDiscount(data: Omit<Discount, 'id' | 'createdAt' | 'usageCount'> | Discount) {
  await discountStore.upsertDiscount(data);
  showModal.value = false;
}

const filteredDiscounts = computed(() => {
  return discountStore.discounts.filter(d => {
    const matchesSearch =
      d.code.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      d.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (d.description && d.description.toLowerCase().includes(searchQuery.value.toLowerCase()));

    const matchesStatus =
      filterStatus.value === 'ALL'
        ? true
        : filterStatus.value === 'ACTIVE'
          ? d.isActive
          : !d.isActive;

    return matchesSearch && matchesStatus;
  });
});

const copiedCode = ref<string | null>(null);

function copyCode(code: string) {
  navigator.clipboard.writeText(code);
  copiedCode.value = code;
  setTimeout(() => {
    copiedCode.value = null;
  }, 1500);
}

function handleDelete(id: string, name: string) {
  if (confirm(`Hapus kupon promo "${name}"?`)) {
    discountStore.deleteDiscount(id);
  }
}
</script>

<template>
  <div class="space-y-4 max-w-7xl mx-auto pb-16">
    <!-- Header Banner & Action Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f6f5f2] p-3.5 rounded-lg border border-gray-200">
      <div>
        <h3 class="font-bold text-gray-800 text-sm flex items-center gap-1.5">
          <Tag :size="16" class="text-rose-600" />
          <span>Manajemen Diskon, Kupon & Promo Penjualan</span>
        </h3>
        <p class="text-[11px] text-gray-500 mt-0.5">
          Kelola voucher diskon persentase (%) atau potongan nominal (Rp) yang bisa diaplikasikan di keranjang kasir.
        </p>
      </div>

      <button
        type="button"
        class="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors shrink-0"
        @click="handleOpenAdd"
      >
        <Plus :size="14" />
        <span>Tambah Promo / Kupon Baru</span>
      </button>
    </div>

    <!-- Metrics Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-white p-3 rounded-lg border border-gray-200 shadow-xs flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
          <Sparkles :size="18" />
        </div>
        <div>
          <span class="text-[11px] text-gray-500 block">Total Kupon Promo</span>
          <span class="text-base font-bold text-gray-800 font-mono">{{ discountStore.discounts.length }} Promo</span>
        </div>
      </div>

      <div class="bg-white p-3 rounded-lg border border-gray-200 shadow-xs flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <CheckCircle :size="18" />
        </div>
        <div>
          <span class="text-[11px] text-gray-500 block">Promo Sedang Aktif</span>
          <span class="text-base font-bold text-emerald-600 font-mono">{{ discountStore.activeDiscounts.length }} Aktif</span>
        </div>
      </div>

      <div class="bg-white p-3 rounded-lg border border-gray-200 shadow-xs flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <Percent :size="18" />
        </div>
        <div>
          <span class="text-[11px] text-gray-500 block">Tipe Persentase</span>
          <span class="text-base font-bold text-blue-700 font-mono">
            {{ discountStore.discounts.filter(d => d.type === 'PERCENT').length }} Kupon
          </span>
        </div>
      </div>

      <div class="bg-white p-3 rounded-lg border border-gray-200 shadow-xs flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <DollarSign :size="18" />
        </div>
        <div>
          <span class="text-[11px] text-gray-500 block">Tipe Potongan Tetap</span>
          <span class="text-base font-bold text-amber-700 font-mono">
            {{ discountStore.discounts.filter(d => d.type === 'FIXED').length }} Kupon
          </span>
        </div>
      </div>
    </div>

    <!-- Search & Filter Controls -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-gray-200">
      <div class="relative w-full sm:w-72">
        <input
          v-model="searchQuery"
          type="text"
          class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 pl-8 text-xs focus:bg-white focus:border-rose-500 outline-none"
          placeholder="Cari kode promo atau nama promo..."
        />
        <Search :size="14" class="absolute left-2.5 top-2 text-gray-400" />
      </div>

      <div class="flex items-center gap-1.5 self-end sm:self-auto text-xs">
        <span class="text-gray-500 font-medium mr-1">Status:</span>
        <button
          type="button"
          class="px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer"
          :class="filterStatus === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          @click="filterStatus = 'ALL'"
        >
          Semua ({{ discountStore.discounts.length }})
        </button>
        <button
          type="button"
          class="px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer"
          :class="filterStatus === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          @click="filterStatus = 'ACTIVE'"
        >
          Aktif ({{ discountStore.activeDiscounts.length }})
        </button>
        <button
          type="button"
          class="px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer"
          :class="filterStatus === 'INACTIVE' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          @click="filterStatus = 'INACTIVE'"
        >
          Nonaktif
        </button>
      </div>
    </div>

    <!-- Discounts Data Table -->
    <div class="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-xs">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-[#f6f5f2] border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
              <th class="py-2.5 px-3">Kode Promo</th>
              <th class="py-2.5 px-3">Nama Promo & Keterangan</th>
              <th class="py-2.5 px-3 text-center">Nilai Diskon</th>
              <th class="py-2.5 px-3">Min. Belanja</th>
              <th class="py-2.5 px-3">Target Berlaku</th>
              <th class="py-2.5 px-3 text-center">Status</th>
              <th class="py-2.5 px-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="d in filteredDiscounts"
              :key="d.id"
              class="hover:bg-rose-50/40 transition-colors group"
            >
              <!-- Kode Promo dengan tombol Copy -->
              <td class="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                <div class="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200">
                  <span>{{ d.code }}</span>
                  <button
                    type="button"
                    class="text-rose-400 hover:text-rose-800 cursor-pointer p-0.5"
                    title="Salin Kode Promo"
                    @click="copyCode(d.code)"
                  >
                    <Copy :size="11" />
                  </button>
                  <span v-if="copiedCode === d.code" class="text-[9px] font-sans text-emerald-600 font-bold">Disalin!</span>
                </div>
              </td>

              <!-- Nama & Deskripsi -->
              <td class="py-2.5 px-3 max-w-xs">
                <span class="font-bold text-gray-800 block">{{ d.name }}</span>
                <span v-if="d.description" class="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                  {{ d.description }}
                </span>
              </td>

              <!-- Nilai Diskon Badge -->
              <td class="py-2.5 px-3 text-center whitespace-nowrap">
                <span
                  v-if="d.type === 'PERCENT'"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-black font-mono text-xs bg-blue-50 text-blue-700 border border-blue-200"
                >
                  <Percent :size="11" />
                  <span>{{ d.value }}% OFF</span>
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-black font-mono text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  <span>-Rp {{ formatRupiah(d.value) }}</span>
                </span>
                <span v-if="d.maxDiscount" class="text-[10px] text-gray-400 block mt-0.5 font-mono">
                  Maks Rp {{ formatRupiah(d.maxDiscount) }}
                </span>
              </td>

              <!-- Min Belanja -->
              <td class="py-2.5 px-3 whitespace-nowrap font-mono">
                <span v-if="d.minPurchase > 0" class="text-gray-700 font-semibold">
                  Rp {{ formatRupiah(d.minPurchase) }}
                </span>
                <span v-else class="text-gray-400 italic">Tanpa Minimal</span>
              </td>

              <!-- Target Scope -->
              <td class="py-2.5 px-3 whitespace-nowrap">
                <span
                  v-if="d.scope === 'ALL'"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700 font-semibold"
                >
                  Semua Pelanggan
                </span>
                <span
                  v-else-if="d.scope === 'MEMBER_ONLY'"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200 font-bold"
                >
                  <Users :size="10" />
                  <span>Khusus Member</span>
                </span>
                <span
                  v-else-if="d.scope === 'CUSTOMER_TYPE'"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"
                >
                  {{ d.targetCustomerType === 'B2B' ? 'Grosir (B2B)' : 'Eceran (B2C)' }}
                </span>
                <span
                  v-else-if="d.scope === 'CATEGORY'"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 font-semibold border border-purple-200"
                >
                  <Layers :size="10" />
                  <span>{{ d.targetCategory }}</span>
                </span>
              </td>

              <!-- Status Toggle -->
              <td class="py-2.5 px-3 text-center whitespace-nowrap">
                <button
                  type="button"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] transition-colors cursor-pointer select-none"
                  :class="d.isActive ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'"
                  :title="d.isActive ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'"
                  @click="discountStore.toggleDiscount(d.id)"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="d.isActive ? 'bg-emerald-600' : 'bg-gray-400'"></span>
                  <span>{{ d.isActive ? 'AKTIF' : 'NONAKTIF' }}</span>
                </button>
              </td>

              <!-- Aksi -->
              <td class="py-2.5 px-3 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    class="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                    title="Edit Promo"
                    @click="handleOpenEdit(d)"
                  >
                    <Pencil :size="13" />
                  </button>
                  <button
                    type="button"
                    class="p-1 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                    title="Hapus Promo"
                    @click="handleDelete(d.id, d.name)"
                  >
                    <Trash2 :size="13" />
                  </button>
                </div>
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-if="filteredDiscounts.length === 0">
              <td colspan="7" class="py-8 text-center text-gray-400">
                <Tag :size="28" class="mx-auto mb-1 text-gray-300" />
                <p class="font-medium">Tidak ada data kupon diskon</p>
                <button
                  type="button"
                  class="mt-2 text-rose-600 hover:underline text-xs font-semibold cursor-pointer"
                  @click="handleOpenAdd"
                >
                  + Tambah Promo Baru Sekarang
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Self-Contained Modal -->
    <DiscountFormModal
      :is-open="showModal"
      :initial-data="activeDiscountForEdit"
      :categories="categories"
      @close="showModal = false"
      @save="handleSaveDiscount"
    />
  </div>
</template>
