import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';

import german from '../../../assets/i18n/de.json';
import english from '../../../assets/i18n/en.json';
import { TUNABLES } from '../../../config/tunables';
import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestLanguages } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import { LanguageStore } from '../../state/language.store';
import { SettingsRegistry } from '../../state/settings-registry';
import { UiStore } from '../../state/ui.store';
import { AppShell } from '../shell/app-shell';

type Texts = { a11y: Record<string, string>; tooltip: Record<string, string>; settings: Record<string, Record<string, string>> };
const FILES: Record<string, unknown> = { en: english, de: german };
const read = (language: string) => FILES[language] as Texts;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

describe('changing the language', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestLanguages(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }] });
  });
  afterEach(() => vi.useRealTimers());

  async function render() {
    TestBed.inject(LanguageStore);
    const ui = TestBed.inject(UiStore);
    ui.setMode('settings');
    const fixture = TestBed.createComponent(AppShell);
    await settle();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const show = async (language: string) => {
      // what the composition root does with LanguageStore.active
      TestBed.inject(TranslocoService).setActiveLang(language);
      await settle();
      await fixture.whenStable();
    };
    const texts = () => ({
      headings: Array.from(el.querySelectorAll('app-settings-view h2'), (h) => h.textContent?.trim()),
      label: el.querySelector('[data-setting="language"] span')?.textContent?.trim(),
      options: Array.from(el.querySelectorAll<HTMLOptionElement>('[data-setting="language"] option'), (o) => o.text.trim()),
      reset: el.querySelector('.reset span')?.textContent?.trim(),
      buttons: Array.from(el.querySelectorAll('[data-area="top"] button'), (b) => b.getAttribute('aria-label')),
      view: el.querySelector('app-settings-view')?.getAttribute('aria-label'),
      modes: el.querySelector('app-mode-switch')?.getAttribute('aria-label'),
    });
    return { fixture, el, show, texts };
  }

  it('I18-004 choosing German changes headings, options, labels and buttons at once; language names stay', async () => {
    const { show, texts } = await render();
    const en = read('en');
    const de = read('de');
    expect(texts().headings).toEqual(Object.values(en.settings['groups']!));
    expect(texts().modes).toBe(en.a11y['modeSwitch']);
    const names = texts().options.slice(1);
    await show('de');
    const german = texts();
    expect(german.headings).toEqual(Object.values(de.settings['groups']!));
    expect(german.label).toBe(de.settings['language']!['label']);
    expect(german.options[0]).toBe(de.settings['language']!['system']);
    expect(german.options.slice(1)).toEqual(names);
    expect(german.reset).toBe(de.settings['reset']!['button']);
    expect(german.view).toBe(de.a11y['settingsView']);
    expect(german.modes).toBe(de.a11y['modeSwitch']);
    expect(german.buttons).toContain(de.a11y['settings']);
    expect(german.buttons).toContain(de.a11y['openFile']);
    expect(german.buttons).not.toContain(en.a11y['openFile']);
  });

  it('I18-004 the select shows the registered choice and changes it', async () => {
    const { el, fixture } = await render();
    const select = el.querySelector<HTMLSelectElement>('[data-setting="language"] select')!;
    expect(select.value).toBe('system');
    select.value = 'de';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(TestBed.inject(LanguageStore).active()).toBe('de');
    expect(TestBed.inject(SettingsRegistry).entries()[0]!.value()).toBe('de');
  });

  it('I18-004 a tooltip shown after the change is German', async () => {
    const { el, show } = await render();
    await show('de');
    vi.useFakeTimers();
    const button = el.querySelector<HTMLButtonElement>(`[data-area="top"] button[aria-label="${read('de').a11y['openFile']}"]`)!;
    button.dispatchEvent(new Event('pointerenter'));
    vi.advanceTimersByTime(TUNABLES.layout.tooltipHoverDelayMs);
    expect(button.querySelector('[role="tooltip"]')?.textContent).toBe(read('de').tooltip['openFile']);
  });

  it('GEN-013 the visible text of the settings mode and of its dialog is translated text only', async () => {
    const { el, fixture, show } = await render();
    TestBed.inject(UiStore).requestReset();
    await fixture.whenStable();
    for (const language of ['en', 'de']) {
      await show(language);
      const known = new Set<string>();
      const collect = (value: unknown): void =>
        typeof value === 'string' ? void known.add(value) : Object.values(value as object).forEach(collect);
      collect(read(language));
      known.add('v-test'); // GEN-013 allows the version string (UIX-035)
      const walker = el.ownerDocument.createTreeWalker(el.querySelector('.middle')!, NodeFilter.SHOW_TEXT);
      const dialog = el.ownerDocument.createTreeWalker(el.querySelector('app-reset-confirm')!, NodeFilter.SHOW_TEXT);
      const shown: string[] = [];
      for (const tree of [walker, dialog]) {
        for (let node = tree.nextNode(); node; node = tree.nextNode()) {
          const text = node.textContent?.trim() ?? '';
          if (text !== '') {
            shown.push(text);
          }
        }
      }
      expect(shown.length, language).toBeGreaterThan(0);
      expect(shown.filter((text) => !known.has(text)), language).toEqual([]);
    }
  });
});
