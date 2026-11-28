import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ActiveHistory } from '../../state/active-history';
import { IconButton } from './icon-button';

/**
 * Undo and redo of the current mode (ANN-016, UIX-033), on the history of the active document. The two buttons take part in
 * the layout of their parent, which is a tool group.
 */
@Component({
  selector: 'app-history-buttons',
  imports: [IconButton],
  template: `
    <button appIconButton icon="undo" labelKey="undo" [disabled]="!history.canUndo()" (pressed)="history.undo()"></button>
    <button appIconButton icon="redo" labelKey="redo" [disabled]="!history.canRedo()" (pressed)="history.redo()"></button>
  `,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryButtons {
  protected readonly history = inject(ActiveHistory);
}
