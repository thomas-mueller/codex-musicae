import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import { PDF_RENDERER } from '../../ports/pdf-renderer';
import { CLOCK } from '../../state/clock';
import { DetectionService } from '../../state/detection.service';
import { Scheduler } from '../../state/scheduler';
import { ResourceGovernor } from '../../state/resource-governor';
import { FakeClock } from '../../state/testing/fake-clock';
import { err, ok } from '../../ports/result';
import { fakeBitmap } from '../../state/testing/fake-bitmap';
import { fakeRenderer } from '../../state/testing/fake-renderer';
import { OrgViewStore } from '../../state/org-view.store';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { AppShell } from '../shell/app-shell';
import { OrganizationViewer } from './organization-viewer';

const VIEW_WIDTH = 300;
const VIEW_HEIGHT = 400;
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('OrganizationViewer', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(VIEW_WIDTH);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(VIEW_HEIGHT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never);
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function open(name: string): Promise<void> {
    await TestBed.inject(SessionStore).openFiles([{ ref: { id: `id-${name}`, name }, bytes: new Uint8Array([1]), writable: true }]);
  }

  it('ORG-001 stacks all pages at fit-width with gaps in a sizer', async () => {
    await open('a.pdf');
    const doc = TestBed.inject(SessionStore).activeDocument()!;
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await fixture.whenStable();
    const scale = VIEW_WIDTH / PAGE_WIDTH;
    const gap = TUNABLES.rendering.orgPageGapPx;
    const root: HTMLElement = fixture.nativeElement;
    const sizer = root.querySelector<HTMLElement>('[data-testid="org-sizer"]')!;
    expect(parseFloat(sizer.style.width)).toBeCloseTo(PAGE_WIDTH * scale);
    expect(parseFloat(sizer.style.height)).toBeCloseTo(2 * PAGE_HEIGHT * scale + gap);
    const second = root.querySelector<HTMLElement>('[data-testid="org-page-1"]')!;
    expect(parseFloat(second.style.top)).toBeCloseTo(PAGE_HEIGHT * scale + gap);
    expect(root.querySelectorAll('[data-testid^="org-page-"]')).toHaveLength(2);
  });

  it('ORG-001 pages narrower than the viewport are centered horizontally and a short document vertically', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(2000);
    await open('a.pdf');
    const doc = TestBed.inject(SessionStore).activeDocument()!;
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await fixture.whenStable();
    // fit-page in 300 x 2000: width decides (scale 0.5); two 400 px pages plus a gap leave room above and below.
    const root: HTMLElement = fixture.nativeElement;
    const first = root.querySelector<HTMLElement>('[data-testid="org-page-0"]')!;
    const content = 2 * PAGE_HEIGHT * (VIEW_WIDTH / PAGE_WIDTH) + TUNABLES.rendering.orgPageGapPx;
    expect(parseFloat(first.style.top)).toBeCloseTo((2000 - content) / 2);
    expect(parseFloat(first.style.left)).toBeCloseTo(0);
    expect(parseFloat(root.querySelector<HTMLElement>('[data-testid="org-sizer"]')!.style.height)).toBe(2000);
  });

  it('ORG-001 a page narrower than the viewport sits in the horizontal middle', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
    await open('a.pdf');
    const doc = TestBed.inject(SessionStore).activeDocument()!;
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await fixture.whenStable();
    // fit-page in 300 x 200: height decides (scale 0.25), pages are 150 px wide.
    const first = fixture.nativeElement.querySelector('[data-testid="org-page-0"]') as HTMLElement;
    expect(parseFloat(first.style.width)).toBeCloseTo(150);
    expect(parseFloat(first.style.left)).toBeCloseTo(75);
  });

  it('ORG-006 zoom scales the sizer and is not changed by scrolling', async () => {
    await open('a.pdf');
    const doc = TestBed.inject(SessionStore).activeDocument()!;
    doc.orgZoom.set(2);
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await fixture.whenStable();
    const sizer = fixture.nativeElement.querySelector('[data-testid="org-sizer"]') as HTMLElement;
    expect(parseFloat(sizer.style.width)).toBeCloseTo(2 * VIEW_WIDTH);
    const scroller = fixture.nativeElement.querySelector('[data-testid="org-viewer"]') as HTMLElement;
    scroller.dispatchEvent(new Event('scroll'));
    expect(doc.orgZoom()).toBe(2);
  });

  it('ORG-006 the scroll position is stored per document', async () => {
    await open('a.pdf');
    const doc = TestBed.inject(SessionStore).activeDocument()!;
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await fixture.whenStable();
    const scroller = fixture.nativeElement.querySelector('[data-testid="org-viewer"]') as HTMLElement;
    scroller.scrollTop = 120;
    scroller.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(doc.orgScroll().y).toBe(120);
  });

  it('ORG-006 registers no swipe or pointer handlers', async () => {
    await open('a.pdf');
    const doc = TestBed.inject(SessionStore).activeDocument()!;
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await fixture.whenStable();
    const html = (fixture.nativeElement as HTMLElement).outerHTML;
    expect(html).not.toMatch(/(touch|pointer|swipe)\w*=/i);
  });

  it('ORG-007 organization mode has no active drawing tool', () => {
    const ui = TestBed.inject(UiStore);
    ui.hasDocument.set(true);
    ui.setMode('annotation');
    ui.toggleTool('pen');
    ui.setMode('organization');
    expect(ui.tool()).toBeNull();
    ui.toggleTool('pen');
    expect(ui.tool()).toBeNull();
  });

  it('ORG-001 the shell shows the viewer in organization mode once the tab is ready', async () => {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();
    TestBed.inject(UiStore).setMode('organization');
    await open('a.pdf');
    await settle();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-organization-viewer')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-page-preview')).toBeNull();
  });
});

describe('OrganizationViewer tiles', () => {
  const PAGES = 6;
  const SETTLE = TUNABLES.rendering.zoomSettleMs;
  let clock: FakeClock;
  let renderer: ReturnType<typeof fakeRenderer>;
  const drawImage = vi.fn();

  beforeEach(() => {
    drawImage.mockClear();
    clock = new FakeClock();
    renderer = fakeRenderer('invalid', PAGES);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(VIEW_WIDTH);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(VIEW_HEIGHT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never);
    TestBed.configureTestingModule({
      providers: [
        provideTestTransloco(),
        provideTestPorts(),
        { provide: PDF_RENDERER, useValue: renderer },
        { provide: CLOCK, useValue: clock },
        { provide: APP_VERSION, useValue: 'v-test' },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function mount(name = 'a.pdf', firstByte = 1) {
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: `id-${name}`, name }, bytes: new Uint8Array([firstByte]), writable: true }]);
    const doc = session.activeDocument()!;
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await flush(fixture);
    return { doc, fixture };
  }
  async function flush(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
    await fixture.whenStable();
    await settle();
    await fixture.whenStable();
  }
  const canvases = (fixture: { nativeElement: HTMLElement }) => Array.from(fixture.nativeElement.querySelectorAll('canvas'));
  const renderedPages = () => new Set(renderer.handles[0]!.renderRegion.mock.calls.map(([req]) => req.pageIndex));

  it('FIL-001 renders page 1 at fit-width through the cache', async () => {
    const { fixture } = await mount();
    expect(renderedPages().has(0)).toBe(true);
    expect(renderer.handles[0]!.renderRegion.mock.calls[0]![0].scale).toBeCloseTo(VIEW_WIDTH / PAGE_WIDTH);
    expect(drawImage).toHaveBeenCalled();
    expect(canvases(fixture)[0]!.style.visibility).toBe('visible');
  });

  it('ORG-002 renders the visible page plus orgRenderPagesAround pages on each side, nothing farther', async () => {
    const { fixture } = await mount();
    expect([...renderedPages()].sort()).toEqual([0, 1]); // page 0 in view, margin page 1 (nothing above)
    const scroller = fixture.nativeElement.querySelector('[data-testid="org-viewer"]') as HTMLElement;
    scroller.scrollTop = 2 * (PAGE_HEIGHT * (VIEW_WIDTH / PAGE_WIDTH) + TUNABLES.rendering.orgPageGapPx);
    scroller.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await flush(fixture);
    expect([...renderedPages()].sort()).toEqual([0, 1, 2, 3]);
    expect(fixture.nativeElement.querySelectorAll('app-page-tiles').length).toBe(3); // pages 1, 2, 3 — page 0 released
  });

  it('ORG-002 renders no margin pages when the governor drops prefetch', async () => {
    const governor = TestBed.inject(ResourceGovernor);
    governor.reportFailure();
    expect(governor.prefetchNeighbors()).toBe(0);
    await mount();
    expect([...renderedPages()]).toEqual([0]);
  });

  it('NFR-007 no tile is larger than tileSizePx', async () => {
    const { doc, fixture } = await mount();
    doc.orgZoom.set(4);
    fixture.detectChanges();
    clock.advance(SETTLE);
    await flush(fixture);
    const sizes = canvases(fixture).map((c) => [parseFloat(c.style.width), parseFloat(c.style.height)]);
    expect(sizes.length).toBeGreaterThan(0);
    for (const [w, h] of sizes) {
      expect(w).toBeLessThanOrEqual(TUNABLES.resources.tileSizePx);
      expect(h).toBeLessThanOrEqual(TUNABLES.resources.tileSizePx);
    }
  });

  it('NFR-008 keeps old tiles scaled until the zoom settles, then renders sharp and drops them', async () => {
    const { doc, fixture } = await mount();
    const calls = () => renderer.handles[0]!.renderRegion.mock.calls.length;
    const before = calls();
    const oldCanvas = canvases(fixture)[0]!;
    doc.orgZoom.set(2);
    await flush(fixture);
    expect(calls()).toBe(before); // nothing rendered yet
    expect(parseFloat(oldCanvas.style.width)).toBeCloseTo(2 * PAGE_WIDTH * (VIEW_WIDTH / PAGE_WIDTH));
    clock.advance(SETTLE);
    await flush(fixture);
    expect(calls()).toBeGreaterThan(before);
    expect(renderer.handles[0]!.renderRegion.mock.calls.at(-1)![0].scale).toBeCloseTo(1);
    expect(oldCanvas.isConnected).toBe(false);
  });

  it('ORG-002 pages leaving the visible set release their canvases', async () => {
    const { fixture } = await mount();
    const first = canvases(fixture)[0]!;
    const scroller = fixture.nativeElement.querySelector('[data-testid="org-viewer"]') as HTMLElement;
    scroller.scrollTop = 4 * (PAGE_HEIGHT * (VIEW_WIDTH / PAGE_WIDTH) + TUNABLES.rendering.orgPageGapPx);
    scroller.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await flush(fixture);
    expect(first.isConnected).toBe(false);
    expect(first.width).toBe(0);
  });

  it('ORG-005 executes page scroll requests instantly and as a short tween', async () => {
    TestBed.inject(UiStore).setMode('organization');
    const { fixture } = await mount();
    const view = TestBed.inject(OrgViewStore);
    const scroller = fixture.nativeElement.querySelector('[data-testid="org-viewer"]') as HTMLElement;
    const step = PAGE_HEIGHT * (VIEW_WIDTH / PAGE_WIDTH) + TUNABLES.rendering.orgPageGapPx;
    view.goToPage(1, false);
    await fixture.whenStable();
    expect(scroller.scrollTop).toBe(step);
    view.goToPage(0, true);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, TUNABLES.navigation.pageScrollMs * 2));
    expect(scroller.scrollTop).toBe(0);
  });

  it('NFR-008 a margin tile cancelled by a visible task is rendered again (page above after a remount)', async () => {
    TestBed.inject(UiStore).setMode('organization');
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    const doc = session.activeDocument()!;
    const step = PAGE_HEIGHT * (VIEW_WIDTH / PAGE_WIDTH) + TUNABLES.rendering.orgPageGapPx;
    doc.orgScroll.set({ x: 0, y: 3 * step }); // restored position: page 3 in view, page 2 is the prefetch margin above
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await flush(fixture);
    await flush(fixture);
    const all = canvases(fixture);
    expect(all.length).toBeGreaterThanOrEqual(3); // pages 2, 3, 4
    expect(all.filter((c) => c.style.visibility !== 'visible')).toEqual([]);
    expect(renderedPages().has(2)).toBe(true);
  });

  it('NFR-008 a prefetch tile whose page scrolls into view is requested again as visible', async () => {
    TestBed.inject(UiStore).setMode('organization');
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    const doc = session.activeDocument()!;
    // Page 1 (the margin page) never finishes rendering, as when a prefetch task is still queued.
    renderer.handles[0]!.renderRegion.mockImplementation((req, signal) =>
      req.pageIndex === 1
        ? new Promise((resolve) => signal.addEventListener('abort', () => resolve(err('cancelled'))))
        : Promise.resolve(ok(fakeBitmap())),
    );
    const submit = vi.spyOn(TestBed.inject(Scheduler), 'submit');
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await flush(fixture);
    expect(submit.mock.calls.filter(([cls]) => cls === 'prefetch').length).toBeGreaterThan(0);
    submit.mockClear();
    const scroller = fixture.nativeElement.querySelector('[data-testid="org-viewer"]') as HTMLElement;
    scroller.scrollTop = PAGE_HEIGHT * (VIEW_WIDTH / PAGE_WIDTH) + TUNABLES.rendering.orgPageGapPx;
    scroller.dispatchEvent(new Event('scroll'));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await flush(fixture);
    expect(submit.mock.calls.some(([cls]) => cls === 'visible')).toBe(true);
  });

  it('NFR-008 retries of a tile the scheduler keeps cancelling stop at tileRetryMax', async () => {
    TestBed.inject(UiStore).setMode('organization');
    const submit = vi.spyOn(TestBed.inject(Scheduler), 'submit').mockResolvedValue({ ok: false, error: 'cancelled' });
    await mount();
    await settle();
    expect(submit.mock.calls.length).toBeGreaterThan(0);
    // two pages (page 0 in view, page 1 margin), one tile each: first try plus at most tileRetryMax retries
    expect(submit.mock.calls.length).toBeLessThanOrEqual(2 * (1 + TUNABLES.rendering.tileRetryMax));
  });

  it('FIL-009 draws nothing for a document in error state', async () => {
    const fixture = TestBed.createComponent(AppShell);
    TestBed.inject(UiStore).setMode('organization');
    await TestBed.inject(SessionStore).openFiles([{ ref: { id: 'bad', name: 'bad.pdf' }, bytes: new Uint8Array([0]), writable: true }]);
    await flush(fixture);
    expect(drawImage).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('app-organization-viewer')).toBeNull();
  });
});

describe('OrganizationViewer detection overlay', () => {
  const SYSTEM = { x: 0, y: 100, width: 600, height: 100 };

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(VIEW_WIDTH);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(2000);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never);
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function mount() {
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'id-a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    const doc = session.activeDocument()!;
    const prioritize = vi.spyOn(TestBed.inject(DetectionService), 'prioritize');
    doc.detection.reset(2);
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await fixture.whenStable();
    await settle();
    await fixture.whenStable();
    return { doc, fixture, prioritize };
  }
  const barsOnPage = (fixture: { nativeElement: HTMLElement }, testId: string) =>
    fixture.nativeElement.querySelectorAll(`[data-testid="${testId}"]`).length;

  it('ORG-008 draws the bars of a detected page above its tiles', async () => {
    const { doc, fixture } = await mount();
    doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: [SYSTEM] });
    await fixture.whenStable();
    expect(barsOnPage(fixture, 'org-bar')).toBe(2); // above and below the one system
    const overlay = fixture.nativeElement.querySelector('.overlay app-bars-layer');
    expect(overlay).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="org-page-0"] app-bars-layer')).toBeNull(); // not inside the paper box, which the canvases cover
  });

  it('ORG-009 a page that failed or has no systems has no bars', async () => {
    const { doc, fixture } = await mount();
    doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: [] });
    doc.detection.finish(1, 'failed', null);
    await fixture.whenStable();
    expect(barsOnPage(fixture, 'org-bar')).toBe(0);
    expect(barsOnPage(fixture, 'org-bar-provisional')).toBe(0);
  });

  it('DET-021 a page done behind an unfinished one shows provisional bars only', async () => {
    const { doc, fixture } = await mount();
    doc.detection.finish(1, 'done', { pageIndex: 1, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: [SYSTEM] });
    await fixture.whenStable();
    expect(barsOnPage(fixture, 'org-bar')).toBe(0);
    expect(barsOnPage(fixture, 'org-bar-provisional')).toBe(2);
  });

  it('DET-016 only pages that are not done or failed show the processing icon', async () => {
    const { doc, fixture } = await mount();
    expect(barsOnPage(fixture, 'org-processing-0')).toBe(1);
    expect(barsOnPage(fixture, 'org-processing-1')).toBe(1);
    doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: [] });
    doc.detection.finish(1, 'failed', null);
    await fixture.whenStable();
    expect(barsOnPage(fixture, 'org-processing-0')).toBe(0);
    expect(barsOnPage(fixture, 'org-processing-1')).toBe(0);
  });

  it('DET-021 asks the service to process the first visible pending page', async () => {
    const { doc, fixture, prioritize } = await mount();
    expect(prioritize).toHaveBeenCalledWith(doc, 0);
    prioritize.mockClear();
    doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: [] });
    await fixture.whenStable();
    expect(prioritize).toHaveBeenCalledWith(doc, 1);
    prioritize.mockClear();
    doc.detection.finish(1, 'done', { pageIndex: 1, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: [] });
    await fixture.whenStable();
    expect(prioritize).not.toHaveBeenCalled();
  });
});
