import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import { SessionStore } from '../../state/session.store';
import { OrgViewStore } from '../../state/org-view.store';
import { UiStore } from '../../state/ui.store';
import { OrganizationViewer } from './organization-viewer';

const VIEW_WIDTH = 300;
const VIEW_HEIGHT = 2000;
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;
const SYSTEMS = [
  { x: 0, y: 100, width: PAGE_WIDTH, height: 100 },
  { x: 0, y: 300, width: PAGE_WIDTH, height: 100 },
];
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('OrganizationViewer selection and marks', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(VIEW_WIDTH);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(VIEW_HEIGHT);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as never);
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  /** Page 0 has two systems (bars for junctions 0, 1, 2); page 1 stays pending. */
  async function mount() {
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'id-a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    const doc = session.activeDocument()!;
    doc.detection.reset(2);
    const fixture = TestBed.createComponent(OrganizationViewer);
    fixture.componentRef.setInput('document', doc);
    await fixture.whenStable();
    await settle();
    doc.detection.finish(0, 'done', { pageIndex: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, systems: SYSTEMS });
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const bar = (junction: number) => root.querySelectorAll<HTMLElement>('[data-testid="org-bar"]')[junction]!;
    const chip = () => root.querySelector<HTMLElement>('[data-testid="selection-chip"]');
    const press = async (id: string) => {
      root.querySelector<HTMLElement>(`[data-testid="chip-${id}"]`)!.click();
      await fixture.whenStable();
    };
    return { doc, fixture, root, bar, chip, press };
  }

  it('ORG-013 tapping a bar selects its junction and shows the chip; empty space deselects', async () => {
    const { fixture, root, bar, chip } = await mount();
    const ui = TestBed.inject(UiStore);
    bar(1).click();
    await fixture.whenStable();
    expect(ui.selection()).toEqual({ kind: 'junction', junction: 1 });
    expect(bar(1).classList.contains('selected')).toBe(true);
    expect(chip()).not.toBeNull();
    root.querySelector<HTMLElement>('[data-testid="org-page-0"]')!.click();
    await fixture.whenStable();
    expect(ui.selection()).toBeNull();
    expect(chip()).toBeNull();
  });

  it('ORG-013 Escape deselects', async () => {
    const { fixture, root, bar, chip } = await mount();
    bar(1).click();
    await fixture.whenStable();
    root.dispatchEvent(new KeyboardEvent('keydown', { code: TUNABLES.keymap.back[0], bubbles: true }));
    await fixture.whenStable();
    expect(TestBed.inject(UiStore).selection()).toBeNull();
    expect(chip()).toBeNull();
  });

  it('ORG-022 ORG-023 ORG-011 chip toggles break and stop and the row shows the icons', async () => {
    const { doc, fixture, root, bar, press } = await mount();
    bar(1).click();
    await fixture.whenStable();
    await press('break');
    await press('stop');
    expect(doc.marks().breaks).toEqual([1]);
    expect(doc.marks().stops).toEqual([1]);
    expect(bar(1).querySelector('[data-testid="org-bar-break-line"]')).not.toBeNull();
    expect(bar(1).querySelector('[data-testid="org-bar-stop-icon"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="system-label"][data-system="1"]')?.textContent).toBe('1'); // numbers sit on the systems
    expect(bar(1).querySelector('[data-testid="org-bar-numbers"]')).toBeNull();
    await press('break');
    expect(doc.marks().breaks).toEqual([]);
  });

  it('ORG-014 ORG-024 delete appears with items and clears the junction at once', async () => {
    const { doc, fixture, bar, chip, press } = await mount();
    bar(1).click();
    await fixture.whenStable();
    expect(chip()!.querySelector('[data-testid="chip-delete"]')).toBeNull();
    await press('break');
    expect(chip()!.querySelector('[data-testid="chip-delete"]')).not.toBeNull();
    await press('delete');
    expect(doc.marks().breaks).toEqual([]);
    expect(chip()!.querySelector('[data-testid="chip-delete"]')).toBeNull();
  });

  it('ORG-014 break and stop are disabled on junctions 0 and N', async () => {
    const { doc, fixture, bar, chip } = await mount();
    for (const junction of [0, doc.junctionCount()]) {
      bar(junction).click();
      await fixture.whenStable();
      expect(chip()!.querySelector('[data-testid="chip-break"]')!.classList.contains('disabled')).toBe(true);
      expect(chip()!.querySelector('[data-testid="chip-stop"]')!.classList.contains('disabled')).toBe(true);
    }
  });

  it('ORG-013 switching the mode clears the selection', async () => {
    const { fixture, bar } = await mount();
    const ui = TestBed.inject(UiStore);
    ui.setMode('organization');
    bar(1).click();
    await fixture.whenStable();
    ui.setMode('annotation');
    expect(ui.selection()).toBeNull();
  });

  const tap = async (fixture: { whenStable(): Promise<unknown> }, element: HTMLElement) => {
    element.click();
    await fixture.whenStable();
  };

  it('ORG-015 ORG-016 ORG-018 jump flow: chip, pick a target, stepper, markers', async () => {
    const { doc, fixture, root, bar, press } = await mount();
    const ui = TestBed.inject(UiStore);
    await tap(fixture, bar(2));
    await press('jump');
    expect(ui.pickingTarget()).toEqual({ originJunction: 2 });
    expect(root.querySelector('[data-testid="org-hint-bar"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="selection-chip"]')).toBeNull();
    expect(bar(0).classList.contains('target')).toBe(true);
    expect(bar(2).classList.contains('target')).toBe(false);

    await tap(fixture, bar(2)); // the origin again does nothing
    expect(ui.pickingTarget()).not.toBeNull();
    expect(doc.marks().jumps).toEqual([]);

    await tap(fixture, bar(0));
    expect(doc.marks().jumps).toEqual([{ origin: 2, target: 0, pass: 1, id: 1 }]);
    expect(ui.pickingTarget()).toBeNull();
    expect(ui.selection()).toEqual({ kind: 'jump', id: 1 });
    expect(root.querySelector('[data-testid="stepper-value"]')!.textContent).toBe('1');

    root.querySelector<HTMLElement>('[data-testid="stepper-plus"]')!.click();
    await fixture.whenStable();
    expect(doc.marks().jumps[0]?.pass).toBe(2);
    expect(root.querySelector('[data-testid="stepper-value"]')!.textContent).toBe('2'); // the stepper stays open and selected
    expect(ui.selection()).toEqual({ kind: 'jump', id: 1 });
    // Jump from junction 2 to junction 0 with pass 2: it is met after the 2nd played system and the 3rd would follow.
    // Pass 2 is never reached in this order (junction 2 is arrived at once), so both ends show the placeholder.
    const start = root.querySelector('[data-testid="jump-marker"][data-role="origin"]')!;
    const unknown = TUNABLES.layout.unknownNumber;
    const expected = `${unknown} ${TUNABLES.layout.listArrow} ${unknown} ${TUNABLES.layout.passPrefix}2`;
    expect(start.querySelector('[data-testid="jump-marker-label"]')!.textContent).toBe(expected);
    const end = root.querySelector('[data-testid="jump-marker"][data-role="target"]')!;
    expect(end.querySelector('[data-testid="jump-marker-label"]')!.textContent).toBe(expected);
  });

  it('ORG-015 Escape and the cancel icon leave picking without a change', async () => {
    const { doc, fixture, root, bar, press } = await mount();
    const ui = TestBed.inject(UiStore);
    await tap(fixture, bar(1));
    await press('jump');
    root.dispatchEvent(new KeyboardEvent('keydown', { code: TUNABLES.keymap.back[0], bubbles: true }));
    await fixture.whenStable();
    expect(ui.pickingTarget()).toBeNull();
    await press('jump');
    root.querySelector<HTMLElement>('[data-testid="org-hint-cancel"]')!.click();
    await fixture.whenStable();
    expect(ui.pickingTarget()).toBeNull();
    expect(doc.marks().jumps).toEqual([]);
    expect(root.querySelector('[data-testid="org-hint-bar"]')).toBeNull();
  });

  it('ORG-020 selecting a marker offers pass, change target and delete; change target retargets', async () => {
    const { doc, fixture, root, bar } = await mount();
    const ui = TestBed.inject(UiStore);
    doc.addJump({ origin: 2, target: 0, pass: 1 });
    await fixture.whenStable();
    ui.closePopup();
    await tap(fixture, root.querySelector<HTMLElement>('[data-testid="jump-marker"][data-role="origin"]')!);
    expect(ui.selection()).toEqual({ kind: 'jump', id: 1 });
    for (const id of ['pass', 'change-target', 'delete']) {
      expect(root.querySelector(`[data-testid="chip-${id}"]`), id).not.toBeNull();
    }
    root.querySelector<HTMLElement>('[data-testid="chip-change-target"]')!.click();
    await fixture.whenStable();
    expect(ui.pickingTarget()).toEqual({ originJunction: 2, editJumpId: 1 });
    await tap(fixture, bar(1));
    expect(doc.marks().jumps[0]).toMatchObject({ origin: 2, target: 1, pass: 1, id: 1 });
    expect(ui.pickingTarget()).toBeNull();
  });

  it('ORG-020 the pass button opens the stepper; delete removes the jump and its markers', async () => {
    const { doc, fixture, root } = await mount();
    const ui = TestBed.inject(UiStore);
    doc.addJump({ origin: 2, target: 0, pass: 3 });
    await fixture.whenStable();
    ui.closePopup();
    await tap(fixture, root.querySelector<HTMLElement>('[data-testid="jump-marker"][data-role="origin"]')!);
    root.querySelector<HTMLElement>('[data-testid="chip-pass"]')!.click();
    await fixture.whenStable();
    expect(root.querySelector('[data-testid="stepper-value"]')!.textContent).toBe('3');
    ui.closePopup();
    await fixture.whenStable();
    root.querySelector<HTMLElement>('[data-testid="chip-delete"]')!.click();
    await fixture.whenStable();
    expect(doc.marks().jumps).toEqual([]);
    expect(ui.selection()).toBeNull();
    expect(root.querySelectorAll('[data-testid="jump-marker"]')).toHaveLength(0);
  });

  it('ORG-019 long press on a marker scrolls to the other end of the jump', async () => {
    const { doc, fixture, root } = await mount();
    const view = TestBed.inject(OrgViewStore);
    const scroll = vi.spyOn(view, 'scrollToJunction');
    doc.addJump({ origin: 2, target: 0, pass: 1 });
    await fixture.whenStable();
    const marker = root.querySelector<HTMLElement>('[data-testid="jump-marker"][data-role="origin"]')!;
    vi.useFakeTimers();
    marker.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs);
    vi.useRealTimers();
    expect(scroll).toHaveBeenCalledWith(doc.bars(), 0);
  });

  it('ORG-021 deleting the selected jump closes the pass stepper but leaves other popups open', async () => {
    const { doc, fixture } = await mount();
    const ui = TestBed.inject(UiStore);
    doc.addJump({ origin: 2, target: 0, pass: 1 });
    ui.select({ kind: 'jump', id: 1 });
    ui.openPopup('passStepper');
    await fixture.whenStable();
    doc.removeJump(1);
    await fixture.whenStable();
    expect(ui.popup()).toBeNull();
    doc.addJump({ origin: 2, target: 0, pass: 1 });
    ui.select({ kind: 'jump', id: 2 });
    ui.openPopup('markList');
    await fixture.whenStable();
    doc.removeJump(2);
    await fixture.whenStable();
    expect(ui.selection()).toBeNull();
    expect(ui.popup()?.id).toBe('markList');
  });

  it('ORG-016 a second jump from the same bar starts at occurrence 2 and the stepper shows it', async () => {
    const { doc, fixture, root, bar, press } = await mount();
    const ui = TestBed.inject(UiStore);
    doc.addJump({ origin: 2, target: 0, pass: 1 });
    await fixture.whenStable();
    ui.closePopup();
    await tap(fixture, bar(2));
    await press('jump');
    await tap(fixture, bar(1));
    expect(doc.marks().jumps.map((j) => [j.origin, j.target, j.pass])).toEqual([[2, 0, 1], [2, 1, 2]]);
    expect(root.querySelector('[data-testid="stepper-value"]')!.textContent).toBe('2');
  });
});
