<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Discount, DiscountType, DiscountScope, CustomerType } from '../../../types';
import { useDiscountStore } from '../../../stores/discountStore';
import { useInventoryStore } from '../../../stores/inventoryStore';
import FormSidebarDrawer from '../../common/FormSidebarDrawer.vue';
import SearchableSelect, { type SelectOption } from '../../common/SearchableSelect.vue';
import { Tag, Percent, DollarSign, Users } from 'lucide-vue-next';

const props = defineProps<{
  modelValue: boolean;
  selectedDiscount: Discount | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved', discount: Discount): void;
  (e: 'deleted', id: string, name: string): void;
  (e: 'switch-to-new'): void;
  (e: 'switch-to-edit', discount: Discount): void;
}>();

const discountStore = useDiscountStore();
const inventoryStore = useInventoryStore();

const isEditing = computed(() => Boolean(discountStore.activeDiscountForEdit?.id));

const formCode = ref('');
const formName = ref('');
const formType = ref<DiscountType>('PERCENT');
// BUG FIX: nilai default kupon berbeda tergantung cara form dibuka
// (ref awal 10, resetForm 5). Sekarang konsisten 5.
const DEFAULT_DISCOUNT_VALUE = 5;
const formValue = ref<number>(DEFAULT_DISCOUNT_VALUE);
const formMinPurchase = ref<number>(0);
const formMaxDiscount = ref<number | undefined>(undefined);
const formScope = ref<DiscountScope>('ALL');
const formTargetCategory = ref<string>('');
const formTargetCustomerType = ref<CustomerType>('B2B');
const formIsActive = ref<boolean>(true);
const formDescription = ref('');

const categories = computed(() => inventoryStore.categoryMarkups.map(c => c.category));
const categoryOptions = computed<SelectOption[]>(() => {
  return categories.value.map(cat => ({
    value: cat,
    label: cat
  }));
});

/**
 * BUG FIX: `can-save` sebelumnya tidak memvalidasi target scope. Kupon dengan
 * scope CATEGORY & kategori kosong tersimpan -> tidak pernah bisa dipakai
 * ("Kupon hanya berlaku untuk kategori ").
 */
const canSave = computed(() => {
  if (!formCode.value.trim() || !formName.value.trim()) return false;
  const value = Number(formValue.value);
  if (!Number.isFinite(value) || value <= 0) return false;
  if (formType.value === 'PERCENT' && value > 100) return false;
  if (formScope.value === 'CATEGORY' && !formTargetCategory.value.trim()) return false;
  if (formScope.value === 'CUSTOMER_TYPE' && !formTargetCustomerType.value) return false;
  return true;
});

const scopeOptions: SelectOption[] = [
  { value: 'ALL', label: 'Semua Produk (Total Belanja Seluruh Nota)' },
  { value: 'CATEGORY', label: 'Kategori Barang Tertentu Saja' },
  { value: 'CUSTOMER_TYPE', label: 'Grup Pelanggan Tertentu (B2B / Grosir)' },
  { value: 'MEMBER_ONLY', label: 'Khusus Pelanggan Terdaftar (Member)' }
];

const customerTypeOptions: SelectOption[] = [
  { value: 'B2B', label: 'Khusus Langganan Grosir / B2B' },
  { value: 'B2C', label: 'Khusus Pelanggan Retail / Umum (B2C)' }
];

function resetForm() {
  formCode.value = '';
  formName.value = '';
  formType.value = 'PERCENT';
  formValue.value = DEFAULT_DISCOUNT_VALUE;
  formMinPurchase.value = 0;
  formMaxDiscount.value = undefined;
  formScope.value = 'ALL';
  formTargetCategory.value = categories.value[0] || '';
  formTargetCustomerType.value = 'B2B';
  formIsActive.value = true;
  formDescription.value = '';
}

function populateForm(d: Discount) {
  formCode.value = d.code;
  formName.value = d.name;
  formType.value = d.type;
  formValue.value = d.value;
  formMinPurchase.value = d.minPurchase || 0;
  formMaxDiscount.value = d.maxDiscount;
  formScope.value = d.scope || 'ALL';
  formTargetCategory.value = d.targetCategory || (categories.value[0] || '');
  formTargetCustomerType.value = d.targetCustomerType || 'B2B';
  formIsActive.value = d.isActive ?? true;
  formDescription.value = d.description || '';
}

watch(
  () => discountStore.activeDiscountForEdit,
  (val) => {
    if (val) {
      populateForm(val);
    } else {
      resetForm();
    }
  },
  { immediate: true }
);

watch(
  () => props.modelValue,
  (isOpen) => {
    // BUG FIX: reset hanya dilakukan bila `formCode` masih kosong, sehingga
    // data form lama bisa bertahan saat drawer dibuka dalam mode "Tambah".
    if (isOpen && !discountStore.activeDiscountForEdit) {
      resetForm();
    }
  }
);

async function handleSave() {
  if (!formCode.value.trim() || !formName.value.trim()) {
    alert('Mohon isi kode kupon dan nama diskon!');
    return;
  }

  // BUG FIX: diskon persen > 100% membuat transaksi gratis (finalTotal = 0)
  // karena diskon tidak dibatasi terhadap subtotal. Sekarang divalidasi.
  const numericValue = Number(formValue.value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    alert('Nilai diskon harus berupa angka lebih besar dari 0.');
    return;
  }
  if (formType.value === 'PERCENT' && numericValue > 100) {
    alert('Diskon persen tidak boleh lebih dari 100%. Nilai di atas 100% akan membuat transaksi gratis.');
    return;
  }
  // BUG FIX: scope tanpa target -> kupon tidak akan pernah bisa dipakai.
  if (formScope.value === 'CATEGORY' && !formTargetCategory.value.trim()) {
    alert('Pilih kategori barang yang berlaku untuk kupon ini.');
    return;
  }

  const payload: Omit<Discount, 'id' | 'createdAt' | 'usageCount'> | Discount = {
    ...(discountStore.activeDiscountForEdit ? { id: discountStore.activeDiscountForEdit.id } : {}),
    code: formCode.value.trim().toUpperCase(),
    name: formName.value.trim(),
    type: formType.value,
    value: numericValue,
    minPurchase: Number(formMinPurchase.value) || 0,
    maxDiscount: formType.value === 'PERCENT' && formMaxDiscount.value ? Number(formMaxDiscount.value) : undefined,
    scope: formScope.value,
    targetCategory: formScope.value === 'CATEGORY' ? formTargetCategory.value : undefined,
    targetCustomerType: formScope.value === 'CUSTOMER_TYPE' ? formTargetCustomerType.value : undefined,
    isActive: formIsActive.value,
    description: formDescription.value.trim() || undefined
  };

  // BUG FIX: `upsertDiscount` melempar error bila gagal. Tanpa try/catch terjadi
  // unhandled rejection -> drawer tetap terbuka TANPA pesan error, dan user
  // menekan Simpan berulang -> kupon DUPLIKAT dengan kode sama.
  try {
    const saved = await discountStore.upsertDiscount(payload);
    emit('update:modelValue', false);
    if (saved) {
      emit('saved', saved);
    }
  } catch (err: any) {
    alert(`Gagal menyimpan kupon: ${err?.message || err}`);
  }
}

function handleDelete() {
  if (discountStore.activeDiscountForEdit) {
    emit('deleted', discountStore.activeDiscountForEdit.id, formName.value);
  }
}

function handleClose() {
  emit('update:modelValue', false);
}
</script>

<template>
  <FormSidebarDrawer
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    :is-editing="isEditing"
    title="Diskon"
    :code-badge="formCode"
    :can-edit="!!selectedDiscount"
    :can-save="canSave"
    :save-label="isEditing ? 'SIMPAN PERUBAHAN' : 'SIMPAN KUPON'"
    theme-color="rose"
    @switch-to-new="emit('switch-to-new')"
    @switch-to-edit="selectedDiscount && emit('switch-to-edit', selectedDiscount)"
    @save="handleSave"
    @delete="handleDelete"
    @cancel="handleClose"
  >
    <template #icon>
      <Tag :size="14" class="text-rose-700 shrink-0" />
    </template>

    <!-- Seksi 1: Identitas & Kode Promo -->
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <div class="flex items-center gap-1.5 font-bold text-rose-700 text-xs">
        <Tag :size="13" />
        <span>Identitas & Kode Promo</span>
      </div>

      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Kode Kupon / Voucher *</label>
        <input
          v-model="formCode"
          type="text"
          placeholder="Misal: PROMOHEMAT10"
          class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs font-mono font-bold uppercase outline-none focus:border-rose-500 shadow-2xs"
        />
        <span class="text-[10px] text-gray-400 mt-0.5 block">Kode yang diketik kasir atau pelanggan saat checkout.</span>
      </div>

      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Nama Program Promo *</label>
        <input
          v-model="formName"
          type="text"
          placeholder="Misal: Diskon Belanja Awal Bulan"
          class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-rose-500 shadow-2xs"
        />
      </div>

      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Catatan / Deskripsi Promo</label>
        <textarea
          v-model="formDescription"
          rows="2"
          placeholder="Keterangan singkat syarat & ketentuan..."
          class="w-full bg-[#fcfbfa] border border-gray-300 rounded px-2.5 py-1 text-xs outline-none focus:border-rose-500 shadow-2xs resize-none"
        ></textarea>
      </div>
    </div>

    <!-- Seksi 2: Skema Potongan Harga -->
    <div class="space-y-2.5 pb-4 border-b border-gray-200">
      <div class="flex items-center gap-1.5 font-bold text-rose-700 text-xs">
        <Percent :size="13" />
        <span>Skema Potongan Harga</span>
      </div>

      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-1">Jenis Potongan *</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="py-1.5 px-2 rounded border font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            :class="formType === 'PERCENT' ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
            @click="formType = 'PERCENT'"
          >
            <Percent :size="12" />
            <span>Persen (%)</span>
          </button>
          <button
            type="button"
            class="py-1.5 px-2 rounded border font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            :class="formType === 'FIXED' ? 'bg-rose-50 border-rose-500 text-rose-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
            @click="formType = 'FIXED'"
          >
            <DollarSign :size="12" />
            <span>Nominal (Rp)</span>
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">
            {{ formType === 'PERCENT' ? 'Besar Diskon (%) *' : 'Potongan Tetap (Rp) *' }}
          </label>
          <div class="relative flex items-center">
            <span v-if="formType === 'FIXED'" class="absolute left-2 text-[11px] text-gray-400 font-mono">Rp</span>
            <input
              v-model.number="formValue"
              type="number"
              :min="0"
              :max="formType === 'PERCENT' ? 100 : undefined"
              :step="formType === 'PERCENT' ? 1 : 1000"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded py-1 text-xs font-mono font-bold outline-none focus:border-rose-500 shadow-2xs"
              :class="formType === 'FIXED' ? 'pl-7 pr-2 text-right' : 'px-2 text-center'"
            />
            <span v-if="formType === 'PERCENT'" class="absolute right-2 text-[11px] text-gray-400 font-mono font-bold">%</span>
          </div>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Min. Belanja (Rp)</label>
          <div class="relative flex items-center">
            <span class="absolute left-2 text-[11px] text-gray-400 font-mono">Rp</span>
            <input
              v-model.number="formMinPurchase"
              type="number"
              step="5000"
              min="0"
              placeholder="0"
              class="w-full bg-[#fcfbfa] border border-gray-300 rounded pl-7 pr-2 py-1 text-xs font-mono text-right outline-none focus:border-rose-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      <!-- Maksimal Diskon (Hanya relevan jika PERCENT) -->
      <div v-if="formType === 'PERCENT'">
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">
          Batas Maksimal Potongan Diskon (Opsional)
        </label>
        <div class="relative flex items-center">
          <span class="absolute left-2 text-[11px] text-gray-400 font-mono">Rp</span>
          <input
            v-model.number="formMaxDiscount"
            type="number"
            step="5000"
            min="0"
            placeholder="Kosongkan jika tanpa batas maksimal"
            class="w-full bg-[#fcfbfa] border border-gray-300 rounded pl-7 pr-2 py-1 text-xs font-mono text-right outline-none focus:border-rose-500 shadow-2xs"
          />
        </div>
      </div>
    </div>

    <!-- Seksi 3: Syarat Cakupan & Sasaran Pelanggan -->
    <div class="space-y-2.5">
      <div class="flex items-center gap-1.5 font-bold text-rose-700 text-xs">
        <Users :size="13" />
        <span>Cakupan & Sasaran Pelanggan</span>
      </div>

      <div>
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Cakupan Potongan Diskon</label>
        <SearchableSelect
          v-model="formScope"
          :options="scopeOptions"
          placeholder="Pilih Cakupan Diskon..."
          search-placeholder="Cari cakupan..."
          hotkey=""
        />
      </div>

      <!-- Pilihan Kategori jika Cakupan Kategori -->
      <div v-if="formScope === 'CATEGORY'">
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Pilih Kategori Barang *</label>
        <SearchableSelect
          v-model="formTargetCategory"
          :options="categoryOptions"
          placeholder="-- Pilih Kategori --"
          search-placeholder="Cari kategori..."
          hotkey=""
        />
      </div>

      <!-- Pilihan Tipe Pelanggan jika Cakupan Customer Type -->
      <div v-if="formScope === 'CUSTOMER_TYPE'">
        <label class="text-[11px] font-semibold text-gray-600 block mb-0.5">Tipe Pelanggan yang Berhak *</label>
        <SearchableSelect
          v-model="formTargetCustomerType"
          :options="customerTypeOptions"
          placeholder="Pilih Tipe Pelanggan..."
          search-placeholder="Cari tipe pelanggan..."
          hotkey=""
        />
      </div>

      <!-- Toggle Aktif/Nonaktif -->
      <div class="pt-1 border-t border-gray-100 flex items-center justify-between">
        <div>
          <span class="text-xs font-semibold text-gray-800 block">Status Kupon</span>
          <span class="text-[10.5px] text-gray-500 block">Apakah diskon ini langsung dapat digunakan di kasir?</span>
        </div>
        <button
          type="button"
          class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          :class="formIsActive ? 'bg-emerald-600' : 'bg-gray-300'"
          @click="formIsActive = !formIsActive"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="formIsActive ? 'translate-x-4' : 'translate-x-0'"
          />
        </button>
      </div>
    </div>
  </FormSidebarDrawer>
</template>
