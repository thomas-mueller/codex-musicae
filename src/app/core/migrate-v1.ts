/**
 * core/migrate-v1 — V1 marks (junction form) to V2 marks (system form). Requirements: SAV-016, SAV-003.
 */
import { replayArrivals } from './mark-positions';
import { EMPTY_SYSTEM_MARKS, refAt } from './marks';
import type { SystemMarks, SystemRef } from './marks';
import type { Jump } from './model';
import { derivePlayingOrderInput, forcedBreaks, generatePlayingOrder, isValidJump, isValidMarkJunction } from './playing-order';
import type { PlayingOrderInput } from './playing-order';

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
export function migrateMarksV1(v1: V1Marks, pageSystemCounts: readonly number[], maxLength: number): SystemMarks {
  const systemCount = pageSystemCounts.reduce((sum, n) => sum + n, 0);
  const valid: V1Marks = {
    jumps: v1.jumps.filter((jump) => isValidJump(jump, systemCount)),
    breaks: markJunctions(v1.breaks, systemCount),
    stops: markJunctions(v1.stops, systemCount),
    nextJumpId: v1.nextJumpId,
  };
  /** system(k), k in 1..N; only called with junctions that the filters above let through. */
  const system = (k: number): SystemRef => refAt(k, pageSystemCounts) as SystemRef;
  const isEdge = (jump: Jump): boolean => jump.origin === 0 || jump.target === systemCount;
  const build = (startSystem: number | null, stops: readonly number[]): SystemMarks => ({
    ...EMPTY_SYSTEM_MARKS,
    jumps: valid.jumps
      .filter((jump) => !isEdge(jump))
      .map(({ id, origin, target, pass }) => ({ id, from: system(origin), to: system(target + 1), pass })),
    stops: markJunctions(stops, systemCount).map((k) => ({ at: system(k) })),
    breaks: valid.breaks.map((k) => ({ at: system(k) })),
    start: startSystem === null ? null : { at: system(startSystem) },
    nextJumpId: valid.nextJumpId,
  });
  const dropped = build(null, valid.stops);

  const reached = reachedJumps(valid, systemCount, maxLength);
  const start = reached.find((j) => j.origin === 0 && j.pass === 1 && j.target >= 1 && j.target < systemCount);
  const toEnd = reached.filter((j) => j.target === systemCount && j.origin >= 1).map((j) => j.origin);
  if (start === undefined && toEnd.length === 0) {
    return dropped;
  }
  const converted = build(start === undefined ? null : start.target + 1, [...valid.stops, ...toEnd]);
  const derived = derivePlayingOrderInput(converted, pageSystemCounts, maxLength);
  const v1Input = { systemCount, jumps: valid.jumps, stops: valid.stops, maxLength };
  return soundsTheSame(v1Input, valid.breaks, derived, derived.breaks) ? converted : dropped;
}

/** The junctions 1..N-1 of a V1 break or stop list, ascending and unique. */
function markJunctions(junctions: readonly number[], systemCount: number): number[] {
  return [...new Set(junctions.filter((k) => isValidMarkJunction(k, systemCount)))].sort((a, b) => a - b);
}

/** The jumps that fire before the arrival at which the V1 order ends, in array order. */
function reachedJumps(v1: V1Marks, systemCount: number, maxLength: number): V1Marks['jumps'] {
  const { firedAt, endArrival } = replayArrivals(v1, systemCount, maxLength);
  return v1.jumps.filter((jump) => (firedAt.get(jump.id) ?? Number.POSITIVE_INFINITY) < endArrival);
}

/** The same systems in the same order and the same forced slide breaks. */
function soundsTheSame(a: PlayingOrderInput, aBreaks: readonly number[], b: PlayingOrderInput, bBreaks: readonly number[]): boolean {
  const heard = (input: PlayingOrderInput, breaks: readonly number[]): string => {
    const order = generatePlayingOrder(input);
    return JSON.stringify([order.entries, forcedBreaks(order, new Set(breaks))]);
  };
  return heard(a, aBreaks) === heard(b, bBreaks);
}

