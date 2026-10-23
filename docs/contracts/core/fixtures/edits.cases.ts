/**
 * Fixtures: core/edits
 * Requirements: ORG-014..ORG-024, PLY-007, PLY-009, PLY-013, DET-015
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs
 * and docs/reference/core-reference-2.mjs). Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)).
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
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
    jump: { origin: 0, target: 3, pass: 2 },
    systemCount: 4,
    expected: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
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
];

export const removeJumpCases: ReadonlyArray<{ id: string; req: string; name: string; marks: DocMarks; jumpId: number; expected: DocMarks }> = [
  {
    id: 'RJ1',
    req: 'ORG-024',
    name: 'remove id 1: nextJumpId stays',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 1,
    expected: { jumps: [{ origin: 0, target: 3, pass: 2, id: 2 }], breaks: [], stops: [], nextJumpId: 3 },
  },
  {
    id: 'RJ2',
    req: 'ORG-024',
    name: 'unknown id leaves marks unchanged',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 99,
    expected: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
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
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 1,
    patch: { pass: 2 },
    systemCount: 4,
    expected: {
      jumps: [{ origin: 2, target: 0, pass: 2, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
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
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 2,
    patch: { target: 4 },
    systemCount: 4,
    expected: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 4, pass: 2, id: 2 }],
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
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
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
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
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
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [],
      stops: [],
      nextJumpId: 3,
    },
    jumpId: 1,
    patch: { pass: 0 },
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
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
    junction: 0,
    atJunction: {
      asOrigin: [{ origin: 0, target: 3, pass: 2, id: 2 }],
      asTarget: [{ origin: 2, target: 0, pass: 1, id: 1 }],
    },
    hasItems: true,
    cleared: { jumps: [], breaks: [2], stops: [2], nextJumpId: 3 },
  },
  {
    id: 'JX2',
    req: 'ORG-014, ORG-018',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
    junction: 2,
    atJunction: { asOrigin: [{ origin: 2, target: 0, pass: 1, id: 1 }], asTarget: [] },
    hasItems: true,
    cleared: { jumps: [{ origin: 0, target: 3, pass: 2, id: 2 }], breaks: [], stops: [], nextJumpId: 3 },
  },
  {
    id: 'JX3',
    req: 'ORG-014, ORG-018',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
    junction: 3,
    atJunction: { asOrigin: [], asTarget: [{ origin: 0, target: 3, pass: 2, id: 2 }] },
    hasItems: true,
    cleared: { jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }], breaks: [2], stops: [2], nextJumpId: 3 },
  },
  {
    id: 'JX4',
    req: 'ORG-014, ORG-018',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
    junction: 1,
    atJunction: { asOrigin: [], asTarget: [] },
    hasItems: false,
    cleared: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
  },
];

export const reconcileCases: ReadonlyArray<{ id: string; req: string; name: string; marks: DocMarks; oldCount: number; newCount: number; expected: DocMarks }> = [
  {
    id: 'RC1',
    req: 'DET-015',
    name: 'same count keeps the marks',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
    oldCount: 4,
    newCount: 4,
    expected: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
  },
  {
    id: 'RC2',
    req: 'DET-015',
    name: 'different count clears everything',
    marks: {
      jumps: [{ origin: 2, target: 0, pass: 1, id: 1 }, { origin: 0, target: 3, pass: 2, id: 2 }],
      breaks: [2],
      stops: [2],
      nextJumpId: 3,
    },
    oldCount: 4,
    newCount: 5,
    expected: { jumps: [], breaks: [], stops: [], nextJumpId: 1 },
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
