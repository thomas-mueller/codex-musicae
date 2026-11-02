import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { provideTestDetectionPorts } from '../../testing/provide-test-ports';
import { APP_LIFECYCLE } from '../ports/app-lifecycle';
import { DEVICE_INFO } from '../ports/device-info';
import { FILE_ACCESS } from '../ports/file-access';
import type { OpenedFile } from '../ports/file-access';
import { PDF_RENDERER } from '../ports/pdf-renderer';
import { PREFERENCES } from '../ports/preferences';
import { BitmapCache } from './bitmap-cache';
import { CLOCK } from './clock';
import { PreferencesStore } from './preferences.store';
import { ResourceGovernor } from './resource-governor';
import { SessionStore } from './session.store';
import { fakeBitmap } from './testing/fake-bitmap';
import { FakeClock } from './testing/fake-clock';
import { fakeFileAccess, memoryPreferences } from './testing/fake-ports';
import { fakeRenderer } from './testing/fake-renderer';

const GOOD = 1;
const BAD = 0;

function file(name: string, firstByte = GOOD): OpenedFile {
  return { ref: { id: `id-${name}-${Math.random()}`, name }, bytes: new Uint8Array([firstByte]), writable: true };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Lifecycle fake that remembers the pause callback so a spec can fire it. */
function pausableLifecycle() {
  const pauseCallbacks: Array<() => void | Promise<void>> = [];
  return {
    pause: () => pauseCallbacks.forEach((cb) => void cb()),
    value: {
      visible: signal(true),
      userActive: signal(true),
      batterySaver: signal<boolean | null>(null),
      onPause: (cb: () => void | Promise<void>) => {
        pauseCallbacks.push(cb);
        return () => undefined;
      },
    },
  };
}

function setup(lifecycle = pausableLifecycle()) {
  const clock = new FakeClock();
  const files = fakeFileAccess();
  TestBed.configureTestingModule({
    providers: [
      { provide: PDF_RENDERER, useValue: fakeRenderer('invalid') },
      { provide: FILE_ACCESS, useValue: files },
      { provide: PREFERENCES, useValue: memoryPreferences() },
      ...provideTestDetectionPorts(),
      { provide: APP_LIFECYCLE, useValue: lifecycle.value },
      { provide: CLOCK, useValue: clock },
      { provide: DEVICE_INFO, useValue: { deviceMemoryGb: () => 4, devicePixelRatio: () => 1, prefersReducedMotion: () => false, screenSize: () => ({ width: 1280, height: 800 }) } },
    ],
  });
  return {
    session: TestBed.inject(SessionStore),
    preferences: TestBed.inject(PreferencesStore),
    bitmaps: TestBed.inject(BitmapCache),
    governor: TestBed.inject(ResourceGovernor),
    clock,
    files,
    lifecycle,
  };
}

describe('SessionStore', () => {
  it('FIL-001 opening two files creates two tabs and activates the last', async () => {
    const { session } = setup();
    await session.openFiles([file('a.pdf'), file('b.pdf')]);
    expect(session.tabs().map((t) => t.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(session.activeTab()?.name).toBe('b.pdf');
  });

  it('FIL-002 opening an already open file focuses its tab and forgets the new reference', async () => {
    const { session, files } = setup();
    await session.openFiles([file('a.pdf'), file('b.pdf')]);
    const again = file('a.pdf');
    await session.openFiles([again]);
    expect(session.tabs()).toHaveLength(2);
    expect(session.activeTab()?.name).toBe('a.pdf');
    expect(files.forget).toHaveBeenCalledWith(again.ref);
  });

  it('FIL-002 the same file twice in one selection opens one tab', async () => {
    const { session } = setup();
    await session.openFiles([file('a.pdf'), file('a.pdf')]);
    expect(session.tabs()).toHaveLength(1);
  });

  it('FIL-009 a damaged file becomes a tab in error state and other tabs stay usable', async () => {
    const { session } = setup();
    await session.openFiles([file('bad.pdf', BAD), file('ok.pdf')]);
    await settle();
    const [bad, ok] = session.tabs();
    expect(bad).toMatchObject({ status: 'error', errorCode: 'invalid' });
    expect(ok?.status).toBe('ready');
  });

  it('FIL-005 each tab keeps its own document', async () => {
    const { session } = setup();
    await session.openFiles([file('a.pdf'), file('b.pdf')]);
    await settle();
    const docB = session.activeDocument();
    session.setActive(session.tabs()[0]?.id ?? '');
    expect(session.activeDocument()).not.toBe(docB);
    session.setActive(session.tabs()[1]?.id ?? '');
    expect(session.activeDocument()).toBe(docB);
    expect(docB?.status()).toBe('ready');
  });

  it('FIL-005 closing the active tab selects its right neighbor, else the left one', async () => {
    const { session } = setup();
    await session.openFiles([file('a.pdf'), file('b.pdf'), file('c.pdf')]);
    const [a, b, c] = session.tabs();
    session.setActive(b?.id ?? '');
    session.closeTab(b?.id ?? '');
    expect(session.activeTabId()).toBe(c?.id);
    session.closeTab(c?.id ?? '');
    expect(session.activeTabId()).toBe(a?.id);
    session.closeTab(a?.id ?? '');
    expect(session.activeTabId()).toBeNull();
    expect(session.tabs()).toEqual([]);
  });

  it('FIL-005 closing an inactive tab keeps the active one', async () => {
    const { session } = setup();
    await session.openFiles([file('a.pdf'), file('b.pdf')]);
    const [a, b] = session.tabs();
    session.closeTab(a?.id ?? '');
    expect(session.activeTabId()).toBe(b?.id);
  });

  it('NFR-009 closing a tab frees its bitmaps and destroys its document', async () => {
    const { session, bitmaps } = setup();
    await session.openFiles([file('a.pdf')]);
    await settle();
    const id = session.activeTabId() ?? '';
    const bitmap = fakeBitmap();
    bitmaps.set(`${id}|x`, bitmap);
    session.closeTab(id);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('FIL-008 opened files are added to the recent list', async () => {
    const { session, preferences } = setup();
    await session.openFiles([file('a.pdf'), file('b.pdf')]);
    await preferences.ready;
    expect(preferences.recentFiles().map((r) => r.name)).toEqual(['b.pdf', 'a.pdf']);
  });

  it('NFR-010 at the highest level inactive tabs release their bitmaps, the active tab keeps them', async () => {
    const { session, bitmaps, governor, clock } = setup();
    await session.openFiles([file('a.pdf'), file('b.pdf')]);
    const [a, b] = session.tabs();
    const inactive = fakeBitmap();
    const active = fakeBitmap();
    bitmaps.set(`${a?.id}|x`, inactive);
    bitmaps.set(`${b?.id}|x`, active);
    TestBed.tick();
    expect(inactive.close).not.toHaveBeenCalled();
    for (let i = 0; i < TUNABLES.resources.governorMaxLevel; i++) {
      governor.reportFailure();
      clock.advance(TUNABLES.resources.governorEscalateCooldownMs);
    }
    TestBed.tick();
    expect(inactive.close).toHaveBeenCalledTimes(1);
    expect(active.close).not.toHaveBeenCalled();
  });
});

describe('SessionStore picker and recents', () => {
  function setupPicker() {
    const base = setup();
    return base;
  }

  it('FIL-001 pickAndOpen opens the picked files in tabs', async () => {
    const { session, files } = setupPicker();
    files.pickPdfs = () => Promise.resolve({ ok: true, value: [file('a.pdf'), file('b.pdf')] });
    expect(await session.pickAndOpen()).toBe('opened');
    expect(session.tabs().map((t) => t.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('FIL-001 a dismissed picker is silent and opens nothing', async () => {
    const { session } = setupPicker();
    expect(await session.pickAndOpen()).toBe('cancelled');
    expect(session.tabs()).toEqual([]);
  });

  it('FIL-001 a picker failure is reported as failed', async () => {
    const { session, files } = setupPicker();
    files.pickPdfs = () => Promise.resolve({ ok: false, error: 'denied' });
    expect(await session.pickAndOpen()).toBe('failed');
  });

  it('FIL-008 reopening a recent file opens it', async () => {
    const { session, files } = setupPicker();
    const opened = file('r.pdf');
    files.reopen = () => Promise.resolve({ ok: true, value: opened });
    expect(await session.reopenRecent(opened.ref)).toBe('opened');
    expect(session.tabs().map((t) => t.name)).toEqual(['r.pdf']);
  });

  for (const error of ['not-found', 'denied', 'needs-user-gesture'] as const) {
    it(`FIL-008 ${error} marks the recent file so the next tap offers the picker`, async () => {
      const { session, files } = setupPicker();
      const lost = file('lost.pdf').ref;
      files.reopen = () => Promise.resolve({ ok: false, error });
      expect(await session.reopenRecent(lost)).toBe('repick');
      expect(session.repickIds().has(lost.id)).toBe(true);
      expect(session.tabs()).toEqual([]);
    });
  }

  it('FIL-008 the second tap runs the picker, replaces the old recent entry and clears the mark', async () => {
    const { session, files, preferences } = setupPicker();
    const old = file('lost.pdf').ref;
    await preferences.addRecent(old);
    files.reopen = () => Promise.resolve({ ok: false, error: 'not-found' });
    await session.reopenRecent(old);
    const fresh = file('lost2.pdf');
    files.pickPdfs = () => Promise.resolve({ ok: true, value: [fresh] });
    expect(await session.reopenRecent(old)).toBe('opened');
    await preferences.ready;
    expect(session.repickIds().has(old.id)).toBe(false);
    expect(preferences.recentFiles().map((r) => r.name)).toEqual(['lost2.pdf']);
    expect(session.tabs().map((t) => t.name)).toEqual(['lost2.pdf']);
  });

  it('FIL-003 tabs expose the marker flags of their document', async () => {
    const { session } = setupPicker();
    await session.openFiles([file('a.pdf')]);
    expect(session.tabs()[0]).toMatchObject({ unsaved: false, saveFailed: false, readOnly: false, needsReopen: false });
  });

  const STROKE = { id: 's1', pageIndex: 0, points: [{ x: 1, y: 1 }], color: '#000000', widthPt: 1, opacity: 1, multiply: false };

  it('FIL-016 a file opened non-writable makes a read-only tab', async () => {
    const { session } = setup();
    await session.openFiles([{ ...file('a.pdf'), writable: false }]);
    expect(session.tabs()[0]?.readOnly).toBe(true);
  });

  it('SAV-009 switching tabs saves the tab being left', async () => {
    const { session } = setup();
    await session.openFiles([file('a.pdf'), file('b.pdf')]);
    await settle();
    const [a, b] = session.tabs();
    session.setActive(a?.id ?? '');
    session.activeDocument()?.addStroke(STROKE);
    expect(session.tabs()[0]?.unsaved).toBe(true);
    session.setActive(b?.id ?? '');
    await settle();
    expect(session.tabs()[0]?.unsaved).toBe(false);
  });

  it('SAV-009 pausing the app saves every dirty tab', async () => {
    const { session, lifecycle } = setup();
    await session.openFiles([file('a.pdf')]);
    await settle();
    session.activeDocument()?.addStroke(STROKE);
    expect(session.tabs()[0]?.unsaved).toBe(true);
    lifecycle.pause();
    await settle();
    expect(session.tabs()[0]?.unsaved).toBe(false);
  });
});
