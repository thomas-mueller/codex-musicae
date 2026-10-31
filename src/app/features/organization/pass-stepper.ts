import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconButton } from '../shell/icon-button';

/** Popup id of the stepper; it closes like any popup (outside tap, Escape). */
export const POPUP_PASS_STEPPER = 'passStepper';

/** ORG-016: the pass is an integer >= 1. */
export function stepPass(pass: number, delta: number): number {
  return Math.max(1, Math.round(pass) + delta);
}

/** ORG-016: `−`, the number, `+`; every change is emitted at once. `−` is disabled at 1. */
@Component({
  selector: 'app-pass-stepper',
  imports: [IconButton],
  template: `
    <button appIconButton icon="minus" labelKey="minus" data-testid="stepper-minus" [disabled]="pass() <= 1" (pressed)="passChange.emit(step(-1))"></button>
    <span class="value" data-testid="stepper-value">{{ pass() }}</span>
    <button appIconButton icon="plus" labelKey="plus" data-testid="stepper-plus" (pressed)="passChange.emit(step(1))"></button>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: var(--cm-stepper-gap); padding: var(--cm-chip-padding); border-radius: var(--cm-chip-radius); background: var(--cm-bar-bg); box-shadow: 0 1px 4px rgb(0 0 0 / 0.3); }
    .value { min-width: 1.5em; text-align: center; font-family: monospace; color: var(--cm-icon); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'data-popup': '', 'data-testid': 'pass-stepper' },
})
export class PassStepper {
  readonly pass = input.required<number>();
  readonly passChange = output<number>();

  protected step(delta: number): number {
    return stepPass(this.pass(), delta);
  }
}
