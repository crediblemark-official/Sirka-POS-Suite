<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { Buyer, CustomerType } from '../../types';
import { useSettingsStore } from '../../stores/settingsStore';
import { X, Save, Plus, Edit2, Building, ShoppingBag, CreditCard } from 'lucide-vue-next';
import SearchableSelect, { type SelectOption } from '../common/SearchableSelect.vue';

const tierOptions: SelectOption[] = [
  { value: 'REGULAR', label: 'Regular (Default)', badge: '1x Poin' },
  { value: 'SILVER', label: 'Silver', badge: '1.2x Poin' },
  { value: 'GOLD', label: 'Gold', badge: '1.5x Poin' },
  { value: 'PLATINUM', label: 'Platinum', badge: '2x Poin' }
];

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    initialData?: Buyer | null;
    defaultCustomerType?: CustomerType;
  }>(),
  {
    defaultCustomerType: 'B2B'
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: Omit<Buyer, 'id'> | Buyer): void;
}>();

const settingsStore = useSettingsStore();
const isEditMode = computed(() => !!props.initialData?.id);

const form = ref<{
  id?: string;
  name: string;
  code: string;
  phone: string;
  address: string;
  customerType: CustomerType;
  hasMemberCard: boolean;
  memberCardNo: string;
  tier: 'REGULAR' | 'SILVER' | 'GOLD' | 'PLATINUM';
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

function handleKeyDown(e: KeyboardEvent) {
  if (!props.isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('close');
  }
}

watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
      if (props.initialData) {
        form.value = {
          id: props.initialData.id,
          name: props.initialData.name,
          code: props.initialData.code || '',
          phone: props.initialData.phone || '',
          address: props.initialData.address || '',
          customerType: props.initialData.customerType || props.defaultCustomerType || 'B2B',
          hasMemberCard: Boolean(props.initialData.memberCardNo),
          memberCardNo: props.initialData.memberCardNo || '',
          tier: props.initialData.tier || 'REGULAR',
          points: props.initialData.points || 0
        };
      } else {
        form.value = {
          name: '',
          code: '',
          phone: '',
          address: '',
          customerType: props.defaultCustomerType || 'B2B',
          hasMemberCard: false,
          memberCardNo: '',
          tier: 'REGULAR',
          points: 0
        };
      }
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});

function generateCardNumber() {
  const storeAbbr = settingsStore.storeCode || 'CITRA';
  const rand = Math.floor(1000 + Math.random() * 9000);
  const prefix = form.value.customerType === 'B2B' ? `${storeAbbr}-B2B` : storeAbbr;
  form.value.memberCardNo = `${prefix}-${rand}`;
  form.value.hasMemberCard = true;
}

function handleSubmit() {
  if (!form.value.name.trim()) return;

  const payload: any = {
    ...form.value,
    name: form.value.name.trim(),
    code: form.value.code ? form.value.code.trim().toUpperCase() : undefined,
    phone: form.value.phone ? form.value.phone.trim() : undefined,
    address: form.value.address ? form.value.address.trim() : undefined,
    memberCardNo: form.value.hasMemberCard ? (form.value.memberCardNo || undefined) : undefined,
    tier: form.value.hasMemberCard ? form.value.tier : 'REGULAR',
    points: form.value.hasMemberCard ? Number(form.value.points || 0) : 0
  };

  delete payload.hasMemberCard;

  emit('save', payload as Buyer);
  emit('close');
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 select-none text-xs"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl border border-gray-300 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <!-- Modal Header -->
      <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-sm text-gray-800">
        <div class="flex items-center gap-2">
          <component :is="isEditMode ? Edit2 : Plus" :size="16" :class="form.customerType === 'B2C' ? 'text-emerald-600' : 'text-blue-600'" />
          <span>{{ isEditMode ? (form.customerType === 'B2C' ? 'Edit Pelanggan Eceran' : 'Edit Pembeli Grosir (B2B)') : (form.customerType === 'B2C' ? 'Tambah Pelanggan Eceran Baru' : 'Tambah Pembeli Grosir (B2B) Baru') }}</span>
        </div>
        <button
          type="button"
          class="p-1 text-gray-400 hover:text-black rounded cursor-pointer transition-colors"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>
      </div>

      <!-- Form Body -->
      <form @submit.prevent="handleSubmit" class="p-4 space-y-3">
        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-1">Tipe Pasar / Segmen Pelanggan *</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded border text-xs font-bold cursor-pointer transition-all"
              :class="form.customerType === 'B2B' ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'"
              @click="form.customerType = 'B2B'"
            >
              <Building :size="13" />
              <span>🏢 B2B (Grosir)</span>
            </button>
            <button
              type="button"
              class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded border text-xs font-bold cursor-pointer transition-all"
              :class="form.customerType === 'B2C' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'"
              @click="form.customerType = 'B2C'"
            >
              <ShoppingBag :size="13" />
              <span>🛒 B2C (Eceran)</span>
            </button>
          </div>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-1">Nama Pembeli / Toko / Cabang *</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="Misal: Resto Padang Merdeka / Toko Bu Ani"
            required
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-bold"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">Kode Pelanggan</label>
            <input
              v-model="form.code"
              type="text"
              placeholder="Misal: CUST-01"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 uppercase font-mono"
            />
          </div>
          <div>
            <label class="text-[11px] font-semibold text-gray-600 block mb-1">No. WA / Telepon</label>
            <input
              v-model="form.phone"
              type="text"
              placeholder="0812..."
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        <div>
          <label class="text-[11px] font-semibold text-gray-600 block mb-1">Alamat Pengiriman</label>
          <input
            v-model="form.address"
            type="text"
            placeholder="Jl. Mawar No. 12"
            class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
          />
        </div>

        <!-- Membership / Loyalty Card Section -->
        <div class="p-2.5 bg-amber-50/60 border border-amber-200/80 rounded-lg space-y-2">
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-1.5 font-bold text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                v-model="form.hasMemberCard"
                class="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
              />
              <span class="flex items-center gap-1">
                <CreditCard :size="13" class="text-amber-600" />
                <span>Aktifkan Kartu Member / Loyalty</span>
              </span>
            </label>

            <button
              v-if="form.hasMemberCard && !form.memberCardNo"
              type="button"
              class="text-[10px] text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer"
              @click="generateCardNumber"
            >
              Generate Nomor
            </button>
          </div>

          <div v-if="form.hasMemberCard" class="space-y-2 pt-1 border-t border-amber-200/60">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] font-semibold text-amber-800 block mb-0.5">Nomor Kartu Member</label>
                <div class="flex gap-1">
                  <input
                    v-model="form.memberCardNo"
                    type="text"
                    :placeholder="`${settingsStore.storeCode}-...`"
                    class="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs font-mono font-bold uppercase outline-none focus:border-amber-600"
                  />
                  <button
                    type="button"
                    title="Buat Nomor Acak"
                    class="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-bold text-[10px] cursor-pointer"
                    @click="generateCardNumber"
                  >
                    🎲
                  </button>
                </div>
              </div>

              <div>
                <label class="text-[10px] font-semibold text-amber-800 block mb-0.5">Tier Member</label>
                <SearchableSelect
                  v-model="form.tier"
                  :options="tierOptions"
                  placeholder="Pilih Tier..."
                  search-placeholder="Cari tier..."
                  hotkey=""
                />
              </div>
            </div>

            <div>
              <label class="text-[10px] font-semibold text-amber-800 block mb-0.5">Poin Loyalitas Awal</label>
              <input
                v-model.number="form.points"
                type="number"
                min="0"
                class="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs font-mono font-bold outline-none focus:border-amber-600"
                placeholder="0"
              />
            </div>
          </div>
        </div>

        <div class="pt-2.5 flex items-center justify-end gap-2 border-t border-gray-200">
          <button
            type="button"
            class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs cursor-pointer transition-colors"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="submit"
            class="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
          >
            <Save :size="14" />
            <span>{{ isEditMode ? 'Simpan Perubahan' : 'Simpan Pelanggan' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
