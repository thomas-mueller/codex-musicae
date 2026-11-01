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

const EPSILON = 1e-9;

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
  plan: SlidePlan,
  systems: readonly SystemGeom[],
  pages: readonly Size[],
): SlideComposition {
  const { width: W, height: H, regions } = plan;
  const stackTop = (H - plan.stackHeight) / 2;
  const onSlide = new Set<number>();
  for (const region of regions) {
    for (let s = region.firstSystem; s <= region.lastSystem; s++) {
      onSlide.add(s);
    }
  }

  const contents: SlideContent[] = [];
  const centerX = (r: Rect): number => r.x + r.width / 2;
  const clipToPage = (desired: Rect, pageIndex: number): Rect | null => {
    const page = pages[pageIndex];
    if (!page) {
      return null;
    }
    const x0 = Math.max(desired.x, 0);
    const y0 = Math.max(desired.y, 0);
    const x1 = Math.min(desired.x + desired.width, page.width);
    const y1 = Math.min(desired.y + desired.height, page.height);
    return x1 - x0 > 0 && y1 - y0 > 0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : null;
  };
  const place = (kind: ContentKind, regionIndex: number, pageIndex: number, desired: Rect, slideY: number): void => {
    const source = clipToPage(desired, pageIndex);
    if (source) {
      const dest = { x: source.x - desired.x, y: slideY + (source.y - desired.y), width: source.width, height: source.height };
      contents.push({ kind, regionIndex, pageIndex, source, dest });
    }
  };

  let y = stackTop;
  regions.forEach((region, k) => {
    const { area } = region;
    place('region', k, region.pageIndex, { x: centerX(area) - W / 2, y: area.y, width: W, height: area.height }, y);
    y += area.height;
  });

  const first = regions[0];
  const last = regions[regions.length - 1];
  if (first && stackTop > EPSILON) {
    const desired = { x: centerX(first.area) - W / 2, y: first.area.y - stackTop, width: W, height: stackTop };
    place('filler-top', 0, first.pageIndex, desired, 0);
  }
  const bottom = stackTop + plan.stackHeight;
  if (last && H - bottom > EPSILON) {
    const desired = { x: centerX(last.area) - W / 2, y: last.area.y + last.area.height, width: W, height: H - bottom };
    place('filler-bottom', regions.length - 1, last.pageIndex, desired, bottom);
  }

  const overlays: Rect[] = [];
  for (const filler of contents.filter((c) => c.kind !== 'region')) {
    const intervals: Array<[number, number]> = [];
    const top = filler.source.y;
    const end = top + filler.source.height;
    for (const system of systems) {
      if (system.pageIndex !== filler.pageIndex || onSlide.has(system.index)) {
        continue;
      }
      const start = Math.max(system.padded.y, top);
      const stop = Math.min(system.padded.y + system.padded.height, end);
      if (stop - start > EPSILON) {
        intervals.push([filler.dest.y + (start - top), filler.dest.y + (stop - top)]);
      }
    }
    intervals.sort((a, b) => a[0] - b[0]);
    let current: [number, number] | null = null;
    for (const interval of intervals) {
      if (current && interval[0] <= current[1]) {
        current[1] = Math.max(current[1], interval[1]);
      } else {
        if (current) {
          overlays.push({ x: 0, y: current[0], width: W, height: current[1] - current[0] });
        }
        current = [interval[0], interval[1]];
      }
    }
    if (current) {
      overlays.push({ x: 0, y: current[0], width: W, height: current[1] - current[0] });
    }
  }
  overlays.sort((a, b) => a.y - b.y);

  return { width: W, height: H, stackTop, contents, overlays };
}
