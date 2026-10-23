/**
 * core/annotation — stroke model, path simplification, hit testing, slide<->page mapping, undo/redo.
 * Requirements: ANN-005, ANN-006, ANN-009, ANN-010, ANN-011, ANN-012, SAV-007.
 * Strokes are stored in PDF USER SPACE of their page (SAV-007). Slide space and page display space are defined in
 * composition.ts / geometry.ts.
 */
import type { PageBox, Point } from './geometry';
import type { SlideComposition } from './composition';

export interface InkStroke {
  readonly id: string;
  readonly pageIndex: number;
  /** PDF user space of page `pageIndex`; may lie outside the page (ANN-009). */
  readonly points: readonly Point[];
  readonly color: string; // '#RRGGBB'
  readonly widthPt: number;
  readonly opacity: number; // 0..1
  readonly multiply: boolean; // highlighter blend
}

/**
 * Ramer–Douglas–Peucker. Keeps the first and last point; a point between two kept points is kept (recursively) when its
 * perpendicular distance to the segment of its neighbors is STRICTLY greater than `epsilon`.
 * [] -> []; one point -> that point; two points -> both. Order is preserved; the input is not modified.
 * (Distance to the segment, not to the infinite line; degenerate segment where both ends coincide: distance to that point.)
 */
export function simplifyPath(_points: readonly Point[], _epsilon: number): Point[] {
  throw new Error('not implemented');
}

/** Smallest distance from `p` to the polyline through `points` (to each segment, not the infinite line). One point: distance to it. Empty: Infinity. */
export function distanceToPolyline(_p: Point, _points: readonly Point[]): number {
  throw new Error('not implemented');
}

/** ANN-005: true if distanceToPolyline(p, stroke.points) <= radiusPt + stroke.widthPt / 2. */
export function strokeHit(_stroke: InkStroke, _p: Point, _radiusPt: number): boolean {
  throw new Error('not implemented');
}

/** A page's content placement on a slide: translation from page display space to slide space. */
export interface InkTransform {
  readonly pageIndex: number;
  readonly dx: number;
  readonly dy: number;
}

/**
 * Distinct placements of page content on the slide (ANN-012): for every composition content, (dest.x - source.x, dest.y - source.y)
 * with its page; entries with the same pageIndex whose dx and dy differ by at most 1e-6 are one placement.
 * Order: first occurrence in `contents`.
 */
export function inkTransforms(_composition: SlideComposition): InkTransform[] {
  throw new Error('not implemented');
}

export interface StrokeOwner extends InkTransform {
  /** Index into composition.contents. */
  readonly contentIndex: number;
}

/**
 * ANN-009/ANN-010: the content that owns a stroke starting at slide point `p`: the FIRST entry of composition.contents
 * (order: regions, filler-top, filler-bottom) whose dest rectangle contains p (x in [dest.x, dest.x + width), y likewise).
 * null if no content contains p (a stroke started on canvas grey is ignored).
 */
export function startOwner(_composition: SlideComposition, _p: Point): StrokeOwner | null {
  throw new Error('not implemented');
}

/**
 * All distinct placements (see inkTransforms) whose content dest rectangle contains slide point `p` (used by the eraser:
 * a point may lie on several placements of the same or of different pages). Order of first occurrence.
 */
export function placementsAt(_composition: SlideComposition, _p: Point): InkTransform[] {
  throw new Error('not implemented');
}

/**
 * Slide point -> PDF user space of the owner's page, using the owner's translation for EVERY point (also points that lie
 * over other regions or outside the page): displayToUser({ x: p.x - owner.dx, y: p.y - owner.dy }, box).
 */
export function slidePointToUser(_owner: InkTransform, _box: PageBox, _p: Point): Point {
  throw new Error('not implemented');
}

/** PDF user space -> slide space for one placement: userToDisplay(p, box) + (dx, dy). */
export function userPointToSlide(_placement: InkTransform, _box: PageBox, _p: Point): Point {
  throw new Error('not implemented');
}

// ---------------------------------------------------------------- undo / redo (ANN-006)

export type UndoAction =
  | { readonly kind: 'add'; readonly stroke: InkStroke }
  | { readonly kind: 'erase'; readonly strokes: readonly InkStroke[] };

export interface UndoState {
  /** Oldest first. */
  readonly undo: readonly UndoAction[];
  readonly redo: readonly UndoAction[];
}

export const EMPTY_UNDO: UndoState = { undo: [], redo: [] };

/** Appends to `undo`, clears `redo`, and drops the OLDEST entries so that undo.length <= depth. */
export function pushAction(_state: UndoState, _action: UndoAction, _depth: number): UndoState {
  throw new Error('not implemented');
}

/** Pops the newest undo action onto `redo`. Empty undo: same state and action null. */
export function undoStep(_state: UndoState): { state: UndoState; action: UndoAction | null } {
  throw new Error('not implemented');
}

/** Pops the newest redo action back onto `undo`. Empty redo: same state and action null. */
export function redoStep(_state: UndoState): { state: UndoState; action: UndoAction | null } {
  throw new Error('not implemented');
}

/**
 * Applies the effect of an action to a stroke list (in order, new strokes appended at the end):
 *  direction 'redo' (do again): add -> append the stroke; erase -> remove the listed strokes (by id).
 *  direction 'undo' (revert):   add -> remove the stroke (by id); erase -> append the listed strokes in their listed order.
 * Removing an id that is not present, or adding one that already exists (same id), changes nothing for that stroke.
 */
export function applyAction(
  _strokes: readonly InkStroke[],
  _action: UndoAction,
  _direction: 'undo' | 'redo',
): InkStroke[] {
  throw new Error('not implemented');
}
