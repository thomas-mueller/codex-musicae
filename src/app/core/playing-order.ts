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
export function generatePlayingOrder(input: PlayingOrderInput): PlayingOrder {
  const n = input.systemCount;

  // Jumps grouped by origin, array order preserved so the first match wins (PLY-006).
  const jumpsByOrigin = new Map<number, Jump[]>();
  for (const jump of input.jumps) {
    const list = jumpsByOrigin.get(jump.origin);
    if (list) {
      list.push(jump);
    } else {
      jumpsByOrigin.set(jump.origin, [jump]);
    }
  }

  const arrivals = new Map<number, number>();
  let entries: number[] = [];
  const events: { readonly junction: number; readonly len: number }[] = [];
  let position = 0;
  let truncatedByCap = false;

  for (;;) {
    const arrival = (arrivals.get(position) ?? 0) + 1;
    arrivals.set(position, arrival);
    events.push({ junction: position, len: entries.length });
    const jump = jumpsByOrigin.get(position)?.find((j) => j.pass === arrival);
    if (jump) {
      position = jump.target;
      continue;
    }
    if (position === n) {
      break;
    }
    if (entries.length >= input.maxLength) {
      truncatedByCap = true;
      break;
    }
    entries.push(position + 1);
    position += 1;
  }

  let between: number[][] = Array.from({ length: Math.max(0, entries.length - 1) }, () => []);
  for (const { junction, len } of events) {
    if (len >= 1 && len <= between.length) {
      between[len - 1]?.push(junction);
    }
  }

  // Stops (PLY-008): cut after the last arrival at each reached stop; the shortest cut wins.
  const lastLengthAt = new Map<number, number>();
  for (const { junction, len } of events) {
    lastLengthAt.set(junction, len);
  }
  let cut = Number.POSITIVE_INFINITY;
  for (const stop of input.stops) {
    const len = lastLengthAt.get(stop);
    if (len !== undefined && len < cut) {
      cut = len;
    }
  }
  if (cut !== Number.POSITIVE_INFINITY) {
    entries = entries.slice(0, cut);
    between = between.slice(0, Math.max(0, cut - 1));
  }

  return { entries, between, truncatedByCap };
}

/**
 * Numbers per system (PLY-010): result[i] lists, ascending, the 1-based positions in `entries` at which
 * system i + 1 occurs. Length = systemCount; a system never played has an empty list.
 */
export function systemNumbers(order: PlayingOrder, systemCount: number): number[][] {
  const result: number[][] = Array.from({ length: systemCount }, () => []);
  order.entries.forEach((system, i) => {
    result[system - 1]?.push(i + 1);
  });
  return result;
}

/**
 * Forced slide breaks (PLY-011): result[i] is true if any junction in order.between[i] is in `breaks`.
 * Length = order.between.length.
 */
export function forcedBreaks(order: PlayingOrder, breaks: ReadonlySet<number>): boolean[] {
  return order.between.map((junctions) => junctions.some((j) => breaks.has(j)));
}

/** PLY-007: origin and target integers in 0..systemCount, origin !== target, pass an integer >= 1. */
export function isValidJump(jump: Jump, systemCount: number): boolean {
  const { origin, target, pass } = jump;
  return (
    Number.isInteger(origin) && Number.isInteger(target) && Number.isInteger(pass) &&
    origin >= 0 && origin <= systemCount &&
    target >= 0 && target <= systemCount &&
    origin !== target &&
    pass >= 1
  );
}

/** PLY-009, PLY-013: breaks and stops are valid at integer junctions 1..systemCount-1 only. */
export function isValidMarkJunction(junction: number, systemCount: number): boolean {
  return Number.isInteger(junction) && junction >= 1 && junction <= systemCount - 1;
}
