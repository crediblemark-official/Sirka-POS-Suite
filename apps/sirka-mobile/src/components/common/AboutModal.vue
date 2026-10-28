<script setup lang="ts">
import { X, Store, Heart, Code2, Building2, Award, MessageCircle, ExternalLink } from 'lucide-vue-next';
import {
  APP_VERSION,
  APP_NAME,
  APP_CREDIT,
  APP_DEVELOPER,
  APP_ORGANIZATION,
  APP_WHATSAPP,
  APP_WHATSAPP_LINK
} from '../../config/version';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

async function openWhatsApp() {
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(APP_WHATSAPP_LINK);
  } catch {
    window.open(APP_WHATSAPP_LINK, '_blank');
  }
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none text-xs animate-in fade-in duration-150"
    @click.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <div
      class="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 w-full sm:max-w-sm max-h-[92vh] sm:max-h-[88vh] overflow-hidden text-gray-900 animate-in slide-in-from-bottom duration-200 sm:zoom-in-95 flex flex-col"
    >
      <!-- Mobile Pull Indicator -->
      <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0"></div>

      <!-- Header with Gradient Background -->
      <div class="relative bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800 p-6 text-white text-center shrink-0">
        <!-- Close Button -->
        <button
          type="button"
          class="absolute top-3 right-3 p-1 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          title="Tutup"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>

        <!-- App Icon -->
        <div class="mx-auto w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg mb-3">
          <Store :size="28" class="text-white" />
        </div>

        <!-- App Name & Version -->
        <h3 class="text-xl font-bold tracking-tight">{{ APP_NAME }}</h3>
        <p class="text-xs text-blue-100 font-medium mt-0.5">Sistem Kasir & Distribusi Toko</p>

        <div class="inline-flex items-center gap-1 mt-2.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white font-mono text-xs font-semibold">
          <span>v{{ APP_VERSION }}</span>
        </div>
      </div>

      <!-- Info Cards Body -->
      <div class="p-5 space-y-2.5 bg-gray-50/50 flex-1 overflow-y-auto">
        <!-- Dedikasi / Lembaga -->
        <div class="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-2xs">
          <div class="p-2 rounded-lg bg-indigo-50 text-indigo-600 shrink-0 mt-0.5">
            <Building2 :size="18" />
          </div>
          <div>
            <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dibuat Khusus Untuk</div>
            <div class="text-sm font-bold text-gray-900">{{ APP_ORGANIZATION }}</div>
          </div>
        </div>

        <!-- Developer -->
        <div class="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-2xs">
          <div class="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
            <Code2 :size="18" />
          </div>
          <div>
            <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pengembang (Developer)</div>
            <div class="text-sm font-bold text-gray-900">{{ APP_DEVELOPER }}</div>
          </div>
        </div>

        <!-- Credit / Brand -->
        <div class="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-2xs">
          <div class="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0 mt-0.5">
            <Award :size="18" />
          </div>
          <div>
            <div class="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Credit by</div>
            <div class="text-sm font-bold text-gray-900">{{ APP_CREDIT }}</div>
          </div>
        </div>

        <!-- Kontak WhatsApp -->
        <a
          :href="APP_WHATSAPP_LINK"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-between p-3 rounded-xl bg-emerald-50/90 hover:bg-emerald-100/90 border border-emerald-200 transition-colors cursor-pointer group shadow-2xs"
          title="Buka WhatsApp untuk dukungan teknis & lisensi"
          @click.prevent="openWhatsApp"
        >
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-emerald-600 text-white shrink-0 shadow-xs">
              <MessageCircle :size="18" />
            </div>
            <div>
              <div class="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Kontak WhatsApp</div>
              <div class="text-sm font-bold text-emerald-950 font-mono tracking-tight">{{ APP_WHATSAPP }}</div>
            </div>
          </div>
          <div class="text-emerald-600 group-hover:translate-x-0.5 transition-transform pr-1">
            <ExternalLink :size="15" />
          </div>
        </a>
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-gray-100 bg-white flex items-center justify-between text-xs text-gray-400 shrink-0">
        <span class="flex items-center gap-1 text-[11px]">
          <span>Made with</span>
          <Heart :size="12" class="text-rose-500 fill-rose-500 inline" />
          <span>in 2026</span>
        </span>

        <button
          type="button"
          class="px-4 py-1.5 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
          @click="emit('close')"
        >
          Tutup
        </button>
      </div>
    </div>
  </div>
</template>
