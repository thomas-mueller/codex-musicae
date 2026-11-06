import { describe, expect, it } from 'vitest';

import { palmCases } from './fixtures/palm.cases';
import { PEN_INITIAL, reducePen, shouldIgnoreTouch, type PenEvent, type PenState } from './palm';
import { caseTitle, expectCloseDeep } from '../../testing/expect-close-deep';

describe('palm rejection fixtures', () => {
  for (const c of palmCases) {
    it(caseTitle(c, 'STY-004'), () => {
      let state: PenState = PEN_INITIAL;
      const checks: Array<{ now: number; expected: boolean }> = [];
      for (const step of c.steps) {
        if ('event' in step) {
          state = reducePen(state, step.event);
        } else {
          checks.push({ now: step.touch, expected: shouldIgnoreTouch(state, step.touch, c.graceMs) });
        }
      }
      expectCloseDeep(checks, c.expected.checks);
      expectCloseDeep(state, c.expected.finalState);
    });
  }
});

describe('reducePen', () => {
  const active: PenEvent['type'][] = ['pen-down', 'pen-move', 'pen-hover'];
  const inactive: PenEvent['type'][] = ['pen-up', 'pen-leave', 'pen-cancel'];

  for (const type of active) {
    it(`STY-004 ${type} sets active and lastT`, () => {
      expect(reducePen({ active: false, lastT: 1 }, { type, t: 42 })).toEqual({ active: true, lastT: 42 });
    });
  }
  for (const type of inactive) {
    it(`STY-004 ${type} clears active and sets lastT`, () => {
      expect(reducePen({ active: true, lastT: 1 }, { type, t: 42 })).toEqual({ active: false, lastT: 42 });
    });
  }

  it('STY-004 does not mutate the input state', () => {
    const s: PenState = { active: false, lastT: 5 };
    reducePen(s, { type: 'pen-down', t: 9 });
    expect(s).toEqual({ active: false, lastT: 5 });
  });
});

describe('shouldIgnoreTouch', () => {
  it('STY-004 the initial state never ignores a touch', () => {
    for (const now of [0, 1, 1e6, 1e12]) {
      expect(shouldIgnoreTouch(PEN_INITIAL, now, 300)).toBe(false);
    }
  });
});
