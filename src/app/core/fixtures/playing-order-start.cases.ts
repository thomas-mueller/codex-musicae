/**
 * Fixtures: core/playing-order, derivation from marks on systems and the start mark
 * Requirements: PLY-014..PLY-016, MRK-005
 * Expected values were derived by hand from the contract and checked with docs/reference/core-reference-4.mjs.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import type { JumpMark, SystemMarks, SystemRef } from '../marks';
import type { DerivedOrderInput, PlayingOrder } from '../playing-order';

const s = (pageIndex: number, system: number): SystemRef => ({ pageIndex, system });
/** A system of the only page. */
const p = (system: number): SystemRef => s(0, system);
const marks = (patch: Partial<SystemMarks> = {}): SystemMarks => ({
  jumps: [], bookmarks: [], stops: [], breaks: [], start: null, nextJumpId: 1, nextBookmarkId: 1, ...patch,
});
const J = (id: number, from: SystemRef, to: JumpMark['to'], pass = 1): JumpMark => ({ id, from, to, pass });
const MAX = 20000;

export const deriveInputCases: ReadonlyArray<{
  id: string; req: string; name: string; counts: number[]; marks: SystemMarks; expected: DerivedOrderInput;
}> = [
  {
    id: 'G01', req: 'PLY-014, PLY-016', name: 'right side k is junction k, left side k is junction k-1, across pages', counts: [3, 0, 2],
    marks: marks({
      jumps: [J(1, s(2, 2), s(0, 1)), J(2, s(0, 2), s(2, 2), 2)],
      stops: [{ at: s(0, 3) }, { at: s(2, 1) }],
      breaks: [{ at: s(0, 1) }],
    }),
    expected: {
      systemCount: 5, startJunction: 0, jumps: [{ origin: 5, target: 0, pass: 1 }, { origin: 2, target: 4, pass: 2 }],
      stops: [3, 4], breaks: [1], maxLength: MAX,
    },
  },
  {
    id: 'G02', req: 'PLY-015', name: 'the start mark gives the junction left of its system', counts: [3, 0, 2],
    marks: marks({ start: { at: s(2, 1) } }),
    expected: { systemCount: 5, startJunction: 3, jumps: [], stops: [], breaks: [], maxLength: MAX },
  },
  {
    id: 'G03', req: 'PLY-014, PLY-017', name: 'missing systems are left out; a cross-file jump takes part as an exit', counts: [3, 0, 2],
    marks: marks({
      jumps: [J(1, s(0, 2), { file: 'Coda.pdf', pageIndex: 0, system: 1 }), J(2, s(1, 1), s(0, 1)), J(3, s(2, 1), s(0, 9))],
      stops: [{ at: s(1, 1) }],
      breaks: [{ at: s(3, 1) }],
    }),
    expected: {
      systemCount: 5, startJunction: 0, stops: [], breaks: [], maxLength: MAX,
      jumps: [{ origin: 2, target: 2, pass: 1, exit: { jumpId: 1, to: { file: 'Coda.pdf', pageIndex: 0, system: 1 } } }],
    },
  },
  {
    id: 'G04', req: 'PLY-015', name: 'a start mark on a missing system counts as absent', counts: [3],
    marks: marks({ start: { at: p(4) } }),
    expected: { systemCount: 3, startJunction: 0, jumps: [], stops: [], breaks: [], maxLength: MAX },
  },
  {
    id: 'G05', req: 'MRK-005, PLY-014', name: 'a stop and a break left on the last system have no effect', counts: [3],
    marks: marks({ stops: [{ at: p(3) }], breaks: [{ at: p(3) }] }),
    expected: { systemCount: 3, startJunction: 0, jumps: [], stops: [], breaks: [], maxLength: MAX },
  },
  {
    id: 'G06', req: 'PLY-014', name: 'a jump whose ends became the same junction is left out', counts: [3],
    marks: marks({ jumps: [J(1, p(1), p(2)), J(2, p(2), p(2))], nextJumpId: 3 }),
    expected: { systemCount: 3, startJunction: 0, jumps: [{ origin: 2, target: 1, pass: 1 }], stops: [], breaks: [], maxLength: MAX },
  },
  {
    id: 'G07', req: 'PLY-014', name: 'no pages', counts: [], marks: marks(),
    expected: { systemCount: 0, startJunction: 0, jumps: [], stops: [], breaks: [], maxLength: MAX },
  },
];

/** `forced` = forcedBreaks(order, new Set(derived.breaks)). */
export const startOrderCases: ReadonlyArray<{
  id: string; req: string; name: string; counts: number[]; marks: SystemMarks; maxLength: number; expected: PlayingOrder; forced?: boolean[];
}> = [
  {
    id: 'S01', req: 'PLY-014, PLY-015', name: 'no start mark: the replay starts at junction 0', counts: [4],
    marks: marks({ jumps: [J(1, p(2), p(1))] }), maxLength: MAX,
    expected: { entries: [1, 2, 1, 2, 3, 4], between: [[1], [2, 0], [1], [2], [3]], truncatedByCap: false },
  },
  {
    id: 'S02', req: 'PLY-015', name: 'start mark on the first system equals no start mark', counts: [4],
    marks: marks({ start: { at: p(1) } }), maxLength: MAX,
    expected: { entries: [1, 2, 3, 4], between: [[1], [2], [3]], truncatedByCap: false },
  },
  {
    id: 'S03', req: 'PLY-015', name: 'systems before the start mark are not played', counts: [6],
    marks: marks({ start: { at: p(3) } }), maxLength: MAX,
    expected: { entries: [3, 4, 5, 6], between: [[3], [4], [5]], truncatedByCap: false },
  },
  {
    id: 'S04', req: 'PLY-015', name: 'start mark on the last system', counts: [4],
    marks: marks({ start: { at: p(4) } }), maxLength: MAX,
    expected: { entries: [4], between: [], truncatedByCap: false },
  },
  {
    id: 'S05', req: 'PLY-015, PLY-016', name: 'a D.C. goes back before the start mark and plays those systems', counts: [6],
    marks: marks({ start: { at: p(3) }, jumps: [J(1, p(6), p(1))] }), maxLength: MAX,
    expected: {
      entries: [3, 4, 5, 6, 1, 2, 3, 4, 5, 6],
      between: [[3], [4], [5], [6, 0], [1], [2], [3], [4], [5]],
      truncatedByCap: false,
    },
  },
  {
    id: 'S06', req: 'PLY-015', name: 'a stop right before the start mark cuts at its last arrival, after the D.C.', counts: [6],
    marks: marks({ start: { at: p(3) }, jumps: [J(1, p(6), p(1))], stops: [{ at: p(2) }] }), maxLength: MAX,
    expected: { entries: [3, 4, 5, 6, 1, 2], between: [[3], [4], [5], [6, 0], [1]], truncatedByCap: false },
  },
  {
    id: 'S07', req: 'PLY-015', name: 'a stop right before the start mark that is never visited again gives an empty order', counts: [6],
    marks: marks({ start: { at: p(3) }, stops: [{ at: p(2) }] }), maxLength: MAX,
    expected: { entries: [], between: [], truncatedByCap: false },
  },
  {
    id: 'S08', req: 'PLY-015', name: 'a stop further before the start mark is never reached', counts: [6],
    marks: marks({ start: { at: p(4) }, stops: [{ at: p(2) }] }), maxLength: MAX,
    expected: { entries: [4, 5, 6], between: [[4], [5]], truncatedByCap: false },
  },
  {
    id: 'S09', req: 'PLY-015', name: 'a pass-1 jump right before the start mark fires at once', counts: [6],
    marks: marks({ start: { at: p(3) }, jumps: [J(1, p(2), p(5))] }), maxLength: MAX,
    expected: { entries: [5, 6], between: [[5]], truncatedByCap: false },
  },
  {
    id: 'S10', req: 'PLY-015', name: 'the start is the first arrival: a pass-2 jump there waits', counts: [6],
    marks: marks({ start: { at: p(3) }, jumps: [J(1, p(2), p(1), 2)] }), maxLength: MAX,
    expected: { entries: [3, 4, 5, 6], between: [[3], [4], [5]], truncatedByCap: false },
  },
  {
    id: 'S11', req: 'PLY-015', name: 'the second arrival at the start junction fires the pass-2 jump', counts: [6],
    marks: marks({ start: { at: p(3) }, jumps: [J(1, p(4), p(1)), J(2, p(2), p(6), 2)] }), maxLength: MAX,
    expected: { entries: [3, 4, 1, 2, 6], between: [[3], [4, 0], [1], [2, 5]], truncatedByCap: false },
  },
  {
    id: 'S12', req: 'PLY-015', name: 'a jump back to the start system repeats from the start mark', counts: [4],
    marks: marks({ start: { at: p(3) }, jumps: [J(1, p(4), p(3))] }), maxLength: MAX,
    expected: { entries: [3, 4, 3, 4], between: [[3], [4, 2], [3]], truncatedByCap: false },
  },
  {
    id: 'S13', req: 'PLY-015', name: 'breaks before the first played system have no effect', counts: [6],
    marks: marks({ start: { at: p(3) }, breaks: [{ at: p(1) }, { at: p(2) }, { at: p(4) }] }), maxLength: MAX,
    expected: { entries: [3, 4, 5, 6], between: [[3], [4], [5]], truncatedByCap: false },
    forced: [false, true, false],
  },
  {
    id: 'S14', req: 'PLY-015', name: 'the break right before the start mark acts when it is passed later', counts: [4],
    marks: marks({ start: { at: p(3) }, jumps: [J(1, p(4), p(1))], breaks: [{ at: p(2) }] }), maxLength: MAX,
    expected: { entries: [3, 4, 1, 2, 3, 4], between: [[3], [4, 0], [1], [2], [3]], truncatedByCap: false },
    forced: [false, false, false, true, false],
  },
  {
    id: 'S15', req: 'PLY-015', name: 'a start mark on a missing system: play from the beginning', counts: [3],
    marks: marks({ start: { at: s(5, 1) } }), maxLength: MAX,
    expected: { entries: [1, 2, 3], between: [[1], [2]], truncatedByCap: false },
  },
  {
    id: 'S16', req: 'PLY-015', name: 'the safety cap counts from the start mark', counts: [6],
    marks: marks({ start: { at: p(3) } }), maxLength: 2,
    expected: { entries: [3, 4], between: [[3]], truncatedByCap: true },
  },
  {
    id: 'S17', req: 'PLY-015', name: 'jumps chain from the start junction', counts: [4],
    marks: marks({ start: { at: p(2) }, jumps: [J(1, p(1), p(4)), J(2, p(3), p(2))] }), maxLength: MAX,
    expected: { entries: [2, 3, 4], between: [[2], [3]], truncatedByCap: false },
  },
  {
    id: 'S18', req: 'PLY-014, PLY-015', name: 'start mark behind a page without systems', counts: [2, 0, 3],
    marks: marks({ start: { at: s(2, 2) } }), maxLength: MAX,
    expected: { entries: [4, 5], between: [[4]], truncatedByCap: false },
  },
  {
    id: 'S19', req: 'PLY-006, PLY-014', name: 'equal start system and pass: the earlier jump wins', counts: [4],
    marks: marks({ jumps: [J(1, p(2), p(1)), J(2, p(2), p(4))], nextJumpId: 3 }), maxLength: MAX,
    expected: { entries: [1, 2, 1, 2, 3, 4], between: [[1], [2, 0], [1], [2], [3]], truncatedByCap: false },
  },
];
