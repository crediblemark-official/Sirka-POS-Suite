import type { Directive } from 'vue';

interface ScrollElement extends HTMLElement {
  _horizontalScrollCleanup?: () => void;
}

export const vHorizontalScroll: Directive<ScrollElement> = {
  mounted(el: ScrollElement) {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasDragged = false;

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      // Hanya tombol kiri mouse
      if (e.button !== 0) return;
      // Jangan aktifkan drag jika user mengklik input pencarian atau select combobox
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, [role="combobox"]')) {
        return;
      }

      isDown = true;
      hasDragged = false;
      startX = e.pageX;
      scrollLeft = el.scrollLeft;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const diff = e.pageX - startX;
      if (Math.abs(diff) > 4) {
        hasDragged = true;
        el.style.cursor = 'grabbing';
        el.style.userSelect = 'none';
      }
      el.scrollLeft = scrollLeft - diff;
    };

    const onMouseUp = () => {
      if (!isDown) return;
      isDown = false;
      el.style.cursor = '';
      el.style.userSelect = '';
      if (hasDragged) {
        // Tunda reset hasDragged agar click capture handler bisa membatalkan klik tombol
        setTimeout(() => {
          hasDragged = false;
        }, 50);
      }
    };

    // Mencegah trigger event click pada tombol jika pengguna sedang menggeser (drag)
    const onClickCapture = (e: MouseEvent) => {
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    el.addEventListener('click', onClickCapture, true);

    el._horizontalScrollCleanup = () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('click', onClickCapture, true);
    };
  },
  unmounted(el: ScrollElement) {
    el._horizontalScrollCleanup?.();
  }
};
