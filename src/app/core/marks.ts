/**
 * core/marks — data model v2: marks on system sides, their edits and the deletion rules.
 * Requirements: MRK-001..MRK-008, MRK-012..MRK-015.
 *
 * A mark is stored on one system. The side follows from the kind of mark (MRK-001):
 *   left side (start of the system):  start, jump target (`JumpMark.to`), bookmark (`BookmarkMark.at`)
 *   right side (end of the system):   jump start (`JumpMark.from`), stop, slide break
 * A system of this file is addressed by its page and its number on that page, so an edit of one page never moves the marks
 * of another page. `pageSystemCounts[pageIndex]` is the number of systems of that page and describes the layout of a file;
 * the global print index of a system is the number of systems on all earlier pages plus its number on its page.
 *
 * All functions return new objects; inputs are never mutated.
 */

/** A system of this file. */
export interface SystemRef {
  /** 0-based. */
  readonly pageIndex: number;
  /** 1-based number among the systems of its page ("system on page"). */
  readonly system: number;
}

/** A system of another file (cross-file reference, MRK-012). The file name is the only file identity. */
export interface FileRef extends SystemRef {
  readonly file: string;
}

/** One jump: the jump start (`from`, right side) and its jump target (`to`, left side). A reference with `file` is cross-file. */
export interface JumpMark {
  /** Stable id (1, 2, 3, ...) that never changes and is never reused within a document. */
  readonly id: number;
  readonly from: SystemRef;
  readonly to: SystemRef | FileRef;
  /** Integer >= 1. */
  readonly pass: number;
  /** Optional user text (MRK-011); one per jump. The key is absent when there is no text. */
  readonly text?: string;
}

/** A bookmark on a system of this file; it may point to a system of another file. */
export interface BookmarkMark {
  /** Stable id, counted separately from the jump ids. */
  readonly id: number;
  readonly at: SystemRef;
  readonly ref?: FileRef;
  readonly text?: string;
}

/** A start mark, stop or slide break. */
export interface PointMark {
  readonly at: SystemRef;
  readonly text?: string;
}

export interface SystemMarks {
  /** In creation order (PLY-006: the earlier one wins on equal start system and pass). */
  readonly jumps: readonly JumpMark[];
  /** In creation order. */
  readonly bookmarks: readonly BookmarkMark[];
  /** At most one per system, in print order. */
  readonly stops: readonly PointMark[];
  /** At most one per system, in print order. */
  readonly breaks: readonly PointMark[];
  /** At most one per file (MRK-006). */
  readonly start: PointMark | null;
  readonly nextJumpId: number;
  readonly nextBookmarkId: number;
}

export const EMPTY_SYSTEM_MARKS: SystemMarks = {
  jumps: [],
  bookmarks: [],
  stops: [],
  breaks: [],
  start: null,
  nextJumpId: 1,
  nextBookmarkId: 1,
};

export type NewMark =
  | { readonly kind: 'jump'; readonly from: SystemRef; readonly to: SystemRef | FileRef; readonly pass: number; readonly text?: string }
  | { readonly kind: 'bookmark'; readonly at: SystemRef; readonly ref?: FileRef; readonly text?: string }
  | { readonly kind: 'start' | 'stop' | 'break'; readonly at: SystemRef; readonly text?: string };

/** A reference with a file name points into another file (MRK-012). */
export function isCrossFile(ref: SystemRef | FileRef): ref is FileRef {
  return 'file' in ref;
}

/** The 1-based print index of a system of this file, or null when the layout has no such system. */
export function printIndex(ref: SystemRef, pageSystemCounts: readonly number[]): number | null {
  const { pageIndex, system } = ref;
  const count = Number.isInteger(pageIndex) ? pageSystemCounts[pageIndex] : undefined;
  if (count === undefined || !Number.isInteger(system) || system < 1 || system > count) {
    return null;
  }
  return pageSystemCounts.slice(0, pageIndex).reduce((sum, n) => sum + n, system);
}

/** The system with this 1-based print index, or null when the layout has none (the inverse of `printIndex`). */
export function refAt(index: number, pageSystemCounts: readonly number[]): SystemRef | null {
  let before = 0;
  for (const [pageIndex, count] of pageSystemCounts.entries()) {
    if (Number.isInteger(index) && index > before && index <= before + count) {
      return { pageIndex, system: index - before };
    }
    before += count;
  }
  return null;
}

/** MRK-008: the number of existing jumps with the same start system, plus one. */
export function defaultPass(marks: SystemMarks, from: SystemRef): number {
  return marks.jumps.filter((jump) => sameSystem(jump.from, from)).length + 1;
}

/**
 * Adds a mark. Returns null if the mark is rejected.
 *
 * References:
 *  - A system of this file (`at`, `from`, a `to` without `file`) must exist in the layout: integer `pageIndex` in
 *    0..pageSystemCounts.length-1 and integer `system` in 1..pageSystemCounts[pageIndex].
 *  - A cross-file reference (`ref`, a `to` with `file`) needs a non-empty `file`, an integer `pageIndex` >= 0 and an integer
 *    `system` >= 1. It is never checked against `pageSystemCounts` (MRK-015).
 * `text`: an absent or empty string is stored without the `text` key; any other text is stored unchanged.
 * There are no further plausibility checks (MRK-002).
 *
 * Per kind:
 *  - jump: `pass` must be an integer >= 1. A target in this file must not be the system that directly follows `from` in print
 *    order (both are the same place in the playing order). Every other target is allowed, including `from` itself and,
 *    from the last system, the first system (D.C., PLY-016). Appended with id = nextJumpId; nextJumpId + 1.
 *  - bookmark: appended with id = nextBookmarkId; nextBookmarkId + 1. Any number per system (MRK-007).
 *  - start: replaces the existing start mark, if any (MRK-006). Allowed on every system.
 *  - stop, break: if the system already holds a mark of this kind, that mark is removed (toggle, MRK-003, MRK-004); this also
 *    works on the last system. Otherwise the mark is rejected on the last system of the file (MRK-005), else inserted so
 *    that the list stays in print order.
 */
export function addMark(marks: SystemMarks, mark: NewMark, pageSystemCounts: readonly number[]): SystemMarks | null {
  switch (mark.kind) {
    case 'jump':
      return addJumpMark(marks, mark, pageSystemCounts);
    case 'bookmark':
      return addBookmark(marks, mark, pageSystemCounts);
    case 'start':
      return printIndex(mark.at, pageSystemCounts) === null ? null : { ...marks, start: withText({ at: mark.at }, mark.text) };
    case 'stop':
    case 'break': {
      const key = mark.kind === 'stop' ? 'stops' : 'breaks';
      const list = togglePoint(marks[key], withText({ at: mark.at }, mark.text), pageSystemCounts);
      return list === null ? null : { ...marks, [key]: list };
    }
  }
}

/**
 * Deletion rule (MRK-013, MRK-015): the system `deleted` of this file is removed.
 *  1. Removed: the start mark, stop, break and bookmarks on it, and every jump whose `from` is it or whose target in this
 *     file is it (a jump needs both ends).
 *  2. Renumbered: in every remaining reference to a system of this file on the same page with a larger `system`, `system`
 *     decreases by 1. References to other pages stay.
 *  3. Cross-file references (`ref`, a `to` with `file`) are never removed or renumbered; a bookmark or jump that holds one is
 *     removed only because of its own system in this file.
 * The next ids are unchanged. A stop or break that is now on the last system stays stored (the derivation ignores it).
 */
export function removeMarksOfSystem(marks: SystemMarks, deleted: SystemRef): SystemMarks {
  const kept = removeWhere(marks, (ref) => sameSystem(ref, deleted));
  const moved = <T extends SystemRef>(ref: T): T =>
    ref.pageIndex === deleted.pageIndex && ref.system > deleted.system ? { ...ref, system: ref.system - 1 } : ref;
  const movedMark = <T extends { readonly at: SystemRef }>(mark: T): T => ({ ...mark, at: moved(mark.at) });
  return {
    ...kept,
    jumps: kept.jumps.map((jump) => ({ ...jump, from: moved(jump.from), to: isCrossFile(jump.to) ? jump.to : moved(jump.to) })),
    bookmarks: kept.bookmarks.map(movedMark),
    stops: kept.stops.map(movedMark),
    breaks: kept.breaks.map(movedMark),
    start: kept.start === null ? null : movedMark(kept.start),
  };
}

/**
 * Deletion rule for a page rerun (MRK-014): if `oldCount === newCount` the marks are unchanged. Otherwise every mark of the
 * page is removed: start, stops, breaks and bookmarks on it, and every jump whose `from` or whose target in this file is on
 * it. Cross-file references do not count as being on the page. The next ids are unchanged.
 */
export function rerunPage(marks: SystemMarks, pageIndex: number, oldCount: number, newCount: number): SystemMarks {
  return oldCount === newCount ? marks : removeWhere(marks, (ref) => ref.pageIndex === pageIndex);
}

function sameSystem(a: SystemRef, b: SystemRef): boolean {
  return a.pageIndex === b.pageIndex && a.system === b.system;
}

function printOrder(a: PointMark, b: PointMark): number {
  return a.at.pageIndex - b.at.pageIndex || a.at.system - b.at.system;
}

/** An absent or empty user text is stored without the key. */
function withText<T extends object>(mark: T, text: string | undefined): T & { readonly text?: string } {
  return text === undefined || text === '' ? mark : { ...mark, text };
}

function isValidFileRef({ file, pageIndex, system }: FileRef): boolean {
  return file !== '' && Number.isInteger(pageIndex) && pageIndex >= 0 && Number.isInteger(system) && system >= 1;
}

function addJumpMark(marks: SystemMarks, mark: Extract<NewMark, { kind: 'jump' }>, counts: readonly number[]): SystemMarks | null {
  const { from, to, pass, text } = mark;
  const origin = printIndex(from, counts);
  if (origin === null || !Number.isInteger(pass) || pass < 1) {
    return null;
  }
  if (isCrossFile(to)) {
    if (!isValidFileRef(to)) {
      return null;
    }
  } else {
    const target = printIndex(to, counts);
    // The system directly after the start is the same place in the playing order.
    if (target === null || target === origin + 1) {
      return null;
    }
  }
  const jump = withText({ id: marks.nextJumpId, from, to, pass }, text);
  return { ...marks, jumps: [...marks.jumps, jump], nextJumpId: marks.nextJumpId + 1 };
}

function addBookmark(marks: SystemMarks, mark: Extract<NewMark, { kind: 'bookmark' }>, counts: readonly number[]): SystemMarks | null {
  const { at, ref, text } = mark;
  if (printIndex(at, counts) === null || (ref !== undefined && !isValidFileRef(ref))) {
    return null;
  }
  const bookmark = withText({ id: marks.nextBookmarkId, at, ...(ref === undefined ? {} : { ref }) }, text);
  return { ...marks, bookmarks: [...marks.bookmarks, bookmark], nextBookmarkId: marks.nextBookmarkId + 1 };
}

/** MRK-003..MRK-005: removes the mark of that system if there is one, else adds it (never on the last system). */
function togglePoint(list: readonly PointMark[], mark: PointMark, counts: readonly number[]): readonly PointMark[] | null {
  const index = printIndex(mark.at, counts);
  if (index === null) {
    return null;
  }
  const others = list.filter((existing) => !sameSystem(existing.at, mark.at));
  if (others.length < list.length) {
    return others;
  }
  const systemCount = counts.reduce((sum, n) => sum + n, 0);
  return index === systemCount ? null : [...list, mark].sort(printOrder);
}

/** Removes every mark with an end in this file that `gone` matches; cross-file references are not ends in this file. */
function removeWhere(marks: SystemMarks, gone: (ref: SystemRef) => boolean): SystemMarks {
  const kept = (mark: { readonly at: SystemRef }): boolean => !gone(mark.at);
  return {
    ...marks,
    jumps: marks.jumps.filter((jump) => !gone(jump.from) && (isCrossFile(jump.to) || !gone(jump.to))),
    bookmarks: marks.bookmarks.filter(kept),
    stops: marks.stops.filter(kept),
    breaks: marks.breaks.filter(kept),
    start: marks.start !== null && kept(marks.start) ? marks.start : null,
  };
}

