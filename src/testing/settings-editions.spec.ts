import { TestBed } from '@angular/core/testing';

import { createPreferences } from '../app/adapters/feature/feature-preferences';
import { SettingsView } from '../app/features/settings/settings-view';
import { FEATURE_FLAGS } from '../app/ports/feature-flags';
import type { FeatureFlags } from '../app/ports/feature-flags';
import { PREFERENCES } from '../app/ports/preferences';
import { SettingsRegistry } from '../app/state/settings-registry';
import { memoryPreferences } from '../app/state/testing/fake-ports';
import { ALL_FEATURES_ON } from './provide-test-ports';
import { provideTestTransloco } from './transloco';

const FREE: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;
const flag = { id: 'flag', group: 'general', labelKey: 'a11y.settings', persist: true, type: 'boolean', defaultValue: false } as const;

/** One run of a build: the registry over the preferences that build creates, and the settings view on top. */
async function run(flags: FeatureFlags, store: ReturnType<typeof memoryPreferences>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTestTransloco(),
      { provide: FEATURE_FLAGS, useValue: flags },
      { provide: PREFERENCES, useValue: createPreferences(flags, () => store) },
    ],
  });
  const setting = TestBed.inject(SettingsRegistry).register(flag);
  const fixture = TestBed.createComponent(SettingsView);
  await setting.ready;
  await fixture.whenStable();
  const box = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  return { setting, fixture, box };
}

describe('settings per edition', () => {
  it('EDN-004 UIX-026 free and web: a setting can be changed for the session and nothing is stored', async () => {
    const store = memoryPreferences();
    const first = await run(FREE, store);
    expect(first.box.disabled).toBe(false);
    first.box.click();
    await first.setting.ready;
    expect(first.setting.value()).toBe(true);
    expect(store.data.size).toBe(0);
    expect((await run(FREE, store)).box.checked).toBe(false);
  });

  it('EDN-008 UIX-026 paid: a changed setting is there again in the next run', async () => {
    const store = memoryPreferences();
    const first = await run(ALL_FEATURES_ON, store);
    first.box.click();
    await first.setting.ready;
    expect((await run(ALL_FEATURES_ON, store)).box.checked).toBe(true);
  });
});
