import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconButton } from '../shell/icon-button';

/**
 * ORG-014: the chip next to the selected bar. Break and stop are disabled where they are invalid (junctions 0 and N);
 * delete is offered only if the junction holds an item.
 */
@Component({
  selector: 'app-selection-chip',
  imports: [IconButton],
  template: `
    <button appIconButton icon="jump" labelKey="jump" data-testid="chip-jump" (pressed)="jump.emit()"></button>
    <button
      appIconButton
      icon="slideBreak"
      labelKey="slideBreak"
      data-testid="chip-break"
      [toggled]="hasBreak()"
      [disabled]="!markable()"
      (pressed)="toggleBreak.emit()"
    ></button>
    <button
      appIconButton
      icon="stop"
      labelKey="stop"
      data-testid="chip-stop"
      [toggled]="hasStop()"
      [disabled]="!markable()"
      (pressed)="toggleStop.emit()"
    ></button>
    @if (hasItems()) {
      <button appIconButton icon="delete" labelKey="delete" data-testid="chip-delete" (pressed)="clear.emit()"></button>
    }
  `,
  styles: `
    :host { display: inline-flex; padding: var(--cm-chip-padding); border-radius: var(--cm-chip-radius); background: var(--cm-bar-bg); box-shadow: 0 1px 4px rgb(0 0 0 / 0.3); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-chip': '', 'data-testid': 'selection-chip' },
})
export class SelectionChip {
  /** False on junctions 0 and N (`isValidMarkJunction`). */
  readonly markable = input.required<boolean>();
  readonly hasBreak = input(false);
  readonly hasStop = input(false);
  readonly hasItems = input(false);
  readonly jump = output<void>();
  readonly toggleBreak = output<void>();
  readonly toggleStop = output<void>();
  readonly clear = output<void>();
}
