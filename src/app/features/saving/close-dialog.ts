import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { FEATURE_FLAGS } from '../../ports/feature-flags';
import { FilePrompts } from '../../state/file-prompts';
import { SessionStore } from '../../state/session.store';
import type { CloseReply } from '../../state/session.store';
import { fileName } from './prompted-file';

/** Shown whenever closing a file would lose changes. FIL-046, FIL-049, EDN-003 */
@Component({
  selector: 'app-close-dialog',
  imports: [TranslocoPipe],
  template: `
    @if (prompt()) {
      <div class="scrim" data-testid="close-scrim">
        <div class="dialog" role="alertdialog" data-testid="close-dialog" [attr.aria-label]="'a11y.closeDialog' | transloco">
          <p class="file" [textContent]="name()"></p>
          <p class="question">{{ 'save.close.question' | transloco }}</p>
          <button type="button" class="action" data-testid="close-save-as" [attr.aria-disabled]="!canSaveAs" (click)="reply('saveAs')">{{ 'save.close.saveAs' | transloco }}</button>
          <button type="button" class="action" data-testid="close-discard" (click)="reply('discard')">{{ 'save.close.discard' | transloco }}</button>
          <button type="button" class="action" data-testid="close-cancel" (click)="reply('cancel')">{{ 'save.close.cancel' | transloco }}</button>
        </div>
      </div>
    }
  `,
  styleUrls: ['../shell/dialog.css', './save-dialogs.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloseDialog {
  private readonly prompts = inject(FilePrompts);
  private readonly session = inject(SessionStore);
  protected readonly canSaveAs = inject(FEATURE_FLAGS).saveCopy;
  protected readonly prompt = computed(() => {
    const current = this.prompts.current();
    return current?.kind === 'close' ? current : null;
  });
  protected readonly name = fileName(() => this.prompt()?.tabId ?? null);

  protected reply(reply: CloseReply): void {
    const prompt = this.prompt();
    if (prompt === null || (reply === 'saveAs' && !this.canSaveAs)) {
      return;
    }
    void this.session.answerClose(prompt, reply);
  }
}
