/**
 * Fixtures: core/cross-file and the exits of core/playing-order
 * Requirements: FIL-042, FIL-043, MRK-015, MRK-016, PLY-017. Written by hand from the requirement texts and DEC-171.
 */
import type { FileLookup, TargetLayout, TargetState } from '../cross-file';
import type { FileRef } from '../marks';
import type { PlayingOrder, PlayingOrderInput } from '../playing-order';

const file = (id: string, name: string) => ({ id, name });

export const lookupCases: ReadonlyArray<{ id: string; req: string; name: string; open: { id: string; name: string }[]; accessible: { id: string; name: string }[]; expected: FileLookup }> = [
  { id: 'LF1', req: 'FIL-042', name: 'one open file of the name', open: [file('t1', 'B.pdf'), file('t2', 'C.pdf')], accessible: [], expected: { kind: 'open', id: 't1' } },
  { id: 'LF2', req: 'FIL-042', name: 'an open file counts before a stored one', open: [file('t1', 'B.pdf')], accessible: [file('r1', 'B.pdf'), file('r2', 'B.pdf')], expected: { kind: 'open', id: 't1' } },
  { id: 'LF3', req: 'FIL-042', name: 'not open, one with access', open: [], accessible: [file('r1', 'B.pdf')], expected: { kind: 'reopen', id: 'r1' } },
  { id: 'LF4', req: 'FIL-043', name: 'two open files of the name', open: [file('t1', 'B.pdf'), file('t2', 'B.pdf')], accessible: [], expected: { kind: 'several' } },
  { id: 'LF5', req: 'FIL-043', name: 'two stored files of the name', open: [], accessible: [file('r1', 'B.pdf'), file('r2', 'B.pdf')], expected: { kind: 'several' } },
  { id: 'LF6', req: 'FIL-043', name: 'no file of the name; names are compared exactly', open: [file('t1', 'b.pdf')], accessible: [file('r1', 'B (1).pdf')], expected: { kind: 'none' } },
];

const REF: FileRef = { file: 'B.pdf', pageIndex: 1, system: 3 };
const layout = (patch: Partial<TargetLayout> = {}): TargetLayout => ({ pageCount: 3, pageSystemCounts: [4, 3, 2], failed: false, ...patch });

export const targetCases: ReadonlyArray<{ id: string; req: string; name: string; reference: FileRef; matches: TargetLayout[]; expected: TargetState }> = [
  { id: 'TS1', req: 'FIL-042', name: 'the system exists', reference: REF, matches: [layout()], expected: 'resolved' },
  { id: 'TS2', req: 'MRK-015', name: 'the page has fewer systems now', reference: REF, matches: [layout({ pageSystemCounts: [4, 2, 2] })], expected: 'missing-system' },
  { id: 'TS3', req: 'MRK-015', name: 'the file has no such page', reference: { ...REF, pageIndex: 3 }, matches: [layout()], expected: 'missing-system' },
  { id: 'TS4', req: 'MRK-016', name: 'detection has not reached the page', reference: REF, matches: [layout({ pageSystemCounts: [4] })], expected: 'pending' },
  { id: 'TS5', req: 'MRK-016', name: 'the file is still loading', reference: REF, matches: [layout({ pageCount: 0, pageSystemCounts: [] })], expected: 'pending' },
  { id: 'TS6', req: 'FIL-043', name: 'no open file of the name', reference: REF, matches: [], expected: 'missing-file' },
  { id: 'TS7', req: 'FIL-043', name: 'a file that could not be opened', reference: REF, matches: [layout({ failed: true, pageCount: 0 })], expected: 'missing-file' },
  { id: 'TS8', req: 'FIL-043', name: 'two open files of the name', reference: REF, matches: [layout(), layout()], expected: 'ambiguous' },
];

const out = { jumpId: 9, to: REF };
const leave = (origin: number, pass = 1) => ({ origin, target: origin, pass, exit: out });
const base = (patch: Partial<PlayingOrderInput>): PlayingOrderInput => ({ systemCount: 4, jumps: [], stops: [], maxLength: 100, ...patch });

export const exitCases: ReadonlyArray<{ id: string; req: string; name: string; input: PlayingOrderInput; expected: PlayingOrder }> = [
  { id: 'EX1', req: 'PLY-017', name: 'the order ends where the exit fires', input: base({ jumps: [leave(2)] }), expected: { entries: [1, 2], between: [[1]], truncatedByCap: false, exit: out } },
  { id: 'EX2', req: 'PLY-017', name: 'an exit of the second pass fires after a repeat', input: base({ jumps: [{ origin: 3, target: 1, pass: 1 }, leave(2, 2)] }), expected: { entries: [1, 2, 3, 2], between: [[1], [2], [3, 1]], truncatedByCap: false, exit: out } },
  { id: 'EX3', req: 'PLY-017, PLY-006', name: 'the earlier created local jump wins over an exit', input: base({ jumps: [{ origin: 2, target: 0, pass: 1 }, leave(2)] }), expected: { entries: [1, 2, 1, 2, 3, 4], between: [[1], [2, 0], [1], [2], [3]], truncatedByCap: false } },
  { id: 'EX4', req: 'PLY-017, PLY-006', name: 'the earlier created exit wins over a local jump', input: base({ jumps: [leave(2), { origin: 2, target: 0, pass: 1 }] }), expected: { entries: [1, 2], between: [[1]], truncatedByCap: false, exit: out } },
  { id: 'EX5', req: 'PLY-017, PLY-008', name: 'a stop at the arrival of the exit discards it', input: base({ jumps: [leave(2)], stops: [2] }), expected: { entries: [1, 2], between: [[1]], truncatedByCap: false } },
  { id: 'EX6', req: 'PLY-017, PLY-008', name: 'a stop that cuts before the exit discards it', input: base({ jumps: [leave(3)], stops: [1] }), expected: { entries: [1], between: [], truncatedByCap: false } },
  { id: 'EX7', req: 'PLY-017', name: 'an exit that is never reached changes nothing', input: base({ jumps: [leave(2, 2)] }), expected: { entries: [1, 2, 3, 4], between: [[1], [2], [3]], truncatedByCap: false } },
];
