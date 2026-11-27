import { inject, Injectable } from '@angular/core';

import { OverwriteChoices } from './overwrite-choices';
import { SettingsRegistry } from './settings-registry';
import { ToolSettingsStore } from './tool-settings.store';

/**
 * "Reset all settings" (UIX-023, UIX-024): the registry plus the V1 tool colors and widths and the "do not ask again"
 * choices of the overwrite question (FIL-041), which are not registry settings. Registered here and not by their stores, so
 * the stores exist at the time of a reset and do not depend on the registry. Aspect-ratio defaults, stylus values, recent files, the session and everything inside a PDF stay.
 */
@Injectable({ providedIn: 'root' })
export class SettingsReset {
  private readonly registry = inject(SettingsRegistry);

  constructor() {
    const tools = inject(ToolSettingsStore);
    this.registry.registerReset(() => tools.reset());
    const overwrite = inject(OverwriteChoices);
    this.registry.registerReset(() => overwrite.reset());
  }

  resetAll(): Promise<void> {
    return this.registry.resetAll();
  }
}
