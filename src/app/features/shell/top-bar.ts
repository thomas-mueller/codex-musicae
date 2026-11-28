import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { UiStore } from '../../state/ui.store';
import { FileBar } from '../files/file-bar';
import { ModeSwitch } from '../toolbar/mode-switch';
import { IconButton } from './icon-button';

/** File bar, mode switch (one button when narrow), settings. UIX-025, 034, 036, 037 */
@Component({
  selector: 'app-top-bar',
  imports: [FileBar, IconButton, ModeSwitch],
  templateUrl: './top-bar.html',
  styleUrl: './bars.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  protected readonly store = inject(UiStore);
}
