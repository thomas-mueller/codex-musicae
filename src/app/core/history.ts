/**
 * core/history — a bounded undo/redo stack over entries of any kind.
 * Requirements: ANN-015.
 * The stack only orders the entries: it never reads them and never runs them.
 * All functions return new objects (or the input itself when nothing changes); inputs are never mutated.
 */

export interface EditHistory<T extends object> {
  /** Oldest first: the next undo is last. */
  readonly undo: readonly T[];
  /** The next redo is last. */
  readonly redo: readonly T[];
}

export interface HistoryStep<T extends object> {
  readonly history: EditHistory<T>;
  /** The entry to revert or to apply again, or null when there is none. */
  readonly entry: T | null;
}

export const EMPTY_HISTORY: EditHistory<never> = { undo: [], redo: [] };

/** Appends to `undo`, clears `redo`, and drops the OLDEST entries so that undo.length <= depth. */
export function pushEntry<T extends object>(history: EditHistory<T>, entry: T, depth: number): EditHistory<T> {
  const excess = history.undo.length + 1 - Math.max(0, depth);
  return { undo: [...history.undo, entry].slice(Math.max(0, excess)), redo: [] };
}

/** Moves the newest undo entry to `redo`. Empty undo: the same history and entry null. */
export function undoEntry<T extends object>(history: EditHistory<T>): HistoryStep<T> {
  const entry = history.undo[history.undo.length - 1];
  if (entry === undefined) {
    return { history, entry: null };
  }
  return { history: { undo: history.undo.slice(0, -1), redo: [...history.redo, entry] }, entry };
}

/** Moves the newest redo entry back to `undo`. Empty redo: the same history and entry null. */
export function redoEntry<T extends object>(history: EditHistory<T>): HistoryStep<T> {
  const entry = history.redo[history.redo.length - 1];
  if (entry === undefined) {
    return { history, entry: null };
  }
  return { history: { undo: [...history.undo, entry], redo: history.redo.slice(0, -1) }, entry };
}

/** Drops every entry. An empty history is returned as it is. */
export function clearHistory<T extends object>(history: EditHistory<T>): EditHistory<T> {
  return canUndo(history) || canRedo(history) ? EMPTY_HISTORY : history;
}

/** Removes the entries `isGone` matches from both stacks. With none to remove, the same history is returned. */
export function dropEntries<T extends object>(history: EditHistory<T>, isGone: (entry: T) => boolean): EditHistory<T> {
  const undo = history.undo.filter((entry) => !isGone(entry));
  const redo = history.redo.filter((entry) => !isGone(entry));
  return undo.length === history.undo.length && redo.length === history.redo.length ? history : { undo, redo };
}

export function canUndo<T extends object>(history: EditHistory<T>): boolean {
  return history.undo.length > 0;
}

export function canRedo<T extends object>(history: EditHistory<T>): boolean {
  return history.redo.length > 0;
}
