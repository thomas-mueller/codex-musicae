/**
 * Fixtures: core/playing-order
 * Requirements: PLY-002..PLY-013
 * Expected values were computed with an independent reference implementation (docs/reference/core-reference.mjs).
 * Compare floating-point numbers with a tolerance (toBeCloseTo(expected, 9)); everything else exactly.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { Jump } from '../model';
import type { PlayingOrder, PlayingOrderInput } from '../playing-order';

const J = (origin: number, target: number, pass: number): Jump => ({ origin, target, pass });
void J;

export const generatePlayingOrderCases: ReadonlyArray<{
  id: string; req: string; name: string; input: PlayingOrderInput; expected: PlayingOrder;
}> = [
  {
    id: 'O01',
    req: 'PLY-012',
    name: 'no jumps: print order',
    input: { systemCount: 4, jumps: [], stops: [], maxLength: 20000 },
    expected: { entries: [1, 2, 3, 4], between: [[1], [2], [3]], truncatedByCap: false },
  },
  {
    id: 'O02',
    req: 'PLY-002',
    name: 'repeat: after system 2 back to the start, once',
    input: { systemCount: 4, jumps: [{ origin: 2, target: 0, pass: 1 }], stops: [], maxLength: 20000 },
    expected: { entries: [1, 2, 1, 2, 3, 4], between: [[1], [2, 0], [1], [2], [3]], truncatedByCap: false },
  },
  {
    id: 'O03',
    req: 'PLY-002, PLY-003',
    name: 'volta: 1st ending system 3, 2nd ending system 4',
    input: {
      systemCount: 6,
      jumps: [{ origin: 3, target: 0, pass: 1 }, { origin: 2, target: 3, pass: 2 }],
      stops: [],
      maxLength: 20000,
    },
    expected: {
      entries: [1, 2, 3, 1, 2, 4, 5, 6],
      between: [[1], [2], [3, 0], [1], [2, 3], [4], [5]],
      truncatedByCap: false,
    },
  },
  {
    id: 'O04',
    req: 'PLY-002, PLY-004',
    name: 'D.S. al coda: segno at junction 1, jump to the coda only on the 2nd pass at junction 3',
    input: {
      systemCount: 8,
      jumps: [{ origin: 6, target: 1, pass: 1 }, { origin: 3, target: 7, pass: 2 }],
      stops: [],
      maxLength: 20000,
    },
    expected: {
      entries: [1, 2, 3, 4, 5, 6, 2, 3, 8],
      between: [[1], [2], [3], [4], [5], [6, 1], [2], [3, 7]],
      truncatedByCap: false,
    },
  },
  {
    id: 'O05',
    req: 'PLY-002',
    name: 'D.C. after the LAST system (origin N)',
    input: { systemCount: 6, jumps: [{ origin: 6, target: 0, pass: 1 }], stops: [], maxLength: 20000 },
    expected: {
      entries: [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6],
      between: [[1], [2], [3], [4], [5], [6, 0], [1], [2], [3], [4], [5]],
      truncatedByCap: false,
    },
  },
  {
    id: 'O06',
    req: 'PLY-008',
    name: 'D.C. al Fine: the stop cuts at its last arrival',
    input: { systemCount: 6, jumps: [{ origin: 6, target: 0, pass: 1 }], stops: [3], maxLength: 20000 },
    expected: {
      entries: [1, 2, 3, 4, 5, 6, 1, 2, 3],
      between: [[1], [2], [3], [4], [5], [6, 0], [1], [2]],
      truncatedByCap: false,
    },
  },
  {
    id: 'O07',
    req: 'PLY-008',
    name: 'two stops: the cut giving the shortest order wins (order of stops irrelevant)',
    input: { systemCount: 6, jumps: [{ origin: 6, target: 0, pass: 1 }], stops: [5, 3], maxLength: 20000 },
    expected: {
      entries: [1, 2, 3, 4, 5, 6, 1, 2, 3],
      between: [[1], [2], [3], [4], [5], [6, 0], [1], [2]],
      truncatedByCap: false,
    },
  },
  {
    id: 'O08',
    req: 'PLY-008',
    name: 'stop never reached has no effect',
    input: { systemCount: 5, jumps: [{ origin: 0, target: 4, pass: 1 }], stops: [2], maxLength: 20000 },
    expected: { entries: [5], between: [], truncatedByCap: false },
  },
  {
    id: 'O09',
    req: 'PLY-005',
    name: 'cap truncates and sets the flag',
    input: { systemCount: 6, jumps: [], stops: [], maxLength: 4 },
    expected: { entries: [1, 2, 3, 4], between: [[1], [2], [3]], truncatedByCap: true },
  },
  {
    id: 'O10',
    req: 'PLY-006',
    name: 'same origin and pass: the first jump in the array wins',
    input: {
      systemCount: 4,
      jumps: [{ origin: 2, target: 0, pass: 1 }, { origin: 2, target: 4, pass: 1 }],
      stops: [],
      maxLength: 20000,
    },
    expected: { entries: [1, 2, 1, 2, 3, 4], between: [[1], [2, 0], [1], [2], [3]], truncatedByCap: false },
  },
  {
    id: 'O11',
    req: 'PLY-004',
    name: 'chain: a jump arrival triggers the jump at its target at once',
    input: {
      systemCount: 6,
      jumps: [{ origin: 2, target: 4, pass: 1 }, { origin: 4, target: 1, pass: 1 }],
      stops: [],
      maxLength: 20000,
    },
    expected: {
      entries: [1, 2, 2, 3, 4, 5, 6],
      between: [[1], [2, 4, 1], [2], [3], [4], [5]],
      truncatedByCap: false,
    },
  },
  {
    id: 'O12',
    req: 'PLY-003',
    name: 'jump from junction 0 skips the beginning',
    input: { systemCount: 4, jumps: [{ origin: 0, target: 2, pass: 1 }], stops: [], maxLength: 20000 },
    expected: { entries: [3, 4], between: [[3]], truncatedByCap: false },
  },
  {
    id: 'O13',
    req: 'PLY-007',
    name: 'jump to junction N ends the order',
    input: { systemCount: 4, jumps: [{ origin: 2, target: 4, pass: 1 }], stops: [], maxLength: 20000 },
    expected: { entries: [1, 2], between: [[1]], truncatedByCap: false },
  },
  {
    id: 'O14',
    req: 'PLY-003',
    name: 'two passes: repeat twice',
    input: {
      systemCount: 4,
      jumps: [{ origin: 2, target: 0, pass: 1 }, { origin: 2, target: 0, pass: 2 }],
      stops: [],
      maxLength: 20000,
    },
    expected: {
      entries: [1, 2, 1, 2, 1, 2, 3, 4],
      between: [[1], [2, 0], [1], [2, 0], [1], [2], [3]],
      truncatedByCap: false,
    },
  },
  {
    id: 'O15',
    req: 'PLY-008',
    name: 'stop on a junction reached several times uses the last arrival',
    input: {
      systemCount: 4,
      jumps: [{ origin: 2, target: 0, pass: 1 }, { origin: 2, target: 0, pass: 2 }],
      stops: [2],
      maxLength: 20000,
    },
    expected: { entries: [1, 2, 1, 2, 1, 2], between: [[1], [2, 0], [1], [2, 0], [1]], truncatedByCap: false },
  },
  {
    id: 'O16',
    req: 'PLY-002',
    name: 'no systems gives an empty order',
    input: { systemCount: 0, jumps: [], stops: [], maxLength: 20000 },
    expected: { entries: [], between: [], truncatedByCap: false },
  },
  {
    id: 'O17',
    req: 'PLY-004',
    name: 'jump back to 0 arrives at 0 for the 2nd time and a pass-2 jump there fires',
    input: {
      systemCount: 4,
      jumps: [{ origin: 2, target: 0, pass: 1 }, { origin: 0, target: 3, pass: 2 }],
      stops: [],
      maxLength: 20000,
    },
    expected: { entries: [1, 2, 4], between: [[1], [2, 0, 3]], truncatedByCap: false },
  },
  {
    id: 'O18',
    req: 'PLY-008',
    name: 'stop reached before any entry (jump from 0 onto the stop junction) gives an empty order',
    input: { systemCount: 6, jumps: [{ origin: 0, target: 3, pass: 1 }], stops: [3], maxLength: 20000 },
    expected: { entries: [], between: [], truncatedByCap: false },
  },
  {
    id: 'O19',
    req: 'PLY-002',
    name: 'a jump from junction N with pass 2 never fires when N is reached only once',
    input: { systemCount: 4, jumps: [{ origin: 4, target: 0, pass: 2 }], stops: [], maxLength: 20000 },
    expected: { entries: [1, 2, 3, 4], between: [[1], [2], [3]], truncatedByCap: false },
  },
  {
    id: 'O20',
    req: 'PLY-004',
    name: 'jump to N, then a pass-2 jump from N does not fire (N reached once)',
    input: {
      systemCount: 4,
      jumps: [{ origin: 2, target: 4, pass: 1 }, { origin: 4, target: 1, pass: 2 }],
      stops: [],
      maxLength: 20000,
    },
    expected: { entries: [1, 2], between: [[1]], truncatedByCap: false },
  },
  {
    id: 'O21',
    req: 'PLY-002',
    name: 'jump to N, then a pass-1 jump from N fires (arrival at N counts)',
    input: {
      systemCount: 4,
      jumps: [{ origin: 2, target: 4, pass: 1 }, { origin: 4, target: 3, pass: 1 }],
      stops: [],
      maxLength: 20000,
    },
    expected: { entries: [1, 2, 4], between: [[1], [2, 4, 3]], truncatedByCap: false },
  },
];

export const systemNumbersCases: ReadonlyArray<{
  id: string; req: string; name: string; input: PlayingOrderInput; expected: number[][];
}> = [
  {
    id: 'N1',
    req: 'PLY-010',
    name: 'repeat',
    input: { systemCount: 4, jumps: [{ origin: 2, target: 0, pass: 1 }], stops: [], maxLength: 20000 },
    expected: [[1, 3], [2, 4], [5], [6]],
  },
  {
    id: 'N2',
    req: 'PLY-010',
    name: 'D.S. al coda: a never-played system has an empty list',
    input: {
      systemCount: 8,
      jumps: [{ origin: 6, target: 1, pass: 1 }, { origin: 3, target: 7, pass: 2 }],
      stops: [],
      maxLength: 20000,
    },
    expected: [[1], [2, 7], [3, 8], [4], [5], [6], [], [9]],
  },
  {
    id: 'N3',
    req: 'PLY-010',
    name: 'skipped beginning',
    input: { systemCount: 4, jumps: [{ origin: 0, target: 2, pass: 1 }], stops: [], maxLength: 20000 },
    expected: [[], [], [1], [2]],
  },
  {
    id: 'N4',
    req: 'PLY-010',
    name: 'D.C. at the end',
    input: { systemCount: 6, jumps: [{ origin: 6, target: 0, pass: 1 }], stops: [], maxLength: 20000 },
    expected: [[1, 7], [2, 8], [3, 9], [4, 10], [5, 11], [6, 12]],
  },
];

/** forcedBreaks(generatePlayingOrder(input), new Set(breaks)) */
export const forcedBreaksCases: ReadonlyArray<{
  id: string; req: string; name: string; input: PlayingOrderInput; breaks: number[]; expected: boolean[];
}> = [
  {
    id: 'K01',
    req: 'PLY-011',
    name: 'chain, break at the intermediate junction 4',
    input: {
      systemCount: 6,
      jumps: [{ origin: 2, target: 4, pass: 1 }, { origin: 4, target: 1, pass: 1 }],
      stops: [],
      maxLength: 20000,
    },
    breaks: [4],
    expected: [false, true, false, false, true, false],
  },
  {
    id: 'K02',
    req: 'PLY-011',
    name: 'chain, break at the jump origin 2 (affects both visits of 2)',
    input: {
      systemCount: 6,
      jumps: [{ origin: 2, target: 4, pass: 1 }, { origin: 4, target: 1, pass: 1 }],
      stops: [],
      maxLength: 20000,
    },
    breaks: [2],
    expected: [false, true, true, false, false, false],
  },
  {
    id: 'K03',
    req: 'PLY-011',
    name: 'chain, break at the final target 1 (also the straight crossing of 1)',
    input: {
      systemCount: 6,
      jumps: [{ origin: 2, target: 4, pass: 1 }, { origin: 4, target: 1, pass: 1 }],
      stops: [],
      maxLength: 20000,
    },
    breaks: [1],
    expected: [true, true, false, false, false, false],
  },
  {
    id: 'K04',
    req: 'PLY-011',
    name: 'chain, break at 3 (straight crossing only)',
    input: {
      systemCount: 6,
      jumps: [{ origin: 2, target: 4, pass: 1 }, { origin: 4, target: 1, pass: 1 }],
      stops: [],
      maxLength: 20000,
    },
    breaks: [3],
    expected: [false, false, false, true, false, false],
  },
  {
    id: 'K05',
    req: 'PLY-011',
    name: 'plain order, break at 5',
    input: { systemCount: 6, jumps: [], stops: [], maxLength: 20000 },
    breaks: [5],
    expected: [false, false, false, false, true],
  },
  {
    id: 'K06',
    req: 'PLY-011',
    name: 'repeat, break at the origin 2: both crossings',
    input: { systemCount: 4, jumps: [{ origin: 2, target: 0, pass: 1 }], stops: [], maxLength: 20000 },
    breaks: [2],
    expected: [false, true, false, true, false],
  },
  {
    id: 'K07',
    req: 'PLY-011',
    name: 'repeat, break at 1: straight crossing and the arrival after the jump',
    input: { systemCount: 4, jumps: [{ origin: 2, target: 0, pass: 1 }], stops: [], maxLength: 20000 },
    breaks: [1],
    expected: [true, false, true, false, false],
  },
  {
    id: 'K08',
    req: 'PLY-011',
    name: 'D.C. at the end, break at 3: both passes',
    input: { systemCount: 6, jumps: [{ origin: 6, target: 0, pass: 1 }], stops: [], maxLength: 20000 },
    breaks: [3],
    expected: [false, false, true, false, false, false, false, false, true, false, false],
  },
  {
    id: 'K09',
    req: 'PLY-011',
    name: 'no breaks',
    input: { systemCount: 4, jumps: [{ origin: 2, target: 0, pass: 1 }], stops: [], maxLength: 20000 },
    breaks: [],
    expected: [false, false, false, false, false],
  },
];

export const isValidJumpCases: ReadonlyArray<{ id: string; req: string; jump: Jump; systemCount: number; expected: boolean }> = [
  {
    id: 'V01',
    req: 'PLY-007',
    jump: { origin: 0, target: 2, pass: 1 },
    systemCount: 4,
    expected: true,
  },
  {
    id: 'V02',
    req: 'PLY-007',
    jump: { origin: 4, target: 0, pass: 1 },
    systemCount: 4,
    expected: true,
  },
  {
    id: 'V03',
    req: 'PLY-007',
    jump: { origin: 2, target: 4, pass: 3 },
    systemCount: 4,
    expected: true,
  },
  {
    id: 'V04',
    req: 'PLY-007',
    jump: { origin: 4, target: 4, pass: 1 },
    systemCount: 4,
    expected: false,
  },
  {
    id: 'V05',
    req: 'PLY-007',
    jump: { origin: 5, target: 0, pass: 1 },
    systemCount: 4,
    expected: false,
  },
  {
    id: 'V06',
    req: 'PLY-007',
    jump: { origin: 2, target: 5, pass: 1 },
    systemCount: 4,
    expected: false,
  },
  {
    id: 'V07',
    req: 'PLY-007',
    jump: { origin: -1, target: 2, pass: 1 },
    systemCount: 4,
    expected: false,
  },
  {
    id: 'V08',
    req: 'PLY-007',
    jump: { origin: 2, target: -1, pass: 1 },
    systemCount: 4,
    expected: false,
  },
  {
    id: 'V09',
    req: 'PLY-007',
    jump: { origin: 2, target: 3, pass: 0 },
    systemCount: 4,
    expected: false,
  },
  {
    id: 'V10',
    req: 'PLY-007',
    jump: { origin: 2, target: 3, pass: 1.5 },
    systemCount: 4,
    expected: false,
  },
  {
    id: 'V11',
    req: 'PLY-007',
    jump: { origin: 0, target: 0, pass: 1 },
    systemCount: 4,
    expected: false,
  },
  {
    id: 'V12',
    req: 'PLY-007',
    jump: { origin: 1, target: 0, pass: 1 },
    systemCount: 0,
    expected: false,
  },
];

export const isValidMarkJunctionCases: ReadonlyArray<{ id: string; req: string; junction: number; systemCount: number; expected: boolean }> = [
  { id: 'VM1', req: 'PLY-009, PLY-013', junction: 1, systemCount: 4, expected: true },
  { id: 'VM2', req: 'PLY-009, PLY-013', junction: 3, systemCount: 4, expected: true },
  { id: 'VM3', req: 'PLY-009, PLY-013', junction: 0, systemCount: 4, expected: false },
  { id: 'VM4', req: 'PLY-009, PLY-013', junction: 4, systemCount: 4, expected: false },
  { id: 'VM5', req: 'PLY-009, PLY-013', junction: 2, systemCount: 1, expected: false },
  { id: 'VM6', req: 'PLY-009, PLY-013', junction: 2.5, systemCount: 4, expected: false },
  { id: 'VM7', req: 'PLY-009, PLY-013', junction: -1, systemCount: 4, expected: false },
  { id: 'VM8', req: 'PLY-009, PLY-013', junction: 1, systemCount: 2, expected: true },
];
