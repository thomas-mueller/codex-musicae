import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { translateSignal } from '@jsverse/transloco';

import { Mode, UiStore } from '../../state/ui.store';
import { IconKey } from '../shell/icon';
import { IconButton } from '../shell/icon-button';

interface ModeEntry {
  readonly mode: Mode;
  readonly icon: IconKey;
  readonly labelKey: string;
}

/** Segmented three-icon mode control. UIX-002 */
@Component({
  selector: 'app-mode-switch',
  imports: [IconButton],
  templateUrl: './mode-switch.html',
  styles: `:host { display: inline-flex; flex: none; }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'group', '[attr.aria-label]': 'label()' },
})
export class ModeSwitch {
  protected readonly store = inject(UiStore);
  protected readonly label = translateSignal('a11y.modeSwitch');
  protected readonly entries: readonly ModeEntry[] = [
    { mode: 'organization', icon: 'modeOrganization', labelKey: 'modeOrganization' },
    { mode: 'annotation', icon: 'modeAnnotation', labelKey: 'modeAnnotation' },
    { mode: 'presentation', icon: 'modePresentation', labelKey: 'modePresentation' },
  ];

  protected isDisabled(mode: Mode): boolean {
    return mode === 'presentation' && !this.store.hasDocument();
  }
}
