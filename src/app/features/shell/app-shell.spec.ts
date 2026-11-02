import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import type { OpenedFile } from '../../ports/file-access';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { AppShell } from './app-shell';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

function file(name: string, firstByte = 1): OpenedFile {
  return { ref: { id: `id-${name}`, name }, bytes: new Uint8Array([firstByte]), writable: true };
}

describe('AppShell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }] });
  });

  async function render() {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();
    return fixture;
  }
  const areas = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLElement>('[data-area]'))
      .filter((e) => !e.hidden)
      .map((e) => e.getAttribute('data-area'));

  it('UIX-008 shows both bars in annotation and organization mode', async () => {
    const store = TestBed.inject(UiStore);
    const fixture = await render();
    expect(areas(fixture.nativeElement)).toEqual(['top', 'canvas', 'bottom']);
    store.setMode('organization');
    await fixture.whenStable();
    expect(areas(fixture.nativeElement)).toEqual(['top', 'canvas', 'bottom']);
  });

  it('UIX-001 presentation mode shows only the canvas area', async () => {
    const store = TestBed.inject(UiStore);
    store.hasDocument.set(true);
    store.setMode('presentation');
    const fixture = await render();
    expect(areas(fixture.nativeElement)).toEqual(['canvas']);
  });

  it('FIL-007 the shell enables document controls only while the active tab is ready', async () => {
    const session = TestBed.inject(SessionStore);
    const ui = TestBed.inject(UiStore);
    const fixture = await render();
    expect(ui.hasDocument()).toBe(false);
    await session.openFiles([file('a.pdf')]);
    await settle();
    await fixture.whenStable();
    expect(ui.hasDocument()).toBe(true);
    await session.openFiles([file('bad.pdf', 0)]);
    await settle();
    await fixture.whenStable();
    expect(ui.hasDocument()).toBe(false);
    session.closeTab(session.activeTabId() ?? '');
    await fixture.whenStable();
    expect(ui.hasDocument()).toBe(true);
  });

  describe('ink controls (M14 S2)', () => {
    const inkStroke = (id: string) => ({
      id,
      pageIndex: 0,
      points: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      color: TUNABLES.colors.penPresets[0] as string,
      widthPt: 1,
      opacity: 1,
      multiply: false,
    });
    const WIDE = { width: TUNABLES.layout.compactMaxWidthPx + 100, height: TUNABLES.layout.compactMaxHeightPx + 100 };

    async function ready() {
      const session = TestBed.inject(SessionStore);
      const ui = TestBed.inject(UiStore);
      ui.setViewport(WIDE.width, WIDE.height);
      const fixture = await render();
      await session.openFiles([file('a.pdf')]);
      await settle();
      await fixture.whenStable();
      const button = (label: string) =>
        fixture.nativeElement.querySelector(`button[aria-label="${translate(`a11y.${label}`)}"]`) as HTMLButtonElement;
      return { session, ui, fixture, button };
    }

    it('ANN-006 undo and redo are disabled with an empty history and follow the active document', async () => {
      const { session, fixture, button } = await ready();
      const doc = session.activeDocument()!;
      expect(button('undo').getAttribute('aria-disabled')).toBe('true');
      expect(button('redo').getAttribute('aria-disabled')).toBe('true');
      doc.addStroke(inkStroke('a'));
      await fixture.whenStable();
      expect(button('undo').getAttribute('aria-disabled')).toBeNull();
      button('undo').click();
      await fixture.whenStable();
      expect(doc.strokes()).toEqual([]);
      expect(button('undo').getAttribute('aria-disabled')).toBe('true');
      expect(button('redo').getAttribute('aria-disabled')).toBeNull();
      button('redo').click();
      expect(doc.strokes().map((s) => s.id)).toEqual(['a']);
    });

    it('ANN-006 undo acts on the active tab only', async () => {
      const { session, fixture, button } = await ready();
      const first = session.activeDocument()!;
      first.addStroke(inkStroke('a'));
      await session.openFiles([file('b.pdf', 2)]);
      await settle();
      await fixture.whenStable();
      const second = session.activeDocument()!;
      expect(second).not.toBe(first);
      expect(button('undo').getAttribute('aria-disabled')).toBe('true'); // the second tab has no history
      second.addStroke(inkStroke('b'));
      await fixture.whenStable();
      button('undo').click();
      expect(second.strokes()).toEqual([]);
      expect(first.strokes().map((s) => s.id)).toEqual(['a']);
    });

    it('ANN-013 strokeInProgress mirrors the active document and disables undo/redo meanwhile', async () => {
      const { session, ui, fixture, button } = await ready();
      const doc = session.activeDocument()!;
      doc.addStroke(inkStroke('a'));
      doc.strokeStarted();
      await fixture.whenStable();
      expect(ui.strokeInProgress()).toBe(true);
      expect(button('undo').getAttribute('aria-disabled')).toBe('true');
      doc.strokeEnded();
      await fixture.whenStable();
      expect(ui.strokeInProgress()).toBe(false);
      expect(button('undo').getAttribute('aria-disabled')).toBeNull();
    });

    it('ANN-013 closing the tab during a stroke clears strokeInProgress', async () => {
      const { session, ui, fixture } = await ready();
      session.activeDocument()!.strokeStarted();
      await fixture.whenStable();
      expect(ui.strokeInProgress()).toBe(true);
      session.closeTab(session.activeTabId()!);
      await fixture.whenStable();
      expect(ui.strokeInProgress()).toBe(false);
    });
  });
});
