import { TUNABLES } from '../../../config/tunables';
import type { Preferences } from '../../ports/preferences';

export type PreferencesStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** FIL-015: UI state and file references only, as JSON under `T:persistence.keyPrefix`. Failures are swallowed. */
export class WebPreferences implements Preferences {
  constructor(private readonly storage?: PreferencesStorage) {}

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = this.store().getItem(this.key(key));
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      if (raw !== undefined) {
        this.store().setItem(this.key(key), raw);
      }
    } catch {
      // quota exceeded or storage unavailable: preferences are best effort
    }
  }

  async remove(key: string): Promise<void> {
    try {
      this.store().removeItem(this.key(key));
    } catch {
      // storage unavailable
    }
  }

  private key(key: string): string {
    return TUNABLES.persistence.keyPrefix + key;
  }

  private store(): PreferencesStorage {
    return this.storage ?? localStorage;
  }
}
