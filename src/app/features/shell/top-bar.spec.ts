import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { ALL_FEATURES_ON, provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { FEATURE_FLAGS } from '../../ports/feature-flags';
import type { FeatureFlags } from '../../ports/feature-flags';
import { FILE_ACCESS } from '../../ports/file-access';
import { SessionStore } from '../../state/session.store';
import type { fakeFileAccess } from '../../state/testing/fake-ports';
import { UiStore } from '../../state/ui.store';
import { TopBar } from './top-bar';

const FREE: FeatureFlags = Object.fromEntries(Object.keys(ALL_FEATURES_ON).map((key) => [key, false])) as unknown as FeatureFlags;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const SIZES = {
  compact: { width: TUNABLES.layout.compactMaxWidthPx - 1, height: TUNABLES.layout.compactMaxHeightPx + 100 },
  landscapePhone: { width: TUNABLES.layout.compactMaxWidthPx + 100, height: TUNABLES.layout.compactMaxHeightPx - 1 },
  expanded: { width: TUNABLES.layout.compactMaxWidthPx + 100, height: TUNABLES.layout.compactMaxHeightPx + 100 },
} as const;

async function render(size: keyof typeof SIZES, flags: FeatureFlags = ALL_FEATURES_ON) {
  TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts(), { provide: FEATURE_FLAGS, useValue: flags }] });
  const ui = TestBed.inject(UiStore);
  ui.setViewport(SIZES[size].width, SIZES[size].height);
  const fixture = TestBed.createComponent(TopBar);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const find = (key: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${translate(`a11y.${key}`)}"]`);
  const labels = () => Array.from(el.querySelectorAll('button'), (b) => b.getAttribute('aria-label'));
  const open = async () => {
    await TestBed.inject(SessionStore).openFiles([{ ref: { id: 'a', name: 'a.pdf' }, bytes: new Uint8Array([1]), writable: true }]);
    await settle();
    ui.hasDocument.set(true);
    await fixture.whenStable();
  };
  return { fixture, find, labels, open, files: TestBed.inject(FILE_ACCESS) as ReturnType<typeof fakeFileAccess> };
}

describe('TopBar', () => {
  it('UIX-036 the expanded top bar has no overflow button; save a copy sits next to the settings button', async () => {
    const { find, labels } = await render('expanded');
    expect(find('overflow')).toBeNull();
    expect(labels().slice(-2)).toEqual([translate('a11y.saveCopy'), translate('a11y.settings')]);
  });

  for (const size of ['compact', 'landscapePhone'] as const) {
    it(`UIX-036 ${size}: the compact top bar has neither save a copy nor an overflow button`, async () => {
      const { find } = await render(size);
      expect(find('saveCopy')).toBeNull();
      expect(find('overflow')).toBeNull();
    });
  }

  it('UIX-037 only a narrow top bar collapses the mode buttons into one', async () => {
    const narrow = await render('compact');
    expect(narrow.find('modeSwitch')).not.toBeNull();
    expect(narrow.find('modeAnnotation')).toBeNull();
  });

  it('UIX-037 a landscape phone is compact but wide enough for the three mode buttons', async () => {
    const wide = await render('landscapePhone');
    expect(wide.find('modeSwitch')).toBeNull();
    expect(wide.find('modeAnnotation')).not.toBeNull();
  });

  it('SAV-011 PLT-010 UIX-036 save a copy is disabled without a document and saves the current file with one', async () => {
    const { find, open, files } = await render('expanded');
    expect(find('saveCopy')!.getAttribute('aria-disabled')).toBe('true');
    await open();
    expect(find('saveCopy')!.getAttribute('aria-disabled')).toBeNull();
    find('saveCopy')!.click();
    await settle();
    expect(files.saveCopy).toHaveBeenCalledWith('a (annotated).pdf', expect.any(Uint8Array));
  });

  it('EDN-003 EDN-011 UIX-036 in the free edition save a copy stays visible and disabled, and a click makes no write call', async () => {
    const { find, open, files } = await render('expanded', FREE);
    await open();
    expect(find('saveCopy')!.getAttribute('aria-disabled')).toBe('true');
    find('saveCopy')!.click();
    await settle();
    expect(files.saveCopy).not.toHaveBeenCalled();
    expect(files.write).not.toHaveBeenCalled();
  });

  it('EDN-008 UIX-036 with the saveCopy switch on the button is enabled', async () => {
    const { find, open } = await render('expanded', { ...FREE, saveCopy: true });
    await open();
    expect(find('saveCopy')!.getAttribute('aria-disabled')).toBeNull();
  });
});
