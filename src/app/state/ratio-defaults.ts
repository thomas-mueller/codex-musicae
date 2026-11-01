import { inject, Injectable } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { initialAspectRatio, orientationOf } from '../core';
import type { Orientation } from '../core';
import { DEVICE_INFO } from '../ports/device-info';
import { PreferencesStore } from './preferences.store';
import { UiStore } from './ui.store';

/** What a `DocumentStore` needs to resolve its effective ratio (SLD-014); every function reads signals. */
export interface RatioDefaults {
  orientation(): Orientation;
  globalRatio(orientation: Orientation): number | undefined;
  /** Device screen ratio arranged for the orientation. */
  screenRatio(orientation: Orientation): number;
}

/** Documents created without the service (specs): landscape, no stored default, a square screen. */
export const NO_RATIO_DEFAULTS: RatioDefaults = {
  orientation: () => 'landscape',
  globalRatio: () => undefined,
  screenRatio: () => 1,
};

/** Signal-backed ratio inputs from the viewport, the preferences and the device. */
@Injectable({ providedIn: 'root' })
export class RatioDefaultsProvider implements RatioDefaults {
  private readonly preferences = inject(PreferencesStore);
  private readonly ui = inject(UiStore);
  private readonly device = inject(DEVICE_INFO);

  orientation(): Orientation {
    const { width, height } = this.ui.viewport();
    return orientationOf(width, height);
  }

  globalRatio(orientation: Orientation): number | undefined {
    return this.preferences.globalRatios()[orientation];
  }

  screenRatio(orientation: Orientation): number {
    const { width, height } = this.device.screenSize();
    const long = Math.max(width, height);
    const short = Math.min(width, height);
    return orientation === 'landscape'
      ? initialAspectRatio(long, short, TUNABLES.aspectRatio)
      : initialAspectRatio(short, long, TUNABLES.aspectRatio);
  }
}
