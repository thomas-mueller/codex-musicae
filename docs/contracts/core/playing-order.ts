/**
 * core/playing-order — playing-order replay, stops, numbering, forced slide breaks.
 * Requirements: PLY-002..PLY-013.
 */
import type { SystemMarks } from './marks';
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
  /** PLY-015: the junction 0..N at which the replay starts (this start is the first arrival there); absent = 0. */
  readonly startJunction?: number;
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
 * Replay (PLY-002, PLY-015):
 *   position = startJunction (0 when absent); arrivals[0..N] = 0; entries = []
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

export interface DerivedOrderInput extends PlayingOrderInput {
  readonly startJunction: number;
  /** Junctions of the slide breaks, for `forcedBreaks`. */
  readonly breaks: readonly number[];
}

/**
 * PLY-014..PLY-016: the junction input of the replay, derived from marks on system sides. The right side of system k (global
 * print index, 1..N, N = sum of pageSystemCounts) is junction k, the left side of system k is junction k-1.
 *  - systemCount = N, maxLength as given.
 *  - startJunction = k-1 for the system k of the start mark, 0 without one. Only the start moves: later jumps may go to any
 *    junction, also before it. Stops, breaks and jumps on the right side of system k-1 are at the start junction and act
 *    like those of every other arrival.
 *  - jumps, in array order, as { origin: k(from), target: k(to) - 1, pass }.
 *  - stops, breaks: junction k of each mark, ascending, only 1..N-1 (a mark left on the last system has no effect, MRK-005).
 * Ignored: every mark whose system does not exist in the layout (a start mark then counts as absent), jumps with a cross-file
 * target (defined in M6), and jumps whose origin equals their target (possible after a system between them was deleted).
 */
export function derivePlayingOrderInput(_marks: SystemMarks, _pageSystemCounts: readonly number[], _maxLength: number): DerivedOrderInput {
  throw new Error('not implemented');
}
