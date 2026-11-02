import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { provideTestPorts } from '../../testing/provide-test-ports';
import { FILE_ACCESS } from '../ports/file-access';
import type { FileRef, OpenedFile } from '../ports/file-access';
import { PREFERENCES } from '../ports/preferences';
import { err, ok } from '../ports/result';
import type { DocumentStore } from './document.store';
import { SessionStore } from './session.store';
import { fakeFileAccess, memoryPreferences } from './testing/fake-ports';
import { UiStore } from './ui.store';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

const stored = (activeIndex = 0) => ({
  version: 1,
  tabs: [
    { ref: { id: 'a', name: 'a.pdf' }, system: 4, orgPage: 1, orgOffset: 12.5 },
    { ref: { id: 'b', name: 'b.pdf' }, system: 2, orgPage: 0, orgOffset: 0 },
  ],
  activeIndex,
});

const opened = (ref: FileRef): OpenedFile => ({ ref, bytes: new Uint8Array([1]), writable: true });

function setup(session: unknown, reopen: (ref: FileRef) => ReturnType<ReturnType<typeof fakeFileAccess>['reopen']>) {
  const files = fakeFileAccess();
  files.reopen = vi.fn(reopen);
  const prefs = memoryPreferences(session === undefined ? {} : { session });
  TestBed.configureTestingModule({
    providers: [...provideTestPorts(), { provide: FILE_ACCESS, useValue: files }, { provide: PREFERENCES, useValue: prefs }],
  });
  return { files, store: TestBed.inject(SessionStore), ui: TestBed.inject(UiStore) };
}

/** Makes a document's detection final: 2 pages of 3 systems each. */
function finishDetection(document: DocumentStore): void {
  document.detection.reset(2);
  const systems = [0, 1, 2].map((i) => ({ x: 50, y: 50 + i * 250, width: 500, height: 150 }));
  for (const pageIndex of [0, 1]) {
    document.detection.finish(pageIndex, 'done', { pageIndex, width: 600, height: 800, systems });
  }
}

describe('SessionStore.restore', () => {
  it('FIL-011 reopens the stored tabs in order and selects the active one', async () => {
    const { store } = setup(stored(1), (ref) => Promise.resolve(ok(opened(ref))));
    await store.restore();
    await settle();
    expect(store.tabs().map((t) => t.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(store.tabs().map((t) => t.status)).toEqual(['ready', 'ready']);
    expect(store.activeTab()?.name).toBe('b.pdf');
    expect(store.restored()).toBe(true);
  });

  it('FIL-011 nothing stored, or garbage stored, restores nothing', async () => {
    for (const value of [undefined, 'garbage', { version: 2, tabs: [] }]) {
      TestBed.resetTestingModule();
      const { store } = setup(value, () => Promise.resolve(err('not-found')));
      await store.restore();
      expect(store.tabs()).toEqual([]);
      expect(store.restored()).toBe(true);
    }
  });

  it('FIL-013 a file that cannot be reopened leaves a placeholder tab marked needs-reopen', async () => {
    const reasons = ['not-found', 'denied', 'needs-user-gesture'] as const;
    for (const reason of reasons) {
      TestBed.resetTestingModule();
      const { store } = setup(stored(), () => Promise.resolve(err(reason)));
      await store.restore();
      expect(store.tabs().map((t) => [t.name, t.status, t.needsReopen])).toEqual([
        ['a.pdf', 'restoring', true],
        ['b.pdf', 'restoring', true],
      ]);
    }
  });

  it('FIL-012 the mode is annotation and no tool is active after a restore', async () => {
    const { store, ui } = setup(stored(), (ref) => Promise.resolve(ok(opened(ref))));
    ui.mode.set('presentation');
    ui.tool.set('pen');
    TestBed.inject(UiStore); // the restore itself must not need the UI mode
    await store.restore();
    await settle();
    // a fresh start: mode and tool are the UiStore defaults
    TestBed.resetTestingModule();
    const fresh = setup(stored(), (ref) => Promise.resolve(ok(opened(ref))));
    await fresh.store.restore();
    expect(fresh.ui.mode()).toBe('annotation');
    expect(fresh.ui.tool()).toBeNull();
  });

  it('FIL-014 the stored system becomes the current slide once the document and its detection are final', async () => {
    const { store } = setup(stored(), (ref) => Promise.resolve(ok(opened(ref))));
    await store.restore();
    await settle();
    const doc = store.activeDocument()!;
    expect(doc.status()).toBe('ready');
    expect(doc.position().system).toBe(1); // detection is not final yet: nothing applied
    finishDetection(store.activeDocument()!);
    TestBed.tick();
    expect(doc.position().system).toBe(4);
    expect(doc.orgRestore()).toEqual({ page: 1, offset: 12.5 }); // kept for the organization viewer
  });

  it('FIL-014 a stored system beyond the playing order lands on its last entry (findEntryForSystem)', async () => {
    const files = stored();
    files.tabs[0]!.system = 99;
    const { store } = setup(files, (ref) => Promise.resolve(ok(opened(ref))));
    await store.restore();
    await settle();
    finishDetection(store.activeDocument()!);
    TestBed.tick();
    const doc = store.activeDocument()!;
    expect(doc.position().entry).toBe(doc.playingOrder().entries.length - 1);
  });

  it('FIL-013 a tap on a marked tab calls reopen synchronously, inside the click', async () => {
    let allow = false;
    const { store, files } = setup(stored(), (ref) => Promise.resolve(allow ? ok(opened(ref)) : err('needs-user-gesture')));
    await store.restore();
    const calls = (files.reopen as ReturnType<typeof vi.fn>).mock.calls.length;
    allow = true;
    store.setActive(store.tabs()[1]!.id);
    expect((files.reopen as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls + 1);
    await settle();
    expect(store.tabs()[1]).toMatchObject({ status: 'ready', needsReopen: false });
  });

  it('FIL-013 FIL-014 a tab whose file is gone is re-picked by the same tap and keeps its position', async () => {
    const { store, files } = setup(stored(), () => Promise.resolve(err('not-found')));
    await store.restore();
    const picked = opened({ id: 'new-id', name: 'moved.pdf' });
    files.pickPdfs = vi.fn(() => Promise.resolve(ok([picked])));
    store.setActive(store.tabs()[0]!.id);
    await settle();
    expect(files.pickPdfs).toHaveBeenCalledTimes(1);
    expect(store.tabs()[0]).toMatchObject({ name: 'moved.pdf', needsReopen: false, status: 'ready' });
    expect(files.forget).toHaveBeenCalledWith({ id: 'a', name: 'a.pdf' });
    finishDetection(store.activeDocument()!);
    TestBed.tick();
    expect(store.activeDocument()!.position().system).toBe(4);
  });

  it('FIL-013 cancelling the picker leaves the tab marked', async () => {
    const { store, files } = setup(stored(), () => Promise.resolve(err('not-found')));
    await store.restore();
    files.pickPdfs = vi.fn(() => Promise.resolve(err('cancelled')));
    store.setActive(store.tabs()[0]!.id);
    await settle();
    expect(store.tabs()[0]).toMatchObject({ name: 'a.pdf', needsReopen: true, status: 'restoring' });
  });
});
