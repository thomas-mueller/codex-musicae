import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import type { Rect } from '../core';
import { APP_LIFECYCLE } from '../ports/app-lifecycle';
import { DETECTION_ENGINE } from '../ports/detection-engine';
import { err, ok } from '../ports/result';
import { CLOCK } from './clock';
import { DetectionService } from './detection.service';
import { DocumentStore } from './document.store';
import { fakeBitmap } from './testing/fake-bitmap';
import { FakeClock } from './testing/fake-clock';
import { fakeRenderer } from './testing/fake-renderer';

const PAGES = 2;
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const FIRST: Rect = { x: 50, y: 100, width: 500, height: 60 };
const SECOND: Rect = { x: 50, y: 300, width: 500, height: 60 };
const ACTIVE_LEVEL = TUNABLES.detection.defaultLevel;
const NEW_LEVEL = ACTIVE_LEVEL === 'fine' ? 'fast' : 'fine';

const until = async (condition: () => boolean): Promise<void> => {
  for (let i = 0; i < 400 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(condition()).toBe(true);
};

/** The engine finds one system per page at the active level and `candidateSystems` per page at the new level. */
function setup(candidateSystems: 1 | 2 | 'fail') {
  const renderer = fakeRenderer('invalid', PAGES);
  const lifecycle = { visible: signal(true), userActive: signal(false), batterySaver: signal<boolean | null>(null), onPause: () => () => undefined };
  let lastScale = 1;
  let gate: Promise<void> | null = null;
  // The retry after a failure renders smaller (retryScaleFactor) but still above the active level's scale.
  const isCandidateCall = () => lastScale > TUNABLES.detection.levels[ACTIVE_LEVEL].renderScale;
  const engine = {
    extractComponents: vi.fn(async (bitmap: ImageBitmap) => {
      bitmap.close();
      const candidate = isCandidateCall();
      if (candidate && gate) {
        await gate;
      }
      if (candidate && candidateSystems === 'fail') {
        return err('unknown' as const);
      }
      const rects = candidate && candidateSystems === 2 ? [FIRST, SECOND] : [FIRST];
      const scaled = rects.map((r) => ({ x: r.x * lastScale, y: r.y * lastScale, width: r.width * lastScale, height: r.height * lastScale }));
      return ok([{ x: 0, y: 0, width: PAGE_WIDTH * lastScale, height: PAGE_HEIGHT * lastScale }, ...scaled]);
    }),
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: DETECTION_ENGINE, useValue: engine },
      { provide: APP_LIFECYCLE, useValue: lifecycle },
      { provide: CLOCK, useValue: new FakeClock() },
    ],
  });
  const service = TestBed.inject(DetectionService);
  const open = async (): Promise<DocumentStore> => {
    const doc = new DocumentStore('t1', renderer);
    await doc.load(new Uint8Array([1]));
    renderer.handles[0]!.renderRegion.mockImplementation((req) => {
      lastScale = req.scale;
      return Promise.resolve(ok(fakeBitmap(req.region.width * req.scale, req.region.height * req.scale)));
    });
    service.start(doc);
    await until(() => doc.detectionComplete());
    return doc;
  };
  const hold = (): (() => void) => {
    let release!: () => void;
    gate = new Promise<void>((resolve) => (release = resolve));
    return () => {
      gate = null;
      release();
    };
  };
  return { service, open, hold, engine };
}

describe('DetectionService re-run', () => {
  it('DET-015 an unchanged system count keeps jumps, breaks and stops and swaps in the new results', async () => {
    const { service, open } = setup(1);
    const doc = await open();
    doc.addJump({ origin: 2, target: 0, pass: 2 });
    doc.toggleBreak(1);
    const marks = doc.marks();
    service.redetect(doc, NEW_LEVEL);
    await until(() => doc.candidate() === null);
    expect(doc.detection.level()).toBe(NEW_LEVEL);
    expect(doc.marks()).toBe(marks);
    expect(doc.junctionCount()).toBe(PAGES);
  });

  it('DET-015 a changed system count clears the marks', async () => {
    const { service, open } = setup(2);
    const doc = await open();
    doc.addJump({ origin: 2, target: 0, pass: 1 });
    doc.toggleStop(1);
    service.redetect(doc, NEW_LEVEL);
    await until(() => doc.candidate() === null);
    expect(doc.junctionCount()).toBe(PAGES * 2);
    expect(doc.marks().jumps).toEqual([]);
    expect(doc.marks().stops).toEqual([]);
  });

  it('DET-015 failed pages of the candidate count as pages without systems', async () => {
    const { service, open } = setup('fail');
    const doc = await open();
    doc.addJump({ origin: 2, target: 0, pass: 1 });
    service.redetect(doc, NEW_LEVEL);
    await until(() => doc.candidate() === null);
    expect(doc.junctionCount()).toBe(0);
    expect(doc.marks().jumps).toEqual([]);
  });

  it('DET-015 the old results stay displayed and usable until the swap; progress shows the candidate', async () => {
    const { service, open, hold } = setup(2);
    const doc = await open();
    const barsBefore = doc.bars();
    doc.addJump({ origin: 2, target: 0, pass: 1 });
    const release = hold();
    service.redetect(doc, NEW_LEVEL);
    await until(() => doc.candidate()!.states().includes('running'));
    expect(doc.bars()).toEqual(barsBefore);
    expect(doc.detection.level()).toBe(ACTIVE_LEVEL);
    expect(doc.detectionComplete()).toBe(false);
    expect(doc.detectionProgress()).toEqual({ done: 0, total: PAGES });
    expect(doc.toggleBreak(1)).toBeUndefined(); // still editable on the old bars
    expect(doc.marks().breaks).toEqual([1]);
    release();
    await until(() => doc.candidate() === null);
    expect(doc.detection.level()).toBe(NEW_LEVEL);
    expect(doc.detectionComplete()).toBe(true);
    expect(doc.marks().breaks).toEqual([]); // 4 systems now: the count changed
  });

  it('DET-015 a newer re-run supersedes the pending candidate; the old results stay until the newest completes', async () => {
    const { service, open, hold } = setup(2);
    const doc = await open();
    const release = hold();
    service.redetect(doc, NEW_LEVEL);
    await until(() => doc.candidate() !== null);
    const first = doc.candidate();
    service.redetect(doc, NEW_LEVEL);
    expect(doc.candidate()).not.toBe(first);
    expect(doc.detection.level()).toBe(ACTIVE_LEVEL);
    release();
    await until(() => doc.candidate() === null);
    expect(doc.detection.level()).toBe(NEW_LEVEL);
    expect(first?.states().every((s) => s === 'done')).toBe(false);
  });

  it('DET-015 cancelCandidate and stop drop the candidate and leave the active results alone', async () => {
    const { service, open, hold } = setup(2);
    const doc = await open();
    const bars = doc.bars();
    hold();
    service.redetect(doc, NEW_LEVEL);
    await until(() => doc.candidate() !== null);
    service.cancelCandidate(doc);
    expect(doc.candidate()).toBeNull();
    service.redetect(doc, NEW_LEVEL);
    service.stop(doc);
    expect(doc.candidate()).toBeNull();
    expect(doc.bars()).toEqual(bars);
    expect(doc.detection.level()).toBe(ACTIVE_LEVEL);
  });

  it('DET-014 asking for the active level starts nothing and drops a pending candidate', async () => {
    const { service, open, hold } = setup(2);
    const doc = await open();
    service.redetect(doc, ACTIVE_LEVEL);
    expect(doc.candidate()).toBeNull();
    hold();
    service.redetect(doc, NEW_LEVEL);
    await until(() => doc.candidate() !== null);
    service.redetect(doc, ACTIVE_LEVEL);
    expect(doc.candidate()).toBeNull();
  });
});
