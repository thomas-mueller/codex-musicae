import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { CrossFileService } from '../../state/cross-file.service';
import type { CrossFileNotice as Notice, CrossFileReason } from '../../state/cross-file.service';
import { FilePrompts } from '../../state/file-prompts';
import { Icon } from '../shell/icon';
import { IconButton } from '../shell/icon-button';
import { noticeStrip } from './notice-strip';

const TEXT_KEYS: Readonly<Record<CrossFileReason, string>> = {
  'missing-file': 'crossFile.missingFile',
  ambiguous: 'crossFile.ambiguous',
  'no-access': 'crossFile.noAccess',
  'missing-system': 'crossFile.missingSystem',
};

/** Only for these reasons can opening a file help. */
const OPENABLE: readonly CrossFileReason[] = ['missing-file', 'no-access'];

/**
 * The warnings about referenced files, in the place of the save notice, which goes first. They block nothing.
 * FIL-043, FIL-044, MRK-015
 */
@Component({
  selector: 'app-cross-file-notice',
  imports: [Icon, IconButton, TranslocoPipe],
  template: `
    @if (notice(); as shown) {
      <div class="notice" role="status" data-testid="cross-file-notice" [attr.data-kind]="shown.kind" [attr.aria-label]="'a11y.crossFileNotice' | transloco">
        <app-icon name="jump" />
        @if (shown.kind === 'unresolved') {
          <p><strong [textContent]="shown.name"></strong> {{ textKey(shown.reason) | transloco }}</p>
          @if (openable(shown.reason)) {
            <button type="button" class="action" data-testid="cross-file-open" (click)="open(shown)">{{ 'crossFile.openFile' | transloco }}</button>
          }
        } @else {
          <p><strong [textContent]="shown.name"></strong> {{ 'crossFile.closed' | transloco: { referrers: shown.referrers.join(', ') } }}</p>
          <button type="button" class="action" data-testid="cross-file-silence" (click)="silence()">{{ 'crossFile.dontShowAgain' | transloco }}</button>
        }
        <button appIconButton data-testid="cross-file-dismiss" icon="cancel" labelKey="dismissNotice" (pressed)="crossFile.dismiss(shown)"></button>
      </div>
    }
  `,
  styleUrls: ['./save-dialogs.css', './save-notice.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-strip]': 'strip()' },
})
export class CrossFileNotice {
  protected readonly crossFile = inject(CrossFileService);
  private readonly prompts = inject(FilePrompts);
  protected readonly strip = noticeStrip();
  /** One notice at a time in this place. */
  protected readonly notice = computed(() => (this.prompts.notice() === null ? this.crossFile.notice() : null));

  protected textKey(reason: CrossFileReason): string {
    return TEXT_KEYS[reason];
  }

  protected openable(reason: CrossFileReason): boolean {
    return OPENABLE.includes(reason);
  }

  protected open(notice: Notice & { kind: 'unresolved' }): void {
    void this.crossFile.openMissing(notice);
  }

  protected silence(): void {
    void this.crossFile.silenceCloseWarning();
  }
}
