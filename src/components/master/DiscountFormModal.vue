<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { Discount, DiscountType, DiscountScope, CustomerType } from '../../types';
import { useInventoryStore } from '../../stores/inventoryStore';
import { Tag, X, Check, Percent, DollarSign } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  discountToEdit?: Discount | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', discount: Omit<Discount, 'id'> | Discount): void;
}>();

const inventoryStore = useInventoryStore();

const isEditing = computed(() => Boolean(props.discountToEdit?.id));

const code = ref('');
const name = ref('');
const type = ref<DiscountType>('PERCENT');
const value = ref<number>(10);
const minPurchase = ref<number>(0);
const maxDiscount = ref<number | undefined>(undefined);
const scope = ref<DiscountScope>('ALL');
const targetCategory = ref<string>('');
const targetCustomerType = ref<CustomerType>('B2B');
const isActive = ref<boolean>(true);
const description = ref('');

const categories = computed(() => inventoryStore.categoryMarkups.map(c => c.category));

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      if (props.discountToEdit) {
        code.value = props.discountToEdit.code;
        name.value = props.discountToEdit.name;
        type.value = props.discountToEdit.type;
        value.value = props.discountToEdit.value;
        minPurchase.value = props.discountToEdit.minPurchase || 0;
        maxDiscount.value = props.discountToEdit.maxDiscount;
        scope.value = props.discountToEdit.scope || 'ALL';
        targetCategory.value = props.discountToEdit.targetCategory || '';
        targetCustomerType.value = props.discountToEdit.targetCustomerType || 'B2B';
        isActive.value = props.discountToEdit.isActive ?? true;
        description.value = props.discountToEdit.description || '';
      } else {
        code.value = '';
        name.value = '';
        type.value = 'PERCENT';
        value.value = 5;
        minPurchase.value = 0;
        maxDiscount.value = undefined;
        scope.value = 'ALL';
        targetCategory.value = categories.value[0] || '';
        targetCustomerType.value = 'B2B';
        isActive.value = true;
        description.value = '';
      }
    }
  },
  { immediate: true }
);

function handleSubmit() {
  if (!code.value.trim() || !name.value.trim()) return;

  const payload: Omit<Discount, 'id'> | Discount = {
    ...(props.discountToEdit ? { id: props.discountToEdit.id } : {}),
    code: code.value.trim().toUpperCase(),
    name: name.value.trim(),
    type: type.value,
    value: Number(value.value) || 0,
    minPurchase: Number(minPurchase.value) || 0,
    maxDiscount: type.value === 'PERCENT' && maxDiscount.value ? Number(maxDiscount.value) : undefined,
    scope: scope.value,
    targetCategory: scope.value === 'CATEGORY' ? targetCategory.value : undefined,
    targetCustomerType: scope.value === 'CUSTOMER_TYPE' ? targetCustomerType.value : undefined,
    isActive: isActive.value,
    description: description.value.trim() || undefined,
  };

  emit('save', payload);
  emit('close');
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none text-xs"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <!-- Modal Header -->
      <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-gray-800">
        <div class="flex items-center gap-2 text-sm">
          <Tag :size="17" class="text-rose-600" />
          <span>{{ isEditing ? 'Edit Kupon Diskon' : 'Tambah Promo / Diskon Baru' }}</span>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-black rounded cursor-pointer"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleSubmit" class="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="font-semibold text-gray-700 block mb-1">Kode Promo / Kupon *</label>
            <input
              v-model="code"
              type="text"
              required
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 font-mono font-bold uppercase text-rose-700 focus:bg-white focus:border-rose-500 outline-none"
              placeholder="MISAL: HEMAT10K"
            />
          </div>
          <div>
            <label class="font-semibold text-gray-700 block mb-1">Tipe Diskon *</label>
            <div class="flex rounded border border-gray-300 overflow-hidden">
              <button
                type="button"
                class="flex-1 py-1.5 text-center font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                :class="type === 'PERCENT' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                @click="type = 'PERCENT'"
              >
                <Percent :size="12" />
                <span>Persen (%)</span>
              </button>
              <button
                type="button"
                class="flex-1 py-1.5 text-center font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                :class="type === 'FIXED' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
                @click="type = 'FIXED'"
              >
                <DollarSign :size="12" />
                <span>Nominal (Rp)</span>
              </button>
            </div>
          </div>
        </div>

        <div>
          <label class="font-semibold text-gray-700 block mb-1">Nama Promo *</label>
          <input
            v-model="name"
            type="text"
            required
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 focus:bg-white focus:border-rose-500 outline-none font-medium"
            placeholder="Misal: Diskon Promo Gajian Akhir Pekan"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="font-semibold text-gray-700 block mb-1">
              {{ type === 'PERCENT' ? 'Besar Diskon (%) *' : 'Potongan Nominal (Rp) *' }}
            </label>
            <div class="relative">
              <input
                v-model.number="value"
                type="number"
                min="0"
                step="any"
                required
                class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 font-mono font-bold focus:bg-white focus:border-rose-500 outline-none pr-8"
              />
              <span class="absolute right-2.5 top-1.5 text-gray-400 font-bold">
                {{ type === 'PERCENT' ? '%' : 'Rp' }}
              </span>
            </div>
          </div>

          <div>
            <label class="font-semibold text-gray-700 block mb-1">Minimal Belanja (Rp)</label>
            <input
              v-model.number="minPurchase"
              type="number"
              min="0"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 font-mono focus:bg-white focus:border-rose-500 outline-none"
              placeholder="0 (Tanpa Minimal)"
            />
          </div>
        </div>

        <div v-if="type === 'PERCENT'">
          <label class="font-semibold text-gray-700 block mb-1">Maksimal Potongan Diskon (Rp, Opsional)</label>
          <input
            v-model.number="maxDiscount"
            type="number"
            min="0"
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 font-mono focus:bg-white focus:border-rose-500 outline-none"
            placeholder="Kosongkan jika tanpa batas"
          />
        </div>

        <div>
          <label class="font-semibold text-gray-700 block mb-1">Target / Berlaku Untuk</label>
          <select
            v-model="scope"
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 focus:bg-white focus:border-rose-500 outline-none"
          >
            <option value="ALL">Semua Transaksi & Pelanggan</option>
            <option value="MEMBER_ONLY">Khusus Pemegang Kartu Member</option>
            <option value="CUSTOMER_TYPE">Khusus Tipe Pelanggan (Grosir/Eceran)</option>
            <option value="CATEGORY">Khusus Kategori Produk Tertentu</option>
          </select>
        </div>

        <div v-if="scope === 'CUSTOMER_TYPE'">
          <label class="font-semibold text-gray-700 block mb-1">Tipe Pelanggan Target</label>
          <select
            v-model="targetCustomerType"
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 focus:bg-white focus:border-rose-500 outline-none"
          >
            <option value="B2B">Grosir / B2B</option>
            <option value="B2C">Eceran / Retail (B2C)</option>
          </select>
        </div>

        <div v-if="scope === 'CATEGORY'">
          <label class="font-semibold text-gray-700 block mb-1">Pilih Kategori Target</label>
          <select
            v-model="targetCategory"
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 focus:bg-white focus:border-rose-500 outline-none"
          >
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <div>
          <label class="font-semibold text-gray-700 block mb-1">Catatan / Deskripsi Promo</label>
          <textarea
            v-model="description"
            rows="2"
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 focus:bg-white focus:border-rose-500 outline-none resize-none"
            placeholder="Syarat & ketentuan promo..."
          ></textarea>
        </div>

        <div class="flex items-center gap-2 pt-1">
          <input
            id="modal-active-checkbox"
            v-model="isActive"
            type="checkbox"
            class="w-4 h-4 text-rose-600 rounded border-gray-300 focus:ring-rose-500 cursor-pointer"
          />
          <label for="modal-active-checkbox" class="font-medium text-gray-700 cursor-pointer">
            Promo Aktif dan dapat digunakan di kasir
          </label>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
          <button
            type="button"
            class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold cursor-pointer"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="submit"
            class="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded font-bold cursor-pointer shadow-xs"
          >
            <Check :size="14" />
            <span>{{ isEditing ? 'Simpan Perubahan' : 'Buat Promo' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
