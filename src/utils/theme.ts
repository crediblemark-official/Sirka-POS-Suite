export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  description: string;
  category: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'blue',
    name: 'Citra Classic Blue',
    primary: '#2563eb',
    description: 'Biru profesional default sistem kasir POS',
    category: 'Standard'
  },
  {
    id: 'emerald',
    name: 'Emerald / Sayur & Segar',
    primary: '#059669',
    description: 'Nuansa hijau segar untuk toko sembako, sayur & herbal',
    category: 'Nature'
  },
  {
    id: 'indigo',
    name: 'Royal Indigo / Modern',
    primary: '#4f46e5',
    description: 'Ungu kebiruan modern ala retail & SaaS terkini',
    category: 'Modern'
  },
  {
    id: 'rose',
    name: 'Ruby Rose / Cafe & Mart',
    primary: '#e11d48',
    description: 'Merah energik untuk mini market, resto & kuliner',
    category: 'Vibrant'
  },
  {
    id: 'amber',
    name: 'Warm Amber / Grosir Pangan',
    primary: '#d97706',
    description: 'Emas hangat untuk distributor grosir, agen sembako & bakery',
    category: 'Warm'
  },
  {
    id: 'violet',
    name: 'Royal Violet / Boutique',
    primary: '#7c3aed',
    description: 'Ungu mewah elegan untuk butik fesyen & kosmetik',
    category: 'Luxury'
  },
  {
    id: 'teal',
    name: 'Oceanic Teal / Apotek',
    primary: '#0d9488',
    description: 'Toska bersih terpercaya untuk apotek & toko kesehatan',
    category: 'Clean'
  },
  {
    id: 'slate',
    name: 'Midnight Slate / Monokrom',
    primary: '#334155',
    description: 'Abu-abu gelap maskulin sleek & minimalis',
    category: 'Minimal'
  }
];

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map(c => c + c)
      .join('');
  }
  const num = parseInt(cleanHex, 16);
  if (isNaN(num)) {
    return { r: 37, g: 99, b: 235 }; // Fallback to Citra blue
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    return clamped.toString(16).padStart(2, '0');
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

export function mixRgb(c1: RGB, c2: RGB, weight: number): RGB {
  // weight between 0 and 1, 0 is c1, 1 is c2
  return {
    r: c1.r * (1 - weight) + c2.r * weight,
    g: c1.g * (1 - weight) + c2.g * weight,
    b: c1.b * (1 - weight) + c2.b * weight
  };
}

export function getContrastTextColor(hex: string): '#ffffff' | '#0f172a' {
  const rgb = hexToRgb(hex);
  // Perceived brightness formula (YIQ)
  const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return yiq >= 160 ? '#0f172a' : '#ffffff';
}

export function generateShades(baseHex: string) {
  const baseRgb = hexToRgb(baseHex);
  const white: RGB = { r: 255, g: 255, b: 255 };
  const black: RGB = { r: 0, g: 0, b: 0 };

  return {
    '50': rgbToHex(mixRgb(baseRgb, white, 0.94)),
    '100': rgbToHex(mixRgb(baseRgb, white, 0.85)),
    '200': rgbToHex(mixRgb(baseRgb, white, 0.68)),
    '300': rgbToHex(mixRgb(baseRgb, white, 0.48)),
    '400': rgbToHex(mixRgb(baseRgb, white, 0.25)),
    '500': rgbToHex(mixRgb(baseRgb, white, 0.10)),
    '600': baseHex.startsWith('#') ? baseHex : `#${baseHex}`,
    '700': rgbToHex(mixRgb(baseRgb, black, 0.16)),
    '800': rgbToHex(mixRgb(baseRgb, black, 0.32)),
    '900': rgbToHex(mixRgb(baseRgb, black, 0.50)),
    rgb: `${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}`
  };
}

export function applyTheme(primaryHex: string, headerAccentStyle: string = 'classic') {
  if (typeof document === 'undefined') return;

  const validHex = primaryHex && primaryHex.startsWith('#') && (primaryHex.length === 7 || primaryHex.length === 4)
    ? primaryHex
    : '#2563eb';

  const shades = generateShades(validHex);
  const rgb = hexToRgb(validHex);
  const contrastText = getContrastTextColor(validHex);
  const root = document.documentElement;

  // 1. Tailwind v4 blue variable palette override
  root.style.setProperty('--color-blue-50', shades['50']);
  root.style.setProperty('--color-blue-100', shades['100']);
  root.style.setProperty('--color-blue-200', shades['200']);
  root.style.setProperty('--color-blue-300', shades['300']);
  root.style.setProperty('--color-blue-400', shades['400']);
  root.style.setProperty('--color-blue-500', shades['500']);
  root.style.setProperty('--color-blue-600', shades['600']);
  root.style.setProperty('--color-blue-700', shades['700']);
  root.style.setProperty('--color-blue-800', shades['800']);
  root.style.setProperty('--color-blue-900', shades['900']);

  // 2. Custom Brand UI CSS tokens
  root.style.setProperty('--brand-primary', validHex);
  root.style.setProperty('--brand-primary-hover', shades['700']);
  root.style.setProperty('--brand-primary-active', shades['800']);
  root.style.setProperty('--brand-primary-light', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
  root.style.setProperty('--brand-primary-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.35)`);
  root.style.setProperty('--brand-primary-rgb', shades.rgb);
  root.style.setProperty('--brand-primary-contrast', contrastText);

  // 3. Header Accent Style
  root.setAttribute('data-header-style', headerAccentStyle);
}
