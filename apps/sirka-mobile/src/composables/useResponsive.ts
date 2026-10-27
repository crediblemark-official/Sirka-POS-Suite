import { ref, computed } from 'vue';

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280);
const windowHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 800);

let isListening = false;

function updateDimensions() {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth;
    windowHeight.value = window.innerHeight;
  }
}

export function useResponsive() {
  if (typeof window !== 'undefined' && !isListening) {
    window.addEventListener('resize', updateDimensions, { passive: true });
    window.addEventListener('orientationchange', updateDimensions, { passive: true });
    isListening = true;
  }

  const isMobile = computed(() => windowWidth.value < 768);
  const isTablet = computed(() => windowWidth.value >= 768 && windowWidth.value < 1024);
  const isDesktop = computed(() => windowWidth.value >= 1024);
  const isSmallScreen = computed(() => windowWidth.value < 1024); // Mobile or Tablet Portrait

  // Check if running on Android/iOS/touch device
  const isTouchDevice = computed(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  const isAndroid = computed(() => {
    if (typeof navigator === 'undefined') return false;
    return /android/i.test(navigator.userAgent);
  });

  return {
    windowWidth,
    windowHeight,
    isMobile,
    isTablet,
    isDesktop,
    isSmallScreen,
    isTouchDevice,
    isAndroid,
  };
}
