import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import type { Rect } from '../core';
import { APP_LIFECYCLE } from '../ports/app-lifecycle';
import { DETECTION_ENGINE } from '../ports/detection-engine';
import type { DetectionError } from '../ports/detection-engine';
import { err, ok } from '../ports/result';
import { CLOCK } from './clock';
import { DetectionService } from './detection.service';
import { DocumentStore } from './document.store';
import { ResourceGovernor } from './resource-governor';
import { fakeBitmap } from './testing/fake-bitmap';
import { FakeClock } from './testing/fake-clock';
import { fakeRenderer } from './testing/fake-renderer';

const PAGES = 3;
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const SYSTEM: Rect = { x: 50, y: 100, width: 500, height: 60 }; // display points; 500/600 > fullWidthSystemRatio of every level
const RETRY = TUNABLES.detection.retryScaleFactor;

const until = async (condition: () => boolean): Promise<void> => {
  for (let i = 0; i < 200 && !condition(); i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(condition()).toBe(true);
};

function setup(engineErrors: (page: number, call: number) => DetectionError | null = () => null) {
  const renderer = fakeRenderer('invalid', PAGES);
  const lifecycle = { visible: signal(true), userActive: signal(false), batterySaver: signal<boolean | null>(null), onPause: () => () => undefined };
  const renders: Array<{ page: number; scale: number }> = [];
  const calls = new Map<number, number>();
  let lastPage = 0;
  let lastScale = 1;
  const closed = vi.fn();
  const engine = {
    extractComponents: vi.fn(async (bitmap: ImageBitmap) => {
      bitmap.close();
      closed();
      const call = (calls.get(lastPage) ?? 0) + 1;
      calls.set(lastPage, call);
      const failure = engineErrors(lastPage, call);
      if (failure) {
        return err(failure);
      }
      const page: Rect = { x: 0, y: 0, width: PAGE_WIDTH * lastScale, height: PAGE_HEIGHT * lastScale };
      const system: Rect = { x: SYSTEM.x * lastScale, y: SYSTEM.y * lastScale, width: SYSTEM.width * lastScale, height: SYSTEM.height * lastScale };
      return ok([page, system]);
    }),
  };
  const clock = new FakeClock();
  TestBed.configureTestingModule({
    providers: [
      { provide: DETECTION_ENGINE, useValue: engine },
      { provide: APP_LIFECYCLE, useValue: lifecycle },
      { provide: CLOCK, useValue: clock },
    ],
  });
  const service = TestBed.inject(DetectionService);
  const governor = TestBed.inject(ResourceGovernor);
  const open = async (): Promise<DocumentStore> => {
    const doc = new DocumentStore('t1', renderer);
    await doc.load(new Uint8Array([1]));
    renderer.handles[0]!.renderRegion.mockImplementation((req) => {
      lastPage = req.pageIndex;
      lastScale = req.scale;
      renders.push({ page: req.pageIndex, scale: req.scale });
      return Promise.resolve(ok(fakeBitmap(req.region.width * req.scale, req.region.height * req.scale)));
    });
    return doc;
  };
  return { service, governor, clock, lifecycle, renders, engine, closed, open };
}

describe('DetectionService', () => {
  it('DET-001 detects every page of a ready document in the background and keeps only rectangles', async () => {
    const { service, open, closed, renders } = setup();
    const doc = await open();
    service.start(doc);
    expect(doc.detectionComplete()).toBe(false);
    await until(() => doc.detectionComplete());
    expect(doc.detection.states()).toEqual(['done', 'done', 'done']);
    expect(doc.systems()).toHaveLength(PAGES);
    expect(doc.junctionCount()).toBe(PAGES);
    expect(doc.bars()).toHaveLength(2 * PAGES); // one system per page: a top and a bottom bar each
    expect(doc.detectionProgress()).toEqual({ done: PAGES, total: PAGES });
    expect(closed).toHaveBeenCalledTimes(renders.length); // DET-020: every bitmap went to the engine, which closed it
    expect(JSON.parse(JSON.stringify(doc.detection.pages()))).toEqual(doc.detection.pages()); // plain data only
  });

  it('DET-003 renders at the level scale and converts bitmap pixels back to display points', async () => {
    const { service, open, renders } = setup();
    const doc = await open();
    doc.detection.level.set('standard');
    service.start(doc);
    await until(() => doc.detectionComplete());
    expect(renders.map((r) => r.scale)).toEqual(Array(PAGES).fill(TUNABLES.detection.levels.standard.renderScale));
    const [first] = doc.systems();
    expect(first?.box).toMatchObject({ x: SYSTEM.x, y: SYSTEM.y, width: SYSTEM.width, height: SYSTEM.height });
  });

  it('DET-003 applies the resource governor scale factor and the canvas pixel cap', async () => {
    const { service, governor, clock, open, renders } = setup();
    governor.reportFailure();
    clock.advance(TUNABLES.resources.governorEscalateCooldownMs);
    governor.reportFailure();
    expect(governor.renderScaleFactor()).toBe(TUNABLES.resources.governorLowResFactor);
    const doc = await open();
    service.start(doc);
    await until(() => doc.detectionComplete());
    expect(renders[0]!.scale).toBeCloseTo(TUNABLES.detection.levels.fast.renderScale * governor.renderScaleFactor());
    expect(PAGE_WIDTH * renders[0]!.scale * PAGE_HEIGHT * renders[0]!.scale).toBeLessThanOrEqual(TUNABLES.resources.maxCanvasPixels);
  });

  it('DET-018 retries a page once at the smaller scale after out-of-memory', async () => {
    const { service, governor, open, renders } = setup((page, call) => (page === 0 && call === 1 ? 'out-of-memory' : null));
    const doc = await open();
    service.start(doc);
    await until(() => doc.detectionComplete());
    expect(doc.detection.states()[0]).toBe('done');
    expect(renders.filter((r) => r.page === 0).map((r) => r.scale)).toEqual([1, RETRY]);
    expect(governor.level()).toBe(1);
  });

  it('DET-018 marks a page that fails twice as failed and continues with the others', async () => {
    const { service, open } = setup((page) => (page === 1 ? 'unknown' : null));
    const doc = await open();
    service.start(doc);
    await until(() => doc.detectionComplete());
    expect(doc.detection.states()).toEqual(['done', 'failed', 'done']);
    expect(doc.detection.pages()[1]).toBeNull();
    expect(doc.detectionProgress()).toEqual({ done: PAGES, total: PAGES });
    expect(doc.pagesUsable().map((p) => p.pageIndex)).toEqual([0, 2]); // a failed page counts as "no systems"
  });

  it('DET-012 a page without systems produces no bars', async () => {
    const { service, open, engine } = setup();
    engine.extractComponents.mockImplementation(async (bitmap: ImageBitmap) => {
      bitmap.close();
      return ok([{ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT }]);
    });
    const doc = await open();
    service.start(doc);
    await until(() => doc.detectionComplete());
    expect(doc.systems()).toEqual([]);
    expect(doc.bars()).toEqual([]);
  });

  it('DET-021 prioritize makes the requested pending page the next one processed', async () => {
    const { service, lifecycle, open, renders } = setup();
    lifecycle.userActive.set(true);
    TestBed.tick();
    const doc = await open();
    service.start(doc);
    service.prioritize(doc, 2);
    lifecycle.userActive.set(false);
    TestBed.tick();
    await until(() => doc.detectionComplete());
    expect(renders.map((r) => r.page)).toEqual([2, 0, 1]);
  });

  it('DET-021 pages done outside the usable prefix give provisional bars with junction -1', async () => {
    const { open } = setup();
    const doc = await open();
    doc.detection.reset(PAGES);
    doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: [SYSTEM] });
    doc.detection.finish(2, 'done', { pageIndex: 2, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: [SYSTEM] });
    expect(doc.pagesUsable().map((p) => p.pageIndex)).toEqual([0]);
    expect(doc.bars().every((b) => b.pageIndex === 0)).toBe(true);
    expect(doc.provisionalBars().length).toBeGreaterThan(0);
    expect(doc.provisionalBars().every((b) => b.junction === -1 && b.provisional && b.pageIndex === 2)).toBe(true);
    expect(doc.detectionProgress()).toEqual({ done: 2, total: PAGES });
    expect(doc.detectionComplete()).toBe(false);
  });

  it('DET-017 does not start while the user is active and resumes when the context changes', async () => {
    const { service, lifecycle, open, renders } = setup();
    lifecycle.userActive.set(true);
    TestBed.tick();
    const doc = await open();
    service.start(doc);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(renders).toEqual([]);
    lifecycle.userActive.set(false);
    TestBed.tick();
    await until(() => doc.detectionComplete());
    expect(renders).toHaveLength(PAGES);
  });

  it('DET-017 stop ends the run of a closed document', async () => {
    const { service, lifecycle, open, renders } = setup();
    lifecycle.visible.set(false);
    TestBed.tick();
    const doc = await open();
    service.start(doc);
    service.stop(doc);
    lifecycle.visible.set(true);
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(renders).toEqual([]);
  });
});
