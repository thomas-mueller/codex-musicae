import { TestBed } from '@angular/core/testing';

import { ALL_FEATURES_ON, provideTestPorts } from './provide-test-ports';
import { OPEN_WITH } from '../app/ports/open-with';
import { FEATURE_FLAGS } from '../app/ports/feature-flags';
import type { FeatureFlags } from '../app/ports/feature-flags';
import { FILE_ACCESS } from '../app/ports/file-access';
import type { OpenedFile } from '../app/ports/file-access';
import { PREFERENCES } from '../app/ports/preferences';
import { IncomingFilesService } from '../app/state/incoming-files.service';
import { FeaturePreferences } from '../app/adapters/feature/feature-preferences';
import { SessionStore } from '../app/state/session.store';
import { SessionPersistence } from '../app/state/session-persistence';
import { fakeFileAccess, memoryPreferences } from '../app/state/testing/fake-ports';

const FREE: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;
const FILE: OpenedFile = { ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true };
const STROKE = { id: 's1', pageIndex: 0, points: [{ x: 1, y: 1 }], color: '#000000', widthPt: 1, opacity: 1, multiply: false };
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** The stores see the preferences through the switch-aware wrapper, as the composition root provides them. */
function setup(flags: FeatureFlags, prefs = memoryPreferences(), onIncomingFiles = vi.fn(() => () => undefined)) {
  const files = fakeFileAccess();
  TestBed.configureTestingModule({
    providers: [...provideTestPorts(), { provide: FILE_ACCESS, useValue: files }, { provide: PREFERENCES, useValue: new FeaturePreferences(prefs, flags) },
      { provide: FEATURE_FLAGS, useValue: flags },
      { provide: OPEN_WITH, useValue: { onIncomingFiles } },
    ],
  });
  return { files, prefs, session: TestBed.inject(SessionStore) };
}

describe('free edition behavior', () => {
  it('EDN-002 EDN-011 annotations work in memory, show the modified marker and are lost on close without any write', async () => {
    const { files, session } = setup(FREE);
    await session.openFiles([FILE]);
    await settle();
    session.activeDocument()?.addStroke(STROKE);
    TestBed.tick();
    expect(session.activeDocument()?.strokes()).toHaveLength(1);
    expect(session.activeTab()?.unsaved).toBe(true);
    expect(await session.closeTab(session.activeTabId() ?? '')).toBe(true);
    expect(files.write).not.toHaveBeenCalled();
    expect(files.saveCopy).not.toHaveBeenCalled();
    expect(files.requestWriteAccess).not.toHaveBeenCalled();
  });

  it('EDN-001 EDN-011 saving a copy and asking for write access do nothing', async () => {
    const { files, session } = setup(FREE);
    await session.openFiles([FILE]);
    await settle();
    expect((await session.saveCopy()).ok).toBe(false);
    expect(await session.grantWriteAccess(session.activeTabId() ?? '')).toBe(false);
    expect(files.saveCopy).not.toHaveBeenCalled();
    expect(files.requestWriteAccess).not.toHaveBeenCalled();
  });

  it('EDN-005 the session is neither restored nor written', async () => {
    const stored = { version: 1, tabs: [{ ref: FILE.ref, system: 0, orgPage: 0, orgOffset: 0 }], activeIndex: 0 };
    const prefs = memoryPreferences({ session: stored });
    const { session } = setup(FREE, prefs);
    TestBed.inject(SessionPersistence);
    await session.restore();
    expect(session.tabs()).toHaveLength(0);
    expect(session.restored()).toBe(true);
    await session.openFiles([{ ...FILE, ref: { id: 'b', name: 'b.pdf' } }]);
    TestBed.tick();
    await TestBed.inject(SessionPersistence).flush();
    expect(prefs.data.get('session')).toEqual(stored);
  });

  it('EDN-005 no recent file is stored when a file is opened', async () => {
    const { prefs, session } = setup(FREE);
    await session.openFiles([FILE]);
    await settle();
    expect(prefs.data.size).toBe(0);
  });

  it('EDN-001 files handed over by the system are ignored', () => {
    const onIncomingFiles = vi.fn(() => () => undefined);
    setup(FREE, memoryPreferences(), onIncomingFiles);
    TestBed.inject(IncomingFilesService);
    expect(onIncomingFiles).not.toHaveBeenCalled();
  });

  it('EDN-008 with shareIn on the incoming files are subscribed', () => {
    const onIncomingFiles = vi.fn(() => () => undefined);
    setup(ALL_FEATURES_ON, memoryPreferences(), onIncomingFiles);
    TestBed.inject(IncomingFilesService);
    expect(onIncomingFiles).toHaveBeenCalledTimes(1);
  });

  it('EDN-008 EDN-001 with every switch on the same file is saved by closing the tab', async () => {
    const { files, session } = setup(ALL_FEATURES_ON);
    await session.openFiles([FILE]);
    await settle();
    session.activeDocument()?.addStroke(STROKE);
    TestBed.tick();
    await session.closeTab(session.activeTabId() ?? '');
    expect(files.write).toHaveBeenCalled();
  });
});
