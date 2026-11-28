import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { ALL_FEATURES_ON, provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { CommandBus } from '../../input/command-bus';
import { NavigationHandler } from '../../input/navigation-handler';
import { FEATURE_FLAGS } from '../../ports/feature-flags';
import type { FeatureFlags } from '../../ports/feature-flags';
import { FILE_ACCESS } from '../../ports/file-access';
import { FilePrompts } from '../../state/file-prompts';
import { SessionStore } from '../../state/session.store';
import type { fakeFileAccess } from '../../state/testing/fake-ports';
import { UiStore } from '../../state/ui.store';
import { AppShell } from '../shell/app-shell';
import { CloseDialog } from './close-dialog';
import { OverwriteDialog } from './overwrite-dialog';
import { SaveNotice } from './save-notice';

const FREE: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

async function setup(flags: FeatureFlags = ALL_FEATURES_ON) {
  TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts(), { provide: FEATURE_FLAGS, useValue: flags }] });
  const session = TestBed.inject(SessionStore);
  await session.openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
  await settle();
  const prompts = TestBed.inject(FilePrompts);
  const tabId = session.activeTabId()!;
  const render = async <T>(component: new () => T) => {
    const fixture = TestBed.createComponent(component);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const find = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    return { fixture, el, find };
  };
  return { session, prompts, tabId, render, files: TestBed.inject(FILE_ACCESS) as ReturnType<typeof fakeFileAccess> };
}

describe('overwrite dialog', () => {
  async function open() {
    const all = await setup();
    all.prompts.ask({ kind: 'overwrite', tabId: all.tabId, closing: false });
    const view = await all.render(OverwriteDialog);
    const answer = vi.spyOn(all.session, 'answerOverwrite').mockResolvedValue();
    return { ...all, ...view, answer };
  }

  it('FIL-036 shows the file name, a translated question, two unticked boxes and the three answers; no button has the focus', async () => {
    const { el, find } = await open();
    expect(find('overwrite-dialog')!.getAttribute('aria-label')).toBe(translate('a11y.overwriteDialog'));
    expect(el.querySelector('.file')!.textContent).toBe('a.pdf');
    expect(Array.from(el.querySelectorAll('button'), (b) => b.textContent?.trim())).toEqual(
      ['overwrite', 'saveAs', 'cancel'].map((key) => translate(`save.overwrite.${key}`)),
    );
    expect(Array.from(el.querySelectorAll<HTMLInputElement>('input'), (i) => i.checked)).toEqual([false, false]);
    expect(el.contains(el.ownerDocument.activeElement)).toBe(false);
  });

  for (const [button, reply] of [['overwrite-yes', 'overwrite'], ['overwrite-save-as', 'saveAs'], ['overwrite-cancel', 'cancel']] as const) {
    it(`FIL-036 ${button} answers ${reply}`, async () => {
      const { find, answer, prompts } = await open();
      find(button)!.click();
      expect(answer).toHaveBeenCalledWith(prompts.current(), reply, null);
    });
  }

  it('FIL-038 the ticked box goes with the answer; "all files" counts over "this file"', async () => {
    const { find, answer, prompts } = await open();
    find('silence-file')!.click();
    find('overwrite-yes')!.click();
    expect(answer).toHaveBeenLastCalledWith(prompts.current(), 'overwrite', 'file');
    find('silence-all')!.click();
    find('overwrite-yes')!.click();
    expect(answer).toHaveBeenLastCalledWith(prompts.current(), 'overwrite', 'all');
  });

  it('FIL-036 a tap outside the box answers nothing', async () => {
    const { find, answer, prompts } = await open();
    find('overwrite-scrim')!.click();
    expect(answer).not.toHaveBeenCalled();
    expect(prompts.current()).not.toBeNull();
  });

  for (const kind of ['overwrite', 'close'] as const) {
    it(`FIL-036 FIL-049 Escape and Back answer the ${kind} question with Cancel`, async () => {
      const { session, prompts, tabId } = await setup();
      prompts.ask(kind === 'close' ? { kind, tabId } : { kind, tabId, closing: false });
      const spy = vi.spyOn(session, kind === 'close' ? 'answerClose' : 'answerOverwrite').mockResolvedValue();
      TestBed.inject(NavigationHandler);
      TestBed.inject(CommandBus).dispatch({ type: 'Back' });
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ kind }), 'cancel');
    });
  }
});

describe('close dialog', () => {
  async function open(flags: FeatureFlags) {
    const all = await setup(flags);
    all.prompts.ask({ kind: 'close', tabId: all.tabId });
    const view = await all.render(CloseDialog);
    const answer = vi.spyOn(all.session, 'answerClose').mockResolvedValue();
    return { ...all, ...view, answer };
  }

  it('FIL-049 shows the file name and the three answers', async () => {
    const { el, find, answer } = await open(ALL_FEATURES_ON);
    expect(el.querySelector('.file')!.textContent).toBe('a.pdf');
    expect(Array.from(el.querySelectorAll('button'), (b) => b.textContent?.trim())).toEqual(
      ['saveAs', 'discard', 'cancel'].map((key) => translate(`save.close.${key}`)),
    );
    find('close-discard')!.click();
    expect(answer).toHaveBeenCalledWith(expect.objectContaining({ kind: 'close' }), 'discard');
  });

  it('EDN-003 FIL-046 in the free edition "save as new file" is visible, disabled and does nothing', async () => {
    const { find, answer } = await open(FREE);
    expect(find('close-save-as')!.getAttribute('aria-disabled')).toBe('true');
    find('close-save-as')!.click();
    expect(answer).not.toHaveBeenCalled();
  });
});

describe('save notice', () => {
  it('FIL-039 names the file and offers a new file; the close icon dismisses it', async () => {
    const { prompts, tabId, render, session } = await setup();
    prompts.showNotice(tabId);
    const { el, find, fixture } = await render(SaveNotice);
    expect(find('save-notice')!.getAttribute('role')).toBe('status');
    expect(el.textContent).toContain('a.pdf');
    expect(el.textContent).toContain(translate('save.notice.text'));
    const saveAs = vi.spyOn(session, 'saveAsNewFile').mockResolvedValue('saved');
    find('notice-save-as')!.click();
    expect(saveAs).toHaveBeenCalledWith(tabId);
    await settle();
    await fixture.whenStable();
    expect(find('save-notice')).toBeNull();
    prompts.showNotice(tabId);
    await fixture.whenStable();
    find('notice-dismiss')!.click();
    await fixture.whenStable();
    expect(find('save-notice')).toBeNull();
  });

  it('FIL-039 where there is a tool strip the notice leaves its side free', async () => {
    const { render } = await setup();
    const ui = TestBed.inject(UiStore);
    ui.setViewport(1280, 800);
    const { el, fixture } = await render(SaveNotice);
    expect(el.getAttribute('data-strip')).toBe(TUNABLES.layout.toolStripSide);
    ui.setViewport(360, 800);
    await fixture.whenStable();
    expect(el.getAttribute('data-strip')).toBeNull();
  });

  it('FIL-039 a cancelled picker leaves the notice', async () => {
    const { prompts, tabId, render, files } = await setup();
    prompts.showNotice(tabId);
    const { find } = await render(SaveNotice);
    files.createFile.mockResolvedValueOnce({ ok: false, error: 'cancelled' });
    find('notice-save-as')!.click();
    await settle();
    expect(find('save-notice')).not.toBeNull();
  });
});

describe('no Save control', () => {
  it('FIL-020 no layout has a control to save into the open file', async () => {
    const { fixture, el } = await (await setup()).render(AppShell);
    const ui = TestBed.inject(UiStore);
    for (const width of [360, 1280]) {
      ui.setViewport(width, 800);
      await fixture.whenStable();
      expect(el.querySelector(`button[aria-label="${translate('a11y.save')}"]`)).toBeNull();
    }
  });
});
