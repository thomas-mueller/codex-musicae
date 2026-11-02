import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { FIT_VIEW, composeSlide, displayToUser } from '../../core';
import type { InkStroke } from '../../core';
import { InkInput } from '../../input/ink-input';
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
  type Fn = ReturnType<typeof vi.fn>;
  let context: {
    drawImage: Fn; fillRect: Fn; fillStyle: string; globalAlpha: number;
    clearRect: Fn; beginPath: Fn; moveTo: Fn; lineTo: Fn; quadraticCurveTo: Fn; stroke: Fn;
    lineCap: string; lineJoin: string; strokeStyle: string; lineWidth: number; globalCompositeOperation: string;
  };

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(STAGE_WIDTH);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(STAGE_HEIGHT);
    context = {
      drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '', globalAlpha: 1,
      clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), stroke: vi.fn(),
      lineCap: '', lineJoin: '', strokeStyle: '', lineWidth: 0, globalCompositeOperation: 'source-over',
    };
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

  it('ANN-011 the live stroke layer has the size of the slide canvas and sits above the tiles', async () => {
    const { doc } = await openDocument();
    const fixture = await show(doc);
    const root: HTMLElement = fixture.nativeElement;
    const base = root.querySelector('[data-testid="slide-canvas"]') as HTMLCanvasElement;
    const live = root.querySelector('[data-testid="live-canvas"]') as HTMLCanvasElement;
    expect(live.width).toBe(base.width);
    expect(live.height).toBe(base.height);
    expect(live.style.width).toBe(base.style.width);
    expect(live.style.height).toBe(base.style.height);
    const order = Array.from(base.parentElement!.children);
    expect(order.indexOf(live)).toBeGreaterThan(order.indexOf(root.querySelector('[data-testid="slide-tiles"]')!));
  });

  it('ANN-011 the view registers its composition and live layer with the stroke input and removes them when destroyed', async () => {
    const detach = vi.fn();
    const attach = vi.spyOn(TestBed.inject(InkInput), 'attach').mockReturnValue(detach);
    const { doc } = await openDocument();
    const fixture = await show(doc);
    expect(attach).toHaveBeenCalledTimes(1);
    const surface = attach.mock.calls[0]![0];
    expect(surface.composition()).toEqual(composeSlide(doc.slides()[0]!, doc.geoms(), doc.pageInfos()));
    expect(typeof surface.live.begin).toBe('function');
    fixture.destroy();
    expect(detach).toHaveBeenCalled();
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

  describe('ink (M14 S4)', () => {
    interface Inked {
      strokes: Array<{ color: string; alpha: number; op: string; width: number }>;
      clears: number;
    }
    let contexts: Map<HTMLCanvasElement, Inked>;
    let clock: FakeClock;

    beforeEach(() => {
      clock = new FakeClock();
      TestBed.overrideProvider(CLOCK, { useValue: clock });
      contexts = new Map();
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
        let inked = contexts.get(this);
        if (!inked) {
          const record: Inked = { strokes: [], clears: 0 };
          const ctx = {
            fillStyle: '', globalAlpha: 1, lineCap: '', lineJoin: '', strokeStyle: '', lineWidth: 0, globalCompositeOperation: 'source-over',
            drawImage: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(),
            clearRect: vi.fn(() => record.clears++),
            stroke: vi.fn(() => record.strokes.push({ color: ctx.strokeStyle, alpha: ctx.globalAlpha, op: ctx.globalCompositeOperation, width: ctx.lineWidth })),
          };
          inked = Object.assign(record, { ctx }) as Inked;
          contexts.set(this, inked);
          (this as unknown as { __ctx: unknown }).__ctx = ctx;
        }
        return (this as unknown as { __ctx: never }).__ctx;
      });
    });

    const byId = (root: HTMLElement, id: string) => contexts.get(root.querySelector(`[data-testid="${id}"]`) as HTMLCanvasElement);

    /** A stroke across the first piece of the slide on display (user space of its page). */
    async function strokeOnSlide(doc: DocumentStore, id: string, over: Partial<InkStroke> = {}): Promise<InkStroke> {
      const content = composeSlide(doc.slides()[0]!, doc.geoms(), doc.pageInfos()).contents[0]!;
      const box = doc.pageInfos()[content.pageIndex]!.box;
      const { source } = content;
      const a = displayToUser({ x: source.x + source.width * 0.3, y: source.y + source.height / 2 }, box);
      const b = displayToUser({ x: source.x + source.width * 0.6, y: source.y + source.height / 2 }, box);
      return { id, pageIndex: content.pageIndex, points: [a, b], color: '#D32F2F', widthPt: 3, opacity: 1, multiply: false, ...over };
    }

    it('ANN-012 the strokes of the page on display are drawn: pens on the pen canvas, the highlighter with opacity and multiply on its own', async () => {
      const { doc } = await openDocument();
      doc.addStroke(await strokeOnSlide(doc, 'pen'));
      doc.addStroke(await strokeOnSlide(doc, 'marker', { color: '#FDD835', widthPt: 14, opacity: 0.35, multiply: true }));
      const fixture = await show(doc);
      const root: HTMLElement = fixture.nativeElement;
      expect(byId(root, 'ink-canvas')?.strokes).toEqual([{ color: '#D32F2F', alpha: 1, op: 'source-over', width: expect.any(Number) }]);
      expect(byId(root, 'ink-highlighter-canvas')?.strokes).toEqual([{ color: '#FDD835', alpha: 0.35, op: 'multiply', width: expect.any(Number) }]);
    });

    it('ANN-012 the highlighter canvas is blended with the page by CSS multiply', async () => {
      const { doc } = await openDocument();
      const fixture = await show(doc);
      const canvas = fixture.nativeElement.querySelector('[data-testid="ink-highlighter-canvas"]') as HTMLCanvasElement;
      expect(getComputedStyle(canvas).mixBlendMode).toBe('multiply');
    });

    it('ANN-006 the ink follows add, undo and redo', async () => {
      const { doc } = await openDocument();
      const fixture = await show(doc);
      const root: HTMLElement = fixture.nativeElement;
      expect(byId(root, 'ink-canvas')?.strokes).toEqual([]);
      doc.addStroke(await strokeOnSlide(doc, 'a'));
      await fixture.whenStable();
      expect(byId(root, 'ink-canvas')?.strokes).toHaveLength(1);
      doc.undo();
      await fixture.whenStable();
      expect(byId(root, 'ink-canvas')?.strokes).toHaveLength(1); // not drawn again: cleared and nothing to draw
      doc.redo();
      await fixture.whenStable();
      expect(byId(root, 'ink-canvas')?.strokes).toHaveLength(2);
    });

    it('ANN-012 ink on a page that is not on the slide is not drawn', async () => {
      const { doc } = await openDocument();
      doc.addStroke({ ...(await strokeOnSlide(doc, 'far')), points: [{ x: 5000, y: 5000 }, { x: 5001, y: 5001 }] });
      const fixture = await show(doc);
      expect(byId(fixture.nativeElement, 'ink-canvas')?.strokes).toEqual([]);
    });

    it('ANN-005 strokes the eraser has touched are left out until the gesture ends', async () => {
      const attach = vi.spyOn(TestBed.inject(InkInput), 'attach').mockReturnValue(() => undefined);
      const { doc } = await openDocument();
      doc.addStroke(await strokeOnSlide(doc, 'a'));
      doc.addStroke(await strokeOnSlide(doc, 'b'));
      const fixture = await show(doc);
      const surface = attach.mock.calls[0]![0];
      const pen = () => byId(fixture.nativeElement, 'ink-canvas')!;
      const before = pen().strokes.length;
      expect(before).toBe(2);
      surface.hideStrokes(new Set(['a']));
      expect(pen().strokes.length - before).toBe(1); // the redraw drew only 'b'
      surface.hideStrokes(new Set());
      expect(pen().strokes.length - before).toBe(3);
    });

    it('NFR-002 zoomed in, the ink is redrawn sharp for the visible part after the settle time and the stretched ink is hidden', async () => {
      const { doc } = await openDocument();
      doc.addStroke(await strokeOnSlide(doc, 'a'));
      const fixture = await show(doc);
      const root: HTMLElement = fixture.nativeElement;
      const sharp = (): HTMLCanvasElement[] => [...root.querySelectorAll<HTMLCanvasElement>('[data-testid="ink-sharp"] canvas')];
      doc.slideView.set({ zoom: 2, panX: 0, panY: 0 });
      await fixture.whenStable();
      expect(sharp()).toHaveLength(0);
      clock.advance(TUNABLES.rendering.zoomSettleMs);
      await settle();
      expect(sharp()).toHaveLength(2);
      for (const canvas of sharp()) {
        expect(canvas.width * canvas.height).toBeLessThanOrEqual(TUNABLES.resources.maxCanvasPixels);
      }
      expect(sharp().map((c) => c.style.mixBlendMode)).toEqual(['multiply', '']);
      expect((root.querySelector('[data-testid="ink-canvas"]') as HTMLElement).style.visibility).toBe('hidden');
      doc.slideView.set(FIT_VIEW);
      await fixture.whenStable();
      expect(sharp()).toHaveLength(0);
      expect((root.querySelector('[data-testid="ink-canvas"]') as HTMLElement).style.visibility).toBe('');
    });

    it('NFR-002 a view change drops the sharp ink at once; a stroke change redraws the sharp ink', async () => {
      const { doc } = await openDocument();
      const fixture = await show(doc);
      const root: HTMLElement = fixture.nativeElement;
      const sharpPen = (): HTMLCanvasElement | undefined => root.querySelectorAll<HTMLCanvasElement>('[data-testid="ink-sharp"] canvas')[1];
      doc.slideView.set({ zoom: 2, panX: 0, panY: 0 });
      await fixture.whenStable();
      clock.advance(TUNABLES.rendering.zoomSettleMs);
      await settle();
      const canvas = sharpPen()!;
      expect(contexts.get(canvas)?.strokes).toEqual([]);
      doc.addStroke(await strokeOnSlide(doc, 'a'));
      await fixture.whenStable();
      const redrawn = sharpPen()!;
      expect(contexts.get(redrawn)?.strokes.length).toBe(1);
      doc.slideView.set({ zoom: 3, panX: 0, panY: 0 });
      await fixture.whenStable();
      expect(sharpPen()).toBeUndefined();
    });
  });
});
