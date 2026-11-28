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

describe('undo and redo buttons of both modes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }] });
  });

  async function render(sizeClass: keyof typeof SIZES) {
    const ui = TestBed.inject(UiStore);
    const fixture = TestBed.createComponent(AppShell);
    await TestBed.inject(SessionStore).openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    await settle();
    await fixture.whenStable();
    ui.setViewport(SIZES[sizeClass].width, SIZES[sizeClass].height);
    ui.setMode('organization');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const find = (key: string, root = '') => el.querySelector<HTMLButtonElement>(`${root} button[aria-label="${translate(`a11y.${key}`)}"]`);
    const doc = TestBed.inject(SessionStore).activeDocument()!;
    return { ui, fixture, el, find, doc };
  }

  /** Where the organization tools are: the strip, or the popup of the floating button. */
  const GROUPS = { compact: 'app-popup-host .popup', expanded: 'app-tool-area' } as const;

  for (const sizeClass of ['compact', 'expanded'] as const) {
    it(`UIX-033 ANN-016 ${sizeClass}: in organization mode both are with the tools and follow the organization history`, async () => {
      const { fixture, el, find, doc } = await render(sizeClass);
      if (sizeClass === 'compact') {
        expect(find('undo')).toBeNull();
        find('orgFab')!.click();
        await fixture.whenStable();
      }
      const undo = () => find('undo', GROUPS[sizeClass])!;
      const redo = () => find('redo', GROUPS[sizeClass])!;
      const disabled = () => [undo(), redo()].map((button) => button.getAttribute('aria-disabled') === 'true');
      expect(el.querySelector('[data-area="top"] app-history-buttons')).toBeNull();
      expect(disabled()).toEqual([true, true]);

      // ink belongs to the other history
      doc.addStroke({ id: 's', pageIndex: 0, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: TUNABLES.colors.penPresets[0] as string, widthPt: 1, opacity: 1, multiply: false });
      await fixture.whenStable();
      expect(disabled()).toEqual([true, true]);

      doc.replaceMarks({ ...doc.systemMarks(), bookmarks: [{ id: 1, at: { pageIndex: 0, system: 1 } }], nextBookmarkId: 2 });
      doc.removeMark({ kind: 'bookmark', id: 1 });
      await fixture.whenStable();
      expect(disabled()).toEqual([false, true]);
      undo().click();
      await fixture.whenStable();
      expect(doc.systemMarks().bookmarks).toHaveLength(1);
      expect(disabled()).toEqual([true, false]);
      redo().click();
      await fixture.whenStable();
      expect(doc.systemMarks().bookmarks).toEqual([]);
      expect(doc.strokes()).toHaveLength(1);
    });
  }
});
