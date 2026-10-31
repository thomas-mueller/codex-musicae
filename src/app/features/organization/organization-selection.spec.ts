import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import { SessionStore } from '../../state/session.store';
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

  it('ORG-022 ORG-023 ORG-011 chip toggles break and stop and the row shows numbers and icons', async () => {
    const { doc, fixture, bar, press } = await mount();
    bar(1).click();
    await fixture.whenStable();
    await press('break');
    await press('stop');
    expect(doc.marks().breaks).toEqual([1]);
    expect(doc.marks().stops).toEqual([1]);
    expect(bar(1).querySelector('[data-testid="org-bar-break-line"]')).not.toBeNull();
    expect(bar(1).querySelector('[data-testid="org-bar-stop-icon"]')).not.toBeNull();
    expect(bar(1).querySelector('[data-testid="org-bar-numbers"]')?.textContent).toBe('1');
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
});
