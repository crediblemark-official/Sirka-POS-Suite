<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Buyer, MembershipTier, CustomerType } from '../../../types';
import { useBuyerStore } from '../../../stores/buyerStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { formatRupiah } from '../../../utils/formatters';
import { useConfirmDialog } from '../../../composables/useConfirmDialog';
import {
  CreditCard,
  Check,
  RefreshCw,
  Building,
  ShoppingBag,
  Coins,
  Trash2,
  Phone,
  MapPin,
  User,
  Lock,
  ShieldCheck
} from 'lucide-vue-next';

const props = defineProps<{
  buyer: Buyer;
}>();

const emit = defineEmits<{
  (e: 'saved', buyer: Buyer): void;
  (e: 'cancel'): void;
  (e: 'adjust-points', buyer: Buyer): void;
}>();

const buyerStore = useBuyerStore();
const settingsStore = useSettingsStore();

const computedTier = computed<MembershipTier>(() => {
  return buyerStore.computeTierFromSpend(props.buyer.totalSpend || 0);
});

const tierDiscountPercent = computed(() => {
  const t = computedTier.value;
  return buyerStore.loyaltySettings.tierDiscounts[t] || 0;
});

const editForm = ref({
  name: '',
  memberCardNo: '',
  customerType: 'B2B' as CustomerType,
  phone: '',
  address: ''
});

const isSaving = ref(false);

watch(
  // BUG FIX: `deep: true` membuat watcher ikut terpicu setiap kali objek buyer
  // berubah di store (mis. transaksi POS menambah poin) -> input yang sedang
  // diketik user (nama/alamat) TERHAPUS kembali ke nilai store.
  // Sekarang hanya perubahan ID buyer yang mengisi ulang form.
  () => props.buyer?.id,
  () => {
    const b = props.buyer;
    if (b) {
      editForm.value = {
        name: b.name || '',
        memberCardNo: b.memberCardNo || '',
        customerType: b.customerType || 'B2B',
        phone: b.phone || '',
        address: b.address || ''
      };
    }
  },
  { immediate: true }
);

function generateNewCardNumber(type: CustomerType = 'B2B') {
  // BUG FIX: nomor kartu sebelumnya acak 4 digit TANPA cek keunikan
  // (~1/9000 bentrok) -> dua anggota bisa punya kartu sama dan kasir yang
  // memindai akan menempelkan member yang SALAH (poin & tier ikut salah).
  // Sekarang memakai generator aman dari store (50 percobaan + fallback).
  return buyerStore.generateMemberCardNo(settingsStore.storeCode || 'CITRA', type);
}

function randomizeCardNumber() {
  editForm.value.memberCardNo = generateNewCardNumber(editForm.value.customerType);
}

async function handleSave() {
  if (!editForm.value.name.trim()) return;
  isSaving.value = true;
  try {
    const updatedBuyer: Buyer = {
      ...props.buyer,
      name: editForm.value.name.trim(),
      memberCardNo: editForm.value.memberCardNo.trim().toUpperCase() || undefined,
      // BUG FIX: tier sebelumnya ditulis ulang dari `totalSpend` setiap kali
      // disimpan. Begitu `totalSpend` sempat jadi 0 (mis. karena edit dari tab
      // Master Buyer), tier member GOLD/PLATINUM turun permanen ke REGULAR
      // hanya dengan menyimpan form yang tidak mengubah tier.
      // Sekarang tier tidak diubah dari form edit (diurus backend saat transaksi).
      tier: props.buyer.tier,
      customerType: editForm.value.customerType,
      phone: editForm.value.phone.trim() || undefined,
      address: editForm.value.address.trim() || undefined
    };

    await buyerStore.updateBuyer(updatedBuyer);
    emit('saved', updatedBuyer);
  } catch (err: any) {
    // BUG FIX: error hanya masuk console -> user tidak tahu perubahan gagal.
    console.error('Failed to update member:', err);
    alert(`Gagal menyimpan perubahan anggota: ${err?.message || err}`);
  } finally {
    isSaving.value = false;
  }
}

const { confirm: showConfirm } = useConfirmDialog();

async function handleRemoveCard() {
  const isConfirmed = await showConfirm({
    title: 'Cabut Nomor Kartu Member',
    message: `Yakin ingin mencabut nomor kartu member "${props.buyer.memberCardNo}" dari ${props.buyer.name}?`,
    details: 'Pelanggan akan kembali menjadi non-member dan tier kembali ke REGULAR.',
    confirmText: 'Ya, Cabut Kartu',
    cancelText: 'Batal',
    type: 'warning'
  });

  if (isConfirmed) {
    isSaving.value = true;
    try {
      const updatedBuyer: Buyer = {
        ...props.buyer,
        memberCardNo: undefined,
        tier: 'REGULAR'
      };
      await buyerStore.updateBuyer(updatedBuyer);
      emit('saved', updatedBuyer);
    } catch (err: any) {
      // BUG FIX: error hanya masuk console -> user tidak tahu bahwa aksi gagal.
      console.error('Failed to detach member card:', err);
      alert(`Gagal mencabut kartu member: ${err?.message || err}`);
    } finally {
      isSaving.value = false;
    }
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col justify-between overflow-hidden bg-white select-none text-xs">
    <!-- Form Body -->
    <div class="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
      <form id="member-edit-form" @submit.prevent="handleSave" class="space-y-3.5">
        <!-- 1. Nomor Kartu Member -->
        <div class="p-3 bg-amber-50/70 rounded border border-amber-200 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-bold text-amber-950 flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
              <CreditCard :size="13" class="text-amber-600" />
              <span>Nomor Kartu Member</span>
            </span>
            <button
              type="button"
              class="text-[10.5px] text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 cursor-pointer"
              @click="randomizeCardNumber"
            >
              <RefreshCw :size="11" />
              <span>Acak Nomor</span>
            </button>
          </div>

          <div class="relative">
            <input
              v-model="editForm.memberCardNo"
              type="text"
              class="w-full bg-white border border-amber-300 rounded px-2.5 py-1.5 pl-8 font-mono font-black text-xs text-slate-800 tracking-wider outline-none focus:border-amber-500 uppercase"
              :placeholder="`${settingsStore.storeCode}-XXXX`"
            />
            <CreditCard :size="14" class="absolute left-2.5 top-2 text-amber-600" />
          </div>
        </div>

        <!-- 2. Tingkatan Tier Member (Otomatis & Terkunci untuk Mencegah Kecurangan) -->
        <div class="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-bold text-gray-700 flex items-center gap-1.5 text-xs">
              <Lock :size="12" class="text-amber-600" />
              <span>Tingkatan Tier Loyalty</span>
            </span>
            <span
              class="px-2.5 py-0.5 rounded font-black text-[10.5px] tracking-wider uppercase font-mono shadow-2xs"
              :class="{
                'bg-slate-900 text-white': computedTier === 'REGULAR',
                'bg-blue-700 text-white': computedTier === 'SILVER',
                'bg-amber-500 text-slate-950': computedTier === 'GOLD',
                'bg-purple-800 text-white': computedTier === 'PLATINUM'
              }"
            >
              {{ computedTier }}
            </span>
          </div>

          <!-- Rincian Status Belanja & Diskon Otomatis -->
          <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/80 text-[11px] font-mono">
            <div>
              <span class="text-gray-500 block text-[10px]">Total Belanja Akumulasi:</span>
              <span class="font-bold text-slate-900">Rp {{ formatRupiah(props.buyer.totalSpend || 0) }}</span>
            </div>
            <div>
              <span class="text-gray-500 block text-[10px]">Hak Diskon Member:</span>
              <span class="font-bold text-emerald-700">{{ tierDiscountPercent }}% per Transaksi</span>
            </div>
          </div>

          <div class="pt-1 border-t border-dashed border-slate-200 text-[10px] text-gray-500 flex items-center gap-1">
            <ShieldCheck :size="12" class="text-emerald-600 shrink-0" />
            <span>Tier ditentukan otomatis oleh sistem akumulasi belanja untuk mencegah manipulasi data.</span>
          </div>
        </div>

        <!-- 3. Nama Pelanggan -->
        <div>
          <label class="font-semibold text-gray-700 block mb-1">Nama Member / Pelanggan <span class="text-rose-500">*</span></label>
          <div class="relative">
            <input
              v-model="editForm.name"
              type="text"
              required
              class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 pl-8 text-xs font-bold outline-none focus:border-amber-500"
              placeholder="Nama pelanggan..."
            />
            <User :size="13" class="absolute left-2.5 top-2 text-gray-400" />
          </div>
        </div>

        <!-- 4. Tipe Pasar & Kontak -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="font-semibold text-gray-700 block mb-1">Tipe Pasar</label>
            <div class="flex rounded border border-gray-300 overflow-hidden">
              <button
                type="button"
                class="flex-1 py-1 text-center font-bold text-[10.5px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                :class="editForm.customerType === 'B2B' ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-600'"
                @click="editForm.customerType = 'B2B'"
              >
                <Building :size="11" />
                <span>B2B</span>
              </button>
              <button
                type="button"
                class="flex-1 py-1 text-center font-bold text-[10.5px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                :class="editForm.customerType === 'B2C' ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600'"
                @click="editForm.customerType = 'B2C'"
              >
                <ShoppingBag :size="11" />
                <span>B2C</span>
              </button>
            </div>
          </div>

          <div>
            <label class="font-semibold text-gray-700 block mb-1">No. WhatsApp / HP</label>
            <div class="relative">
              <input
                v-model="editForm.phone"
                type="text"
                class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 pl-7 text-xs font-mono outline-none focus:border-amber-500"
                placeholder="0812xxxxxxx"
              />
              <Phone :size="12" class="absolute left-2 top-2 text-gray-400" />
            </div>
          </div>
        </div>

        <!-- 5. Alamat -->
        <div>
          <label class="font-semibold text-gray-700 block mb-1">Alamat Pelanggan</label>
          <div class="relative">
            <input
              v-model="editForm.address"
              type="text"
              class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 pl-7 text-xs outline-none focus:border-amber-500"
              placeholder="Alamat toko / rumah..."
            />
            <MapPin :size="12" class="absolute left-2 top-2 text-gray-400" />
          </div>
        </div>

        <!-- 6. Saldo Poin & Penyesuaian Cepat -->
        <div class="p-2.5 bg-gray-50 rounded border border-gray-200 flex items-center justify-between">
          <div>
            <span class="text-gray-500 block text-[10px]">Saldo Poin Member:</span>
            <span class="font-mono font-black text-amber-700 text-sm">
              {{ (props.buyer.points || 0).toLocaleString('id-ID') }} Pts
            </span>
          </div>
          <button
            type="button"
            class="flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded font-semibold text-[11px] cursor-pointer shadow-2xs transition-colors"
            @click="emit('adjust-points', props.buyer)"
          >
            <Coins :size="12" class="text-amber-700" />
            <span>Atur Poin</span>
          </button>
        </div>
      </form>
    </div>

    <!-- Sticky Footer Actions -->
    <div class="p-2.5 bg-white border-t border-gray-200 shrink-0 space-y-2">
      <div class="flex items-center gap-2">
        <button
          v-if="props.buyer.memberCardNo"
          type="button"
          class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-semibold text-xs cursor-pointer transition-colors flex items-center gap-1 shrink-0"
          title="Cabut status kartu member pelanggan ini"
          @click="handleRemoveCard"
        >
          <Trash2 :size="12" />
          <span>Cabut Kartu</span>
        </button>

        <button
          type="button"
          class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-xs cursor-pointer transition-colors ml-auto"
          @click="emit('cancel')"
        >
          Batal
        </button>

        <button
          type="submit"
          form="member-edit-form"
          :disabled="isSaving || !editForm.name.trim()"
          class="flex items-center justify-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold text-xs cursor-pointer transition-all shadow-2xs active:scale-95 disabled:opacity-50"
        >
          <Check :size="13" />
          <span>{{ isSaving ? 'Menyimpan...' : 'Simpan Perubahan' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
