import { computed, ref, watch } from 'vue';

/**
 * Registry global "ada modal terbuka".
 *
 * BUG FIX: beberapa komponen memasang listener `keydown` di `window`
 * (ProductCatalog, PosCart, PosPaymentModal, dst.). Ketika modal pembayaran
 * terbuka, listener ProductCatalog berjalan LEBIH DAHULU sehingga menekan
 * Enter untuk menyelesaikan pembayaran sekaligus menambah produk katalog
 * ke keranjang -> pelanggan ditagih barang yang tidak pernah diminta.
 *
 * Dengan registry ini, listener global bisa memeriksa `isAnyModalOpen` dan
 * menonaktifkan diri selama modal terbuka.
 */
const openModalCount = ref(0);

export const isAnyModalOpen = computed(() => openModalCount.value > 0);

export function useModalLock() {
  let acquired = false;

  function acquire() {
    if (acquired) return;
    acquired = true;
    openModalCount.value += 1;
  }

  function release() {
    if (!acquired) return;
    acquired = false;
    openModalCount.value = Math.max(0, openModalCount.value - 1);
  }

  /**
   * Ikat lock ke sebuah sumber kebenaran visibilitas (biasanya `v-if` di
   * dalam template komponen, bukan `v-if` pada pemanggilnya — sebagian besar
   * modal di aplikasi ini tetap ter-mount sepanjang waktu).
   */
  function bind(isVisible: () => boolean) {
    watch(
      isVisible,
      (open) => {
        if (open) acquire();
        else release();
      },
      { immediate: true }
    );
  }

  return { isAnyModalOpen, acquire, release, bind };
}
