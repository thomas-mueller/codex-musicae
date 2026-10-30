/**
 * core/junctions — system numbering and bars. Requirements: PLY-001, ORG-008, ORG-009, DET-012.
 */
import type { Bar, DetectedPage, SystemInfo } from './model';

export interface JunctionLabel {
  /** 1-based page number. */
  readonly page: number;
  /** 1-based position of the bar among the bars of that page (top to bottom). */
  readonly ordinal: number;
}

/**
 * All systems in print order: pages sorted by `pageIndex`, pages without systems skipped,
 * systems of a page sorted by y (ties by x); `index` counts 1, 2, 3, ...
 */
export function flattenSystems(_pages: readonly DetectedPage[]): SystemInfo[] {
  throw new Error('not implemented');
}

/** N = total number of systems. Junctions are 0..N. */
export function junctionCount(_pages: readonly DetectedPage[]): number {
  throw new Error('not implemented');
}

/**
 * Bars for every page that has systems, ordered by pageIndex then y. For a page whose systems have global
 * indices a..b (a = first, b = last):
 *  - top bar:     junction a-1, y = 0,               height = max(0, first.y)
 *  - between:     junction k (k = a..b-1), y = bottom(system k), height = max(0, top(system k+1) - bottom(system k))
 *  - bottom bar:  junction b,   y = bottom(last),    height = max(0, page.height - bottom(last))
 * A junction on a page change therefore appears twice (bottom bar of page p, top bar of the next page with systems).
 * Pages without systems produce no bars. Bars with height 0 are kept.
 */
export function computeBars(_pages: readonly DetectedPage[]): Bar[] {
  throw new Error('not implemented');
}

/** Bars of one junction, in the order returned by `computeBars`. */
export function barsOfJunction(_bars: readonly Bar[], _junction: number): Bar[] {
  throw new Error('not implemented');
}

/**
 * How a junction is named for the user (ORG-018, ORG-021): the page (1-based) and the bar number on that page (1-based)
 * of the FIRST bar of the junction in `bars` order (for a junction on a page change this is the bottom bar of the earlier page).
 * `bars` must be the output of `computeBars`. A junction without bars gives null.
 */
export function junctionLabel(_bars: readonly Bar[], _junction: number): JunctionLabel | null {
  throw new Error('not implemented');
}
