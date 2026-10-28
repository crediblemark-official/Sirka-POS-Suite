<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { Trash2, AlertTriangle, Info } from 'lucide-vue-next';
import { useModalLock } from '../../composables/useModalLock';

// BUG FIX: register modal-lock agar shortcut global (mis. Enter pada
// ProductCatalog) tidak menambah produk ke keranjang saat modal terbuka.

const { isOpen, options, handleConfirm, handleCancel } = useConfirmDialog();

function handleKeydown(e: KeyboardEvent) {
  if (!isOpen.value) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    handleCancel();
  } else if (e.key === 'Enter') {
    // BUG FIX: Enter tanpa cek target bisa mengonfirmasi aksi destruktif
    // saat user mengetik di input yang berada DI BELAKANG modal.
    // Sekarang Enter hanya diproses bila fokus berada di dalam modal ini
    // (atau di body, mis. setelah user mengklik tombol di modal).
    const target = e.target as HTMLElement | null;
    const inModal = !!(target && target.closest && target.closest('[data-confirm-modal]'));
    const inInput = !!(target && (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ));
    if (inInput && !inModal) return;
    e.preventDefault();
    handleConfirm();
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const { bind: bindModalLock } = useModalLock();
bindModalLock(() => isOpen.value);
</script>

<template>
  <Transition name="confirm-fade">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs select-none"
      @click.self="handleCancel"
    >
      <div
        data-confirm-modal
        class="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-200 w-full sm:max-w-md max-h-[92vh] sm:max-h-[88vh] overflow-hidden transform transition-all flex flex-col animate-in slide-in-from-bottom duration-200 sm:zoom-in-95"
        role="dialog"
        aria-modal="true"
      >
        <!-- Mobile Pull Indicator -->
        <div class="w-10 h-1 bg-slate-300 rounded-full mx-auto my-2 sm:hidden shrink-0"></div>

        <!-- Modal Body -->
        <div class="p-5 sm:p-6 text-center overflow-y-auto flex-1">
          <!-- Icon Bubble -->
          <div class="mx-auto flex items-center justify-center w-12 h-12 rounded-full mb-3.5"
            :class="{
              'bg-rose-100 text-rose-600 ring-8 ring-rose-50': options.type === 'danger',
              'bg-amber-100 text-amber-600 ring-8 ring-amber-50': options.type === 'warning',
              'bg-blue-100 text-blue-600 ring-8 ring-blue-50': options.type === 'info',
            }"
          >
            <Trash2 v-if="options.type === 'danger'" :size="22" />
            <AlertTriangle v-else-if="options.type === 'warning'" :size="22" />
            <Info v-else :size="22" />
          </div>

          <!-- Title -->
          <h3 class="text-base font-bold text-gray-900">
            {{ options.title }}
          </h3>

          <!-- Message -->
          <p class="mt-2 text-xs sm:text-sm text-gray-600 leading-relaxed font-sans">
            {{ options.message }}
          </p>

          <!-- Details / Callout Note -->
          <div
            v-if="options.details"
            class="mt-3.5 p-2.5 rounded-lg text-[11px] font-medium leading-relaxed"
            :class="{
              'bg-rose-50 border border-rose-200 text-rose-800': options.type === 'danger',
              'bg-amber-50 border border-amber-200 text-amber-800': options.type === 'warning',
              'bg-blue-50 border border-blue-200 text-blue-800': options.type === 'info',
            }"
          >
            {{ options.details }}
          </div>
        </div>

        <!-- Modal Footer Actions -->
        <div class="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            class="h-8.5 px-3.5 flex items-center gap-1.5 bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 cursor-pointer transition-colors shadow-xs"
            @click="handleCancel"
          >
            <span>{{ options.cancelText }}</span>
            <kbd class="text-[9.5px] bg-gray-100 border border-gray-300 rounded px-1 text-gray-500 font-mono">Esc</kbd>
          </button>

          <button
            type="button"
            class="h-8.5 px-4 flex items-center gap-1.5 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs active:scale-95"
            :class="{
              'bg-rose-600 hover:bg-rose-700 active:bg-rose-800': options.type === 'danger',
              'bg-amber-600 hover:bg-amber-700 active:bg-amber-800': options.type === 'warning',
              'bg-blue-600 hover:bg-blue-700 active:bg-blue-800': options.type === 'info',
            }"
            @click="handleConfirm"
          >
            <Trash2 v-if="options.type === 'danger'" :size="13" />
            <span>{{ options.confirmText }}</span>
            <kbd class="text-[9.5px] bg-white/20 rounded px-1 py-0.2 text-white font-mono">↵ Enter</kbd>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.confirm-fade-enter-active,
.confirm-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.confirm-fade-enter-from,
.confirm-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
