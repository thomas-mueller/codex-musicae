/**
 * Fixtures: core/mark-change and core/marks removeMark
 * Requirements: ANN-015, ANN-017, MRK-013
 * Expected values were derived by hand from the rules of V2-M07 S2.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import { EMPTY_SYSTEM_MARKS } from '../marks';
import type { JumpMark, MarkKey, PointMark, SystemMarks, SystemRef } from '../marks';
import type { MarkChange, MarkStep } from '../mark-change';

const s = (pageIndex: number, system: number): SystemRef => ({ pageIndex, system });
const marks = (patch: Partial<SystemMarks> = {}): SystemMarks => ({ ...EMPTY_SYSTEM_MARKS, ...patch });
const jump = (id: number, from: SystemRef, to: SystemRef, pass = 1): JumpMark => ({ id, from, to, pass });
const point = (pageIndex: number, system: number, text?: string): PointMark =>
  text === undefined ? { at: s(pageIndex, system) } : { at: s(pageIndex, system), text };

const J1 = jump(1, s(0, 2), s(0, 1));
const J2 = jump(2, s(0, 3), s(0, 1));
const J3 = jump(3, s(1, 2), s(0, 2));
const B1 = { id: 1, at: s(0, 1) };
const B2 = { id: 2, at: s(1, 1), ref: { file: 'Coda.pdf', pageIndex: 0, system: 1 } };

const FULL = marks({
  jumps: [J1, J2, J3],
  bookmarks: [B1, B2],
  stops: [point(0, 1), point(1, 1)],
  breaks: [point(0, 2)],
  start: point(0, 1, 'here'),
  nextJumpId: 4,
  nextBookmarkId: 3,
});

export const removeMarkCases: ReadonlyArray<{ id: string; req: string; name: string; key: MarkKey; expected: SystemMarks | 'same' }> = [
  { id: 'D01', req: 'ANN-015', name: 'a jump by its id', key: { kind: 'jump', id: 2 }, expected: { ...FULL, jumps: [J1, J3] } },
  { id: 'D02', req: 'ANN-015', name: 'a bookmark by its id', key: { kind: 'bookmark', id: 1 }, expected: { ...FULL, bookmarks: [B2] } },
  { id: 'D03', req: 'ANN-015', name: 'the stop of a system', key: { kind: 'stop', at: s(1, 1) }, expected: { ...FULL, stops: [point(0, 1)] } },
  { id: 'D04', req: 'ANN-015', name: 'the slide break of a system', key: { kind: 'break', at: s(0, 2) }, expected: { ...FULL, breaks: [] } },
  { id: 'D05', req: 'ANN-015', name: 'the start mark', key: { kind: 'start' }, expected: { ...FULL, start: null } },
  { id: 'D06', req: 'ANN-015', name: 'an unknown jump id', key: { kind: 'jump', id: 9 }, expected: 'same' },
  { id: 'D07', req: 'ANN-015', name: 'an unknown bookmark id', key: { kind: 'bookmark', id: 9 }, expected: 'same' },
  { id: 'D08', req: 'ANN-015', name: 'a system without a stop', key: { kind: 'stop', at: s(0, 2) }, expected: 'same' },
  { id: 'D09', req: 'ANN-015', name: 'a system without a slide break', key: { kind: 'break', at: s(1, 2) }, expected: 'same' },
];

/** `change` is what markChange(before, after) must give; undo and redo of it must lead back and forth. */
export const markChangeCases: ReadonlyArray<{
  id: string; req: string; name: string; before: SystemMarks; after: SystemMarks; change: MarkChange; pages: number[];
}> = [
  {
    id: 'C01', req: 'ANN-015', name: 'an added jump',
    before: marks(), after: marks({ jumps: [J1], nextJumpId: 2 }),
    change: { removed: [], added: [{ kind: 'jump', mark: J1 }] }, pages: [0],
  },
  {
    id: 'C02', req: 'ANN-015', name: 'a deleted jump returns to its place in creation order',
    before: FULL, after: { ...FULL, jumps: [J1, J3] },
    change: { removed: [{ kind: 'jump', mark: J2 }], added: [] }, pages: [0],
  },
  {
    id: 'C03', req: 'ANN-015', name: 'a retargeted jump is removed and added, and names both pages',
    before: FULL, after: { ...FULL, jumps: [J1, { ...J2, to: s(2, 1) }, J3] },
    change: { removed: [{ kind: 'jump', mark: J2 }], added: [{ kind: 'jump', mark: { ...J2, to: s(2, 1) } }] }, pages: [0, 2],
  },
  {
    id: 'C04', req: 'ANN-015', name: 'a toggled-off stop returns in print order',
    before: FULL, after: { ...FULL, stops: [point(1, 1)] },
    change: { removed: [{ kind: 'stop', mark: point(0, 1) }], added: [] }, pages: [0],
  },
  {
    id: 'C05', req: 'ANN-015', name: 'an added slide break',
    before: FULL, after: { ...FULL, breaks: [point(0, 2), point(1, 1)] },
    change: { removed: [], added: [{ kind: 'break', mark: point(1, 1) }] }, pages: [1],
  },
  {
    id: 'C06', req: 'ANN-015', name: 'a replaced start mark',
    before: FULL, after: { ...FULL, start: point(1, 2) },
    change: { removed: [{ kind: 'start', mark: point(0, 1, 'here') }], added: [{ kind: 'start', mark: point(1, 2) }] }, pages: [0, 1],
  },
  {
    id: 'C07', req: 'ANN-015', name: 'a deleted bookmark returns to its place; a cross-file target names no page',
    before: FULL, after: { ...FULL, bookmarks: [B1] },
    change: { removed: [{ kind: 'bookmark', mark: B2 }], added: [] }, pages: [1],
  },
  {
    id: 'C08', req: 'ANN-017', name: 'a system deletion with renumbering',
    // system 1 of page 0 is deleted: J1 and J2 end there; J3, stop and break behind it move up
    before: FULL,
    after: { ...FULL, jumps: [{ ...J3, to: s(0, 1) }], bookmarks: [B2], stops: [point(1, 1)], breaks: [point(0, 1)], start: null },
    change: {
      removed: [
        { kind: 'jump', mark: J1 }, { kind: 'jump', mark: J2 }, { kind: 'jump', mark: J3 }, { kind: 'bookmark', mark: B1 },
        { kind: 'stop', mark: point(0, 1) }, { kind: 'break', mark: point(0, 2) }, { kind: 'start', mark: point(0, 1, 'here') },
      ],
      added: [{ kind: 'jump', mark: { ...J3, to: s(0, 1) } }, { kind: 'break', mark: point(0, 1) }],
    },
    pages: [0, 1],
  },
];

const step = (name: string, pages: number[], change: Partial<MarkChange>): MarkStep & { name: string } => ({
  name, pages, change: { removed: [], added: [], ...change },
});

const ADD_J1 = step('add jump 1', [0], { added: [{ kind: 'jump', mark: J1 }] });
const RETARGET_J1 = step('retarget jump 1', [0, 2], {
  removed: [{ kind: 'jump', mark: J1 }], added: [{ kind: 'jump', mark: { ...J1, to: s(2, 1) } }],
});
const ADD_STOP = step('add stop on page 1', [1], { added: [{ kind: 'stop', mark: point(1, 1) }] });
const ADD_START = step('set the start on page 0', [0], { added: [{ kind: 'start', mark: point(0, 1) }] });
const MOVE_START = step('move the start to page 2', [0, 2], {
  removed: [{ kind: 'start', mark: point(0, 1) }], added: [{ kind: 'start', mark: point(2, 1) }],
});

export const staleStepCases: ReadonlyArray<{
  id: string; req: string; name: string; steps: Array<MarkStep & { name: string }>; changed: number[]; stale: string[];
}> = [
  { id: 'S01', req: 'ANN-015', name: 'no changed page', steps: [ADD_J1, ADD_STOP], changed: [], stale: [] },
  { id: 'S02', req: 'ANN-015', name: 'only the step on the changed page', steps: [ADD_J1, ADD_STOP], changed: [1], stale: [ADD_STOP.name] },
  {
    id: 'S03', req: 'ANN-015', name: 'an older step on the same jump goes with it',
    steps: [ADD_J1, ADD_STOP, RETARGET_J1], changed: [2], stale: [ADD_J1.name, RETARGET_J1.name],
  },
  {
    id: 'S04', req: 'ANN-015', name: 'the steps on the start mark are chained',
    steps: [ADD_STOP, ADD_START, MOVE_START], changed: [2], stale: [ADD_START.name, MOVE_START.name],
  },
];
