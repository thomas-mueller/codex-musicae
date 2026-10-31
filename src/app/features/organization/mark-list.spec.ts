import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { EMPTY_MARKS } from '../../core';
import type { DocMarks } from '../../core';
import { generatePlayingOrderCases } from '../../core/fixtures/playing-order.cases';
import { OrgViewStore } from '../../state/org-view.store';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { isSwipeLeft, MarkList, markListEntries, replayArrivals } from './mark-list';

const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const SYSTEMS = [{ x: 0, y: 100, width: PAGE_WIDTH, height: 100 }, { x: 0, y: 500, width: PAGE_WIDTH, height: 100 }];
const palette = TUNABLES.colors.jumpPalette.length;
const MAX = TUNABLES.playingOrder.maxLength;

const marks = (over: Partial<DocMarks> & { jumps?: DocMarks['jumps'] }): DocMarks => ({
  ...EMPTY_MARKS,
  ...over,
  nextJumpId: (over.jumps?.length ?? 0) + 1,
});
const describeEntries = (m: DocMarks, systemCount: number) =>
  markListEntries(m, systemCount, MAX, palette).map((e) => `${e.kind}:${e.kind === 'jump' ? e.id : e.junction}${e.reached ? '' : '!'}`);

describe('replayArrivals', () => {
  for (const c of generatePlayingOrderCases) {
    it(`PLY-002 ${c.id}: the replay keeps as many systems as the playing order (${c.name})`, () => {
      const jumps = c.input.jumps.map((j, i) => ({ ...j, id: i + 1 }));
      const replay = replayArrivals({ ...EMPTY_MARKS, jumps, stops: [...c.input.stops] }, c.input.systemCount, c.input.maxLength);
      expect(replay.entryCount).toBe(c.expected.entries.length);
    });
  }
});

describe('markListEntries', () => {
  it('ORG-021 without marks the list is empty', () => {
    expect(markListEntries(EMPTY_MARKS, 4, MAX, palette)).toEqual([]);
  });

  it('ORG-021 items follow the playing order, not the creation order or the junction numbers', () => {
    // 1 2 3 4 | jump 4 -> 0 | 1 2 3 4: the break at 3 is met before the jump fires at 4, the stop ends at its last arrival.
    const m = marks({ jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }], breaks: [3], stops: [] });
    expect(describeEntries(m, 4)).toEqual(['break:3', 'jump:1']);
    const withBreakFirst = marks({ jumps: [{ origin: 3, target: 1, pass: 1, id: 1 }], breaks: [2, 4], stops: [] });
    // arrivals: 0,1,2(break),3(jump) -> 1, 2,3,4(break)
    expect(describeEntries(withBreakFirst, 4)).toEqual(['break:2', 'jump:1', 'break:4']);
  });

  it('ORG-021 a repeat lists the jump once, where it fires; its second visit adds nothing', () => {
    const m = marks({ jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }], breaks: [2] });
    expect(describeEntries(m, 4)).toEqual(['break:2', 'jump:1']);
  });

  it('ORG-021 a jump of the second pass fires at the second arrival at its origin', () => {
    const m = marks({
      jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }, { origin: 2, target: 4, pass: 2, id: 2 }],
      breaks: [3],
    });
    // arrivals: 0 1 2 3 4(jump 1) 0 1 2(2nd arrival: jump 2 -> 4) 4 ...
    expect(describeEntries(m, 4)).toEqual(['break:3', 'jump:1', 'jump:2']);
  });

  it('ORG-021 a stop applies at its last arrival, so a repeated junction is passed before the stop is listed', () => {
    const m = marks({
      jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }, { origin: 4, target: 1, pass: 2, id: 2 }],
      breaks: [3],
      stops: [2],
    });
    // 1 2 3 4 | 0 -> 1 2 3 4 | 1 -> 2: junction 2 is arrived at three times, the stop acts at the third.
    expect(describeEntries(m, 4)).toEqual(['break:3', 'jump:1', 'jump:2', 'stop:2']);
  });

  it('ORG-021 a stop that ends the order earlier makes a later stop unreached', () => {
    const m = marks({ jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }], breaks: [3], stops: [2, 3] });
    // 1 2 3 4 | 0 -> 1 2 [stop 2]; the stop at 3 would act after it.
    expect(describeEntries(m, 4)).toEqual(['break:3', 'jump:1', 'stop:2', 'stop:3!']);
  });

  it('ORG-021 a jump shadowed by an earlier jump with the same origin and pass is unreached', () => {
    const m = marks({ jumps: [{ origin: 4, target: 0, pass: 1, id: 1 }, { origin: 4, target: 2, pass: 1, id: 2 }] });
    expect(describeEntries(m, 4)).toEqual(['jump:1', 'jump:2!']);
  });

  it('ORG-021 unreached items come jumps first (creation order), then breaks, then stops', () => {
    const m = marks({
      jumps: [{ origin: 3, target: 0, pass: 9, id: 1 }, { origin: 2, target: 0, pass: 8, id: 2 }],
      breaks: [3],
      stops: [1],
    });
    // The stop at 1 ends the order after the first system; everything after it is unreached.
    expect(describeEntries(m, 4)).toEqual(['stop:1', 'jump:1!', 'jump:2!', 'break:3!']);
  });

  it('ORG-021 jump entries carry the system numbers, null where an end has no system, pass and color', () => {
    const [entry] = markListEntries(marks({ jumps: [{ origin: 0, target: 4, pass: 1, id: 1 }] }), 4, MAX, palette);
    expect(entry).toMatchObject({ kind: 'jump', fromSystem: null, toSystem: null, pass: 1, colorIndex: 0, junction: 0, reached: true });
    const [other] = markListEntries(marks({ jumps: [{ origin: 3, target: 1, pass: 2, id: 2 }] }), 4, MAX, palette);
    expect(other).toMatchObject({ fromSystem: 3, toSystem: 2, colorIndex: 1 });
  });

  it('ORG-021 break and stop entries name the system above their junction', () => {
    const entries = markListEntries(marks({ breaks: [2], stops: [3] }), 4, MAX, palette);
    expect(entries).toMatchObject([{ kind: 'break', junction: 2, systemAbove: 2 }, { kind: 'stop', junction: 3, systemAbove: 3 }]);
  });
});

describe('isSwipeLeft', () => {
  const min = TUNABLES.layout.markListSwipeMinPx;
  it('ORG-021 needs a leftward move of at least the minimum distance', () => {
    expect(isSwipeLeft(-min, 0)).toBe(true);
    expect(isSwipeLeft(-min + 1, 0)).toBe(false);
    expect(isSwipeLeft(min, 0)).toBe(false);
  });

  it('ORG-021 a mostly vertical move is not a swipe', () => {
    expect(isSwipeLeft(-min, min * 2)).toBe(false);
  });
});

describe('MarkList', () => {
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
    const fixture = TestBed.createComponent(MarkList);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const entries = () => Array.from(root.querySelectorAll<HTMLElement>('[data-testid="mark-list-entry"]'));
    return { doc, ui, view, fixture, root, entries };
  }

  it('ORG-021 jumps, breaks and stops are listed in playing order with their icons and numbers', async () => {
    const { doc, fixture, entries } = await setup();
    doc.addJump({ origin: 4, target: 0, pass: 3 });
    doc.toggleStop(3);
    doc.toggleBreak(1);
    await fixture.whenStable();
    // 4 systems: arrivals 0, 1(break), 2, 3(stop reached on its last arrival: only one) -> the jump at 4 is never reached.
    expect(entries().map((e) => `${e.dataset['kind']}:${e.dataset['junction']}`)).toEqual(['break:1', 'stop:3', 'jump:4']);
    const [breakEntry, stopEntry, jumpEntry] = entries();
    expect(breakEntry!.querySelector('[data-testid="mark-list-system"]')!.textContent).toBe('1');
    expect(stopEntry!.querySelector('[data-testid="mark-list-icon"]')).not.toBeNull();
    expect(jumpEntry!.classList.contains('unreached')).toBe(true);
    expect(jumpEntry!.querySelector('[data-testid="mark-list-from"]')!.textContent).toBe('4');
    expect(jumpEntry!.querySelector('[data-testid="mark-list-to"]')!.textContent).toBe('1');
    expect(jumpEntry!.querySelector('[data-testid="mark-list-pass"]')!.textContent).toBe(`${TUNABLES.layout.passPrefix}3`);
    expect(jumpEntry!.textContent).toContain(TUNABLES.layout.listArrow);
    expect((jumpEntry!.querySelector('[data-testid="mark-list-dot"]') as HTMLElement).style.background).not.toBe('');
  });

  it('ORG-021 an empty list shows no entries', async () => {
    const { entries } = await setup();
    expect(entries()).toHaveLength(0);
  });

  it('ORG-021 tapping a jump scrolls to its origin and selects the jump; a break selects its junction', async () => {
    const { doc, ui, view, fixture, entries } = await setup();
    doc.addJump({ origin: 4, target: 0, pass: 1 });
    doc.toggleBreak(2);
    await fixture.whenStable();
    const scroll = vi.spyOn(view, 'scrollToJunction');
    entries().find((e) => e.dataset['kind'] === 'jump')!.click();
    expect(scroll).toHaveBeenLastCalledWith(doc.bars(), 4);
    expect(ui.selection()).toEqual({ kind: 'jump', id: 1 });
    entries().find((e) => e.dataset['kind'] === 'break')!.click();
    expect(scroll).toHaveBeenLastCalledWith(doc.bars(), 2);
    expect(ui.selection()).toEqual({ kind: 'junction', junction: 2 });
  });

  it('ORG-021 the sheet closes after a tap when compact, the panel stays open when expanded', async () => {
    const { doc, ui, fixture, entries } = await setup();
    doc.addJump({ origin: 4, target: 0, pass: 1 });
    await fixture.whenStable();
    ui.setViewport(TUNABLES.layout.compactMaxWidthPx - 1, TUNABLES.layout.compactMaxHeightPx - 1);
    ui.openPopup('markList');
    entries()[0]!.click();
    expect(ui.popup()).toBeNull();
    ui.setViewport(TUNABLES.layout.compactMaxWidthPx + 1, TUNABLES.layout.compactMaxHeightPx + 1);
    ui.openPopup('markList');
    entries()[0]!.click();
    expect(ui.popup()?.id).toBe('markList');
  });

  it('ORG-021 ORG-024 the trash icon deletes a jump, a break and a stop without scrolling', async () => {
    const { doc, view, fixture, entries } = await setup();
    doc.addJump({ origin: 4, target: 0, pass: 1 });
    doc.toggleBreak(1);
    doc.toggleStop(2);
    await fixture.whenStable();
    const scroll = vi.spyOn(view, 'scrollToJunction');
    for (const kind of ['jump', 'break', 'stop']) {
      entries().find((e) => e.dataset['kind'] === kind)!.querySelector<HTMLElement>('[data-testid="mark-list-delete"]')!.click();
      await fixture.whenStable();
    }
    expect(doc.marks()).toMatchObject({ jumps: [], breaks: [], stops: [] });
    expect(scroll).not.toHaveBeenCalled();
    expect(entries()).toHaveLength(0);
  });

  it('ORG-021 swiping an entry to the left deletes it and the click that follows does nothing', async () => {
    const { doc, view, fixture, entries } = await setup();
    doc.toggleBreak(2);
    await fixture.whenStable();
    const scroll = vi.spyOn(view, 'scrollToJunction');
    const entry = entries()[0]!;
    const pointer = (type: string, x: number) => entry.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: 0 }));
    pointer('pointerdown', TUNABLES.layout.markListSwipeMinPx * 2);
    pointer('pointerup', 0);
    entry.click();
    await fixture.whenStable();
    expect(doc.marks().breaks).toEqual([]);
    expect(scroll).not.toHaveBeenCalled();
  });
});
