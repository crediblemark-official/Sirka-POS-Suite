<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useInventoryStore } from '../../stores/inventoryStore';
import { useLedgerStore } from '../../stores/ledgerStore';
import { useUnitStore } from '../../stores/unitStore';
import { MasterUnit, UnitCategory } from '../../types';
import { CATEGORY_PALETTES, getCategoryTheme } from '../../utils/categoryColor';
import {
  Percent,
  Boxes,
  Edit2,
  Trash2,
  Package,
  Palette,
  Receipt,
  Scale,
  Plus,
  Layers
} from 'lucide-vue-next';
import FormSidebarDrawer from '../common/FormSidebarDrawer.vue';
import AppTableContainer from '../common/AppTableContainer.vue';
import MetricStatsStrip, { MetricStatItem } from '../common/MetricStatsStrip.vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { formatRupiah } from '../../utils/formatters';

const props = withDefaults(defineProps<{
  searchQuery?: string;
}>(), {
  searchQuery: ''
});

const inventoryStore = useInventoryStore();
const ledgerStore = useLedgerStore();
const unitStore = useUnitStore();
const { confirm: showConfirm } = useConfirmDialog();

// Mode Sub-Tab: 'units' (Master Satuan & Kemasan) atau 'categories' (Kategori Barang & Margin)
const activeSubTab = ref<'units' | 'categories'>('units');

// ==========================================
// 1. STATE & LOGIC: MASTER SATUAN & KEMASAN
// ==========================================
const showUnitDrawer = ref(false);
const isEditingUnit = ref(false);
const activeUnitId = ref<string>('');

const unitForm = ref<{
  name: string;
  category: UnitCategory;
  defaultContent: number;
  description: string;
}>({
  name: '',
  category: 'BASE',
  defaultContent: 1,
  description: ''
});

const filteredUnits = computed(() => {
  const list = unitStore.units;
  const q = (props.searchQuery || '').toLowerCase().trim();
  if (!q) return list;
  return list.filter(u =>
    u.name.toLowerCase().includes(q) ||
    (u.description && u.description.toLowerCase().includes(q))
  );
});

// Unit Metrics Strip
const unitMetrics = computed<MetricStatItem[]>(() => [
  {
    label: 'Total Satuan Terdaftar',
    value: `${unitStore.units.length} Satuan`,
    icon: Scale,
    iconBoxClass: 'bg-purple-50 text-purple-700',
    valClass: 'text-purple-900'
  },
  {
    label: 'Kemasan Grosir (Dus/Sak)',
    value: `${unitStore.packagingUnits.length} Kemasan`,
    icon: Package,
    iconBoxClass: 'bg-amber-50 text-amber-700',
    valClass: 'text-amber-800'
  },
  {
    label: 'Satuan Eceran Dasar',
    value: `${unitStore.baseUnits.filter(u => u.category === 'BASE').length} Satuan`,
    icon: Boxes,
    iconBoxClass: 'bg-emerald-50 text-emerald-700',
    valClass: 'text-emerald-800'
  },
  {
    label: 'Metrik Baku (KG/Liter)',
    value: `${unitStore.metricUnits.length} Satuan`,
    icon: Layers,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-blue-800'
  }
]);

function handleOpenAddUnit() {
  isEditingUnit.value = false;
  activeUnitId.value = '';
  unitForm.value = {
    name: '',
    category: 'BASE',
    defaultContent: 10,
    description: ''
  };
  showUnitDrawer.value = true;
}

function handleOpenEditUnit(unit: MasterUnit) {
  isEditingUnit.value = true;
  activeUnitId.value = unit.id;
  unitForm.value = {
    name: unit.name,
    category: unit.category,
    defaultContent: unit.defaultContent || 1,
    description: unit.description || ''
  };
  showUnitDrawer.value = true;
}

function handleSaveUnit() {
  if (!unitForm.value.name.trim()) return;

  if (isEditingUnit.value && activeUnitId.value) {
    unitStore.updateUnit(activeUnitId.value, {
      name: unitForm.value.name,
      category: unitForm.value.category,
      defaultContent: unitForm.value.category === 'PACKAGING' ? Number(unitForm.value.defaultContent) || 1 : 1,
      description: unitForm.value.description
    });
  } else {
    // BUG FIX: nama satuan harus unik. Sebelumnya `addUnit` diam-diam
    // mengubah satuan existing (mis. satuan sistem "KG" jadi BASE).
    const cleanName = unitForm.value.name.trim().toUpperCase();
    if (unitStore.units.some(u => u.name.toUpperCase() === cleanName)) {
      alert(`Satuan "${cleanName}" sudah ada. Gunakan nama lain atau edit satuan yang sudah terdaftar.`);
      return;
    }
    unitStore.addUnit({
      name: unitForm.value.name,
      category: unitForm.value.category,
      defaultContent: unitForm.value.category === 'PACKAGING' ? Number(unitForm.value.defaultContent) || 1 : 1,
      description: unitForm.value.description
    });
  }

  showUnitDrawer.value = false;
}


/**
 * BUG FIX: `unitStore.units.find(...)!` memakai non-null assertion -> bila
 * satuan sudah terhapus (dari tab lain), hasilnya `undefined` dan
 * `handleDeleteUnit(undefined)` melempar TypeError sehingga dialog konfirmasi
 * tidak pernah muncul.
 */
function handleDeleteUnitById() {
  if (!activeUnitId.value) return;
  const unit = unitStore.units.find(u => u.id === activeUnitId.value);
  if (!unit) {
    alert('Satuan tidak ditemukan (mungkin sudah dihapus). Silakan tutup dan buka ulang.');
    return;
  }
  handleDeleteUnit(unit);
}

async function handleDeleteUnit(unit: MasterUnit) {
  const usageCount = unitStore.getUnitUsageCount(unit.name);
  const isConfirmed = await showConfirm({
    title: 'Hapus Master Satuan',
    message: `Hapus satuan "${unit.name}"?`,
    details: usageCount > 0
      ? `Perhatian: Ada ${usageCount} barang di katalog yang saat ini menggunakan satuan "${unit.name}".`
      : 'Satuan ini tidak akan muncul lagi di pilihan otomatis barang masuk.',
    confirmText: 'Ya, Hapus Satuan',
    cancelText: 'Batal',
    type: 'danger'
  });

  if (isConfirmed) {
    unitStore.deleteUnit(unit.id);
    if (activeUnitId.value === unit.id) {
      showUnitDrawer.value = false;
    }
  }
}

// ==========================================
// 2. STATE & LOGIC: KATEGORI BARANG & MARGIN
// ==========================================
const isEditingCategory = ref(false);
const activeVendorKey = ref<string>('');

const showVendorDrawer = computed({
  get: () => inventoryStore.showVendorSidebar,
  set: (val: boolean) => {
    inventoryStore.showVendorSidebar = val;
    if (!val) {
      isEditingCategory.value = false;
      activeVendorKey.value = '';
    }
  }
});

const vendorForm = ref({
  name: '',
  description: '',
  color: 'amber'
});

const totalVendors = computed(() => inventoryStore.categoryMarkups.length);
const totalConnectedSkus = computed(() => inventoryStore.products.length);

/**
 * Rata-rata margin transaksi.
 *
 * BUG FIX: sebelumnya memakai GROSS sales (totalSell) sehingga mengabaikan
 * diskon & poin, dan diberi label "Rata-Rata Margin" padahal itu MARGIN
 * (dibagi HPP) bukan rata-rata. Laporan P&L memakai penjualan BERSIH
 * (`finalTotal`) -> dua angka "margin" berbeda untuk store yang sama.
 * Sekarang sama definisinya dengan P&L: MARGIN dari penjualan bersih.
 */
const averageMarkup = computed(() => {
  let totalTxBuy = 0;
  let totalTxSell = 0;

  for (const tx of ledgerStore.transactions) {
    const net = tx.finalTotal ?? tx.totalSell ?? 0;
    if ((tx.totalBuy || 0) > 0 && net > 0) {
      totalTxBuy += tx.totalBuy;
      totalTxSell += net;
    }
  }

  if (totalTxBuy > 0) {
    return (((totalTxSell - totalTxBuy) / totalTxBuy) * 100).toFixed(1);
  }

  let totalBuy = 0;
  let totalSell = 0;
  for (const p of inventoryStore.products) {
    if (p.lastBuyPrice > 0 && p.lastSellPrice > 0) {
      totalBuy += p.lastBuyPrice;
      totalSell += p.lastSellPrice;
    }
  }
  if (totalBuy === 0) return '0.0';
  return (((totalSell - totalBuy) / totalBuy) * 100).toFixed(1);
});

interface CategoryMarginData {
  margin: number;
  txCount: number;
  isFromTx: boolean;
}

function getCategoryMargin(category: string): CategoryMarginData | null {
  const clean = category.trim().toLowerCase();
  let txBuy = 0;
  let txSell = 0;
  let txCount = 0;

  for (const tx of ledgerStore.transactions) {
    if (!tx.items || tx.items.length === 0) continue;
    let found = false;
    for (const item of tx.items) {
      if ((item.category || '').trim().toLowerCase() === clean) {
        if (item.subtotalBuy > 0 && item.subtotalSell > 0) {
          txBuy += item.subtotalBuy;
          txSell += item.subtotalSell;
          found = true;
        }
      }
    }
    if (found) txCount++;
  }

  if (txCount > 0 && txBuy > 0) {
    return {
      margin: Number((((txSell - txBuy) / txBuy) * 100).toFixed(1)),
      txCount,
      isFromTx: true
    };
  }

  const prods = inventoryStore.products.filter(p => (p.category || '').trim().toLowerCase() === clean);
  let prodBuy = 0;
  let prodSell = 0;
  let validCount = 0;

  for (const p of prods) {
    if (p.lastBuyPrice > 0 && p.lastSellPrice > 0) {
      prodBuy += p.lastBuyPrice;
      prodSell += p.lastSellPrice;
      validCount++;
    }
  }

  if (validCount > 0 && prodBuy > 0) {
    return {
      margin: Number((((prodSell - prodBuy) / prodBuy) * 100).toFixed(1)),
      txCount: 0,
      isFromTx: false
    };
  }

  return null;
}

function getProductCountForVendor(vendorName: string): number {
  const clean = vendorName.trim().toLowerCase();
  return inventoryStore.products.filter(p => (p.category || '').trim().toLowerCase() === clean).length;
}

function getCategoryTxTotal(category: string): number {
  const clean = category.trim().toLowerCase();
  let total = 0;
  for (const tx of ledgerStore.transactions) {
    if (!tx.items || tx.items.length === 0) continue;
    for (const item of tx.items) {
      if ((item.category || '').trim().toLowerCase() === clean) {
        // BUG FIX: `item.subtotalSell || (item.sellPrice * item.qty)` — subtotal
        // 0 (baris yang 100% didiskon / barang gratis) bersifat falsy sehingga
        // fallback menambahkan harga penuh -> "NILAI TRANSAKSI" kategori tidak
        // cocok dengan omzet sebenarnya.
        const subtotal = item.subtotalSell ?? (item.sellPrice * item.qty);
        total += Number(subtotal) || 0;
      }
    }
  }
  return total;
}

const totalTransactionsNominal = computed(() => {
  return ledgerStore.transactions.reduce((acc, tx) => acc + (tx.totalSell || 0), 0);
});

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
    label: 'Total Kategori',
    value: `${totalVendors.value} Kelompok`,
    icon: Palette,
    iconBoxClass: 'bg-rose-50 text-rose-700',
    valClass: 'text-gray-800'
  },
  {
    label: 'Total Nilai Transaksi',
    value: `Rp ${formatRupiah(totalTransactionsNominal.value)}`,
    icon: Receipt,
    iconBoxClass: 'bg-blue-50 text-blue-700',
    valClass: 'text-blue-800'
  },
  {
    label: 'Rata-Rata Margin Transaksi',
    value: `+${averageMarkup.value}%`,
    icon: Percent,
    iconBoxClass: 'bg-emerald-50 text-emerald-700',
    valClass: 'text-emerald-800'
  },
  {
    label: 'Total SKU Terhubung',
    value: `${totalConnectedSkus.value} Produk`,
    icon: Boxes,
    iconBoxClass: 'bg-purple-50 text-purple-700',
    valClass: 'text-purple-800'
  }
]);

function handleOpenAddCategory() {
  isEditingCategory.value = false;
  activeVendorKey.value = '';
  vendorForm.value = {
    name: '',
    description: '',
    color: 'amber'
  };
  showVendorDrawer.value = true;
}

function handleOpenEditCategory(setting: { category: string; description?: string; color?: string }) {
  isEditingCategory.value = true;
  activeVendorKey.value = setting.category;
  vendorForm.value = {
    name: setting.category,
    description: setting.description || '',
    color: setting.color || getCategoryTheme(setting.category).id
  };
  showVendorDrawer.value = true;
}

async function handleSaveCategory() {
  if (!vendorForm.value.name.trim()) return;

  if (isEditingCategory.value && activeVendorKey.value) {
    if (activeVendorKey.value.trim().toLowerCase() !== vendorForm.value.name.trim().toLowerCase()) {
      // BUG FIX: saat kategori di-RENAME, margin lama harus dipertahankan.
      // Sebelumnya `addCategory(nama, 20, ...)` memakai nilai hard-coded 20%
      // sehingga margin kustom (mis. 25%) hilang, dan produk yang masih
      // menunjuk kategori lama ikut kehilangan marginnya (fallback 20%).
      const existing = inventoryStore.categoryMarkups.find(
        c => c.category === activeVendorKey.value
      );
      const preservedMarkup = existing?.defaultMarkupPercent ?? 20;

      // BUG FIX: urutan & await sebelumnya salah:
      //  1) `deleteCategory`/`addCategory` tidak di-await -> insert kategori
      //     baru bisa belum selesai saat produk di-update -> FK violation.
      //  2) `deleteCategory` gagal di PostgreSQL bila produk masih memakai
      //     kategori itu (FK) — error-nya ditelan sehingga state lokal
      //     berubah tapi cloud tetap menyimpan kategori lama (kategori muncul
      //     lagi setelah restart).
      // Sekarang: produk dipindah DULU, baru kategori lama dihapus & yang baru
      // ditambahkan, semuanya di-await, dan error dilaporkan ke user.
      const newName = vendorForm.value.name.trim();
      const moved = inventoryStore.products.filter(p => p.category === activeVendorKey.value);
      for (const prod of moved) {
        prod.category = newName;
        try {
          await inventoryStore.updateProduct(prod);
        } catch (err: any) {
          alert(`Gagal memindahkan barang "${prod.name}" ke kategori "${newName}": ${err?.message || err}`);
          return;
        }
      }

      try {
        await inventoryStore.deleteCategory(activeVendorKey.value);
        await inventoryStore.addCategory(
          newName,
          preservedMarkup,
          vendorForm.value.description,
          vendorForm.value.color
        );
      } catch (err: any) {
        alert(`Gagal mengganti nama kategori: ${err?.message || err}`);
      }
    } else {
      inventoryStore.updateCategory(activeVendorKey.value, {
        description: vendorForm.value.description,
        color: vendorForm.value.color
      });
    }
  } else {
    inventoryStore.addCategory(
      vendorForm.value.name.trim(),
      20,
      vendorForm.value.description,
      vendorForm.value.color
    );
  }

  showVendorDrawer.value = false;
}

async function handleDeleteCategory(cat: string) {
  const count = getProductCountForVendor(cat);
  const msg = count > 0
    ? `Kategori "${cat}" terhubung dengan ${count} barang. Yakin ingin menghapus?`
    : `Yakin ingin menghapus kategori "${cat}"?`;

  const isConfirmed = await showConfirm({
    title: 'Hapus Kategori',
    message: msg,
    details: count > 0 ? `Perhatian: Ada ${count} barang yang saat ini menggunakan kategori ini.` : undefined,
    confirmText: 'Ya, Hapus',
    cancelText: 'Batal',
    type: 'danger'
  });

  if (isConfirmed) {
    inventoryStore.deleteCategory(cat);
    if (activeVendorKey.value === cat) {
      showVendorDrawer.value = false;
    }
  }
}

// Master Toolbar Action: Buka drawer tambah sesuai sub-tab aktif
function handleOpenAdd() {
  if (activeSubTab.value === 'units') {
    handleOpenAddUnit();
  } else {
    handleOpenAddCategory();
  }
}

watch(
  () => inventoryStore.showVendorSidebar,
  (isOpen) => {
    // BUG FIX: sebelumnya drawer kategori hanya terbuka bila sub-tab aktif
    // "categories". Bila sub-tab "units" aktif, tombol toolbar membuka panel
    // kosong tanpa form apa pun. Sekarang ikut membuka form satuan.
    if (!isOpen) return;
    if (activeSubTab.value === 'units') {
      if (!isEditingUnit.value && !activeUnitId.value) handleOpenAddUnit();
      return;
    }
    if (!isEditingCategory.value && !activeVendorKey.value) {
      handleOpenAddCategory();
    }
  },
  { immediate: true }
);

defineExpose({
  openAdd: handleOpenAdd
});
</script>

<template>
  <div class="flex flex-col h-full bg-[#f8f7f5] text-[#2e2b28] select-none text-xs overflow-hidden">
    <!-- Main Workspace: Split Layar (Kiri: Tabel & Ribbon, Kanan: FormSidebarDrawer) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Sisi Kiri: Ribbon + Switcher + MetricStatsStrip + Tabel Edge-to-Edge -->
      <div class="flex-1 flex flex-col overflow-hidden bg-white">
        <!-- 1. Top Ribbon: Segmented Switcher (Satuan vs Kategori) & Action Button -->
        <div
          v-horizontal-scroll
          class="h-10.5 relative flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 select-none shrink-0 gap-2 overflow-x-auto no-scrollbar"
        >
          <!-- Segmented Tab Switcher -->
          <div class="flex items-center bg-gray-200/80 p-0.5 rounded-lg border border-gray-300 shadow-2xs shrink-0">
            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap"
              :class="activeSubTab === 'units'
                ? 'bg-white text-purple-900 shadow-xs ring-1 ring-black/5'
                : 'text-gray-600 hover:text-gray-900'"
              @click="activeSubTab = 'units'"
            >
              <Scale :size="13" class="text-purple-600" />
              <span>Master Satuan & Kemasan</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold"
                :class="activeSubTab === 'units' ? 'bg-purple-100 text-purple-800' : 'bg-gray-300 text-gray-700'"
              >
                {{ unitStore.units.length }}
              </span>
            </button>

            <button
              type="button"
              class="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap"
              :class="activeSubTab === 'categories'
                ? 'bg-white text-purple-900 shadow-xs ring-1 ring-black/5'
                : 'text-gray-600 hover:text-gray-900'"
              @click="activeSubTab = 'categories'"
            >
              <Palette :size="13" class="text-rose-600" />
              <span>Kategori Barang & Margin</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold"
                :class="activeSubTab === 'categories' ? 'bg-rose-100 text-rose-800' : 'bg-gray-300 text-gray-700'"
              >
                {{ totalVendors }}
              </span>
            </button>
          </div>

          <!-- Kanan: Status Pencarian -->
          <div v-if="props.searchQuery" class="flex items-center gap-2 ml-auto shrink-0">
            <span class="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 font-medium">
              Cari: "<span class="font-bold text-gray-800">{{ props.searchQuery }}</span>"
            </span>
          </div>
        </div>

        <!-- ============================================== -->
        <!-- SUB-TAB 1: MASTER SATUAN & KEMASAN VIEW        -->
        <!-- ============================================== -->
        <template v-if="activeSubTab === 'units'">
          <!-- Reusable MetricStatsStrip Satuan -->
          <MetricStatsStrip :items="unitMetrics" />

          <!-- Tabel Master Satuan -->
          <AppTableContainer
            :is-empty="filteredUnits.length === 0"
            :empty-icon="Scale"
            empty-title="Tidak Ada Satuan Ditemukan"
            empty-description="Klik tombol Tambah Satuan untuk mendaftarkan nama satuan baru."
          >
            <table class="table-explorer whitespace-nowrap min-w-[750px]">
              <thead>
                <tr>
                  <th class="w-12 text-center">NO</th>
                  <th class="w-48">NAMA SATUAN</th>
                  <th class="w-48">KATEGORI SATUAN</th>
                  <th class="w-36 text-center">ISI DEFAULT KEMASAN</th>
                  <th class="w-32 text-center">PRODUK TERKAIT</th>
                  <th>KETERANGAN / FUNGSI</th>
                  <th class="w-24 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(u, idx) in filteredUnits"
                  :key="u.id"
                  class="cursor-pointer hover:bg-purple-50/40 transition-colors"
                  :class="activeUnitId === u.id ? 'bg-purple-50 font-semibold' : ''"
                  @click="handleOpenEditUnit(u)"
                >
                  <td class="text-center font-mono text-gray-400 text-[11px]">
                    {{ idx + 1 }}
                  </td>

                  <td>
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 bg-gray-100 text-gray-900 border border-gray-300 rounded font-mono font-bold text-xs uppercase shadow-2xs">
                        {{ u.name }}
                      </span>
                      <span v-if="u.isDefault" class="text-[9.5px] text-gray-400 font-normal">
                        (Standar)
                      </span>
                    </div>
                  </td>

                  <td>
                    <span
                      v-if="u.category === 'PACKAGING'"
                      class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 w-max"
                    >
                      <Package :size="10" />
                      <span>Kemasan Grosir</span>
                    </span>
                    <span
                      v-else-if="u.category === 'METRIC'"
                      class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 flex items-center gap-1 w-max"
                    >
                      <Layers :size="10" />
                      <span>Metrik Timbangan/Volume</span>
                    </span>
                    <span
                      v-else
                      class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1 w-max"
                    >
                      <Boxes :size="10" />
                      <span>Satuan Dasar / Ecer</span>
                    </span>
                  </td>

                  <td class="text-center font-mono font-bold text-xs">
                    <span v-if="u.category === 'PACKAGING'" class="text-amber-800">
                      {{ u.defaultContent || 1 }} unit
                    </span>
                    <span v-else class="text-gray-300">-</span>
                  </td>

                  <td class="text-center">
                    <span
                      class="px-2 py-0.5 rounded font-mono font-bold text-[11px]"
                      :class="unitStore.getUnitUsageCount(u.name) > 0 ? 'bg-purple-100 text-purple-900' : 'bg-gray-100 text-gray-400'"
                    >
                      {{ unitStore.getUnitUsageCount(u.name) }} SKU
                    </span>
                  </td>

                  <td class="text-gray-600 text-xs">
                    {{ u.description || '-' }}
                  </td>

                  <td class="text-center" @click.stop>
                    <div class="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        class="p-1 text-gray-400 hover:text-purple-700 hover:bg-purple-50 rounded cursor-pointer transition-colors"
                        title="Edit Satuan"
                        @click="handleOpenEditUnit(u)"
                      >
                        <Edit2 :size="13" />
                      </button>
                      <button
                        type="button"
                        class="p-1 text-gray-400 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                        title="Hapus Satuan"
                        @click="handleDeleteUnit(u)"
                      >
                        <Trash2 :size="13" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </AppTableContainer>
        </template>

        <!-- ============================================== -->
        <!-- SUB-TAB 2: KATEGORI BARANG & MARGIN VIEW       -->
        <!-- ============================================== -->
        <template v-else>
          <!-- Reusable MetricStatsStrip Kategori -->
          <MetricStatsStrip :items="vendorMetrics" />

          <!-- Tabel Kategori Barang -->
          <AppTableContainer
            :is-empty="filteredMarkups.length === 0"
            :empty-icon="Palette"
            empty-title="Tidak Ada Kategori Ditemukan"
            empty-description="Klik tombol Kategori Baru untuk menambahkan kelompok barang baru."
          >
            <table class="table-explorer whitespace-nowrap min-w-[780px]">
              <thead>
                <tr>
                  <th class="w-12 text-center">NO</th>
                  <th class="w-56">NAMA KATEGORI BARANG</th>
                  <th>DESKRIPSI & KETERANGAN</th>
                  <th class="w-32 text-center">BARANG TERKAIT</th>
                  <th class="w-36 text-center">NILAI TRANSAKSI</th>
                  <th class="w-32 text-center">MARGIN LABA</th>
                  <th class="w-20 text-center">AKSI</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in filteredMarkups"
                  :key="item.category"
                  class="cursor-pointer hover:bg-purple-50/40 transition-colors"
                  :class="activeVendorKey === item.category ? 'bg-purple-50 font-semibold' : ''"
                  @click="handleOpenEditCategory(item)"
                >
                  <td class="text-center font-mono text-gray-400 text-[11px]">
                    {{ idx + 1 }}
                  </td>

                  <td>
                    <div class="flex items-center gap-2">
                      <span
                        class="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs ring-1 ring-black/10"
                        :style="{ backgroundColor: getCategoryTheme(item.category, item.color).hex }"
                      ></span>
                      <span class="font-bold text-gray-900 text-xs uppercase">
                        {{ item.category }}
                      </span>
                    </div>
                  </td>

                  <td class="text-gray-500 text-xs">
                    {{ item.description || '-' }}
                  </td>

                  <td class="text-center font-mono font-bold text-gray-700 text-xs">
                    {{ getProductCountForVendor(item.category) }} SKU
                  </td>

                  <td class="text-center font-mono text-xs">
                    <span v-if="getCategoryTxTotal(item.category) > 0" class="font-bold text-blue-800">
                      Rp {{ formatRupiah(getCategoryTxTotal(item.category)) }}
                    </span>
                    <span v-else class="text-gray-300">-</span>
                  </td>

                  <td class="text-center font-mono text-xs">
                    <template v-if="getCategoryMargin(item.category)">
                      <span class="font-bold text-emerald-700">
                        +{{ getCategoryMargin(item.category)!.margin }}%
                      </span>
                      <span v-if="getCategoryMargin(item.category)!.isFromTx" class="text-[9.5px] text-gray-400 block">
                        ({{ getCategoryMargin(item.category)!.txCount }} tx)
                      </span>
                    </template>
                    <span v-else class="text-gray-300">-</span>
                  </td>

                  <td class="text-center" @click.stop>
                    <div class="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        class="p-1 text-gray-400 hover:text-purple-700 hover:bg-purple-50 rounded cursor-pointer transition-colors"
                        title="Edit Kategori"
                        @click="handleOpenEditCategory(item)"
                      >
                        <Edit2 :size="13" />
                      </button>
                      <button
                        type="button"
                        class="p-1 text-gray-400 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer transition-colors"
                        title="Hapus Kategori"
                        @click="handleDeleteCategory(item.category)"
                      >
                        <Trash2 :size="13" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </AppTableContainer>
        </template>
      </div>

      <!-- ============================================== -->
      <!-- DRAWER 1: FORM TAMBAH / EDIT MASTER SATUAN     -->
      <!-- ============================================== -->
      <FormSidebarDrawer
        v-if="activeSubTab === 'units'"
        v-model="showUnitDrawer"
        :is-editing="isEditingUnit"
        title="Master Satuan"
        :code-badge="unitForm.name || 'SATUAN'"
        :can-edit="isEditingUnit"
        :can-save="!!unitForm.name.trim()"
        :save-label="isEditingUnit ? 'SIMPAN PERUBAHAN' : 'TAMBAH SATUAN'"
        theme-color="purple"
        :show-delete="isEditingUnit"
        width="w-[340px] lg:w-[380px]"
        @save="handleSaveUnit"
        @delete="handleDeleteUnitById"
        @cancel="showUnitDrawer = false"
      >
        <template #icon>
          <Scale :size="14" class="text-purple-700 shrink-0" />
        </template>

        <div class="space-y-4">
          <!-- Nama Satuan -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">
              Nama Satuan <span class="text-rose-600">*</span>
            </label>
            <input
              v-model="unitForm.name"
              type="text"
              placeholder="Contoh: DUS, SAK, KG, BUNGKUS"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-mono font-bold uppercase shadow-2xs"
            />
            <span class="text-[10px] text-gray-400 mt-0.5 block">Nama satuan akan otomatis berhuruf kapital.</span>
          </div>

          <!-- Kategori Satuan -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Tipe / Kelompok Satuan</label>
            <div class="space-y-1.5">
              <label class="flex items-start gap-2 p-2 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                :class="unitForm.category === 'BASE' ? 'bg-emerald-50/60 border-emerald-300' : ''"
              >
                <input v-model="unitForm.category" type="radio" value="BASE" class="mt-0.5" />
                <div>
                  <span class="text-xs font-bold text-gray-800 block">Satuan Dasar / Eceran (Base Unit)</span>
                  <span class="text-[10.5px] text-gray-500 block">Satuan eceran terkecil (PCS, BUNGKUS, BOTOL, CUP, SACHET, BUTIR).</span>
                </div>
              </label>

              <label class="flex items-start gap-2 p-2 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                :class="unitForm.category === 'PACKAGING' ? 'bg-amber-50/60 border-amber-300' : ''"
              >
                <input v-model="unitForm.category" type="radio" value="PACKAGING" class="mt-0.5" />
                <div>
                  <span class="text-xs font-bold text-gray-800 block">Kemasan Grosir (Packaging)</span>
                  <span class="text-[10.5px] text-gray-500 block">Kemasan bertingkat pabrik yang dihitung saat kulakan (DUS, SAK, SLOP, PETI, TRAY, BAL, RENCENG).</span>
                </div>
              </label>

              <label class="flex items-start gap-2 p-2 rounded border border-gray-200 hover:bg-gray-50 cursor-pointer"
                :class="unitForm.category === 'METRIC' ? 'bg-blue-50/60 border-blue-300' : ''"
              >
                <input v-model="unitForm.category" type="radio" value="METRIC" class="mt-0.5" />
                <div>
                  <span class="text-xs font-bold text-gray-800 block">Metrik Baku Timbangan / Volume</span>
                  <span class="text-[10.5px] text-gray-500 block">Satuan ilmiah tetap (KG, GRAM, ONS, LITER, ML).</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Default Isi Kemasan (Jika Packaging) -->
          <div v-if="unitForm.category === 'PACKAGING'" class="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-1">
            <label class="text-[11px] font-semibold text-amber-900 block">
              Default Isi per Kemasan (Bisa disesuaikan saat kulakan)
            </label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="unitForm.defaultContent"
                type="number"
                min="1"
                step="any"
                class="w-28 bg-white border border-amber-400 rounded px-2.5 py-1 text-xs font-mono font-bold text-amber-900 outline-none focus:border-amber-600 text-center"
              />
              <span class="text-[11px] text-amber-800 font-medium">unit eceran dasar</span>
            </div>
            <span class="text-[9.5px] text-amber-700 block">Contoh: 1 Dus default isi 40 bungkus, 1 Sak default isi 50 kg.</span>
          </div>

          <!-- Keterangan / Catatan Satuan -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Keterangan & Catatan</label>
            <textarea
              v-model="unitForm.description"
              rows="2"
              placeholder="Contoh: Kemasan dus karton mie instan atau air mineral"
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 resize-none text-gray-800 shadow-2xs"
            ></textarea>
          </div>

          <!-- Info Penggunaan di Katalog -->
          <div v-if="isEditingUnit" class="p-2.5 bg-purple-50/60 border border-purple-200 rounded-lg text-xs flex items-center justify-between">
            <span class="text-gray-600">Digunakan oleh:</span>
            <span class="font-bold font-mono text-purple-900">
              {{ unitStore.getUnitUsageCount(unitForm.name) }} Produk
            </span>
          </div>
        </div>
      </FormSidebarDrawer>

      <!-- ============================================== -->
      <!-- DRAWER 2: FORM TAMBAH / EDIT KATEGORI BARANG   -->
      <!-- ============================================== -->
      <FormSidebarDrawer
        v-if="activeSubTab === 'categories'"
        v-model="showVendorDrawer"
        :is-editing="isEditingCategory"
        title="Kategori Barang"
        :code-badge="vendorForm.name || 'BARU'"
        :can-edit="isEditingCategory"
        :can-save="!!vendorForm.name.trim()"
        :save-label="isEditingCategory ? 'SIMPAN PERUBAHAN' : 'TAMBAH KATEGORI'"
        theme-color="purple"
        :show-delete="isEditingCategory"
        width="w-[340px] lg:w-[380px]"
        @save="handleSaveCategory"
        @delete="activeVendorKey && handleDeleteCategory(activeVendorKey)"
        @cancel="showVendorDrawer = false"
      >
        <template #icon>
          <Palette :size="14" class="text-rose-700 shrink-0" />
        </template>

        <div class="space-y-4">
          <!-- Nama Kategori -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">
              Nama Kategori Barang <span class="text-rose-600">*</span>
            </label>
            <input
              v-model="vendorForm.name"
              type="text"
              placeholder="Contoh: Minuman Dingin, Sembako Pokok"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-bold uppercase shadow-2xs"
            />
          </div>

          <!-- Pilihan Tema Warna Label Kasir POS -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">
              Warna Label Visual Kasir POS
            </label>
            <div class="grid grid-cols-6 gap-1.5 pt-1">
              <button
                v-for="palette in CATEGORY_PALETTES"
                :key="palette.id"
                type="button"
                class="h-7 rounded-md cursor-pointer transition-all flex items-center justify-center relative shadow-2xs hover:scale-105 active:scale-95"
                :style="{ backgroundColor: palette.hex }"
                :title="palette.name"
                @click="vendorForm.color = palette.id"
              >
                <span
                  v-if="vendorForm.color === palette.id"
                  class="w-2.5 h-2.5 rounded-full bg-white shadow-xs ring-2 ring-black/20"
                ></span>
              </button>
            </div>
          </div>

          <!-- Deskripsi Kelompok Barang -->
          <div>
            <label class="text-[11px] font-semibold text-gray-700 block mb-1">Deskripsi / Keterangan Kategori</label>
            <textarea
              v-model="vendorForm.description"
              rows="3"
              placeholder="Contoh: Aneka beras, minyak goreng, dan sembako grosir."
              class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 resize-none text-gray-800 shadow-2xs"
            ></textarea>
          </div>

          <!-- Info Terkait Produk & Performa Transaksi -->
          <div v-if="isEditingCategory" class="space-y-2">
            <div class="p-2.5 bg-purple-50/60 border border-purple-200/80 rounded text-[11px] text-purple-900 flex items-center justify-between">
              <span class="text-gray-600">Barang Terhubung:</span>
              <span class="font-bold font-mono">{{ getProductCountForVendor(activeVendorKey) }} SKU</span>
            </div>

            <div
              v-if="getCategoryMargin(activeVendorKey)"
              class="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded text-[11px] text-emerald-900 flex items-center justify-between"
            >
              <span class="text-gray-600">
                {{ getCategoryMargin(activeVendorKey)!.isFromTx ? 'Rata-Rata Margin Transaksi:' : 'Margin Estimasi Katalog:' }}
              </span>
              <div class="text-right">
                <span class="font-bold font-mono text-emerald-800 text-xs">
                  +{{ getCategoryMargin(activeVendorKey)!.margin }}%
                </span>
                <span class="block text-[9.5px] text-gray-400">
                  {{ getCategoryMargin(activeVendorKey)!.isFromTx ? `Dihitung dari ${getCategoryMargin(activeVendorKey)!.txCount} transaksi kasir` : 'Belum ada transaksi kasir' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </FormSidebarDrawer>
    </div>

    <!-- Floating Action Button: Tambah Satuan / Kategori -->
    <button
      type="button"
      @click="handleOpenAdd"
      class="fixed right-4 bottom-20 z-30 w-13 h-13 rounded-full text-white shadow-xl flex items-center justify-center transition cursor-pointer border-2 border-white/20 active:scale-95"
      :class="activeSubTab === 'units' ? 'bg-purple-700 hover:bg-purple-800' : 'bg-rose-700 hover:bg-rose-800'"
      :title="activeSubTab === 'units' ? 'Tambah Satuan Baru' : 'Tambah Kategori Baru'"
    >
      <Plus :size="24" />
    </button>
  </div>
</template>
