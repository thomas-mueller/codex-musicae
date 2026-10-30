/**
 * core/junctions — system numbering and bars. Requirements: PLY-001, ORG-008, ORG-009, DET-012.
 */
import type { Rect } from './geometry';
import type { Bar, DetectedPage, SystemInfo } from './model';

function sortedSystems(systems: readonly Rect[]): Rect[] {
  return [...systems].sort((a, b) => a.y - b.y || a.x - b.x);
}

function sortedPages(pages: readonly DetectedPage[]): DetectedPage[] {
  return [...pages].sort((a, b) => a.pageIndex - b.pageIndex);
}

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
export function flattenSystems(pages: readonly DetectedPage[]): SystemInfo[] {
  const out: SystemInfo[] = [];
  for (const page of sortedPages(pages)) {
    for (const box of sortedSystems(page.systems)) {
      out.push({ index: out.length + 1, pageIndex: page.pageIndex, box });
    }
  }
  return out;
}

/** N = total number of systems. Junctions are 0..N. */
export function junctionCount(pages: readonly DetectedPage[]): number {
  return flattenSystems(pages).length;
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
export function computeBars(pages: readonly DetectedPage[]): Bar[] {
  const bars: Bar[] = [];
  let n = 0;
  for (const page of sortedPages(pages)) {
    const sorted = sortedSystems(page.systems);
    const [firstSystem] = sorted;
    const lastSystem = sorted.at(-1);
    if (firstSystem === undefined || lastSystem === undefined) {
      continue;
    }
    const first = n + 1;
    bars.push({ junction: first - 1, pageIndex: page.pageIndex, y: 0, height: Math.max(0, firstSystem.y) });
    sorted.slice(0, -1).forEach((system, i) => {
      const next = sorted[i + 1];
      if (next === undefined) {
        return;
      }
      const bottom = system.y + system.height;
      bars.push({ junction: first + i, pageIndex: page.pageIndex, y: bottom, height: Math.max(0, next.y - bottom) });
    });
    n += sorted.length;
    const lastBottom = lastSystem.y + lastSystem.height;
    bars.push({ junction: n, pageIndex: page.pageIndex, y: lastBottom, height: Math.max(0, page.height - lastBottom) });
  }
  return bars;
}

/** Bars of one junction, in the order returned by `computeBars`. */
export function barsOfJunction(bars: readonly Bar[], junction: number): Bar[] {
  return bars.filter((b) => b.junction === junction);
}

/**
 * How a junction is named for the user (ORG-018, ORG-021): the page (1-based) and the bar number on that page (1-based)
 * of the FIRST bar of the junction in `bars` order (for a junction on a page change this is the bottom bar of the earlier page).
 * `bars` must be the output of `computeBars`. A junction without bars gives null.
 */
export function junctionLabel(_bars: readonly Bar[], _junction: number): JunctionLabel | null {
  throw new Error('not implemented');
}
