import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
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
    expect(html).not.toMatch(/touch|pointer|swipe/i);
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
