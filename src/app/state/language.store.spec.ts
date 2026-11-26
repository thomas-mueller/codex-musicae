import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { ALL_FEATURES_ON } from '../../testing/provide-test-ports';
import { FEATURE_FLAGS } from '../ports/feature-flags';
import { PREFERENCES } from '../ports/preferences';
import { SYSTEM_LANGUAGES } from '../ports/system-languages';
import { LanguageStore } from './language.store';
import { SettingsRegistry } from './settings-registry';
import { memoryPreferences } from './testing/fake-ports';

describe('LanguageStore', () => {
  async function start(system: readonly string[], preferences = memoryPreferences()) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PREFERENCES, useValue: preferences },
        { provide: FEATURE_FLAGS, useValue: ALL_FEATURES_ON },
        { provide: SYSTEM_LANGUAGES, useValue: () => system },
      ],
    });
    const store = TestBed.inject(LanguageStore);
    const registry = TestBed.inject(SettingsRegistry);
    const setting = registry.entries()[0]!;
    await setting.ready;
    return { store, registry, setting, preferences };
  }

  it('I18-004 registers the language in General: "system" first, then every language; "system" is the default', async () => {
    const { setting } = await start(['de']);
    const { definition } = setting;
    expect([definition.id, definition.group, definition.type]).toEqual(['language', 'general', 'choice']);
    expect(definition.type === 'choice' ? definition.options.map((option) => option.value) : []).toEqual(['system', ...TUNABLES.i18n.languages]);
    expect(setting.value()).toBe('system');
  });

  it('I18-004 follows the system language and falls back to English', async () => {
    expect((await start(['de-CH', 'fr'])).store.active()).toBe('de');
    expect((await start(['sv-SE'])).store.active()).toBe('en');
  });

  it('I18-004 a platform that tells no language gets English', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PREFERENCES, useValue: memoryPreferences() },
        { provide: FEATURE_FLAGS, useValue: ALL_FEATURES_ON },
      ],
    });
    expect(TestBed.inject(LanguageStore).active()).toBe('en');
  });

  it('I18-004 a chosen language wins over the system and is there in the next run', async () => {
    const first = await start(['de']);
    await first.setting.set('fr');
    expect(first.store.active()).toBe('fr');
    expect((await start(['de'], first.preferences)).store.active()).toBe('fr');
  });

  it('I18-004 an unknown stored language is ignored', async () => {
    const { store } = await start(['de'], memoryPreferences({ 'setting.language': 'sv' }));
    expect(store.active()).toBe('de');
  });

  it('UIX-023 "Reset all settings" goes back to the system language', async () => {
    const { store, registry, setting, preferences } = await start(['de']);
    await setting.set('it');
    await registry.resetAll();
    expect(setting.value()).toBe('system');
    expect(store.active()).toBe('de');
    expect(preferences.data.size).toBe(0);
  });
});
