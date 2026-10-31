import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

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
  protected readonly popupId = POPUP_OVERFLOW_TOP;
}
