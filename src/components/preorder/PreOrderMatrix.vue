<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePreOrderStore } from '../../stores/preOrderStore';
import { usePosStore } from '../../stores/posStore';
import { BuyerName, SupplierCategory, PreOrderSchedule } from '../../types';
import {
  Calendar,
  Building,
  ArrowRight,
  Package,
  Layers,
  Truck,
  Plus,
  Edit2,
  Trash2
} from 'lucide-vue-next';

import { useInventoryStore } from '../../stores/inventoryStore';
import { useBuyerStore } from '../../stores/buyerStore';
import PreOrderFormModal from './PreOrderFormModal.vue';

const emit = defineEmits<{
  (e: 'switch-to-pos'): void;
}>();

const preOrderStore = usePreOrderStore();
const posStore = usePosStore();
const inventoryStore = useInventoryStore();
const buyerStore = useBuyerStore();

const selectedDay = ref<string>('Semua');
const selectedBuyer = ref<BuyerName | 'Semua'>('Semua');
const selectedCategory = ref<SupplierCategory | 'Semua'>('Semua');

const days = ['Semua', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
const buyers = computed(() => ['Semua', ...buyerStore.buyers.map(b => b.name)]);
const categories = computed(() => ['Semua', ...inventoryStore.categoryMarkups.map(c => c.category)]);

// Modals State
const showPoModal = ref(false);
const activeScheduleForEdit = ref<PreOrderSchedule | null>(null);

const filteredSchedules = computed(() => {
  return preOrderStore.schedules.filter(s => {
    const matchDay = selectedDay.value === 'Semua' || s.dayName === selectedDay.value;
    const matchBuyer = selectedBuyer.value === 'Semua' || s.buyer === selectedBuyer.value;
    const matchCategory =
      selectedCategory.value === 'Semua' ||
      s.items.some(i => i.category === selectedCategory.value);
    return matchDay && matchBuyer && matchCategory;
  });
});

function handleOpenAddPo() {
  activeScheduleForEdit.value = null;
  showPoModal.value = true;
}

function handleOpenEditPo(sched: PreOrderSchedule) {
  activeScheduleForEdit.value = JSON.parse(JSON.stringify(sched));
  showPoModal.value = true;
}

async function handleSavePo(data: PreOrderSchedule | Omit<PreOrderSchedule, 'id'>) {
  if ('id' in data && data.id) {
    await preOrderStore.updateSchedule(data as PreOrderSchedule);
  } else {
    await preOrderStore.addSchedule(data);
  }
}

async function handleDeletePo(id: string, date: string, buyer: string) {
  if (confirm(`Yakin ingin menghapus jadwal pre-order untuk ${buyer} tanggal ${date}?`)) {
    await preOrderStore.deleteSchedule(id);
  }
}

function handleLoadToPos(schedule: PreOrderSchedule) {
  posStore.loadPreOrderItems(schedule.items, schedule.buyer, schedule.date);
  emit('switch-to-pos');
}
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Top Filter Header -->
    <div class="p-3 bg-white border-b border-[#dedbd6] flex flex-wrap items-center justify-between gap-2 shadow-xs">
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
          <Calendar :size="18" />
        </div>
        <div>
          <h2 class="font-bold text-sm text-gray-900 leading-tight">
            Matriks Rekap Pesanan Supplier Mingguan
          </h2>
          <p class="text-[11px] text-gray-500">
            Jadwal pengiriman pre-order harian pembeli & tarik ke keranjang kasir POS saat barang tiba.
          </p>
        </div>
      </div>

      <!-- Action & Filters -->
      <div class="flex items-center gap-2">
        <!-- Add PO Button -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors shrink-0"
          @click="handleOpenAddPo"
        >
          <Plus :size="14" />
          <span>Buat Pre-Order Baru</span>
        </button>

        <div class="h-5 w-px bg-gray-300 mx-1"></div>

        <div class="flex items-center gap-1">
          <span class="text-gray-500 font-semibold">Hari:</span>
          <select v-model="selectedDay" class="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs outline-none cursor-pointer">
            <option v-for="d in days" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-gray-500 font-semibold">Pembeli:</span>
          <select v-model="selectedBuyer" class="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs outline-none cursor-pointer">
            <option v-for="b in buyers" :key="b" :value="b">
              {{ b }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-1">
          <span class="text-gray-500 font-semibold">Vendor:</span>
          <select v-model="selectedCategory" class="bg-gray-50 border border-gray-300 rounded px-2 py-1 text-xs outline-none cursor-pointer">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Schedules Grid -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="filteredSchedules.length === 0" class="h-64 flex flex-col items-center justify-center text-gray-400 gap-2">
        <Package :size="40" class="text-gray-300" />
        <span class="font-semibold text-gray-600">Tidak ada jadwal pre-order yang cocok.</span>
        <button
          type="button"
          class="mt-1 px-3 py-1.5 bg-blue-600 text-white rounded font-bold text-xs cursor-pointer hover:bg-blue-700"
          @click="handleOpenAddPo"
        >
          + Buat Jadwal Pre-Order Baru Sekarang
        </button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div
          v-for="sched in filteredSchedules"
          :key="sched.id"
          class="bg-white border border-[#dedbd6] rounded-lg shadow-xs flex flex-col overflow-hidden hover:border-blue-400 transition-all"
        >
          <!-- Top Strip -->
          <div class="px-3 py-2 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 bg-blue-600 text-white rounded font-bold text-xs">
                {{ sched.dayName }}
              </span>
              <span class="font-mono text-gray-500 text-[11px]">{{ sched.date }}</span>
            </div>
            
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[11px]">
                <Building :size="12" />
                <span>{{ sched.buyer }}</span>
              </div>

              <!-- Quick Edit & Delete Controls -->
              <div class="flex items-center gap-0.5">
                <button
                  type="button"
                  class="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer transition-colors"
                  title="Edit Jadwal PO"
                  @click="handleOpenEditPo(sched)"
                >
                  <Edit2 :size="12" />
                </button>
                <button
                  type="button"
                  class="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer transition-colors"
                  title="Hapus Jadwal PO"
                  @click="handleDeletePo(sched.id, sched.date, sched.buyer)"
                >
                  <Trash2 :size="12" />
                </button>
              </div>
            </div>
          </div>

          <!-- Items in Schedule -->
          <div class="flex-1 p-2 space-y-1 overflow-y-auto max-h-60">
            <div
              v-for="item in sched.items"
              :key="item.id"
              class="flex items-center justify-between p-1.5 rounded bg-gray-50 border border-gray-100 text-xs"
            >
              <div class="flex flex-col min-w-0 pr-2">
                <span class="font-semibold text-gray-900 truncate">{{ item.productName }}</span>
                <span class="text-[10px] text-gray-400 font-mono">{{ item.category }}</span>
              </div>
              <div class="font-mono text-right shrink-0">
                <span class="font-bold text-blue-700">{{ item.qty }} {{ item.unit }}</span>
                <span v-if="item.packagingNote && item.packagingNote !== `${item.qty} ${item.unit}`" class="block text-[10px] text-gray-500">
                  ({{ item.packagingNote }})
                </span>
              </div>
            </div>
          </div>

          <!-- Bottom Action -->
          <div class="p-2.5 bg-[#fbfaf8] border-t border-gray-200 flex items-center justify-between">
            <div class="flex items-center gap-1 text-[11px] text-gray-500">
              <Layers :size="13" />
              <span>{{ sched.items.length }} Item Pesanan</span>
            </div>

            <button
              class="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
              title="Tarik ke Kasir POS"
              @click="handleLoadToPos(sched)"
            >
              <Truck :size="13" />
              <span>Tarik ke Kasir</span>
              <ArrowRight :size="13" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Pre-Order Form Modal -->
    <PreOrderFormModal
      :is-open="showPoModal"
      :initial-data="activeScheduleForEdit"
      @close="showPoModal = false"
      @save="handleSavePo"
    />
  </div>
</template>
