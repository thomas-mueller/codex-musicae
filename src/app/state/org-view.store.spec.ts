import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { provideTestPorts } from '../../testing/provide-test-ports';
import { PDF_RENDERER } from '../ports/pdf-renderer';
import { OrgViewStore } from './org-view.store';
import { SessionStore } from './session.store';
import { fakeRenderer } from './testing/fake-renderer';
import { UiStore } from './ui.store';

const PAGES = 3;
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const VIEW_WIDTH = 300;
const GAP = TUNABLES.rendering.orgPageGapPx;
const SCALE = VIEW_WIDTH / PAGE_WIDTH;
const PAGE_STEP = PAGE_HEIGHT * SCALE + GAP; // viewport height 400: fit-page and fit-width coincide

describe('OrgViewStore', () => {
  async function setup(viewHeight = 400) {
    TestBed.configureTestingModule({
      providers: [provideTestPorts(), { provide: PDF_RENDERER, useValue: fakeRenderer('invalid', PAGES) }],
    });
    const ui = TestBed.inject(UiStore);
    ui.hasDocument.set(true);
    ui.setMode('organization');
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    const store = TestBed.inject(OrgViewStore);
    store.viewport.set({ width: VIEW_WIDTH, height: viewHeight });
    return { store, ui, doc: session.activeDocument()! };
  }

  it('ORG-004 the current page is the one covering the viewport center and n counts all pages', async () => {
    const { store, doc } = await setup();
    expect(store.pageCount()).toBe(PAGES);
    expect(store.currentPage()).toBe(0);
    doc.orgScroll.set({ x: 0, y: PAGE_STEP - 100 }); // center at the start of page 1 minus half a gap -> page 1
    expect(store.currentPage()).toBe(1);
    doc.orgScroll.set({ x: 0, y: 2 * PAGE_STEP });
    expect(store.currentPage()).toBe(2);
    doc.orgScroll.set({ x: 0, y: 10 * PAGE_STEP });
    expect(store.currentPage()).toBe(PAGES - 1);
  });

  it('ORG-005 next and previous scroll to the page tops and are disabled at the ends', async () => {
    const { store } = await setup();
    expect(store.canPrevious()).toBe(false);
    expect(store.canNext()).toBe(true);
    store.next();
    expect(store.scrollRequest()).toMatchObject({ top: PAGE_STEP, animate: true });
    store.goToPage(PAGES - 1, false);
    expect(store.scrollRequest()).toMatchObject({ top: 2 * PAGE_STEP, animate: false });
  });

  it('ORG-005 the buttons are disabled at the last and first page', async () => {
    const { store, doc } = await setup();
    doc.orgScroll.set({ x: 0, y: 2 * PAGE_STEP });
    expect(store.canNext()).toBe(false);
    expect(store.canPrevious()).toBe(true);
    const before = store.scrollRequest();
    store.next();
    expect(store.scrollRequest()).toBe(before);
  });

  it('ORG-003 the default zoom is fit-page: the whole widest page fits the viewport', async () => {
    const { store, doc } = await setup(200); // 300 x 200 viewport, 600 x 800 pages: height decides
    expect(doc.orgZoom()).toBe(1);
    expect(store.scale()).toBeCloseTo(200 / PAGE_HEIGHT);
    expect(store.pagesWidth()).toBeCloseTo(PAGE_WIDTH * (200 / PAGE_HEIGHT));
  });

  it('ORG-003 zoom in and out step by buttonStep; the minimum is fit-page and the maximum zoom.max times fit-width', async () => {
    const { store, doc } = await setup(200);
    const { min, max } = store.zoomLimits();
    expect(min).toBe(1);
    expect(max).toBeCloseTo(TUNABLES.zoom.max / 0.5); // fit-page is half of fit-width here
    expect(store.canZoomOut()).toBe(false);
    store.zoomIn();
    expect(doc.orgZoom()).toBeCloseTo(TUNABLES.zoom.buttonStep);
    store.zoomOut();
    expect(doc.orgZoom()).toBe(min);
    store.zoomOut();
    expect(doc.orgZoom()).toBe(min);
    for (let i = 0; i < 40; i++) {
      store.zoomIn();
    }
    expect(doc.orgZoom()).toBe(max);
    expect(store.canZoomIn()).toBe(false);
    expect(store.scale()).toBeCloseTo(TUNABLES.zoom.max * SCALE); // zoom.max x fit-width scale
  });

  it('ORG-001 content smaller than the viewport is centered vertically, narrower content horizontally', async () => {
    const tall = await setup(2000); // all three pages (3 * 400 + 2 gaps) fit into 2000 px
    const content = 3 * PAGE_HEIGHT * SCALE + 2 * GAP;
    expect(tall.store.sizerHeight()).toBe(2000);
    expect(tall.store.offsetY()).toBeCloseTo((2000 - content) / 2);
    expect(tall.store.sizerWidth()).toBe(VIEW_WIDTH);
  });

  it('ORG-001 pages narrower than the viewport are centered horizontally', async () => {
    const { store } = await setup(200); // fit-page: pages are 150 px wide in a 300 px viewport
    expect(store.pagesWidth()).toBeCloseTo(150);
    expect(store.sizerWidth()).toBe(VIEW_WIDTH);
    expect(store.offsetY()).toBe(0);
  });

  it('ORG-003 reset returns to fit-page and the viewport center stays anchored', async () => {
    const { store, doc } = await setup(200);
    doc.orgScroll.set({ x: 0, y: 100 });
    store.zoomIn();
    const zoom = TUNABLES.zoom.buttonStep;
    expect(doc.orgScroll().y).toBeCloseTo((100 + 100) * zoom - 100); // ((s + a) * n / o) - a with o = 1
    store.zoomReset();
    expect(doc.orgZoom()).toBe(1);
    expect(store.scale()).toBeCloseTo(200 / PAGE_HEIGHT);
  });

  it('ORG-006 page navigation does not change the zoom', async () => {
    const { store, doc } = await setup(200);
    store.zoomIn();
    const zoom = doc.orgZoom();
    store.next();
    store.goToPage(2, false);
    expect(doc.orgZoom()).toBe(zoom);
  });

  it('ORG-007 the controls do nothing outside organization mode', async () => {
    const { store, ui, doc } = await setup(200);
    ui.setMode('annotation');
    store.zoomIn();
    store.next();
    expect(doc.orgZoom()).toBe(1);
    expect(store.scrollRequest()).toBeNull();
    expect(store.canZoomIn()).toBe(false);
  });
});
