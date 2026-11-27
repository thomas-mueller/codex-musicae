import { inject, Injectable, signal } from '@angular/core';

import { TUNABLES } from '../../config/tunables';
import { PREFERENCES } from '../ports/preferences';

/** FIL-044: "don't show again" of the warning about closing a referenced file; a setting, so it is stored where settings are. */
@Injectable({ providedIn: 'root' })
export class CrossFileChoices {
  private readonly preferences = inject(PREFERENCES);
  private readonly silencedSignal = signal(false);
  private changed = false;
  private pending: Promise<void>;

  readonly closeSilenced = this.silencedSignal.asReadonly();

  constructor() {
    this.pending = this.preferences.get<unknown>(TUNABLES.persistence.crossFileCloseKey).then((value) => {
      // A choice made while the read was running wins.
      if (!this.changed) {
        this.silencedSignal.set(value === true);
      }
    });
  }

  silenceClose(): Promise<void> {
    return this.store(true, () => this.preferences.set(TUNABLES.persistence.crossFileCloseKey, true));
  }

  /** UIX-023 */
  reset(): Promise<void> {
    return this.store(false, () => this.preferences.remove(TUNABLES.persistence.crossFileCloseKey));
  }

  private store(silenced: boolean, write: () => Promise<void>): Promise<void> {
    this.changed = true;
    this.silencedSignal.set(silenced);
    this.pending = this.pending.then(write, write);
    return this.pending;
  }
}
