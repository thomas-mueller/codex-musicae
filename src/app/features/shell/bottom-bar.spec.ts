import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import { OrgViewStore } from '../../state/org-view.store';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { AppShell } from './app-shell';

const VIEW_WIDTH = 300;
const VIEW_HEIGHT = 400;
const PAGE_STEP = 800 * (VIEW_WIDTH / 600) + TUNABLES.rendering.orgPageGapPx; // fake pages are 600 x 800
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('BottomBar in organization mode', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(VIEW_WIDTH);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(VIEW_HEIGHT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never);
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function mount() {
    const fixture = TestBed.createComponent(AppShell);
    TestBed.inject(UiStore).setMode('organization');
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    await fixture.whenStable();
    await settle();
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const button = (label: string) => root.querySelector<HTMLElement>(`app-bottom-bar button[aria-label="${label}"]`)!;
    return { fixture, root, button, doc: session.activeDocument()!, view: TestBed.inject(OrgViewStore) };
  }
  const indicator = (root: HTMLElement) => root.querySelector('app-bottom-bar .indicator')?.textContent;

  it('ORG-004 the indicator shows "x / n" and follows the scroll position', async () => {
    const { fixture, root, doc } = await mount();
    expect(indicator(root)).toBe('1 / 2');
    doc.orgScroll.set({ x: 0, y: PAGE_STEP });
    await fixture.whenStable();
    expect(indicator(root)).toBe('2 / 2');
  });

  it('ORG-005 previous and next are disabled at the first and last page and request a page scroll', async () => {
    const { fixture, button, doc, view } = await mount();
    expect(button('Previous').getAttribute('aria-disabled')).toBe('true');
    expect(button('Next').getAttribute('aria-disabled')).toBeNull();
    button('Next').click();
    expect(view.scrollRequest()).toMatchObject({ top: PAGE_STEP });
    doc.orgScroll.set({ x: 0, y: PAGE_STEP });
    await fixture.whenStable();
    expect(button('Next').getAttribute('aria-disabled')).toBe('true');
    expect(button('Previous').getAttribute('aria-disabled')).toBeNull();
  });

  it('ORG-003 zoom out is disabled at fit-width when the page already fits, zoom in steps and reset returns', async () => {
    const { fixture, button, doc } = await mount();
    expect(button('Zoom out').getAttribute('aria-disabled')).toBe('true');
    button('Zoom in').click();
    await fixture.whenStable();
    expect(doc.orgZoom()).toBeCloseTo(TUNABLES.zoom.buttonStep);
    expect(button('Zoom out').getAttribute('aria-disabled')).toBeNull();
    button('Reset zoom').click();
    expect(doc.orgZoom()).toBe(1);
  });

  it('ORG-005 the slider spans the pages and drives the scroll', async () => {
    const { fixture, root, view } = await mount();
    // The test viewport is compact: the slider lives in the popup opened from the indicator.
    root.querySelector<HTMLElement>('app-bottom-bar button.indicator')!.click();
    await fixture.whenStable();
    const slider = root.querySelector<HTMLInputElement>('app-popup-host input.slider')!;
    expect(slider.max).toBe('2');
    slider.value = '2';
    slider.dispatchEvent(new Event('input'));
    expect(view.scrollRequest()).toMatchObject({ top: PAGE_STEP, animate: false });
  });

  const progress = (root: HTMLElement) => root.querySelector('[data-testid="detection-progress"]');

  it('DET-016 shows the processing icon and processed/total while detection runs, and nothing when complete', async () => {
    const { fixture, root, doc } = await mount();
    expect(progress(root)?.textContent?.trim()).toBe(`0${TUNABLES.layout.progressSeparator}2`);
    expect(progress(root)?.querySelector('app-icon')).not.toBeNull();
    doc.detection.finish(0, 'done', { pageIndex: 0, width: 600, height: 800, systems: [] });
    await fixture.whenStable();
    expect(progress(root)?.textContent?.trim()).toBe(`1${TUNABLES.layout.progressSeparator}2`);
    doc.detection.finish(1, 'failed', null);
    await fixture.whenStable();
    expect(progress(root)).toBeNull();
  });

  it('DET-016 shows no progress outside organization mode', async () => {
    const { fixture, root } = await mount();
    TestBed.inject(UiStore).setMode('annotation');
    await fixture.whenStable();
    expect(progress(root)).toBeNull();
  });
});


describe('BottomBar in annotation mode', () => {
  let size = { width: 1000, height: 700 };
  beforeEach(() => {
    size = { width: 1000, height: 700 };
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => size.width);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => size.height);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), fillRect: vi.fn() } as never);
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  /** Two pages of three systems (150 high, 250 apart). */
  async function mount(complete = true) {
    const fixture = TestBed.createComponent(AppShell);
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    await settle();
    const doc = session.activeDocument()!;
    doc.detection.reset(2);
    const systems = [0, 1, 2].map((i) => ({ x: 50, y: 50 + i * 250, width: 500, height: 150 }));
    doc.detection.finish(0, 'done', { pageIndex: 0, width: 600, height: 800, systems });
    if (complete) {
      doc.detection.finish(1, 'done', { pageIndex: 1, width: 600, height: 800, systems });
    }
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const button = (label: string) => root.querySelector<HTMLElement>(`app-bottom-bar button[aria-label="${label}"], app-popup-host button[aria-label="${label}"]`)!;
    return { fixture, root, button, doc };
  }
  const indicator = (root: HTMLElement) => root.querySelector('app-bottom-bar .indicator')?.textContent;
  const disabled = (el: HTMLElement) => el.getAttribute('aria-disabled') === 'true';

  it('SLD-016 the indicator shows "1 / n" and next increments it', async () => {
    const { fixture, root, button, doc } = await mount();
    expect(indicator(root)).toBe(`1 / ${doc.slideCount()}`);
    button('Next').click();
    await fixture.whenStable();
    expect(indicator(root)).toBe(`2 / ${doc.slideCount()}`);
  });

  it('SLD-016 the indicator shows "n+" while detection is running', async () => {
    const { root, doc } = await mount(false);
    expect(indicator(root)).toBe(`1 / ${doc.slideCount()}+`);
  });

  it('NAV-020 previous and next are disabled at the first and the last slide', async () => {
    const { fixture, button, doc } = await mount();
    expect(disabled(button('Previous'))).toBe(true);
    expect(disabled(button('Next'))).toBe(false);
    doc.goToSlide(doc.slideCount() - 1);
    await fixture.whenStable();
    expect(disabled(button('Next'))).toBe(true);
    expect(disabled(button('Previous'))).toBe(false);
  });

  it('NAV-020 the slider spans the slides and drives the position', async () => {
    const frames: Array<() => void> = [];
    vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn));
    const { fixture, root, doc } = await mount();
    const slider = root.querySelector<HTMLInputElement>('app-bottom-bar input.slider')!;
    expect(slider.max).toBe(String(doc.slideCount()));
    slider.value = '3';
    slider.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(indicator(root)).toBe(`3 / ${doc.slideCount()}`);
    frames.splice(0).forEach((fn) => fn());
    expect(doc.currentSlideIndex()).toBe(2);
    vi.unstubAllGlobals();
  });

  it('SLD-017 show more and show less change the slide count and disable at the limits', async () => {
    const { fixture, button, doc } = await mount();
    const before = doc.slideCount();
    button('Show more').click();
    await fixture.whenStable();
    expect(doc.aspectRatio()).toBeLessThan(1.6); // the fake 1280x800 screen
    expect(doc.slideCount()).toBeLessThanOrEqual(before);
    button('Show less').click();
    button('Show less').click();
    await fixture.whenStable();
    expect(doc.slideCount()).toBeGreaterThanOrEqual(before);
    doc.ratioOverride.set({ landscape: TUNABLES.aspectRatio.max });
    await fixture.whenStable();
    expect(disabled(button('Show less'))).toBe(true);
    expect(disabled(button('Show more'))).toBe(false);
  });

  it('SLD-017 compact layouts keep the ratio buttons in the overflow menu and the slider in the indicator popup', async () => {
    size = { width: 300, height: 400 };
    const { fixture, root, button, doc } = await mount();
    expect(root.querySelector('app-bottom-bar button[aria-label="Show more"]')).toBeNull();
    button('More').click();
    await fixture.whenStable();
    expect(root.querySelector('app-popup-host button[aria-label="Show more"]')).not.toBeNull();
    root.querySelector<HTMLElement>('app-bottom-bar button.indicator')!.click();
    await fixture.whenStable();
    expect(root.querySelector<HTMLInputElement>('app-popup-host input.slider')!.max).toBe(String(doc.slideCount()));
  });
});
