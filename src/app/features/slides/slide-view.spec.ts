import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { composeSlide } from '../../core';
import { PDF_RENDERER } from '../../ports/pdf-renderer';
import { ok } from '../../ports/result';
import { DocumentStore } from '../../state/document.store';
import { ResourceGovernor } from '../../state/resource-governor';
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
});
