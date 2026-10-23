/**
 * core/view — zoom, pan and page-layout math. Requirements: ORG-003, ORG-004, NAV-013..NAV-015, SLD-018.
 * Units: CSS pixels unless stated otherwise.
 */
import type { Point, Rect, Size } from './geometry';

/** Scale that fits `content` into `viewport`: 'contain' = min(vw/cw, vh/ch); 'width' = vw/cw. */
export function fitScale(_content: Size, _viewport: Size, _mode: 'contain' | 'width'): number {
  throw new Error('not implemented');
}

export interface ZoomLimits {
  readonly min: number;
  readonly max: number;
}

/**
 * Organization mode (ORG-003): zoom is relative to the fit-width scale.
 * min = min(1, fitScale(page,'contain') / fitScale(page,'width')) (fit-page), max = maxZoom.
 */
export function orgZoomLimits(_page: Size, _viewport: Size, _maxZoom: number): ZoomLimits {
  throw new Error('not implemented');
}

/** New scroll offset after zooming from oldZoom to newZoom keeping the content point under `anchor` fixed:
 *  ((scroll + anchor) * newZoom / oldZoom) - anchor, per axis. Anchor is relative to the scroll viewport. */
export function scrollAfterZoom(_scroll: Point, _anchor: Point, _oldZoom: number, _newZoom: number): Point {
  throw new Error('not implemented');
}

export interface PageLayout {
  readonly top: number;
  readonly height: number;
  readonly width: number;
}

/** Pages stacked vertically: page i has size pageSizes[i] * scale; top of page 0 is 0; `gap` between pages. */
export function layoutPages(_pageSizes: readonly Size[], _scale: number, _gap: number): PageLayout[] {
  throw new Error('not implemented');
}

/**
 * Index of the page "at" vertical offset y (ORG-004): each page owns its extent plus half the gap above and below;
 * y before the first page -> 0; after the last page -> last index; empty layout -> -1.
 * Page i owns [top - gap/2, top + height + gap/2).
 */
export function pageAtOffset(_layout: readonly PageLayout[], _y: number, _gap: number): number {
  throw new Error('not implemented');
}

// ---------------------------------------------------------------- slide view (annotation mode)

/** Content-to-screen mapping: screen = viewportCenter + (p - contentCenter) * fitScale * zoom + pan. */
export interface ViewState {
  readonly zoom: number;
  readonly panX: number;
  readonly panY: number;
}

export const FIT_VIEW: ViewState = { zoom: 1, panX: 0, panY: 0 };

/**
 * `fitted` = content size in px at zoom 1. Per axis: size = fitted * zoom; if size <= viewport the pan is 0;
 * otherwise pan is clamped to [-(size - viewport)/2, +(size - viewport)/2].
 */
export function clampPan(_view: ViewState, _fitted: Size, _viewport: Size): ViewState {
  throw new Error('not implemented');
}

/**
 * Zoom by `factor` around `anchor` (viewport px). zoom' = clamp(zoom * factor, min, max);
 * u = anchor - viewportCenter; pan' = u - (u - pan) * zoom' / zoom (per axis); then clampPan.
 */
export function zoomAround(
  _view: ViewState,
  _factor: number,
  _anchor: Point,
  _limits: ZoomLimits,
  _fitted: Size,
  _viewport: Size,
): ViewState {
  throw new Error('not implemented');
}

// ---------------------------------------------------------------- tiles (NFR-007)

/**
 * Tiles of at most `tileSize` x `tileSize` that cover the `visible` rectangle. Content space (px at the current zoom),
 * tile grid aligned to multiples of `tileSize` from (0, 0). Returns every grid cell whose intersection with `visible`
 * has positive area, each clipped to [0, content.width] x [0, content.height], ordered row by row (y, then x).
 * A visible rectangle that lies outside the content gives [].
 */
export function tilesCovering(_visible: Rect, _content: Size, _tileSize: number): Rect[] {
  throw new Error('not implemented');
}
