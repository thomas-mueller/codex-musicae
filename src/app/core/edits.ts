/**
 * core/edits — the temporary layer between the V1 organization chips and marks on systems (V2-M4; V2-M10 removes it).
 * Requirements: ORG-014..ORG-024, PLY-007, PLY-009, PLY-013, PLY-016, MRK-001, MRK-013.
 *
 * The chips still address junctions: junction k is the right side of system k (a jump start, stop or slide break) and the
 * left side of system k+1 (a jump target). `counts[pageIndex]` is the number of systems per page; N is their sum.
 * `DocMarks` is the junction VIEW of the stored `SystemMarks`; it is never stored. All functions return new objects (or the
 * input itself when nothing changes); inputs are never mutated. Marks the view does not show (start mark, bookmarks,
 * cross-file jumps, marks without effect) survive every edit.
 */
import { addMark, printIndex, refAt } from './marks';
import type { PointMark, SystemMarks } from './marks';
import type { Jump } from './model';
import { derivePlayingOrderInput, isValidMarkJunction, junctionJumps } from './playing-order';

export interface MarkedJump extends Jump {
  /** Stable id (1, 2, 3, ...) that never changes and is never reused within a document. */
  readonly id: number;
}

export interface DocMarks {
  /** In creation order (PLY-006: the earlier one wins on equal origin and pass). */
  readonly jumps: readonly MarkedJump[];
  /** Junctions 1..N-1, ascending, unique. */
  readonly breaks: readonly number[];
  /** Junctions 1..N-1, ascending, unique. */
  readonly stops: readonly number[];
  /** Id given to the next created jump. */
  readonly nextJumpId: number;
}

export const EMPTY_MARKS: DocMarks = { jumps: [], breaks: [], stops: [], nextJumpId: 1 };

function systemTotal(counts: readonly number[]): number {
  return counts.reduce((sum, n) => sum + n, 0);
}

/** `addMark` toggles; junctions outside 1..N-1 leave the marks as they are (no rejection, as in V1). */
function toggled(kind: 'break' | 'stop', marks: SystemMarks, junction: number, counts: readonly number[]): SystemMarks {
  const at = isValidMarkJunction(junction, systemTotal(counts)) ? refAt(junction, counts) : null;
  return at === null ? marks : (addMark(marks, { kind, at }, counts) ?? marks);
}

/** The marks the V1 chips can show: jumps in creation order, breaks and stops as ascending junctions. */
export function junctionView(marks: SystemMarks, counts: readonly number[]): DocMarks {
  const { breaks, stops } = derivePlayingOrderInput(marks, counts, 0);
  return { jumps: junctionJumps(marks, counts), breaks, stops, nextJumpId: marks.nextJumpId };
}

/** Appends the jump with id = nextJumpId. Null if it has no form on systems (origin 0, target N, origin = target, bad pass). */
export function addJump(marks: SystemMarks, jump: Jump, counts: readonly number[]): SystemMarks | null {
  const from = refAt(jump.origin, counts);
  const to = refAt(jump.target + 1, counts);
  // origin = target is "directly after the start", which `addMark` rejects, as it does a bad pass
  return from === null || to === null ? null : addMark(marks, { kind: 'jump', from, to, pass: jump.pass }, counts);
}

/** Removes the jump with this id; unknown id -> unchanged marks. */
export function removeJump(marks: SystemMarks, id: number): SystemMarks {
  return marks.jumps.some((j) => j.id === id) ? { ...marks, jumps: marks.jumps.filter((j) => j.id !== id) } : marks;
}

/**
 * Applies `patch` (origin, target and/or pass) to the jump with this id, keeping its place, id and user text. Null if the view
 * has no jump with this id or the patched jump is invalid.
 */
export function updateJump(marks: SystemMarks, id: number, patch: Partial<Jump>, counts: readonly number[]): SystemMarks | null {
  const shown = junctionJumps(marks, counts).find((j) => j.id === id);
  const added = shown === undefined ? null : addJump(marks, { ...shown, ...patch }, counts)?.jumps.at(-1);
  if (!added) {
    return null;
  }
  return { ...marks, jumps: marks.jumps.map((j) => (j.id === id ? { ...j, from: added.from, to: added.to, pass: added.pass } : j)) };
}

/** Adds the break if absent, removes it if present. A junction outside 1..N-1 (or not an integer) leaves the marks unchanged. */
export function toggleBreak(marks: SystemMarks, junction: number, counts: readonly number[]): SystemMarks {
  return toggled('break', marks, junction, counts);
}

/** Same as toggleBreak, for stops. */
export function toggleStop(marks: SystemMarks, junction: number, counts: readonly number[]): SystemMarks {
  return toggled('stop', marks, junction, counts);
}

/** Removes what the view shows at the junction: jumps whose origin OR target it is, its break and its stop. */
export function clearJunction(marks: SystemMarks, junction: number, counts: readonly number[]): SystemMarks {
  const shown = junctionJumps(marks, counts);
  const gone = new Set(shown.filter((j) => j.origin === junction || j.target === junction).map((j) => j.id));
  // a stop or break left on the last system has no bar item and stays
  const index = isValidMarkJunction(junction, systemTotal(counts)) ? junction : null;
  const kept = (mark: PointMark): boolean => printIndex(mark.at, counts) !== index || index === null;
  return { ...marks, jumps: marks.jumps.filter((j) => !gone.has(j.id)), breaks: marks.breaks.filter(kept), stops: marks.stops.filter(kept) };
}

/** Jumps that start at the junction (asOrigin) and jumps that end at it (asTarget), each in creation order. */
export function jumpsAtJunction(
  marks: DocMarks,
  junction: number,
): { asOrigin: MarkedJump[]; asTarget: MarkedJump[] } {
  return {
    asOrigin: marks.jumps.filter((j) => j.origin === junction),
    asTarget: marks.jumps.filter((j) => j.target === junction),
  };
}

/** True if the junction is the origin or target of a jump, or holds a break or a stop (the delete icon is shown only then). */
export function junctionHasItems(marks: DocMarks, junction: number): boolean {
  return (
    marks.jumps.some((j) => j.origin === junction || j.target === junction) ||
    marks.breaks.includes(junction) ||
    marks.stops.includes(junction)
  );
}

/** ORG-018: palette index of a jump = (jump.id - 1) mod paletteSize. */
export function jumpColorIndex(jumpId: number, paletteSize: number): number {
  return (((jumpId - 1) % paletteSize) + paletteSize) % paletteSize;
}
