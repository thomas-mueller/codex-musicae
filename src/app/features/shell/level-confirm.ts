import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { DetectionService } from '../../state/detection.service';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { Icon } from './icon';
import { IconButton } from './icon-button';
import { LEVEL_ENTRIES } from './tool-area';

/**
 * DET-014: choosing another detection level asks first (marks may be lost, DET-015). Icons only: the chosen level's icon
 * with `cancel` and `confirm`. Confirming starts the re-run in the background; cancelling, the scrim and Escape change nothing.
 */
@Component({
  selector: 'app-level-confirm',
  imports: [Icon, IconButton, TranslocoPipe],
  template: `
    @if (icon(); as levelIcon) {
      <div class="scrim" data-testid="level-scrim" (click)="ui.cancelLevel()">
        <div class="dialog" role="alertdialog" data-testid="level-dialog" [attr.aria-label]="'a11y.levelConfirm' | transloco" (click)="$event.stopPropagation()">
          <app-icon [name]="levelIcon" />
          <button appIconButton icon="cancel" labelKey="cancel" data-testid="level-cancel" (pressed)="ui.cancelLevel()"></button>
          <button appIconButton icon="confirm" labelKey="confirm" data-testid="level-confirm" (pressed)="confirm()"></button>
        </div>
      </div>
    }
  `,
  styleUrl: './dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LevelConfirm {
  protected readonly ui = inject(UiStore);
  private readonly session = inject(SessionStore);
  private readonly detection = inject(DetectionService);
  protected readonly icon = computed(() => LEVEL_ENTRIES.find((entry) => entry.level === this.ui.pendingLevel())?.icon ?? null);

  protected confirm(): void {
    const level = this.ui.pendingLevel();
    const doc = this.session.activeDocument();
    if (level !== null && doc !== null) {
      this.detection.redetect(doc, level);
    }
    this.ui.cancelLevel();
  }
}
