<script setup lang="ts">
import { ref } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
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
  Phone
} from 'lucide-vue-next';

const settingsStore = useSettingsStore();

const tempStore = ref({
  name: settingsStore.storeName,
  tagline: settingsStore.storeTagline,
  address: settingsStore.storeAddress,
  phone: settingsStore.storePhone,
  invoicePrefix: settingsStore.invoicePrefix
});

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
  activeColor.value = '#2563eb';
  activePreset.value = 'blue';
  activeHeaderStyle.value = 'accent-line';
  activeSurface.value = 'bone-white';
  customSurfaceColor.value = '#fcfbfa';
  applyTheme('#2563eb', 'accent-line', 'bone-white', '#fcfbfa');
}

async function handleSaveAll() {
  await Promise.all([
    settingsStore.updateSetting('store_name', tempStore.value.name.trim()),
    settingsStore.updateSetting('store_tagline', tempStore.value.tagline.trim()),
    settingsStore.updateSetting('store_address', tempStore.value.address.trim()),
    settingsStore.updateSetting('store_phone', tempStore.value.phone.trim()),
    settingsStore.updateSetting('invoice_prefix', tempStore.value.invoicePrefix.trim() || 'INV-B2B'),
    settingsStore.setTheme(activeColor.value, activePreset.value, activeHeaderStyle.value),
    settingsStore.setSurfaceTheme(activeSurface.value, customSurfaceColor.value)
  ]);

  brandingSaved.value = true;
  setTimeout(() => {
    brandingSaved.value = false;
  }, 4000);
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full bg-white select-none text-xs overflow-hidden">
    <!-- Layer 1: Ribbon Header (Standar Kulakan) -->
    <div class="relative flex items-center justify-between bg-[#f6f5f2] border-b border-gray-200 px-3 py-1.5 select-none shrink-0 gap-1.5 overflow-x-auto no-scrollbar">
      <div class="flex items-center gap-2 shrink-0">
        <Store :size="15" class="text-purple-700" />
        <span class="font-bold text-xs text-gray-800">Profil Usaha & Format Struk</span>
        <span class="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-semibold">{{ tempStore.name || 'Kasir Citra' }}</span>
      </div>

      <div class="flex items-center gap-2 shrink-0 ml-auto">
        <button
          @click="resetToDefault"
          class="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <RotateCcw :size="13" />
          <span>Reset Default</span>
        </button>
        <button
          @click="handleSaveAll"
          class="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
        >
          <Save :size="13" />
          <span>Simpan Profil Toko</span>
        </button>
      </div>
    </div>

    <!-- Notification Banner jika tersimpan -->
    <div
      v-if="brandingSaved"
      class="bg-emerald-600 text-white px-4 py-1.5 flex items-center justify-between text-xs font-semibold shrink-0 shadow-xs animate-in fade-in"
    >
      <div class="flex items-center gap-2">
        <CheckCircle2 :size="15" />
        <span>Profil Usaha dan Kustomisasi Warna UI Berhasil Disimpan & Diterapkan ke Seluruh Sistem!</span>
      </div>
      <span class="text-[10px] bg-emerald-700 px-2 py-0.5 rounded">Tersinkronisasi</span>
    </div>

    <!-- 1. Ringkasan Metrik Cepat Profil & Branding (Seimbang Terbagi Rata 6 Kolom, Identik Kulakan) -->
    <div class="flex items-center divide-x divide-gray-200 px-2 py-2 border-b border-gray-200 bg-white shrink-0">
      <!-- 1. Nama Usaha Terdaftar -->
      <div class="flex items-center gap-2 px-2.5 first:pl-1 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
          <Store :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Nama Usaha / Toko</div>
          <div class="text-xs font-bold text-gray-800 font-mono mt-0.5 truncate">{{ tempStore.name || 'Kasir Citra' }}</div>
        </div>
      </div>

      <!-- 2. Prefix Faktur -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
          <FileText :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Prefix Faktur</div>
          <div class="text-xs font-bold text-purple-800 font-mono mt-0.5 truncate">{{ tempStore.invoicePrefix || 'INV' }}</div>
        </div>
      </div>

      <!-- 3. WhatsApp Kontak -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
          <Phone :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">No. WhatsApp</div>
          <div class="text-xs font-bold text-emerald-800 font-mono mt-0.5 truncate">{{ tempStore.phone || '-' }}</div>
        </div>
      </div>

      <!-- 4. Warna Brand UI -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div
          class="w-7 h-7 rounded flex items-center justify-center text-white shrink-0 shadow-2xs"
          :style="{ backgroundColor: activeColor }"
        >
          <Palette :size="14" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Warna Brand UI</div>
          <div class="text-xs font-bold text-gray-900 font-mono mt-0.5 truncate uppercase">{{ activeColor }}</div>
        </div>
      </div>

      <!-- 5. Tema Surface Latar -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
          <Monitor :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Latar Permukaan</div>
          <div class="text-xs font-bold text-amber-800 font-mono mt-0.5 truncate capitalize">{{ activeSurface }}</div>
        </div>
      </div>

      <!-- 6. Format Struk Kasir -->
      <div class="flex items-center gap-2 px-2.5 flex-1 min-w-0">
        <div class="w-7 h-7 rounded bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
          <Printer :size="15" />
        </div>
        <div class="min-w-0">
          <div class="text-[10px] text-gray-500 font-medium leading-none truncate">Format Nota Struk</div>
          <div class="text-xs font-bold text-teal-800 font-mono mt-0.5 truncate">58mm / 80mm ESC/POS</div>
        </div>
      </div>
    </div>

    <!-- 2. Workspace: Edge-to-Edge Split Layout (Kiri: Profil Usaha, Kanan: Kustomisasi Tema) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- SISI KIRI: PROFIL IDENTITAS USAHA & STRUK -->
      <div class="w-full lg:w-[460px] xl:w-[480px] flex flex-col border-r border-gray-200 overflow-hidden bg-white shrink-0">
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
            <div>
              <label class="text-[11px] font-semibold text-gray-700 block mb-1">Nama Usaha / Toko / Hub *</label>
              <input
                v-model="tempStore.name"
                type="text"
                required
                class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-bold text-gray-900"
                placeholder="Misal: Kasir Citra / Toko Berkah"
              />
            </div>

            <div>
              <label class="text-[11px] font-semibold text-gray-700 block mb-1">Tagline / Deskripsi Usaha</label>
              <input
                v-model="tempStore.tagline"
                type="text"
                class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 text-gray-800"
                placeholder="Misal: Distribusi Bahan Pokok & Sembako Murah"
              />
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="text-[11px] font-semibold text-gray-700 block mb-1">No. WhatsApp Toko</label>
                <input
                  v-model="tempStore.phone"
                  type="text"
                  class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-mono text-gray-800"
                  placeholder="0812-3456-7890"
                />
              </div>
              <div>
                <label class="text-[11px] font-semibold text-gray-700 block mb-1">Prefix Nomor Faktur</label>
                <input
                  v-model="tempStore.invoicePrefix"
                  type="text"
                  class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 font-mono uppercase font-bold text-purple-900"
                  placeholder="INV-B2B"
                />
              </div>
            </div>

            <div>
              <label class="text-[11px] font-semibold text-gray-700 block mb-1">Alamat Fisik Gudang / Toko</label>
              <textarea
                v-model="tempStore.address"
                rows="3"
                class="w-full bg-white border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-purple-600 resize-none text-gray-800"
                placeholder="Alamat fisik yang dicetak pada faktur nota & struk pembelian"
              ></textarea>
            </div>

            <!-- Mini Live Preview Struk Nota -->
            <div class="pt-3 border-t border-gray-200">
              <span class="text-[11px] font-bold text-gray-700 block mb-1.5">Simulasi Header Struk Kasir:</span>
              <div class="bg-[#faf9f7] border border-gray-300 rounded p-3 font-mono text-center space-y-0.5 text-gray-800 text-[11px] select-text">
                <div class="font-bold text-xs uppercase tracking-wider">{{ tempStore.name || 'KASIR CITRA' }}</div>
                <div class="text-[10px] text-gray-500">{{ tempStore.tagline || 'Pusat Kulakan & Eceran' }}</div>
                <div class="text-[10px] text-gray-500">{{ tempStore.address || 'Jl. Raya Perdagangan No. 12' }}</div>
                <div class="text-[10px] text-gray-500">WA: {{ tempStore.phone || '0812-3456-7890' }}</div>
                <div class="border-b border-dashed border-gray-400 my-1.5"></div>
                <div class="flex justify-between text-[10px] text-gray-600">
                  <span>{{ tempStore.invoicePrefix || 'INV' }}-202610-001</span>
                  <span>19/10/2026 14:30</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Sticky Bottom Save Bar -->
          <div class="p-3 bg-[#f6f5f2] border-t border-gray-200 flex items-center justify-between shrink-0">
            <span class="text-[10px] text-gray-500">Tersimpan otomatis ke database lokal</span>
            <button
              type="submit"
              class="flex items-center gap-1.5 px-4 py-1.5 bg-purple-700 hover:bg-purple-800 active:bg-purple-900 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-all"
            >
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

          <button
            type="button"
            class="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-300 px-2 py-1 rounded cursor-pointer transition-colors shadow-2xs"
            title="Kembalikan ke warna biru default"
            @click="resetToDefault"
          >
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
              <button
                v-for="preset in THEME_PRESETS"
                :key="preset.id"
                type="button"
                class="flex items-center gap-2 p-2 rounded border text-left cursor-pointer transition-all relative overflow-hidden"
                :class="activePreset === preset.id
                  ? 'border-gray-900 bg-gray-50 shadow-xs ring-1 ring-gray-900/10'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'"
                @click="selectPreset(preset)"
              >
                <div
                  class="w-4 h-4 rounded-full shrink-0 shadow-xs flex items-center justify-center text-white"
                  :style="{ backgroundColor: preset.primary }"
                >
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
                :style="{ backgroundColor: activeColor }"
                title="Klik untuk memilih warna bebas"
              >
                <input
                  type="color"
                  :value="activeColor"
                  class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  @input="onCustomColorInput"
                />
              </label>

              <div class="flex-1 max-w-[160px]">
                <input
                  type="text"
                  :value="activeColor"
                  maxlength="7"
                  class="w-full bg-gray-50 border border-gray-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-gray-800 outline-none focus:border-purple-600 uppercase"
                  placeholder="#2563EB"
                  @input="(e) => onHexTextInput((e.target as HTMLInputElement).value)"
                />
              </div>

              <!-- Quick Swatches -->
              <div class="flex items-center gap-1.5 ml-auto">
                <button
                  type="button"
                  class="w-5 h-5 rounded-full bg-[#2563eb] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Citra Blue"
                  @click="onHexTextInput('#2563eb')"
                ></button>
                <button
                  type="button"
                  class="w-5 h-5 rounded-full bg-[#059669] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Emerald Green"
                  @click="onHexTextInput('#059669')"
                ></button>
                <button
                  type="button"
                  class="w-5 h-5 rounded-full bg-[#7c3aed] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Royal Violet"
                  @click="onHexTextInput('#7c3aed')"
                ></button>
                <button
                  type="button"
                  class="w-5 h-5 rounded-full bg-[#d97706] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Warm Amber"
                  @click="onHexTextInput('#d97706')"
                ></button>
                <button
                  type="button"
                  class="w-5 h-5 rounded-full bg-[#e11d48] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Ruby Red"
                  @click="onHexTextInput('#e11d48')"
                ></button>
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
              <button
                v-for="surface in SURFACE_PRESETS"
                :key="surface.id"
                type="button"
                class="flex flex-col p-2 rounded border text-left cursor-pointer transition-all relative overflow-hidden group"
                :class="activeSurface === surface.id
                  ? 'border-gray-900 bg-gray-50 shadow-xs ring-1 ring-gray-900/15'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'"
                @click="selectSurface(surface)"
              >
                <div class="w-full h-6 rounded border border-gray-300 flex overflow-hidden mb-1.5 shadow-2xs">
                  <div class="w-1/3 h-full" :style="{ backgroundColor: surface.headerHex }"></div>
                  <div class="w-1/3 h-full" :style="{ backgroundColor: surface.tabBarHex }"></div>
                  <div class="w-1/3 h-full" :style="{ backgroundColor: surface.bgHex }"></div>
                </div>

                <div class="flex items-center justify-between gap-1">
                  <span class="font-bold text-[11px] truncate text-gray-800">
                    {{ surface.name }}
                  </span>
                  <Check v-if="activeSurface === surface.id" :size="12" class="text-emerald-600 shrink-0" stroke-width="3" />
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
              <button
                type="button"
                class="px-3 py-1.5 rounded font-bold text-xs shadow-xs transition-all flex items-center gap-1.5"
                :style="{
                  backgroundColor: activeColor,
                  color: getContrastTextColor(activeColor)
                }"
              >
                <ShoppingBag :size="13" />
                <span>Tombol Utama POS</span>
              </button>

              <span
                class="px-2.5 py-1 rounded border font-semibold text-[11px] flex items-center gap-1"
                :style="{
                  borderColor: activeColor,
                  color: activeColor,
                  backgroundColor: `color-mix(in srgb, ${activeColor} 10%, transparent)`
                }"
              >
                <Check :size="11" />
                <span>Status Aktif</span>
              </span>

              <span
                class="px-2.5 py-1 rounded-full font-bold text-[10px] text-white flex items-center gap-1 shadow-xs"
                :style="{ backgroundColor: activeColor }"
              >
                <CreditCard :size="11" />
                <span>Tier Member</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Bottom Action Bar untuk Tema -->
        <div class="p-3 bg-[#f6f5f2] border-t border-gray-200 flex items-center justify-between shrink-0">
          <span class="text-[10px] text-gray-500">Tema tersimpan langsung ke PostgreSQL & localStorage</span>
          <button
            type="button"
            class="flex items-center gap-1.5 px-4 py-1.5 rounded font-bold text-xs text-white cursor-pointer shadow-xs transition-all hover:brightness-110 active:brightness-95"
            :style="{ backgroundColor: activeColor }"
            @click="handleSaveAll"
          >
            <Save :size="13" />
            <span>Simpan & Terapkan Tema</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
