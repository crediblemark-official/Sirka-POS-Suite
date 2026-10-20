<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { dbService } from '../../services/dbService';
import {
  Printer,
  X,
  Save,
  CheckCircle2,
  RefreshCw,
  Cable,
  Bluetooth,
  Network,
  Sliders,
  Send
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const settingsStore = useSettingsStore();

const tempAddress = ref(settingsStore.printerNetworkAddress);
const tempPaperWidth = ref(settingsStore.receiptPaperWidth);
const isSaving = ref(false);
const saveFeedback = ref<string | null>(null);

// Hardware Printer Auto-Detection
const isDetecting = ref(false);
const hardwareStatus = ref<{
  recommended_mode: string;
  usb_available: boolean;
  usb_device_path: string | null;
  bluetooth_available: boolean;
  bluetooth_device_name: string | null;
  bluetooth_mac: string | null;
  status_text: string;
}>({
  recommended_mode: 'system',
  usb_available: false,
  usb_device_path: null,
  bluetooth_available: false,
  bluetooth_device_name: null,
  bluetooth_mac: null,
  status_text: 'Memeriksa perangkat...'
});

async function detectHardware() {
  isDetecting.value = true;
  try {
    const res = await dbService.detectPrinterStatus();
    hardwareStatus.value = res;
  } catch (e: any) {
    console.warn('Gagal deteksi printer:', e);
  } finally {
    isDetecting.value = false;
  }
}

// Test Print
const isTesting = ref(false);
const testFeedback = ref<{ type: 'ok' | 'err'; msg: string } | null>(null);

async function handleTestNetworkPrint() {
  isTesting.value = true;
  testFeedback.value = null;
  try {
    const text = `=== TEST PRINTER SIRKA ===\nKoneksi: Network LAN / TCP Socket\nAlamat: ${tempAddress.value}\nLebar Kertas: ${tempPaperWidth.value}\nStatus: Berhasil Terhubung!\n================================\n\n\n`;
    const res = await dbService.printToNetworkPrinter(text, tempAddress.value);
    testFeedback.value = { type: 'ok', msg: `✓ ${res}` };
  } catch (e: any) {
    testFeedback.value = { type: 'err', msg: `Gagal: ${e?.message || e}` };
  } finally {
    isTesting.value = false;
  }
}

async function handleSave() {
  isSaving.value = true;
  saveFeedback.value = null;
  try {
    await Promise.all([
      settingsStore.updateSetting('printer_network_address', tempAddress.value.trim() || '127.0.0.1:9100'),
      settingsStore.updateSetting('receipt_paper_width', tempPaperWidth.value || '58mm')
    ]);
    saveFeedback.value = 'Pengaturan printer berhasil disimpan!';
    setTimeout(() => {
      saveFeedback.value = null;
      emit('close');
    }, 1200);
  } catch (e: any) {
    saveFeedback.value = `Gagal menyimpan: ${e?.message || e}`;
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  detectHardware();
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
  (val) => {
    if (val) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none text-xs"
      @click.self="emit('close')"
    >
      <div
        class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col text-slate-900 animate-in fade-in zoom-in-95 duration-150"
      >
        <!-- Modal Header -->
        <div class="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-xs"
              :style="{ backgroundColor: settingsStore.primaryColor }"
            >
              <Printer :size="16" />
            </div>
            <div>
              <h3 class="font-bold text-sm text-slate-900 leading-tight">Pengaturan Hardware Printer Kasir</h3>
              <p class="text-[11px] text-slate-500 mt-0.5">Konfigurasi Printer Thermal USB, LAN Network & Ukuran Kertas</p>
            </div>
          </div>
          <button
            type="button"
            class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <!-- Hardware Status Card -->
          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                <Sliders :size="13" class="text-blue-600" />
                <span>Status Deteksi Perangkat Fisik:</span>
              </span>
              <button
                type="button"
                class="flex items-center gap-1 text-[10.5px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                :disabled="isDetecting"
                @click="detectHardware"
              >
                <RefreshCw :size="11" :class="{ 'animate-spin': isDetecting }" />
                <span>Pindai Ulang</span>
              </button>
            </div>

            <div class="grid grid-cols-2 gap-2 text-[11px]">
              <div class="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                <Cable :size="15" :class="hardwareStatus.usb_available ? 'text-emerald-600' : 'text-slate-400'" />
                <div class="min-w-0">
                  <span class="font-bold block text-slate-800">Printer USB:</span>
                  <span class="text-[10px] text-slate-500 truncate block">
                    {{ hardwareStatus.usb_available ? (hardwareStatus.usb_device_path || 'Terhubung') : 'Tidak terdeteksi' }}
                  </span>
                </div>
              </div>

              <div class="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center gap-2">
                <Bluetooth :size="15" :class="hardwareStatus.bluetooth_available ? 'text-indigo-600' : 'text-slate-400'" />
                <div class="min-w-0">
                  <span class="font-bold block text-slate-800">Bluetooth SPP:</span>
                  <span class="text-[10px] text-slate-500 truncate block">
                    {{ hardwareStatus.bluetooth_available ? (hardwareStatus.bluetooth_device_name || 'Terhubung') : 'Tidak terhubung' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Network LAN Thermal Printer Configuration -->
          <div class="space-y-3">
            <div class="flex items-center gap-2 font-bold text-slate-800 text-xs">
              <Network :size="14" class="text-purple-600" />
              <span>Printer Thermal LAN / Network (TCP Socket):</span>
            </div>

            <div>
              <label class="text-[11px] font-semibold text-slate-700 block mb-1">
                Alamat IP & Port Printer Network
              </label>
              <div class="flex items-center gap-2">
                <input
                  v-model="tempAddress"
                  type="text"
                  class="flex-1 bg-slate-50 focus:bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-mono text-slate-800 transition-colors"
                  placeholder="127.0.0.1:9100 atau 192.168.1.200:9100"
                />
                <button
                  type="button"
                  class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs border border-slate-300 cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                  :disabled="isTesting"
                  @click="handleTestNetworkPrint"
                >
                  <Send :size="12" :class="{ 'animate-pulse': isTesting }" />
                  <span>{{ isTesting ? 'Mengirim...' : 'Tes Cetak' }}</span>
                </button>
              </div>
              <span class="text-[10px] text-slate-400 mt-1 block">
                Kompatibel dengan virtual-thermal-printer, printer thermal WiFi, dan print server ESC/POS port 9100.
              </span>
            </div>

            <div v-if="testFeedback" class="p-2.5 rounded-lg text-[11px] font-medium" :class="testFeedback.type === 'ok' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-800 border border-rose-300'">
              {{ testFeedback.msg }}
            </div>
          </div>

          <!-- Paper Width Configuration -->
          <div class="space-y-3 pt-3 border-t border-slate-200">
            <div class="flex items-center gap-2 font-bold text-slate-800 text-xs">
              <Printer :size="14" class="text-blue-600" />
              <span>Format & Lebar Kertas Struk:</span>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <label
                class="p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all"
                :class="tempPaperWidth === '58mm' ? 'border-purple-600 bg-purple-50/50 shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-50'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs text-slate-900">58 mm (Standar)</span>
                  <input
                    type="radio"
                    value="58mm"
                    v-model="tempPaperWidth"
                    class="text-purple-600"
                  />
                </div>
                <span class="text-[10.5px] text-slate-500 leading-relaxed">
                  Lebar 32 kolom karakter. Cocok untuk printer kasir mini / portable Bluetooth.
                </span>
              </label>

              <label
                class="p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-all"
                :class="tempPaperWidth === '80mm' ? 'border-purple-600 bg-purple-50/50 shadow-xs' : 'border-slate-200 bg-white hover:bg-slate-50'"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs text-slate-900">80 mm (Lebar)</span>
                  <input
                    type="radio"
                    value="80mm"
                    v-model="tempPaperWidth"
                    class="text-purple-600"
                  />
                </div>
                <span class="text-[10.5px] text-slate-500 leading-relaxed">
                  Lebar 42 kolom karakter. Cocok untuk printer kasir meja supermarket / POS besar.
                </span>
              </label>
            </div>
          </div>

          <div v-if="saveFeedback" class="p-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-2">
            <CheckCircle2 :size="15" class="text-emerald-600" />
            <span>{{ saveFeedback }}</span>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            class="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold text-xs cursor-pointer shadow-2xs transition-colors"
            @click="emit('close')"
          >
            Batal
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs transition-colors disabled:opacity-50"
            :disabled="isSaving"
            @click="handleSave"
          >
            <Save :size="14" />
            <span>{{ isSaving ? 'Menyimpan...' : 'Simpan Pengaturan' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
