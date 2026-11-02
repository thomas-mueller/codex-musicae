import { describe, expect, it } from 'vitest';

import { contrastRatio, readableOn, relativeLuminance } from './color';

const DIGITS = 6;
const WCAG_MAX_CONTRAST = 21;

describe('color', () => {
  it('UIX-011 luminance of black and white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, DIGITS);
  });

  it('UIX-011 contrast of black on white is the WCAG maximum', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(WCAG_MAX_CONTRAST, DIGITS);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(WCAG_MAX_CONTRAST, DIGITS);
  });

  it('ANN-001 a dark icon on yellow, a light icon on dark red, either is picked by contrast', () => {
    expect(readableOn('#FDD835', '#202124', '#FFFFFF')).toBe('#202124');
    expect(readableOn('#D32F2F', '#202124', '#FFFFFF')).toBe('#FFFFFF');
    expect(readableOn('#212121', '#202124', '#FFFFFF')).toBe('#FFFFFF');
  });
});
