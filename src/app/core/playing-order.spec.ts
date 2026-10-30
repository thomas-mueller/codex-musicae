import { describe, expect, it } from 'vitest';

import {
  forcedBreaksCases, generatePlayingOrderCases, isValidJumpCases, isValidMarkJunctionCases, systemNumbersCases,
} from './fixtures/playing-order.cases';
import {
  forcedBreaks, generatePlayingOrder, isValidJump, isValidMarkJunction, systemNumbers,
} from './playing-order';
import { caseTitle, expectCloseDeep } from '../../testing/expect-close-deep';

describe('generatePlayingOrder', () => {
  for (const c of generatePlayingOrderCases) {
    it(caseTitle(c, 'PLY-002'), () => {
      expectCloseDeep(generatePlayingOrder(c.input), c.expected);
    });
  }

  it('PLY-002 invariants hold for every fixture input', () => {
    for (const c of generatePlayingOrderCases) {
      const order = generatePlayingOrder(c.input);
      for (const e of order.entries) {
        expect(e).toBeGreaterThanOrEqual(1);
        expect(e).toBeLessThanOrEqual(c.input.systemCount);
      }
      expect(order.between.length).toBe(Math.max(0, order.entries.length - 1));
      order.between.forEach((b, i) => expect(b[0]).toBe(order.entries[i]));
      expect(generatePlayingOrder(c.input)).toEqual(order);
    }
  });

  it('NFR-001 N = 2000 without jumps returns 2000 entries in under 100 ms', () => {
    const systemCount = 2000;
    const maxMs = 100;
    const start = performance.now();
    const order = generatePlayingOrder({ systemCount, jumps: [], stops: [], maxLength: 20000 });
    const elapsed = performance.now() - start;
    expect(order.entries.length).toBe(systemCount);
    expect(elapsed).toBeLessThan(maxMs);
  });
});

describe('systemNumbers', () => {
  for (const c of systemNumbersCases) {
    it(caseTitle(c, 'PLY-010'), () => {
      expect(systemNumbers(generatePlayingOrder(c.input), c.input.systemCount)).toEqual(c.expected);
    });
  }
});

describe('forcedBreaks', () => {
  for (const c of forcedBreaksCases) {
    it(caseTitle(c, 'PLY-011'), () => {
      expect(forcedBreaks(generatePlayingOrder(c.input), new Set(c.breaks))).toEqual(c.expected);
    });
  }
});

describe('isValidJump', () => {
  for (const c of isValidJumpCases) {
    it(`${c.req} ${c.id}: ${JSON.stringify(c.jump)} with ${c.systemCount} systems`, () => {
      expect(isValidJump(c.jump, c.systemCount)).toBe(c.expected);
    });
  }
});

describe('isValidMarkJunction', () => {
  for (const c of isValidMarkJunctionCases) {
    it(`${c.req} ${c.id}: junction ${c.junction} with ${c.systemCount} systems`, () => {
      expect(isValidMarkJunction(c.junction, c.systemCount)).toBe(c.expected);
    });
  }
});
