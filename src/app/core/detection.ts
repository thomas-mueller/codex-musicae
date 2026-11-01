/**
 * core/detection — padding of the detected systems. Requirements: DET-010, DET-011, DET-024.
 */
import type { Rect, Size } from './geometry';
import type { DetectedPage } from './model';

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
