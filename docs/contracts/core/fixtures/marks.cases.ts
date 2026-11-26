/**
 * Fixtures: core/marks
 * Requirements: MRK-001..MRK-008, MRK-012..MRK-015, PLY-016
 * Expected values were derived by hand from the contract and checked with docs/reference/core-reference-4.mjs.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 */
import { EMPTY_SYSTEM_MARKS } from '../marks';
import type { BookmarkMark, FileRef, NewMark, PointMark, SystemMarks, SystemRef } from '../marks';

const s = (pageIndex: number, system: number): SystemRef => ({ pageIndex, system });
const f = (file: string, pageIndex: number, system: number): FileRef => ({ file, pageIndex, system });
const marks = (patch: Partial<SystemMarks> = {}): SystemMarks => ({ ...EMPTY_SYSTEM_MARKS, ...patch });

const FIRST_BOOKMARK: BookmarkMark = { id: 1, at: s(0, 2) };
const TURN: PointMark = { at: s(0, 1), text: 'turn' };

/** Systems in print order: p0s1 p0s2 p0s3 p2s1 p2s2; page 1 has none. p2s2 is the last system. */
const L = [3, 0, 2];

export const addMarkCases: ReadonlyArray<{
  id: string; req: string; name: string; counts: number[]; marks: SystemMarks; mark: NewMark; expected: SystemMarks | null;
}> = [
  {
    id: 'A01', req: 'MRK-001', name: 'first jump is stored with id 1', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 2), to: s(0, 1), pass: 1 },
    expected: marks({ jumps: [{ id: 1, from: s(0, 2), to: s(0, 1), pass: 1 }], nextJumpId: 2 }),
  },
  {
    id: 'A02', req: 'MRK-002', name: 'a second jump with the same start and pass is appended', counts: L,
    marks: marks({ jumps: [{ id: 1, from: s(0, 2), to: s(0, 1), pass: 1 }], nextJumpId: 2 }),
    mark: { kind: 'jump', from: s(0, 2), to: s(2, 2), pass: 1 },
    expected: marks({
      jumps: [{ id: 1, from: s(0, 2), to: s(0, 1), pass: 1 }, { id: 2, from: s(0, 2), to: s(2, 2), pass: 1 }],
      nextJumpId: 3,
    }),
  },
  {
    id: 'A03', req: 'MRK-001', name: 'ids are never reused: the next jump id is taken', counts: L, marks: marks({ nextJumpId: 5 }),
    mark: { kind: 'jump', from: s(2, 1), to: s(0, 2), pass: 2 },
    expected: marks({ jumps: [{ id: 5, from: s(2, 1), to: s(0, 2), pass: 2 }], nextJumpId: 6 }),
  },
  {
    id: 'A04', req: 'PLY-016', name: 'D.C.: from the right side of the last system to the left side of the first', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(2, 2), to: s(0, 1), pass: 1 },
    expected: marks({ jumps: [{ id: 1, from: s(2, 2), to: s(0, 1), pass: 1 }], nextJumpId: 2 }),
  },
  {
    id: 'A05', req: 'MRK-002', name: 'a jump may target its own start system (that system is repeated)', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 2), to: s(0, 2), pass: 1 },
    expected: marks({ jumps: [{ id: 1, from: s(0, 2), to: s(0, 2), pass: 1 }], nextJumpId: 2 }),
  },
  {
    id: 'A06', req: 'MRK-001', name: 'a target directly after the start system is the same place: rejected', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 1), to: s(0, 2), pass: 1 }, expected: null,
  },
  {
    id: 'A07', req: 'MRK-001', name: 'directly after, across a page without systems: rejected', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 3), to: s(2, 1), pass: 1 }, expected: null,
  },
  {
    id: 'A08', req: 'MRK-002', name: 'from the first system to the last', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 1), to: s(2, 2), pass: 1 },
    expected: marks({ jumps: [{ id: 1, from: s(0, 1), to: s(2, 2), pass: 1 }], nextJumpId: 2 }),
  },
  {
    id: 'A09', req: 'MRK-008', name: 'pass 0 is rejected', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 2), to: s(0, 1), pass: 0 }, expected: null,
  },
  {
    id: 'A10', req: 'MRK-008', name: 'a fractional pass is rejected', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 2), to: s(0, 1), pass: 1.5 }, expected: null,
  },
  {
    id: 'A11', req: 'MRK-001', name: 'a start on a page without systems is rejected', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(1, 1), to: s(0, 1), pass: 1 }, expected: null,
  },
  {
    id: 'A12', req: 'MRK-001', name: 'a target beyond the systems of its page is rejected', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 2), to: s(0, 4), pass: 1 }, expected: null,
  },
  {
    id: 'A13', req: 'MRK-001', name: 'system 0 does not exist', counts: L, marks: marks(),
    mark: { kind: 'bookmark', at: s(0, 0) }, expected: null,
  },
  {
    id: 'A14', req: 'MRK-012', name: 'a cross-file target is not checked against this layout', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 2), to: f('Coda.pdf', 9, 4), pass: 1 },
    expected: marks({ jumps: [{ id: 1, from: s(0, 2), to: f('Coda.pdf', 9, 4), pass: 1 }], nextJumpId: 2 }),
  },
  {
    id: 'A15', req: 'MRK-012', name: 'a cross-file target is never "directly after" the start', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 1), to: f('Coda.pdf', 0, 2), pass: 1 },
    expected: marks({ jumps: [{ id: 1, from: s(0, 1), to: f('Coda.pdf', 0, 2), pass: 1 }], nextJumpId: 2 }),
  },
  {
    id: 'A16', req: 'MRK-012', name: 'an empty file name is rejected', counts: L, marks: marks(),
    mark: { kind: 'jump', from: s(0, 2), to: f('', 0, 1), pass: 1 }, expected: null,
  },
  {
    id: 'A17', req: 'MRK-012', name: 'a negative page in a cross-file reference is rejected', counts: L, marks: marks(),
    mark: { kind: 'bookmark', at: s(0, 1), ref: f('Coda.pdf', -1, 1) }, expected: null,
  },
  {
    id: 'A18', req: 'MRK-007', name: 'a second bookmark on a system; bookmark ids count on their own', counts: L,
    marks: marks({ bookmarks: [FIRST_BOOKMARK], nextJumpId: 7, nextBookmarkId: 2 }),
    mark: { kind: 'bookmark', at: s(0, 2), text: 'solo' },
    expected: marks({
      bookmarks: [{ id: 1, at: s(0, 2) }, { id: 2, at: s(0, 2), text: 'solo' }], nextJumpId: 7, nextBookmarkId: 3,
    }),
  },
  {
    id: 'A19', req: 'MRK-012', name: 'a bookmark with a cross-file target and a user text', counts: L, marks: marks(),
    mark: { kind: 'bookmark', at: s(2, 1), ref: f('Parts.pdf', 2, 3), text: 'cue' },
    expected: marks({ bookmarks: [{ id: 1, at: s(2, 1), ref: f('Parts.pdf', 2, 3), text: 'cue' }], nextBookmarkId: 2 }),
  },
  {
    id: 'A20', req: 'MRK-007', name: 'an empty user text is not stored', counts: L, marks: marks(),
    mark: { kind: 'bookmark', at: s(0, 1), text: '' },
    expected: marks({ bookmarks: [{ id: 1, at: s(0, 1) }], nextBookmarkId: 2 }),
  },
  {
    id: 'A21', req: 'MRK-006', name: 'start mark on the first system', counts: L, marks: marks(),
    mark: { kind: 'start', at: s(0, 1) }, expected: marks({ start: { at: s(0, 1) } }),
  },
  {
    id: 'A22', req: 'MRK-006', name: 'a new start mark replaces the previous one', counts: L,
    marks: marks({ start: { at: s(0, 2), text: 'old' } }),
    mark: { kind: 'start', at: s(2, 1) }, expected: marks({ start: { at: s(2, 1) } }),
  },
  {
    id: 'A23', req: 'MRK-006', name: 'setting the start again on its system replaces it and does not toggle', counts: L,
    marks: marks({ start: { at: s(0, 2), text: 'A' } }),
    mark: { kind: 'start', at: s(0, 2) }, expected: marks({ start: { at: s(0, 2) } }),
  },
  {
    id: 'A24', req: 'MRK-006', name: 'the start mark may sit on the last system', counts: L, marks: marks(),
    mark: { kind: 'start', at: s(2, 2) }, expected: marks({ start: { at: s(2, 2) } }),
  },
  {
    id: 'A25', req: 'MRK-003', name: 'stops stay in print order', counts: L, marks: marks({ stops: [{ at: s(2, 1) }] }),
    mark: { kind: 'stop', at: s(0, 2) }, expected: marks({ stops: [{ at: s(0, 2) }, { at: s(2, 1) }] }),
  },
  {
    id: 'A26', req: 'MRK-003, MRK-004', name: 'a stop where one exists removes it', counts: L,
    marks: marks({ stops: [{ at: s(0, 2) }, { at: s(2, 1) }] }),
    mark: { kind: 'stop', at: s(0, 2) }, expected: marks({ stops: [{ at: s(2, 1) }] }),
  },
  {
    id: 'A27', req: 'MRK-005', name: 'no stop on the last system', counts: L, marks: marks(),
    mark: { kind: 'stop', at: s(2, 2) }, expected: null,
  },
  {
    id: 'A28', req: 'MRK-005', name: 'no slide break on the last system', counts: L, marks: marks(),
    mark: { kind: 'break', at: s(2, 2) }, expected: null,
  },
  {
    id: 'A29', req: 'MRK-005', name: 'the last system of an earlier page is not the last system of the file', counts: L, marks: marks(),
    mark: { kind: 'break', at: s(0, 3) }, expected: marks({ breaks: [{ at: s(0, 3) }] }),
  },
  {
    id: 'A30', req: 'MRK-003', name: 'a break where one exists removes it, whatever the new text is', counts: L,
    marks: marks({ breaks: [TURN] }),
    mark: { kind: 'break', at: s(0, 1), text: 'other' }, expected: marks(),
  },
  {
    id: 'A31', req: 'MRK-003, MRK-005', name: 'a stop left on the last system can still be removed', counts: L,
    marks: marks({ stops: [{ at: s(2, 2) }] }),
    mark: { kind: 'stop', at: s(2, 2) }, expected: marks(),
  },
  {
    id: 'A32', req: 'MRK-004', name: 'a stop and a break may share a system', counts: L, marks: marks({ stops: [{ at: s(0, 2) }] }),
    mark: { kind: 'break', at: s(0, 2), text: 'page' },
    expected: marks({ stops: [{ at: s(0, 2) }], breaks: [{ at: s(0, 2), text: 'page' }] }),
  },
  {
    id: 'A33', req: 'MRK-005', name: 'one system: it is the last one, no stop', counts: [1], marks: marks(),
    mark: { kind: 'stop', at: s(0, 1) }, expected: null,
  },
  {
    id: 'A34', req: 'MRK-005', name: 'trailing pages without systems do not move the last system', counts: [2, 0], marks: marks(),
    mark: { kind: 'break', at: s(0, 2) }, expected: null,
  },
  {
    id: 'A35', req: 'PLY-016', name: 'one system: D.C. from its right side to its left side', counts: [1], marks: marks(),
    mark: { kind: 'jump', from: s(0, 1), to: s(0, 1), pass: 1 },
    expected: marks({ jumps: [{ id: 1, from: s(0, 1), to: s(0, 1), pass: 1 }], nextJumpId: 2 }),
  },
];

const THREE_JUMPS = marks({
  jumps: [
    { id: 1, from: s(0, 2), to: s(0, 1), pass: 1 },
    { id: 2, from: s(0, 2), to: f('Coda.pdf', 0, 1), pass: 1 },
    { id: 3, from: s(1, 2), to: s(0, 1), pass: 1 },
  ],
  nextJumpId: 4,
});

export const defaultPassCases: ReadonlyArray<{ id: string; req: string; name: string; marks: SystemMarks; from: SystemRef; expected: number }> = [
  { id: 'P01', req: 'MRK-008', name: 'first jump of a system', marks: marks(), from: s(0, 2), expected: 1 },
  { id: 'P02', req: 'MRK-008', name: 'two jumps from the start, one of them cross-file', marks: THREE_JUMPS, from: s(0, 2), expected: 3 },
  { id: 'P03', req: 'MRK-008', name: 'another system of the page does not count', marks: THREE_JUMPS, from: s(0, 1), expected: 1 },
  { id: 'P04', req: 'MRK-008', name: 'the same number on another page counts alone', marks: THREE_JUMPS, from: s(1, 2), expected: 2 },
];

export const removeSystemCases: ReadonlyArray<{
  id: string; req: string; name: string; marks: SystemMarks; deleted: SystemRef; expected: SystemMarks;
}> = [
  {
    id: 'R01', req: 'MRK-013', name: 'every mark of both sides is removed', deleted: s(0, 2),
    marks: marks({
      start: { at: s(0, 2) }, stops: [{ at: s(0, 2) }], breaks: [{ at: s(0, 2) }], bookmarks: [{ id: 1, at: s(0, 2) }], nextBookmarkId: 2,
    }),
    expected: marks({ nextBookmarkId: 2 }),
  },
  {
    id: 'R02', req: 'MRK-013', name: 'neighbors stay; later systems of the page move up, other pages do not', deleted: s(0, 2),
    marks: marks({ stops: [{ at: s(0, 1) }, { at: s(0, 3), text: 'fine' }, { at: s(1, 3) }] }),
    expected: marks({ stops: [{ at: s(0, 1) }, { at: s(0, 2), text: 'fine' }, { at: s(1, 3) }] }),
  },
  {
    id: 'R03', req: 'MRK-013', name: 'a jump that starts on the system goes with it; ids are not reused', deleted: s(0, 4),
    marks: marks({ jumps: [{ id: 1, from: s(0, 4), to: s(0, 1), pass: 1 }, { id: 2, from: s(1, 1), to: s(0, 1), pass: 1 }], nextJumpId: 3 }),
    expected: marks({ jumps: [{ id: 2, from: s(1, 1), to: s(0, 1), pass: 1 }], nextJumpId: 3 }),
  },
  {
    id: 'R04', req: 'MRK-013', name: 'a jump that targets the system goes with it', deleted: s(0, 1),
    marks: marks({ jumps: [{ id: 1, from: s(1, 2), to: s(0, 1), pass: 1 }], nextJumpId: 2 }),
    expected: marks({ nextJumpId: 2 }),
  },
  {
    id: 'R05', req: 'MRK-013', name: 'both ends of a jump are renumbered', deleted: s(0, 1),
    marks: marks({ jumps: [{ id: 1, from: s(0, 4), to: s(0, 3), pass: 2, text: 'x' }], nextJumpId: 2 }),
    expected: marks({ jumps: [{ id: 1, from: s(0, 3), to: s(0, 2), pass: 2, text: 'x' }], nextJumpId: 2 }),
  },
  {
    id: 'R06', req: 'MRK-013', name: 'a jump across pages: only the end on the edited page moves', deleted: s(0, 2),
    marks: marks({ jumps: [{ id: 1, from: s(1, 3), to: s(0, 4), pass: 1 }], nextJumpId: 2 }),
    expected: marks({ jumps: [{ id: 1, from: s(1, 3), to: s(0, 3), pass: 1 }], nextJumpId: 2 }),
  },
  {
    id: 'R07', req: 'MRK-015', name: 'a cross-file target is not renumbered', deleted: s(0, 1),
    marks: marks({ jumps: [{ id: 1, from: s(0, 3), to: f('Coda.pdf', 0, 3), pass: 1 }], nextJumpId: 2 }),
    expected: marks({ jumps: [{ id: 1, from: s(0, 2), to: f('Coda.pdf', 0, 3), pass: 1 }], nextJumpId: 2 }),
  },
  {
    id: 'R08', req: 'MRK-015', name: 'a cross-file target with the numbers of the deleted system is kept', deleted: s(0, 2),
    marks: marks({ jumps: [{ id: 1, from: s(0, 1), to: f('Coda.pdf', 0, 2), pass: 1 }], nextJumpId: 2 }),
    expected: marks({ jumps: [{ id: 1, from: s(0, 1), to: f('Coda.pdf', 0, 2), pass: 1 }], nextJumpId: 2 }),
  },
  {
    id: 'R09', req: 'MRK-013, MRK-015', name: 'bookmarks go and move by their own system only', deleted: s(0, 2),
    marks: marks({
      bookmarks: [{ id: 1, at: s(0, 2), ref: f('Coda.pdf', 5, 1) }, { id: 2, at: s(0, 3), ref: f('Coda.pdf', 0, 2) }],
      nextBookmarkId: 3,
    }),
    expected: marks({ bookmarks: [{ id: 2, at: s(0, 2), ref: f('Coda.pdf', 0, 2) }], nextBookmarkId: 3 }),
  },
  {
    id: 'R10', req: 'MRK-013', name: 'the start mark and breaks move up', deleted: s(0, 1),
    marks: marks({ start: { at: s(0, 3) }, breaks: [{ at: s(0, 2) }] }),
    expected: marks({ start: { at: s(0, 2) }, breaks: [{ at: s(0, 1) }] }),
  },
  {
    id: 'R11', req: 'MRK-013', name: 'a stop whose system becomes the last one stays stored', deleted: s(0, 2),
    marks: marks({ stops: [{ at: s(0, 1) }] }),
    expected: marks({ stops: [{ at: s(0, 1) }] }),
  },
  {
    id: 'R12', req: 'MRK-013', name: 'marks before the system and on other pages are unchanged', deleted: s(1, 2),
    marks: marks({ stops: [{ at: s(0, 3) }], breaks: [{ at: s(1, 1) }, { at: s(2, 3) }] }),
    expected: marks({ stops: [{ at: s(0, 3) }], breaks: [{ at: s(1, 1) }, { at: s(2, 3) }] }),
  },
  {
    id: 'R13', req: 'MRK-013', name: 'the second of two equal numbers: only the edited page is touched', deleted: s(1, 1),
    marks: marks({ start: { at: s(2, 1) }, stops: [{ at: s(0, 1) }, { at: s(1, 1) }, { at: s(1, 2) }] }),
    expected: marks({ start: { at: s(2, 1) }, stops: [{ at: s(0, 1) }, { at: s(1, 1) }] }),
  },
];

/** One mark of each kind on page 1, plus marks on page 0. */
const TWO_PAGES = marks({
  start: { at: s(1, 1) },
  stops: [{ at: s(0, 1) }, { at: s(1, 2) }],
  breaks: [{ at: s(1, 3) }],
  bookmarks: [{ id: 1, at: s(0, 2) }, { id: 2, at: s(1, 1) }],
  jumps: [{ id: 1, from: s(0, 3), to: s(0, 1), pass: 1 }, { id: 2, from: s(1, 3), to: s(1, 1), pass: 1 }],
  nextJumpId: 3,
  nextBookmarkId: 3,
});
const PAGE_ONE_CLEARED = marks({
  stops: [{ at: s(0, 1) }],
  bookmarks: [{ id: 1, at: s(0, 2) }],
  jumps: [{ id: 1, from: s(0, 3), to: s(0, 1), pass: 1 }],
  nextJumpId: 3,
  nextBookmarkId: 3,
});
const INTO_PAGE_ONE = marks({ jumps: [{ id: 1, from: s(0, 2), to: s(1, 1), pass: 1 }], nextJumpId: 2 });
const OUT_OF_PAGE_ONE = marks({ jumps: [{ id: 1, from: s(1, 2), to: s(0, 1), pass: 1 }], nextJumpId: 2 });
const CROSS_FILE_SAME_PAGE = marks({
  jumps: [{ id: 1, from: s(0, 2), to: f('Coda.pdf', 1, 1), pass: 1 }],
  bookmarks: [{ id: 1, at: s(0, 1), ref: f('Coda.pdf', 1, 2) }],
  nextJumpId: 2,
  nextBookmarkId: 2,
});

export const rerunPageCases: ReadonlyArray<{
  id: string; req: string; name: string; marks: SystemMarks; pageIndex: number; oldCount: number; newCount: number; expected: SystemMarks;
}> = [
  { id: 'U01', req: 'MRK-014', name: 'same count: every mark stays', marks: TWO_PAGES, pageIndex: 1, oldCount: 3, newCount: 3, expected: TWO_PAGES },
  { id: 'U02', req: 'MRK-014', name: 'one system more: the marks of the page go', marks: TWO_PAGES, pageIndex: 1, oldCount: 3, newCount: 4, expected: PAGE_ONE_CLEARED },
  { id: 'U03', req: 'MRK-014', name: 'one system less', marks: TWO_PAGES, pageIndex: 1, oldCount: 3, newCount: 2, expected: PAGE_ONE_CLEARED },
  { id: 'U04', req: 'MRK-014', name: 'no system left on the page', marks: TWO_PAGES, pageIndex: 1, oldCount: 3, newCount: 0, expected: PAGE_ONE_CLEARED },
  { id: 'U05', req: 'MRK-014', name: 'a jump into the page goes', marks: INTO_PAGE_ONE, pageIndex: 1, oldCount: 2, newCount: 3, expected: marks({ nextJumpId: 2 }) },
  { id: 'U06', req: 'MRK-014', name: 'a jump out of the page goes', marks: OUT_OF_PAGE_ONE, pageIndex: 1, oldCount: 2, newCount: 3, expected: marks({ nextJumpId: 2 }) },
  { id: 'U07', req: 'MRK-014, MRK-015', name: 'references to the same page number of another file stay', marks: CROSS_FILE_SAME_PAGE, pageIndex: 1, oldCount: 2, newCount: 5, expected: CROSS_FILE_SAME_PAGE },
  { id: 'U08', req: 'MRK-014', name: 'a page that had no systems has no marks to lose', marks: INTO_PAGE_ONE, pageIndex: 2, oldCount: 0, newCount: 3, expected: INTO_PAGE_ONE },
];
