import { describe, expect, it } from 'vitest';

import { sizeClassOf } from './layout';
import { sizeClassCases, sizeClassLimits } from './fixtures/layout.cases';

describe('sizeClassOf', () => {
  for (const c of sizeClassCases) {
    it(`${c.req} ${c.id}: ${c.width}x${c.height} -> ${c.expected}`, () => {
      expect(sizeClassOf(c.width, c.height, sizeClassLimits)).toBe(c.expected);
    });
  }
});
