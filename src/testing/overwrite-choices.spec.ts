import { TestBed } from '@angular/core/testing';

import { createPreferences } from '../app/adapters/feature/feature-preferences';
import { ALL_FEATURES_ON } from './provide-test-ports';
import { FEATURE_FLAGS } from '../app/ports/feature-flags';
import type { FeatureFlags } from '../app/ports/feature-flags';
import { FILE_ACCESS } from '../app/ports/file-access';
import { PREFERENCES } from '../app/ports/preferences';
import { OverwriteChoices } from '../app/state/overwrite-choices';
import { SettingsReset } from '../app/state/settings-reset';
import { fakeFileAccess, memoryPreferences } from '../app/state/testing/fake-ports';

const NONE: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;

/** One run of a build over `store`; files of the same name are the same file (the fake). */
function run(store = memoryPreferences(), flags: FeatureFlags = ALL_FEATURES_ON) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: FEATURE_FLAGS, useValue: flags },
      { provide: FILE_ACCESS, useValue: fakeFileAccess() },
      { provide: PREFERENCES, useValue: createPreferences(flags, () => store) },
    ],
  });
  return { store, choices: TestBed.inject(OverwriteChoices) };
}

const ref = (name: string, id = name) => ({ id, name });

describe('OverwriteChoices', () => {
  it('FIL-033 an answer holds for the file for the whole session, also when it is opened again', async () => {
    const { choices } = run();
    expect(await choices.verdict(ref('a.pdf'))).toBe('ask');
    choices.answer(ref('a.pdf'), 'declined');
    expect(await choices.verdict(ref('a.pdf', 'reopened'))).toBe('hold');
    expect(await choices.verdict(ref('b.pdf'))).toBe('ask');
    choices.answer(ref('b.pdf'), 'allowed');
    expect(await choices.verdict(ref('b.pdf'))).toBe('write');
  });

  it('FIL-038 FIL-041 EDN-008 "do not ask again" for one file goes by its name and is there in the next run', async () => {
    const first = run();
    await first.choices.silence('file', 'a.pdf');
    expect(await run(first.store).choices.verdict(ref('a.pdf', 'other'))).toBe('write');
    expect(await run(first.store).choices.verdict(ref('b.pdf'))).toBe('ask');
  });

  it('FIL-038 "do not ask again" for all files covers every file, also in the next run', async () => {
    const first = run();
    await first.choices.silence('all', 'a.pdf');
    expect(await run(first.store).choices.verdict(ref('b.pdf'))).toBe('write');
  });

  it('FIL-038 EDN-005 where per-file choices are not stored nothing is written and the next run asks', async () => {
    const first = run(memoryPreferences(), { ...ALL_FEATURES_ON, persistFileChoices: false });
    await first.choices.silence('all', 'a.pdf');
    expect(await first.choices.verdict(ref('a.pdf'))).toBe('write');
    expect(first.store.data.size).toBe(0);
    expect(await run(first.store, NONE).choices.verdict(ref('a.pdf'))).toBe('ask');
  });

  it('FIL-041 UIX-023 "Reset all settings" forgets the stored choices, even if nothing had asked before', async () => {
    const first = run();
    await first.choices.silence('all', 'a.pdf');
    const second = run(first.store);
    await TestBed.inject(SettingsReset).resetAll();
    expect(await second.choices.verdict(ref('a.pdf'))).toBe('ask');
    expect(first.store.data.has('overwrite')).toBe(false);
  });

  it('FIL-039 the warning about a file is due once per session, also for two calls at once', async () => {
    const { choices } = run();
    const both = await Promise.all([choices.firstWarning(ref('a.pdf')), choices.firstWarning(ref('a.pdf', 'again'))]);
    expect(both).toEqual([true, false]);
    expect(await choices.firstWarning(ref('b.pdf'))).toBe(true);
  });
});
