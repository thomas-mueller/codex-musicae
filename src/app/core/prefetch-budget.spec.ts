import { describe, expect, it } from 'vitest';

import { BITMAP_BYTES_PER_PIXEL, prefetchCountFor } from './prefetch-budget';

const MIB = 1024 * 1024;
const SHARE = 0.8;
const BUCKET_BUDGETS_MIB = { 1: 48, 2: 96, 4: 192, 8: 320 };
/** A full-width slide on a 3840x2157 stage. */
const SLIDE_4K = 3840 * 2157 * BITMAP_BYTES_PER_PIXEL;

describe('prefetchCountFor', () => {
  it('NFR-027 returns the wanted count when everything fits', () => {
    expect(prefetchCountFor(10, 1000, 1, 1)).toBe(1);
  });

  it('NFR-027 is capped at the wanted count', () => {
    expect(prefetchCountFor(10, 1000, 2, 1)).toBe(2);
    expect(prefetchCountFor(10, 1000, 99, 1)).toBe(49);
  });

  it('NFR-027 counts the current slide plus one neighbor per side per step', () => {
    expect(prefetchCountFor(10, 29, 9, 1)).toBe(0);
    expect(prefetchCountFor(10, 30, 9, 1)).toBe(1); // 3 slides fit exactly
    expect(prefetchCountFor(10, 49, 9, 1)).toBe(1);
    expect(prefetchCountFor(10, 50, 9, 1)).toBe(2);
  });

  it('NFR-027 applies the budget share', () => {
    expect(prefetchCountFor(10, 40, 9, 1)).toBe(1);
    expect(prefetchCountFor(10, 40, 9, 0.5)).toBe(0);
  });

  it('NFR-027 is 0 when not even the current slide fits', () => {
    expect(prefetchCountFor(100, 50, 3, 1)).toBe(0);
  });

  it('NFR-027 is 0 when nothing is wanted or an input is not a number', () => {
    expect(prefetchCountFor(10, 1000, 0, 1)).toBe(0);
    expect(prefetchCountFor(10, Number.NaN, 1, 1)).toBe(0);
    expect(prefetchCountFor(Number.POSITIVE_INFINITY, 1000, 1, 1)).toBe(0);
    expect(prefetchCountFor(10, 1000, Number.NaN, 1)).toBe(0);
  });

  it('NFR-027 a slide of unknown size does not limit the prefetch', () => {
    expect(prefetchCountFor(0, 1000, 1, 1)).toBe(1);
  });

  it('NFR-027 per memory bucket a 4K slide and its neighbors fit into the budget or prefetch is 0', () => {
    const counts = Object.entries(BUCKET_BUDGETS_MIB).map(([, mib]) => prefetchCountFor(SLIDE_4K, mib * MIB, 1, SHARE));
    expect(counts).toEqual([0, 0, 1, 1]);
    for (const mib of Object.values(BUCKET_BUDGETS_MIB)) {
      for (const slideBytes of [SLIDE_4K, SLIDE_4K / 2, SLIDE_4K * 1.5, 12_000_000 * BITMAP_BYTES_PER_PIXEL]) {
        const n = prefetchCountFor(slideBytes, mib * MIB, 3, SHARE);
        expect((1 + 2 * n) * slideBytes).toBeLessThanOrEqual(mib * MIB * SHARE + (n === 0 ? slideBytes : 0));
        if (n > 0) {
          expect((1 + 2 * n) * slideBytes).toBeLessThanOrEqual(mib * MIB);
        }
      }
    }
  });
});
