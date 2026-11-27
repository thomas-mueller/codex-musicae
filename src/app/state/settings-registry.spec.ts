import { TestBed } from '@angular/core/testing';

import { FEATURE_FLAGS } from '../ports/feature-flags';
import type { FeatureFlags } from '../ports/feature-flags';
import { PREFERENCES } from '../ports/preferences';
import type { Preferences } from '../ports/preferences';
import { ALL_FEATURES_ON } from '../../testing/provide-test-ports';
import { SETTINGS_GROUPS, SettingsRegistry } from './settings-registry';
import type { SettingDefinition } from './settings-registry';
import { memoryPreferences } from './testing/fake-ports';

const flag = { id: 'flag', group: 'general', labelKey: 'x', persist: true, type: 'boolean', defaultValue: true } as const;
const choice = {
  id: 'pick',
  group: 'display',
  labelKey: 'x',
  persist: true,
  type: 'choice',
  defaultValue: 'a',
  options: [
    { value: 'a', labelKey: 'x' },
    { value: 'b', labelKey: 'x' },
  ],
} as const;
const seconds = { id: 'wait', group: 'slideMode', labelKey: 'x', persist: true, type: 'seconds', defaultValue: 2, min: 1, max: 10, step: 1 } as const;

describe('SettingsRegistry', () => {
  function create(preferences: Preferences = memoryPreferences(), flags: FeatureFlags = ALL_FEATURES_ON) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PREFERENCES, useValue: preferences },
        { provide: FEATURE_FLAGS, useValue: flags },
      ],
    });
    return TestBed.inject(SettingsRegistry);
  }

  it('UIX-026 has the groups General, Display, Slide mode and Files, in this order, and no entry of its own', () => {
    expect(SETTINGS_GROUPS).toEqual(['general', 'display', 'slideMode', 'files']);
    expect(create().entries()).toEqual([]);
  });

  it('UIX-026 a registered setting starts with its default and is listed in registration order', async () => {
    const registry = create();
    const handles = [registry.register(choice), registry.register(flag), registry.register(seconds)];
    await Promise.all(handles.map((handle) => handle.ready));
    expect(handles.map((handle) => handle.value())).toEqual(['a', true, 2]);
    expect(registry.entries().map((entry) => entry.definition.id)).toEqual(['pick', 'flag', 'wait']);
  });

  it('UIX-026 an id cannot be registered twice', () => {
    const registry = create();
    registry.register(flag);
    expect(() => registry.register({ ...flag, group: 'files' })).toThrow();
  });

  it('UIX-026 a change is stored under the setting id and read back by the next run', async () => {
    const preferences = memoryPreferences();
    await create(preferences).register(seconds).set(5);
    expect([...preferences.data]).toEqual([['setting.wait', 5]]);
    const restored = create(preferences).register(seconds);
    await restored.ready;
    expect(restored.value()).toBe(5);
  });

  const invalid: readonly [SettingDefinition, unknown][] = [
    [flag, 'yes'],
    [choice, 'c'],
    [choice, 1],
    [seconds, 0],
    [seconds, 11],
    [seconds, Number.NaN],
    [seconds, '5'],
  ];

  for (const [definition, value] of invalid) {
    it(`UIX-026 the invalid ${definition.type} value ${String(value)} is ignored, stored or set`, async () => {
      const preferences = memoryPreferences({ [`setting.${definition.id}`]: value });
      const setting = create(preferences).register(definition);
      await setting.ready;
      expect(setting.value()).toBe(definition.defaultValue);
      const set = vi.spyOn(preferences, 'set');
      await setting.set(value as string);
      expect(setting.value()).toBe(definition.defaultValue);
      expect(set).not.toHaveBeenCalled();
    });
  }

  it('UIX-026 a setting that does not persist is neither read nor written', async () => {
    const preferences = memoryPreferences({ 'setting.flag': false });
    const get = vi.spyOn(preferences, 'get');
    const set = vi.spyOn(preferences, 'set');
    const setting = create(preferences).register({ ...flag, persist: false });
    await setting.ready;
    expect(setting.value()).toBe(true);
    await setting.set(false);
    expect(setting.value()).toBe(false);
    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('UIX-026 a change made while the stored value is still being read wins', async () => {
    let answer: (value: unknown) => void = () => undefined;
    const preferences = memoryPreferences();
    preferences.get = <T>() => new Promise<T>((resolve) => (answer = resolve as (value: unknown) => void));
    const setting = create(preferences).register(seconds);
    const written = setting.set(7);
    answer(3);
    await written;
    expect(setting.value()).toBe(7);
    expect(preferences.data.get('setting.wait')).toBe(7);
  });

  it('EDN-002 a setting whose feature switch is off is disabled, keeps its default and stores nothing', async () => {
    const preferences = memoryPreferences({ 'setting.flag': false });
    const registry = create(preferences, { ...ALL_FEATURES_ON, autosave: false });
    const setting = registry.register({ ...flag, feature: 'autosave' });
    await setting.ready;
    expect(setting.enabled).toBe(false);
    expect(setting.value()).toBe(true);
    await setting.set(false);
    expect(setting.value()).toBe(true);
    expect(preferences.data.get('setting.flag')).toBe(false); // untouched
  });

  it('UIX-026 a setting whose feature switch is on is enabled', () => {
    expect(create().register({ ...flag, feature: 'autosave' }).enabled).toBe(true);
  });

  it('UIX-023 reset takes every setting back to its default and removes the stored value', async () => {
    const preferences = memoryPreferences();
    const registry = create(preferences);
    const handles = [registry.register(flag), registry.register(choice), registry.register(seconds)] as const;
    await Promise.all([handles[0].set(false), handles[1].set('b'), handles[2].set(9)]);
    expect(preferences.data.size).toBe(3);
    await registry.resetAll();
    expect(handles.map((handle) => handle.value())).toEqual([true, 'a', 2]);
    expect(preferences.data.size).toBe(0);
    const next = create(preferences).register(seconds);
    await next.ready;
    expect(next.value()).toBe(2);
  });

  it('UIX-023 a reset made while the stored value is still being read wins', async () => {
    let answer: (value: unknown) => void = () => undefined;
    const preferences = memoryPreferences({ 'setting.wait': 3 });
    preferences.get = <T>() => new Promise<T>((resolve) => (answer = resolve as (value: unknown) => void));
    const registry = create(preferences);
    const setting = registry.register(seconds);
    const reset = registry.resetAll();
    answer(3);
    await reset;
    expect(setting.value()).toBe(2);
    expect(preferences.data.size).toBe(0);
  });

  it('UIX-023 a setting that does not persist is reset without touching the store', async () => {
    const preferences = memoryPreferences();
    const remove = vi.spyOn(preferences, 'remove');
    const registry = create(preferences);
    const setting = registry.register({ ...flag, persist: false });
    await setting.set(false);
    await registry.resetAll();
    expect(setting.value()).toBe(true);
    expect(remove).not.toHaveBeenCalled();
  });

  it('UIX-023 EDN-002 reset leaves what a disabled setting has stored', async () => {
    const preferences = memoryPreferences({ 'setting.flag': false });
    const registry = create(preferences, { ...ALL_FEATURES_ON, autosave: false });
    registry.register({ ...flag, feature: 'autosave' });
    await registry.resetAll();
    expect(preferences.data.get('setting.flag')).toBe(false);
  });

  it('UIX-023 reset runs every registered handler, also when one throws or rejects', async () => {
    const registry = create();
    const calls: string[] = [];
    registry.registerReset(() => {
      throw new Error('throws');
    });
    registry.registerReset(() => Promise.reject(new Error('rejects')));
    registry.registerReset(async () => {
      calls.push('last');
    });
    await expect(registry.resetAll()).resolves.toBeUndefined();
    expect(calls).toEqual(['last']);
  });
});
