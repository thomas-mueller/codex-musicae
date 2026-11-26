/**
 * Fixtures: core/edits
 * Requirements: ORG-014..ORG-024, PLY-007, PLY-009, PLY-013, PLY-016, MRK-001, MRK-013
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs
 * and docs/reference/core-reference-2.mjs). Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)).
 * V2-M4 S3: the cases run on marks on systems and compare the junction view. A jump from gap 0 or to gap N no longer exists
 * (DEC-153), so the cases that held one use gap 1 instead; AJ7, AJ8 and UJ6 reject them (docs/changelog.md).
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import { EMPTY_SYSTEM_MARKS } from '../marks';
import type { SystemMarks } from '../marks';
import type { Jump } from '../model';
import type { DocMarks, MarkedJump } from '../edits';

export const addJumpCases: ReadonlyArray<{ id: string; req: string; name: string; marks: DocMarks; jump: Jump; systemCount: number; expected: DocMarks | null }> = [
  {
    id: 'AJ1',
    req: 'ORG-015, PLY-007',
    name: 'valid jump gets id 1',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    jump: { origin: 2, target: 0, pass: 1 },
    systemCount: 4,
    expected: { jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }], breaks: [], stops: [], nextJumpId: 2 },
  },
  {
    id: 'AJ2',
    req: 'ORG-015, PLY-007',
    name: 'origin equal to target is invalid',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    jump: { origin: 2, target: 2, pass: 1 },
    systemCount: 4,
    expected: null,
  },
  {
    id: 'AJ3',
    req: 'ORG-015, PLY-007',
    name: 'second jump gets id 2 and keeps creation order',
    marks: { jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }], breaks: [], stops: [], nextJumpId: 2 },
    jump: { origin: 1, target: 3, pass: 2 },
    systemCount: 4,
    expected: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
  },
  {
    id: 'AJ4',
    req: 'ORG-015, PLY-007',
    name: 'origin N is valid (D.C. at the end)',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    jump: { origin: 4, target: 0, pass: 1 },
    systemCount: 4,
    expected: { jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }], breaks: [], stops: [], nextJumpId: 2 },
  },
  {
    id: 'AJ5',
    req: 'ORG-015, PLY-007',
    name: 'pass 0 is invalid',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    jump: { origin: 2, target: 0, pass: 0 },
    systemCount: 4,
    expected: null,
  },
  {
    id: 'AJ6',
    req: 'ORG-015, PLY-007',
    name: 'target above N is invalid',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    jump: { origin: 2, target: 5, pass: 1 },
    systemCount: 4,
    expected: null,
  },
  {
    id: 'AJ7',
    req: 'PLY-016',
    name: 'a jump from gap 0 has no start system',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    jump: { origin: 0, target: 3, pass: 1 },
    systemCount: 4,
    expected: null,
  },
  {
    id: 'AJ8',
    req: 'PLY-016',
    name: 'a jump to gap N has no target system',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    jump: { origin: 2, target: 4, pass: 1 },
    systemCount: 4,
    expected: null,
  },
];

export const removeJumpCases: ReadonlyArray<{ id: string; req: string; name: string; marks: DocMarks; jumpId: number; expected: DocMarks }> = [
  {
    id: 'RJ1',
    req: 'ORG-024',
    name: 'remove id 1: nextJumpId stays',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 1,
    expected: { jumps: [{ origin: 1, target: 3, pass: 2, id: 2 }], breaks: [], stops: [], nextJumpId: 3 },
  },
  {
    id: 'RJ2',
    req: 'ORG-024',
    name: 'unknown id leaves marks unchanged',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 99,
    expected: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
  },
];

export const updateJumpCases: ReadonlyArray<{ id: string; req: string; name: string; marks: DocMarks; jumpId: number; patch: Partial<Jump>; systemCount: number; expected: DocMarks | null }> = [
  {
    id: 'UJ1',
    req: 'ORG-020',
    name: 'change the pass, keep id and position',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 1,
    patch: { pass: 2 },
    systemCount: 4,
    expected: {
      jumps: [{ origin: 2, target: 0, pass: 2, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
  },
  {
    id: 'UJ2',
    req: 'ORG-020',
    name: 'change the target',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 2,
    patch: { target: 2 },
    systemCount: 4,
    expected: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 2, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
  },
  {
    id: 'UJ3',
    req: 'ORG-020',
    name: 'patch making origin equal to target is invalid',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 1,
    patch: { target: 2 },
    systemCount: 4,
    expected: null,
  },
  {
    id: 'UJ4',
    req: 'ORG-020',
    name: 'unknown id gives null',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 7,
    patch: { pass: 2 },
    systemCount: 4,
    expected: null,
  },
  {
    id: 'UJ5',
    req: 'ORG-020',
    name: 'pass 0 is invalid',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 1,
    patch: { pass: 0 },
    systemCount: 4,
    expected: null,
  },
  {
    id: 'UJ6',
    req: 'PLY-016',
    name: 'retargeting to gap N is invalid',
    marks: { jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }], breaks: [], stops: [], nextJumpId: 2 },
    jumpId: 1,
    patch: { target: 4 },
    systemCount: 4,
    expected: null,
  },
];

export const toggleCases: ReadonlyArray<{ id: string; req: string; kind: 'break' | 'stop'; marks: DocMarks; junction: number; systemCount: number; expected: DocMarks }> = [
  {
    id: 'TG1',
    req: 'ORG-022, PLY-013',
    kind: 'break',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    junction: 3,
    systemCount: 4,
    expected: { jumps: [], breaks: [3], stops: [], nextJumpId: 1 },
  },
  {
    id: 'TG2',
    req: 'ORG-022, PLY-013',
    kind: 'break',
    marks: { jumps: [], breaks: [3], stops: [], nextJumpId: 1 },
    junction: 3,
    systemCount: 4,
    expected: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
  },
  {
    id: 'TG3',
    req: 'ORG-022, PLY-013',
    kind: 'break',
    marks: { jumps: [], breaks: [3], stops: [], nextJumpId: 1 },
    junction: 1,
    systemCount: 4,
    expected: { jumps: [], breaks: [1, 3], stops: [], nextJumpId: 1 },
  },
  {
    id: 'TG4',
    req: 'ORG-022, PLY-013',
    kind: 'break',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    junction: 0,
    systemCount: 4,
    expected: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
  },
  {
    id: 'TG5',
    req: 'ORG-022, PLY-013',
    kind: 'break',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    junction: 4,
    systemCount: 4,
    expected: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
  },
  {
    id: 'TG6',
    req: 'ORG-022, PLY-013',
    kind: 'break',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    junction: 2.5,
    systemCount: 4,
    expected: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
  },
  {
    id: 'TG7',
    req: 'ORG-023, PLY-009',
    kind: 'stop',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    junction: 2,
    systemCount: 4,
    expected: { jumps: [], breaks: [], stops: [2], nextJumpId: 1 },
  },
  {
    id: 'TG8',
    req: 'ORG-023, PLY-009',
    kind: 'stop',
    marks: { jumps: [], breaks: [], stops: [2], nextJumpId: 1 },
    junction: 2,
    systemCount: 4,
    expected: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
  },
  {
    id: 'TG9',
    req: 'ORG-023, PLY-009',
    kind: 'stop',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    junction: 0,
    systemCount: 4,
    expected: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
  },
  {
    id: 'TG10',
    req: 'ORG-023, PLY-009',
    kind: 'stop',
    marks: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
    junction: 4,
    systemCount: 4,
    expected: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
  },
];

/** For each case: jumpsAtJunction, junctionHasItems and clearJunction of `marks` at `junction` (systemCount 4). */
export const junctionCases: ReadonlyArray<{
  id: string; req: string; marks: DocMarks; junction: number;
  atJunction: { asOrigin: MarkedJump[]; asTarget: MarkedJump[] }; hasItems: boolean; cleared: DocMarks;
}> = [
  {
    id: 'JX1',
    req: 'ORG-014, ORG-018',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
    junction: 0,
    atJunction: {
      asOrigin: [],
      asTarget: [{ origin: 2, target: 0, pass: 1, id: 1 }],
    },
    hasItems: true,
    cleared: { jumps: [{ origin: 1, target: 3, pass: 2, id: 2 }], breaks: [2], stops: [2], nextJumpId: 3 },
  },
  {
    id: 'JX2',
    req: 'ORG-014, ORG-018',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
    junction: 2,
    atJunction: { asOrigin: [{ origin: 2, target: 0, pass: 1, id: 1 }], asTarget: [] },
    hasItems: true,
    cleared: { jumps: [{ origin: 1, target: 3, pass: 2, id: 2 }], breaks: [], stops: [], nextJumpId: 3 },
  },
  {
    id: 'JX3',
    req: 'ORG-014, ORG-018',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
    junction: 3,
    atJunction: { asOrigin: [], asTarget: [{ origin: 1, target: 3, pass: 2, id: 2 }] },
    hasItems: true,
    cleared: { jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }], breaks: [2], stops: [2], nextJumpId: 3 },
  },
  {
    id: 'JX4',
    req: 'ORG-014, ORG-018',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
    junction: 4,
    atJunction: { asOrigin: [], asTarget: [] },
    hasItems: false,
    cleared: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 1, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
  },
];

export const jumpColorCases: ReadonlyArray<{ id: string; req: string; jumpId: number; paletteSize: number; expected: number }> = [
  { id: 'CL1', req: 'ORG-018', jumpId: 1, paletteSize: 8, expected: 0 },
  { id: 'CL2', req: 'ORG-018', jumpId: 2, paletteSize: 8, expected: 1 },
  { id: 'CL3', req: 'ORG-018', jumpId: 8, paletteSize: 8, expected: 7 },
  { id: 'CL4', req: 'ORG-018', jumpId: 9, paletteSize: 8, expected: 0 },
  { id: 'CL5', req: 'ORG-018', jumpId: 17, paletteSize: 8, expected: 0 },
  { id: 'CL6', req: 'ORG-018', jumpId: 5, paletteSize: 3, expected: 1 },
];

const p = (system: number) => ({ pageIndex: 0, system });
const last = (system: number) => ({ pageIndex: 2, system });
const FOREIGN = { file: 'Coda.pdf', pageIndex: 0, system: 1 };

/** Layout [3, 0, 2]: junctions 1..3 on page 0, systems 4 and 5 on page 2. */
export const VIEW_COUNTS = [3, 0, 2];

/** Marks of which the V1 chips can show only jump 1, the stop on p0s3 and the break on p2s1. */
export const MIXED_MARKS: SystemMarks = {
  ...EMPTY_SYSTEM_MARKS,
  start: { at: p(2), text: 'Intro' },
  bookmarks: [{ id: 1, at: p(3), ref: FOREIGN }],
  jumps: [
    { id: 1, from: last(2), to: p(1), pass: 1, text: 'D.C.' },
    { id: 2, from: p(3), to: FOREIGN, pass: 1 },
    { id: 3, from: p(1), to: p(2), pass: 1 },
    { id: 4, from: { pageIndex: 1, system: 1 }, to: p(1), pass: 1 },
  ],
  stops: [{ at: p(3) }, { at: last(2) }],
  breaks: [{ at: last(1) }, { at: { pageIndex: 4, system: 1 } }],
  nextJumpId: 5,
  nextBookmarkId: 2,
};

export const MIXED_VIEW: DocMarks = {
  jumps: [{ id: 1, origin: 5, target: 0, pass: 1 }], stops: [3], breaks: [4], nextJumpId: 5,
};

