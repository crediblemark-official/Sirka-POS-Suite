export interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  description: string;
  category: string;
}

export interface SurfacePreset {
  id: string;
  name: string;
  bgHex: string;
  headerHex: string;
  tabBarHex: string;
  description: string;
  badge: string;
  isDark?: boolean;
}

export const SURFACE_PRESETS: SurfacePreset[] = [
  {
    id: 'bone-white',
    name: 'Warna Tulang (Broken White)',
    bgHex: '#fcfbfa',
    headerHex: '#eeeae1',
    tabBarHex: '#e5e0d4',
    description: 'Nuansa putih tulang khas, bersih, elegan, dan nyaman di mata',
    badge: 'Favorit'
  },
  {
    id: 'clean-white',
    name: 'Putih Bersih (Modern SaaS)',
    bgHex: '#f8fafc',
    headerHex: '#ffffff',
    tabBarHex: '#f1f5f9',
    description: 'Nuansa putih cerah, bersih, dan modern minimalis',
    badge: 'Terang'
  },
  {
    id: 'classic-gray',
    name: 'Abu-abu Klasik (Desktop)',
    bgHex: '#ecebe9',
    headerHex: '#dfddd9',
    tabBarHex: '#d6d4cf',
    description: 'Nuansa abu-abu desktop Linux/PC klasik (bawaan sistem)',
    badge: 'Abu-abu'
  },
  {
    id: 'warm-sand',
    name: 'Krem Hangat (Warm Paper)',
    bgHex: '#f7f4ee',
    headerHex: '#ece5d8',
    tabBarHex: '#e4dcd0',
    description: 'Nuansa kertas & kayu hangat khas toko organik & kafe',
    badge: 'Hangat'
  },
  {
    id: 'soft-mint',
    name: 'Soft Mint (Hijau Lembut)',
    bgHex: '#f0fdf4',
    headerHex: '#dcfce7',
    tabBarHex: '#bbf7d0',
    description: 'Nuansa hijau pastel sejuk untuk toko sayur, sembako & apotek',
    badge: 'Segar'
  },
  {
    id: 'dark-slate',
    name: 'Mode Gelap (Dark Charcoal)',
    bgHex: '#0f172a',
    headerHex: '#1e293b',
    tabBarHex: '#182234',
    description: 'Nuansa gelap elegan, nyaman untuk mata dan hemat daya',
    badge: 'Gelap',
    isDark: true
  }
];

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

export function applySurfaceTheme(surfaceId: string = 'classic-gray', customHex?: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  interface SurfaceTokens {
    body: string;
    header: string;
    headerBorder: string;
    tabBar: string;
    tabActive: string;
    tabInactive: string;
    tabBorder: string;
    ribbon: string;
    ribbonBorder: string;
    tableHead: string;
    text: string;
    textMuted: string;
    border: string;
    card: string;
    isDark: boolean;
  }

  let tokens: SurfaceTokens;

  switch (surfaceId) {
    case 'bone-white':
      tokens = {
        body: '#fcfbfa',
        header: '#eeeae1',
        headerBorder: '#ded8cb',
        tabBar: '#e5e0d4',
        tabActive: '#fcfbfa',
        tabInactive: '#ded8cb',
        tabBorder: '#cec6b6',
        ribbon: '#f6f3eb',
        ribbonBorder: '#e6dfd1',
        tableHead: '#ede7dc',
        text: '#2a2620',
        textMuted: '#70685c',
        border: '#d6cfc1',
        card: '#ffffff',
        isDark: false
      };
      break;

    case 'clean-white':
      tokens = {
        body: '#f8fafc',
        header: '#ffffff',
        headerBorder: '#e2e8f0',
        tabBar: '#f1f5f9',
        tabActive: '#ffffff',
        tabInactive: '#e2e8f0',
        tabBorder: '#cbd5e1',
        ribbon: '#ffffff',
        ribbonBorder: '#e2e8f0',
        tableHead: '#f1f5f9',
        text: '#0f172a',
        textMuted: '#64748b',
        border: '#cbd5e1',
        card: '#ffffff',
        isDark: false
      };
      break;

    case 'warm-sand':
      tokens = {
        body: '#f7f4ee',
        header: '#ece5d8',
        headerBorder: '#dcd3c3',
        tabBar: '#e4dcd0',
        tabActive: '#f7f4ee',
        tabInactive: '#dacfc0',
        tabBorder: '#c8bcab',
        ribbon: '#faf8f4',
        ribbonBorder: '#e6decfa0',
        tableHead: '#eee7dc',
        text: '#2b251e',
        textMuted: '#6b6255',
        border: '#d0c4b2',
        card: '#ffffff',
        isDark: false
      };
      break;

    case 'soft-mint':
      tokens = {
        body: '#f0fdf4',
        header: '#dcfce7',
        headerBorder: '#bbf7d0',
        tabBar: '#c8f5d6',
        tabActive: '#f0fdf4',
        tabInactive: '#b8eccb',
        tabBorder: '#a3e6be',
        ribbon: '#f4fdf7',
        ribbonBorder: '#d1fae5',
        tableHead: '#e2f9ec',
        text: '#14532d',
        textMuted: '#166534',
        border: '#86efac',
        card: '#ffffff',
        isDark: false
      };
      break;

    case 'dark-slate':
      tokens = {
        body: '#0f172a',
        header: '#1e293b',
        headerBorder: '#334155',
        tabBar: '#182234',
        tabActive: '#0f172a',
        tabInactive: '#1e293b',
        tabBorder: '#334155',
        ribbon: '#1e293b',
        ribbonBorder: '#334155',
        tableHead: '#1e293b',
        text: '#f8fafc',
        textMuted: '#cbd5e1',
        border: '#334155',
        card: '#1e293b',
        isDark: true
      };
      break;

    case 'custom': {
      const validHex = customHex && customHex.startsWith('#') && (customHex.length === 7 || customHex.length === 4)
        ? customHex
        : '#ecebe9';
      const baseRgb = hexToRgb(validHex);
      const isDark = getContrastTextColor(validHex) === '#ffffff';
      const white: RGB = { r: 255, g: 255, b: 255 };
      const black: RGB = { r: 0, g: 0, b: 0 };

      tokens = {
        body: validHex,
        header: isDark ? rgbToHex(mixRgb(baseRgb, white, 0.08)) : rgbToHex(mixRgb(baseRgb, black, 0.07)),
        headerBorder: isDark ? rgbToHex(mixRgb(baseRgb, white, 0.16)) : rgbToHex(mixRgb(baseRgb, black, 0.15)),
        tabBar: isDark ? rgbToHex(mixRgb(baseRgb, white, 0.04)) : rgbToHex(mixRgb(baseRgb, black, 0.10)),
        tabActive: validHex,
        tabInactive: isDark ? rgbToHex(mixRgb(baseRgb, white, 0.08)) : rgbToHex(mixRgb(baseRgb, black, 0.14)),
        tabBorder: isDark ? rgbToHex(mixRgb(baseRgb, white, 0.20)) : rgbToHex(mixRgb(baseRgb, black, 0.22)),
        ribbon: isDark ? rgbToHex(mixRgb(baseRgb, white, 0.05)) : rgbToHex(mixRgb(baseRgb, white, 0.60)),
        ribbonBorder: isDark ? rgbToHex(mixRgb(baseRgb, white, 0.15)) : rgbToHex(mixRgb(baseRgb, black, 0.12)),
        tableHead: isDark ? rgbToHex(mixRgb(baseRgb, white, 0.08)) : rgbToHex(mixRgb(baseRgb, black, 0.05)),
        text: isDark ? '#f8fafc' : '#1e293b',
        textMuted: isDark ? '#cbd5e1' : '#64748b',
        border: isDark ? rgbToHex(mixRgb(baseRgb, white, 0.18)) : rgbToHex(mixRgb(baseRgb, black, 0.18)),
        card: isDark ? rgbToHex(mixRgb(baseRgb, white, 0.06)) : '#ffffff',
        isDark
      };
      break;
    }

    case 'classic-gray':
    default:
      tokens = {
        body: '#ecebe9',
        header: '#dfddd9',
        headerBorder: '#c8c5c0',
        tabBar: '#d6d4cf',
        tabActive: '#ecebe9',
        tabInactive: '#cac6c0',
        tabBorder: '#b0aca5',
        ribbon: '#f6f5f2',
        ribbonBorder: '#e5e3de',
        tableHead: '#f0ede8',
        text: '#2e2b28',
        textMuted: '#6b655f',
        border: '#b8b5af',
        card: '#ffffff',
        isDark: false
      };
      break;
  }

  // Set CSS Variables on documentElement
  root.style.setProperty('--surface-body', tokens.body);
  root.style.setProperty('--surface-header', tokens.header);
  root.style.setProperty('--surface-header-border', tokens.headerBorder);
  root.style.setProperty('--surface-tab-bar', tokens.tabBar);
  root.style.setProperty('--surface-tab-active', tokens.tabActive);
  root.style.setProperty('--surface-tab-inactive', tokens.tabInactive);
  root.style.setProperty('--surface-tab-border', tokens.tabBorder);
  root.style.setProperty('--surface-ribbon', tokens.ribbon);
  root.style.setProperty('--surface-ribbon-border', tokens.ribbonBorder);
  root.style.setProperty('--surface-table-head', tokens.tableHead);
  root.style.setProperty('--surface-text', tokens.text);
  root.style.setProperty('--surface-text-muted', tokens.textMuted);
  root.style.setProperty('--surface-border', tokens.border);
  root.style.setProperty('--surface-card', tokens.card);

  root.setAttribute('data-surface-theme', surfaceId);
  root.setAttribute('data-theme-mode', tokens.isDark ? 'dark' : 'light');
}

export function applyTheme(
  primaryHex: string,
  headerAccentStyle: string = 'classic',
  surfaceThemeId: string = 'classic-gray',
  customSurfaceHex?: string
) {
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

  // 4. Apply Surface / Background Theme
  applySurfaceTheme(surfaceThemeId, customSurfaceHex);
}
