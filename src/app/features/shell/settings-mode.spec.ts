import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { AppShell } from './app-shell';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

const SIZES = {
  compact: { width: TUNABLES.layout.compactMaxWidthPx - 1, height: TUNABLES.layout.compactMaxHeightPx + 100 },
  expanded: { width: TUNABLES.layout.compactMaxWidthPx + 100, height: TUNABLES.layout.compactMaxHeightPx + 100 },
} as const;

describe('settings mode in the shell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }] });
  });

  async function render(sizeClass: keyof typeof SIZES) {
    const ui = TestBed.inject(UiStore);
    const fixture = TestBed.createComponent(AppShell);
    await TestBed.inject(SessionStore).openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    await settle();
    await fixture.whenStable();
    // after the first render: its size observer reports the test DOM's 0x0
    ui.setViewport(SIZES[sizeClass].width, SIZES[sizeClass].height);
    await fixture.whenStable();
    expect(ui.sizeClass()).toBe(sizeClass);
    const el = fixture.nativeElement as HTMLElement;
    const find = (key: string, root = '') => el.querySelector<HTMLButtonElement>(`${root} button[aria-label="${translate(`a11y.${key}`)}"]`);
    const areas = () => Array.from(el.querySelectorAll<HTMLElement>('[data-area]')).filter((e) => !e.hidden).map((e) => e.getAttribute('data-area'));
    return { ui, fixture, el, find, areas, doc: TestBed.inject(SessionStore).activeDocument()! };
  }

  for (const sizeClass of ['compact', 'expanded'] as const) {
    it(`UIX-025 ${sizeClass}: the settings button is the rightmost control of the top bar`, async () => {
      const { el, find } = await render(sizeClass);
      const buttons = el.querySelectorAll('[data-area="top"] button');
      expect(buttons[buttons.length - 1]).toBe(find('settings', '[data-area="top"]'));
    });

    it(`UIX-025 ${sizeClass}: the button opens the settings below the top bar only, and returns`, async () => {
      const { ui, fixture, el, find, areas } = await render(sizeClass);
      find('settings')!.click();
      await fixture.whenStable();
      expect(ui.mode()).toBe('settings');
      expect(areas()).toEqual(['top', 'settings']);
      expect(el.querySelector('app-tool-area, app-canvas-area, app-bottom-bar')).toBeNull();
      expect(find('settings')!.getAttribute('aria-pressed')).toBe('true');
      find('settings')!.click();
      await fixture.whenStable();
      expect(ui.mode()).toBe('annotation');
      expect(areas()).toEqual(['top', 'canvas', 'bottom']);
      expect(find('settings')!.getAttribute('aria-pressed')).toBeNull();
    });

    it(`UIX-034 ${sizeClass}: the top bar has no undo or redo button in any mode`, async () => {
      const { ui, fixture, find } = await render(sizeClass);
      for (const mode of ['annotation', 'organization', 'settings'] as const) {
        ui.setMode(mode);
        await fixture.whenStable();
        expect(find('undo', '[data-area="top"]'), mode).toBeNull();
        expect(find('redo', '[data-area="top"]'), mode).toBeNull();
      }
    });
  }

  it('UIX-033 compact: undo and redo are in the expanded tool popup and follow the history', async () => {
    const { fixture, find, doc } = await render('compact');
    expect(find('undo')).toBeNull();
    find('toolFab')!.click();
    await fixture.whenStable();
    const undo = () => find('undo', 'app-tool-area [data-popup]')!;
    const redo = () => find('redo', 'app-tool-area [data-popup]')!;
    expect(find('pen', 'app-tool-area [data-popup]')).not.toBeNull();
    expect(undo().getAttribute('aria-disabled')).toBe('true');
    expect(redo().getAttribute('aria-disabled')).toBe('true');
    doc.addStroke({ id: 's', pageIndex: 0, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: TUNABLES.colors.penPresets[0] as string, widthPt: 1, opacity: 1, multiply: false });
    await fixture.whenStable();
    doc.strokeStarted();
    await fixture.whenStable();
    expect(undo().getAttribute('aria-disabled')).toBe('true'); // ANN-013: not during a stroke
    doc.strokeEnded();
    await fixture.whenStable();
    undo().click();
    await fixture.whenStable();
    expect(doc.strokes()).toEqual([]);
    redo().click();
    expect(doc.strokes().map((stroke) => stroke.id)).toEqual(['s']);
  });
});
