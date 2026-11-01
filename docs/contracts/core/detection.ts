/**
 * core/detection — padding of the detected systems. Requirements: DET-010, DET-011, DET-024.
 */
import type { Rect, Size } from './geometry';
import type { DetectedPage } from './model';

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
