/**
 * core/detection — detection filter, padding. Requirements: DET-005..DET-011, DET-024.
 */
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
  _rects: readonly Rect[],
  _pageWidth: number,
  _params: DetectionParams,
): Rect[] {
  throw new Error('not implemented');
}

/** Vertical gaps between consecutive systems (sorted by y): next.y - (prev.y + prev.height), never below 0. */
export function gapsOnPage(_systems: readonly Rect[]): number[] {
  throw new Error('not implemented');
}

/** Median; mean of the two middle values for an even count; null for an empty list. */
export function median(_values: readonly number[]): number | null {
  throw new Error('not implemented');
}

/**
 * Padding per page (same order as `pages`).
 * - Page with >= 1 gap (>= 2 systems): median of its own gaps.
 * - Otherwise: median of ALL gaps of ALL pages pooled together.
 * - If there is no gap anywhere: fallbackPageHeightRatio * that page's height.
 */
export function computePaddings(
  _pages: readonly DetectedPage[],
  _fallbackPageHeightRatio: number,
): number[] {
  throw new Error('not implemented');
}

/** Box expanded by `padding` on all four sides, clamped to [0, page.width] x [0, page.height]. */
export function paddedArea(_box: Rect, _padding: number, _page: Size): Rect {
  throw new Error('not implemented');
}
