<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { Buyer } from '../../../types';
import {
  Printer,
  X,
  CreditCard,
  Download,
  Loader2,
  ChevronDown,
  Image as ImageIcon,
  Layers,
  QrCode as QrIcon
} from 'lucide-vue-next';
import MemberCardVisual from './MemberCardVisual.vue';

const props = defineProps<{
  isOpen: boolean;
  buyer: Buyer;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const frontCardVisualRef = ref<InstanceType<typeof MemberCardVisual> | null>(null);
const isDownloading = ref(false);
const isDownloadMenuOpen = ref(false);

function handleTriggerPrint() {
  window.print();
}

async function handleDownload(side: 'kedua_sisi' | 'depan' | 'belakang' | 'semua_terpisah') {
  isDownloadMenuOpen.value = false;
  if (!frontCardVisualRef.value) return;
  isDownloading.value = true;
  try {
    await frontCardVisualRef.value.downloadSide(side);
  } finally {
    isDownloading.value = false;
  }
}

function handleGlobalClick() {
  if (isDownloadMenuOpen.value) {
    isDownloadMenuOpen.value = false;
  }
}

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
  (val) => {
    if (val) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onMounted(() => {
  document.addEventListener('click', handleGlobalClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick);
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-xs select-none text-xs animate-in fade-in duration-150"
      @click.self="emit('close')"
    >
      <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 w-full sm:max-w-2xl overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        <!-- Header Modal -->
        <div class="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center">
            <Printer :size="18" />
          </div>
          <div>
            <h3 class="font-bold text-sm tracking-tight">Cetak / Unduh Kartu Member Pelanggan</h3>
            <p class="text-[11px] text-slate-300">Format Standar ID-1 ISO 7810 (Ukuran Kartu ATM / KTP)</p>
          </div>
        </div>
        <button type="button" class="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <!-- Body Preview -->
      <div class="p-6 overflow-y-auto space-y-4 bg-slate-50/50 flex-1">
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-[11.5px] flex items-center justify-between">
          <div class="flex items-center gap-2">
            <CreditCard :size="16" class="text-amber-600 shrink-0" />
            <span>
              Mencetak kartu untuk <strong>{{ buyer.name }}</strong> (No: <strong>{{ buyer.memberCardNo || '-' }}</strong>).
              Sisi belakang sudah dilengkapi <strong>QR Code Asli</strong> untuk scan kasir.
            </span>
          </div>
          <span class="px-2 py-0.5 rounded bg-amber-200/80 font-bold text-[10px] uppercase">
            {{ buyer.tier || 'REGULAR' }}
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
              ref="frontCardVisualRef"
              :buyer="buyer"
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
              :buyer="buyer"
              :model-value="true"
              :interactive="false"
              :show-controls="false"
            />
          </div>
        </div>

        <!-- Tips Cetak & Digital -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-600">
          <div class="p-3 bg-white rounded-lg border border-slate-200">
            <p class="font-bold text-slate-800 mb-0.5">🖨️ Printer Kartu PVC / Kertas Foto</p>
            <p class="leading-relaxed">Gunakan kertas foto tebal (230-260 gsm) atau printer khusus kartu PVC (Evolis/Zebra/Fargo) untuk hasil fisik terbaik.</p>
          </div>
          <div class="p-3 bg-white rounded-lg border border-slate-200">
            <p class="font-bold text-slate-800 mb-0.5">📱 Unduh Format PNG (Digital Card)</p>
            <p class="leading-relaxed">Klik tombol <strong>Unduh PNG</strong> di bawah untuk menyimpan gambar kartu beresolusi tinggi yang bisa dikirim ke WhatsApp pelanggan.</p>
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between relative">
        <button
          type="button"
          class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold cursor-pointer transition-colors"
          @click="emit('close')"
        >
          Tutup
        </button>

        <div class="flex items-center gap-2.5">
          <!-- Dropdown Unduh PNG -->
          <div class="relative">
            <div class="flex items-stretch rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all">
              <button
                type="button"
                :disabled="isDownloading"
                class="px-4 py-2.5 font-bold cursor-pointer flex items-center gap-2 disabled:opacity-50"
                title="Unduh Kedua Sisi Kartu Member sebagai PNG"
                @click="handleDownload('kedua_sisi')"
              >
                <Loader2 v-if="isDownloading" :size="16" class="animate-spin" />
                <Download v-else :size="16" />
                <span>{{ isDownloading ? 'Mengunduh...' : 'Unduh PNG' }}</span>
              </button>

              <button
                type="button"
                :disabled="isDownloading"
                class="px-2 py-2.5 border-l border-emerald-700/50 hover:bg-emerald-700/30 rounded-r-lg cursor-pointer transition-colors flex items-center justify-center disabled:opacity-50"
                title="Pilihan Format Unduh PNG"
                @click.stop="isDownloadMenuOpen = !isDownloadMenuOpen"
              >
                <ChevronDown :size="14" :class="{ 'rotate-180': isDownloadMenuOpen }" class="transition-transform duration-150" />
              </button>
            </div>

            <!-- Dropdown Menu -->
            <div
              v-if="isDownloadMenuOpen"
              class="absolute right-0 bottom-full mb-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 z-50 text-slate-800 text-xs font-medium animate-in fade-in zoom-in-95 duration-100"
              @click.stop
            >
              <div class="px-3 py-1 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Pilihan Export Gambar (PNG HD)
              </div>

              <button
                type="button"
                class="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                @click="handleDownload('kedua_sisi')"
              >
                <div class="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ImageIcon :size="13" />
                </div>
                <div>
                  <div class="font-bold text-slate-800 leading-tight">Kedua Sisi (Berdampingan)</div>
                  <div class="text-[10px] text-gray-500">Depan & Belakang dalam 1 file</div>
                </div>
              </button>

              <button
                type="button"
                class="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                @click="handleDownload('depan')"
              >
                <div class="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <CreditCard :size="13" />
                </div>
                <div>
                  <div class="font-bold text-slate-800 leading-tight">Tampak Depan Saja</div>
                  <div class="text-[10px] text-gray-500">Nama & nomor kartu</div>
                </div>
              </button>

              <button
                type="button"
                class="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                @click="handleDownload('belakang')"
              >
                <div class="w-6 h-6 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <QrIcon :size="13" />
                </div>
                <div>
                  <div class="font-bold text-slate-800 leading-tight">Tampak Belakang Saja</div>
                  <div class="text-[10px] text-gray-500">QR Code scan kasir</div>
                </div>
              </button>

              <div class="my-1 border-t border-gray-100"></div>

              <button
                type="button"
                class="w-full px-3 py-2 text-left hover:bg-emerald-50 flex items-center gap-2.5 cursor-pointer transition-colors"
                @click="handleDownload('semua_terpisah')"
              >
                <div class="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Layers :size="13" />
                </div>
                <div>
                  <div class="font-bold text-slate-800 leading-tight">Unduh Keduanya (2 File)</div>
                  <div class="text-[10px] text-gray-500">File depan & belakang terpisah</div>
                </div>
              </button>
            </div>
          </div>

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
  </Teleport>
</template>
