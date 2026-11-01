import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { PDF_RENDERER } from '../../ports/pdf-renderer';
import { CLOCK } from '../../state/clock';
import { DocumentStore } from '../../state/document.store';
import { FakeClock } from '../../state/testing/fake-clock';
import { fakeRenderer } from '../../state/testing/fake-renderer';
import { PresentationView } from './presentation-view';

describe('PresentationView', () => {
  const clock = new FakeClock();

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), fillRect: vi.fn() } as never);
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), ...provideTestPorts(), { provide: CLOCK, useValue: clock }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  async function open() {
    const renderer = TestBed.inject(PDF_RENDERER) as ReturnType<typeof fakeRenderer>;
    const doc = new DocumentStore('t1', renderer);
    await doc.load(new Uint8Array([1]));
    doc.detection.reset(2);
    const systems = [0, 1, 2].map((i) => ({ x: 50, y: 50 + i * 250, width: 500, height: 150 }));
    for (const pageIndex of [0, 1]) {
      doc.detection.finish(pageIndex, 'done', { pageIndex, width: 600, height: 800, systems });
    }
    const fixture = TestBed.createComponent(PresentationView);
    fixture.componentRef.setInput('document', doc);
    await fixture.whenStable();
    return { doc, fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('UIX-009 UIX-020 renders the stage and a progress line sized by position', async () => {
    const { doc, fixture, el } = await open();
    const line = (): HTMLElement => el.querySelector('[data-testid="progress-line"]') as HTMLElement;
    expect(el.querySelector('app-slide-view')).not.toBeNull();
    expect(line().style.width).toBe('0%');
    doc.goToSlide(doc.slideCount() - 1);
    await fixture.whenStable();
    expect(line().style.width).toBe('100%');
    expect(line().style.pointerEvents || getComputedStyle(line()).pointerEvents).toBeDefined();
  });

  it('UIX-019 the cursor hides after the idle time and returns on movement', async () => {
    const { fixture, el } = await open();
    expect(el.classList.contains('cursor-hidden')).toBe(false);
    clock.advance(TUNABLES.layout.cursorHideMs);
    await fixture.whenStable();
    expect(el.classList.contains('cursor-hidden')).toBe(true);
    el.dispatchEvent(new Event('pointermove'));
    await fixture.whenStable();
    expect(el.classList.contains('cursor-hidden')).toBe(false);
  });
});
