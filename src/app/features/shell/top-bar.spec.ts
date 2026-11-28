import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { TopBar } from './top-bar';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const SIZES = {
  compact: { width: TUNABLES.layout.compactMaxWidthPx - 1, height: TUNABLES.layout.compactMaxHeightPx + 100 },
  landscapePhone: { width: TUNABLES.layout.compactMaxWidthPx + 100, height: TUNABLES.layout.compactMaxHeightPx - 1 },
  expanded: { width: TUNABLES.layout.compactMaxWidthPx + 100, height: TUNABLES.layout.compactMaxHeightPx + 100 },
} as const;

async function render(size: keyof typeof SIZES) {
  TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts()] });
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
  return { fixture, find, labels, open };
}

describe('TopBar', () => {
  for (const size of ['compact', 'landscapePhone', 'expanded'] as const) {
    it(`UIX-036 ${size}: the top bar has neither an overflow button nor a button that saves a copy`, async () => {
      const { find, labels, open } = await render(size);
      await open();
      expect(find('overflow')).toBeNull();
      expect(labels().at(-1)).toBe(translate('a11y.settings'));
      expect(labels().filter((label) => /cop(y|ie)/i.test(label ?? ''))).toEqual([]);
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
});
