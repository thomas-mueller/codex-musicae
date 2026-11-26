/**
 * core/migrate-v1 — V1 marks (junction form) to V2 marks (system form). Requirements: SAV-016, SAV-003.
 */
import type { SystemMarks } from './marks';
import type { Jump } from './model';

/** The `marks` section of the V1 metadata (schema 1). */
export interface V1Marks {
  /** In creation order. */
  readonly jumps: readonly (Jump & { readonly id: number })[];
  /** Junctions. */
  readonly breaks: readonly number[];
  /** Junctions. */
  readonly stops: readonly number[];
  readonly nextJumpId: number;
}

/**
 * N = sum of pageSystemCounts; system(k), k in 1..N, is the SystemRef of the k-th system in print order.
 *
 * 1. Jumps for which `isValidJump(jump, N)` is false are dropped. The others are the "valid jumps".
 * 2. Interior jumps (origin in 1..N and target in 0..N-1) become `{ id, from: system(origin), to: system(target + 1), pass }`.
 *    Ids and creation order are kept.
 * 3. A break or stop at junction k in 1..N-1 becomes a mark on system(k); other junctions are dropped. Lists in print order,
 *    without duplicates.
 * 4. Edge jumps (valid, with origin 0 or target N) have no place in the system form. Some can be replaced by a start mark or a
 *    stop. A jump is "reached" if it fires in the V1 replay (all valid jumps, the stops of step 3) before the arrival at
 *    which that playing order ends; a jump at the arrival where a stop cuts is discarded (PLY-008), so it is not reached.
 *    Candidates:
 *      - start: the first reached jump (array order) with origin 0, pass 1 and target in 1..N-1 gives the start mark on
 *        system(target + 1);
 *      - stop: every reached jump with origin in 1..N-1 and target N gives a stop on system(origin) (merged with step 3).
 *    No other edge jump is a candidate.
 * 5. All candidates are applied together. They are kept only if the V2 playing order of the result
 *    (`generatePlayingOrder(derivePlayingOrderInput(result, ...))`) has the same `entries` and the same
 *    `forcedBreaks(order, breaks)` as the V1 order of step 4 (for the V1 order: the breaks of step 3). Otherwise the result
 *    has none of them: no start mark and only the stops of step 3. Edge jumps are never part of the result.
 *
 * `nextJumpId` is kept; there are no bookmarks (`nextBookmarkId` 1); without a start candidate `start` is null.
 */
export function migrateMarksV1(_v1: V1Marks, _pageSystemCounts: readonly number[], _maxLength: number): SystemMarks {
  throw new Error('not implemented');
}
