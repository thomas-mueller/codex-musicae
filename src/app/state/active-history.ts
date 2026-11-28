import { computed, inject, Injectable } from '@angular/core';

import type { HistoryMode } from './edit-history.store';
import { FilePrompts } from './file-prompts';
import { SessionStore } from './session.store';
import { UiStore } from './ui.store';

/**
 * The history that undo and redo act on, for the buttons and the keys alike (ANN-016, NAV-022): the one of the current mode
 * of the active document. There is none in the other modes. Nothing happens while a stroke is drawn (ANN-013) or while a
 * question is open, which covers the tools.
 */
@Injectable({ providedIn: 'root' })
export class ActiveHistory {
  private readonly ui = inject(UiStore);
  private readonly session = inject(SessionStore);
  private readonly prompts = inject(FilePrompts);

  private readonly mode = computed<HistoryMode | null>(() => {
    const mode = this.ui.mode();
    return mode === 'annotation' || mode === 'organization' ? mode : null;
  });
  private readonly controls = computed(() => {
    const mode = this.mode();
    return mode === null ? undefined : this.session.activeDocument()?.edits.of(mode);
  });
  private readonly blocked = computed(
    () =>
      this.ui.strokeInProgress() || this.prompts.current() !== null || this.ui.pendingReset() || this.ui.pendingLevel() !== null,
  );
  readonly canUndo = computed(() => !this.blocked() && (this.controls()?.canUndo() ?? false));
  readonly canRedo = computed(() => !this.blocked() && (this.controls()?.canRedo() ?? false));

  undo(): void {
    if (this.canUndo()) {
      this.controls()?.undo();
    }
  }

  redo(): void {
    if (this.canRedo()) {
      this.controls()?.redo();
    }
  }
}
