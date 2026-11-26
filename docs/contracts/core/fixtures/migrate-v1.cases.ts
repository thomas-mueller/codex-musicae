/**
 * Fixtures: core/migrate-v1
 * Requirements: SAV-016, SAV-003
 * Hand-written V1 marks on the page and system counts of reviewed corpus files (e2e/corpus/expected.json) and on small edge
 * layouts. Expected values were derived by hand from the contract and checked with docs/reference/core-reference-4.mjs.
 * Do not edit expected values without recording the reason in docs/changelog.md.
 *
 * `samePlayingOrder`: whether the migrated file has the V1 playing order and V1 forced slide breaks (the V1 order is that of
 * the valid V1 items).
 */
import type { SystemMarks, SystemRef } from '../marks';
import type { V1Marks } from '../migrate-v1';

const s = (pageIndex: number, system: number): SystemRef => ({ pageIndex, system });
const marks = (patch: Partial<SystemMarks> = {}): SystemMarks => ({
  jumps: [], bookmarks: [], stops: [], breaks: [], start: null, nextJumpId: 1, nextBookmarkId: 1, ...patch,
});
const J = (id: number, origin: number, target: number, pass = 1) => ({ id, origin, target, pass });
/** V1 marks; nextJumpId defaults to the highest jump id plus one. */
const v1 = (patch: Partial<V1Marks> = {}): V1Marks => {
  const jumps = patch.jumps ?? [];
  return { breaks: [], stops: [], nextJumpId: Math.max(0, ...jumps.map((j) => j.id)) + 1, ...patch, jumps };
};

/** IMSLP799145 (tiff2pdf): 19 systems; page 1 has none. */
const TIFF = [1, 0, 6, 6, 6];
/** IMSLP01777, Mozart, Eine kleine Nachtmusik, violin I: 71 systems. */
const NACHTMUSIK = [10, 13, 12, 12, 12, 12];
/** IMSLP914565, Mozart, serenade K.525: 76 systems; pages 0 and 1 have none. */
const SERENADE = [0, 0, ...Array.from({ length: 19 }, () => 4)];
/** IMSLP19899, Beethoven, symphony 5, violin I: 154 systems. */
const BEETHOVEN = [11, 13, 13, 13, 13, 13, 14, 14, 13, 12, 12, 13];

export const migrateCases: ReadonlyArray<{
  id: string; req: string; name: string; counts: number[]; v1: V1Marks; expected: SystemMarks; samePlayingOrder: boolean;
}> = [
  { id: 'M01', req: 'SAV-016, SAV-003', name: 'a file without marks', counts: TIFF, v1: v1(), expected: marks(), samePlayingOrder: true },
  {
    id: 'M02', req: 'SAV-016', name: 'repeat of the first page: target gap 0 is the left of the first system', counts: NACHTMUSIK,
    v1: v1({ jumps: [J(1, 10, 0)] }),
    expected: marks({ jumps: [{ id: 1, from: s(0, 10), to: s(0, 1), pass: 1 }], nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'M03', req: 'SAV-016', name: 'first and second ending', counts: NACHTMUSIK,
    v1: v1({ jumps: [J(1, 24, 10), J(2, 22, 24, 2)] }),
    expected: marks({
      jumps: [{ id: 1, from: s(2, 1), to: s(1, 1), pass: 1 }, { id: 2, from: s(1, 12), to: s(2, 2), pass: 2 }], nextJumpId: 3,
    }),
    samePlayingOrder: true,
  },
  {
    id: 'M04', req: 'SAV-016', name: 'D.C. al Fine: a jump from gap N and a stop', counts: NACHTMUSIK,
    v1: v1({ jumps: [J(1, 71, 0)], stops: [23] }),
    expected: marks({ jumps: [{ id: 1, from: s(5, 12), to: s(0, 1), pass: 1 }], stops: [{ at: s(1, 13) }], nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'M05', req: 'SAV-016', name: 'D.S. al coda', counts: TIFF,
    v1: v1({ jumps: [J(1, 15, 4), J(2, 10, 17, 2)] }),
    expected: marks({
      jumps: [{ id: 1, from: s(4, 2), to: s(2, 4), pass: 1 }, { id: 2, from: s(3, 3), to: s(4, 5), pass: 2 }], nextJumpId: 3,
    }),
    samePlayingOrder: true,
  },
  {
    id: 'M06', req: 'SAV-016', name: 'breaks and stops at page changes go to the system before the gap', counts: TIFF,
    v1: v1({ breaks: [1, 7], stops: [13] }),
    expected: marks({ breaks: [{ at: s(0, 1) }, { at: s(2, 6) }], stops: [{ at: s(3, 6) }] }),
    samePlayingOrder: true,
  },
  {
    id: 'M07', req: 'SAV-016', name: 'several jumps from one gap keep ids and creation order', counts: NACHTMUSIK,
    v1: v1({ jumps: [J(4, 35, 23), J(2, 35, 0, 2), J(7, 35, 47)], nextJumpId: 9 }),
    expected: marks({
      jumps: [
        { id: 4, from: s(2, 12), to: s(2, 1), pass: 1 },
        { id: 2, from: s(2, 12), to: s(0, 1), pass: 2 },
        { id: 7, from: s(2, 12), to: s(4, 1), pass: 1 },
      ],
      nextJumpId: 9,
    }),
    samePlayingOrder: true,
  },
  {
    id: 'M08', req: 'SAV-016', name: 'a break and a stop at the same gap', counts: SERENADE,
    v1: v1({ breaks: [8], stops: [8] }),
    expected: marks({ breaks: [{ at: s(3, 4) }], stops: [{ at: s(3, 4) }] }),
    samePlayingOrder: true,
  },
  {
    id: 'M09', req: 'SAV-016', name: 'leading pages without systems: gap N to gap 0', counts: SERENADE,
    v1: v1({ jumps: [J(1, 76, 0)] }),
    expected: marks({ jumps: [{ id: 1, from: s(20, 4), to: s(2, 1), pass: 1 }], nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'M10', req: 'SAV-016', name: 'a jump across a page without systems', counts: TIFF,
    v1: v1({ jumps: [J(1, 1, 5)] }),
    expected: marks({ jumps: [{ id: 1, from: s(0, 1), to: s(2, 5), pass: 1 }], nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'M11', req: 'SAV-016, SAV-003', name: 'invalid and out-of-range items are dropped', counts: TIFF,
    v1: v1({ jumps: [J(1, 25, 1), J(2, 3, 25), J(3, 3, 3), J(4, 7, 2, 0), J(5, 7, 1)], breaks: [19, 25], stops: [19] }),
    expected: marks({ jumps: [{ id: 5, from: s(2, 6), to: s(2, 1), pass: 1 }], nextJumpId: 6 }),
    samePlayingOrder: true,
  },
  {
    id: 'M12', req: 'SAV-016', name: 'a section played three times', counts: BEETHOVEN,
    v1: v1({ jumps: [J(1, 40, 11), J(2, 40, 11, 2)] }),
    expected: marks({
      jumps: [{ id: 1, from: s(3, 3), to: s(1, 1), pass: 1 }, { id: 2, from: s(3, 3), to: s(1, 1), pass: 2 }], nextJumpId: 3,
    }),
    samePlayingOrder: true,
  },
  {
    id: 'E01', req: 'SAV-016', name: 'edge: a pass-1 jump from gap 0 becomes the start mark', counts: TIFF,
    v1: v1({ jumps: [J(1, 0, 1)] }),
    expected: marks({ start: { at: s(2, 1) }, nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'E02', req: 'SAV-016', name: 'edge: skipped introduction and a later D.C. back into it', counts: NACHTMUSIK,
    v1: v1({ jumps: [J(1, 0, 10), J(2, 71, 0)] }),
    expected: marks({ start: { at: s(1, 1) }, jumps: [{ id: 2, from: s(5, 12), to: s(0, 1), pass: 1 }], nextJumpId: 3 }),
    samePlayingOrder: true,
  },
  {
    id: 'E03', req: 'SAV-016', name: 'edge: a jump to gap N that ends the piece becomes a stop', counts: [4],
    v1: v1({ jumps: [J(1, 2, 4)] }),
    expected: marks({ stops: [{ at: s(0, 2) }], nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'E04', req: 'SAV-016', name: 'edge: D.C., then on pass 2 a jump to the end', counts: [6],
    v1: v1({ jumps: [J(1, 6, 0), J(2, 2, 6, 2)] }),
    expected: marks({ jumps: [{ id: 1, from: s(0, 6), to: s(0, 1), pass: 1 }], stops: [{ at: s(0, 2) }], nextJumpId: 3 }),
    samePlayingOrder: true,
  },
  {
    id: 'E05', req: 'SAV-016', name: 'edge, not exact: a stop would let a later jump lead back, so the jump to the end is dropped', counts: [4],
    v1: v1({ jumps: [J(1, 2, 4), J(2, 3, 0)] }),
    expected: marks({ jumps: [{ id: 2, from: s(0, 3), to: s(0, 1), pass: 1 }], nextJumpId: 3 }),
    samePlayingOrder: false,
  },
  {
    id: 'E06', req: 'SAV-016', name: 'edge, not exact: the jump to gap N chains into a D.C.', counts: [4],
    v1: v1({ jumps: [J(1, 2, 4), J(2, 4, 0)] }),
    expected: marks({ jumps: [{ id: 2, from: s(0, 4), to: s(0, 1), pass: 1 }], nextJumpId: 3 }),
    samePlayingOrder: false,
  },
  {
    id: 'E07', req: 'SAV-016', name: 'edge: a pass-2 jump from gap 0 is dropped', counts: [4],
    v1: v1({ jumps: [J(1, 2, 0), J(2, 0, 3, 2)] }),
    expected: marks({ jumps: [{ id: 1, from: s(0, 2), to: s(0, 1), pass: 1 }], nextJumpId: 3 }),
    samePlayingOrder: false,
  },
  {
    id: 'E08', req: 'SAV-016', name: 'edge: a never-reached jump to gap N gives no stop', counts: [4],
    v1: v1({ jumps: [J(1, 2, 4, 3)] }),
    expected: marks({ nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'E09', req: 'SAV-016', name: 'edge: a never-reached jump from gap 0 gives no start mark', counts: [4],
    v1: v1({ jumps: [J(1, 0, 2, 2)] }),
    expected: marks({ nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'E10', req: 'SAV-016', name: 'edge, not exact together: neither the start mark nor the stop is applied', counts: [4],
    v1: v1({ jumps: [J(1, 0, 1), J(2, 2, 4), J(3, 3, 0)] }),
    expected: marks({ jumps: [{ id: 3, from: s(0, 3), to: s(0, 1), pass: 1 }], nextJumpId: 4 }),
    samePlayingOrder: false,
  },
  {
    id: 'E11', req: 'SAV-016', name: 'edge: start mark and stop, exact together', counts: [6],
    v1: v1({ jumps: [J(1, 0, 1), J(2, 4, 6)] }),
    expected: marks({ start: { at: s(0, 2) }, stops: [{ at: s(0, 4) }], nextJumpId: 3 }),
    samePlayingOrder: true,
  },
  {
    id: 'E12', req: 'SAV-016', name: 'edge: from gap 0 onto a stop: start mark, empty order as in V1', counts: [6],
    v1: v1({ jumps: [J(1, 0, 3)], stops: [3] }),
    expected: marks({ start: { at: s(0, 4) }, stops: [{ at: s(0, 3) }], nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'E13', req: 'SAV-016', name: 'edge: from gap 0 to gap N is dropped', counts: [4],
    v1: v1({ jumps: [J(1, 0, 4)] }),
    expected: marks({ nextJumpId: 2 }),
    samePlayingOrder: false,
  },
  {
    id: 'E14', req: 'SAV-016', name: 'edge: a jump to gap N discarded by a stop on its gap; the stop stays once', counts: [4],
    v1: v1({ jumps: [J(1, 2, 4)], stops: [2] }),
    expected: marks({ stops: [{ at: s(0, 2) }], nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'E15', req: 'SAV-016', name: 'edge: a jump to gap N behind an earlier stop is not reached', counts: [6],
    v1: v1({ jumps: [J(1, 4, 6)], stops: [1] }),
    expected: marks({ stops: [{ at: s(0, 1) }], nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'E16', req: 'SAV-016', name: 'edge: of two pass-1 jumps from gap 0 the first gives the start mark', counts: [4],
    v1: v1({ jumps: [J(1, 0, 2), J(2, 0, 3)] }),
    expected: marks({ start: { at: s(0, 3) }, nextJumpId: 3 }),
    samePlayingOrder: true,
  },
  {
    id: 'E17', req: 'SAV-016', name: 'edge, V1 case O08: start mark; the stop before it stays and is never reached', counts: [5],
    v1: v1({ jumps: [J(1, 0, 4)], stops: [2] }),
    expected: marks({ start: { at: s(0, 5) }, stops: [{ at: s(0, 2) }], nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'E18', req: 'SAV-016', name: 'edge, V1 case O10: the later of two equal jumps never fires and gives no stop', counts: [4],
    v1: v1({ jumps: [J(1, 2, 0), J(2, 2, 4)] }),
    expected: marks({ jumps: [{ id: 1, from: s(0, 2), to: s(0, 1), pass: 1 }], nextJumpId: 3 }),
    samePlayingOrder: true,
  },
  {
    id: 'E19', req: 'SAV-016', name: 'edge, V1 case O12: skipped beginning', counts: [4],
    v1: v1({ jumps: [J(1, 0, 2)] }),
    expected: marks({ start: { at: s(0, 3) }, nextJumpId: 2 }),
    samePlayingOrder: true,
  },
  {
    id: 'E20', req: 'SAV-016', name: 'edge, V1 case O20: stop, and the never-reached jump from gap N stays', counts: [4],
    v1: v1({ jumps: [J(1, 2, 4), J(2, 4, 1, 2)] }),
    expected: marks({ jumps: [{ id: 2, from: s(0, 4), to: s(0, 2), pass: 2 }], stops: [{ at: s(0, 2) }], nextJumpId: 3 }),
    samePlayingOrder: true,
  },
  {
    id: 'E21', req: 'SAV-016', name: 'edge, not exact, V1 case O21: the jump to gap N chains back before the end', counts: [4],
    v1: v1({ jumps: [J(1, 2, 4), J(2, 4, 3)] }),
    expected: marks({ jumps: [{ id: 2, from: s(0, 4), to: s(0, 4), pass: 1 }], nextJumpId: 3 }),
    samePlayingOrder: false,
  },
];
