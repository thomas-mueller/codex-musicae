import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { FILE_ACCESS } from '../../ports/file-access';
import { OverwriteChoices } from '../../state/overwrite-choices';
import { SessionStore } from '../../state/session.store';
import { SettingsRegistry } from '../../state/settings-registry';
import type { fakeFileAccess } from '../../state/testing/fake-ports';
import { ToolSettingsStore } from '../../state/tool-settings.store';
import { UiStore } from '../../state/ui.store';
import { ResetConfirm } from './reset-confirm';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('ResetConfirm', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts()] });
  });
  afterEach(() => vi.useRealTimers());

  async function setup() {
    const ui = TestBed.inject(UiStore);
    const fixture = TestBed.createComponent(ResetConfirm);
    const tools = TestBed.inject(ToolSettingsStore);
    const flag = TestBed.inject(SettingsRegistry).register({ id: 'flag', group: 'general', labelKey: 'x', persist: true, type: 'boolean', defaultValue: false });
    const color = TUNABLES.colors.penPresets[1] as string;
    await tools.ready;
    await tools.setColor('pen', color);
    await flag.set(true);
    ui.setMode('settings');
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const find = (testId: string) => root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    const ask = async () => {
      ui.requestReset();
      await fixture.whenStable();
    };
    return { ui, fixture, tools, flag, color, find, ask };
  }

  it('UIX-023 shows a translated question only after the reset was asked for', async () => {
    const { find, ask } = await setup();
    expect(find('reset-dialog')).toBeNull();
    await ask();
    expect(find('reset-dialog')!.getAttribute('aria-label')).toBe(translate('a11y.resetConfirm'));
    expect(find('reset-dialog')!.textContent!.trim()).toBe(translate('settings.reset.question'));
  });

  for (const testId of ['reset-cancel', 'reset-scrim']) {
    it(`UIX-023 ${testId} closes the dialog and changes nothing`, async () => {
      const { fixture, tools, flag, color, find, ask } = await setup();
      await ask();
      find(testId)!.click();
      await fixture.whenStable();
      expect(find('reset-dialog')).toBeNull();
      expect(tools.pen().color).toBe(color);
      expect(flag.value()).toBe(true);
    });
  }

  it('UIX-023 confirming resets the registered settings and the tool settings and closes the dialog', async () => {
    const { ui, fixture, tools, flag, find, ask } = await setup();
    await ask();
    find('reset-confirm')!.click();
    await fixture.whenStable();
    await Promise.all([tools.ready, flag.ready]);
    expect(find('reset-dialog')).toBeNull();
    expect(ui.mode()).toBe('settings');
    expect(flag.value()).toBe(false);
    expect(tools.pen()).toEqual(TUNABLES.annotation.defaultPen);
  });

  async function openDocument({ detected }: { detected: boolean }) {
    const session = TestBed.inject(SessionStore);
    await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    await settle();
    const doc = session.activeDocument()!;
    if (detected) {
      doc.detection.reset(1);
      const systems = [0, 1, 2].map((i) => ({ x: 50, y: 50 + i * 250, width: 500, height: 150 }));
      doc.detection.finish(0, 'done', { pageIndex: 0, width: 600, height: 800, systems });
    }
    return { doc, files: TestBed.inject(FILE_ACCESS) as ReturnType<typeof fakeFileAccess> };
  }

  it('UIX-024 the reset leaves marks, annotations, the ratio of the PDF and the unsaved state as they are', async () => {
    const { fixture, find, ask } = await setup();
    const { doc } = await openDocument({ detected: true });
    doc.addStroke({ id: 's', pageIndex: 0, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: TUNABLES.colors.penPresets[0] as string, widthPt: 1, opacity: 1, multiply: false });
    doc.toggleStop(1);
    doc.ratioOverride.set({ landscape: 2 });
    await fixture.whenStable();
    const content = () => JSON.stringify({ metadata: doc.buildMetadata('v'), strokes: doc.strokes(), unsaved: doc.unsaved(), canUndo: doc.canUndo() });
    const before = content();
    expect(doc.buildMetadata('v').marks.stops).toHaveLength(1); // there is a mark to lose
    const changes: unknown[] = [];
    doc.changes.subscribe((change) => changes.push(change));
    await ask();
    find('reset-confirm')!.click();
    await fixture.whenStable();
    await settle();
    expect(content()).toBe(before);
    expect(changes).toEqual([]);
  });

  it('UIX-024 the reset of an unchanged document starts no save', async () => {
    const { find, ask } = await setup();
    // no detection: a completed run would itself be a change to save (SAV-012)
    const { doc, files } = await openDocument({ detected: false });
    await ask();
    vi.useFakeTimers(); // a save started by the reset would wait for the autosave timer
    find('reset-confirm')!.click();
    await vi.advanceTimersByTimeAsync(2 * TUNABLES.saving.autosaveIdleMs);
    expect(files.write).not.toHaveBeenCalled();
    expect(doc.unsaved()).toBe(false);
    // control: a change of the document is saved within the same time
    // FIL-041: the reset brought the overwrite question back, so it is switched off again here
    await TestBed.inject(OverwriteChoices).silence('all', 'a.pdf');
    doc.addStroke({ id: 's', pageIndex: 0, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], color: TUNABLES.colors.penPresets[0] as string, widthPt: 1, opacity: 1, multiply: false });
    await vi.advanceTimersByTimeAsync(2 * TUNABLES.saving.autosaveIdleMs);
    expect(files.write).toHaveBeenCalled();
  });
});
