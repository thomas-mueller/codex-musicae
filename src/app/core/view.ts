/**
 * core/view — zoom, pan and page-layout math. Requirements: ORG-003, ORG-004, NAV-013..NAV-015, SLD-018.
 * Units: CSS pixels unless stated otherwise.
 */
import type { Point, Rect, Size } from './geometry';

/** Scale that fits `content` into `viewport`: 'contain' = min(vw/cw, vh/ch); 'width' = vw/cw. */
export function fitScale(_content: Size, _viewport: Size, _mode: 'contain' | 'width'): number {
  return _mode === 'width' ? _viewport.width / _content.width : Math.min(_viewport.width / _content.width, _viewport.height / _content.height);
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
  return { min: Math.min(1, fitScale(_page, _viewport, 'contain') / fitScale(_page, _viewport, 'width')), max: _maxZoom };
}

/** New scroll offset after zooming from oldZoom to newZoom keeping the content point under `anchor` fixed:
 *  ((scroll + anchor) * newZoom / oldZoom) - anchor, per axis. Anchor is relative to the scroll viewport. */
export function scrollAfterZoom(_scroll: Point, _anchor: Point, _oldZoom: number, _newZoom: number): Point {
  const ratio = _newZoom / _oldZoom;
  return { x: (_scroll.x + _anchor.x) * ratio - _anchor.x, y: (_scroll.y + _anchor.y) * ratio - _anchor.y };
}

export interface PageLayout {
  readonly top: number;
  readonly height: number;
  readonly width: number;
}

/** Pages stacked vertically: page i has size pageSizes[i] * scale; top of page 0 is 0; `gap` between pages. */
export function layoutPages(_pageSizes: readonly Size[], _scale: number, _gap: number): PageLayout[] {
  const layout: PageLayout[] = [];
  let top = 0;
  for (const size of _pageSizes) {
    const height = size.height * _scale;
    layout.push({ top, height, width: size.width * _scale });
    top += height + _gap;
  }
  return layout;
}

/**
 * Index of the page "at" vertical offset y (ORG-004): each page owns its extent plus half the gap above and below;
 * y before the first page -> 0; after the last page -> last index; empty layout -> -1.
 * Page i owns [top - gap/2, top + height + gap/2).
 */
export function pageAtOffset(_layout: readonly PageLayout[], _y: number, _gap: number): number {
  if (_layout.length === 0) {
    return -1;
  }
  const index = _layout.findIndex((page) => _y < page.top + page.height + _gap / 2);
  return index === -1 ? _layout.length - 1 : index;
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
  const clampAxis = (pan: number, fitted: number, viewport: number): number => {
    const overflow = fitted * _view.zoom - viewport;
    return overflow <= 0 ? 0 : Math.max(-overflow / 2, Math.min(overflow / 2, pan));
  };
  return { zoom: _view.zoom, panX: clampAxis(_view.panX, _fitted.width, _viewport.width), panY: clampAxis(_view.panY, _fitted.height, _viewport.height) };
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
  const zoom = Math.max(_limits.min, Math.min(_limits.max, _view.zoom * _factor));
  const ux = _anchor.x - _viewport.width / 2;
  const uy = _anchor.y - _viewport.height / 2;
  const ratio = zoom / _view.zoom;
  return clampPan({ zoom, panX: ux - (ux - _view.panX) * ratio, panY: uy - (uy - _view.panY) * ratio }, _fitted, _viewport);
}

// ---------------------------------------------------------------- tiles (NFR-007)

/**
 * Tiles of at most `tileSize` x `tileSize` that cover the `visible` rectangle. Content space (px at the current zoom),
 * tile grid aligned to multiples of `tileSize` from (0, 0). Returns every grid cell whose intersection with `visible`
 * has positive area, each clipped to [0, content.width] x [0, content.height], ordered row by row (y, then x).
 * A visible rectangle that lies outside the content gives [].
 */
export function tilesCovering(_visible: Rect, _content: Size, _tileSize: number): Rect[] {
  const tiles: Rect[] = [];
  const columns = Math.ceil(_content.width / _tileSize);
  const rows = Math.ceil(_content.height / _tileSize);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x0 = column * _tileSize;
      const y0 = row * _tileSize;
      const x1 = Math.min(x0 + _tileSize, _content.width);
      const y1 = Math.min(y0 + _tileSize, _content.height);
      const overlapsX = Math.min(x1, _visible.x + _visible.width) > Math.max(x0, _visible.x);
      const overlapsY = Math.min(y1, _visible.y + _visible.height) > Math.max(y0, _visible.y);
      if (overlapsX && overlapsY) {
        tiles.push({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 });
      }
    }
  }
  return tiles;
}
