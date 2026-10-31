import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import type { Bar, DocMarks } from '../../core';
import { OrgViewStore } from '../../state/org-view.store';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { formatLabel } from './jump-badges';
import { isSwipeLeft, JumpList, jumpListEntries } from './jump-list';

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const SYSTEMS = [{ x: 0, y: 100, width: PAGE_WIDTH, height: 100 }, { x: 0, y: 500, width: PAGE_WIDTH, height: 100 }];
const palette = TUNABLES.colors.jumpPalette.length;

const bars: Bar[] = [
  { junction: 0, pageIndex: 0, y: 0, height: 100 },
  { junction: 1, pageIndex: 0, y: 300, height: 100 },
  { junction: 2, pageIndex: 1, y: 580, height: 100 },
];
const marks = (jumps: DocMarks['jumps']): DocMarks => ({ jumps, breaks: [], stops: [], nextJumpId: jumps.length + 1 });

describe('jumpListEntries', () => {
  it('ORG-021 lists each jump in creation order with labels, pass and color', () => {
    const entries = jumpListEntries(
      marks([{ origin: 2, target: 0, pass: 2, id: 1 }, { origin: 1, target: 2, pass: 1, id: 2 }]),
      bars,
      palette,
    );
    expect(entries.map((e) => [e.id, e.fromLabel, e.toLabel, e.pass, e.colorIndex])).toEqual([
      [1, formatLabel({ page: 2, ordinal: 1 }), formatLabel({ page: 1, ordinal: 1 }), 2, 0],
      [2, formatLabel({ page: 1, ordinal: 2 }), formatLabel({ page: 2, ordinal: 1 }), 1, 1],
    ]);
  });

  it('ORG-021 a jump whose end has no bar yet is left out; an empty list gives no entries', () => {
    expect(jumpListEntries(marks([{ origin: 1, target: 9, pass: 1, id: 1 }]), bars, palette)).toEqual([]);
    expect(jumpListEntries(marks([]), bars, palette)).toEqual([]);
  });
});

describe('isSwipeLeft', () => {
  const min = TUNABLES.layout.jumpListSwipeMinPx;
  it('ORG-021 needs a leftward move of at least the minimum distance', () => {
    expect(isSwipeLeft(-min, 0)).toBe(true);
    expect(isSwipeLeft(-min + 1, 0)).toBe(false);
    expect(isSwipeLeft(min, 0)).toBe(false);
  });

  it('ORG-021 a mostly vertical move is not a swipe', () => {
    expect(isSwipeLeft(-min, min * 2)).toBe(false);
  });
});

describe('JumpList', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts()] }));

  async function setup() {
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    const doc = session.activeDocument()!;
    const ui = TestBed.inject(UiStore);
    ui.setMode('organization');
    await new Promise((resolve) => setTimeout(resolve, 10)); // organization mode starts detection; wait before faking results
    doc.detection.reset(2);
    doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: SYSTEMS });
    doc.detection.finish(1, 'done', { pageIndex: 1, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: SYSTEMS });
    const view = TestBed.inject(OrgViewStore);
    view.viewport.set({ width: 300, height: 400 });
    const fixture = TestBed.createComponent(JumpList);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const entries = () => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="jump-list-entry"]'));
    return { doc, ui, view, fixture, root, entries };
  }

  it('ORG-021 an entry shows the color dot, from label, arrow, to label and pass', async () => {
    const { doc, fixture, root, entries } = await setup();
    doc.addJump({ origin: 4, target: 0, pass: 3 });
    await fixture.whenStable();
    const [entry] = entries();
    expect(entry!.querySelector('[data-testid="jump-list-from"]')!.textContent).toBe(formatLabel({ page: 2, ordinal: 3 }));
    expect(entry!.querySelector('[data-testid="jump-list-to"]')!.textContent).toBe(formatLabel({ page: 1, ordinal: 1 }));
    expect(entry!.querySelector('[data-testid="jump-list-pass"]')!.textContent).toBe(`${TUNABLES.layout.passPrefix}3`);
    expect(entry!.textContent).toContain(TUNABLES.layout.listArrow);
    expect((entry!.querySelector('[data-testid="jump-list-dot"]') as HTMLElement).style.background).not.toBe('');
    expect(root.querySelectorAll('[data-testid="jump-list-entry"]')).toHaveLength(1);
  });

  it('ORG-021 an empty list shows no entries', async () => {
    const { entries } = await setup();
    expect(entries()).toHaveLength(0);
  });

  it('ORG-021 tapping an entry scrolls to the origin bar and selects the jump', async () => {
    const { doc, ui, view, fixture, entries } = await setup();
    doc.addJump({ origin: 4, target: 0, pass: 1 });
    await fixture.whenStable();
    const scroll = vi.spyOn(view, 'scrollToJunction');
    entries()[0]!.click();
    expect(scroll).toHaveBeenCalledWith(doc.bars(), 4);
    expect(ui.selection()).toEqual({ kind: 'jump', id: 1 });
  });

  it('ORG-021 the sheet closes after a tap when compact, the panel stays open when expanded', async () => {
    const { doc, ui, fixture, entries } = await setup();
    doc.addJump({ origin: 4, target: 0, pass: 1 });
    await fixture.whenStable();
    ui.setViewport(TUNABLES.layout.compactMaxWidthPx - 1, TUNABLES.layout.compactMaxHeightPx - 1);
    ui.openPopup('jumpList');
    entries()[0]!.click();
    expect(ui.popup()).toBeNull();
    ui.setViewport(TUNABLES.layout.compactMaxWidthPx + 1, TUNABLES.layout.compactMaxHeightPx + 1);
    ui.openPopup('jumpList');
    entries()[0]!.click();
    expect(ui.popup()?.id).toBe('jumpList');
  });

  it('ORG-021 the trash icon deletes the jump without scrolling', async () => {
    const { doc, view, fixture, entries } = await setup();
    doc.addJump({ origin: 4, target: 0, pass: 1 });
    await fixture.whenStable();
    const scroll = vi.spyOn(view, 'scrollToJunction');
    entries()[0]!.querySelector<HTMLElement>('[data-testid="jump-list-delete"]')!.click();
    await fixture.whenStable();
    expect(doc.marks().jumps).toEqual([]);
    expect(scroll).not.toHaveBeenCalled();
    expect(entries()).toHaveLength(0);
  });

  it('ORG-021 swiping an entry to the left deletes it and the click that follows does nothing', async () => {
    const { doc, view, fixture, entries } = await setup();
    doc.addJump({ origin: 4, target: 0, pass: 1 });
    await fixture.whenStable();
    const scroll = vi.spyOn(view, 'scrollToJunction');
    const entry = entries()[0]!;
    const pointer = (type: string, x: number) => entry.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: 0 }));
    pointer('pointerdown', TUNABLES.layout.jumpListSwipeMinPx * 2);
    pointer('pointerup', 0);
    entry.click();
    await fixture.whenStable();
    expect(doc.marks().jumps).toEqual([]);
    expect(scroll).not.toHaveBeenCalled();
  });
});
