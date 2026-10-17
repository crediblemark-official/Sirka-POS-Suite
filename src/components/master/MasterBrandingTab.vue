<script setup lang="ts">
import { ref } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { THEME_PRESETS, ThemePreset, applyTheme, getContrastTextColor } from '../../utils/theme';
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
  ShoppingBag
} from 'lucide-vue-next';

const settingsStore = useSettingsStore();

const tempStore = ref({
  name: settingsStore.storeName,
  tagline: settingsStore.storeTagline,
  address: settingsStore.storeAddress,
  phone: settingsStore.storePhone,
  invoicePrefix: settingsStore.invoicePrefix
});

// UI Theme state
const activeColor = ref(settingsStore.primaryColor);
const activePreset = ref(settingsStore.themePreset);
const activeHeaderStyle = ref(settingsStore.headerAccentStyle);

const brandingSaved = ref(false);

// Live preview when selecting presets
function selectPreset(preset: ThemePreset) {
  activeColor.value = preset.primary;
  activePreset.value = preset.id;
  applyTheme(preset.primary, activeHeaderStyle.value);
}

// Live preview when changing custom color
function onCustomColorInput(event: Event) {
  const target = event.target as HTMLInputElement;
  activeColor.value = target.value;
  activePreset.value = 'custom';
  applyTheme(target.value, activeHeaderStyle.value);
}

function onHexTextInput(value: string) {
  let hex = value.trim();
  if (!hex.startsWith('#')) {
    hex = '#' + hex;
  }
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex)) {
    activeColor.value = hex;
    activePreset.value = 'custom';
    applyTheme(hex, activeHeaderStyle.value);
  }
}

function selectHeaderStyle(style: string) {
  activeHeaderStyle.value = style;
  applyTheme(activeColor.value, style);
}

function resetToDefault() {
  activeColor.value = '#2563eb';
  activePreset.value = 'blue';
  activeHeaderStyle.value = 'accent-line';
  applyTheme('#2563eb', 'accent-line');
}

async function handleSaveAll() {
  await Promise.all([
    settingsStore.updateSetting('store_name', tempStore.value.name),
    settingsStore.updateSetting('store_tagline', tempStore.value.tagline),
    settingsStore.updateSetting('store_address', tempStore.value.address),
    settingsStore.updateSetting('store_phone', tempStore.value.phone),
    settingsStore.updateSetting('invoice_prefix', tempStore.value.invoicePrefix),
    settingsStore.setTheme(activeColor.value, activePreset.value, activeHeaderStyle.value)
  ]);

  brandingSaved.value = true;
  setTimeout(() => {
    brandingSaved.value = false;
  }, 3500);
}
</script>

<template>
  <div class="max-w-6xl mx-auto text-xs select-none space-y-4 pb-6">
    <!-- Header Notification Banner -->
    <div
      v-if="brandingSaved"
      class="bg-emerald-50 border border-emerald-300 text-emerald-800 p-3 rounded-lg flex items-center justify-between shadow-xs animate-in fade-in"
    >
      <div class="flex items-center gap-2 font-semibold">
        <CheckCircle2 :size="16" class="text-emerald-600" />
        <span>Profil Usaha dan Kustomisasi Warna UI Berhasil Disimpan & Diterapkan ke Seluruh Sistem!</span>
      </div>
      <span class="text-[11px] text-emerald-600">Tema tersinkronisasi ke PostgreSQL</span>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <!-- LEFT CARD: PROFIL IDENTITAS USAHA -->
      <section class="lg:col-span-5 bg-white border border-[#dedbd6] rounded-lg shadow-xs overflow-hidden flex flex-col">
        <div class="p-4 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Store :size="17" class="text-blue-600" />
            <div>
              <h3 class="font-bold text-sm text-gray-900">Profil Usaha & Struk</h3>
              <p class="text-[11px] text-gray-500">Identitas toko untuk cetak struk nota & white-label.</p>
            </div>
          </div>
        </div>

        <form @submit.prevent="handleSaveAll" class="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
          <div class="space-y-3">
            <div>
              <label class="text-xs font-semibold text-gray-700 block mb-1">Nama Usaha / Toko / Hub *</label>
              <input
                v-model="tempStore.name"
                type="text"
                required
                class="w-full bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-blue-500 font-bold"
                placeholder="Misal: Kasir Citra / Toko Berkah"
              />
            </div>

            <div>
              <label class="text-xs font-semibold text-gray-700 block mb-1">Tagline / Deskripsi Usaha</label>
              <input
                v-model="tempStore.tagline"
                type="text"
                class="w-full bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                placeholder="Misal: Distribusi Bahan Pokok & Sembako"
              />
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <label class="text-xs font-semibold text-gray-700 block mb-1">No. WhatsApp</label>
                <input
                  v-model="tempStore.phone"
                  type="text"
                  class="w-full bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-blue-500 font-mono"
                  placeholder="0812-3456-7890"
                />
              </div>
              <div>
                <label class="text-xs font-semibold text-gray-700 block mb-1">Prefix Faktur</label>
                <input
                  v-model="tempStore.invoicePrefix"
                  type="text"
                  class="w-full bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-blue-500 font-mono uppercase"
                  placeholder="INV-B2B"
                />
              </div>
            </div>

            <div>
              <label class="text-xs font-semibold text-gray-700 block mb-1">Alamat Gudang / Toko</label>
              <textarea
                v-model="tempStore.address"
                rows="3"
                class="w-full bg-gray-50 border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-blue-500"
                placeholder="Alamat fisik yang dicetak pada faktur nota"
              ></textarea>
            </div>
          </div>

          <div class="pt-3 border-t border-gray-100 flex items-center justify-between">
            <span class="text-[11px] text-gray-400">Dicetak di nota & faktur PO</span>
            <button
              type="submit"
              class="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded font-bold text-xs cursor-pointer shadow-xs transition-all"
            >
              <Save :size="13" />
              <span>Simpan Profil</span>
            </button>
          </div>
        </form>
      </section>

      <!-- RIGHT CARD: KUSTOMISASI WARNA & TEMA UI KASIR -->
      <section class="lg:col-span-7 bg-white border border-[#dedbd6] rounded-lg shadow-xs overflow-hidden flex flex-col">
        <div class="p-4 bg-[#f6f5f2] border-b border-gray-200 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div
              class="w-6 h-6 rounded-md flex items-center justify-center text-white shadow-xs"
              :style="{ backgroundColor: activeColor }"
            >
              <Palette :size="14" />
            </div>
            <div>
              <h3 class="font-bold text-sm text-gray-900">Kustomisasi Tema & Warna UI</h3>
              <p class="text-[11px] text-gray-500">Sesuaikan warna utama aplikasi kasir agar pas dengan identitas brand.</p>
            </div>
          </div>

          <button
            type="button"
            class="flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 border border-gray-300 px-2 py-1 rounded cursor-pointer transition-colors shadow-xs"
            title="Kembalikan ke warna biru default"
            @click="resetToDefault"
          >
            <RotateCcw :size="11" />
            <span>Reset Default</span>
          </button>
        </div>

        <div class="p-4 space-y-4 flex-1">
          <!-- 1. PRESET COLOR PALETTES -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Sparkles :size="13" class="text-amber-500" />
                Pilihan Palet Preset Cepat:
              </span>
              <span class="text-[10px] text-gray-400">Pilih salah satu untuk live preview</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                v-for="preset in THEME_PRESETS"
                :key="preset.id"
                type="button"
                class="flex items-center gap-2 p-2 rounded-md border text-left cursor-pointer transition-all relative overflow-hidden"
                :class="activePreset === preset.id
                  ? 'border-gray-900 bg-gray-50 shadow-xs ring-1 ring-gray-900/10'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'"
                @click="selectPreset(preset)"
              >
                <!-- Color dot / circle -->
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
          <div class="p-3 bg-[#faf9f7] border border-[#e8e6e1] rounded-lg">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <Sliders :size="13" class="text-gray-600" />
                Pilih Warna Bebas (Custom HEX):
              </span>
              <span class="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-white border border-gray-200">
                {{ activeColor.toUpperCase() }}
              </span>
            </div>

            <div class="flex items-center gap-3">
              <!-- Color Picker Circle Trigger -->
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

              <!-- HEX Input -->
              <div class="flex-1 relative">
                <input
                  type="text"
                  :value="activeColor"
                  maxlength="7"
                  class="w-full bg-white border border-gray-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold text-gray-800 outline-none focus:border-blue-500 uppercase"
                  placeholder="#2563EB"
                  @input="(e) => onHexTextInput((e.target as HTMLInputElement).value)"
                />
              </div>

              <!-- Quick Swatches for shades -->
              <div class="flex items-center gap-1">
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
                <button
                  type="button"
                  class="w-5 h-5 rounded-full bg-[#7c3aed] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Royal Violet"
                  @click="onHexTextInput('#7c3aed')"
                ></button>
                <button
                  type="button"
                  class="w-5 h-5 rounded-full bg-[#0d9488] border border-white shadow-xs cursor-pointer hover:scale-110 transition-transform"
                  title="Oceanic Teal"
                  @click="onHexTextInput('#0d9488')"
                ></button>
              </div>
            </div>
          </div>

          <!-- 3. HEADER ACCENT STYLE CHOICES -->
          <div>
            <span class="text-xs font-bold text-gray-800 block mb-1.5">
              Gaya Aksen Bilah Atas (Toolbar Header):
            </span>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                class="p-2 rounded border text-left cursor-pointer transition-all"
                :class="activeHeaderStyle === 'accent-line'
                  ? 'border-gray-800 bg-gray-50 ring-1 ring-gray-800/10'
                  : 'border-gray-200 hover:bg-gray-50'"
                @click="selectHeaderStyle('accent-line')"
              >
                <div class="h-1.5 w-full rounded-t mb-1.5" :style="{ backgroundColor: activeColor }"></div>
                <div class="font-bold text-[11px] text-gray-900">Garis Aksen Atas</div>
                <div class="text-[10px] text-gray-400">Aksen garis tegas di atas toolbar</div>
              </button>

              <button
                type="button"
                class="p-2 rounded border text-left cursor-pointer transition-all"
                :class="activeHeaderStyle === 'tinted'
                  ? 'border-gray-800 bg-gray-50 ring-1 ring-gray-800/10'
                  : 'border-gray-200 hover:bg-gray-50'"
                @click="selectHeaderStyle('tinted')"
              >
                <div
                  class="h-1.5 w-full rounded-t mb-1.5 opacity-60"
                  :style="{ backgroundColor: activeColor }"
                ></div>
                <div class="font-bold text-[11px] text-gray-900">Nuansa Lembut</div>
                <div class="text-[10px] text-gray-400">Background toolbar bergradasi tema</div>
              </button>

              <button
                type="button"
                class="p-2 rounded border text-left cursor-pointer transition-all"
                :class="activeHeaderStyle === 'classic'
                  ? 'border-gray-800 bg-gray-50 ring-1 ring-gray-800/10'
                  : 'border-gray-200 hover:bg-gray-50'"
                @click="selectHeaderStyle('classic')"
              >
                <div class="h-1.5 w-full rounded-t mb-1.5 bg-[#dfddd9]"></div>
                <div class="font-bold text-[11px] text-gray-900">Netral Desktop</div>
                <div class="text-[10px] text-gray-400">Gaya klasik abu-abu OS</div>
              </button>
            </div>
          </div>

          <!-- 4. LIVE COMPONENT PREVIEW SIMULATOR -->
          <div class="p-3 bg-white border border-gray-200 rounded-lg shadow-inner">
            <div class="flex items-center justify-between mb-2 text-gray-500">
              <span class="flex items-center gap-1 font-bold text-[11px] text-gray-700">
                <Eye :size="12" />
                Simulasi Tampilan Komponen UI:
              </span>
              <span class="text-[10px]">Real-time Component Preview</span>
            </div>

            <div class="flex flex-wrap items-center gap-2.5 pt-1">
              <!-- Preview Button -->
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

              <!-- Preview Secondary / Outline Badge -->
              <span
                class="px-2.5 py-1 rounded border font-semibold text-[11px] flex items-center gap-1"
                :style="{
                  borderColor: activeColor,
                  color: activeColor,
                  backgroundColor: `color-mix(in srgb, ${activeColor} 10%, transparent)`
                }"
              >
                <Check :size="11" />
                <span>Status Aktif / Badge</span>
              </span>

              <!-- Preview Member Loyalty Chip -->
              <span
                class="px-2.5 py-1 rounded-full font-bold text-[10px] text-white flex items-center gap-1 shadow-xs"
                :style="{ backgroundColor: activeColor }"
              >
                <CreditCard :size="11" />
                <span>Tier Member</span>
              </span>

              <!-- Preview Focus Ring Input -->
              <div class="relative">
                <input
                  type="text"
                  readonly
                  value="Input Fokus"
                  class="bg-white border rounded px-2 py-1 text-[11px] outline-none font-medium"
                  :style="{
                    borderColor: activeColor,
                    boxShadow: `0 0 0 2px color-mix(in srgb, ${activeColor} 25%, transparent)`
                  }"
                />
              </div>
            </div>
          </div>

          <!-- Bottom Action -->
          <div class="pt-3 border-t border-gray-100 flex items-center justify-between">
            <span class="text-[11px] text-gray-400">
              Perubahan langsung terlihat dan disimpan permanen
            </span>

            <button
              type="button"
              class="flex items-center gap-1.5 px-5 py-2 rounded font-bold text-xs text-white cursor-pointer shadow-sm transition-all hover:brightness-110 active:brightness-95"
              :style="{ backgroundColor: activeColor }"
              @click="handleSaveAll"
            >
              <Save :size="14" />
              <span>Simpan & Terapkan Warna UI</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
