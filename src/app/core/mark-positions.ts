/**
 * core/mark-positions — where in the playing order the jumps, slide breaks and stops of a document are met.
 * Requirements: ORG-018, ORG-021, PLY-002, PLY-006, PLY-008.
 *
 * The playing-order contract (`playing-order.ts`) returns the systems and the junctions between them, but not the arrivals
 * after the last system, so this module replays the same rules itself; a test checks both against the playing-order fixtures.
 */
import type { DocMarks } from './edits';

export interface Arrival {
  readonly junction: number;
  /** Number of systems played before this arrival. */
  readonly entriesSoFar: number;
}

export interface Replay {
  readonly arrivals: readonly Arrival[];
  /** Index into `arrivals` at which each jump fired, by jump id. */
  readonly firedAt: ReadonlyMap<number, number>;
  /** Index of the arrival at which a stop ends the playing order; Infinity without a reached stop. */
  readonly endArrival: number;
  /** Systems in the playing order (after the cap and the stops). */
  readonly entryCount: number;
}

/**
 * The arrival events of the replay documented in `playing-order.ts`: which jump fires where, and where a stop ends the order
 * (the stop with the smallest cut length, acting at its LAST arrival).
 */
export function replayArrivals(marks: DocMarks, systemCount: number, maxLength: number): Replay {
  const arrivals: Arrival[] = [];
  const firedAt = new Map<number, number>();
  const counts = new Array<number>(systemCount + 1).fill(0);
  let position = 0;
  let entries = 0;
  for (;;) {
    counts[position] = (counts[position] ?? 0) + 1;
    arrivals.push({ junction: position, entriesSoFar: entries });
    const jump = marks.jumps.find((j) => j.origin === position && j.pass === counts[position]);
    if (jump !== undefined) {
      firedAt.set(jump.id, arrivals.length - 1);
      position = jump.target;
      continue;
    }
    if (position === systemCount || entries >= maxLength) {
      break;
    }
    entries++;
    position++;
  }
  const junctions = arrivals.map((a) => a.junction);
  const stopped = marks.stops
    .map((junction) => junctions.lastIndexOf(junction))
    .filter((index) => index >= 0)
    .map((index) => ({ index, cut: arrivals[index]?.entriesSoFar ?? 0 }));
  const cut = stopped.reduce((best, stop) => Math.min(best, stop.cut), Number.POSITIVE_INFINITY);
  const endArrival = stopped.filter((stop) => stop.cut === cut).reduce((best, stop) => Math.min(best, stop.index), Number.POSITIVE_INFINITY);
  return { arrivals, firedAt, endArrival, entryCount: Math.min(entries, cut) };
}

/** Where a mark is met: between the system played before (`previous`) and the one played next, as positions in the playing order. */
export interface MarkPosition {
  /** Arrival index: the order of the marks. */
  readonly index: number;
  /** Position (1-based) of the system played just before; null at the start of the order. */
  readonly previous: number | null;
  /** Position of the system played next; null where the order ends (end of the document, a stop). */
  readonly next: number | null;
}

/** Only marks that are reached appear in the maps. */
export interface MarkPositions {
  /** By jump id. */
  readonly jumps: ReadonlyMap<number, MarkPosition>;
  /** By junction: where the junction is first arrived at. */
  readonly breaks: ReadonlyMap<number, MarkPosition>;
  /** By junction: where the order ends (its last arrival). */
  readonly stops: ReadonlyMap<number, MarkPosition>;
}

export function markPositions(marks: DocMarks, systemCount: number, maxLength: number): MarkPositions {
  const { arrivals, firedAt, endArrival, entryCount } = replayArrivals(marks, systemCount, maxLength);
  const at = (index: number): MarkPosition | null => {
    const arrival = arrivals[index];
    if (arrival === undefined || index > endArrival) {
      return null;
    }
    const played = arrival.entriesSoFar;
    return { index, previous: played > 0 ? played : null, next: played < entryCount ? played + 1 : null };
  };
  const junctions = arrivals.map((a) => a.junction);
  const jumps = new Map<number, MarkPosition>();
  for (const [id, index] of firedAt) {
    const position = at(index);
    if (position !== null) {
      jumps.set(id, position);
    }
  }
  const breaks = new Map<number, MarkPosition>();
  for (const junction of marks.breaks) {
    const position = at(junctions.indexOf(junction));
    if (position !== null) {
      breaks.set(junction, position);
    }
  }
  const stops = new Map<number, MarkPosition>();
  for (const junction of marks.stops) {
    const position = at(junctions.lastIndexOf(junction));
    if (position !== null) {
      stops.set(junction, position);
    }
  }
  return { jumps, breaks, stops };
}
