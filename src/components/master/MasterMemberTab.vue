<script setup lang="ts">
import { ref, computed } from 'vue';
import { Buyer, MembershipTier, CustomerType } from '../../types';
import { useBuyerStore } from '../../stores/buyerStore';
import { formatRupiah } from '../../utils/formatters';
import {
  CreditCard,
  Award,
  Sparkles,
  Printer,
  Search,
  Coins,
  Check,
  X,
  UserPlus,
  RefreshCw,
  Building,
  ShoppingBag,
  UserCheck,
  AlertCircle
} from 'lucide-vue-next';

import MemberCardVisual from './MemberCardVisual.vue';

const buyerStore = useBuyerStore();

const searchQuery = ref('');
const selectedTierFilter = ref<MembershipTier | 'ALL' | 'UNREGISTERED'>('ALL');
const showPrintCardModal = ref(false);
const activeCardPreviewBuyer = ref<Buyer>(buyerStore.buyers[0] || {
  id: 'preview',
  name: 'Budi Santoso',
  memberCardNo: 'MBR-CITRA-8899',
  tier: 'GOLD',
  points: 250,
  totalSpend: 6500000,
  memberSince: '2026-01-01'
});

const showPointAdjustModal = ref(false);
const buyerForPointAdjust = ref<Buyer | null>(null);
const pointAdjustAmount = ref<number>(10);
const pointAdjustType = ref<'ADD' | 'DEDUCT'>('ADD');
const pointAdjustReason = ref('');

// Modal Daftarkan Member Baru / Upgrade Pelanggan
const showRegisterMemberModal = ref(false);
const registerMode = ref<'EXISTING' | 'NEW'>('EXISTING');
const selectedExistingBuyerId = ref('');
const isSavingMember = ref(false);

const nonMemberBuyers = computed(() => {
  return buyerStore.buyers.filter(b => !b.memberCardNo);
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

function openRegisterModal(buyerId?: string) {
  if (buyerId) {
    registerMode.value = 'EXISTING';
    selectedExistingBuyerId.value = buyerId;
    const existing = buyerStore.buyers.find(b => b.id === buyerId);
    const type = existing?.customerType || 'B2B';
    newMemberForm.value = {
      name: existing?.name || '',
      code: existing?.code || '',
      phone: existing?.phone || '',
      address: existing?.address || '',
      customerType: type,
      memberCardNo: generateNewCardNumber(type),
      tier: 'REGULAR',
      initialPoints: 10
    };
  } else if (nonMemberBuyers.value.length > 0) {
    registerMode.value = 'EXISTING';
    selectedExistingBuyerId.value = nonMemberBuyers.value[0].id;
    const type = nonMemberBuyers.value[0].customerType || 'B2B';
    newMemberForm.value = {
      name: nonMemberBuyers.value[0].name,
      code: nonMemberBuyers.value[0].code || '',
      phone: nonMemberBuyers.value[0].phone || '',
      address: nonMemberBuyers.value[0].address || '',
      customerType: type,
      memberCardNo: generateNewCardNumber(type),
      tier: 'REGULAR',
      initialPoints: 10
    };
  } else {
    registerMode.value = 'NEW';
    const type: CustomerType = 'B2B';
    newMemberForm.value = {
      name: '',
      code: '',
      phone: '',
      address: '',
      customerType: type,
      memberCardNo: generateNewCardNumber(type),
      tier: 'REGULAR',
      initialPoints: 10
    };
  }

  showRegisterMemberModal.value = true;
}

function onSelectExistingBuyer(buyerId: string) {
  selectedExistingBuyerId.value = buyerId;
  const buyer = buyerStore.buyers.find(b => b.id === buyerId);
  if (buyer) {
    newMemberForm.value.customerType = buyer.customerType || 'B2B';
    newMemberForm.value.name = buyer.name;
    newMemberForm.value.phone = buyer.phone || '';
    newMemberForm.value.memberCardNo = generateNewCardNumber(buyer.customerType || 'B2B');
  }
}

function randomizeCardNumber() {
  newMemberForm.value.memberCardNo = generateNewCardNumber(newMemberForm.value.customerType);
}

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
      activeCardPreviewBuyer.value = targetBuyer;
    }

    showRegisterMemberModal.value = false;
  } catch (err) {
    console.error('Failed to register member:', err);
  } finally {
    isSavingMember.value = false;
  }
}

const filteredMembers = computed(() => {
  return buyerStore.buyers.filter(b => {
    const isMbr = Boolean(b.memberCardNo);
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (b.memberCardNo && b.memberCardNo.toLowerCase().includes(searchQuery.value.toLowerCase())) ||
      (b.phone && b.phone.includes(searchQuery.value));

    if (selectedTierFilter.value === 'UNREGISTERED') {
      return !isMbr && matchesSearch;
    }

    const matchesTier = selectedTierFilter.value === 'ALL' || b.tier === selectedTierFilter.value;
    return isMbr && matchesSearch && matchesTier;
  });
});

function selectForPreview(buyer: Buyer) {
  activeCardPreviewBuyer.value = buyer;
}

function openPointAdjustModal(buyer: Buyer) {
  buyerForPointAdjust.value = buyer;
  pointAdjustAmount.value = 10;
  pointAdjustType.value = 'ADD';
  pointAdjustReason.value = '';
  showPointAdjustModal.value = true;
}

function handleSavePointAdjust() {
  if (!buyerForPointAdjust.value) return;
  const current = buyerForPointAdjust.value.points || 0;
  const delta = pointAdjustType.value === 'ADD' ? pointAdjustAmount.value : -pointAdjustAmount.value;
  buyerForPointAdjust.value.points = Math.max(0, current + delta);
  buyerStore.updateBuyer(buyerForPointAdjust.value);
  showPointAdjustModal.value = false;
}

// Konfigurasi Poin Local State
const tempEarnPer = ref(buyerStore.loyaltySettings.earnPerAmount);
const tempPointVal = ref(buyerStore.loyaltySettings.pointValueInRupiah);
const tempTierDiscounts = ref({ ...buyerStore.loyaltySettings.tierDiscounts });
const isSettingsSaved = ref(false);

function saveProgramSettings() {
  buyerStore.updateLoyaltySettings({
    earnPerAmount: Number(tempEarnPer.value) || 10000,
    pointValueInRupiah: Number(tempPointVal.value) || 100,
    tierDiscounts: {
      REGULAR: Number(tempTierDiscounts.value.REGULAR) || 0,
      SILVER: Number(tempTierDiscounts.value.SILVER) || 2,
      GOLD: Number(tempTierDiscounts.value.GOLD) || 5,
      PLATINUM: Number(tempTierDiscounts.value.PLATINUM) || 8,
    }
  });
  isSettingsSaved.value = true;
  setTimeout(() => {
    isSettingsSaved.value = false;
  }, 2000);
}

function printMemberCard() {
  showPrintCardModal.value = true;
}

function handleTriggerPrint() {
  window.print();
}
</script>

<template>
  <div class="space-y-5 max-w-7xl mx-auto pb-16">
    <!-- Header Hero Banner -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-xl border border-indigo-900/40 shadow-sm">
      <div>
        <div class="flex items-center gap-2">
          <Award class="text-amber-400" :size="20" />
          <h3 class="font-extrabold text-base tracking-tight">Sistem Kartu Member & Loyalitas Pelanggan</h3>
        </div>
        <p class="text-xs text-indigo-200 mt-1 max-w-2xl">
          Tingkatkan loyalitas pelanggan B2B dan B2C dengan Kartu Member Digital, akumulasi poin belanja otomatis, diskon bertingkat (Tier), dan penukaran poin saat kasir.
        </p>
      </div>

      <div class="flex items-center gap-2 shrink-0">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold text-xs cursor-pointer shadow-md transition-all active:scale-95"
          @click="openRegisterModal()"
        >
          <UserPlus :size="14" />
          <span>+ Daftarkan Member Baru</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold text-xs cursor-pointer border border-slate-700 shadow-sm transition-all"
          @click="printMemberCard"
        >
          <Printer :size="14" />
          <span>Cetak Kartu Member</span>
        </button>
      </div>
    </div>

    <!-- Top Section: Digital Member Card Live Preview + Loyalty Rules -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <!-- Digital Card Interactive Preview -->
      <div class="lg:col-span-6 flex flex-col items-center justify-center p-6 bg-slate-100 rounded-xl border border-slate-200 shadow-inner">
        <div class="w-full flex items-center justify-between mb-3 text-xs">
          <span class="font-bold text-slate-700 flex items-center gap-1">
            <Sparkles :size="13" class="text-amber-500" />
            <span>Kartu Member Fisik & Digital (Depan & Belakang):</span>
          </span>
          <span class="font-mono text-[11px] text-slate-500">Standar ID-1 ISO 7810</span>
        </div>

        <!-- The Real Visual Member Card (Depan & Belakang dengan Real QR Code) -->
        <MemberCardVisual
          :buyer="activeCardPreviewBuyer"
        />

        <p class="text-[11px] text-slate-500 mt-2 text-center">
          Klik pelanggan di tabel bawah untuk melihat kartu member pelanggan tersebut.
        </p>
      </div>

      <!-- Loyalty Program Rules Setting Form -->
      <div class="lg:col-span-6 bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
        <div class="space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-gray-100">
            <h4 class="font-bold text-gray-800 text-xs flex items-center gap-1.5">
              <Coins :size="15" class="text-amber-500" />
              <span>Aturan Perolehan & Penukaran Poin Loyalitas</span>
            </h4>
            <span class="text-[11px] text-emerald-600 font-semibold" v-if="isSettingsSaved">
              ✓ Berhasil Disimpan
            </span>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-semibold text-gray-700 block mb-1">
                Belanja per Poin (Rp)
              </label>
              <input
                v-model.number="tempEarnPer"
                type="number"
                min="1000"
                step="1000"
                class="w-full bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs font-mono font-bold outline-none focus:border-amber-500"
              />
              <span class="text-[10px] text-gray-400 mt-0.5 block">
                Tiap belanja Rp {{ formatRupiah(tempEarnPer) }} dapat 1 poin
              </span>
            </div>

            <div>
              <label class="text-xs font-semibold text-gray-700 block mb-1">
                Nilai 1 Poin (Rp)
              </label>
              <input
                v-model.number="tempPointVal"
                type="number"
                min="10"
                step="10"
                class="w-full bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs font-mono font-bold outline-none focus:border-amber-500"
              />
              <span class="text-[10px] text-gray-400 mt-0.5 block">
                1 poin = potongan Rp {{ formatRupiah(tempPointVal) }} di kasir
              </span>
            </div>
          </div>

          <!-- Tier Automatic Discounts -->
          <div>
            <label class="text-xs font-semibold text-gray-700 block mb-1.5">
              Diskon Otomatis Tambahan per Tier Pelanggan (%)
            </label>
            <div class="grid grid-cols-4 gap-2">
              <div class="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <span class="text-[10px] font-bold text-slate-600 block">REGULAR</span>
                <input
                  v-model.number="tempTierDiscounts.REGULAR"
                  type="number"
                  min="0"
                  max="100"
                  class="w-full bg-white border border-gray-300 rounded mt-1 text-center font-bold font-mono text-xs py-0.5"
                />
                <span class="text-[10px] text-gray-400 block mt-0.5">% diskon</span>
              </div>

              <div class="p-2 rounded-lg bg-slate-100 border border-slate-300 text-center">
                <span class="text-[10px] font-bold text-slate-700 block">SILVER</span>
                <input
                  v-model.number="tempTierDiscounts.SILVER"
                  type="number"
                  min="0"
                  max="100"
                  class="w-full bg-white border border-gray-300 rounded mt-1 text-center font-bold font-mono text-xs py-0.5 text-blue-700"
                />
                <span class="text-[10px] text-gray-400 block mt-0.5">> Rp 1 Juta</span>
              </div>

              <div class="p-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
                <span class="text-[10px] font-bold text-amber-800 block">GOLD</span>
                <input
                  v-model.number="tempTierDiscounts.GOLD"
                  type="number"
                  min="0"
                  max="100"
                  class="w-full bg-white border border-gray-300 rounded mt-1 text-center font-bold font-mono text-xs py-0.5 text-amber-700"
                />
                <span class="text-[10px] text-gray-400 block mt-0.5">> Rp 5 Juta</span>
              </div>

              <div class="p-2 rounded-lg bg-purple-50 border border-purple-200 text-center">
                <span class="text-[10px] font-bold text-purple-800 block">PLATINUM</span>
                <input
                  v-model.number="tempTierDiscounts.PLATINUM"
                  type="number"
                  min="0"
                  max="100"
                  class="w-full bg-white border border-gray-300 rounded mt-1 text-center font-bold font-mono text-xs py-0.5 text-purple-700"
                />
                <span class="text-[10px] text-gray-400 block mt-0.5">> Rp 15 Juta</span>
              </div>
            </div>
          </div>
        </div>

        <div class="pt-4 mt-3 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            class="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-colors"
            @click="saveProgramSettings"
          >
            <Check :size="13" />
            <span>Simpan Aturan Loyalitas</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Bottom Section: Member List & Points Management Table -->
    <div class="space-y-3">
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-gray-200">
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <div class="relative w-full sm:w-72">
            <input
              v-model="searchQuery"
              type="text"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 pl-8 text-xs focus:bg-white focus:border-amber-500 outline-none"
              placeholder="Cari nomor kartu, nama member..."
            />
            <Search :size="14" class="absolute left-2.5 top-2 text-gray-400" />
          </div>

          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold text-xs cursor-pointer shadow-xs transition-colors shrink-0 active:scale-95"
            @click="openRegisterModal()"
          >
            <UserPlus :size="13" />
            <span>+ Daftarkan Member</span>
          </button>
        </div>

        <div class="flex items-center gap-1.5 self-end sm:self-auto text-xs overflow-x-auto pb-1 sm:pb-0 max-w-full">
          <span class="text-gray-500 font-medium mr-1 whitespace-nowrap">Filter:</span>
          <button
            type="button"
            class="px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer whitespace-nowrap"
            :class="selectedTierFilter === 'ALL' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="selectedTierFilter = 'ALL'"
          >
            Semua Member ({{ buyerStore.memberBuyers.length }})
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer whitespace-nowrap"
            :class="selectedTierFilter === 'REGULAR' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="selectedTierFilter = 'REGULAR'"
          >
            Regular
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer whitespace-nowrap"
            :class="selectedTierFilter === 'GOLD' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="selectedTierFilter = 'GOLD'"
          >
            Gold
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer whitespace-nowrap"
            :class="selectedTierFilter === 'SILVER' ? 'bg-slate-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="selectedTierFilter = 'SILVER'"
          >
            Silver
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer whitespace-nowrap"
            :class="selectedTierFilter === 'PLATINUM' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            @click="selectedTierFilter = 'PLATINUM'"
          >
            Platinum
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded font-semibold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            :class="selectedTierFilter === 'UNREGISTERED' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'"
            @click="selectedTierFilter = 'UNREGISTERED'"
          >
            <span>Belum Member</span>
            <span
              class="px-1.5 py-0.2 rounded-full text-[10px] font-bold"
              :class="selectedTierFilter === 'UNREGISTERED' ? 'bg-white text-amber-700' : 'bg-amber-200 text-amber-900'"
            >
              {{ nonMemberBuyers.length }}
            </span>
          </button>
        </div>
      </div>

      <!-- Members Table -->
      <div class="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-xs">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-[#f6f5f2] border-b border-gray-200 text-gray-600 font-bold uppercase text-[10px] tracking-wider">
                <th class="py-2.5 px-3">No. Kartu Member</th>
                <th class="py-2.5 px-3">Nama Pelanggan</th>
                <th class="py-2.5 px-3">Tipe & Kontak</th>
                <th class="py-2.5 px-3 text-center">Tier Member</th>
                <th class="py-2.5 px-3 text-right">Poin Loyalitas</th>
                <th class="py-2.5 px-3 text-right">Akumulasi Belanja</th>
                <th class="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="b in filteredMembers"
                :key="b.id"
                class="hover:bg-amber-50/40 transition-colors cursor-pointer"
                :class="activeCardPreviewBuyer.id === b.id ? 'bg-amber-50/70 font-medium' : ''"
                @click="b.memberCardNo && selectForPreview(b)"
              >
                <!-- Nomor Kartu Member -->
                <td class="py-2.5 px-3 font-mono font-bold whitespace-nowrap">
                  <div v-if="b.memberCardNo" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                    <CreditCard :size="12" class="text-amber-600" />
                    <span>{{ b.memberCardNo }}</span>
                  </div>
                  <span v-else class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 text-[10px] font-semibold">
                    Belum Ada Kartu
                  </span>
                </td>

                <!-- Nama Pelanggan -->
                <td class="py-2.5 px-3 font-bold text-gray-800">
                  {{ b.name }}
                </td>

                <!-- Tipe & Kontak -->
                <td class="py-2.5 px-3 text-gray-600">
                  <span class="font-mono text-[11px] block">{{ b.phone || '-' }}</span>
                  <span class="text-[10px] text-gray-400 block">{{ b.customerType === 'B2B' ? 'Grosir / B2B' : 'Eceran' }}</span>
                </td>

                <!-- Tier Badge -->
                <td class="py-2.5 px-3 text-center whitespace-nowrap">
                  <span
                    v-if="b.memberCardNo"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[10px] border"
                    :class="{
                      'bg-slate-100 text-slate-700 border-slate-300': b.tier === 'REGULAR',
                      'bg-slate-200 text-slate-800 border-slate-400': b.tier === 'SILVER',
                      'bg-amber-100 text-amber-900 border-amber-300': b.tier === 'GOLD',
                      'bg-purple-100 text-purple-900 border-purple-300': b.tier === 'PLATINUM'
                    }"
                  >
                    <span>⭐ {{ b.tier || 'REGULAR' }}</span>
                  </span>
                  <span v-else class="text-gray-400 text-[10px] italic">
                    Non-Member
                  </span>
                </td>

                <!-- Poin Loyalitas -->
                <td class="py-2.5 px-3 text-right whitespace-nowrap">
                  <template v-if="b.memberCardNo">
                    <span class="font-mono font-extrabold text-amber-600 text-sm">
                      {{ b.points || 0 }} Poin
                    </span>
                    <span class="text-[10px] text-gray-400 block font-mono">
                      = Rp {{ formatRupiah((b.points || 0) * buyerStore.loyaltySettings.pointValueInRupiah) }}
                    </span>
                  </template>
                  <span v-else class="text-gray-400 text-[10px]">-</span>
                </td>

                <!-- Total Belanja -->
                <td class="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold text-gray-700">
                  Rp {{ formatRupiah(b.totalSpend || 0) }}
                </td>

                <!-- Aksi -->
                <td class="py-2.5 px-3 text-right whitespace-nowrap" @click.stop>
                  <div v-if="b.memberCardNo" class="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-semibold text-[11px] cursor-pointer flex items-center gap-1"
                      title="Ubah / Sesuaikan Poin Member"
                      @click="openPointAdjustModal(b)"
                    >
                      <Coins :size="11" />
                      <span>Atur Poin</span>
                    </button>
                    <button
                      type="button"
                      class="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold text-[11px] cursor-pointer"
                      title="Lihat Kartu"
                      @click="selectForPreview(b)"
                    >
                      Lihat Kartu
                    </button>
                  </div>
                  <div v-else class="flex items-center justify-end">
                    <button
                      type="button"
                      class="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] cursor-pointer flex items-center gap-1 shadow-xs transition-transform active:scale-95"
                      @click="openRegisterModal(b.id)"
                    >
                      <UserPlus :size="12" />
                      <span>+ Jadikan Member</span>
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredMembers.length === 0">
                <td colspan="7" class="py-8 text-center text-gray-400">
                  <CreditCard :size="28" class="mx-auto mb-1 text-gray-300" />
                  <p class="font-medium">Tidak ada data pelanggan yang sesuai dengan filter ini</p>
                  <button
                    v-if="selectedTierFilter === 'UNREGISTERED'"
                    type="button"
                    class="mt-2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold text-xs cursor-pointer inline-flex items-center gap-1"
                    @click="openRegisterModal()"
                  >
                    <UserPlus :size="12" />
                    <span>Daftarkan Member Baru</span>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Modal Penyesuaian Poin Manual -->
    <div
      v-if="showPointAdjustModal && buyerForPointAdjust"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none text-xs"
      @click.self="showPointAdjustModal = false"
    >
      <div class="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div class="px-4 py-3 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between font-bold text-gray-800">
          <div class="flex items-center gap-2 text-sm">
            <Coins :size="16" class="text-amber-500" />
            <span>Penyesuaian Poin Loyalitas</span>
          </div>
          <button type="button" class="p-1 text-gray-400 hover:text-black" @click="showPointAdjustModal = false">
            <X :size="16" />
          </button>
        </div>

        <div class="p-4 space-y-3.5">
          <div class="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <span class="text-gray-600 block text-[11px]">Member:</span>
            <span class="font-bold text-gray-800 text-sm block">{{ buyerForPointAdjust.name }}</span>
            <span class="font-mono text-xs text-amber-800 font-bold block mt-0.5">
              Saldo Poin Saat Ini: {{ buyerForPointAdjust.points || 0 }} Poin
            </span>
          </div>

          <div>
            <label class="font-semibold text-gray-700 block mb-1">Aksi Penyesuaian</label>
            <div class="flex rounded border border-gray-300 overflow-hidden">
              <button
                type="button"
                class="flex-1 py-1.5 text-center font-bold transition-colors cursor-pointer"
                :class="pointAdjustType === 'ADD' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'"
                @click="pointAdjustType = 'ADD'"
              >
                + Tambah Poin
              </button>
              <button
                type="button"
                class="flex-1 py-1.5 text-center font-bold transition-colors cursor-pointer"
                :class="pointAdjustType === 'DEDUCT' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600'"
                @click="pointAdjustType = 'DEDUCT'"
              >
                - Kurangi Poin
              </button>
            </div>
          </div>

          <div>
            <label class="font-semibold text-gray-700 block mb-1">Jumlah Poin</label>
            <input
              v-model.number="pointAdjustAmount"
              type="number"
              min="1"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 font-mono font-bold text-sm outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label class="font-semibold text-gray-700 block mb-1">Alasan Penyesuaian (Opsional)</label>
            <input
              v-model="pointAdjustReason"
              type="text"
              class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-amber-500"
              placeholder="Contoh: Bonus Ulang Tahun, Kompensasi..."
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-semibold cursor-pointer"
              @click="showPointAdjustModal = false"
            >
              Batal
            </button>
            <button
              type="button"
              class="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold cursor-pointer"
              @click="handleSavePointAdjust"
            >
              Simpan Poin
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Daftarkan Member Baru / Upgrade Pelanggan -->
    <div
      v-if="showRegisterMemberModal"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 select-none text-xs"
      @click.self="showRegisterMemberModal = false"
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
          <button type="button" class="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer" @click="showRegisterMemberModal = false">
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
              <select
                :value="selectedExistingBuyerId"
                @change="onSelectExistingBuyer(($event.target as HTMLSelectElement).value)"
                class="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer"
              >
                <option v-for="buyer in nonMemberBuyers" :key="buyer.id" :value="buyer.id">
                  {{ buyer.name }} ({{ buyer.customerType === 'B2B' ? 'Grosir/B2B' : 'Eceran' }} - Telp: {{ buyer.phone || '-' }})
                </option>
              </select>
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

          <!-- Member Card & Loyalty Details (Common to both modes) -->
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
                  class="p-2 rounded-lg border text-center transition-all cursor-pointer"
                  :class="newMemberForm.tier === 'REGULAR' ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'"
                  @click="newMemberForm.tier = 'REGULAR'"
                >
                  <span class="block text-[11px] font-bold">REGULAR</span>
                  <span class="block text-[9px] opacity-75">Dasar</span>
                </button>
                <button
                  type="button"
                  class="p-2 rounded-lg border text-center transition-all cursor-pointer"
                  :class="newMemberForm.tier === 'SILVER' ? 'bg-slate-600 text-white border-slate-600 ring-2 ring-slate-400' : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'"
                  @click="newMemberForm.tier = 'SILVER'"
                >
                  <span class="block text-[11px] font-bold">SILVER</span>
                  <span class="block text-[9px] opacity-75">Diskon 2%</span>
                </button>
                <button
                  type="button"
                  class="p-2 rounded-lg border text-center transition-all cursor-pointer"
                  :class="newMemberForm.tier === 'GOLD' ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400' : 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'"
                  @click="newMemberForm.tier = 'GOLD'"
                >
                  <span class="block text-[11px] font-bold">GOLD</span>
                  <span class="block text-[9px] opacity-75">Diskon 5%</span>
                </button>
                <button
                  type="button"
                  class="p-2 rounded-lg border text-center transition-all cursor-pointer"
                  :class="newMemberForm.tier === 'PLATINUM' ? 'bg-purple-700 text-white border-purple-700 ring-2 ring-purple-400' : 'bg-purple-50 border-purple-300 text-purple-900 hover:bg-purple-100'"
                  @click="newMemberForm.tier = 'PLATINUM'"
                >
                  <span class="block text-[11px] font-bold">PLATINUM</span>
                  <span class="block text-[9px] opacity-75">Diskon 8%</span>
                </button>
              </div>
            </div>

            <!-- Bonus Poin Awal -->
            <div>
              <label class="font-semibold text-gray-700 block mb-1">Bonus Poin Pendaftaran Awal</label>
              <div class="flex items-center gap-2">
                <input
                  v-model.number="newMemberForm.initialPoints"
                  type="number"
                  min="0"
                  class="w-32 bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-mono font-bold text-xs outline-none focus:border-amber-500"
                />
                <span class="text-[11px] text-gray-500">
                  = Diskon Rp {{ formatRupiah((newMemberForm.initialPoints || 0) * buyerStore.loyaltySettings.pointValueInRupiah) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
            <button
              type="button"
              class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold cursor-pointer transition-colors"
              @click="showRegisterMemberModal = false"
            >
              Batal
            </button>
            <button
              type="submit"
              :disabled="isSavingMember || (registerMode === 'EXISTING' && nonMemberBuyers.length === 0)"
              class="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold cursor-pointer transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center gap-1.5"
            >
              <Check :size="15" />
              <span>{{ isSavingMember ? 'Menyimpan...' : 'Daftarkan & Buat Kartu' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Cetak Kartu Member (Depan & Belakang Standar ID-1 ISO 7810) -->
    <div
      v-if="showPrintCardModal"
      class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 select-none text-xs"
      @click.self="showPrintCardModal = false"
    >
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-300 w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- Header -->
        <div class="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Printer :size="18" class="text-amber-400" />
            <div>
              <h3 class="font-bold text-sm tracking-tight">Cetak Kartu Member Fisik (Depan & Belakang)</h3>
              <p class="text-[11px] text-indigo-200">Standar Ukuran Kartu ID-1 ISO/IEC 7810 (85.6mm x 53.98mm)</p>
            </div>
          </div>
          <button type="button" class="p-1 text-slate-400 hover:text-white cursor-pointer" @click="showPrintCardModal = false">
            <X :size="18" />
          </button>
        </div>

        <!-- Content Area -->
        <div class="p-6 bg-slate-50 space-y-6">
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-[11.5px] flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Sparkles :size="16" class="text-amber-600 shrink-0" />
              <span>
                Mencetak kartu untuk <strong>{{ activeCardPreviewBuyer.name }}</strong> (No: <strong>{{ activeCardPreviewBuyer.memberCardNo || '-' }}</strong>).
                Sisi belakang sudah dilengkapi <strong>QR Code Asli</strong> untuk scan kasir.
              </span>
            </div>
            <span class="px-2 py-0.5 rounded bg-amber-200/80 font-bold text-[10px] uppercase">
              {{ activeCardPreviewBuyer.tier || 'REGULAR' }}
            </span>
          </div>

          <!-- Printable Area (Dua Sisi Berdampingan) -->
          <div id="print-member-card-area" class="flex flex-col md:flex-row items-center justify-center gap-6 p-4 bg-white rounded-xl border border-slate-200 shadow-inner">
            <!-- Sisi Depan -->
            <div class="flex flex-col items-center gap-2">
              <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                [ 1. Tampak Depan ]
              </span>
              <MemberCardVisual
                :buyer="activeCardPreviewBuyer"
                :model-value="false"
                :interactive="false"
                :show-controls="false"
              />
            </div>

            <!-- Sisi Belakang (QR Code) -->
            <div class="flex flex-col items-center gap-2">
              <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                [ 2. Tampak Belakang (QR Code Kasir) ]
              </span>
              <MemberCardVisual
                :buyer="activeCardPreviewBuyer"
                :model-value="true"
                :interactive="false"
                :show-controls="false"
              />
            </div>
          </div>

          <!-- Tips Cetak -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-600">
            <div class="p-3 bg-white rounded-lg border border-slate-200">
              <p class="font-bold text-slate-800 mb-0.5">🖨️ Printer Kartu PVC / Kertas Foto</p>
              <p class="leading-relaxed">Gunakan kertas foto tebal (230-260 gsm) atau printer khusus kartu PVC (Evolis/Zebra/Fargo) untuk hasil fisik terbaik.</p>
            </div>
            <div class="p-3 bg-white rounded-lg border border-slate-200">
              <p class="font-bold text-slate-800 mb-0.5">📱 Digital Member Card</p>
              <p class="leading-relaxed">QR Code pada sisi belakang dapat disimpan atau di-screenshot oleh pelanggan di smartphone untuk di-scan kasir.</p>
            </div>
          </div>
        </div>

        <!-- Footer Buttons -->
        <div class="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
          <button
            type="button"
            class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold cursor-pointer transition-colors"
            @click="showPrintCardModal = false"
          >
            Tutup
          </button>

          <button
            type="button"
            class="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold cursor-pointer transition-all shadow-md active:scale-95 flex items-center gap-2"
            @click="handleTriggerPrint"
          >
            <Printer :size="16" />
            <span>Cetak Kartu Sekarang</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  body * {
    visibility: hidden;
  }
  #print-member-card-area,
  #print-member-card-area * {
    visibility: visible;
  }
  #print-member-card-area {
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0;
    padding: 20px;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    display: flex !important;
    flex-direction: row !important;
    justify-content: center !important;
    gap: 30px !important;
  }
}
</style>
