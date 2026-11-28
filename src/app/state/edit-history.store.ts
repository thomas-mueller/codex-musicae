import { computed, signal } from '@angular/core';
import type { Signal } from '@angular/core';

import { EMPTY_HISTORY, canRedo, canUndo, clearHistory, dropEntries, pushEntry, redoEntry, staleSteps, undoEntry } from '../core';
import type { EditHistory, HistoryStep, MarkStep, UndoAction } from '../core';

/** Each of the two editing modes has its own history (ANN-015). */
export type HistoryMode = 'annotation' | 'organization';

/** One undoable edit. Both work on the stores, not on pixels; `do` also makes the edit the first time. */
interface HistoryCommand {
  do(): void;
  undo(): void;
}

/** Ink; later text, stamps and moves. */
export type AnnotationCommand = UndoAction & HistoryCommand;
/** Marks; later systems and page re-runs. */
export type OrganizationCommand = MarkStep & HistoryCommand;

/** The bounded undo and redo history of one mode. */
class ModeHistory<T extends HistoryCommand> {
  private readonly historySignal = signal<EditHistory<T>>(EMPTY_HISTORY);
  readonly history: Signal<EditHistory<T>> = this.historySignal.asReadonly();
  readonly canUndo = computed(() => canUndo(this.historySignal()));
  readonly canRedo = computed(() => canRedo(this.historySignal()));

  constructor(private readonly depth: number) {}

  /** Does the edit and keeps it as the newest step; what could be redone is gone. */
  record(command: T): void {
    command.do();
    this.historySignal.update((history) => pushEntry(history, command, this.depth));
  }

  undo(): void {
    this.take(undoEntry(this.historySignal()))?.undo();
  }

  redo(): void {
    this.take(redoEntry(this.historySignal()))?.do();
  }

  clear(): void {
    this.historySignal.update(clearHistory);
  }

  drop(isGone: (command: T) => boolean): void {
    this.historySignal.update((history) => dropEntries(history, isGone));
  }

  private take({ history, entry }: HistoryStep<T>): T | null {
    this.historySignal.set(history);
    return entry;
  }
}

/** The edit histories of one document, one per mode (ANN-015); cleared when the document closes. */
export class EditHistoryStore {
  readonly annotation: ModeHistory<AnnotationCommand>;
  readonly organization: ModeHistory<OrganizationCommand>;

  constructor(depth: number) {
    this.annotation = new ModeHistory(depth);
    this.organization = new ModeHistory(depth);
  }

  /** What the controls of a mode act on. */
  of(mode: HistoryMode): Pick<ModeHistory<HistoryCommand>, 'canUndo' | 'canRedo' | 'undo' | 'redo'> {
    return mode === 'annotation' ? this.annotation : this.organization;
  }

  /** A page re-run changed the systems of `pages`: the steps that rely on them are dropped. Ink does not depend on systems. */
  invalidatePages(pages: ReadonlySet<number>): void {
    const { undo, redo } = this.organization.history();
    const stale = staleSteps([...undo, ...redo], pages);
    this.organization.drop((command) => stale.has(command));
  }

  clear(): void {
    this.annotation.clear();
    this.organization.clear();
  }
}
