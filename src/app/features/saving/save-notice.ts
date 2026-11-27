import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { FEATURE_FLAGS } from '../../ports/feature-flags';
import { FilePrompts } from '../../state/file-prompts';
import { SessionStore } from '../../state/session.store';
import { Icon } from '../shell/icon';
import { IconButton } from '../shell/icon-button';
import { noticeStrip } from './notice-strip';
import { fileName } from './prompted-file';

/**
 * A file that cannot be written: a bar below the top bar, where the file list opens. It lies over the page, so nothing
 * moves, and blocks nothing. FIL-022, FIL-039
 */
@Component({
  selector: 'app-save-notice',
  imports: [Icon, IconButton, TranslocoPipe],
  template: `
    @if (prompts.notice(); as tabId) {
      <div class="notice" role="status" data-testid="save-notice" [attr.aria-label]="'a11y.saveNotice' | transloco">
        <app-icon name="readOnly" />
        <p><strong [textContent]="name()"></strong> {{ 'save.notice.text' | transloco }}</p>
        <button type="button" class="action" data-testid="notice-save-as" [attr.aria-disabled]="!canSaveAs" (click)="saveAs(tabId)">{{ 'save.notice.saveAs' | transloco }}</button>
        <button appIconButton data-testid="notice-dismiss" icon="cancel" labelKey="dismissNotice" (pressed)="prompts.dismissNotice(tabId)"></button>
      </div>
    }
  `,
  styleUrls: ['./save-dialogs.css', './save-notice.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-strip]': 'strip()' },
})
export class SaveNotice {
  protected readonly prompts = inject(FilePrompts);
  private readonly session = inject(SessionStore);
  protected readonly canSaveAs = inject(FEATURE_FLAGS).saveCopy;
  protected readonly name = fileName(() => this.prompts.notice());
  protected readonly strip = noticeStrip();

  protected saveAs(tabId: string): void {
    if (!this.canSaveAs) {
      return;
    }
    void this.session.saveAsNewFile(tabId).then((outcome) => {
      if (outcome === 'saved' || outcome === 'copied') {
        this.prompts.dismissNotice(tabId);
      }
    });
  }
}
