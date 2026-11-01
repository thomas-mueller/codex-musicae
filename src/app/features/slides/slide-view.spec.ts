import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { FIT_VIEW, composeSlide } from '../../core';
import { PDF_RENDERER } from '../../ports/pdf-renderer';
import { ok } from '../../ports/result';
import { CLOCK } from '../../state/clock';
import { DocumentStore } from '../../state/document.store';
import { ResourceGovernor } from '../../state/resource-governor';
import { FakeClock } from '../../state/testing/fake-clock';
import { fakeBitmap } from '../../state/testing/fake-bitmap';
import { fakeRenderer } from '../../state/testing/fake-renderer';
import type { FakeHandle } from '../../state/testing/fake-renderer';
import { SlideView } from './slide-view';

const STAGE_WIDTH = 300;
const STAGE_HEIGHT = 400;
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const SCALE = STAGE_WIDTH / PAGE_WIDTH;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('SlideView', () => {
  let context: { drawImage: ReturnType<typeof vi.fn>; fillRect: ReturnType<typeof vi.fn>; fillStyle: string; globalAlpha: number };

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(STAGE_WIDTH);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(STAGE_HEIGHT);
    context = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '', globalAlpha: 1 };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
    TestBed.configureTestingModule({ providers: [provideTestTransloco(), ...provideTestPorts()] });
  });
  afterEach(() => vi.restoreAllMocks());

  /** Two pages of three systems (200 high, 300 apart): two systems fit on a slide of ratio 1. */
  async function openDocument(complete = true): Promise<{ doc: DocumentStore; handle: FakeHandle }> {
    const renderer = TestBed.inject(PDF_RENDERER) as ReturnType<typeof fakeRenderer>;
    const doc = new DocumentStore('t1', renderer);
    await doc.load(new Uint8Array([1]));
    doc.detection.reset(2);
    const systems = [0, 1, 2].map((i) => ({ x: 50, y: 50 + i * 250, width: 500, height: 150 }));
    doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems });
    if (complete) {
      doc.detection.finish(1, 'done', { pageIndex: 1, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems });
    }
    return { doc, handle: renderer.handles[0] as FakeHandle };
  }

  async function show(doc: DocumentStore) {
    const fixture = TestBed.createComponent(SlideView);
    fixture.componentRef.setInput('document', doc);
    await fixture.whenStable();
    await settle();
    return fixture;
  }

  it('SLD-007 shows the processing icon while detection runs and no slide exists yet', async () => {
    const renderer = TestBed.inject(PDF_RENDERER) as ReturnType<typeof fakeRenderer>;
    const doc = new DocumentStore('t1', renderer);
    await doc.load(new Uint8Array([1]));
    doc.detection.reset(2);
    const fixture = await show(doc);
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-testid="slide-empty-processing"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="slide-empty-error"]')).toBeNull();
  });

  it('SLD-007 shows the error icon when detection is complete and found no system', async () => {
    const renderer = TestBed.inject(PDF_RENDERER) as ReturnType<typeof fakeRenderer>;
    const doc = new DocumentStore('t1', renderer);
    await doc.load(new Uint8Array([1]));
    doc.detection.reset(1);
    doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: [] });
    const fixture = await show(doc);
    expect(fixture.nativeElement.querySelector('[data-testid="slide-empty-error"]')).not.toBeNull();
  });

  it('SLD-008 fetches every piece of the slide at the display scale and draws it once', async () => {
    const { doc, handle } = await openDocument();
    TestBed.inject(ResourceGovernor).reportFailure(); // level 1: no prefetch, so only the slide's own requests remain
    const fixture = await show(doc);
    const composition = composeSlide(doc.slides()[0]!, doc.geoms(), doc.pageInfos());
    const requests = handle.renderRegion.mock.calls.map(([request]) => request);
    expect(requests).toHaveLength(composition.contents.length);
    composition.contents.forEach((content, i) => {
      expect(requests[i]?.region).toEqual(content.source);
      expect(requests[i]?.scale).toBeCloseTo(SCALE);
    });
    expect(context.drawImage).toHaveBeenCalledTimes(composition.contents.length);
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    expect(parseFloat(canvas.style.width)).toBeCloseTo(composition.width * SCALE);
    expect(parseFloat(canvas.style.height)).toBeCloseTo(composition.height * SCALE);
  });

  it('SLD-008 a detection result for another page does not re-render the slide on display', async () => {
    const { doc, handle } = await openDocument(false);
    TestBed.inject(ResourceGovernor).reportFailure();
    await show(doc);
    const calls = handle.renderRegion.mock.calls.length;
    const systems = [0, 1, 2].map((i) => ({ x: 50, y: 50 + i * 250, width: 500, height: 150 }));
    doc.detection.finish(1, 'done', { pageIndex: 1, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems });
    await settle();
    expect(handle.renderRegion.mock.calls.length).toBe(calls);
  });

  it('SLD-011 a normal slide keeps the same display scale on the next slide', async () => {
    const { doc, handle } = await openDocument();
    TestBed.inject(ResourceGovernor).reportFailure();
    await show(doc);
    handle.renderRegion.mockClear();
    doc.goToSlide(1);
    await settle();
    expect(handle.renderRegion).toHaveBeenCalled();
    for (const [request] of handle.renderRegion.mock.calls) {
      expect(request.scale).toBeCloseTo(SCALE);
    }
  });

  it('SLD-008 the previous slide stays on the canvas until every piece of the next one has arrived', async () => {
    const { doc, handle } = await openDocument();
    TestBed.inject(ResourceGovernor).reportFailure();
    await show(doc);
    const drawn = context.fillRect.mock.calls.length;
    const releases: Array<() => void> = [];
    handle.renderRegion.mockImplementation(() => new Promise((resolve) => releases.push(() => resolve(ok(fakeBitmap())))));
    doc.goToSlide(1);
    await settle();
    expect(context.fillRect.mock.calls.length).toBe(drawn);
    // the scheduler runs a limited number of tasks per class, so the pieces are requested one after another
    expect(context.fillRect.mock.calls.length).toBe(drawn);
    for (let round = 0; round < 3; round++) {
      releases.splice(0).forEach((release) => release());
      await settle();
    }
    expect(context.fillRect.mock.calls.length).toBeGreaterThan(drawn);
  });

  it('SLD-008 prefetches the pieces of the neighbors (none under pressure, see the first fetch test)', async () => {
    const { doc, handle } = await openDocument();
    doc.goToSlide(1);
    await show(doc);
    const composition = composeSlide(doc.slides()[1]!, doc.geoms(), doc.pageInfos());
    expect(handle.renderRegion.mock.calls.length).toBeGreaterThan(composition.contents.length);
  });

  describe('zoom', () => {
    const ZOOM = 2;
    let clock: FakeClock;
    beforeEach(() => {
      clock = new FakeClock();
      TestBed.overrideProvider(CLOCK, { useValue: clock });
    });

    async function zoomed() {
      const { doc, handle } = await openDocument();
      TestBed.inject(ResourceGovernor).reportFailure(); // no prefetch
      const fixture = await show(doc);
      handle.renderRegion.mockClear();
      const tiles = (): HTMLCanvasElement[] => [...fixture.nativeElement.querySelectorAll('[data-testid="slide-tiles"] canvas')];
      return { doc, handle, fixture, tiles };
    }

    it('SLD-018 the view is a CSS transform at once and sharp tiles follow after the settle time', async () => {
      const { doc, handle, fixture, tiles } = await zoomed();
      doc.slideView.set({ zoom: ZOOM, panX: 0, panY: 0 });
      await fixture.whenStable();
      const slide = fixture.nativeElement.querySelector('[data-testid="slide"]') as HTMLElement;
      expect(slide.style.transform).toBe(`translate(0px, 0px) scale(${ZOOM})`);
      expect(tiles()).toHaveLength(0);
      expect(handle.renderRegion).not.toHaveBeenCalled();
      clock.advance(TUNABLES.rendering.zoomSettleMs);
      await settle();
      expect(tiles().length).toBeGreaterThan(0);
      for (const [request] of handle.renderRegion.mock.calls) {
        expect(request.scale).toBeCloseTo(SCALE * ZOOM);
      }
    });

    it('NFR-007 tiles are at most the tile size wide and high at the zoomed scale', async () => {
      const { doc, fixture, tiles } = await zoomed();
      doc.slideView.set({ zoom: TUNABLES.zoom.max, panX: 0, panY: 0 });
      await fixture.whenStable();
      clock.advance(TUNABLES.rendering.zoomSettleMs);
      await settle();
      for (const tile of tiles()) {
        expect(parseFloat(tile.style.width) * TUNABLES.zoom.max).toBeLessThanOrEqual(TUNABLES.resources.tileSizePx + 1e-6);
        expect(parseFloat(tile.style.height) * TUNABLES.zoom.max).toBeLessThanOrEqual(TUNABLES.resources.tileSizePx + 1e-6);
      }
    });

    it('NFR-008 another view change before the settle time renders only the last view', async () => {
      const { doc, handle, fixture } = await zoomed();
      doc.slideView.set({ zoom: ZOOM, panX: 0, panY: 0 });
      await fixture.whenStable();
      clock.advance(TUNABLES.rendering.zoomSettleMs / 2);
      doc.slideView.set({ zoom: ZOOM * 1.5, panX: 0, panY: 0 });
      await fixture.whenStable();
      clock.advance(TUNABLES.rendering.zoomSettleMs / 2);
      await settle();
      expect(handle.renderRegion).not.toHaveBeenCalled();
      clock.advance(TUNABLES.rendering.zoomSettleMs);
      await settle();
      for (const [request] of handle.renderRegion.mock.calls) {
        expect(request.scale).toBeCloseTo(SCALE * ZOOM * 1.5);
      }
      expect(handle.renderRegion).toHaveBeenCalled();
    });

    it('SLD-018 back at fit zoom the tiles are removed', async () => {
      const { doc, fixture, tiles } = await zoomed();
      doc.slideView.set({ zoom: ZOOM, panX: 0, panY: 0 });
      await fixture.whenStable();
      clock.advance(TUNABLES.rendering.zoomSettleMs);
      await settle();
      expect(tiles().length).toBeGreaterThan(0);
      doc.slideView.set(FIT_VIEW);
      await fixture.whenStable();
      expect(tiles()).toHaveLength(0);
    });
  });
});
