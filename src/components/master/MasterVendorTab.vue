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
  <div class="flex-1 flex flex-col h-full bg-white select-none text-xs overflow-hidden">
    <!-- 1. Top Ribbon: Supplier & Margin Untung & Aksi Cepat -->
    <div class="relative flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 py-1.5 select-none shrink-0 gap-1.5 overflow-x-auto no-scrollbar">
      <div class="flex items-center gap-2 shrink-0">
        <Percent :size="15" class="text-emerald-700" />
        <span class="font-bold text-xs text-gray-800">Supplier & Margin Keuntungan Otomatis</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold font-mono">
          {{ totalVendors }} Mitra Terdaftar
        </span>
      </div>

      <!-- Sisi Kanan: Status Pencarian -->
      <div class="flex items-center gap-2 shrink-0 ml-auto">
        <span v-if="props.searchQuery" class="text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          Cari: "{{ props.searchQuery }}"
        </span>
      </div>
    </div>

    <!-- 2. Ringkasan Metrik Cepat Vendor (Seimbang Terbagi Rata 6 Kolom, Identik Kulakan) -->
    <div class="flex items-center divide-x divide-gray-200 px-2 py-2 border-b border-gray-200 bg-white shrink-0">
      <!-- 1. Total Supplier -->
      <div class="flex items-center gap-2 px-2.5 first:pl-1 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
          <Truck :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Total Supplier</div>
          <div class="text-xs font-bold text-gray-800 font-mono mt-0.5 truncate">{{ totalVendors }} Mitra</div>
        </div>
      </div>

      <!-- 2. Rata-Rata Margin -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <Percent :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Rata-Rata Margin</div>
          <div class="text-xs font-bold text-emerald-800 font-mono mt-0.5 truncate">+{{ averageMarkup }}%</div>
        </div>
      </div>

      <!-- 3. Margin Tertinggi -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <TrendingUp :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Margin Tertinggi</div>
          <div class="text-xs font-bold text-blue-800 font-mono mt-0.5 truncate">+{{ maxMarkup }}%</div>
        </div>
      </div>

      <!-- 4. Margin Terendah -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          <Coins :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Margin Terendah</div>
          <div class="text-xs font-bold text-amber-800 font-mono mt-0.5 truncate">+{{ minMarkup }}%</div>
        </div>
      </div>

      <!-- 5. Total SKU Terhubung -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
          <Boxes :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">SKU Terhubung</div>
          <div class="text-xs font-bold text-purple-800 font-mono mt-0.5 truncate">{{ totalConnectedSkus }} Produk</div>
        </div>
      </div>

      <!-- 6. Status Kalkulasi -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
          <Sparkles :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Sistem Kalkulasi</div>
          <div class="text-xs font-bold text-teal-800 font-mono mt-0.5 truncate">Otomatis POS</div>
        </div>
      </div>
    </div>

    <!-- 2. Workspace: Edge-to-Edge Table on Left, FormSidebarDrawer on Right -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Tabel Vendor / Supplier Edge-to-Edge -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <div class="flex-1" :class="showVendorDrawer ? 'overflow-auto' : 'overflow-y-auto overflow-x-hidden'">
          <table class="w-full table-fixed text-xs text-left border-collapse" :class="showVendorDrawer ? 'min-w-[640px]' : ''">
            <thead class="bg-[#f0ede8] border-b border-gray-200 text-gray-600 font-semibold sticky top-0 z-10">
              <tr class="h-9">
                <th class="px-2.5 h-9 align-middle w-12 text-center">NO</th>
                <th class="px-2.5 h-9 align-middle w-56">NAMA SUPPLIER / KELOMPOK</th>
                <th class="px-2.5 h-9 align-middle">DESKRIPSI & KETERANGAN</th>
                <th class="px-2.5 h-9 align-middle w-32 text-center">BARANG TERKAIT</th>
                <th class="px-2.5 h-9 align-middle w-36 text-center">DEFAULT MARGIN</th>
                <th class="px-2.5 h-9 align-middle w-28 text-center">STATUS</th>
                <th class="px-2.5 h-9 align-middle w-20 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 font-mono">
              <tr
                v-if="filteredMarkups.length === 0"
                class="h-40 text-center text-gray-400 select-none font-sans"
              >
                <td colspan="7" class="py-8">
                  <div class="flex flex-col items-center justify-center gap-1.5">
                    <Truck :size="32" class="text-gray-300" />
                    <span class="font-bold text-gray-600">Tidak ada supplier ditemukan</span>
                    <span class="text-[11px] text-gray-400">Klik tombol Tambah Supplier untuk mendaftarkan mitra baru.</span>
                  </div>
                </td>
              </tr>

              <tr
                v-for="(setting, idx) in filteredMarkups"
                :key="setting.category"
                class="hover:bg-purple-50/60 cursor-pointer transition-colors group select-none font-sans"
                :class="activeVendorKey === setting.category && showVendorDrawer ? 'bg-purple-50/90 font-medium' : (idx % 2 === 1 ? 'bg-[#faf9f7]' : 'bg-white')"
                @click="handleOpenEdit(setting)"
              >
                <td class="px-2.5 py-2 align-middle text-center text-gray-400 font-mono text-[11px]">
                  {{ idx + 1 }}
                </td>

                <td class="px-2.5 py-2 align-middle font-bold text-gray-900 group-hover:text-purple-900 truncate">
                  <div class="flex items-center gap-1.5">
                    <Truck :size="13" class="text-rose-600 shrink-0" />
                    <span class="truncate">{{ setting.category }}</span>
                  </div>
                </td>

                <td class="px-2.5 py-2 align-middle text-gray-600 text-[11px] truncate">
                  {{ setting.description || 'Kelompok barang dagangan inventori' }}
                </td>

                <td class="px-2.5 py-2 align-middle text-center font-mono text-xs">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-semibold text-[11px]">
                    <Package :size="11" class="text-purple-600" />
                    <span>{{ getProductCountForVendor(setting.category) }} SKU</span>
                  </span>
                </td>

                <td class="px-2.5 py-2 align-middle text-center font-mono">
                  <span class="inline-block px-2.5 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded font-bold text-xs">
                    +{{ setting.defaultMarkupPercent }}%
                  </span>
                </td>

                <td class="px-2.5 py-2 align-middle text-center">
                  <span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-semibold">
                    Otomatis POS
                  </span>
                </td>

                <td class="px-2.5 py-2 align-middle text-center" @click.stop>
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
