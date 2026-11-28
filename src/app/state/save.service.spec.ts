import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { TUNABLES } from '../../config/tunables';
import { EMPTY_SYSTEM_MARKS } from '../core';
import type { InkStroke } from '../core';
import { DocumentStore } from './document.store';
import { SaveService } from './save.service';
import { FakeClock } from './testing/fake-clock';
import { fakeRenderer } from './testing/fake-renderer';

const IDLE = TUNABLES.saving.autosaveIdleMs;
const STROKE: InkStroke = { id: 's1', pageIndex: 0, points: [{ x: 1, y: 1 }], color: '#000000', widthPt: 1, opacity: 1, multiply: false };

async function setup(results: boolean[] = []) {
  const doc = new DocumentStore('t1', fakeRenderer(), undefined, () => clock.now());
  await doc.load(new Uint8Array([1]));
  const clock = new FakeClock();
  const run = vi.fn(() => Promise.resolve(results.shift() ?? true));
  const saver = new SaveService(doc, clock, run, IDLE, TestBed.inject(Injector));
  TestBed.tick(); // effects take their baseline
  return { doc, clock, run, saver };
}

let breakSeq = 0;
/** A valid marks edit without detection: toggleBreak would be rejected with no systems. */
const editMarks = (doc: DocumentStore) =>
  doc.replaceMarks({ ...EMPTY_SYSTEM_MARKS, breaks: [{ at: { pageIndex: 0, system: ++breakSeq } }] });
const settle = () => new Promise((r) => setTimeout(r, 0));

describe('SaveService (M15 S1)', () => {
  it('SAV-008 saves after the idle delay and the later change moves the deadline', async () => {
    const { doc, clock, run } = await setup();
    doc.addStroke(STROKE);
    clock.advance(IDLE - 1);
    expect(run).not.toHaveBeenCalled();
    editMarks(doc);
    TestBed.tick();
    clock.advance(IDLE - 1);
    expect(run).not.toHaveBeenCalled();
    clock.advance(1);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('SAV-008 FIL-010 the unsaved dot shows while dirty and disappears after a save', async () => {
    const { doc, clock, saver } = await setup();
    doc.addStroke(STROKE);
    expect(doc.unsaved()).toBe(true);
    clock.advance(IDLE);
    await settle();
    expect(doc.unsaved()).toBe(false);
    expect(saver.dirty()).toBe(false);
  });

  it('SAV-008 never saves during a stroke', async () => {
    const { doc, clock, run } = await setup();
    doc.strokeStarted();
    doc.addStroke(STROKE);
    clock.advance(IDLE * 3);
    await settle();
    expect(run).not.toHaveBeenCalled();
    doc.strokeEnded();
    clock.advance(IDLE);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('SAV-009 force saves at once and resolves with the outcome', async () => {
    const { doc, run, saver } = await setup();
    doc.addStroke(STROKE);
    await expect(saver.force()).resolves.toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    await expect(saver.force()).resolves.toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('FIL-010 a failed save shows the error, is not retried, and retries on the next change', async () => {
    const { doc, clock, run, saver } = await setup([false, true]);
    doc.addStroke(STROKE);
    clock.advance(IDLE);
    await settle();
    expect(saver.failed()).toBe(true);
    expect(doc.saveFailed()).toBe(true);
    expect(doc.unsaved()).toBe(false);
    clock.advance(IDLE * 5);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    editMarks(doc);
    TestBed.tick();
    clock.advance(IDLE);
    await settle();
    expect(run).toHaveBeenCalledTimes(2);
    expect(doc.saveFailed()).toBe(false);
  });

  it('SAV-009 a forced trigger retries after a failure and reports it', async () => {
    const { doc, saver } = await setup([false, false]);
    doc.addStroke(STROKE);
    await expect(saver.force()).resolves.toBe(false);
    await expect(saver.force()).resolves.toBe(false);
  });

  it('SAV-008 a change during a save causes another save', async () => {
    const { doc, clock, run } = await setup();
    let release: (v: boolean) => void = () => undefined;
    run.mockImplementationOnce(() => new Promise<boolean>((r) => (release = r)));
    doc.addStroke(STROKE);
    clock.advance(IDLE);
    editMarks(doc);
    TestBed.tick();
    release(true);
    await settle();
    clock.advance(IDLE);
    await settle();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('FIL-016 a read-only tab never saves by itself', async () => {
    const { doc, clock, run } = await setup();
    doc.readOnly.set(true);
    doc.addStroke(STROKE);
    clock.advance(IDLE * 3);
    await settle();
    expect(run).not.toHaveBeenCalled();
  });

  it('SAV-005 restoring metadata is no change; detection completing is', async () => {
    const { doc, clock, run } = await setup();
    doc.detection.reset(2);
    doc.candidate.set(null);
    TestBed.tick();
    doc.detection.finish(0, 'done', { pageIndex: 0, width: 1, height: 1, systems: [] });
    doc.detection.finish(1, 'done', { pageIndex: 1, width: 1, height: 1, systems: [] });
    TestBed.tick();
    clock.advance(IDLE);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('FIL-016 a read-only outcome keeps the changes unsaved without an error and is not retried', async () => {
    const { doc, clock, run } = await setup();
    run.mockImplementationOnce(() => {
      doc.readOnly.set(true);
      return Promise.resolve('readOnly' as never);
    });
    doc.addStroke(STROKE);
    clock.advance(IDLE);
    await settle();
    expect(doc.saveFailed()).toBe(false);
    expect(doc.unsaved()).toBe(true);
    clock.advance(IDLE * 5);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('SAV-005 restoring data after the effects took their baseline is no change (rebaseline), later edits and detection are', async () => {
    const { doc, clock, run, saver } = await setup();
    // the restore happens after the watchers' first run: marks, ratios and a finished detection arrive
    doc.hydrateFromMetadata({
      schemaVersion: 2,
      appVersion: 'v',
      pageCount: 2,
      detection: {
        level: 'standard',
        pages: [0, 1].map((pageIndex) => ({ pageIndex, width: 1, height: 1, state: 'done' as const, systems: [] })),
      },
      marks: { ...EMPTY_SYSTEM_MARKS, breaks: [{ at: { pageIndex: 0, system: 1 } }] },
      aspectRatio: { landscape: 1.4 },
    });
    saver.rebaseline();
    TestBed.tick();
    clock.advance(IDLE * 3);
    await settle();
    expect(run).not.toHaveBeenCalled();
    expect(doc.unsaved()).toBe(false);
    editMarks(doc);
    TestBed.tick();
    clock.advance(IDLE);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('SAV-012 a detection that completes after the rebaseline is a change', async () => {
    const { doc, clock, run, saver } = await setup();
    saver.rebaseline();
    doc.detection.reset(1);
    TestBed.tick();
    doc.detection.finish(0, 'done', { pageIndex: 0, width: 1, height: 1, systems: [] });
    TestBed.tick();
    clock.advance(IDLE);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('FIL-016 a save that needs the permission prompt keeps the changes without an error until access is granted', async () => {
    const { doc, clock, run, saver } = await setup();
    run.mockImplementationOnce(() => {
      doc.needsWriteAccess.set(true);
      return Promise.resolve('needsAccess' as never);
    });
    doc.addStroke(STROKE);
    clock.advance(IDLE);
    await settle();
    expect(doc.saveFailed()).toBe(false);
    expect(doc.unsaved()).toBe(true);
    clock.advance(IDLE * 5);
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    doc.needsWriteAccess.set(false); // the user allowed it
    await expect(saver.force()).resolves.toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
    expect(doc.unsaved()).toBe(false);
  });

  it('SAV-009 dispose stops the timer', async () => {
    const { doc, clock, run, saver } = await setup();
    doc.addStroke(STROKE);
    saver.dispose();
    clock.advance(IDLE * 2);
    await settle();
    expect(run).not.toHaveBeenCalled();
  });
});

describe('SaveService: asking before a write (V2-M6 S2)', () => {
  async function gated({ enabled = true } = {}) {
    const doc = new DocumentStore('t1', fakeRenderer(), undefined, () => clock.now());
    await doc.load(new Uint8Array([1]));
    const clock = new FakeClock();
    const run = vi.fn(() => Promise.resolve(true));
    const answer = { permitted: false };
    const permit = vi.fn(() => Promise.resolve(answer.permitted));
    const onUnwritable = vi.fn();
    const saver = new SaveService(doc, clock, run, IDLE, TestBed.inject(Injector), enabled, { permit, onUnwritable });
    TestBed.tick();
    return { doc, clock, run, saver, permit, answer, onUnwritable };
  }

  it('FIL-034 while the answer is missing nothing is written, the marker stays and no timer asks again', async () => {
    const { doc, clock, run, saver, permit } = await gated();
    doc.addStroke(STROKE);
    clock.advance(IDLE);
    await settle();
    expect(permit).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
    expect(doc.unsaved()).toBe(true);
    expect(doc.saveHeld()).toBe(true);
    editMarks(doc);
    TestBed.tick();
    clock.advance(IDLE * 3);
    await saver.force();
    expect(permit).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
    expect(saver.dirty()).toBe(true);
  });

  it('FIL-033 after the answer resume saves the waiting changes, and later saves run', async () => {
    const { doc, clock, run, saver, answer } = await gated();
    doc.addStroke(STROKE);
    clock.advance(IDLE);
    await settle();
    answer.permitted = true;
    saver.resume();
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    expect(doc.unsaved()).toBe(false);
    editMarks(doc);
    TestBed.tick();
    clock.advance(IDLE);
    await settle();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('FIL-035 the save due after detection asks as well', async () => {
    const { doc, clock, run, permit } = await gated();
    doc.detection.reset(1);
    TestBed.tick();
    doc.detection.finish(0, 'done', { pageIndex: 0, width: 1, height: 1, systems: [] });
    TestBed.tick();
    clock.advance(IDLE);
    await settle();
    expect(permit).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });

  for (const [what, enabled, readOnly] of [['a read-only file', true, true], ['a build that does not save', false, false]] as const) {
    it(`FIL-047 SAV-012 detection alone does not mark ${what} as changed`, async () => {
      const { doc, saver, onUnwritable } = await gated({ enabled });
      doc.readOnly.set(readOnly);
      doc.detection.reset(1);
      TestBed.tick();
      doc.detection.finish(0, 'done', { pageIndex: 0, width: 1, height: 1, systems: [] });
      TestBed.tick();
      expect(saver.dirty()).toBe(false);
      expect(doc.unsaved()).toBe(false);
      expect(onUnwritable).not.toHaveBeenCalled();
    });
  }

  it('FIL-039 a change of a read-only file reports it, after the stroke, and writes nothing', async () => {
    const { doc, clock, run, onUnwritable } = await gated();
    doc.readOnly.set(true);
    doc.strokeStarted();
    expect(onUnwritable).not.toHaveBeenCalled();
    doc.addStroke(STROKE);
    doc.strokeEnded();
    expect(onUnwritable).toHaveBeenCalled();
    clock.advance(IDLE * 3);
    await settle();
    expect(run).not.toHaveBeenCalled();
    expect(doc.unsaved()).toBe(true);
  });

  it('FIL-037 saveNow runs its own save although the autosave is held; a failure keeps the changes', async () => {
    const { doc, clock, run, saver } = await gated();
    doc.addStroke(STROKE);
    clock.advance(IDLE);
    await settle();
    await expect(saver.saveNow(() => Promise.resolve(false))).resolves.toBe(false);
    expect(saver.dirty()).toBe(true);
    expect(doc.saveFailed()).toBe(true);
    await expect(saver.saveNow(() => Promise.resolve(true))).resolves.toBe(true);
    expect(saver.dirty()).toBe(false);
    expect(doc.saveFailed()).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});
