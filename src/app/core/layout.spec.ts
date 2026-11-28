import { describe, expect, it } from 'vitest';

import { isNarrow, sizeClassOf } from './layout';
import { narrowCases, sizeClassCases, sizeClassLimits } from './fixtures/layout.cases';

describe('sizeClassOf', () => {
  for (const c of sizeClassCases) {
    it(`${c.req} ${c.id}: ${c.width}x${c.height} -> ${c.expected}`, () => {
      expect(sizeClassOf(c.width, c.height, sizeClassLimits)).toBe(c.expected);
    });
  }
});

describe('isNarrow', () => {
  for (const c of narrowCases) {
    it(`${c.req} ${c.id}: width ${c.width} -> ${c.expected}`, () => {
      expect(isNarrow(c.width, sizeClassLimits)).toBe(c.expected);
    });
  }
});
