import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { translateSignal } from '@jsverse/transloco';

import { Mode, UiStore } from '../../state/ui.store';
import { IconKey } from '../shell/icon';
import { IconButton } from '../shell/icon-button';

interface ModeEntry {
  readonly mode: Mode;
  readonly icon: IconKey;
  readonly labelKey: string;
}

export const POPUP_MODES = 'modes';

/** Segmented three-icon mode control; collapsed it is one button that opens the three in a popup. UIX-002, UIX-037 */
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
  protected readonly popupId = POPUP_MODES;
  readonly collapsed = input(false);
  protected readonly entries: readonly ModeEntry[] = [
    { mode: 'organization', icon: 'modeOrganization', labelKey: 'modeOrganization' },
    { mode: 'annotation', icon: 'modeAnnotation', labelKey: 'modeAnnotation' },
    { mode: 'presentation', icon: 'modePresentation', labelKey: 'modePresentation' },
  ];

  protected readonly currentIcon = computed<IconKey>(
    () => this.entries.find((entry) => entry.mode === this.store.workMode())?.icon ?? 'modeAnnotation',
  );

  /** setMode runs inside the tap: presentation mode needs the user gesture (PLT-004). */
  protected choose(mode: Mode): void {
    this.store.setMode(mode);
    this.store.closePopup();
  }

  protected isDisabled(mode: Mode): boolean {
    return mode === 'presentation' && !this.store.hasDocument();
  }
}
