import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { provideTestPorts } from '../../testing/provide-test-ports';
import { FIT_VIEW } from '../core';
import { SessionStore } from './session.store';
import { SlideNavStore } from './slide-nav.store';
import { UiStore } from './ui.store';
import type { DocumentStore } from './document.store';

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

/** Two pages of three systems (150 high, 250 apart): with a ratio of 1.6 each slide holds one or two systems. */
async function setup(complete = true): Promise<{ nav: SlideNavStore; doc: DocumentStore; ui: UiStore }> {
  TestBed.configureTestingModule({ providers: provideTestPorts() });
  const session = TestBed.inject(SessionStore);
  await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
  await settle();
  const doc = session.activeDocument() as DocumentStore;
  doc.detection.reset(2);
  const systems = [0, 1, 2].map((i) => ({ x: 50, y: 50 + i * 250, width: 500, height: 150 }));
  doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems });
  if (complete) {
    doc.detection.finish(1, 'done', { pageIndex: 1, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems });
  }
  return { nav: TestBed.inject(SlideNavStore), doc, ui: TestBed.inject(UiStore) };
}

describe('SlideNavStore', () => {
  let frames: Array<() => void>;
  beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn));
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames[id - 1] = () => undefined;
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  const runFrame = (): void => frames.splice(0).forEach((fn) => fn());

  it('SLD-016 entering annotation mode with no position shows slide 0 of n', async () => {
    const { nav, doc } = await setup();
    expect(nav.active()).toBe(true);
    expect(doc.currentSlideIndex()).toBe(0);
    expect(nav.indicatorText()).toBe(`1 / ${doc.slideCount()}`);
  });

  it('SLD-016 the count carries a plus while detection is running', async () => {
    const { nav, doc } = await setup(false);
    expect(nav.indicatorText()).toBe(`1 / ${doc.slideCount()}+`);
    doc.detection.finish(1, 'done', { pageIndex: 1, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: [] });
    expect(nav.indicatorText()).toBe(`1 / ${doc.slideCount()}`);
  });

  it('NAV-020 previous and next are disabled at the ends and move one slide', async () => {
    const { nav, doc } = await setup();
    expect(doc.slideCount()).toBeGreaterThan(2);
    expect(nav.canPrevious()).toBe(false);
    expect(nav.canNext()).toBe(true);
    nav.next();
    expect(doc.currentSlideIndex()).toBe(1);
    expect(nav.canPrevious()).toBe(true);
    nav.goTo(doc.slideCount() - 1);
    expect(nav.canNext()).toBe(false);
    nav.previous();
    expect(doc.currentSlideIndex()).toBe(doc.slideCount() - 2);
  });

  it('NAV-020 scrubbing shows the value at once and moves the slide once per animation frame', async () => {
    const { nav, doc } = await setup();
    const goToSlide = vi.spyOn(doc, 'goToSlide');
    nav.scrub(2);
    nav.scrub(3);
    expect(nav.shown()).toBe(3);
    expect(nav.indicatorText().startsWith('4 / ')).toBe(true);
    expect(doc.currentSlideIndex()).toBe(0);
    expect(goToSlide).not.toHaveBeenCalled();
    runFrame();
    expect(goToSlide).toHaveBeenCalledTimes(1);
    expect(doc.currentSlideIndex()).toBe(3);
    expect(nav.shown()).toBe(3);
  });

  it('NAV-020 scrubbing beyond the ends is clamped', async () => {
    const { nav, doc } = await setup();
    nav.scrub(99);
    runFrame();
    expect(doc.currentSlideIndex()).toBe(doc.slideCount() - 1);
  });

  it('SLD-016 the controls are inactive outside annotation mode', async () => {
    const { nav, ui } = await setup();
    ui.setMode('organization');
    expect(nav.active()).toBe(false);
    expect(nav.indicatorText()).toBe('');
    expect(nav.canNext()).toBe(false);
  });

  describe('zoom', () => {
    it('SLD-018 the buttons zoom around the stage center by the button step and stop at the limits', async () => {
      const { nav, doc } = await setup();
      nav.stage.set({ width: 300, height: 400 });
      expect(nav.canZoomIn()).toBe(true);
      expect(nav.canZoomOut()).toBe(false);
      expect(nav.canZoomReset()).toBe(false);
      nav.zoomIn();
      expect(doc.slideView()).toEqual({ zoom: TUNABLES.zoom.buttonStep, panX: 0, panY: 0 });
      expect(nav.canZoomOut()).toBe(true);
      expect(nav.canZoomReset()).toBe(true);
      for (let i = 0; i < 20; i++) {
        nav.zoomIn();
      }
      expect(doc.slideView().zoom).toBe(TUNABLES.zoom.max);
      expect(nav.canZoomIn()).toBe(false);
      for (let i = 0; i < 20; i++) {
        nav.zoomOut();
      }
      expect(doc.slideView().zoom).toBe(TUNABLES.zoom.min);
      expect(nav.canZoomOut()).toBe(false);
    });

    it('SLD-018 reset returns to the fit view', async () => {
      const { nav, doc } = await setup();
      nav.stage.set({ width: 300, height: 400 });
      nav.zoomIn();
      nav.zoomReset();
      expect(doc.slideView()).toEqual(FIT_VIEW);
    });

    it('NAV-015 zoom returns to fit on every slide change, but not when the same slide is requested again', async () => {
      const { nav, doc } = await setup();
      nav.stage.set({ width: 300, height: 400 });
      nav.zoomIn();
      nav.goTo(0);
      expect(doc.slideView().zoom).toBe(TUNABLES.zoom.buttonStep);
      nav.next();
      expect(doc.slideView()).toEqual(FIT_VIEW);
    });

    it('SLD-018 without a measured stage the zoom buttons are inert', async () => {
      const { nav, doc } = await setup();
      expect(nav.canZoomIn()).toBe(false);
      nav.zoomIn();
      expect(doc.slideView()).toEqual(FIT_VIEW);
    });
  });
});
