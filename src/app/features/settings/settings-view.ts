import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe, translateSignal } from '@jsverse/transloco';

import { APP_VERSION } from '../../ports/app-version';
import { SETTINGS_GROUPS, SettingsRegistry } from '../../state/settings-registry';
import type { Setting } from '../../state/settings-registry';
import { UiStore } from '../../state/ui.store';
import { Icon } from '../shell/icon';
import { TooltipDirective } from '../shell/tooltip.directive';

/** The settings mode: the four groups with whatever is registered in them; no setting is named here. General ends with "Reset all settings", and the version closes the view. UIX-021, UIX-023, UIX-026, UIX-035 */
@Component({
  selector: 'app-settings-view',
  imports: [Icon, TooltipDirective, TranslocoPipe],
  templateUrl: './settings-view.html',
  styleUrl: './settings-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', '[attr.aria-label]': 'label()' },
})
export class SettingsView {
  private readonly registry = inject(SettingsRegistry);
  protected readonly ui = inject(UiStore);
  protected readonly version = inject(APP_VERSION);
  protected readonly label = translateSignal('a11y.settingsView');
  protected readonly groups = computed(() =>
    SETTINGS_GROUPS.map((id) => ({ id, settings: this.registry.entries().filter((entry) => entry.definition.group === id) })),
  );

  protected onToggle(setting: Setting, event: Event): void {
    void setting.set((event.target as HTMLInputElement).checked);
  }

  protected onChoose(setting: Setting, event: Event): void {
    void setting.set((event.target as HTMLSelectElement).value);
  }

  /** The field shows the value again afterwards: an empty or out-of-range entry changes nothing. */
  protected onSeconds(setting: Setting, event: Event): void {
    const input = event.target as HTMLInputElement;
    void setting.set(input.valueAsNumber);
    input.value = String(setting.value());
  }
}
