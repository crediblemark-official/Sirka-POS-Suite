<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Buyer, MembershipTier, CustomerType } from '../../../types';
import { useBuyerStore } from '../../../stores/buyerStore';
import { useSettingsStore } from '../../../stores/settingsStore';
import { localTodayStr } from '../../../utils/formatters';
import {
  CreditCard,
  Check,
  UserPlus,
  RefreshCw,
  Building,
  ShoppingBag,
  UserCheck,
  AlertCircle,
  Lock,
  ShieldCheck
} from 'lucide-vue-next';
import SearchableSelect, { type SelectOption } from '../../common/SearchableSelect.vue';

const props = defineProps<{
  initialBuyerId?: string;
}>();

const emit = defineEmits<{
  (e: 'registered', buyer: Buyer): void;
  (e: 'cancel'): void;
}>();

const buyerStore = useBuyerStore();
const settingsStore = useSettingsStore();

const registerMode = ref<'EXISTING' | 'NEW'>('EXISTING');
const selectedExistingBuyerId = ref('');
const isSavingMember = ref(false);

const selectedExistingBuyer = computed(() => {
  return buyerStore.buyers.find(b => b.id === selectedExistingBuyerId.value);
});

const initialCalculatedTier = computed<MembershipTier>(() => {
  if (registerMode.value === 'EXISTING' && selectedExistingBuyer.value) {
    return buyerStore.computeTierFromSpend(selectedExistingBuyer.value.totalSpend || 0);
  }
  return 'REGULAR';
});

const nonMemberBuyers = computed(() => {
  return buyerStore.buyers.filter(b => !b.memberCardNo);
});

const nonMemberOptions = computed<SelectOption[]>(() => {
  return nonMemberBuyers.value.map(b => ({
    value: b.id,
    label: b.name,
    code: b.code || undefined,
    sublabel: `${b.customerType === 'B2B' ? 'Grosir (B2B)' : 'Eceran (B2C)'} • Telp: ${b.phone || '-'} • ${b.address || '-'}`,
    badge: b.customerType === 'B2B' ? 'B2B' : 'B2C'
  }));
});

const newMemberForm = ref({
  name: '',
  code: '',
  phone: '',
  address: '',
  customerType: 'B2B' as CustomerType,
  memberCardNo: '',
  tier: 'REGULAR' as MembershipTier,
  initialPoints: 10
});

function generateNewCardNumber(type: CustomerType = 'B2B') {
  // BUG FIX: nomor kartu sebelumnya acak 4 digit TANPA cek keunikan
  // (~1/9000 bentrok) -> dua anggota bisa punya kartu sama dan kasir yang
  // memindai akan menempelkan member yang SALAH (poin & tier ikut salah).
  // Sekarang memakai generator aman dari store (50 percobaan + fallback).
  return buyerStore.generateMemberCardNo(settingsStore.storeCode || 'SIRKA', type);
}

function randomizeCardNumber() {
  newMemberForm.value.memberCardNo = generateNewCardNumber(newMemberForm.value.customerType);
}

function onSelectExistingBuyer(buyerId: string) {
  selectedExistingBuyerId.value = buyerId;
  const buyer = buyerStore.buyers.find(b => b.id === buyerId);
  if (buyer) {
    newMemberForm.value.customerType = buyer.customerType || 'B2B';
    newMemberForm.value.name = buyer.name;
    newMemberForm.value.phone = buyer.phone || '';
    newMemberForm.value.address = buyer.address || '';
    newMemberForm.value.memberCardNo = generateNewCardNumber(buyer.customerType || 'B2B');
  }
}

watch(
  // BUG FIX: watcher ini hanya merespons `initialBuyerId`. Karena `buyers`
  // diisi ASYNCHRONOUSLY oleh `fetchBuyers()`, saat form dibuka pertama kali
  // datanya belum ada -> form tampil KOSONG (mode EXISTING tapi tanpa isi),
  // atau mode "Pelanggan Baru" padahal sebegitu ada 12 non-member.
  // Sekarang juga memantau jumlah buyer, sehingga form dievaluasi ulang setelah
  // data master selesai dimuat.
  () => [props.initialBuyerId, buyerStore.buyers.length],
  ([id]) => {
    if (id) {
      registerMode.value = 'EXISTING';
      onSelectExistingBuyer(String(id));
    } else if (nonMemberBuyers.value.length > 0) {
      registerMode.value = 'EXISTING';
      onSelectExistingBuyer(nonMemberBuyers.value[0].id);
    } else if (buyerStore.buyers.length > 0) {
      // Data sudah dimuat tapi tidak ada non-member -> tetap mode baru
      registerMode.value = 'NEW';
      newMemberForm.value = {
        name: '',
        code: '',
        phone: '',
        address: '',
        customerType: 'B2B',
        memberCardNo: generateNewCardNumber('B2B'),
        tier: 'REGULAR',
        initialPoints: 10
      };
    }
  },
  { immediate: true }
);

async function handleSaveRegisterMember() {
  isSavingMember.value = true;
  try {
    let targetBuyer: Buyer | undefined;

    if (registerMode.value === 'EXISTING') {
      const existing = buyerStore.buyers.find(b => b.id === selectedExistingBuyerId.value);
      if (!existing) return;

      const cardNo = newMemberForm.value.memberCardNo.trim().toUpperCase() || generateNewCardNumber(existing.customerType || 'B2B');
      existing.memberCardNo = cardNo;
      existing.tier = initialCalculatedTier.value;
      existing.points = (existing.points || 0) + (Number(newMemberForm.value.initialPoints) || 0);
      existing.memberSince = localTodayStr();

      await buyerStore.updateBuyer(existing);
      targetBuyer = existing;
    } else {
      if (!newMemberForm.value.name.trim()) return;

      const cardNo = newMemberForm.value.memberCardNo.trim().toUpperCase() || generateNewCardNumber(newMemberForm.value.customerType);
      const created = await buyerStore.addBuyer(
        newMemberForm.value.name,
        newMemberForm.value.code || undefined,
        newMemberForm.value.phone || undefined,
        newMemberForm.value.address || undefined,
        newMemberForm.value.customerType,
        cardNo,
        'REGULAR',
        Number(newMemberForm.value.initialPoints) || 0
      );
      targetBuyer = created;
    }

    if (targetBuyer) {
      emit('registered', targetBuyer);
    }
  } catch (err: any) {
    // BUG FIX: error hanya dicetak ke console sehingga user menekan
    // "Terbitkan Kartu Member" dan TIDAK terjadi apa-apa secara visual.
    console.error('Failed to register member:', err);
    alert(`Gagal menyimpan anggota: ${err?.message || err}`);
  } finally {
    isSavingMember.value = false;
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col justify-between overflow-hidden bg-white">
    <div class="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
      <!-- Mode Switcher Tabs -->
      <div class="flex rounded-md bg-gray-200 p-0.5">
        <button
          type="button"
          class="flex-1 py-1.5 px-2 rounded font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
          :class="registerMode === 'EXISTING' ? 'bg-white text-slate-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'"
          @click="registerMode = 'EXISTING'"
        >
          <UserCheck :size="12" />
          <span>Dari Pelanggan Ada ({{ nonMemberBuyers.length }})</span>
        </button>
        <button
          type="button"
          class="flex-1 py-1.5 px-2 rounded font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
          :class="registerMode === 'NEW' ? 'bg-white text-slate-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'"
          @click="registerMode = 'NEW'"
        >
          <UserPlus :size="12" />
          <span>Pelanggan Baru</span>
        </button>
      </div>

      <form id="member-register-form" @submit.prevent="handleSaveRegisterMember" class="space-y-3.5">
        <!-- Mode 1: Upgrade existing buyer -->
        <div v-if="registerMode === 'EXISTING'" class="space-y-3">
          <div v-if="nonMemberBuyers.length === 0" class="p-3 rounded bg-amber-50 border border-amber-200 text-amber-900 text-center space-y-2">
            <AlertCircle :size="20" class="mx-auto text-amber-600" />
            <p class="font-semibold text-xs leading-tight">Semua pelanggan saat ini sudah memiliki kartu member.</p>
            <button
              type="button"
              class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs cursor-pointer inline-flex items-center gap-1"
              @click="registerMode = 'NEW'"
            >
              <UserPlus :size="11" />
              <span>Daftarkan Pelanggan Baru</span>
            </button>
          </div>

          <div v-else>
            <label class="font-semibold text-gray-700 block mb-1">Pilih Pelanggan Non-Member <span class="text-rose-500">*</span></label>
            <SearchableSelect
              :model-value="selectedExistingBuyerId"
              :options="nonMemberOptions"
              placeholder="-- Cari pelanggan non-member --"
              search-placeholder="Ketik nama, telepon, atau alamat..."
              @update:model-value="onSelectExistingBuyer(String($event))"
            />
          </div>
        </div>

        <!-- Mode 2: Brand-new customer -->
        <div v-else class="space-y-3">
          <div>
            <label class="font-semibold text-gray-700 block mb-1">Nama Lengkap / Instansi <span class="text-rose-500">*</span></label>
            <input
              v-model="newMemberForm.name"
              type="text"
              required
              class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs font-bold outline-none focus:border-amber-500"
              placeholder="Contoh: Toko Citra Abadi / Ibu Ratna"
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-semibold text-gray-700 block mb-1">Tipe Pelanggan</label>
              <div class="flex rounded border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  class="flex-1 py-1 text-center font-bold text-[10.5px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                  :class="newMemberForm.customerType === 'B2B' ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-600'"
                  @click="newMemberForm.customerType = 'B2B'; randomizeCardNumber()"
                >
                  <Building :size="11" />
                  <span>B2B</span>
                </button>
                <button
                  type="button"
                  class="flex-1 py-1 text-center font-bold text-[10.5px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                  :class="newMemberForm.customerType === 'B2C' ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600'"
                  @click="newMemberForm.customerType = 'B2C'; randomizeCardNumber()"
                >
                  <ShoppingBag :size="11" />
                  <span>B2C</span>
                </button>
              </div>
            </div>

            <div>
              <label class="font-semibold text-gray-700 block mb-1">No. WhatsApp / HP</label>
              <input
                v-model="newMemberForm.phone"
                type="text"
                class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs font-mono outline-none focus:border-amber-500"
                placeholder="0812xxxxxxx"
              />
            </div>
          </div>

          <div>
            <label class="font-semibold text-gray-700 block mb-1">Alamat (Opsional)</label>
            <input
              v-model="newMemberForm.address"
              type="text"
              class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-amber-500"
              placeholder="Jl. Raya Banjarsari No. 12"
            />
          </div>
        </div>

        <!-- Member Card & Loyalty Details -->
        <div class="pt-3 border-t border-gray-200 space-y-3">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-semibold text-gray-700 block">Nomor Kartu Member <span class="text-rose-500">*</span></label>
              <button
                type="button"
                class="text-[11px] text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 cursor-pointer"
                @click="randomizeCardNumber"
              >
                <RefreshCw :size="11" />
                <span>Acak Nomor</span>
              </button>
            </div>
            <div class="relative">
              <input
                v-model="newMemberForm.memberCardNo"
                type="text"
                required
                class="w-full bg-slate-50 border border-gray-300 rounded px-2.5 py-1.5 pl-8 font-mono font-black text-xs text-slate-800 tracking-wider outline-none focus:bg-white focus:border-amber-500 uppercase"
                :placeholder="`${settingsStore.storeCode}-XXXX`"
              />
              <CreditCard :size="14" class="absolute left-2.5 top-2 text-amber-600" />
            </div>
          </div>

          <!-- Tier Otomatis Terkunci (Anti-Kecurangan) -->
          <div class="p-2.5 bg-slate-50 rounded border border-slate-200 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-bold text-gray-700 flex items-center gap-1.5 text-xs">
                <Lock :size="12" class="text-amber-600" />
                <span>Tier Loyalty Awal</span>
              </span>
              <span
                class="px-2 py-0.5 rounded font-black text-[10px] tracking-wider uppercase font-mono shadow-2xs"
                :class="{
                  'bg-slate-900 text-white': initialCalculatedTier === 'REGULAR',
                  'bg-blue-700 text-white': initialCalculatedTier === 'SILVER',
                  'bg-amber-500 text-slate-950': initialCalculatedTier === 'GOLD',
                  'bg-purple-800 text-white': initialCalculatedTier === 'PLATINUM'
                }"
              >
                {{ initialCalculatedTier }}
              </span>
            </div>
            <p class="text-[10px] text-gray-500 italic flex items-center gap-1">
              <ShieldCheck :size="11" class="text-emerald-600 shrink-0" />
              <span>Ditentukan otomatis dari riwayat belanja & aturan loyalitas toko.</span>
            </p>
          </div>

          <!-- Initial Points -->
          <div>
            <label class="font-semibold text-gray-700 block mb-1">Bonus Poin Pendaftaran Awal</label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="newMemberForm.initialPoints"
                type="number"
                min="0"
                class="w-24 bg-white border border-gray-300 rounded px-2 py-1 font-mono font-bold text-xs outline-none focus:border-amber-500"
              />
              <span class="text-gray-500 text-xs">Poin reward sambutan</span>
            </div>
          </div>
        </div>
      </form>
    </div>

    <!-- Sticky Footer Submit Button -->
    <div
      class="p-4 pt-3 pb-8 sm:pb-3 bg-white border-t border-gray-200 shrink-0 pb-safe"
      style="padding-bottom: max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1rem));"
    >
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs cursor-pointer transition-colors active:scale-95"
          @click="emit('cancel')"
        >
          Batal
        </button>
        <button
          type="submit"
          form="member-register-form"
          :disabled="isSavingMember || (registerMode === 'EXISTING' && !selectedExistingBuyerId)"
          class="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs cursor-pointer transition-all shadow-md active:scale-95 disabled:opacity-50"
        >
          <Check :size="15" />
          <span>{{ isSavingMember ? 'Menyimpan...' : 'Terbitkan Kartu Member' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
