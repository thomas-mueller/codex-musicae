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
});
