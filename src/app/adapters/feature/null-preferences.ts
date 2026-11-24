import type { Preferences } from '../../ports/preferences';

/** EDN-014: the preferences of a build in which no persistence switch is on; stores nothing and reads nothing (no localStorage adapter exists). */
export class NullPreferences implements Preferences {
  get<T>(): Promise<T | undefined> {
    return Promise.resolve(undefined);
  }

  set(): Promise<void> {
    return Promise.resolve();
  }

  remove(): Promise<void> {
    return Promise.resolve();
  }
}
