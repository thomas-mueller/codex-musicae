/** Port HostPlatform (NAV-021): the name the platform gives itself, such as "MacIntel", "iPhone" or "Win32". */
import { InjectionToken } from '@angular/core';

export type HostPlatformName = () => string;

/** Without a platform there is no name, so the keys of the other systems apply. */
export const HOST_PLATFORM = new InjectionToken<HostPlatformName>('HostPlatform', {
  providedIn: 'root',
  factory: () => () => '',
});
