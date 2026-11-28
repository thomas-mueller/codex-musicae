import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import type { HistoryMode } from '../../state/edit-history.store';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { IconButton } from './icon-button';

/**
 * Undo and redo of the current mode (ANN-016, UIX-033), on the history of the active document. The two buttons take part in
 * the layout of their parent, which is a tool group.
 */
@Component({
  selector: 'app-history-buttons',
  imports: [IconButton],
  template: `
    <button appIconButton icon="undo" labelKey="undo" [disabled]="!canUndo()" (pressed)="controls()?.undo()"></button>
    <button appIconButton icon="redo" labelKey="redo" [disabled]="!canRedo()" (pressed)="controls()?.redo()"></button>
  `,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryButtons {
  private readonly ui = inject(UiStore);
  private readonly session = inject(SessionStore);
  private readonly mode = computed<HistoryMode>(() => (this.ui.mode() === 'organization' ? 'organization' : 'annotation'));
  protected readonly controls = computed(() => this.session.activeDocument()?.edits.of(this.mode()));
  /** ANN-013: not while a stroke is being drawn. */
  protected readonly canUndo = computed(() => !this.ui.strokeInProgress() && (this.controls()?.canUndo() ?? false));
  protected readonly canRedo = computed(() => !this.ui.strokeInProgress() && (this.controls()?.canRedo() ?? false));
}
