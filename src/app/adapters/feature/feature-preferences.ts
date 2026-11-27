import { TUNABLES } from '../../../config/tunables';
import type { FeatureFlags } from '../../ports/feature-flags';
import type { Preferences } from '../../ports/preferences';
import { NullPreferences } from './null-preferences';

const SWITCH_BY_PREFIX: Readonly<Record<string, string>> = TUNABLES.persistence.switchByKeyPrefix;

/** The switch that guards a preference key (EDN-005): the longest matching prefix in the tunables, else the settings switch. */
export function switchForKey(key: string): keyof FeatureFlags {
  const prefix = Object.keys(SWITCH_BY_PREFIX).find((name) => key === name || key.startsWith(`${name}.`));
  return (prefix === undefined ? TUNABLES.persistence.defaultKeySwitch : SWITCH_BY_PREFIX[prefix]) as keyof FeatureFlags;
}

/**
 * EDN-005, EDN-008: wraps the preferences store; every key whose switch is off is neither read nor written, so a free build
 * persists no app state. With the switch on the call goes straight to the inner store (paid keeps the V1 behavior).
 */
export class FeaturePreferences implements Preferences {
  constructor(
    private readonly inner: Preferences,
    private readonly flags: FeatureFlags,
  ) {}

  get<T>(key: string): Promise<T | undefined> {
    return this.flags[switchForKey(key)] === true ? this.inner.get<T>(key) : Promise.resolve(undefined);
  }

  set<T>(key: string, value: T): Promise<void> {
    return this.flags[switchForKey(key)] === true ? this.inner.set(key, value) : Promise.resolve();
  }

  remove(key: string): Promise<void> {
    return this.flags[switchForKey(key)] === true ? this.inner.remove(key) : Promise.resolve();
  }
}

/** True when any preference key is persisted: recent files, session restore, per-file choices or settings (EDN-005). */
export function preferencesPersisted(flags: FeatureFlags): boolean {
  return flags.recentFiles || flags.sessionRestore || flags.persistSettings || flags.persistFileChoices;
}

/**
 * EDN-014, EDN-008: the preferences of a build. When no switch persists anything the store is never created, so the web build
 * has no localStorage adapter; otherwise `makeStore()` is the platform store behind the switch-aware wrapper.
 */
export function createPreferences(flags: FeatureFlags, makeStore: () => Preferences): Preferences {
  return preferencesPersisted(flags) ? new FeaturePreferences(makeStore(), flags) : new NullPreferences();
}
