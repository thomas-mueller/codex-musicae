/**
 * core/detection — detection filter, padding. Requirements: DET-005..DET-011, DET-024.
 */
import { rectArea } from './geometry';
import type { Rect, Size } from './geometry';
import type { DetectedPage } from './model';

export interface DetectionParams {
  /** Rectangles narrower than this fraction of the page width are never systems (step 3). */
  readonly minSystemWidthRatio: number;
  /** Rectangles at least this fraction of the page width are always systems (step 4). */
  readonly fullWidthSystemRatio: number;
}

/**
 * Selects the music-system rectangles of one page from all connected-component rectangles
 * (including the background component, which is the whole page). All values in the same unit as `pageWidth`.
 *
 * Steps:
 *  0. Ignore rectangles with width <= 0 or height <= 0.
 *  1. Drop the single rectangle with the largest area (the first one if several are equal). If nothing remains: [].
 *  2. Let `rest` be the remaining rectangles. Sort their areas ascending. If rest.length >= 2, find the largest gap
 *     between consecutive areas (among equal gaps take the one between the largest areas); threshold = (a[i] + a[i+1]) / 2.
 *     If rest.length < 2 or the largest gap is 0, threshold = 0. `kept` = rectangles with area STRICTLY greater than threshold.
 *  3. Remove from `kept` rectangles with width < minSystemWidthRatio * pageWidth (width equal to the limit stays).
 *  4. Add every rectangle of `rest` with width >= fullWidthSystemRatio * pageWidth (no duplicates).
 *  5. Return the result sorted by y ascending, ties by x ascending. The input is not modified.
 */
export function selectSystemRects(
  rects: readonly Rect[],
  pageWidth: number,
  params: DetectionParams,
): Rect[] {
  const valid = rects.filter((r) => r.width > 0 && r.height > 0);
  const [first] = valid;
  if (first === undefined) {
    return [];
  }
  const largest = valid.reduce((best, r) => (rectArea(r) > rectArea(best) ? r : best), first);
  const largestIndex = valid.indexOf(largest);
  const rest = valid.filter((_, i) => i !== largestIndex);
  if (rest.length === 0) {
    return [];
  }

  let threshold = 0;
  if (rest.length >= 2) {
    const areas = rest.map(rectArea).sort((a, b) => a - b);
    let bestGap = -1;
    let bestThreshold = 0;
    for (let i = 0; i < areas.length - 1; i++) {
      const lower = areas[i];
      const upper = areas[i + 1];
      if (lower === undefined || upper === undefined) {
        continue;
      }
      const gap = upper - lower;
      if (gap >= bestGap) {
        bestGap = gap;
        bestThreshold = (lower + upper) / 2;
      }
    }
    if (bestGap > 0) {
      threshold = bestThreshold;
    }
  }

  return rest
    .filter(
      (r) =>
        (rectArea(r) > threshold && r.width >= params.minSystemWidthRatio * pageWidth) ||
        r.width >= params.fullWidthSystemRatio * pageWidth,
    )
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Vertical gaps between consecutive systems (sorted by y): next.y - (prev.y + prev.height), never below 0. */
export function gapsOnPage(systems: readonly Rect[]): number[] {
  const sorted = [...systems].sort((a, b) => a.y - b.y);
  const gaps: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const prev = sorted[i];
    const next = sorted[i + 1];
    if (prev !== undefined && next !== undefined) {
      gaps.push(Math.max(0, next.y - (prev.y + prev.height)));
    }
  }
  return gaps;
}

/** Median; mean of the two middle values for an even count; null for an empty list. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid];
  const lower = sorted[mid - 1];
  if (upper === undefined) {
    return null;
  }
  return sorted.length % 2 === 1 || lower === undefined ? upper : (lower + upper) / 2;
}

/**
 * Padding per page (same order as `pages`).
 * - Page with >= 1 gap (>= 2 systems): median of its own gaps.
 * - Otherwise: median of ALL gaps of ALL pages pooled together.
 * - If there is no gap anywhere: fallbackPageHeightRatio * that page's height.
 */
export function computePaddings(
  pages: readonly DetectedPage[],
  fallbackPageHeightRatio: number,
): number[] {
  const pooled = median(pages.flatMap((p) => gapsOnPage(p.systems)));
  return pages.map((p) => median(gapsOnPage(p.systems)) ?? pooled ?? fallbackPageHeightRatio * p.height);
}

/** Box expanded by `padding` on all four sides, clamped to [0, page.width] x [0, page.height]. */
export function paddedArea(box: Rect, padding: number, page: Size): Rect {
  const x0 = Math.max(0, box.x - padding);
  const y0 = Math.max(0, box.y - padding);
  const x1 = Math.min(page.width, box.x + box.width + padding);
  const y1 = Math.min(page.height, box.y + box.height + padding);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}
