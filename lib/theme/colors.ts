// Utilidades de theming de marca — sin dependencias nuevas. Convierte los 3
// colores base que el admin puede elegir (ink/sand/teal, hex) a las 7
// variables CSS que tailwind.config.ts espera (hsl(var(--brand-*))),
// derivando las variantes light/dark automáticamente para que Manu no
// tenga que pensar en 7 tonos — solo elige 3 colores.

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function hexToHsl(hex: string): Hsl {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslString({ h, s, l }: Hsl): string {
  return `${h} ${s}% ${l}%`;
}

/** Sube o baja la luminosidad (acotada a [0, 100]) manteniendo tono y saturación. */
function adjustLightness(hsl: Hsl, deltaPercentPoints: number): Hsl {
  return { ...hsl, l: Math.max(0, Math.min(100, hsl.l + deltaPercentPoints)) };
}

const LIGHT_DELTA = 12;
const DARK_DELTA = -12;

export interface ThemeOverrideInput {
  ink?: string | null;
  sand?: string | null;
  teal?: string | null;
}

/**
 * Devuelve el contenido de un bloque `:root { ... }` con solo las
 * variables que tienen override (las demás quedan con el default de
 * globals.css). `null`/`undefined` = "usar default", consistente con la
 * semántica de "restaurar colores por defecto" en site_settings.
 */
export function buildThemeOverrideCss(input: ThemeOverrideInput): string {
  const declarations: string[] = [];

  if (input.ink) {
    declarations.push(`--brand-ink: ${hslString(hexToHsl(input.ink))};`);
  }
  if (input.sand) {
    const base = hexToHsl(input.sand);
    declarations.push(`--brand-sand: ${hslString(base)};`);
    declarations.push(`--brand-sand-light: ${hslString(adjustLightness(base, LIGHT_DELTA))};`);
    declarations.push(`--brand-sand-dark: ${hslString(adjustLightness(base, DARK_DELTA))};`);
  }
  if (input.teal) {
    const base = hexToHsl(input.teal);
    declarations.push(`--brand-teal: ${hslString(base)};`);
    declarations.push(`--brand-teal-light: ${hslString(adjustLightness(base, LIGHT_DELTA))};`);
    declarations.push(`--brand-teal-dark: ${hslString(adjustLightness(base, DARK_DELTA))};`);
  }

  if (declarations.length === 0) return '';
  return `:root { ${declarations.join(' ')} }`;
}
