/**
 * core/ink-placement — where the ink of the current slide goes. Requirements: ANN-005, ANN-012, SAV-007.
 * Strokes are stored in PDF user space of their page; a slide shows page content translated into slide space, possibly
 * the same page content more than once (repeated systems). Every placement draws the strokes of its page.
 */
import { inkTransforms, userPointToSlide } from './annotation';
import type { InkStroke } from './annotation';
import type { SlideComposition } from './composition';
import type { PageBox, Point, Rect } from './geometry';

export interface PlacedStroke {
  readonly stroke: InkStroke;
  /** Slide space, same order as `stroke.points`. */
  readonly points: readonly Point[];
  /** Bounding box of the points, grown by half the stroke width. */
  readonly bounds: Rect;
}

/**
 * For each placement of `inkTransforms(composition)` (in that order) and each stroke of the placement's page (in the
 * order given): the stroke mapped to slide space. A stroke is left out of a placement when its bounds do not touch the
 * slide rectangle (this also drops ink that belongs to another part of the same page). A stroke whose page has no box is skipped.
 */
export function placeStrokes(
  composition: SlideComposition,
  strokesOfPage: (pageIndex: number) => readonly InkStroke[],
  boxOfPage: (pageIndex: number) => PageBox | undefined,
): PlacedStroke[] {
  const placed: PlacedStroke[] = [];
  for (const placement of inkTransforms(composition)) {
    const box = boxOfPage(placement.pageIndex);
    if (!box) {
      continue;
    }
    for (const stroke of strokesOfPage(placement.pageIndex)) {
      const points = stroke.points.map((p) => userPointToSlide(placement, box, p));
      const bounds = boundsOf(points, stroke.widthPt / 2);
      if (touches(bounds, composition.width, composition.height)) {
        placed.push({ stroke, points, bounds });
      }
    }
  }
  return placed;
}

function boundsOf(points: readonly Point[], margin: number): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { x: minX - margin, y: minY - margin, width: maxX - minX + 2 * margin, height: maxY - minY + 2 * margin };
}

function touches(bounds: Rect, width: number, height: number): boolean {
  return bounds.x <= width && bounds.x + bounds.width >= 0 && bounds.y <= height && bounds.y + bounds.height >= 0;
}
