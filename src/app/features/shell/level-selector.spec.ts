import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import { DetectionService } from '../../state/detection.service';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { LevelConfirm } from './level-confirm';
import { PopupHost } from './popup-host';
import { ToolArea } from './tool-area';

const OTHER_LEVEL = TUNABLES.detection.defaultLevel === 'fine' ? 'fast' : 'fine';
const LEVEL_ICON = { fast: 'levelFast', standard: 'levelStandard', fine: 'levelFine' } as const;
const WIDE = { width: TUNABLES.layout.compactMaxWidthPx + 100, height: TUNABLES.layout.compactMaxHeightPx + 100 };

describe('level selector', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }] }),
  );

  async function openDocument() {
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    const ui = TestBed.inject(UiStore);
    ui.hasDocument.set(true);
    ui.setMode('organization');
    ui.setViewport(WIDE.width, WIDE.height);
    return { doc: session.activeDocument()!, ui };
  }

  it('DET-014 choosing a level asks for confirmation and changes nothing before it', async () => {
    const { doc, ui } = await openDocument();
    const redetect = vi.spyOn(TestBed.inject(DetectionService), 'redetect').mockImplementation(() => undefined);
    ui.requestLevel(OTHER_LEVEL);
    expect(ui.pendingLevel()).toBe(OTHER_LEVEL);
    expect(redetect).not.toHaveBeenCalled();
    expect(doc.detection.level()).toBe(TUNABLES.detection.defaultLevel);
  });

  it('DET-014 the dialog shows the chosen level icon with cancel and confirm; cancel changes nothing', async () => {
    const { ui } = await openDocument();
    const redetect = vi.spyOn(TestBed.inject(DetectionService), 'redetect').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(LevelConfirm);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('[data-testid="level-dialog"]')).toBeNull();
    ui.requestLevel(OTHER_LEVEL);
    await fixture.whenStable();
    expect(root.querySelector('[data-testid="level-dialog"]')).not.toBeNull();
    expect(root.querySelector('app-icon use')?.getAttribute('href')).toContain(TUNABLES.icons[LEVEL_ICON[OTHER_LEVEL]]);
    expect(root.querySelector('[data-testid="level-dialog"]')!.textContent!.trim()).toBe(''); // icons only
    root.querySelector<HTMLElement>('[data-testid="level-cancel"]')!.click();
    await fixture.whenStable();
    expect(ui.pendingLevel()).toBeNull();
    expect(redetect).not.toHaveBeenCalled();
  });

  it('DET-014 confirming re-runs detection of the active document at that level', async () => {
    const { doc, ui } = await openDocument();
    const redetect = vi.spyOn(TestBed.inject(DetectionService), 'redetect').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(LevelConfirm);
    ui.requestLevel(OTHER_LEVEL);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[data-testid="level-confirm"]').click();
    await fixture.whenStable();
    expect(redetect).toHaveBeenCalledWith(doc, OTHER_LEVEL);
    expect(ui.pendingLevel()).toBeNull();
  });

  it('DET-014 the scrim and Escape close the dialog without a re-run', async () => {
    const { ui } = await openDocument();
    const redetect = vi.spyOn(TestBed.inject(DetectionService), 'redetect').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(LevelConfirm);
    ui.requestLevel(OTHER_LEVEL);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[data-testid="level-scrim"]').click();
    expect(ui.pendingLevel()).toBeNull();
    ui.requestLevel(OTHER_LEVEL);
    await fixture.whenStable();
    fixture.nativeElement.ownerDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(ui.pendingLevel()).toBeNull();
    expect(redetect).not.toHaveBeenCalled();
  });

  it('DET-014 requesting a level needs a document; the mode change clears a pending request', async () => {
    const ui = TestBed.inject(UiStore);
    ui.requestLevel(OTHER_LEVEL);
    expect(ui.pendingLevel()).toBeNull();
    ui.hasDocument.set(true);
    ui.requestLevel(OTHER_LEVEL);
    ui.setMode('annotation');
    expect(ui.pendingLevel()).toBeNull();
  });

  it('DET-014 the strip toggles the level of the results on display and asks before changing it', async () => {
    const { ui } = await openDocument();
    const fixture = TestBed.createComponent(ToolArea);
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    const toggled = () => Array.from(root.querySelectorAll('button.toggled'));
    expect(toggled()).toHaveLength(1);
    const all = Array.from(root.querySelectorAll<HTMLElement>('button'));
    all[TUNABLES.detection.defaultLevel === 'fast' ? 2 : 0]!.click(); // a level other than the active one
    expect(ui.pendingLevel()).not.toBeNull();
  });

  it('ORG-021 the jump list button opens the list as a panel (expanded) and as a sheet (compact)', async () => {
    const { ui } = await openDocument();
    const fixture = TestBed.createComponent(PopupHost);
    ui.openPopup('markList');
    await fixture.whenStable();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.popup.panel app-mark-list')).not.toBeNull();
    ui.setViewport(TUNABLES.layout.compactMaxWidthPx - 1, TUNABLES.layout.compactMaxHeightPx - 1);
    await fixture.whenStable();
    expect(root.querySelector('.popup.sheet app-mark-list')).not.toBeNull();
  });
});
