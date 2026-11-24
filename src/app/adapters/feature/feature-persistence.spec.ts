import { vi } from 'vitest';

import { ALL_FEATURES_ON } from '../../../testing/provide-test-ports';
import { FEATURES as WEB } from '../../../config/features.web';
import { FEATURES as NATIVE } from '../../../config/features.native';
import { createWebFileAccess } from '../../app.config';
import type { FeatureFlags } from '../../ports/feature-flags';
import { memoryPreferences } from '../../state/testing/fake-ports';
import { FeaturePreferences, createPreferences, preferencesPersisted } from './feature-preferences';
import { NullPreferences } from './null-preferences';

const OFF: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;

describe('web persistence', () => {
  it('EDN-004 the web file has exactly the feature set of the free native file: every shared switch off', () => {
    const shared = Object.keys(NATIVE);
    expect(Object.keys(WEB).filter((key) => key !== 'webOrganizational').sort()).toEqual([...shared].sort());
    expect(shared.every((key) => (WEB as Record<string, boolean>)[key] === (NATIVE as Record<string, boolean>)[key])).toBe(true);
    expect(Object.values(WEB).every((value) => value === false)).toBe(true);
  });

  it.each(['recentFiles', 'sessionRestore', 'persistSettings'] as const)('EDN-005 %s alone makes the preferences persist', (name) => {
    expect(preferencesPersisted({ ...OFF, [name]: true })).toBe(true);
  });

  it('EDN-005 the other switches do not make the preferences persist', () => {
    expect(preferencesPersisted({ ...OFF, autosave: true, saveCopy: true, persistFileChoices: true })).toBe(false);
    expect(preferencesPersisted(OFF)).toBe(false);
  });

  it('EDN-014 NullPreferences reads and stores nothing', async () => {
    const prefs = new NullPreferences();
    await prefs.set();
    await prefs.remove();
    expect(await prefs.get()).toBeUndefined();
  });

  it('EDN-014 with the web switches the platform store is never created', () => {
    const makeStore = vi.fn(() => memoryPreferences());
    expect(createPreferences(WEB, makeStore)).toBeInstanceOf(NullPreferences);
    expect(makeStore).not.toHaveBeenCalled();
  });

  it('EDN-008 with a persistence switch on the store is created behind the switch-aware wrapper', () => {
    const makeStore = vi.fn(() => memoryPreferences());
    expect(createPreferences({ ...OFF, persistSettings: true }, makeStore)).toBeInstanceOf(FeaturePreferences);
    expect(makeStore).toHaveBeenCalledTimes(1);
  });

  it('EDN-014 the web file access with the web switches opens no IndexedDB and writes no localStorage', async () => {
    const open = vi.fn();
    vi.stubGlobal('indexedDB', { open });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const access = createWebFileAccess(WEB);
    await access.forget({ id: 'a', name: 'a.pdf' });
    expect(open).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
