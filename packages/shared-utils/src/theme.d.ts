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
export declare const SURFACE_PRESETS: SurfacePreset[];
export declare const THEME_PRESETS: ThemePreset[];
export interface RGB {
    r: number;
    g: number;
    b: number;
}
export declare function hexToRgb(hex: string): RGB;
export declare function rgbToHex(rgb: RGB): string;
export declare function mixRgb(c1: RGB, c2: RGB, weight: number): RGB;
export declare function getContrastTextColor(hex: string): '#ffffff' | '#0f172a';
export declare function generateShades(baseHex: string): {
    '50': string;
    '100': string;
    '200': string;
    '300': string;
    '400': string;
    '500': string;
    '600': string;
    '700': string;
    '800': string;
    '900': string;
    rgb: string;
};
export declare function applySurfaceTheme(surfaceId?: string, customHex?: string): void;
export declare function applyTheme(primaryHex: string, headerAccentStyle?: string, surfaceThemeId?: string, customSurfaceHex?: string): void;
//# sourceMappingURL=theme.d.ts.map