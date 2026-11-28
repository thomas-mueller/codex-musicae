import { inject, Injectable } from '@angular/core';

import { HOST_PLATFORM } from '../ports/host-platform';

/** The platform name for the layers that may not read a port themselves (`input/`). NAV-021 */
@Injectable({ providedIn: 'root' })
export class HostPlatform {
  readonly name = inject(HOST_PLATFORM)();
}
