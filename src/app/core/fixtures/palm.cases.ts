/**
 * Fixtures: core/palm
 * Requirements: STY-004
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference-3.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { PenEvent, PenState } from '../palm';

/** graceMs = 300. Apply the steps in order from PEN_INITIAL: an `event` step goes through reducePen; a `touch` step calls
 *  shouldIgnoreTouch(state, now, 300) and compares with the same position in `expected.checks`. Final state must equal expected.finalState. */
export type PalmStep = { event: PenEvent } | { touch: number };

export const palmCases: ReadonlyArray<{
  id: string; req: string; name: string; graceMs: number; steps: PalmStep[];
  expected: { checks: Array<{ now: number; expected: boolean }>; finalState: PenState };
}> = [
  {
    id: 'PR01',
    req: 'STY-004',
    name: 'no pen seen: touch is accepted',
    graceMs: 300,
    steps: [{ touch: 0 }, { touch: 5000 }],
    expected: {
      checks: [{ now: 0, expected: false }, { now: 5000, expected: false }],
      finalState: { active: false, lastT: -1000000000000 },
    },
  },
  {
    id: 'PR02',
    req: 'STY-004',
    name: 'touch ignored while the pen is down',
    graceMs: 300,
    steps: [
      { event: { type: 'pen-down', t: 1000 } },
      { touch: 1100 },
      { event: { type: 'pen-move', t: 1150 } },
      { touch: 1200 },
    ],
    expected: {
      checks: [{ now: 1100, expected: true }, { now: 1200, expected: true }],
      finalState: { active: true, lastT: 1150 },
    },
  },
  {
    id: 'PR03',
    req: 'STY-004',
    name: 'grace period after pen-up is inclusive',
    graceMs: 300,
    steps: [
      { event: { type: 'pen-down', t: 1000 } },
      { event: { type: 'pen-up', t: 1200 } },
      { touch: 1400 },
      { touch: 1500 },
      { touch: 1501 },
    ],
    expected: {
      checks: [{ now: 1400, expected: true }, { now: 1500, expected: true }, { now: 1501, expected: false }],
      finalState: { active: false, lastT: 1200 },
    },
  },
  {
    id: 'PR04',
    req: 'STY-004',
    name: 'hovering counts as active',
    graceMs: 300,
    steps: [
      { event: { type: 'pen-hover', t: 5000 } },
      { touch: 5100 },
      { event: { type: 'pen-leave', t: 5200 } },
      { touch: 5300 },
      { touch: 5600 },
    ],
    expected: {
      checks: [{ now: 5100, expected: true }, { now: 5300, expected: true }, { now: 5600, expected: false }],
      finalState: { active: false, lastT: 5200 },
    },
  },
  {
    id: 'PR05',
    req: 'STY-004',
    name: 'cancel ends the pen contact',
    graceMs: 300,
    steps: [
      { event: { type: 'pen-down', t: 100 } },
      { event: { type: 'pen-cancel', t: 150 } },
      { touch: 200 },
      { touch: 451 },
    ],
    expected: {
      checks: [{ now: 200, expected: true }, { now: 451, expected: false }],
      finalState: { active: false, lastT: 150 },
    },
  },
];
