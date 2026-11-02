import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { OpenFileDirective } from '../tabs/open-file.directive';
import { TabBar } from '../tabs/tab-bar';
import { TabSwitcher } from '../tabs/tab-switcher';
import { ModeSwitch } from '../toolbar/mode-switch';
import { IconButton } from './icon-button';

export const POPUP_OVERFLOW_TOP = 'overflow-top';

/** Compact: tabs, open, mode, undo, redo. Expanded: open + tab bar, mode, overflow. UIX-004, 005, 006 */
@Component({
  selector: 'app-top-bar',
  imports: [IconButton, ModeSwitch, OpenFileDirective, TabBar, TabSwitcher, TranslocoPipe],
  templateUrl: './top-bar.html',
  styleUrl: './bars.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  protected readonly store = inject(UiStore);
  protected readonly session = inject(SessionStore);
  protected readonly popupId = POPUP_OVERFLOW_TOP;
  /** ANN-006: both act on the active tab; not while a stroke is being drawn. */
  protected readonly canUndo = computed(() => !this.store.strokeInProgress() && (this.session.activeDocument()?.canUndo() ?? false));
  protected readonly canRedo = computed(() => !this.store.strokeInProgress() && (this.session.activeDocument()?.canRedo() ?? false));
}
