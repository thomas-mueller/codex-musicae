import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { SettingsReset } from '../../state/settings-reset';
import { UiStore } from '../../state/ui.store';
import { IconButton } from './icon-button';

/** UIX-023: "Reset all settings" asks first. Cancelling, the scrim and Escape change nothing. */
@Component({
  selector: 'app-reset-confirm',
  imports: [IconButton, TranslocoPipe],
  template: `
    @if (ui.pendingReset()) {
      <div class="scrim" data-testid="reset-scrim" (click)="ui.cancelReset()">
        <div class="dialog" role="alertdialog" data-testid="reset-dialog" [attr.aria-label]="'a11y.resetConfirm' | transloco" (click)="$event.stopPropagation()">
          <p class="question">{{ 'settings.reset.question' | transloco }}</p>
          <button appIconButton icon="cancel" labelKey="cancel" data-testid="reset-cancel" (pressed)="ui.cancelReset()"></button>
          <button appIconButton icon="confirm" labelKey="confirm" data-testid="reset-confirm" (pressed)="confirm()"></button>
        </div>
      </div>
    }
  `,
  styleUrl: './dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetConfirm {
  protected readonly ui = inject(UiStore);
  private readonly reset = inject(SettingsReset);

  protected confirm(): void {
    void this.reset.resetAll();
    this.ui.cancelReset();
  }
}
