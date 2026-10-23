/**
 * core/edits — pure edits of jumps, breaks and stops. Requirements: ORG-014..ORG-024, PLY-007, PLY-009, PLY-013, DET-015.
 * All functions return new objects; inputs are never mutated. `systemCount` = N.
 */
import type { Jump } from './model';

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

/** Appends the jump with id = nextJumpId. Returns null if `isValidJump(jump, systemCount)` is false. */
export function addJump(_marks: DocMarks, _jump: Jump, _systemCount: number): DocMarks | null {
  throw new Error('not implemented');
}

/** Removes the jump with this id; unknown id -> unchanged marks. */
export function removeJump(_marks: DocMarks, _id: number): DocMarks {
  throw new Error('not implemented');
}

/**
 * Applies `patch` (origin, target and/or pass) to the jump with this id, keeping its position and id.
 * Returns null if the id is unknown or the patched jump is invalid.
 */
export function updateJump(
  _marks: DocMarks,
  _id: number,
  _patch: Partial<Jump>,
  _systemCount: number,
): DocMarks | null {
  throw new Error('not implemented');
}

/** Adds the break if absent, removes it if present. A junction outside 1..N-1 (or not an integer) leaves the marks unchanged. */
export function toggleBreak(_marks: DocMarks, _junction: number, _systemCount: number): DocMarks {
  throw new Error('not implemented');
}

/** Same as toggleBreak, for stops. */
export function toggleStop(_marks: DocMarks, _junction: number, _systemCount: number): DocMarks {
  throw new Error('not implemented');
}

/** Jumps that start at the junction (asOrigin) and jumps that end at it (asTarget), each in creation order. */
export function jumpsAtJunction(
  _marks: DocMarks,
  _junction: number,
): { asOrigin: MarkedJump[]; asTarget: MarkedJump[] } {
  throw new Error('not implemented');
}

/** True if the junction is the origin or target of a jump, or holds a break or a stop (the delete icon is shown only then). */
export function junctionHasItems(_marks: DocMarks, _junction: number): boolean {
  throw new Error('not implemented');
}

/** Removes everything at the junction: jumps whose origin OR target it is, its break and its stop. nextJumpId is unchanged. */
export function clearJunction(_marks: DocMarks, _junction: number): DocMarks {
  throw new Error('not implemented');
}

/** DET-015: marks are kept unchanged if oldCount === newCount, otherwise EMPTY_MARKS. */
export function reconcileAfterRedetection(_marks: DocMarks, _oldCount: number, _newCount: number): DocMarks {
  throw new Error('not implemented');
}

/** ORG-018: palette index of a jump = (jump.id - 1) mod paletteSize. */
export function jumpColorIndex(_jumpId: number, _paletteSize: number): number {
  throw new Error('not implemented');
}
