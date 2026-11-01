/**
 * core/system-selection — selection of the music systems among the connected components of a page.
 * Requirements: DET-005..DET-009.
 */
import type { Rect, Size } from './geometry';

/** A connected component of the binarized page: bounding rectangle and pixel count, in bitmap pixels. */
export interface ConnectedComponent {
  readonly rect: Rect;
  /** Number of pixels of the component (`CC_STAT_AREA`), not the area of its bounding rectangle. */
  readonly area: number;
}

export interface SelectionParams {
  /** Components narrower than this fraction of the page width are never systems. */
  readonly minSystemWidthRatio: number;
  /** Components at least this fraction of the page width are always systems. */
  readonly fullWidthSystemRatio: number;
}

/**
 * The area threshold: areas sorted descending, the first largest gap between consecutive areas decides (a later equal gap
 * does not replace it) and the threshold is the smaller area after that gap. One component gives 0, none gives 0.
 */
export function areaThreshold(areas: readonly number[]): number {
  const sorted = [...areas].sort((a, b) => b - a);
  if (sorted.length <= 1) {
    return 0;
  }
  let largestGap = -1;
  let largestGapIndex = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = (sorted[i] ?? 0) - (sorted[i + 1] ?? 0);
    if (gap > largestGap) {
      largestGap = gap;
      largestGapIndex = i + 1;
    }
  }
  return sorted[largestGapIndex] ?? 0;
}

/** Too narrow is rejected first, then wide enough is always taken, else the area decides. */
export function shouldSelectComponent(area: number, width: number, canvasWidth: number, threshold: number, params: SelectionParams): boolean {
  const widthRatio = width / canvasWidth;
  if (widthRatio < params.minSystemWidthRatio) {
    return false;
  }
  return widthRatio >= params.fullWidthSystemRatio || area > threshold;
}

/**
 * The systems of one page in page display space, sorted top to bottom (ties left to right). `components` are the connected
 * components WITHOUT the background, in bitmap pixels; `bitmap` is the size of the bitmap they come from and `page` the
 * size of the page in display points. Boxes are normalized by the bitmap size.
 */
export function selectSystems(components: readonly ConnectedComponent[], bitmap: Size, page: Size, params: SelectionParams): Rect[] {
  if (components.length === 0) {
    return [];
  }
  const threshold = areaThreshold(components.map((c) => c.area));
  return components
    .filter((c) => shouldSelectComponent(c.area, c.rect.width, bitmap.width, threshold, params))
    .map((c) => ({
      x: (c.rect.x * page.width) / bitmap.width,
      y: (c.rect.y * page.height) / bitmap.height,
      width: (c.rect.width * page.width) / bitmap.width,
      height: (c.rect.height * page.height) / bitmap.height,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}
