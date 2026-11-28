import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { FEATURE_FLAGS } from '../../ports/feature-flags';
import { FilePrompts } from '../../state/file-prompts';
import { SessionStore } from '../../state/session.store';
import type { OverwriteReply } from '../../state/session.store';
import { fileName } from './prompted-file';

/**
 * The question before the first write of a file. Escape and Back mean Cancel (NavigationHandler); a tap outside does
 * nothing and no button takes the focus, so that neither a stray tap nor a pedal answers. FIL-033, FIL-036, FIL-038
 */
@Component({
  selector: 'app-overwrite-dialog',
  imports: [TranslocoPipe],
  template: `
    @if (prompt(); as current) {
      <div class="scrim" data-testid="overwrite-scrim">
        <div class="dialog" role="alertdialog" data-testid="overwrite-dialog" [attr.aria-label]="'a11y.overwriteDialog' | transloco">
          <p class="file" [textContent]="name()"></p>
          <p class="question">{{ 'save.overwrite.question' | transloco }}</p>
          <div class="choices">
            <label>
              <input type="checkbox" data-testid="silence-file" [checked]="silenceFile()" (change)="silenceFile.set(checked($event))" />
              <span>{{ 'save.overwrite.silenceFile' | transloco }}</span>
            </label>
            <label>
              <input type="checkbox" data-testid="silence-all" [checked]="silenceAll()" (change)="silenceAll.set(checked($event))" />
              <span>{{ 'save.overwrite.silenceAll' | transloco }}</span>
            </label>
          </div>
          <button type="button" class="action primary" data-testid="overwrite-yes" (click)="reply('overwrite')">{{ 'save.overwrite.overwrite' | transloco }}</button>
          <button type="button" class="action" data-testid="overwrite-save-as" [attr.aria-disabled]="!canSaveAs" (click)="reply('saveAs')">{{ 'save.overwrite.saveAs' | transloco }}</button>
          <button type="button" class="action" data-testid="overwrite-cancel" (click)="reply('cancel')">{{ 'save.overwrite.cancel' | transloco }}</button>
        </div>
      </div>
    }
  `,
  styleUrls: ['../shell/dialog.css', './save-dialogs.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverwriteDialog {
  private readonly prompts = inject(FilePrompts);
  private readonly session = inject(SessionStore);
  protected readonly canSaveAs = inject(FEATURE_FLAGS).saveCopy;
  protected readonly prompt = computed(() => {
    const current = this.prompts.current();
    return current?.kind === 'overwrite' ? current : null;
  });
  protected readonly name = fileName(() => this.prompt()?.tabId ?? null);
  private readonly about = computed(() => this.prompt()?.tabId ?? null);
  /** Unticked again for every file asked about. */
  protected readonly silenceFile = linkedSignal({ source: this.about, computation: () => false });
  protected readonly silenceAll = linkedSignal({ source: this.about, computation: () => false });

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected reply(reply: OverwriteReply): void {
    const prompt = this.prompt();
    if (prompt === null || (reply === 'saveAs' && !this.canSaveAs)) {
      return;
    }
    void this.session.answerOverwrite(prompt, reply, this.silenceAll() ? 'all' : this.silenceFile() ? 'file' : null);
  }
}
