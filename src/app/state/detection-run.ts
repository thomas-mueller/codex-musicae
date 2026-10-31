import { signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import type { DetectionLevelName } from '../../config/tunables';
import type { Bar, DetectedPage, PageState } from '../core';

/** DET-021: a bar of a page that is detected but not yet inside the usable prefix; junction is always -1. */
export type ProvisionalBar = Bar & { readonly provisional: true };

/** Runtime detection state of one document (DET-022: never persisted). Signals only; the work is done by `DetectionService`. */
export class DetectionRun {
  readonly level = signal<DetectionLevelName>(TUNABLES.detection.defaultLevel);
  readonly states = signal<readonly PageState[]>([]);
  readonly pages = signal<readonly (DetectedPage | null)[]>([]);
  /** The page the viewer wants next (DET-021); consumed when a page task starts. */
  readonly priorityPage = signal<number | null>(null);

  reset(pageCount: number): void {
    this.states.set(Array.from({ length: pageCount }, () => 'pending' as const));
    this.pages.set(Array.from({ length: pageCount }, () => null));
    this.priorityPage.set(null);
  }

  setState(pageIndex: number, state: PageState): void {
    this.states.update((list) => list.map((s, i) => (i === pageIndex ? state : s)));
  }

  /** Stores the result of a page together with its final state. */
  finish(pageIndex: number, state: 'done' | 'failed', page: DetectedPage | null): void {
    this.pages.update((list) => list.map((p, i) => (i === pageIndex ? page : p)));
    this.setState(pageIndex, state);
  }
}
