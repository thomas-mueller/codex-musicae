import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
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

function setup() {
  const clock = new FakeClock();
  const files = fakeFileAccess();
  TestBed.configureTestingModule({
    providers: [
      { provide: PDF_RENDERER, useValue: fakeRenderer('invalid') },
      { provide: FILE_ACCESS, useValue: files },
      { provide: PREFERENCES, useValue: memoryPreferences() },
      { provide: CLOCK, useValue: clock },
      { provide: DEVICE_INFO, useValue: { deviceMemoryGb: () => 4, devicePixelRatio: () => 1 } },
    ],
  });
  return {
    session: TestBed.inject(SessionStore),
    preferences: TestBed.inject(PreferencesStore),
    bitmaps: TestBed.inject(BitmapCache),
    governor: TestBed.inject(ResourceGovernor),
    clock,
    files,
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
