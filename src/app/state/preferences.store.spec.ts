import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { FILE_ACCESS } from '../ports/file-access';
import type { FileRef } from '../ports/file-access';
import { PREFERENCES } from '../ports/preferences';
import { PreferencesStore } from './preferences.store';
import { fakeFileAccess, memoryPreferences } from './testing/fake-ports';

const ref = (id: string, name = `${id}.pdf`): FileRef => ({ id, name });

function setup(initial: Record<string, unknown> = {}) {
  const preferences = memoryPreferences(initial);
  const files = fakeFileAccess();
  TestBed.configureTestingModule({
    providers: [
      { provide: PREFERENCES, useValue: preferences },
      { provide: FILE_ACCESS, useValue: files },
    ],
  });
  return { store: TestBed.inject(PreferencesStore), preferences, files };
}

describe('PreferencesStore', () => {
  it('FIL-008 lists recent files newest first', async () => {
    const { store } = setup();
    await store.addRecent(ref('a'));
    await store.addRecent(ref('b'));
    expect(store.recentFiles().map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('FIL-008 moves a reopened file to the front without duplicating it', async () => {
    const { store } = setup();
    await store.addRecent(ref('a'));
    await store.addRecent(ref('b'));
    await store.addRecent(ref('a2', 'a.pdf'));
    expect(store.recentFiles().map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('FIL-008 forgets the handle of a duplicate that is not open', async () => {
    const { store, files } = setup();
    await store.addRecent(ref('a'));
    await store.addRecent(ref('a2', 'a.pdf'));
    expect(files.forget).toHaveBeenCalledWith(ref('a2', 'a.pdf'));
  });

  it('FIL-008 keeps the handle of a duplicate that is open in a tab', async () => {
    const { store, files } = setup();
    await store.addRecent(ref('a'));
    await store.addRecent(ref('a2', 'a.pdf'), (id) => id === 'a2');
    expect(files.forget).not.toHaveBeenCalled();
  });

  it('FIL-008 keeps at most recentFilesMax entries and forgets the evicted handles', async () => {
    const { store, files } = setup();
    const max = TUNABLES.resources.recentFilesMax;
    for (let i = 0; i <= max; i++) {
      await store.addRecent(ref(`f${i}`));
    }
    expect(store.recentFiles()).toHaveLength(max);
    expect(store.recentFiles()[0]?.id).toBe(`f${max}`);
    expect(files.forget).toHaveBeenCalledWith(ref('f0'));
  });

  it('FIL-015 persists the list through the Preferences port', async () => {
    const { store, preferences } = setup();
    await store.addRecent(ref('a'));
    expect(preferences.data.get('recent')).toEqual([ref('a')]);
  });

  it('FIL-015 restores the stored list', async () => {
    const { store } = setup({ recent: [ref('x'), ref('y')] });
    await store.ready;
    expect(store.recentFiles().map((r) => r.id)).toEqual(['x', 'y']);
  });

  it('FIL-015 ignores a malformed stored value', async () => {
    const { store } = setup({ recent: 'broken' });
    await store.ready;
    expect(store.recentFiles()).toEqual([]);
  });

  it('FIL-008 removeRecent drops the entry and forgets its handle', async () => {
    const { store, files } = setup();
    await store.addRecent(ref('a'));
    await store.removeRecent(ref('a'));
    expect(store.recentFiles()).toEqual([]);
    expect(files.forget).toHaveBeenCalledWith(ref('a'));
  });

  it('SLD-014 stores and restores the global ratio per orientation', async () => {
    const { store, preferences } = setup({ 'ratio.portrait': 0.7, 'ratio.landscape': 'broken' });
    await store.ready;
    expect(store.globalRatios()).toEqual({ portrait: 0.7 });
    await store.setGlobalRatio('landscape', 1.6);
    expect(store.globalRatios()).toEqual({ portrait: 0.7, landscape: 1.6 });
    expect(preferences.data.get('ratio.landscape')).toBe(1.6);
  });
});
