import { inject, InjectionToken } from '@angular/core';

/** The version users see: `vX.Y.Z` of the nearest tag (PIP-018). */
export const APP_VERSION = new InjectionToken<string>('APP_VERSION');

/** The full `git describe` string, for internal places only (build log, metadata of a saved file). Falls back to the display version. */
export const APP_VERSION_FULL = new InjectionToken<string>('APP_VERSION_FULL', {
  providedIn: 'root',
  factory: () => inject(APP_VERSION),
});
