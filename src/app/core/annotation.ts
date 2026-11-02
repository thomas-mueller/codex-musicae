/**
 * core/annotation — stroke model, path simplification, hit testing, slide<->page mapping, undo/redo.
 * Requirements: ANN-005, ANN-006, ANN-009, ANN-010, ANN-011, ANN-012, SAV-007.
 * Strokes are stored in PDF USER SPACE of their page (SAV-007). Slide space and page display space are defined in
 * composition.ts / geometry.ts.
 */
import { displayToUser, userToDisplay } from './geometry';
import type { PageBox, Point, Rect } from './geometry';
import type { SlideComposition } from './composition';

/** Placements of the same page closer than this (per axis) are one placement. */
const PLACEMENT_EPSILON = 1e-6;

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
export function simplifyPath(points: readonly Point[], epsilon: number): Point[] {
  const n = points.length;
  if (n <= 2) {
    return points.map((q) => ({ x: q.x, y: q.y }));
  }
  const keep = new Array<boolean>(n).fill(false);
  keep[0] = true;
  keep[n - 1] = true;
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    const a = points[first] as Point;
    const b = points[last] as Point;
    let worst = -1;
    let worstDistance = epsilon;
    for (let i = first + 1; i < last; i++) {
      const d = distanceToSegment(points[i] as Point, a, b);
      if (d > worstDistance) {
        worstDistance = d;
        worst = i;
      }
    }
    if (worst >= 0) {
      keep[worst] = true;
      stack.push([first, worst], [worst, last]);
    }
  }
  return points.filter((_, i) => keep[i]).map((q) => ({ x: q.x, y: q.y }));
}

/** Smallest distance from `p` to the polyline through `points` (to each segment, not the infinite line). One point: distance to it. Empty: Infinity. */
export function distanceToPolyline(p: Point, points: readonly Point[]): number {
  const first = points[0];
  if (first === undefined) {
    return Infinity;
  }
  if (points.length === 1) {
    return Math.hypot(p.x - first.x, p.y - first.y);
  }
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    best = Math.min(best, distanceToSegment(p, points[i - 1] as Point, points[i] as Point));
  }
  return best;
}

/** ANN-005: true if distanceToPolyline(p, stroke.points) <= radiusPt + stroke.widthPt / 2. */
export function strokeHit(stroke: InkStroke, p: Point, radiusPt: number): boolean {
  return distanceToPolyline(p, stroke.points) <= radiusPt + stroke.widthPt / 2;
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
export function inkTransforms(composition: SlideComposition): InkTransform[] {
  return distinctPlacements(composition.contents.map((c) => placementOf(c)));
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
export function startOwner(composition: SlideComposition, p: Point): StrokeOwner | null {
  const contents = composition.contents;
  for (let contentIndex = 0; contentIndex < contents.length; contentIndex++) {
    const content = contents[contentIndex] as SlideComposition['contents'][number];
    if (contains(content.dest, p)) {
      return { ...placementOf(content), contentIndex };
    }
  }
  return null;
}

/**
 * All distinct placements (see inkTransforms) whose content dest rectangle contains slide point `p` (used by the eraser:
 * a point may lie on several placements of the same or of different pages). Order of first occurrence.
 */
export function placementsAt(composition: SlideComposition, p: Point): InkTransform[] {
  return distinctPlacements(composition.contents.filter((c) => contains(c.dest, p)).map((c) => placementOf(c)));
}

/**
 * Slide point -> PDF user space of the owner's page, using the owner's translation for EVERY point (also points that lie
 * over other regions or outside the page): displayToUser({ x: p.x - owner.dx, y: p.y - owner.dy }, box).
 */
export function slidePointToUser(owner: InkTransform, box: PageBox, p: Point): Point {
  return displayToUser({ x: p.x - owner.dx, y: p.y - owner.dy }, box);
}

/** PDF user space -> slide space for one placement: userToDisplay(p, box) + (dx, dy). */
export function userPointToSlide(placement: InkTransform, box: PageBox, p: Point): Point {
  const d = userToDisplay(p, box);
  return { x: d.x + placement.dx, y: d.y + placement.dy };
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
export function pushAction(state: UndoState, action: UndoAction, depth: number): UndoState {
  return { undo: [...state.undo, action].slice(Math.max(0, state.undo.length + 1 - Math.max(0, depth))), redo: [] };
}

/** Pops the newest undo action onto `redo`. Empty undo: same state and action null. */
export function undoStep(state: UndoState): { state: UndoState; action: UndoAction | null } {
  const action = state.undo[state.undo.length - 1];
  if (action === undefined) {
    return { state, action: null };
  }
  return { state: { undo: state.undo.slice(0, -1), redo: [...state.redo, action] }, action };
}

/** Pops the newest redo action back onto `undo`. Empty redo: same state and action null. */
export function redoStep(state: UndoState): { state: UndoState; action: UndoAction | null } {
  const action = state.redo[state.redo.length - 1];
  if (action === undefined) {
    return { state, action: null };
  }
  return { state: { undo: [...state.undo, action], redo: state.redo.slice(0, -1) }, action };
}

/**
 * Applies the effect of an action to a stroke list (in order, new strokes appended at the end):
 *  direction 'redo' (do again): add -> append the stroke; erase -> remove the listed strokes (by id).
 *  direction 'undo' (revert):   add -> remove the stroke (by id); erase -> append the listed strokes in their listed order.
 * Removing an id that is not present, or adding one that already exists (same id), changes nothing for that stroke.
 */
export function applyAction(
  strokes: readonly InkStroke[],
  action: UndoAction,
  direction: 'undo' | 'redo',
): InkStroke[] {
  const appends = (action.kind === 'add') === (direction === 'redo');
  const listed = action.kind === 'add' ? [action.stroke] : action.strokes;
  if (!appends) {
    const ids = new Set(listed.map((q) => q.id));
    return strokes.filter((q) => !ids.has(q.id));
  }
  const result = [...strokes];
  const present = new Set(result.map((q) => q.id));
  for (const stroke of listed) {
    if (!present.has(stroke.id)) {
      present.add(stroke.id);
      result.push(stroke);
    }
  }
  return result;
}

// ---------------------------------------------------------------- helpers

type Content = SlideComposition['contents'][number];

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  const t = Math.min(1, Math.max(0, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSquared));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function placementOf(content: Content): InkTransform {
  return { pageIndex: content.pageIndex, dx: content.dest.x - content.source.x, dy: content.dest.y - content.source.y };
}

function contains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;
}

function distinctPlacements(all: readonly InkTransform[]): InkTransform[] {
  const result: InkTransform[] = [];
  for (const t of all) {
    const known = result.some(
      (k) =>
        k.pageIndex === t.pageIndex &&
        Math.abs(k.dx - t.dx) <= PLACEMENT_EPSILON &&
        Math.abs(k.dy - t.dy) <= PLACEMENT_EPSILON,
    );
    if (!known) {
      result.push(t);
    }
  }
  return result;
}
