import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { TUNABLES } from '../../config/tunables';
import { serializeMetadata } from '../core';
import type { EmbeddedMetadata } from '../core';
import { provideTestDetectionPorts, provideTestSavePorts } from '../../testing/provide-test-ports';
import { APP_LIFECYCLE } from '../ports/app-lifecycle';
import { DEVICE_INFO } from '../ports/device-info';
import { FILE_ACCESS } from '../ports/file-access';
import type { OpenedFile } from '../ports/file-access';
import { PDF_RENDERER } from '../ports/pdf-renderer';
import { PDF_WRITER } from '../ports/pdf-writer';
import type { ExistingInk } from '../ports/pdf-writer';
import { err, ok } from '../ports/result';
import { PREFERENCES } from '../ports/preferences';
import { BitmapCache } from './bitmap-cache';
import { CLOCK } from './clock';
import { DetectionService } from './detection.service';
import { PreferencesStore } from './preferences.store';
import { ResourceGovernor } from './resource-governor';
import { SessionStore } from './session.store';
import { fakeBitmap } from './testing/fake-bitmap';
import { FakeClock } from './testing/fake-clock';
import { fakeFileAccess, memoryPreferences } from './testing/fake-ports';
import type { FakePdfWriter } from './testing/fake-ports';
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
      ...provideTestSavePorts(),
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
    writer: TestBed.inject(PDF_WRITER) as FakePdfWriter,
    detection: TestBed.inject(DetectionService),
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

  describe('saving (M15 S3)', () => {
    it('FIL-006 closing a tab with unsaved changes saves first and then closes it', async () => {
      const { session, files } = setup();
      await session.openFiles([file('a.pdf')]);
      await settle();
      const id = session.activeTabId() ?? '';
      session.activeDocument()?.addStroke(STROKE);
      expect(await session.closeTab(id)).toBe(true);
      expect(files.write).toHaveBeenCalledTimes(1);
      expect(session.tabs()).toEqual([]);
    });

    it('FIL-006 a failed save keeps the tab open with the error icon', async () => {
      const { session, files } = setup();
      files.write.mockResolvedValue(err('write-failed'));
      await session.openFiles([file('a.pdf')]);
      await settle();
      session.activeDocument()?.addStroke(STROKE);
      expect(await session.closeTab(session.activeTabId() ?? '')).toBe(false);
      expect(session.tabs()).toHaveLength(1);
      expect(session.tabs()[0]).toMatchObject({ saveFailed: true });
      expect(session.activeDocument()?.strokes()).toHaveLength(1);
    });

    it('FIL-016 a read-only tab closes without writing', async () => {
      const { session, files } = setup();
      await session.openFiles([{ ...file('a.pdf'), writable: false }]);
      await settle();
      session.activeDocument()?.addStroke(STROKE);
      expect(await session.closeTab(session.activeTabId() ?? '')).toBe(true);
      expect(files.write).not.toHaveBeenCalled();
    });

    it('FIL-016 a write that is denied turns the tab read-only and never retries by itself', async () => {
      const { session, files, clock } = setup();
      files.write.mockResolvedValue(err('denied'));
      await session.openFiles([file('a.pdf')]);
      await settle();
      session.activeDocument()?.addStroke(STROKE);
      clock.advance(TUNABLES.saving.autosaveIdleMs);
      await settle();
      expect(session.tabs()[0]).toMatchObject({ readOnly: true, unsaved: true, saveFailed: false });
      clock.advance(TUNABLES.saving.autosaveIdleMs * 5);
      await settle();
      expect(files.write).toHaveBeenCalledTimes(1);
    });

    it('SAV-011 PLT-010 save a copy works for writable and read-only tabs and keeps the changes unsaved', async () => {
      const { session, files } = setup();
      await session.openFiles([file('a.pdf'), { ...file('b.pdf'), writable: false }]);
      await settle();
      session.activeDocument()?.addStroke(STROKE);
      expect((await session.saveCopy()).ok).toBe(true);
      expect(files.saveCopy).toHaveBeenLastCalledWith('b (annotated).pdf', expect.any(Uint8Array));
      expect((await session.saveCopy(session.tabs()[0]?.id)).ok).toBe(true);
      expect(files.saveCopy).toHaveBeenLastCalledWith('a (annotated).pdf', expect.any(Uint8Array));
      expect(session.tabs()[1]?.unsaved).toBe(true);
      expect(files.write).not.toHaveBeenCalled();
    });
  });

  describe('permission to write (FIL-016)', () => {
    async function pendingPermission() {
      const ports = setup();
      ports.files.write.mockResolvedValueOnce(err('needs-user-gesture'));
      await ports.session.openFiles([file('a.pdf'), file('b.pdf')]);
      await settle();
      const [a, b] = ports.session.tabs();
      ports.session.setActive(a?.id ?? '');
      ports.session.activeDocument()?.addStroke(STROKE);
      ports.clock.advance(TUNABLES.saving.autosaveIdleMs);
      await settle();
      return { ...ports, a: a?.id ?? '', b: b?.id ?? '' };
    }

    it('FIL-016 an autosave that cannot ask for the permission leaves the tab unsaved, flagged, and does not retry', async () => {
      const { session, files, clock } = await pendingPermission();
      expect(session.tabs()[0]).toMatchObject({ needsWriteAccess: true, unsaved: true, saveFailed: false, readOnly: false });
      clock.advance(TUNABLES.saving.autosaveIdleMs * 5);
      await settle();
      expect(files.write).toHaveBeenCalledTimes(1);
    });

    it('FIL-016 selecting the tab asks for the permission inside the click and then saves', async () => {
      const { session, files, a, b } = await pendingPermission();
      session.setActive(b);
      await settle();
      session.setActive(a);
      await settle();
      expect(files.requestWriteAccess).toHaveBeenCalledTimes(1);
      expect(files.write).toHaveBeenCalledTimes(2);
      expect(session.tabs()[0]).toMatchObject({ needsWriteAccess: false, unsaved: false });
    });

    it('FIL-016 a refused permission makes the tab read-only', async () => {
      const { session, files, a } = await pendingPermission();
      files.requestWriteAccess.mockResolvedValueOnce(err('denied'));
      expect(await session.grantWriteAccess(a)).toBe(false);
      expect(session.tabs()[0]).toMatchObject({ readOnly: true, needsWriteAccess: false });
    });

    it('FIL-006 FIL-016 closing such a tab asks for the permission first and saves before it closes', async () => {
      const { session, files, a } = await pendingPermission();
      expect(await session.closeTab(a)).toBe(true);
      expect(files.requestWriteAccess).toHaveBeenCalledTimes(1);
      expect(files.write).toHaveBeenCalledTimes(2);
      expect(session.tabs().map((t) => t.id)).not.toContain(a);
    });

    it('FIL-006 closing such a tab with a refused permission keeps it open', async () => {
      const { session, files, a } = await pendingPermission();
      files.requestWriteAccess.mockResolvedValueOnce(err('denied'));
      expect(await session.closeTab(a)).toBe(false);
      expect(session.tabs().map((t) => t.id)).toContain(a);
    });
  });

  describe('reading existing data on open (M15 S4)', () => {
    const META: EmbeddedMetadata = {
      schemaVersion: 1,
      appVersion: 'v-old',
      pageCount: 2,
      detection: {
        level: 'standard',
        pages: [0, 1].map((pageIndex) => ({ pageIndex, width: 600, height: 800, state: 'done' as const, systems: [{ x: 10, y: 20, width: 500, height: 100 }] })),
      },
      marks: { jumps: [{ id: 1, origin: 2, target: 0, pass: 1 }], breaks: [], stops: [], nextJumpId: 2 },
      aspectRatio: { landscape: 1.5 },
    };
    const INK: ExistingInk[] = [
      { pageIndex: 0, annotationRef: 'nm:x', strokeId: 'x', points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], color: '#ff0000', widthPt: 2, opacity: 1 },
      { pageIndex: 1, annotationRef: 'obj:7', strokeId: null, points: [{ x: 5, y: 6 }], color: '#ffff00', widthPt: 8, opacity: 0.35 },
    ];

    async function openWith(patch: (ports: ReturnType<typeof setup>) => void, writable = true) {
      const ports = setup();
      patch(ports);
      const start = vi.spyOn(ports.detection, 'start').mockImplementation(() => undefined);
      await ports.session.openFiles([{ ...file('a.pdf'), writable }]);
      await settle();
      TestBed.tick();
      const doc = ports.session.activeDocument();
      if (!doc) {
        throw new Error('no document');
      }
      return { ...ports, start, doc };
    }

    it('SAV-005 DET-023 valid metadata is hydrated and detection is not started', async () => {
      const { doc, start } = await openWith(({ writer }) => writer.readEmbeddedJson.mockResolvedValue(ok(serializeMetadata(META))));
      expect(start).not.toHaveBeenCalled();
      expect(doc.marks().jumps).toEqual([{ id: 1, origin: 2, target: 0, pass: 1 }]);
      expect(doc.ratioOverride()).toEqual({ landscape: 1.5 });
      expect(doc.detectionComplete()).toBe(true);
      expect(doc.detection.startedOrder).toEqual([]);
    });

    it('DET-023 a file without embedded data is detected as usual', async () => {
      const { start, doc } = await openWith(() => undefined);
      expect(start).toHaveBeenCalledTimes(1);
      expect(doc.marks().jumps).toEqual([]);
    });

    it('SAV-002 invalid embedded data is ignored and detection runs', async () => {
      const { start, doc } = await openWith(({ writer }) => writer.readEmbeddedJson.mockResolvedValue(ok('{"schemaVersion":1}')));
      expect(start).toHaveBeenCalledTimes(1);
      expect(doc.marks().jumps).toEqual([]);
    });

    it('SAV-005 embedded data for another page count is ignored and detection runs', async () => {
      const other = serializeMetadata({ ...META, pageCount: 3, detection: null });
      const { start, doc } = await openWith(({ writer }) => writer.readEmbeddedJson.mockResolvedValue(ok(other)));
      expect(start).toHaveBeenCalledTimes(1);
      expect(doc.marks().jumps).toEqual([]);
    });

    it('SAV-002 a failing read counts as no data', async () => {
      const { start } = await openWith(({ writer }) => {
        writer.readEmbeddedJson.mockResolvedValue(err('invalid-pdf'));
        writer.listInk.mockResolvedValue(err('invalid-pdf'));
      });
      expect(start).toHaveBeenCalledTimes(1);
    });

    it('SAV-003 metadata of a newer version is never overwritten, the ink still is saved', async () => {
      const { session, writer, start, doc } = await openWith(({ writer: w }) =>
        w.readEmbeddedJson.mockResolvedValue(ok(serializeMetadata({ ...META, schemaVersion: 2 }))),
      );
      expect(start).toHaveBeenCalledTimes(1);
      doc.addStroke({ id: 'n', pageIndex: 0, points: [{ x: 1, y: 1 }], color: '#000000', widthPt: 1, opacity: 1, multiply: false });
      expect(await session.closeTab(session.activeTabId() ?? '')).toBe(true);
      const edits = writer.apply.mock.calls.at(-1)?.[1];
      expect(edits?.embeddedJson).toBeNull();
      expect(edits?.addInk).toHaveLength(1);
    });

    it('SAV-006 ANN-005 ink of the file is loaded as saved strokes without undo step or dirty mark', async () => {
      const { doc, files, clock } = await openWith(({ writer }) => writer.listInk.mockResolvedValue(ok(INK)));
      expect(doc.strokes().map((s) => [s.id, s.multiply])).toEqual([['x', false], ['obj:7', true]]);
      expect(doc.canUndo()).toBe(false);
      expect(doc.unsaved()).toBe(false);
      clock.advance(TUNABLES.saving.autosaveIdleMs * 2);
      await settle();
      expect(files.write).not.toHaveBeenCalled();
    });

    it('ANN-005 erasing ink made by another app removes it from the file by its own reference', async () => {
      const { session, writer, doc } = await openWith(({ writer: w }) => w.listInk.mockResolvedValue(ok(INK)));
      doc.eraseStrokes(doc.strokes().filter((s) => s.id === 'obj:7'));
      expect(await session.closeTab(session.activeTabId() ?? '')).toBe(true);
      const edits = writer.apply.mock.calls.at(-1)?.[1];
      expect(edits?.addInk).toEqual([]);
      expect(edits?.removeInk).toEqual([{ pageIndex: 1, annotationRef: 'obj:7' }]);
    });

    it('SAV-005 opening a file with embedded data is not an edit', async () => {
      const { files, clock, doc } = await openWith(({ writer }) => writer.readEmbeddedJson.mockResolvedValue(ok(serializeMetadata(META))));
      TestBed.tick();
      clock.advance(TUNABLES.saving.autosaveIdleMs * 2);
      await settle();
      expect(doc.unsaved()).toBe(false);
      expect(files.write).not.toHaveBeenCalled();
    });

    it('SAV-012 detection completing on a writable file without embedded detection writes it once', async () => {
      const { doc, files, clock } = await openWith(() => undefined);
      doc.detection.reset(2);
      TestBed.tick();
      doc.detection.finish(0, 'done', { pageIndex: 0, width: 600, height: 800, systems: [] });
      doc.detection.finish(1, 'done', { pageIndex: 1, width: 600, height: 800, systems: [] });
      TestBed.tick();
      clock.advance(TUNABLES.saving.autosaveIdleMs);
      await settle();
      expect(files.write).toHaveBeenCalledTimes(1);
      clock.advance(TUNABLES.saving.autosaveIdleMs * 5);
      await settle();
      expect(files.write).toHaveBeenCalledTimes(1);
    });

    it('SAV-012 a read-only file is never written when its detection completes', async () => {
      const { doc, files, clock } = await openWith(() => undefined, false);
      doc.detection.reset(1);
      TestBed.tick();
      doc.detection.finish(0, 'done', { pageIndex: 0, width: 600, height: 800, systems: [] });
      TestBed.tick();
      clock.advance(TUNABLES.saving.autosaveIdleMs * 2);
      await settle();
      expect(files.write).not.toHaveBeenCalled();
    });

    it('SAV-014 switching tabs never loses unsaved ink, and a failed save keeps it too', async () => {
      const { session, files } = setup();
      files.write.mockResolvedValue(err('write-failed'));
      await session.openFiles([file('a.pdf'), file('b.pdf')]);
      await settle();
      const [a, b] = session.tabs();
      session.setActive(a?.id ?? '');
      session.activeDocument()?.addStroke(STROKE);
      session.setActive(b?.id ?? '');
      await settle();
      session.setActive(a?.id ?? '');
      expect(session.activeDocument()?.strokes().map((s) => s.id)).toEqual(['s1']);
      expect(session.tabs()[0]).toMatchObject({ saveFailed: true });
    });

    it('SAV-005 closing a tab while its data is read starts no detection', async () => {
      const ports = setup();
      let release: (value: ReturnType<typeof ok<null>>) => void = () => undefined;
      ports.writer.readEmbeddedJson.mockImplementation(() => new Promise((resolve) => (release = resolve as typeof release)));
      const start = vi.spyOn(ports.detection, 'start').mockImplementation(() => undefined);
      await ports.session.openFiles([file('a.pdf')]);
      await settle();
      await ports.session.closeTab(ports.session.activeTabId() ?? '');
      release(ok(null));
      await settle();
      expect(start).not.toHaveBeenCalled();
    });
  });
});
