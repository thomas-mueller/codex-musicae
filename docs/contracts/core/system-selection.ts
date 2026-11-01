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
export function areaThreshold(_areas: readonly number[]): number {
  throw new Error('not implemented');
}

/** Too narrow (width / canvasWidth < minSystemWidthRatio) is rejected first, then wide enough (>= fullWidthSystemRatio) is always taken, else `area > threshold` decides. */
export function shouldSelectComponent(
  _area: number,
  _width: number,
  _canvasWidth: number,
  _threshold: number,
  _params: SelectionParams,
): boolean {
  throw new Error('not implemented');
}

/**
 * The systems of one page in page display space, sorted top to bottom (ties left to right). `components` are the connected
 * components WITHOUT the background, in bitmap pixels; `bitmap` is the size of the bitmap they come from and `page` the
 * size of the page in display points. Boxes are normalized by the bitmap size. The input is not modified.
 */
export function selectSystems(
  _components: readonly ConnectedComponent[],
  _bitmap: Size,
  _page: Size,
  _params: SelectionParams,
): Rect[] {
  throw new Error('not implemented');
}
