import type { InkStroke } from '../core';
import type { ExistingInk } from '../ports/pdf-writer';

/** A stroke that is part of the file, with the reference needed to erase it from there. */
export interface LoadedInk {
  readonly strokeId: string;
  readonly pageIndex: number;
  readonly annotationRef: string;
}

/** Below this opacity a stroke is a highlighter and blends with multiply (SAV-006: the file does not say). */
const OPAQUE = 1;

/**
 * SAV-006, ANN-005: the strokes of the file as model strokes. The id is the annotation name (`/NM`) or, without one, its
 * reference. Strokes without points, on pages the document does not have, or with an id that is already taken stay in the
 * file but are not shown.
 */
export function loadInk(existing: readonly ExistingInk[], pageCount: number): { strokes: InkStroke[]; saved: LoadedInk[] } {
  const strokes: InkStroke[] = [];
  const saved: LoadedInk[] = [];
  const taken = new Set<string>();
  for (const ink of existing) {
    const id = ink.strokeId ?? ink.annotationRef;
    if (ink.points.length === 0 || ink.pageIndex < 0 || ink.pageIndex >= pageCount || taken.has(id)) {
      continue;
    }
    taken.add(id);
    strokes.push({
      id,
      pageIndex: ink.pageIndex,
      points: ink.points,
      color: ink.color,
      widthPt: ink.widthPt,
      opacity: ink.opacity,
      multiply: ink.opacity < OPAQUE,
    });
    saved.push({ strokeId: id, pageIndex: ink.pageIndex, annotationRef: ink.annotationRef });
  }
  return { strokes, saved };
}
