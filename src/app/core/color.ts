/**
 * core/color — picks a readable foreground for a filled background. Requirements: UIX-011, ANN-001.
 * Colors are '#RRGGBB'. Contrast ratio and relative luminance as in WCAG 2.
 */
const BYTE_MAX = 255;
const HEX_RADIX = 16;
const CHANNEL_DIGITS = 2;
const LINEAR_THRESHOLD = 0.04045;
const LINEAR_SLOPE = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_SCALE = 1.055;
const GAMMA = 2.4;
const WEIGHT_RED = 0.2126;
const WEIGHT_GREEN = 0.7152;
const WEIGHT_BLUE = 0.0722;
const CONTRAST_OFFSET = 0.05;

function linear(channel: number): number {
  const c = channel / BYTE_MAX;
  return c <= LINEAR_THRESHOLD ? c / LINEAR_SLOPE : Math.pow((c + GAMMA_OFFSET) / GAMMA_SCALE, GAMMA);
}

/** 0 (black) .. 1 (white). */
export function relativeLuminance(hex: string): number {
  const digits = hex.replace('#', '');
  const [r, g, b] = [0, 1, 2].map((i) => linear(parseInt(digits.slice(i * CHANNEL_DIGITS, (i + 1) * CHANNEL_DIGITS), HEX_RADIX)));
  return WEIGHT_RED * (r as number) + WEIGHT_GREEN * (g as number) + WEIGHT_BLUE * (b as number);
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + CONTRAST_OFFSET) / (dark + CONTRAST_OFFSET);
}

/** Whichever of `a` and `b` has the higher contrast with `background` (`a` on a tie). */
export function readableOn(background: string, a: string, b: string): string {
  return contrastRatio(background, a) >= contrastRatio(background, b) ? a : b;
}
