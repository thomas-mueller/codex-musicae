import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { FEATURE_FLAGS } from '../../ports/feature-flags';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { FileBar } from '../files/file-bar';
import { ModeSwitch } from '../toolbar/mode-switch';
import { IconButton } from './icon-button';

/** File bar, mode switch (one button when narrow), "save a copy" (expanded only), settings. UIX-025, 034, 036, 037 */
@Component({
  selector: 'app-top-bar',
  imports: [FileBar, IconButton, ModeSwitch],
  templateUrl: './top-bar.html',
  styleUrl: './bars.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  protected readonly store = inject(UiStore);
  private readonly session = inject(SessionStore);
  private readonly flags = inject(FEATURE_FLAGS);
  protected readonly saveCopyDisabled = computed(() => !this.store.hasDocument() || !this.flags.saveCopy);

  /** SAV-011: save a copy of the current file. */
  protected saveCopy(): void {
    void this.session.saveCopy();
  }
}
