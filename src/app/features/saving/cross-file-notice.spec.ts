import { TestBed } from '@angular/core/testing';

import { jumpInto } from '../../../testing/cross-file-files';
import { crossFileSetup, settle } from '../../../testing/cross-file-setup';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { CommandBus } from '../../input/command-bus';
import { NavigationHandler } from '../../input/navigation-handler';
import { FilePrompts } from '../../state/file-prompts';
import { AppShell } from '../shell/app-shell';
import { CrossFileNotice } from './cross-file-notice';

const A_INTO_B = { 'A.pdf': { jumps: [jumpInto('B.pdf', 2)] } };

async function setup(options: Parameters<typeof crossFileSetup>[0] = { marks: A_INTO_B }) {
  const s = await crossFileSetup({ ...options, providers: [provideTestTransloco()] });
  await s.open('A.pdf');
  const fixture = TestBed.createComponent(CrossFileNotice);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const find = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const update = async () => {
    await settle();
    await fixture.whenStable();
  };
  return { ...s, el, find, update };
}

describe('cross-file notice', () => {
  it('FIL-043 names the missing file, gives the reason and offers to open it', async () => {
    const s = await setup();
    const notice = s.find('cross-file-notice')!;
    expect(notice.getAttribute('aria-label')).toBe(translate('a11y.crossFileNotice'));
    expect(notice.getAttribute('role')).toBe('status');
    expect(notice.querySelector('strong')!.textContent).toBe('B.pdf');
    expect(notice.textContent).toContain(translate('crossFile.missingFile'));
    const open = vi.spyOn(s.crossFile, 'openMissing').mockResolvedValue();
    s.find('cross-file-open')!.click();
    expect(open).toHaveBeenCalledWith(s.crossFile.notice());
    expect(s.find('cross-file-silence')).toBeNull();
  });

  it('FIL-043 the close button hides the warning', async () => {
    const s = await setup();
    s.find('cross-file-dismiss')!.click();
    await s.update();
    expect(s.find('cross-file-notice')).toBeNull();
  });

  it('MRK-015 where the line is gone, opening a file cannot help: only the reason shows', async () => {
    const s = await setup({ marks: { 'A.pdf': { jumps: [jumpInto('B.pdf', 2, 1, 9)] } }, stored: ['B.pdf'] });
    expect(s.find('cross-file-notice')!.textContent).toContain(translate('crossFile.missingSystem'));
    expect(s.find('cross-file-open')).toBeNull();
  });

  it('FIL-044 the close warning names both files and offers "don\'t show again"', async () => {
    const s = await setup({ marks: A_INTO_B, stored: ['B.pdf'] });
    await s.session.closeTab(s.idOf('B.pdf'));
    await s.update();
    const notice = s.find('cross-file-notice')!;
    expect(notice.querySelector('strong')!.textContent).toBe('B.pdf');
    expect(notice.textContent).toContain(translate('crossFile.closed').replace('{{referrers}}', 'A.pdf'));
    expect(s.find('cross-file-open')).toBeNull();
    s.find('cross-file-silence')!.click();
    await s.update();
    expect(s.find('cross-file-notice')).toBeNull();
  });

  it('FIL-043 the save notice has the place first', async () => {
    const s = await setup();
    const prompts = TestBed.inject(FilePrompts);
    prompts.showNotice(s.idOf('A.pdf'));
    await s.update();
    expect(s.find('cross-file-notice')).toBeNull();
    prompts.dismissNotice(s.idOf('A.pdf'));
    await s.update();
    expect(s.find('cross-file-notice')).not.toBeNull();
  });

  it('FIL-043 Back closes the warning', async () => {
    const s = await setup();
    expect(TestBed.inject(NavigationHandler).handleBack()).toBe(true);
    await s.update();
    expect(s.find('cross-file-notice')).toBeNull();
  });

  it('FIL-043 the shell holds the notice', async () => {
    await setup();
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="cross-file-notice"]')).not.toBeNull();
  });

  it('FIL-032 a file opened because it is referenced is an open file like every other', async () => {
    const s = await setup({ marks: A_INTO_B, stored: ['B.pdf'] });
    const [a, b] = s.session.tabs();
    expect({ ...b, id: a!.id, ref: a!.ref, name: a!.name }).toEqual(a);
    s.session.setActive(b!.id);
    await s.update();
    expect(s.current()).toBe('B.pdf');
    expect(await s.session.closeTab(b!.id)).toBe(true);
    expect(s.openNames()).toEqual(['A.pdf']);
  });

  for (const command of ['Next', 'Previous'] as const) {
    it(`FIL-051 FIL-052 the ${command} command of keys, pedal, taps and swipes crosses files`, async () => {
      const s = await setup({ marks: A_INTO_B, stored: ['B.pdf'] });
      TestBed.inject(NavigationHandler);
      const bus = TestBed.inject(CommandBus);
      s.toEnd();
      bus.dispatch({ type: 'Next' });
      await s.update();
      expect(s.current()).toBe('B.pdf');
      if (command === 'Previous') {
        bus.dispatch({ type: 'Previous' });
        await s.update();
        expect(s.current()).toBe('A.pdf');
      }
    });
  }

  it('FIL-052 First and Last stay in the current file, and Previous still leads back', async () => {
    const s = await setup({ marks: A_INTO_B, stored: ['B.pdf'] });
    TestBed.inject(NavigationHandler);
    const bus = TestBed.inject(CommandBus);
    s.toEnd();
    bus.dispatch({ type: 'Next' });
    bus.dispatch({ type: 'Last' });
    await s.update();
    expect(s.current()).toBe('B.pdf');
    bus.dispatch({ type: 'First' });
    bus.dispatch({ type: 'Previous' });
    await s.update();
    expect(s.current()).toBe('A.pdf');
  });
});
