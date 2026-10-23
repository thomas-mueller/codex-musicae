/**
 * Fixtures: core/autosave
 * Requirements: SAV-008, SAV-009, FIL-010
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference-3.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { SaveDecision, SaveEvent, SaveState } from '../autosave';

/** idleMs = 3000. Apply the steps in order from SAVE_INITIAL: an `event` step goes through reduceSave; a `check` step calls
 *  saveDecision(state, now, 3000) and compares with the expected decision of the same position in `expected.checks`.
 *  After all steps the state must equal expected.finalState. */
export type AutosaveStep = { event: SaveEvent } | { check: number };

export const autosaveCases: ReadonlyArray<{
  id: string; req: string; name: string; steps: AutosaveStep[];
  expected: { checks: Array<{ now: number; expected: SaveDecision }>; finalState: SaveState };
}> = [
  {
    id: 'AS01',
    req: 'SAV-008, SAV-009',
    name: 'idle delay after a change',
    steps: [{ event: { type: 'change', t: 0 } }, { check: 1000 }, { check: 2999 }, { check: 3000 }],
    expected: {
      checks: [
        { now: 1000, expected: { action: 'wait', until: 3000 } },
        { now: 2999, expected: { action: 'wait', until: 3000 } },
        { now: 3000, expected: { action: 'save' } },
      ],
      finalState: {
        dirty: true,
        lastChangeT: 0,
        strokeInProgress: false,
        saving: false,
        forced: false,
        failed: false,
      },
    },
  },
  {
    id: 'AS02',
    req: 'SAV-008, SAV-009',
    name: 'a later change moves the deadline',
    steps: [
      { event: { type: 'change', t: 0 } },
      { event: { type: 'change', t: 2000 } },
      { check: 4000 },
      { check: 5000 },
    ],
    expected: {
      checks: [
        { now: 4000, expected: { action: 'wait', until: 5000 } },
        { now: 5000, expected: { action: 'save' } },
      ],
      finalState: {
        dirty: true,
        lastChangeT: 2000,
        strokeInProgress: false,
        saving: false,
        forced: false,
        failed: false,
      },
    },
  },
  {
    id: 'AS03',
    req: 'SAV-008, SAV-009',
    name: 'nothing to save',
    steps: [{ check: 0 }, { check: 100000 }],
    expected: {
      checks: [{ now: 0, expected: { action: 'none' } }, { now: 100000, expected: { action: 'none' } }],
      finalState: {
        dirty: false,
        lastChangeT: 0,
        strokeInProgress: false,
        saving: false,
        forced: false,
        failed: false,
      },
    },
  },
  {
    id: 'AS04',
    req: 'SAV-008, SAV-009',
    name: 'never during a stroke; the stroke end counts as a change',
    steps: [
      { event: { type: 'strokeStart' } },
      { event: { type: 'change', t: 0 } },
      { check: 10000 },
      { event: { type: 'strokeEnd', t: 10000 } },
      { check: 10000 },
      { check: 13000 },
    ],
    expected: {
      checks: [
        { now: 10000, expected: { action: 'none' } },
        { now: 10000, expected: { action: 'wait', until: 13000 } },
        { now: 13000, expected: { action: 'save' } },
      ],
      finalState: {
        dirty: true,
        lastChangeT: 10000,
        strokeInProgress: false,
        saving: false,
        forced: false,
        failed: false,
      },
    },
  },
  {
    id: 'AS05',
    req: 'SAV-008, SAV-009',
    name: 'forced trigger waits for the stroke to end',
    steps: [
      { event: { type: 'strokeStart' } },
      { event: { type: 'change', t: 0 } },
      { event: { type: 'force' } },
      { check: 500 },
      { event: { type: 'strokeEnd', t: 600 } },
      { check: 600 },
    ],
    expected: {
      checks: [{ now: 500, expected: { action: 'none' } }, { now: 600, expected: { action: 'save' } }],
      finalState: {
        dirty: true,
        lastChangeT: 600,
        strokeInProgress: false,
        saving: false,
        forced: true,
        failed: false,
      },
    },
  },
  {
    id: 'AS06',
    req: 'SAV-008, SAV-009',
    name: 'forced trigger saves at once',
    steps: [{ event: { type: 'change', t: 0 } }, { event: { type: 'force' } }, { check: 1 }],
    expected: {
      checks: [{ now: 1, expected: { action: 'save' } }],
      finalState: {
        dirty: true,
        lastChangeT: 0,
        strokeInProgress: false,
        saving: false,
        forced: true,
        failed: false,
      },
    },
  },
  {
    id: 'AS07',
    req: 'SAV-008, SAV-009',
    name: 'forced trigger without changes does nothing',
    steps: [{ event: { type: 'force' } }, { check: 1 }],
    expected: {
      checks: [{ now: 1, expected: { action: 'none' } }],
      finalState: {
        dirty: false,
        lastChangeT: 0,
        strokeInProgress: false,
        saving: false,
        forced: true,
        failed: false,
      },
    },
  },
  {
    id: 'AS08',
    req: 'SAV-008, SAV-009',
    name: 'a change during a running save schedules another save',
    steps: [
      { event: { type: 'change', t: 0 } },
      { event: { type: 'saveStarted' } },
      { event: { type: 'change', t: 100 } },
      { check: 150 },
      { event: { type: 'saveFinished', ok: true, t: 200 } },
      { check: 2000 },
      { check: 3100 },
    ],
    expected: {
      checks: [
        { now: 150, expected: { action: 'none' } },
        { now: 2000, expected: { action: 'wait', until: 3100 } },
        { now: 3100, expected: { action: 'save' } },
      ],
      finalState: {
        dirty: true,
        lastChangeT: 100,
        strokeInProgress: false,
        saving: false,
        forced: false,
        failed: false,
      },
    },
  },
  {
    id: 'AS09',
    req: 'SAV-008, SAV-009',
    name: 'after a failure there is no automatic retry',
    steps: [
      { event: { type: 'change', t: 0 } },
      { event: { type: 'saveStarted' } },
      { event: { type: 'saveFinished', ok: false, t: 3500 } },
      { check: 10000 },
      { check: 99999 },
    ],
    expected: {
      checks: [{ now: 10000, expected: { action: 'none' } }, { now: 99999, expected: { action: 'none' } }],
      finalState: {
        dirty: true,
        lastChangeT: 0,
        strokeInProgress: false,
        saving: false,
        forced: false,
        failed: true,
      },
    },
  },
  {
    id: 'AS10',
    req: 'SAV-008, SAV-009',
    name: 'a forced trigger retries after a failure',
    steps: [
      { event: { type: 'change', t: 0 } },
      { event: { type: 'saveStarted' } },
      { event: { type: 'saveFinished', ok: false, t: 3500 } },
      { event: { type: 'force' } },
      { check: 4000 },
    ],
    expected: {
      checks: [{ now: 4000, expected: { action: 'save' } }],
      finalState: {
        dirty: true,
        lastChangeT: 0,
        strokeInProgress: false,
        saving: false,
        forced: true,
        failed: false,
      },
    },
  },
  {
    id: 'AS11',
    req: 'SAV-008, SAV-009',
    name: 'a new change clears the failure',
    steps: [
      { event: { type: 'change', t: 0 } },
      { event: { type: 'saveStarted' } },
      { event: { type: 'saveFinished', ok: false, t: 3500 } },
      { event: { type: 'change', t: 4000 } },
      { check: 5000 },
      { check: 7000 },
    ],
    expected: {
      checks: [
        { now: 5000, expected: { action: 'wait', until: 7000 } },
        { now: 7000, expected: { action: 'save' } },
      ],
      finalState: {
        dirty: true,
        lastChangeT: 4000,
        strokeInProgress: false,
        saving: false,
        forced: false,
        failed: false,
      },
    },
  },
  {
    id: 'AS12',
    req: 'SAV-008, SAV-009',
    name: 'successful save leaves nothing dirty',
    steps: [
      { event: { type: 'change', t: 0 } },
      { event: { type: 'saveStarted' } },
      { event: { type: 'saveFinished', ok: true, t: 500 } },
      { check: 100000 },
    ],
    expected: {
      checks: [{ now: 100000, expected: { action: 'none' } }],
      finalState: {
        dirty: false,
        lastChangeT: 0,
        strokeInProgress: false,
        saving: false,
        forced: false,
        failed: false,
      },
    },
  },
  {
    id: 'AS13',
    req: 'SAV-008, SAV-009',
    name: 'forced is cleared when the save starts',
    steps: [
      { event: { type: 'change', t: 0 } },
      { event: { type: 'force' } },
      { event: { type: 'saveStarted' } },
      { event: { type: 'saveFinished', ok: true, t: 10 } },
      { event: { type: 'change', t: 20 } },
      { check: 30 },
    ],
    expected: {
      checks: [{ now: 30, expected: { action: 'wait', until: 3020 } }],
      finalState: {
        dirty: true,
        lastChangeT: 20,
        strokeInProgress: false,
        saving: false,
        forced: false,
        failed: false,
      },
    },
  },
];
