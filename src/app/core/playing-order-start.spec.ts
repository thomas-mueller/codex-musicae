import { describe, expect, it } from 'vitest';

import { forcedBreaksCases, generatePlayingOrderCases } from './fixtures/playing-order.cases';
import { deriveInputCases, startOrderCases } from './fixtures/playing-order-start.cases';
import type { SystemMarks, SystemRef } from './marks';
import { derivePlayingOrderInput, forcedBreaks, generatePlayingOrder } from './playing-order';
import type { PlayingOrderInput } from './playing-order';
import { frozen } from '../../testing/deep-freeze';
import { caseTitle, expectCloseDeep } from '../../testing/expect-close-deep';

describe('derivePlayingOrderInput', () => {
  for (const c of deriveInputCases) {
    it(caseTitle(c, 'PLY-014'), () => {
      expect(derivePlayingOrderInput(frozen(c.marks), frozen(c.counts), c.expected.maxLength)).toStrictEqual(c.expected);
    });
  }
});

describe('playing order from marks on systems', () => {
  for (const c of startOrderCases) {
    it(caseTitle(c, 'PLY-015'), () => {
      const input = derivePlayingOrderInput(frozen(c.marks), c.counts, c.maxLength);
      const order = generatePlayingOrder(input);
      expectCloseDeep(order, c.expected);
      if (c.forced !== undefined) {
        expect(forcedBreaks(order, new Set(input.breaks))).toEqual(c.forced);
      }
    });
  }
});

/**
 * The V1 cases rerun on marks on systems (all systems on one page): right side of system k = junction k, left side of
 * system k = junction k-1. Cases with a jump from junction 0 or to junction N have no such form (see the migration cases).
 */
function hasSystemForm({ jumps, systemCount }: PlayingOrderInput): boolean {
  return jumps.every((jump) => jump.origin >= 1 && jump.target < systemCount);
}

function onSystems(input: PlayingOrderInput, breaks: readonly number[] = []): SystemMarks {
  const system = (k: number): SystemRef => ({ pageIndex: 0, system: k });
  return {
    jumps: input.jumps.map((jump, i) => ({ id: i + 1, from: system(jump.origin), to: system(jump.target + 1), pass: jump.pass })),
    bookmarks: [],
    stops: input.stops.map((k) => ({ at: system(k) })),
    breaks: breaks.map((k) => ({ at: system(k) })),
    start: null,
    nextJumpId: input.jumps.length + 1,
    nextBookmarkId: 1,
  };
}

describe('V1 playing-order cases on the derived model', () => {
  for (const c of generatePlayingOrderCases.filter((o) => hasSystemForm(o.input))) {
    it(`PLY-014 ${c.id}: ${c.name}`, () => {
      const input = derivePlayingOrderInput(onSystems(c.input), [c.input.systemCount], c.input.maxLength);
      expectCloseDeep(generatePlayingOrder(input), c.expected);
    });
  }

  for (const c of forcedBreaksCases.filter((k) => hasSystemForm(k.input))) {
    it(`PLY-014 ${c.id}: ${c.name}`, () => {
      const input = derivePlayingOrderInput(onSystems(c.input, c.breaks), [c.input.systemCount], c.input.maxLength);
      expect(forcedBreaks(generatePlayingOrder(input), new Set(input.breaks))).toEqual(c.expected);
    });
  }
});
