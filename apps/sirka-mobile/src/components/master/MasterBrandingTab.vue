<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import PrinterConfigModal from '../settings/PrinterConfigModal.vue';
import {
  THEME_PRESETS,
  SURFACE_PRESETS,
  ThemePreset,
  SurfacePreset,
  applyTheme,
  applySurfaceTheme,
  getContrastTextColor
} from '../../utils/theme';
import {
  BusinessType,
  BUSINESS_MODES
} from '../../types';
import {
  Store,
  Save,
  CheckCircle2,
  Palette,
  RotateCcw,
  Sparkles,
  Sliders,
  Eye,
  Check,
  CreditCard,
  ShoppingBag,
  Monitor,
  Printer,
  FileText,
  Phone,
  Image as ImageIcon,
  Upload,
  Trash2,
  UtensilsCrossed,
  Wrench,
  Truck,
  Layers
} from 'lucide-vue-next';

const settingsStore = useSettingsStore();

const tempStore = ref({
  name: settingsStore.storeName || 'Sirka',
  code: settingsStore.storeCode || 'SIRKA',
  tagline: settingsStore.storeTagline || '',
  address: settingsStore.storeAddress || '',
  phone: settingsStore.storePhone || '',
  invoicePrefix: settingsStore.invoicePrefix || 'INV-B2B',
  logo: settingsStore.settings.store_logo || '',
  footer: settingsStore.receiptFooter || 'Terima kasih atas kunjungan Anda',
  paperWidth: settingsStore.receiptPaperWidth || '58mm'
});

const isUserDirty = ref(false);
const showPrinterModal = ref(false);
const activeBusinessType = ref<BusinessType>(settingsStore.businessType);

watch(
  () => settingsStore.settings,
  () => {
    if (!isUserDirty.value) {
      activeBusinessType.value = settingsStore.businessType;
      tempStore.value.name = settingsStore.storeName || 'Sirka';
      tempStore.value.code = settingsStore.storeCode || 'SIRKA';
      tempStore.value.tagline = settingsStore.storeTagline || '';
      tempStore.value.address = settingsStore.storeAddress || '';
      tempStore.value.phone = settingsStore.storePhone || '';
      tempStore.value.invoicePrefix = settingsStore.invoicePrefix || 'INV';
      tempStore.value.logo = settingsStore.settings.store_logo || '';
      tempStore.value.footer = settingsStore.receiptFooter || 'Terima kasih atas kunjungan Anda';
      tempStore.value.paperWidth = settingsStore.receiptPaperWidth || '58mm';
      activeColor.value = settingsStore.primaryColor || '#2563eb';
      activePreset.value = settingsStore.themePreset || 'blue';
      activeHeaderStyle.value = settingsStore.headerAccentStyle || 'accent-line';
      activeSurface.value = settingsStore.surfaceTheme || 'bone-white';
      customSurfaceColor.value = settingsStore.customSurfaceColor || '#fcfbfa';
    }
  },
  { deep: true }
);

// Watch changes to mark dirty
watch(
  tempStore,
  () => {
    isUserDirty.value = true;
  },
  { deep: true }
);

// BUG FIX (keamanan): token akses Worker (OWNER_SECRET_KEY) diperlukan agar
// rekap shift kasir bisa dikirim ke dashboard owner. Tanpa token, Worker
// membalas 401 dan rekap shift tidak pernah sampai.
//
// Token disimpan KHUSUS di localStorage perangkat ini — BUKAN di
// `store_settings` (tabel yang ikut ter-sinkron ke PostgreSQL cloud), supaya
// tidak bocor ke database.
const ownerApiToken = ref<string>(settingsStore.ownerApiToken || '');

const logoFileInput = ref<HTMLInputElement | null>(null);

function triggerLogoUpload() {
  logoFileInput.value?.click();
}

function handleLogoFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Harap pilih file gambar (PNG, JPG, SVG, WebP).');
    return;
  }

  // Maksimal 2MB
  if (file.size > 2 * 1024 * 1024) {
    alert('Ukuran file logo maksimal 2 MB agar performa tetap cepat.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result as string;
    if (result) {
      tempStore.value.logo = result;
    }
  };
  reader.readAsDataURL(file);
}

function handleRemoveLogo() {
  tempStore.value.logo = '';
  if (logoFileInput.value) {
    logoFileInput.value.value = '';
  }
}

// UI Brand Theme state
const activeColor = ref(settingsStore.primaryColor);
const activePreset = ref(settingsStore.themePreset);
const activeHeaderStyle = ref(settingsStore.headerAccentStyle);

// UI Surface / Gray Background Theme state
const activeSurface = ref(settingsStore.surfaceTheme);
const customSurfaceColor = ref(settingsStore.customSurfaceColor);

const brandingSaved = ref(false);

// Live preview when selecting presets
function selectPreset(preset: ThemePreset) {
  activeColor.value = preset.primary;
  activePreset.value = preset.id;
  applyTheme(preset.primary, activeHeaderStyle.value, activeSurface.value, customSurfaceColor.value);
}

// Live preview when selecting surface themes
function selectSurface(surface: SurfacePreset) {
  activeSurface.value = surface.id;
  applySurfaceTheme(surface.id);
}

// Live preview when changing custom color
function onCustomColorInput(event: Event) {
  const target = event.target as HTMLInputElement;
  activeColor.value = target.value;
  activePreset.value = 'custom';
  applyTheme(target.value, activeHeaderStyle.value, activeSurface.value, customSurfaceColor.value);
}

function onHexTextInput(value: string) {
  let hex = value.trim();
  if (!hex.startsWith('#')) {
    hex = '#' + hex;
  }
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
    activeColor.value = hex;
    activePreset.value = 'custom';
    applyTheme(hex, activeHeaderStyle.value, activeSurface.value, customSurfaceColor.value);
  }
}

function resetToDefault() {
  tempStore.value.name = 'Sirka';
  tempStore.value.code = 'SIRKA';
  tempStore.value.tagline = 'Distribusi B2B & Hub Pengadaan';
  tempStore.value.address = 'Jl. Sentral Distribusi No. 8';
  tempStore.value.phone = '0812-3456-7890';
  tempStore.value.invoicePrefix = 'INV-B2B';
  tempStore.value.logo = '';
  tempStore.value.footer = 'Terima kasih atas kunjungan Anda';
  tempStore.value.paperWidth = '58mm';
  activeBusinessType.value = 'universal';
  activeColor.value = '#2563eb';
  activePreset.value = 'blue';
  activeHeaderStyle.value = 'accent-line';
  activeSurface.value = 'bone-white';
  customSurfaceColor.value = '#fcfbfa';
  applyTheme('#2563eb', 'accent-line', 'bone-white', '#fcfbfa');
  isUserDirty.value = true;
}

async function handleSaveAll() {
  // BUG FIX: `Promise.all` tanpa catch -> satu setting yang gagal membuat
  // seluruh promise menolak sehingga `brandingSaved` tidak pernah true dan
  // user tidak mendapat pesan error sama sekali.
  try {
    const nameVal = (tempStore.value.name || '').trim() || 'Sirka';
    const codeVal = (tempStore.value.code || '').trim().toUpperCase() || 'SIRKA';
    const taglineVal = (tempStore.value.tagline || '').trim();
    const addressVal = (tempStore.value.address || '').trim();
    const phoneVal = (tempStore.value.phone || '').trim();
    const prefixVal = (tempStore.value.invoicePrefix || '').trim() || 'INV';
    const logoVal = tempStore.value.logo && tempStore.value.logo !== '/logo.png' ? tempStore.value.logo : '';
    const footerVal = (tempStore.value.footer || '').trim() || 'Terima kasih atas kunjungan Anda';
    const paperVal = tempStore.value.paperWidth || '58mm';

    await Promise.all([
      settingsStore.setBusinessType(activeBusinessType.value),
      settingsStore.updateSetting('store_name', nameVal),
      settingsStore.updateSetting('store_code', codeVal),
      settingsStore.updateSetting('store_tagline', taglineVal),
      settingsStore.updateSetting('store_address', addressVal),
      settingsStore.updateSetting('store_phone', phoneVal),
      settingsStore.updateSetting('invoice_prefix', prefixVal),
      settingsStore.updateSetting('store_logo', logoVal),
      settingsStore.updateSetting('receipt_footer', footerVal),
      settingsStore.updateSetting('receipt_paper_width', paperVal),
      // BUG FIX (keamanan): token disimpan di localStorage saja, tidak di
      // store_settings (yang ikut ter-sync ke cloud).
      settingsStore.setOwnerApiToken(ownerApiToken.value),
      settingsStore.setTheme(activeColor.value, activePreset.value, activeHeaderStyle.value),
      settingsStore.setSurfaceTheme(activeSurface.value, customSurfaceColor.value)
    ]);

    isUserDirty.value = false;
    brandingSaved.value = true;
    setTimeout(() => {
      brandingSaved.value = false;
    }, 4000);
  } catch (err: any) {
    console.warn('[Branding] Gagal menyimpan pengaturan:', err);
    alert('Gagal menyimpan pengaturan branding ke database. Perubahan hanya tersimpan sementara di perangkat ini.\n\n' + (err?.message || err));
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-white select-none text-xs overflow-hidden">
    <!-- Layer 1: Ribbon Header (Standar Kulakan) -->
    <div
      v-horizontal-scroll
      class="relative flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 py-1.5 select-none shrink-0 gap-1.5 overflow-x-auto no-scrollbar">
      <div class="flex items-center gap-2 shrink-0">
        <Store :size="15" class="text-purple-700" />
        <span class="font-bold text-xs text-gray-800">Profil Usaha & Format Struk</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold">{{ tempStore.name
          || 'Sirka' }} ({{ (tempStore.code || 'SIRKA').toUpperCase() }})</span>
      </div>

      <div class="flex items-center gap-2 shrink-0 ml-auto">
        <button @click="resetToDefault"
          class="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0">
          <RotateCcw :size="13" />
          <span>Reset Default</span>
        </button>
        <button @click="handleSaveAll"
          class="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer shrink-0">
          <Save :size="13" />
          <span>Simpan Profil Toko</span>
        </button>
      </div>
    </div>

    <!-- Notification Banner jika tersimpan -->
    <div v-if="brandingSaved"
      class="bg-emerald-600 text-white px-4 py-1.5 flex items-center justify-between text-xs font-semibold shrink-0 shadow-xs animate-in fade-in">
      <div class="flex items-center gap-2">
        <CheckCircle2 :size="15" />
        <span>Profil Usaha dan Kustomisasi Warna UI Berhasil Disimpan & Diterapkan ke Seluruh Sistem!</span>
      </div>
      <span class="text-[10px] bg-emerald-700 px-2 py-0.5 rounded">Tersinkronisasi</span>
    </div>

    <!-- 1. Ringkasan Metrik Cepat Profil & Branding (Seimbang Terbagi Rata 6 Kolom, Identik Kulakan) -->
    <div
      v-horizontal-scroll
      class="flex items-center divide-x divide-gray-200 px-2 py-2 border-b border-gray-200 bg-white shrink-0 overflow-x-auto no-scrollbar snap-x scroll-smooth cursor-grab active:cursor-grabbing"
    >
      <!-- 1. Nama Usaha Terdaftar -->
      <div class="flex items-center gap-2 px-2.5 first:pl-1 flex-1 min-w-[160px] sm:min-w-0 shrink-0 sm:shrink snap-start">
        <div
          class="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 overflow-hidden border border-blue-100">
          <img :src="tempStore.logo || '/logo.png'" alt="Logo" class="w-full h-full object-contain p-0.5" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Nama Usaha / Toko</div>
          <div class="text-xs font-bold text-gray-800 font-mono mt-0.5 truncate">{{ tempStore.name || 'Sirka' }}</div>
        </div>
      </div>

      <!-- 2. Prefix Faktur -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-[160px] sm:min-w-0 shrink-0 sm:shrink snap-start">
        <div class="w-7 h-7 rounded bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
          <FileText :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Prefix Faktur</div>
          <div class="text-xs font-bold text-purple-800 font-mono mt-0.5 truncate">{{ tempStore.invoicePrefix || 'INV'
            }}</div>
        </div>
      </div>

      <!-- 3. WhatsApp Kontak -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-[160px] sm:min-w-0 shrink-0 sm:shrink snap-start">
        <div class="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <Phone :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">No. WhatsApp</div>
          <div class="text-xs font-bold text-emerald-800 font-mono mt-0.5 truncate">{{ tempStore.phone || '-' }}</div>
        </div>
      </div>

      <!-- 4. Warna Brand UI -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-[160px] sm:min-w-0 shrink-0 sm:shrink snap-start">
        <div class="w-7 h-7 rounded flex items-center justify-center text-white shrink-0 shadow-2xs"
          :style="{ backgroundColor: activeColor }">
          <Palette :size="14" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Warna Brand UI</div>
          <div class="text-xs font-bold text-gray-900 font-mono mt-0.5 truncate uppercase">{{ activeColor }}</div>
        </div>
      </div>

      <!-- 5. Tema Surface Latar -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-[160px] sm:min-w-0 shrink-0 sm:shrink snap-start">
        <div class="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          <Monitor :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Latar Permukaan</div>
          <div class="text-xs font-bold text-amber-800 font-mono mt-0.5 truncate capitalize">{{ activeSurface }}</div>
        </div>
      </div>

      <!-- 6. Format Struk Kasir -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-[160px] sm:min-w-0 shrink-0 sm:shrink snap-start cursor-pointer hover:bg-gray-50 transition-colors"
        @click="showPrinterModal = true" title="Klik untuk konfigurasi printer & ukuran kertas nota">
        <div class="w-7 h-7 rounded bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
          <Printer :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Format Nota Struk</div>
          <div class="text-xs font-bold text-teal-800 font-mono mt-0.5 truncate">{{ tempStore.paperWidth ||
            settingsStore.receiptPaperWidth }} ESC/POS</div>
        </div>
      </div>
    </div>

    <!-- 2. Workspace: Edge-to-Edge Split Layout (Kiri: Profil Usaha, Kanan: Kustomisasi Tema) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- SISI KIRI: PROFIL IDENTITAS USAHA & STRUK -->
      <div
        class="w-full lg:w-[460px] xl:w-[480px] flex flex-col border-r border-gray-200 overflow-hidden bg-white shrink-0">
        <!-- Sub-Header Baris Profil -->
        <div class="px-4 py-2.5 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <Store :size="14" class="text-purple-700" />
            <span class="font-bold text-xs text-gray-800">Profil Usaha & Identitas Struk</span>
          </div>
          <span class="text-[10px] text-gray-500">Header Faktur Nota</span>
        </div>

        <!-- Form Vertikal Flat Tanpa Box Card -->
        <form @submit.prevent="handleSaveAll" class="flex-1 flex flex-col justify-between overflow-hidden">
          <div class="flex-1 overflow-y-auto p-4 space-y-3.5">
            <!-- 0. Pilihan Mode & Jenis Usaha Universal -->
            <div class="p-3 bg-gradient-to-br from-slate-50 to-indigo-50/50 border border-indigo-200/80 rounded-xl shadow-2xs">
              <div class="flex items-center justify-between mb-2">
                <label class="text-[11.5px] font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers :size="14" class="text-indigo-600" />
                  <span>Mode & Jenis Usaha</span>
                </label>
                <span
                  class="text-[9.5px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider"
                  :class="BUSINESS_MODES[activeBusinessType].badgeColor"
                >
                  {{ BUSINESS_MODES[activeBusinessType].title }}
                </span>
              </div>
              <p class="text-[10.5px] text-slate-500 mb-2.5 leading-relaxed">
                Pilih model operasional usaha Anda. Fitur kasir, istilah modul, dan pengaturan alur kerja akan menyesuaikan otomatis:
              </p>

              <!-- Grid 5 Pilihan Mode Usaha -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <!-- 1. Retail -->
                <button
                  type="button"
                  @click="activeBusinessType = 'retail'; isUserDirty = true"
                  class="p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between"
                  :class="activeBusinessType === 'retail'
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'"
                >
                  <div class="flex items-start justify-between gap-1 mb-1">
                    <div class="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                      <ShoppingBag :size="13" class="text-emerald-600 shrink-0" />
                      <span>Ritel & Kelontong</span>
                    </div>
                    <Check v-if="activeBusinessType === 'retail'" :size="13" class="text-emerald-600 shrink-0 font-bold" />
                  </div>
                  <div class="text-[9.5px] text-slate-500 leading-tight mb-1.5">
                    Barcode scanner, multi-satuan (pcs/dus), kasir cepat, stok fisik.
                  </div>
                  <div class="flex items-center gap-1 flex-wrap">
                    <span class="text-[8.5px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-medium">Fast Checkout</span>
                    <span class="text-[8.5px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">Multi-Satuan</span>
                  </div>
                </button>

                <!-- 2. F&B (Kafe/Resto) -->
                <button
                  type="button"
                  @click="activeBusinessType = 'fnb'; isUserDirty = true"
                  class="p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between"
                  :class="activeBusinessType === 'fnb'
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'"
                >
                  <div class="flex items-start justify-between gap-1 mb-1">
                    <div class="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                      <UtensilsCrossed :size="13" class="text-amber-600 shrink-0" />
                      <span>F&B / Kuliner</span>
                    </div>
                    <Check v-if="activeBusinessType === 'fnb'" :size="13" class="text-amber-600 shrink-0 font-bold" />
                  </div>
                  <div class="text-[9.5px] text-slate-500 leading-tight mb-1.5">
                    Meja (Dine-in/Takeaway), varian menu (pedas/topping), tiket dapur.
                  </div>
                  <div class="flex items-center gap-1 flex-wrap">
                    <span class="text-[8.5px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-medium">No. Meja</span>
                    <span class="text-[8.5px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">Varian Rasa</span>
                  </div>
                </button>

                <!-- 3. Jasa & Layanan -->
                <button
                  type="button"
                  @click="activeBusinessType = 'service'; isUserDirty = true"
                  class="p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between"
                  :class="activeBusinessType === 'service'
                    ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'"
                >
                  <div class="flex items-start justify-between gap-1 mb-1">
                    <div class="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                      <Wrench :size="13" class="text-indigo-600 shrink-0" />
                      <span>Jasa & Servis</span>
                    </div>
                    <Check v-if="activeBusinessType === 'service'" :size="13" class="text-indigo-600 shrink-0 font-bold" />
                  </div>
                  <div class="text-[9.5px] text-slate-500 leading-tight mb-1.5">
                    Barbershop, bengkel, laundry. Bebas stok gudang, catat teknisi.
                  </div>
                  <div class="flex items-center gap-1 flex-wrap">
                    <span class="text-[8.5px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-medium">Staf Pengerja</span>
                    <span class="text-[8.5px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">Bebas Stok</span>
                  </div>
                </button>

                <!-- 4. Grosir & Distribusi -->
                <button
                  type="button"
                  @click="activeBusinessType = 'wholesale'; isUserDirty = true"
                  class="p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between"
                  :class="activeBusinessType === 'wholesale'
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-200 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'"
                >
                  <div class="flex items-start justify-between gap-1 mb-1">
                    <div class="flex items-center gap-1.5 font-bold text-slate-800 text-[11px]">
                      <Truck :size="13" class="text-blue-600 shrink-0" />
                      <span>Grosir & Distribusi</span>
                    </div>
                    <Check v-if="activeBusinessType === 'wholesale'" :size="13" class="text-blue-600 shrink-0 font-bold" />
                  </div>
                  <div class="text-[9.5px] text-slate-500 leading-tight mb-1.5">
                    Harga grosir bertingkat, piutang tempo B2B, PO matriks pengiriman.
                  </div>
                  <div class="flex items-center gap-1 flex-wrap">
                    <span class="text-[8.5px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-medium">Tier Pricing</span>
                    <span class="text-[8.5px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">Nota Tempo</span>
                  </div>
                </button>
              </div>

              <!-- 5. Universal Card (Full Width) -->
              <button
                type="button"
                @click="activeBusinessType = 'universal'; isUserDirty = true"
                class="w-full mt-2 p-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between"
                :class="activeBusinessType === 'universal'
                  ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-200 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Layers :size="16" />
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 font-bold text-slate-800 text-[11.5px]">
                      <span>Universal (Semua Fitur Aktif)</span>
                      <span class="text-[9px] bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-semibold">Rekomendasi</span>
                    </div>
                    <div class="text-[10px] text-slate-500 truncate">
                      Kombinasi fleksibel untuk usaha campuran (jual barang + makanan + jasa layanan).
                    </div>
                  </div>
                </div>
                <Check v-if="activeBusinessType === 'universal'" :size="15" class="text-purple-600 shrink-0 font-bold ml-2" />
              </button>
            </div>

            <!-- Pengaturan Logo Toko / Usaha -->
            <div class="p-3 bg-purple-50/60 border border-purple-200/90 rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <label class="text-[11px] font-bold text-purple-950 flex items-center gap-1.5">
                  <ImageIcon :size="14" class="text-purple-700" />
                  <span>Logo Toko & Kartu Member</span>
                </label>
                <span class="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded font-medium">
                  {{ tempStore.logo ? 'Logo Kustom' : 'Logo Default Sirka' }}
                </span>
              </div>

              <div class="flex items-center gap-3">
                <!-- Preview Box Logo -->
                <div
                  class="w-14 h-14 rounded-lg bg-white border border-gray-300 shadow-inner flex items-center justify-center overflow-hidden shrink-0 relative group">
                  <img :src="tempStore.logo || '/logo.png'" alt="Logo Toko" class="w-full h-full object-contain p-1" />
                  <span v-if="!tempStore.logo"
                    class="absolute bottom-0 inset-x-0 bg-purple-900/80 text-[8px] text-white font-mono text-center py-0.5 tracking-tight font-bold">
                    DEFAULT
                  </span>
                </div>

                <!-- Action Buttons & Details -->
                <div class="flex-1 min-w-0">
                  <input ref="logoFileInput" type="file" accept="image/png, image/jpeg, image/webp, image/svg+xml"
                    class="hidden" @change="handleLogoFileChange" />
                  <div class="flex items-center gap-2">
                    <button type="button"
                      class="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 active:bg-gray-100 text-gray-700 border border-gray-300 rounded font-semibold text-xs cursor-pointer shadow-2xs transition-colors"
                      @click="triggerLogoUpload">
                      <Upload :size="13" class="text-purple-700" />
                      <span>{{ tempStore.logo ? 'Ganti Logo' : 'Upload Logo Baru' }}</span>
                    </button>
                    <button v-if="tempStore.logo" type="button"
                      class="flex items-center gap-1 px-2 py-1.5 text-red-600 hover:bg-red-50 rounded font-semibold text-xs cursor-pointer transition-colors border border-transparent hover:border-red-200"
                      title="Kembalikan ke Logo Default Sirka" @click="handleRemoveLogo">
                      <Trash2 :size="13" />
                      <span>Pakai Default</span>
                    </button>
                  </div>
                  <p class="text-[10px] text-gray-500 mt-1 leading-snug">
                    Format PNG, JPG, WebP, SVG. Tampil di titlebar atas, kartu member, dan nota pembayaran (default:
                    logo resmi Sirka).
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label class="text-[11px] font-semibold text-gray-700 block mb-1">Nama Usaha / Toko / Hub *</label>
              <input v-model="tempStore.name" type="text" required
                class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-bold text-gray-900"
                placeholder="Misal: Sirka / Toko Berkah" />
            </div>

            <div>
              <label class="text-[11px] font-semibold text-gray-700 block mb-1">Tagline / Deskripsi Usaha</label>
              <input v-model="tempStore.tagline" type="text"
                class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 text-gray-800"
                placeholder="Misal: Distribusi Bahan Pokok & Sembako Murah" />
            </div>

            <div class="grid grid-cols-3 gap-2.5">
              <div>
                <label class="text-[11px] font-semibold text-gray-700 block mb-1">No. WhatsApp Toko</label>
                <input v-model="tempStore.phone" type="text"
                  class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-purple-600 font-mono text-gray-800"
                  placeholder="0812-3456-7890" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-gray-700 block mb-1">Prefix Faktur</label>
                <input v-model="tempStore.invoicePrefix" type="text"
                  class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-purple-600 font-mono uppercase font-bold text-purple-900"
                  placeholder="INV-B2B" />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-gray-700 block mb-1">Singkatan Toko *</label>
                <input v-model="tempStore.code" type="text" maxlength="10"
                  class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-purple-600 font-mono uppercase font-bold text-blue-900"
                  placeholder="SIRKA" />
              </div>
              <!--
                BUG FIX (keamanan): token akses Worker (OWNER_SECRET_KEY).
                Di-set di server lewat `wrangler secret put OWNER_SECRET_KEY`.
                Tanpa token, rekap shift kasir ditolak Worker (401) dan tidak
                pernah sampai ke dashboard owner.
              -->
              <div class="md:col-span-2">
                <label class="text-[11px] font-semibold text-gray-700 block mb-1">
                  Token Akses Worker (Dashboard Owner)
                </label>
                <input v-model="ownerApiToken" type="password" autocomplete="off"
                  class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs outline-none focus:border-purple-600 font-mono text-gray-800"
                  placeholder="OWNER_SECRET_KEY (kosongkan bila Worker tanpa proteksi token)" />
                <p class="text-[10px] text-gray-500 mt-1">
                  Token dibuat di server dengan perintah
                  <code class="font-mono">wrangler secret put OWNER_SECRET_KEY</code>.
                  Nilai ini disimpan di database lokal perangkat ini (bukan di dalam
                  binary).
                </p>
              </div>
            </div>

            <!-- Preview Sinkronisasi Nomor Kartu Member -->
            <div class="p-2 rounded bg-blue-50/80 border border-blue-200 flex items-center justify-between text-[11px]">
              <div class="flex items-center gap-1.5 text-blue-950 font-medium">
                <CreditCard :size="13" class="text-blue-700" />
                <span>Format Kartu Member:</span>
              </div>
              <span
                class="font-mono font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-300 shadow-2xs">
                {{ (tempStore.code || 'SIRKA').toUpperCase() }}-XXXX
              </span>
            </div>

            <div>
              <label class="text-[11px] font-semibold text-gray-700 block mb-1">Alamat Fisik Gudang / Toko</label>
              <textarea v-model="tempStore.address" rows="3"
                class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 resize-none text-gray-800"
                placeholder="Alamat fisik yang dicetak pada faktur nota & struk pembelian"></textarea>
            </div>

            <div>
              <label class="text-[11px] font-semibold text-gray-700 block mb-1">Catatan Kaki Struk (Receipt
                Footer)</label>
              <input v-model="tempStore.footer" type="text"
                class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 text-gray-800"
                placeholder="Misal: Terima kasih atas kunjungan Anda" />
            </div>

            <!-- Pengaturan Format Kertas & Hardware Printer Struk -->
            <div class="p-3 bg-teal-50/70 border border-teal-200/90 rounded-lg space-y-2.5">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold text-teal-950 flex items-center gap-1.5">
                  <Printer :size="14" class="text-teal-700" />
                  <span>Ukuran Kertas & Printer Thermal Nota</span>
                </label>
                <button type="button" @click="showPrinterModal = true"
                  class="text-[10px] text-teal-800 hover:text-teal-950 bg-white hover:bg-teal-100/60 border border-teal-300 font-bold px-2 py-0.5 rounded cursor-pointer transition-colors shadow-2xs">
                  ⚙️ Detail Hardware
                </button>
              </div>

              <div class="flex items-center gap-2">
                <div class="inline-flex rounded border border-teal-300 bg-white p-0.5 shadow-2xs">
                  <button type="button" class="px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer"
                    :class="tempStore.paperWidth === '58mm' ? 'bg-teal-600 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'"
                    @click="tempStore.paperWidth = '58mm'">
                    58mm (Mini)
                  </button>
                  <button type="button" class="px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer"
                    :class="tempStore.paperWidth === '80mm' ? 'bg-teal-600 text-white shadow-2xs' : 'text-gray-600 hover:text-gray-900'"
                    @click="tempStore.paperWidth = '80mm'">
                    80mm (Lebar)
                  </button>
                </div>
                <span class="text-[10px] text-teal-800 leading-tight">
                  Mendukung printer Thermal USB, Bluetooth, & ESC/POS LAN.
                </span>
              </div>
            </div>

            <!-- Mini Live Preview Struk Nota -->
            <div class="pt-3 border-t border-gray-200">
              <span class="text-[11px] font-bold text-gray-700 block mb-1.5">Simulasi Header & Footer Struk
                Kasir:</span>
              <div
                class="bg-[#faf9f7] border border-gray-300 rounded p-3 font-mono text-center space-y-0.5 text-gray-800 text-[11px] select-text">
                <img v-if="tempStore.logo" :src="tempStore.logo" alt="Logo Toko"
                  class="w-8 h-8 object-contain mx-auto mb-1 rounded" />
                <div class="font-bold text-xs uppercase tracking-wider">{{ tempStore.name || 'SIRKA' }}</div>
                <div class="text-[10px] text-gray-500">{{ tempStore.tagline || 'Pusat Kulakan & Eceran' }}</div>
                <div class="text-[10px] text-gray-500">{{ tempStore.address || 'Jl. Raya Perdagangan No. 12' }}</div>
                <div class="text-[10px] text-gray-500">WA: {{ tempStore.phone || '0812-3456-7890' }}</div>
                <div class="border-b border-dashed border-gray-400 my-1.5"></div>
                <div class="flex justify-between text-[10px] text-gray-600">
                  <span>{{ tempStore.invoicePrefix || 'INV' }}-202610-001</span>
                  <span>19/10/2026 14:30</span>
                </div>
                <div
                  class="text-[9.5px] text-blue-700 font-mono text-left pt-1 border-t border-dashed border-gray-300 mt-1 flex justify-between">
                  <span>Member: {{ (tempStore.code || 'SIRKA').toUpperCase() }}-1024</span>
                  <span>Poin: +10</span>
                </div>
                <div
                  class="text-[9.5px] text-gray-500 font-mono text-center pt-1.5 border-t border-dashed border-gray-300 mt-1.5">
                  {{ tempStore.footer || 'Terima kasih atas kunjungan Anda' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Sticky Bottom Save Bar -->
          <div class="p-3 bg-[#f6f5f2] border-t border-gray-200 flex items-center justify-between shrink-0">
            <span class="text-[10px] text-gray-500">Tersimpan otomatis ke database lokal</span>
            <button type="submit"
              class="flex items-center gap-1.5 px-4 py-1.5 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-all">
              <Save :size="13" />
              <span>Simpan Profil Toko</span>
            </button>
          </div>
        </form>
      </div>

      <!-- SISI KANAN: KUSTOMISASI TEMA & WARNA UI KASIR -->
      <div class="flex-1 flex flex-col overflow-hidden bg-[#faf9f7]">
        <!-- Sub-Header Baris Tema -->
        <div class="px-4 py-2.5 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-2">
            <Palette :size="14" class="text-purple-700" />
            <span class="font-bold text-xs text-gray-800">Kustomisasi Tema, Palet Warna & Permukaan UI</span>
          </div>

          <button type="button"
            class="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-300 px-2 py-1 rounded cursor-pointer transition-colors shadow-2xs"
            title="Kembalikan ke warna biru default" @click="resetToDefault">
            <RotateCcw :size="11" />
            <span>Reset Default</span>
          </button>
        </div>

        <!-- Konten Tema Flat Scrollable -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- 1. PRESET COLOR PALETTES -->
          <div class="p-3 bg-white border border-gray-200 rounded">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Sparkles :size="13" class="text-amber-500" />
                <span>Pilihan Palet Preset Cepat:</span>
              </span>
              <span class="text-[10px] text-gray-400">Live preview instan</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button v-for="preset in THEME_PRESETS" :key="preset.id" type="button"
                class="flex items-center gap-2 p-2 rounded border text-left cursor-pointer transition-all relative overflow-hidden"
                :class="activePreset === preset.id
                  ? 'border-gray-900 bg-gray-50 shadow-xs ring-1 ring-gray-900/10'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'" @click="selectPreset(preset)">
                <div class="w-4 h-4 rounded-full shrink-0 shadow-xs flex items-center justify-center text-white"
                  :style="{ backgroundColor: preset.primary }">
                  <Check v-if="activePreset === preset.id" :size="10" stroke-width="3" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-[11px] truncate text-gray-800 leading-tight">
                    {{ preset.name }}
                  </div>
                  <div class="font-mono text-[9px] text-gray-400 truncate">
                    {{ preset.primary }}
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- 2. CUSTOM COLOR PICKER (HEX & NATIVE PICKER) -->
          <div class="p-3 bg-white border border-gray-200 rounded">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Sliders :size="13" class="text-gray-600" />
                <span>Pilih Warna Bebas (Custom HEX):</span>
              </span>
              <span class="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200">
                {{ activeColor.toUpperCase() }}
              </span>
            </div>

            <div class="flex items-center gap-3">
              <label
                class="relative w-8 h-8 rounded-full border border-gray-300 shadow-xs cursor-pointer overflow-hidden shrink-0 transition-transform hover:scale-105"
                :style="{ backgroundColor: activeColor }" title="Klik untuk memilih warna bebas">
                <input type="color" :value="activeColor" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  @input="onCustomColorInput" />
              </label>

              <div class="flex-1 max-w-[160px]">
                <input type="text" :value="activeColor" maxlength="7"
                  class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-gray-800 outline-none focus:border-purple-600 uppercase"
                  placeholder="#2563EB" @input="(e) => onHexTextInput((e.target as HTMLInputElement).value)" />
              </div>

              <!-- Quick Swatches -->
              <div class="flex items-center gap-1.5 ml-auto">
                <button type="button"
                  class="w-5 h-5 rounded-full bg-[#2563eb] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Citra Blue" @click="onHexTextInput('#2563eb')"></button>
                <button type="button"
                  class="w-5 h-5 rounded-full bg-[#059669] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Emerald Green" @click="onHexTextInput('#059669')"></button>
                <button type="button"
                  class="w-5 h-5 rounded-full bg-[#7c3aed] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Royal Violet" @click="onHexTextInput('#7c3aed')"></button>
                <button type="button"
                  class="w-5 h-5 rounded-full bg-[#d97706] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Warm Amber" @click="onHexTextInput('#d97706')"></button>
                <button type="button"
                  class="w-5 h-5 rounded-full bg-[#e11d48] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Ruby Red" @click="onHexTextInput('#e11d48')"></button>
              </div>
            </div>
          </div>

          <!-- 3. SURFACE / GRAY BACKGROUND THEME CHOICES -->
          <div class="p-3 bg-white border border-gray-200 rounded space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Monitor :size="13" class="text-gray-600" />
                <span>Warna Latar & Abu-abu Sistem (Surface Theme):</span>
              </span>
              <span class="text-[10px] text-gray-500">Nuansa desktop OS</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <button v-for="surface in SURFACE_PRESETS" :key="surface.id" type="button"
                class="flex flex-col p-2 rounded border text-left cursor-pointer transition-all relative overflow-hidden group"
                :class="activeSurface === surface.id
                  ? 'border-gray-900 bg-gray-50 shadow-xs ring-1 ring-gray-900/15'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'" @click="selectSurface(surface)">
                <div class="w-full h-6 rounded border border-gray-300 flex overflow-hidden mb-1.5 shadow-2xs">
                  <div class="w-1/3 h-full" :style="{ backgroundColor: surface.headerHex }"></div>
                  <div class="w-1/3 h-full" :style="{ backgroundColor: surface.tabBarHex }"></div>
                  <div class="w-1/3 h-full" :style="{ backgroundColor: surface.bgHex }"></div>
                </div>

                <div class="flex items-center justify-between gap-1">
                  <span class="font-bold text-[11px] truncate text-gray-800">
                    {{ surface.name }}
                  </span>
                  <Check v-if="activeSurface === surface.id" :size="12" class="text-emerald-600 shrink-0"
                    stroke-width="3" />
                </div>
              </button>
            </div>
          </div>

          <!-- 4. LIVE COMPONENT PREVIEW SIMULATOR -->
          <div class="p-3 bg-white border border-gray-200 rounded">
            <div class="flex items-center justify-between mb-2 text-gray-500">
              <span class="flex items-center gap-1 font-bold text-[11px] text-gray-700">
                <Eye :size="12" />
                <span>Simulasi Tampilan Komponen UI:</span>
              </span>
              <span class="text-[10px]">Real-time Preview</span>
            </div>

            <div class="flex flex-wrap items-center gap-2.5 pt-1">
              <button type="button"
                class="px-3 py-1.5 rounded font-bold text-xs shadow-xs transition-all flex items-center gap-1.5" :style="{
                  backgroundColor: activeColor,
                  color: getContrastTextColor(activeColor)
                }">
                <ShoppingBag :size="13" />
                <span>Tombol Utama POS</span>
              </button>

              <span class="px-2.5 py-1 rounded border font-semibold text-[11px] flex items-center gap-1" :style="{
                borderColor: activeColor,
                color: activeColor,
                backgroundColor: `color-mix(in srgb, ${activeColor} 10%, transparent)`
              }">
                <Check :size="11" />
                <span>Status Aktif</span>
              </span>

              <span class="px-2.5 py-1 rounded-full font-bold text-[10px] text-white flex items-center gap-1 shadow-xs"
                :style="{ backgroundColor: activeColor }">
                <CreditCard :size="11" />
                <span>Tier Member</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Bottom Action Bar untuk Tema -->
        <div class="p-3 bg-[#f6f5f2] border-t border-gray-200 flex items-center justify-between shrink-0">
          <span class="text-[10px] text-gray-500">Tema tersimpan otomatis ke Cloud & penyimpanan lokal</span>
          <button type="button"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded font-bold text-xs text-white cursor-pointer shadow-xs transition-all hover:brightness-110 active:brightness-95"
            :style="{ backgroundColor: activeColor }" @click="handleSaveAll">
            <Save :size="13" />
            <span>Simpan & Terapkan Tema</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Konfigurasi Hardware Printer (Modular Component) -->
    <PrinterConfigModal :is-open="showPrinterModal"
      @close="showPrinterModal = false; tempStore.paperWidth = settingsStore.receiptPaperWidth;" />
  </div>
</template>
