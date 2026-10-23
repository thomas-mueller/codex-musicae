/**
 * core/composition — layout of one slide (what page content goes where). Requirements: SLD-007, SLD-008, SLD-009, SLD-010.
 * Slide space: PDF units, origin top-left of the slide, size plan.width x plan.height. Page content is never scaled here;
 * the renderer applies the display scale. Fitting the slide into the screen (contain) and the grey around it is the
 * renderer's job (SLD-010); regions without page content simply stay empty (canvas grey).
 */
import type { Rect, Size } from './geometry';
import type { SlidePlan, SystemGeom } from './slides';

export type ContentKind = 'region' | 'filler-top' | 'filler-bottom';

export interface SlideContent {
  readonly kind: ContentKind;
  /** Index into plan.regions: the region itself; for 'filler-top' always 0; for 'filler-bottom' the last region. */
  readonly regionIndex: number;
  readonly pageIndex: number;
  /** Part of the page to draw, display space, always inside the page bounds. */
  readonly source: Rect;
  /** Position on the slide; same width and height as `source` (no scaling). */
  readonly dest: Rect;
}

export interface SlideComposition {
  readonly width: number;
  readonly height: number;
  /** (height - stackHeight) / 2: the top of the first region. */
  readonly stackTop: number;
  /** Order: regions top to bottom, then filler-top, then filler-bottom (only those that are not empty). */
  readonly contents: readonly SlideContent[];
  /** Dimming overlays: x = 0, width = plan.width, sorted by y, non-overlapping. */
  readonly overlays: readonly Rect[];
}

/**
 * Algorithm (W = plan.width, H = plan.height, EPS = 1e-9):
 *  stackTop = (H - plan.stackHeight) / 2;  y = stackTop
 *  onSlide  = set of system indices firstSystem..lastSystem of all regions
 *  For region k (cx = area.x + area.width / 2):
 *     desired = (cx - W/2, area.y, W, area.height);  source = desired ∩ page rect (0, 0, page.width, page.height)
 *     if source is non-empty: dest = (source.x - desired.x, y + (source.y - desired.y), source.width, source.height)
 *     y += area.height
 *  filler-top (if stackTop > EPS), first region r0: desired = (cx0 - W/2, r0.area.y - stackTop, W, stackTop);
 *     source = desired ∩ page; dest = (source.x - desired.x, source.y - desired.y, ...)   (the filler starts at slide y = 0)
 *  filler-bottom (if H - (stackTop + stackHeight) > EPS), last region rl: top = stackTop + stackHeight;
 *     desired = (cxl - W/2, rl.area.y + rl.area.height, W, H - top);  source = desired ∩ page;
 *     dest = (source.x - desired.x, top + (source.y - desired.y), ...)
 *  Overlays, for each filler content with a non-empty source: for every system S on the filler's page that is NOT in onSlide,
 *     take the vertical interval of S.padded intersected with [source.y, source.y + source.height]; keep it if its length > EPS;
 *     map to slide space (dest.y + (start - source.y)); merge intervals that overlap or touch; emit Rect(0, y, W, length).
 *  Finally sort all overlays by y (fillers do not overlap each other, so no merging across them is needed).
 */
export function composeSlide(
  _plan: SlidePlan,
  _systems: readonly SystemGeom[],
  _pages: readonly Size[],
): SlideComposition {
  throw new Error('not implemented');
}
