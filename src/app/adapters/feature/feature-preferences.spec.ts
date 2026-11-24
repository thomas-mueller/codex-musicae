import { vi } from 'vitest';

import { TUNABLES } from '../../../config/tunables';
import type { FeatureFlags } from '../../ports/feature-flags';
import { memoryPreferences } from '../../state/testing/fake-ports';
import { ALL_FEATURES_ON } from '../../../testing/provide-test-ports';
import { FeaturePreferences, switchForKey } from './feature-preferences';

const OFF: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;
const KEYS: ReadonlyArray<[string, keyof FeatureFlags]> = [
  ['recent', 'recentFiles'],
  [TUNABLES.persistence.sessionKey, 'sessionRestore'],
  ['tool.pen', 'persistSettings'],
  ['stylus.seen', 'persistSettings'],
  ['ratio.portrait', 'persistSettings'],
];

describe('FeaturePreferences', () => {
  it.each(KEYS)('EDN-005 the key %s is guarded by %s', (key, name) => {
    expect(switchForKey(key)).toBe(name);
  });

  it.each(KEYS)('EDN-005 with its switch off the key %s is neither read nor written', async (key, name) => {
    const inner = memoryPreferences({ [key]: 'stored' });
    const spies = { get: vi.spyOn(inner, 'get'), set: vi.spyOn(inner, 'set'), remove: vi.spyOn(inner, 'remove') };
    const prefs = new FeaturePreferences(inner, { ...ALL_FEATURES_ON, [name]: false });
    expect(await prefs.get(key)).toBeUndefined();
    await prefs.set(key, 'new');
    await prefs.remove(key);
    expect(spies.get).not.toHaveBeenCalled();
    expect(spies.set).not.toHaveBeenCalled();
    expect(spies.remove).not.toHaveBeenCalled();
    expect(inner.data.get(key)).toBe('stored');
  });

  it('EDN-005 an all-off configuration persists nothing for any key', async () => {
    const inner = memoryPreferences();
    const prefs = new FeaturePreferences(inner, OFF);
    for (const [key] of KEYS) {
      await prefs.set(key, 1);
    }
    expect(inner.data.size).toBe(0);
  });

  it.each(KEYS)('EDN-008 with the switch on the key %s is a pass-through', async (key) => {
    const inner = memoryPreferences();
    const prefs = new FeaturePreferences(inner, ALL_FEATURES_ON);
    await prefs.set(key, 'value');
    expect(await prefs.get(key)).toBe('value');
    await prefs.remove(key);
    expect(inner.data.has(key)).toBe(false);
  });
});
