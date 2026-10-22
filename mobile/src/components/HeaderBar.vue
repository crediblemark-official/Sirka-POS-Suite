<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { RotateCw, Store } from 'lucide-vue-next';
import { useStoreProfile } from '../composables/useStoreProfile';

defineProps<{
  title?: string;
  subtitle?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

const { storeName, primaryColor, fetchStoreProfile } = useStoreProfile();

/**
 * BUG FIX: badge "Online" sebelumnya SELALU hijau (hard-coded) sehingga owner
 * melihat "Online" padahal server sedang tidak bisa dijangkau.
 * Sekarang mencerminkan `navigator.onLine` + event online/offline.
 */
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true);

function handleOnline() { isOnline.value = true; }
function handleOffline() { isOnline.value = false; }

onMounted(() => {
  fetchStoreProfile();
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
});

function handleRefresh() {
  fetchStoreProfile();
  emit('refresh');
}
</script>

<template>
  <header class="sticky top-0 z-30 select-none shadow-xs">
    <!-- Desktop Window Titlebar (Lega, Bersih, Tidak Menumpuk) -->
    <div class="h-10 px-3 flex items-center justify-between bg-[#dfddd9] border-b border-[#c8c5c0] text-xs">
      <!-- Sisi Kiri: Ikon Toko + Nama Toko Riil dari PostgreSQL + Badge Owner -->
      <div class="flex items-center gap-2 min-w-0">
        <!-- App / Store Icon dengan Warna Brand Dinamis -->
        <div
          class="w-6 h-6 rounded text-white flex items-center justify-center shrink-0 shadow-2xs transition-colors"
          :style="{ backgroundColor: primaryColor || '#2563eb' }"
        >
          <Store :size="13" />
        </div>

        <!-- Nama Toko Utuh (Tidak Terpotong) -->
        <span class="font-extrabold text-[#2e2b28] tracking-tight text-xs sm:text-sm truncate">
          {{ storeName }}
        </span>

        <!-- Badge Owner -->
        <span class="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/30 shrink-0">
          Owner
        </span>
      </div>

      <!-- Sisi Kanan: Status Online + Tombol Refresh Data -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Status Online dengan Dot Hijau -->
        <div
          class="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/80 border border-[#c8c5c0] text-[10px] font-mono"
          :class="isOnline ? 'text-[#166534]' : 'text-rose-700'"
          :title="isOnline ? 'Terhubung ke internet' : 'Tidak ada koneksi internet'"
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="isOnline ? 'bg-[#16a34a] animate-pulse' : 'bg-rose-500'"
          ></span>
          <span>{{ isOnline ? 'Online' : 'Offline' }}</span>
        </div>

        <!-- Tombol Refresh / Reload Data -->
        <button
          @click="handleRefresh"
          :disabled="loading"
          class="explorer-btn p-1.5 rounded cursor-pointer disabled:opacity-50 shrink-0 flex items-center justify-center"
          title="Perbarui Data (F5)"
        >
          <RotateCw :size="13" class="text-[#2e2b28]" :class="{ 'animate-spin': loading }" />
        </button>
      </div>
    </div>
  </header>
</template>
