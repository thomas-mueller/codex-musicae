/**
 * core/playing-order — playing-order replay, stops, numbering, forced slide breaks.
 * Requirements: PLY-002..PLY-013.
 */
import type { Jump } from './model';

export interface PlayingOrderInput {
  /** N, the number of systems. Junctions are 0..N. */
  readonly systemCount: number;
  /** In creation order: when several jumps share origin and pass, the FIRST in this array wins. */
  readonly jumps: readonly Jump[];
  /** Junctions 1..N-1. Order does not matter. */
  readonly stops: readonly number[];
  /** Safety cap on the number of entries (PLY-005). */
  readonly maxLength: number;
}

export interface PlayingOrder {
  /** System indices (1..N) in playing order. */
  readonly entries: readonly number[];
  /**
   * between[i] = junctions at which the playing position arrived after playing entries[i] and before playing
   * entries[i+1], in visit order. The first element is always entries[i] (the junction after that system).
   * Length = max(0, entries.length - 1).
   */
  readonly between: readonly (readonly number[])[];
  /** True when the cap stopped generation. */
  readonly truncatedByCap: boolean;
}

/**
 * Replay (PLY-002):
 *   position = 0; arrivals[0..N] = 0; entries = []
 *   loop:
 *     arrivals[position] += 1; record the arrival event (junction = position, entriesSoFar = entries.length)
 *     if a jump has origin == position and pass == arrivals[position] (first in array order wins):
 *         position = jump.target; continue
 *     if position == N: stop
 *     if entries.length >= maxLength: truncatedByCap = true; stop
 *     append system position + 1 to entries; position += 1
 * Stops (PLY-008), applied after the replay: for every stop junction that has at least one arrival event,
 * cutLength = entriesSoFar of its LAST arrival event. If any stop was reached, keep only the first
 * min(cutLength over reached stops) entries and the first (that - 1) elements of `between` (never negative).
 * A stop that was never reached has no effect. `systemCount` 0 gives an empty order.
 */
export function generatePlayingOrder(_input: PlayingOrderInput): PlayingOrder {
  throw new Error('not implemented');
}

/**
 * Numbers per system (PLY-010): result[i] lists, ascending, the 1-based positions in `entries` at which
 * system i + 1 occurs. Length = systemCount; a system never played has an empty list.
 */
export function systemNumbers(_order: PlayingOrder, _systemCount: number): number[][] {
  throw new Error('not implemented');
}

/**
 * Forced slide breaks (PLY-011): result[i] is true if any junction in order.between[i] is in `breaks`.
 * Length = order.between.length.
 */
export function forcedBreaks(_order: PlayingOrder, _breaks: ReadonlySet<number>): boolean[] {
  throw new Error('not implemented');
}

/** PLY-007: origin and target integers in 0..systemCount, origin !== target, pass an integer >= 1. */
export function isValidJump(_jump: Jump, _systemCount: number): boolean {
  throw new Error('not implemented');
}

/** PLY-009, PLY-013: breaks and stops are valid at integer junctions 1..systemCount-1 only. */
export function isValidMarkJunction(_junction: number, _systemCount: number): boolean {
  throw new Error('not implemented');
}
