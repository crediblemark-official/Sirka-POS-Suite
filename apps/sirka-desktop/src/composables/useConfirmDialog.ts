import { ref } from 'vue';

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  details?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const isOpen = ref(false);
const options = ref<ConfirmDialogOptions>({
  title: 'Konfirmasi Tindakan',
  message: '',
  confirmText: 'Ya, Lanjutkan',
  cancelText: 'Batal',
  type: 'danger'
});

let resolvePromise: ((value: boolean) => void) | null = null;

export function useConfirmDialog() {
  function confirm(opts: ConfirmDialogOptions | string): Promise<boolean> {
    if (typeof opts === 'string') {
      options.value = {
        title: 'Konfirmasi',
        message: opts,
        confirmText: 'Ya, Lanjutkan',
        cancelText: 'Batal',
        type: 'danger'
      };
    } else {
      options.value = {
        title: opts.title || 'Konfirmasi Tindakan',
        message: opts.message,
        details: opts.details,
        confirmText: opts.confirmText || 'Ya, Lanjutkan',
        cancelText: opts.cancelText || 'Batal',
        type: opts.type || 'danger'
      };
    }

    // BUG FIX: `resolvePromise` bersifat modul-global. Dua confirm() berurutan
    // menimpa resolver pertama sehingga `await showConfirm(...)` pertama
    // HANGING SELAMANYA (floating promise) dan aksi delete tidak pernah jalan.
    // Sekarang konfirmasi yang tertunda dibatalkan (false) saat ada permintaan baru.
    if (resolvePromise) {
      const previous = resolvePromise;
      resolvePromise = null;
      previous(false);
    }

    isOpen.value = true;
    return new Promise<boolean>((resolve) => {
      resolvePromise = resolve;
    });
  }

  function handleConfirm() {
    isOpen.value = false;
    if (resolvePromise) {
      resolvePromise(true);
      resolvePromise = null;
    }
  }

  function handleCancel() {
    isOpen.value = false;
    if (resolvePromise) {
      resolvePromise(false);
      resolvePromise = null;
    }
  }

  return {
    isOpen,
    options,
    confirm,
    handleConfirm,
    handleCancel
  };
}
