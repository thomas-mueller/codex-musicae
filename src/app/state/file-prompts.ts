import { computed, inject, Injectable, signal } from '@angular/core';

import { UiStore } from './ui.store';

/** A question about one open file. `closing`: the user is closing it, so a positive answer also closes it. */
export type FilePrompt =
  | { readonly kind: 'overwrite'; readonly tabId: string; readonly closing: boolean }
  | { readonly kind: 'close'; readonly tabId: string };

/**
 * The save questions (one at a time) and the notices about files that cannot be written. None of them shows in
 * presentation mode or while a stroke is drawn; they wait. FIL-033, FIL-039, FIL-049, FIL-050
 */
@Injectable({ providedIn: 'root' })
export class FilePrompts {
  private readonly ui = inject(UiStore);
  private readonly questions = signal<readonly FilePrompt[]>([]);
  private readonly notices = signal<readonly string[]>([]);
  private readonly held = computed(() => this.ui.mode() === 'presentation' || this.ui.strokeInProgress());

  readonly current = computed(() => (this.held() ? null : (this.questions()[0] ?? null)));
  /** The file whose notice shows. */
  readonly notice = computed(() => (this.held() ? null : (this.notices()[0] ?? null)));
  /** Every waiting question, shown or not. */
  readonly waiting = this.questions.asReadonly();

  /** One question per file. One that comes from closing the file replaces the waiting one and goes first. */
  ask(prompt: FilePrompt): void {
    const urgent = prompt.kind === 'close' || prompt.closing;
    this.questions.update((list) => {
      if (!urgent) {
        return list.some((other) => other.tabId === prompt.tabId) ? list : [...list, prompt];
      }
      return [prompt, ...list.filter((other) => other.tabId !== prompt.tabId)];
    });
  }

  dismiss(tabId: string): void {
    this.questions.update((list) => list.filter((prompt) => prompt.tabId !== tabId));
  }

  /** Shows the notice of a file now, also when it was closed before (the lock was tapped) or others wait. */
  showNotice(tabId: string, first = false): void {
    this.notices.update((list) => {
      const others = list.filter((id) => id !== tabId);
      return first ? [tabId, ...others] : list.includes(tabId) ? list : [...list, tabId];
    });
  }

  dismissNotice(tabId: string): void {
    this.notices.update((list) => list.filter((id) => id !== tabId));
  }

  /** The file is gone: nothing about it waits any more. */
  drop(tabId: string): void {
    this.dismiss(tabId);
    this.dismissNotice(tabId);
  }
}
