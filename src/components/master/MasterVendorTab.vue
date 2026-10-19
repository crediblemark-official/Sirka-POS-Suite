<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import {
  Truck,
  Percent,
  TrendingUp,
  Coins,
  Boxes,
  Sparkles,
  Edit2,
  Trash2,
  Package
} from 'lucide-vue-next';
import FormSidebarDrawer from '../common/FormSidebarDrawer.vue';
import AppEmptyState from '../common/AppEmptyState.vue';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const inventoryStore = useInventoryStore();

// Drawer state for Vendor (Terhubung dengan Header Toolbar Tombol Cart)
const isEditing = ref(false);
const activeVendorKey = ref<string>('');

const showVendorDrawer = computed({
  get: () => inventoryStore.showVendorSidebar,
  set: (val: boolean) => {
    inventoryStore.showVendorSidebar = val;
    if (!val) {
      isEditing.value = false;
      activeVendorKey.value = '';
    }
  }
});

const vendorForm = ref({
  name: '',
  defaultMarkup: 20,
  description: ''
});

// Computed Metrics
const totalVendors = computed(() => inventoryStore.categoryMarkups.length);

const averageMarkup = computed(() => {
  const list = inventoryStore.categoryMarkups;
  if (list.length === 0) return '0.0';
  const sum = list.reduce((acc, c) => acc + (c.defaultMarkupPercent || 0), 0);
  return (sum / list.length).toFixed(1);
});

const maxMarkup = computed(() => {
  const list = inventoryStore.categoryMarkups;
  if (list.length === 0) return 0;
  return Math.max(...list.map(c => c.defaultMarkupPercent || 0));
});

const minMarkup = computed(() => {
  const list = inventoryStore.categoryMarkups;
  if (list.length === 0) return 0;
  return Math.min(...list.map(c => c.defaultMarkupPercent || 0));
});

const totalConnectedSkus = computed(() => inventoryStore.products.length);

// Count SKUs per vendor
function getProductCountForVendor(vendorName: string): number {
  const clean = vendorName.trim().toLowerCase();
  return inventoryStore.products.filter(p => (p.category || '').trim().toLowerCase() === clean).length;
}

const filteredMarkups = computed(() => {
  const q = (props.searchQuery || '').toLowerCase().trim();
  if (!q) return inventoryStore.categoryMarkups;
  return inventoryStore.categoryMarkups.filter(c =>
    c.category.toLowerCase().includes(q) ||
    (c.description && c.description.toLowerCase().includes(q))
  );
});

const vendorMetrics = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Supplier',
    value: `${totalVendors.value} Mitra`,
    icon: Truck,
    iconBoxClass: 'bg-rose-50 text-rose-700',
    valClass: 'text-gray-800'
  },
  {
    label: 'Rata-Rata Margin',
    value: `+${averageMarkup.value}%`,
    icon: Percent,
    iconBoxClass: 'bg-emerald-50 text-emerald-700',
    valClass: 'text-emerald-800'
  },
  {
    label: 'Margin Tertinggi',
    value: `+${maxMarkup.value}%`,
    icon: TrendingUp,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-blue-800'
  },
  {
    label: 'Margin Terendah',
    value: `+${minMarkup.value}%`,
    icon: Coins,
    iconBoxClass: 'bg-amber-50 text-amber-700',
    valClass: 'text-amber-800'
  },
  {
    label: 'SKU Terhubung',
    value: `${totalConnectedSkus.value} Produk`,
    icon: Boxes,
    iconBoxClass: 'bg-purple-50 text-purple-700',
    valClass: 'text-purple-800'
  },
  {
    label: 'Sistem Kalkulasi',
    value: 'Otomatis POS',
    icon: Sparkles,
    iconBoxClass: 'bg-teal-50 text-teal-700',
    valClass: 'text-teal-800'
  }
]);

function handleOpenAdd() {
  isEditing.value = false;
  activeVendorKey.value = '';
  vendorForm.value = {
    name: '',
    defaultMarkup: 20,
    description: ''
  };
  showVendorDrawer.value = true;
}

function handleOpenEdit(setting: { category: string; defaultMarkupPercent: number; description?: string }) {
  isEditing.value = true;
  activeVendorKey.value = setting.category;
  vendorForm.value = {
    name: setting.category,
    defaultMarkup: setting.defaultMarkupPercent ?? 20,
    description: setting.description || ''
  };
  showVendorDrawer.value = true;
}

watch(
  () => inventoryStore.showVendorSidebar,
  (isOpen) => {
    if (isOpen && !isEditing.value && !activeVendorKey.value) {
      handleOpenAdd();
    }
  }
);

function handleSaveVendor() {
  if (!vendorForm.value.name.trim()) return;

  if (isEditing.value && activeVendorKey.value) {
    // If name changed, delete old and add new, or update markup
    if (activeVendorKey.value.trim().toLowerCase() !== vendorForm.value.name.trim().toLowerCase()) {
      inventoryStore.deleteCategory(activeVendorKey.value);
      inventoryStore.addCategory(
        vendorForm.value.name.trim(),
        vendorForm.value.defaultMarkup,
        vendorForm.value.description
      );
    } else {
      inventoryStore.updateCategoryMarkup(activeVendorKey.value, vendorForm.value.defaultMarkup);
      // Update description if in store
      const found = inventoryStore.categoryMarkups.find(c => c.category === activeVendorKey.value);
      if (found) {
        found.description = vendorForm.value.description;
      }
    }
  } else {
    inventoryStore.addCategory(
      vendorForm.value.name.trim(),
      vendorForm.value.defaultMarkup,
      vendorForm.value.description
    );
  }

  showVendorDrawer.value = false;
}

function handleDeleteVendor(cat: string) {
  const count = getProductCountForVendor(cat);
  const msg = count > 0
    ? `Supplier "${cat}" terhubung dengan ${count} barang. Yakin ingin menghapus?`
    : `Yakin ingin menghapus supplier "${cat}"?`;

  if (confirm(msg)) {
    inventoryStore.deleteCategory(cat);
    if (activeVendorKey.value === cat) {
      showVendorDrawer.value = false;
    }
  }
}

defineExpose({
  openAdd: handleOpenAdd
});
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Main Workspace: Split Layar (Kiri: Tabel Vendor & Ribbon, Kanan: FormSidebarDrawer) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sisi Kiri: Ribbon + MetricStatsStrip + Tabel Vendor Edge-to-Edge -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- 1. Top Ribbon: Supplier & Margin Untung & Aksi Cepat -->
        <div
          v-horizontal-scroll
          class="h-10 relative flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 select-none shrink-0 gap-1.5 overflow-x-auto no-scrollbar"
        >
          <div class="flex items-center gap-2 shrink-0">
            <Percent :size="15" class="text-emerald-700" />
            <span class="font-bold text-xs text-gray-800">Supplier & Margin Keuntungan Otomatis</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono">
              {{ totalVendors }} Mitra Terdaftar
            </span>
          </div>

          <!-- Sisi Kanan: Status Pencarian -->
          <div v-if="props.searchQuery" class="flex items-center gap-2 shrink-0 ml-auto">
            <span class="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium">
              Cari: "<span class="font-bold text-gray-800">{{ props.searchQuery }}</span>"
            </span>
          </div>
        </div>

        <!-- Reusable MetricStatsStrip (DRY) di sisi kiri -->
        <MetricStatsStrip :items="vendorMetrics" />

        <div class="flex-1" :class="showVendorDrawer ? 'overflow-auto' : 'overflow-y-auto overflow-x-hidden'">
          <AppEmptyState
            v-if="filteredMarkups.length === 0"
            :icon="Truck"
            title="Tidak Ada Supplier Ditemukan"
            description="Klik tombol Supplier Baru untuk mendaftarkan mitra pemasok baru."
          />
          <table v-else class="table-explorer" :class="showVendorDrawer ? 'min-w-[640px]' : ''">
            <thead>
              <tr>
                <th class="w-12 text-center">NO</th>
                <th class="w-56">NAMA SUPPLIER / KELOMPOK</th>
                <th>DESKRIPSI & KETERANGAN</th>
                <th class="w-32 text-center">BARANG TERKAIT</th>
                <th class="w-36 text-center">DEFAULT MARGIN</th>
                <th class="w-28 text-center">STATUS</th>
                <th class="th-action-sticky w-20">AKSI</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(setting, idx) in filteredMarkups"
                :key="setting.category"
                class="cursor-pointer"
                :class="activeVendorKey === setting.category && showVendorDrawer ? 'bg-purple-50/90 font-medium' : ''"
                @click="handleOpenEdit(setting)"
              >
                <td class="text-center text-gray-400 font-mono text-[11px]">
                  {{ idx + 1 }}
                </td>

                <td class="font-bold text-gray-900 truncate">
                  <div class="flex items-center gap-1.5">
                    <Truck :size="13" class="text-rose-600 shrink-0" />
                    <span class="truncate">{{ setting.category }}</span>
                  </div>
                </td>

                <td class="text-gray-600 text-[11px] truncate">
                  {{ setting.description || 'Kelompok barang dagangan inventori' }}
                </td>

                <td class="text-center font-mono text-xs">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold text-[11px]">
                    <Package :size="11" class="text-purple-600" />
                    <span>{{ getProductCountForVendor(setting.category) }} SKU</span>
                  </span>
                </td>

                <td class="text-center font-mono">
                  <span class="inline-block px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-bold text-xs">
                    +{{ setting.defaultMarkupPercent }}%
                  </span>
                </td>

                <td class="text-center">
                  <span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold">
                    Otomatis POS
                  </span>
                </td>

                <td class="td-action-sticky text-center" @click.stop>
                  <div class="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      class="p-1 text-gray-400 hover:text-purple-700 hover:bg-purple-100 rounded cursor-pointer transition-colors"
                      title="Edit Supplier"
                      @click="handleOpenEdit(setting)"
                    >
                      <Edit2 :size="13" />
                    </button>
                    <button
                      type="button"
                      class="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                      title="Hapus Supplier"
                      @click="handleDeleteVendor(setting.category)"
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

      <!-- Sisi Kanan: FormSidebarDrawer untuk Input/Edit Vendor -->
      <FormSidebarDrawer
        v-model="showVendorDrawer"
        :is-editing="isEditing"
        title="Supplier & Margin"
        :code-badge="vendorForm.name || 'NEW-VENDOR'"
        :can-edit="isEditing"
        :can-save="!!vendorForm.name.trim()"
        :save-label="isEditing ? 'SIMPAN PERUBAHAN' : 'SIMPAN SUPPLIER'"
        theme-color="purple"
        @switch-to-new="handleOpenAdd"
        @switch-to-edit="isEditing = true"
        @save="handleSaveVendor"
        @delete="activeVendorKey && handleDeleteVendor(activeVendorKey)"
        @cancel="showVendorDrawer = false"
      >
        <template #icon>
          <Truck :size="14" class="text-rose-700 shrink-0" />
        </template>

        <div class="space-y-4">
          <!-- Nama Supplier -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Nama Supplier / Mitra Pemasok *</label>
            <input
              v-model="vendorForm.name"
              type="text"
              placeholder="Contoh: CV Sumber Pangan / Indofood"
              required
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-bold text-gray-900"
            />
          </div>

          <!-- Default Markup % -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-[11px] font-semibold text-gray-700">Margin Untung Standar (%) *</label>
              <span class="text-[10px] text-gray-500 font-mono">Diterapkan otomatis saat kulakan</span>
            </div>
            <div class="relative flex items-center">
              <input
                v-model.number="vendorForm.defaultMarkup"
                type="number"
                step="0.5"
                min="0"
                max="200"
                required
                class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-mono font-bold text-emerald-700"
              />
              <span class="absolute right-3 text-xs font-bold text-gray-500">%</span>
            </div>
            <div class="mt-1.5 p-2 bg-emerald-50/70 border border-emerald-200/80 rounded text-[11px] text-emerald-800">
              <span class="font-semibold">Simulasi harga:</span> Modal Rp 10.000 &rarr; Rekomendasi Jual <strong class="font-mono">Rp {{ (10000 * (1 + (vendorForm.defaultMarkup || 0) / 100)).toLocaleString('id-ID') }}</strong>
            </div>
          </div>

          <!-- Deskripsi Kelompok Barang -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Deskripsi / Kategori Barang</label>
            <textarea
              v-model="vendorForm.description"
              rows="3"
              placeholder="Contoh: Distributor resmi beras, minyak goreng, dan sembako grosir."
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 resize-none text-gray-800"
            ></textarea>
          </div>

          <!-- Info Terkait Produk -->
          <div v-if="isEditing" class="p-3 bg-purple-50/60 border border-purple-200/80 rounded text-[11px] text-purple-900 flex items-center justify-between">
            <span class="text-gray-600">Barang Terhubung:</span>
            <span class="font-bold font-mono">{{ getProductCountForVendor(activeVendorKey) }} SKU</span>
          </div>
        </div>
      </FormSidebarDrawer>
    </div>
  </div>
</template>
