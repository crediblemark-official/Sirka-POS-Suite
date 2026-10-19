<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Buyer, MembershipTier, CustomerType } from '../../../types';
import { useBuyerStore } from '../../../stores/buyerStore';
import {
  CreditCard,
  Check,
  X,
  UserPlus,
  RefreshCw,
  Building,
  ShoppingBag,
  UserCheck,
  AlertCircle
} from 'lucide-vue-next';
import SearchableSelect, { type SelectOption } from '../../common/SearchableSelect.vue';

const props = defineProps<{
  isOpen: boolean;
  initialBuyerId?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'registered', buyer: Buyer): void;
}>();

const buyerStore = useBuyerStore();

const registerMode = ref<'EXISTING' | 'NEW'>('EXISTING');
const selectedExistingBuyerId = ref('');
const isSavingMember = ref(false);

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
  const rand = Math.floor(1000 + Math.random() * 9000);
  const prefix = type === 'B2B' ? 'MBR-B2B' : 'MBR-CITRA';
  return `${prefix}-${rand}`;
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
  () => props.isOpen,
  (open) => {
    if (open) {
      if (props.initialBuyerId) {
        registerMode.value = 'EXISTING';
        onSelectExistingBuyer(props.initialBuyerId);
      } else if (nonMemberBuyers.value.length > 0) {
        registerMode.value = 'EXISTING';
        onSelectExistingBuyer(nonMemberBuyers.value[0].id);
      } else {
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
    }
  }
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
      existing.tier = newMemberForm.value.tier;
      existing.points = (existing.points || 0) + (Number(newMemberForm.value.initialPoints) || 0);
      existing.memberSince = new Date().toISOString().slice(0, 10);

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
        newMemberForm.value.tier,
        Number(newMemberForm.value.initialPoints) || 0
      );
      targetBuyer = created;
    }

    if (targetBuyer) {
      emit('registered', targetBuyer);
    }
    emit('close');
  } catch (err) {
    console.error('Failed to register member:', err);
  } finally {
    isSavingMember.value = false;
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none text-xs"
    @click.self="emit('close')"
  >
    <div class="bg-white rounded-xl shadow-2xl border border-gray-300 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <!-- Header -->
      <div class="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UserCheck :size="18" class="text-amber-400" />
          <div>
            <h3 class="font-bold text-sm tracking-tight">Daftarkan Kartu Member Pelanggan</h3>
            <p class="text-[11px] text-indigo-200">Terbitkan nomor kartu member fisik/digital dan poin loyalitas</p>
          </div>
        </div>
        <button type="button" class="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer" @click="emit('close')">
          <X :size="18" />
        </button>
      </div>

      <!-- Mode Switcher Tabs -->
      <div class="p-4 pb-0 bg-gray-50 border-b border-gray-200">
        <div class="flex rounded-lg bg-gray-200 p-1">
          <button
            type="button"
            class="flex-1 py-1.5 px-2 rounded-md font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            :class="registerMode === 'EXISTING' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
            @click="registerMode = 'EXISTING'"
          >
            <UserCheck :size="13" />
            <span>Dari Pelanggan Ada ({{ nonMemberBuyers.length }})</span>
          </button>
          <button
            type="button"
            class="flex-1 py-1.5 px-2 rounded-md font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            :class="registerMode === 'NEW' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'"
            @click="registerMode = 'NEW'"
          >
            <UserPlus :size="13" />
            <span>Pelanggan Baru</span>
          </button>
        </div>
      </div>

      <form @submit.prevent="handleSaveRegisterMember" class="p-5 space-y-4">
        <!-- Mode 1: Upgrade existing buyer -->
        <div v-if="registerMode === 'EXISTING'" class="space-y-3.5">
          <div v-if="nonMemberBuyers.length === 0" class="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-center space-y-2">
            <AlertCircle :size="24" class="mx-auto text-amber-600" />
            <p class="font-semibold text-xs">Semua pelanggan terdaftar saat ini sudah memiliki kartu member.</p>
            <button
              type="button"
              class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-xs cursor-pointer inline-flex items-center gap-1"
              @click="registerMode = 'NEW'"
            >
              <UserPlus :size="12" />
              <span>Buat Pelanggan Baru Langsung Jadi Member</span>
            </button>
          </div>

          <div v-else>
            <label class="font-semibold text-gray-700 block mb-1">Pilih Pelanggan Non-Member <span class="text-rose-500">*</span></label>
            <SearchableSelect
              :model-value="selectedExistingBuyerId"
              :options="nonMemberOptions"
              placeholder="-- Cari nama / telepon pelanggan non-member --"
              search-placeholder="Ketik nama, telepon, atau alamat..."
              hotkey=""
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
              class="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-amber-500"
              placeholder="Contoh: Toko Citra Abadi / Ibu Ratna"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="font-semibold text-gray-700 block mb-1">Tipe Pelanggan</label>
              <div class="flex rounded-lg border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  class="flex-1 py-1.5 text-center font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                  :class="newMemberForm.customerType === 'B2B' ? 'bg-indigo-900 text-white' : 'bg-gray-100 text-gray-600'"
                  @click="newMemberForm.customerType = 'B2B'; randomizeCardNumber()"
                >
                  <Building :size="12" />
                  <span>Grosir B2B</span>
                </button>
                <button
                  type="button"
                  class="flex-1 py-1.5 text-center font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1"
                  :class="newMemberForm.customerType === 'B2C' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'"
                  @click="newMemberForm.customerType = 'B2C'; randomizeCardNumber()"
                >
                  <ShoppingBag :size="12" />
                  <span>Eceran B2C</span>
                </button>
              </div>
            </div>

            <div>
              <label class="font-semibold text-gray-700 block mb-1">No. WhatsApp / HP</label>
              <input
                v-model="newMemberForm.phone"
                type="text"
                class="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-amber-500"
                placeholder="0812xxxxxxx"
              />
            </div>
          </div>

          <div>
            <label class="font-semibold text-gray-700 block mb-1">Alamat (Opsional)</label>
            <input
              v-model="newMemberForm.address"
              type="text"
              class="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-amber-500"
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
                class="w-full bg-slate-50 border border-gray-300 rounded-lg px-3 py-2 pl-9 font-mono font-black text-xs text-slate-800 tracking-wider outline-none focus:bg-white focus:border-amber-500 uppercase"
                placeholder="MBR-CITRA-XXXX"
              />
              <CreditCard :size="15" class="absolute left-3 top-2.5 text-amber-600" />
            </div>
          </div>

          <!-- Tier Selection -->
          <div>
            <label class="font-semibold text-gray-700 block mb-1.5">Tingkatan Tier Awal</label>
            <div class="grid grid-cols-4 gap-2">
              <button
                type="button"
                class="py-2 px-1 rounded-lg border text-center font-bold text-xs transition-all cursor-pointer"
                :class="newMemberForm.tier === 'REGULAR' ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50'"
                @click="newMemberForm.tier = 'REGULAR'"
              >
                Regular
              </button>
              <button
                type="button"
                class="py-2 px-1 rounded-lg border text-center font-bold text-xs transition-all cursor-pointer"
                :class="newMemberForm.tier === 'SILVER' ? 'bg-blue-700 text-white border-blue-700 shadow-xs' : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50'"
                @click="newMemberForm.tier = 'SILVER'"
              >
                Silver
              </button>
              <button
                type="button"
                class="py-2 px-1 rounded-lg border text-center font-bold text-xs transition-all cursor-pointer"
                :class="newMemberForm.tier === 'GOLD' ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs' : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50'"
                @click="newMemberForm.tier = 'GOLD'"
              >
                Gold
              </button>
              <button
                type="button"
                class="py-2 px-1 rounded-lg border text-center font-bold text-xs transition-all cursor-pointer"
                :class="newMemberForm.tier === 'PLATINUM' ? 'bg-purple-800 text-white border-purple-800 shadow-xs' : 'bg-white text-slate-700 border-gray-300 hover:bg-gray-50'"
                @click="newMemberForm.tier = 'PLATINUM'"
              >
                Platinum
              </button>
            </div>
          </div>

          <!-- Initial Points -->
          <div>
            <label class="font-semibold text-gray-700 block mb-1">Bonus Poin Pendaftaran Awal</label>
            <div class="flex items-center gap-2">
              <input
                v-model.number="newMemberForm.initialPoints"
                type="number"
                min="0"
                class="w-32 bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-mono font-bold text-xs outline-none focus:border-amber-500"
              />
              <span class="text-gray-500 text-xs">Poin reward selamat datang</span>
            </div>
          </div>
        </div>

        <!-- Submit Buttons -->
        <div class="pt-3 border-t border-gray-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold cursor-pointer transition-colors"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="submit"
            :disabled="isSavingMember"
            class="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold cursor-pointer transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check :size="14" />
            <span>{{ isSavingMember ? 'Menyimpan...' : 'Terbitkan Kartu Member' }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
