import { TUNABLES } from './tunables';
import type { Edition } from './edition';

/** GEN-011: the application ID (Capacitor appId, Android applicationId, iOS bundle ID) of an edition. */
export function appIdFor(edition: Edition): string {
  return edition === 'paid' ? TUNABLES.identity.appIdPaid : TUNABLES.identity.appId;
}

/** GEN-011: the edition named by a `CAP_EDITION`-style value; anything but 'paid' is the free app. */
export function editionOf(value: string | undefined): Edition {
  return value === 'paid' ? 'paid' : 'free';
}
