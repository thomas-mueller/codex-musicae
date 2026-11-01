/**
 * core/edits — pure edits of jumps, breaks and stops. Requirements: ORG-014..ORG-024, PLY-007, PLY-009, PLY-013, DET-015.
 * All functions return new objects; inputs are never mutated. `systemCount` = N.
 */
import type { Jump } from './model';
import { isValidJump, isValidMarkJunction } from './playing-order';

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

/** Adds or removes `junction` in an ascending, unique list; junctions outside 1..N-1 leave it unchanged. */
function toggled(list: readonly number[], junction: number, systemCount: number): readonly number[] {
  if (!isValidMarkJunction(junction, systemCount)) {
    return list;
  }
  return list.includes(junction) ? list.filter((j) => j !== junction) : [...list, junction].sort((a, b) => a - b);
}

/** Appends the jump with id = nextJumpId. Returns null if `isValidJump(jump, systemCount)` is false. */
export function addJump(marks: DocMarks, jump: Jump, systemCount: number): DocMarks | null {
  if (!isValidJump(jump, systemCount)) {
    return null;
  }
  return { ...marks, jumps: [...marks.jumps, { ...jump, id: marks.nextJumpId }], nextJumpId: marks.nextJumpId + 1 };
}

/** Removes the jump with this id; unknown id -> unchanged marks. */
export function removeJump(marks: DocMarks, id: number): DocMarks {
  return marks.jumps.some((j) => j.id === id) ? { ...marks, jumps: marks.jumps.filter((j) => j.id !== id) } : marks;
}

/**
 * Applies `patch` (origin, target and/or pass) to the jump with this id, keeping its position and id.
 * Returns null if the id is unknown or the patched jump is invalid.
 */
export function updateJump(
  marks: DocMarks,
  id: number,
  patch: Partial<Jump>,
  systemCount: number,
): DocMarks | null {
  const existing = marks.jumps.find((j) => j.id === id);
  if (existing === undefined) {
    return null;
  }
  const patched: MarkedJump = { ...existing, ...patch, id };
  if (!isValidJump(patched, systemCount)) {
    return null;
  }
  return { ...marks, jumps: marks.jumps.map((j) => (j.id === id ? patched : j)) };
}

/** Adds the break if absent, removes it if present. A junction outside 1..N-1 (or not an integer) leaves the marks unchanged. */
export function toggleBreak(marks: DocMarks, junction: number, systemCount: number): DocMarks {
  const next = toggled(marks.breaks, junction, systemCount);
  return next === marks.breaks ? marks : { ...marks, breaks: next };
}

/** Same as toggleBreak, for stops. */
export function toggleStop(marks: DocMarks, junction: number, systemCount: number): DocMarks {
  const next = toggled(marks.stops, junction, systemCount);
  return next === marks.stops ? marks : { ...marks, stops: next };
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

/** Removes everything at the junction: jumps whose origin OR target it is, its break and its stop. nextJumpId is unchanged. */
export function clearJunction(marks: DocMarks, junction: number): DocMarks {
  return {
    ...marks,
    jumps: marks.jumps.filter((j) => j.origin !== junction && j.target !== junction),
    breaks: marks.breaks.filter((b) => b !== junction),
    stops: marks.stops.filter((b) => b !== junction),
  };
}

/** DET-015: marks are kept unchanged if oldCount === newCount, otherwise EMPTY_MARKS. */
export function reconcileAfterRedetection(marks: DocMarks, oldCount: number, newCount: number): DocMarks {
  return oldCount === newCount ? marks : EMPTY_MARKS;
}

/** ORG-018: palette index of a jump = (jump.id - 1) mod paletteSize. */
export function jumpColorIndex(jumpId: number, paletteSize: number): number {
  return (((jumpId - 1) % paletteSize) + paletteSize) % paletteSize;
}
