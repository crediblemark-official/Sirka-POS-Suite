<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSupplierStore } from '../../stores/supplierStore';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { useInventoryStore } from '../../stores/inventoryStore';
import { Supplier } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  Truck,
  Phone,
  User,
  Boxes,
  Edit2,
  Trash2,
  Receipt,
  Plus,
  ArrowUp,
  ArrowDown
} from 'lucide-vue-next';
import FormSidebarDrawer from '../common/FormSidebarDrawer.vue';
import AppTableContainer from '../common/AppTableContainer.vue';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

type SupplierSortField = 'name' | 'contactPerson' | 'phone' | 'address' | 'notes' | 'productsCount' | 'purchaseTotal';
type SortDirection = 'asc' | 'desc';

const sortField = ref<SupplierSortField>('name');
const sortDirection = ref<SortDirection>('asc');

function toggleSort(field: SupplierSortField) {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = ['productsCount', 'purchaseTotal'].includes(field) ? 'desc' : 'asc';
  }
}

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const supplierStore = useSupplierStore();
const purchaseStore = usePurchaseStore();
const inventoryStore = useInventoryStore();

const isEditing = ref(false);
const activeSupplierId = ref<string>('');

const showDrawer = computed({
  get: () => supplierStore.showSupplierDrawer,
  set: (val: boolean) => {
    supplierStore.showSupplierDrawer = val;
    if (!val) {
      isEditing.value = false;
      activeSupplierId.value = '';
    }
  }
});

const supplierForm = ref({
  name: '',
  contactPerson: '',
  phone: '',
  address: '',
  notes: ''
});

const totalSuppliers = computed(() => supplierStore.suppliers.length);

const totalPurchasesCount = computed(() => purchaseStore.purchaseHistory.length);

const totalPurchasesNominal = computed(() => {
  return purchaseStore.purchaseHistory.reduce((acc, p) => acc + (p.totalBuy || 0), 0);
});

const supplierMetrics = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Supplier',
    value: `${totalSuppliers.value} Mitra`,
    icon: Truck,
    iconBoxClass: 'bg-rose-50 text-rose-700',
    valClass: 'text-gray-800'
  },
  {
    label: 'Faktur Kulakan Masuk',
    value: `${totalPurchasesCount.value} Nota`,
    icon: Receipt,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-blue-800'
  },
  {
    label: 'Total Belanja Kulakan',
    value: formatRupiah(totalPurchasesNominal.value),
    icon: Boxes,
    iconBoxClass: 'bg-emerald-50 text-emerald-700',
    valClass: 'text-emerald-800'
  }
]);

const filteredSuppliers = computed(() => {
  const q = (props.searchQuery || '').toLowerCase().trim();
  if (!q) return supplierStore.suppliers;
  return supplierStore.suppliers.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
    (s.phone && s.phone.toLowerCase().includes(q)) ||
    (s.address && s.address.toLowerCase().includes(q)) ||
    (s.notes && s.notes.toLowerCase().includes(q))
  );
});

function getPurchaseCountForSupplier(supplierName: string): number {
  const clean = supplierName.trim().toLowerCase();
  return purchaseStore.purchaseHistory.filter(p => (p.supplier || '').trim().toLowerCase() === clean).length;
}

function getPurchaseTotalForSupplier(supplierName: string): number {
  const clean = supplierName.trim().toLowerCase();
  return purchaseStore.purchaseHistory
    .filter(p => (p.supplier || '').trim().toLowerCase() === clean)
    .reduce((acc, p) => acc + (p.totalBuy || 0), 0);
}

function getProductCountForSupplier(supplierName: string): number {
  const clean = supplierName.trim().toLowerCase();
  return inventoryStore.products.filter(p => (p.supplier || '').trim().toLowerCase() === clean).length;
}

function getRecentPurchasesForSupplier(supplierName: string) {
  const clean = supplierName.trim().toLowerCase();
  return purchaseStore.purchaseHistory
    .filter(p => (p.supplier || '').trim().toLowerCase() === clean)
    .slice(0, 5);
}

const sortedSuppliers = computed(() => {
  const list = [...filteredSuppliers.value];
  const field = sortField.value;
  const dir = sortDirection.value === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    switch (field) {
      case 'name':
        return dir * (a.name || '').localeCompare(b.name || '');
      case 'contactPerson':
        return dir * (a.contactPerson || '').localeCompare(b.contactPerson || '');
      case 'phone':
        return dir * (a.phone || '').localeCompare(b.phone || '');
      case 'address':
        return dir * (a.address || '').localeCompare(b.address || '');
      case 'notes':
        return dir * (a.notes || '').localeCompare(b.notes || '');
      case 'productsCount':
        return dir * (getProductCountForSupplier(a.name) - getProductCountForSupplier(b.name));
      case 'purchaseTotal':
        return dir * (getPurchaseTotalForSupplier(a.name) - getPurchaseTotalForSupplier(b.name));
      default:
        return 0;
    }
  });

  return list;
});

function handleOpenAdd() {
  isEditing.value = false;
  activeSupplierId.value = '';
  supplierForm.value = {
    name: '',
    contactPerson: '',
    phone: '',
    address: '',
    notes: ''
  };
  showDrawer.value = true;
}

function handleOpenEdit(supplier: Supplier) {
  isEditing.value = true;
  activeSupplierId.value = supplier.id;
  supplierForm.value = {
    name: supplier.name,
    contactPerson: supplier.contactPerson || '',
    phone: supplier.phone || '',
    address: supplier.address || '',
    notes: supplier.notes || ''
  };
  showDrawer.value = true;
}

const formError = ref('');

function handleSaveSupplier() {
  formError.value = '';
  if (!supplierForm.value.name.trim()) {
    formError.value = 'Nama supplier wajib diisi';
    return;
  }

  try {
    if (isEditing.value && activeSupplierId.value) {
      supplierStore.updateSupplier(activeSupplierId.value, {
        name: supplierForm.value.name,
        contactPerson: supplierForm.value.contactPerson,
        phone: supplierForm.value.phone,
        address: supplierForm.value.address,
        notes: supplierForm.value.notes
      });
    } else {
      supplierStore.addSupplier({
        name: supplierForm.value.name,
        contactPerson: supplierForm.value.contactPerson,
        phone: supplierForm.value.phone,
        address: supplierForm.value.address,
        notes: supplierForm.value.notes
      });
    }
    showDrawer.value = false;
  } catch (err: any) {
    formError.value = err.message || 'Gagal menyimpan supplier';
  }
}

const { confirm: showConfirm } = useConfirmDialog();

/**
 * BUG FIX: sebelumnya memakai `getSupplierById(id)!` (non-null assertion).
 * Kalau supplier sudah terhapus (mis. dari tab lain) fungsinya melempar
 * TypeError dan dialog konfirmasi tidak pernah muncul.
 */
async function handleDeleteSupplierById() {
  if (!activeSupplierId.value) return;
  const supplier = supplierStore.getSupplierById(activeSupplierId.value);
  if (!supplier) {
    alert('Data supplier tidak ditemukan (mungkin sudah dihapus). Silakan tutup dan buka ulang.');
    showDrawer.value = false;
    return;
  }
  await handleDeleteSupplier(supplier);
}

async function handleDeleteSupplier(supplier: Supplier) {
  const invoiceCount = getPurchaseCountForSupplier(supplier.name);
  const msg = invoiceCount > 0
    ? `Supplier "${supplier.name}" tercatat di ${invoiceCount} faktur kulakan. Yakin ingin menghapus?`
    : `Yakin ingin menghapus supplier "${supplier.name}"?`;

  const isConfirmed = await showConfirm({
    title: 'Hapus Supplier',
    message: msg,
    details: invoiceCount > 0 ? `Perhatian: Ada riwayat kulakan yang tercatat dari supplier ini.` : undefined,
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger'
  });

  if (isConfirmed) {
    supplierStore.deleteSupplier(supplier.id);
    if (activeSupplierId.value === supplier.id) {
      showDrawer.value = false;
    }
  }
}

defineExpose({
  openAdd: handleOpenAdd
});
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Main Workspace -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sisi Kiri: Ribbon + Stats + Tabel Supplier -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- Search Query Indicator (if any) -->
        <div v-if="props.searchQuery" class="bg-[#f6f5f2] border-b border-gray-200 px-3 py-1 flex items-center gap-1.5 shrink-0 select-none">
          <span class="text-[10.5px] text-gray-600 bg-gray-200/80 px-2 py-0.5 rounded-md font-medium shrink-0 whitespace-nowrap">
            Cari: "<strong class="text-gray-900">{{ props.searchQuery }}</strong>"
          </span>
        </div>

        <!-- 2. Reusable MetricStatsStrip -->
        <MetricStatsStrip :items="supplierMetrics" />

        <!-- 3. Tabel Supplier -->
        <AppTableContainer
          :is-empty="filteredSuppliers.length === 0"
          :empty-icon="Truck"
          empty-title="Tidak Ada Supplier Ditemukan"
          empty-description="Klik tombol 'Supplier Baru' untuk mendaftarkan mitra pemasok atau distributor kulakan."
        >
          <table class="table-explorer whitespace-nowrap min-w-[850px]">
            <thead>
              <tr>
                <th class="w-12 text-center">NO</th>
                <th
                  class="is-sortable w-52 whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'name' }"
                  title="Klik untuk mengurutkan nama supplier"
                  @click="toggleSort('name')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>NAMA SUPPLIER</span>
                    <ArrowUp v-if="sortField === 'name' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'name' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-40 whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'contactPerson' }"
                  title="Klik untuk mengurutkan kontak person"
                  @click="toggleSort('contactPerson')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>KONTAK PERSON</span>
                    <ArrowUp v-if="sortField === 'contactPerson' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'contactPerson' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-36 whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'phone' }"
                  title="Klik untuk mengurutkan no. telepon"
                  @click="toggleSort('phone')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>NO. WHATSAPP / TELP</span>
                    <ArrowUp v-if="sortField === 'phone' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'phone' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-52 whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'address' }"
                  title="Klik untuk mengurutkan alamat"
                  @click="toggleSort('address')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>ALAMAT GUDANG / TOKO</span>
                    <ArrowUp v-if="sortField === 'address' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'address' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'notes' }"
                  title="Klik untuk mengurutkan catatan"
                  @click="toggleSort('notes')"
                >
                  <div class="flex items-center gap-1.5">
                    <span>CATATAN KHUSUS</span>
                    <ArrowUp v-if="sortField === 'notes' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'notes' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-28 text-center whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'productsCount' }"
                  title="Klik untuk mengurutkan jumlah barang"
                  @click="toggleSort('productsCount')"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <span>BARANG (SKU)</span>
                    <ArrowUp v-if="sortField === 'productsCount' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'productsCount' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
                  </div>
                </th>
                <th
                  class="is-sortable w-36 text-center whitespace-nowrap"
                  :class="{ 'is-sorted': sortField === 'purchaseTotal' }"
                  title="Klik untuk mengurutkan nilai kulakan"
                  @click="toggleSort('purchaseTotal')"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <span>NILAI KULAKAN</span>
                    <ArrowUp v-if="sortField === 'purchaseTotal' && sortDirection === 'asc'" :size="12" class="text-rose-600 shrink-0" />
                    <ArrowDown v-else-if="sortField === 'purchaseTotal' && sortDirection === 'desc'" :size="12" class="text-rose-600 shrink-0" />
                  </div>
                </th>
                <th class="th-action-sticky w-20">AKSI</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(supp, idx) in sortedSuppliers"
                :key="supp.id"
                class="cursor-pointer"
                :class="activeSupplierId === supp.id && showDrawer ? 'bg-rose-50/90 font-medium' : ''"
                @click="handleOpenEdit(supp)"
              >
                <td class="text-center text-gray-400 font-mono text-[11px]">
                  {{ idx + 1 }}
                </td>

                <td class="font-bold text-gray-900 truncate">
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 shadow-2xs"></span>
                    <span class="truncate">{{ supp.name }}</span>
                  </div>
                </td>

                <td class="text-gray-700 text-xs truncate">
                  <div class="flex items-center gap-1.5 text-gray-700">
                    <User :size="12" class="text-gray-400 shrink-0" />
                    <span class="truncate">{{ supp.contactPerson || '-' }}</span>
                  </div>
                </td>

                <td class="font-mono text-xs text-gray-700">
                  <div class="flex items-center gap-1.5">
                    <Phone :size="12" class="text-emerald-600 shrink-0" />
                    <span>{{ supp.phone || '-' }}</span>
                  </div>
                </td>

                <td class="text-gray-600 text-[11px] truncate" :title="supp.address">
                  {{ supp.address || '-' }}
                </td>

                <td class="text-gray-600 text-[11px] truncate max-w-[220px]" :title="supp.notes">
                  <span v-if="supp.notes" class="text-gray-700">{{ supp.notes }}</span>
                  <span v-else class="text-gray-300 italic">-</span>
                </td>

                <td class="text-center font-mono text-xs">
                  <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-[11px]">
                    <Boxes :size="11" class="text-purple-600" />
                    <span>{{ getProductCountForSupplier(supp.name) }} SKU</span>
                  </span>
                </td>

                <td class="text-center font-mono">
                  <span
                    class="inline-block px-2.5 py-0.5 rounded-full font-bold text-xs"
                    :class="getPurchaseTotalForSupplier(supp.name) > 0 ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-gray-100 text-gray-500'"
                  >
                    Rp {{ formatRupiah(getPurchaseTotalForSupplier(supp.name)) }}
                  </span>
                  <span v-if="getPurchaseCountForSupplier(supp.name) > 0" class="block text-[9.5px] text-gray-400 mt-0.5">
                    {{ getPurchaseCountForSupplier(supp.name) }} Nota
                  </span>
                </td>

                <td class="td-action-sticky text-center" @click.stop>
                  <div class="flex items-center justify-center gap-1">
                    <button
                      type="button"
                      class="p-1 text-gray-400 hover:text-rose-700 hover:bg-rose-100 rounded cursor-pointer transition-colors"
                      title="Edit Supplier"
                      @click="handleOpenEdit(supp)"
                    >
                      <Edit2 :size="13" />
                    </button>
                    <button
                      type="button"
                      class="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                      title="Hapus Supplier"
                      @click="handleDeleteSupplier(supp)"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </AppTableContainer>
      </div>

      <!-- Sisi Kanan: FormSidebarDrawer untuk Tambah/Edit Supplier -->
      <FormSidebarDrawer
        v-model="showDrawer"
        :is-editing="isEditing"
        title="Mitra Supplier"
        :code-badge="supplierForm.name || 'NEW-SUPPLIER'"
        :can-edit="isEditing"
        :can-save="!!supplierForm.name.trim()"
        :save-label="isEditing ? 'SIMPAN PERUBAHAN' : 'SIMPAN SUPPLIER'"
        theme-color="rose"
        @switch-to-new="handleOpenAdd"
        @switch-to-edit="isEditing = true"
        @save="handleSaveSupplier"
        @delete="handleDeleteSupplierById"
        @cancel="showDrawer = false"
      >
        <template #icon>
          <Truck :size="14" class="text-rose-700 shrink-0" />
        </template>

        <div class="space-y-4">
          <!-- Error alert jika ada duplikasi -->
          <div v-if="formError" class="p-2.5 bg-rose-50 border border-rose-300 rounded text-rose-800 text-xs font-semibold">
            {{ formError }}
          </div>

          <!-- Nama Supplier -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Nama Supplier / Mitra Pemasok *</label>
            <input
              v-model="supplierForm.name"
              type="text"
              placeholder="Contoh: Pak Agus, PT Indofood, CV Sumber Pangan"
              required
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-rose-600 font-bold text-gray-900"
            />
          </div>

          <!-- Kontak Person -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Nama Kontak Person / Sales / PIC</label>
            <input
              v-model="supplierForm.contactPerson"
              type="text"
              placeholder="Contoh: Mas Budi (Sales Canvaser)"
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-rose-600 text-gray-900"
            />
          </div>

          <!-- No Telp / WhatsApp -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">No. WhatsApp / Telepon</label>
            <input
              v-model="supplierForm.phone"
              type="text"
              placeholder="Contoh: 0812-3456-7890"
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-rose-600 font-mono text-gray-900"
            />
          </div>

          <!-- Alamat Gudang / Toko -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Alamat Gudang / Toko Pemasok</label>
            <textarea
              v-model="supplierForm.address"
              rows="2"
              placeholder="Contoh: Pasar Induk Kramat Jati Kios No. 12"
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-rose-600 resize-none text-gray-800"
            ></textarea>
          </div>

          <!-- Catatan / Keterangan -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Catatan Khusus</label>
            <textarea
              v-model="supplierForm.notes"
              rows="2"
              placeholder="Contoh: Jadwal kirim tiap Selasa & Jumat, Rek BCA: 123456789"
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-rose-600 resize-none text-gray-800"
            ></textarea>
          </div>

          <!-- Info Riwayat Kulakan Saat Edit -->
          <div v-if="isEditing && activeSupplierId" class="space-y-2 pt-2 border-t border-gray-200">
            <div class="p-2.5 bg-gray-50 border border-gray-200 rounded text-[11px] flex items-center justify-between">
              <span class="text-gray-600">Total Faktur Kulakan:</span>
              <span class="font-bold font-mono text-blue-700">{{ getPurchaseCountForSupplier(supplierForm.name) }} Nota</span>
            </div>

            <!-- Riwayat 3 Nota Terakhir -->
            <div v-if="getRecentPurchasesForSupplier(supplierForm.name).length > 0" class="space-y-1">
              <span class="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wider block">Nota Kulakan Terakhir:</span>
              <div
                v-for="rcp in getRecentPurchasesForSupplier(supplierForm.name).slice(0, 3)"
                :key="rcp.id"
                class="p-2 bg-blue-50/60 border border-blue-200/80 rounded text-[10.5px] flex items-center justify-between"
              >
                <div>
                  <span class="font-bold text-gray-800 block">{{ rcp.supplierInvoiceNo || rcp.id }}</span>
                  <span class="text-gray-500 text-[10px]">{{ rcp.date }}</span>
                </div>
                <span class="font-mono font-bold text-blue-900">{{ formatRupiah(rcp.totalBuy || 0) }}</span>
              </div>
            </div>
          </div>
        </div>
      </FormSidebarDrawer>
    </div>

    <!-- Floating Action Button: Tambah Supplier Baru -->
    <button
      type="button"
      @click="handleOpenAdd"
      class="fixed right-4 bottom-20 z-30 w-13 h-13 rounded-full bg-rose-700 hover:bg-rose-800 active:scale-95 text-white shadow-xl flex items-center justify-center transition cursor-pointer border-2 border-white/20"
      title="Tambah Supplier Baru"
    >
      <Plus :size="24" />
    </button>
  </div>
</template>
