import { describe, expect, it } from 'vitest';

import { classifyRaster } from './raster-check';

const LIMITS = { minAlpha: 250, flatTolerance: 2 };
const OPAQUE = 255;
const PIXELS = 16;

/** `count` identical RGBA pixels. */
const pixels = (count: number, rgba: readonly number[]): number[] => Array.from({ length: count }, () => rgba).flat();

describe('classifyRaster (NFR-028)', () => {
  it('NFR-028 a fully transparent canvas is lost', () => {
    expect(classifyRaster(pixels(PIXELS, [0, 0, 0, 0]), LIMITS)).toBe('lost');
  });

  it('NFR-028 a white opaque page is flat, not lost: real pages can be completely white', () => {
    expect(classifyRaster(pixels(PIXELS, [255, 255, 255, OPAQUE]), LIMITS)).toBe('flat');
  });

  it('NFR-028 an opaque page with ink is ok', () => {
    const samples = [...pixels(PIXELS - 1, [255, 255, 255, OPAQUE]), 20, 20, 20, OPAQUE];
    expect(classifyRaster(samples, LIMITS)).toBe('ok');
  });

  it('NFR-028 one transparent sample among opaque ones is lost', () => {
    const samples = [...pixels(PIXELS - 1, [200, 200, 200, OPAQUE]), 200, 200, 200, 0];
    expect(classifyRaster(samples, LIMITS)).toBe('lost');
  });

  it('NFR-028 the alpha limit and the flat tolerance are inclusive of their boundary values', () => {
    expect(classifyRaster(pixels(PIXELS, [255, 255, 255, 250]), LIMITS)).toBe('flat');
    expect(classifyRaster(pixels(PIXELS, [255, 255, 255, 249]), LIMITS)).toBe('lost');
    const faint = [...pixels(PIXELS - 1, [255, 255, 255, OPAQUE]), 253, 253, 253, OPAQUE];
    expect(classifyRaster(faint, LIMITS)).toBe('flat');
    const visible = [...pixels(PIXELS - 1, [255, 255, 255, OPAQUE]), 252, 252, 252, OPAQUE];
    expect(classifyRaster(visible, LIMITS)).toBe('ok');
  });

  it('NFR-028 a flat colour that is not white is flat too', () => {
    expect(classifyRaster(pixels(PIXELS, [10, 20, 30, OPAQUE]), LIMITS)).toBe('flat');
  });

  it('NFR-028 no samples means nothing to judge', () => {
    expect(classifyRaster([], LIMITS)).toBe('ok');
    expect(classifyRaster([1, 2], LIMITS)).toBe('ok');
  });

  it('NFR-028 a colour that differs in one channel only is ok', () => {
    const samples = [...pixels(PIXELS - 1, [255, 255, 255, OPAQUE]), 255, 255, 200, OPAQUE];
    expect(classifyRaster(samples, LIMITS)).toBe('ok');
  });
});
