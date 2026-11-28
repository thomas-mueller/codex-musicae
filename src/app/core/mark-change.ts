/**
 * core/mark-change — what one edit did to the marks, so that it can be undone and redone.
 * Requirements: ANN-015, ANN-017, MRK-013.
 *
 * A change lists the marks an edit removed and the marks it added; an altered or renumbered mark is in both lists. This covers
 * every edit alike: add, delete, retarget, toggle, a replaced start mark and the renumbering after a system deletion.
 * All functions return new objects; inputs are never mutated.
 */
import { isCrossFile, printOrder } from './marks';
import type { BookmarkMark, JumpMark, PointMark, SystemMarks, SystemRef } from './marks';

type ListedMark =
  | { readonly kind: 'jump'; readonly mark: JumpMark }
  | { readonly kind: 'bookmark'; readonly mark: BookmarkMark }
  | { readonly kind: 'start' | 'stop' | 'break'; readonly mark: PointMark };

export interface MarkChange {
  readonly removed: readonly ListedMark[];
  readonly added: readonly ListedMark[];
}

/** One history step on the marks. */
export interface MarkStep {
  readonly change: MarkChange;
  /** The pages (0-based) whose system numbers the step relies on. */
  readonly pages: readonly number[];
}

/** What the edit from `before` to `after` removed and added, or null when no mark differs. The next ids do not count. */
export function markChange(before: SystemMarks, after: SystemMarks): MarkChange | null {
  const earlier = listMarks(before);
  const later = listMarks(after);
  const removed = missingFrom(earlier, later);
  const added = missingFrom(later, earlier);
  return removed.length === 0 && added.length === 0 ? null : { removed, added };
}

/**
 * 'redo' does the edit (also the first time): the removed marks go, the added ones come. 'undo' is the reverse.
 * A returning jump or bookmark goes before the first one with a larger id (creation order, PLY-006); the others keep their
 * places. Stops and breaks stay in print order. The next ids never go back, so ids are never reused.
 */
export function applyMarkChange(marks: SystemMarks, change: MarkChange, direction: 'undo' | 'redo'): SystemMarks {
  const [going, coming] = direction === 'redo' ? [change.removed, change.added] : [change.added, change.removed];
  const gone = new Set([...going, ...coming].map(keyOf));
  const jumps = marks.jumps.filter((mark) => !gone.has(keyOf({ kind: 'jump', mark })));
  const bookmarks = marks.bookmarks.filter((mark) => !gone.has(keyOf({ kind: 'bookmark', mark })));
  const stops = marks.stops.filter((mark) => !gone.has(keyOf({ kind: 'stop', mark })));
  const breaks = marks.breaks.filter((mark) => !gone.has(keyOf({ kind: 'break', mark })));
  let start = gone.has('start') ? null : marks.start;
  let { nextJumpId, nextBookmarkId } = marks;
  for (const entry of coming) {
    switch (entry.kind) {
      case 'jump':
        insertById(jumps, entry.mark);
        nextJumpId = Math.max(nextJumpId, entry.mark.id + 1);
        break;
      case 'bookmark':
        insertById(bookmarks, entry.mark);
        nextBookmarkId = Math.max(nextBookmarkId, entry.mark.id + 1);
        break;
      case 'stop':
        stops.push(entry.mark);
        break;
      case 'break':
        breaks.push(entry.mark);
        break;
      case 'start':
        start = entry.mark;
        break;
    }
  }
  return { jumps, bookmarks, stops: stops.sort(printOrder), breaks: breaks.sort(printOrder), start, nextJumpId, nextBookmarkId };
}

/** The pages of this file that the marks of a change point at, ascending. */
export function pagesOfChange(change: MarkChange): number[] {
  const pages = [...change.removed, ...change.added].flatMap(localRefs).map((ref) => ref.pageIndex);
  return [...new Set(pages)].sort((a, b) => a - b);
}

/**
 * The steps that must not survive when the systems of `changedPages` change: every step that relies on one of those pages,
 * and, until no more are found, every step on the same jump, bookmark, stop, break or start mark as one of them (no half
 * restores).
 */
export function staleSteps<T extends MarkStep>(steps: readonly T[], changedPages: ReadonlySet<number>): ReadonlySet<T> {
  const stale = new Set<T>(steps.filter((step) => step.pages.some((page) => changedPages.has(page))));
  const keys = new Set([...stale].flatMap(stepKeys));
  let found = stale.size > 0;
  while (found) {
    found = false;
    for (const step of steps) {
      if (!stale.has(step) && stepKeys(step).some((key) => keys.has(key))) {
        stale.add(step);
        stepKeys(step).forEach((key) => keys.add(key));
        found = true;
      }
    }
  }
  return stale;
}

function stepKeys(step: MarkStep): string[] {
  return [...step.change.removed, ...step.change.added].map(keyOf);
}

/** The identity of a mark: the id of a jump or bookmark, the system of a stop or break; there is one start mark. */
function keyOf(entry: ListedMark): string {
  switch (entry.kind) {
    case 'jump':
    case 'bookmark':
      return `${entry.kind}:${entry.mark.id}`;
    case 'stop':
    case 'break':
      return `${entry.kind}:${entry.mark.at.pageIndex}:${entry.mark.at.system}`;
    case 'start':
      return entry.kind;
  }
}

function listMarks(marks: SystemMarks): ListedMark[] {
  return [
    ...marks.jumps.map((mark) => ({ kind: 'jump' as const, mark })),
    ...marks.bookmarks.map((mark) => ({ kind: 'bookmark' as const, mark })),
    ...marks.stops.map((mark) => ({ kind: 'stop' as const, mark })),
    ...marks.breaks.map((mark) => ({ kind: 'break' as const, mark })),
    ...(marks.start === null ? [] : [{ kind: 'start' as const, mark: marks.start }]),
  ];
}

/** The entries of `list` that `other` does not hold with the same content. */
function missingFrom(list: readonly ListedMark[], other: readonly ListedMark[]): ListedMark[] {
  const byKey = new Map(other.map((entry) => [keyOf(entry), entry.mark]));
  return list.filter((entry) => !sameValue(entry.mark, byKey.get(keyOf(entry))));
}

/** Structural equality of the plain data of a mark; the order of the keys does not matter. */
function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return a === b;
  }
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => sameValue((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]))
  );
}

function localRefs(entry: ListedMark): SystemRef[] {
  switch (entry.kind) {
    case 'jump':
      return isCrossFile(entry.mark.to) ? [entry.mark.from] : [entry.mark.from, entry.mark.to];
    default:
      return [entry.mark.at];
  }
}

function insertById<T extends { readonly id: number }>(list: T[], mark: T): void {
  const at = list.findIndex((other) => other.id > mark.id);
  list.splice(at === -1 ? list.length : at, 0, mark);
}
