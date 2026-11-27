import { TestBed } from '@angular/core/testing';

import { provideTestPorts, ALL_FEATURES_ON } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { FEATURE_FLAGS } from '../../ports/feature-flags';
import { SettingsRegistry } from '../../state/settings-registry';
import { UiStore } from '../../state/ui.store';
import { SettingsView } from './settings-view';

describe('SettingsView', () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), provideTestPorts(), { provide: FEATURE_FLAGS, useValue: { ...ALL_FEATURES_ON, autosave: false } }],
    });
    return TestBed.inject(SettingsRegistry);
  }

  async function render() {
    const fixture = TestBed.createComponent(SettingsView);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const control = <T extends Element>(id: string) => el.querySelector(`[data-setting="${id}"] input, [data-setting="${id}"] select`) as unknown as T;
    return { fixture, el, control };
  }

  const change = (element: HTMLElement) => element.dispatchEvent(new Event('change'));

  it('UIX-026 shows the four groups with translated headings, in order, also while they are empty', async () => {
    setup();
    const { el } = await render();
    const sections = Array.from(el.querySelectorAll('section'));
    expect(sections.map((section) => section.getAttribute('data-group'))).toEqual(['general', 'display', 'slideMode', 'files']);
    expect(sections.map((section) => section.querySelector('h2')?.textContent?.trim())).toEqual(
      ['general', 'display', 'slideMode', 'files'].map((group) => translate(`settings.groups.${group}`)),
    );
    expect(el.querySelectorAll('input, select')).toHaveLength(0);
    expect(el.getAttribute('aria-label')).toBe(translate('a11y.settingsView'));
  });

  it('UIX-026 renders each registered setting in its group with a labelled control that changes the value', async () => {
    const registry = setup();
    // test-only registrations: the real settings come with the milestones that build their features
    const flag = registry.register({ id: 'flag', group: 'general', labelKey: 'a11y.settings', persist: true, type: 'boolean', defaultValue: false });
    const pick = registry.register({
      id: 'pick',
      group: 'display',
      labelKey: 'a11y.settings',
      persist: true,
      type: 'choice',
      defaultValue: 'a',
      options: [
        { value: 'a', labelKey: 'a11y.undo' },
        { value: 'b', labelKey: 'a11y.redo' },
      ],
    });
    const { el, control, fixture } = await render();
    expect(el.querySelector('[data-group="general"] [data-setting="flag"] span')?.textContent?.trim()).toBe(translate('a11y.settings'));
    expect(el.querySelector('[data-group="display"] [data-setting="pick"]')).not.toBeNull();
    const box = control<HTMLInputElement>('flag');
    expect(box.closest('label')).not.toBeNull();
    box.click();
    expect(flag.value()).toBe(true);
    const select = control<HTMLSelectElement>('pick');
    expect(Array.from(select.options, (option) => option.text.trim())).toEqual([translate('a11y.undo'), translate('a11y.redo')]);
    expect(select.value).toBe('a');
    select.value = 'b';
    change(select);
    await fixture.whenStable();
    expect(pick.value()).toBe('b');
  });

  it('UIX-026 a number setting takes values within its limits and shows the value again after any other entry', async () => {
    const registry = setup();
    const wait = registry.register({ id: 'wait', group: 'slideMode', labelKey: 'a11y.settings', persist: true, type: 'seconds', defaultValue: 2, min: 1, max: 10, step: 1 });
    const { control, fixture } = await render();
    const field = control<HTMLInputElement>('wait');
    expect([field.type, field.min, field.max, field.step, field.value]).toEqual(['number', '1', '10', '1', '2']);
    field.value = '4';
    change(field);
    await fixture.whenStable();
    expect(wait.value()).toBe(4);
    for (const entry of ['', '0', '99']) {
      field.value = entry;
      change(field);
      expect(wait.value()).toBe(4);
      expect(field.value).toBe('4');
    }
  });

  it('EDN-002 UIX-026 a setting of a switched-off feature is shown disabled', async () => {
    setup().register({ id: 'flag', group: 'files', labelKey: 'a11y.settings', feature: 'autosave', persist: true, type: 'boolean', defaultValue: false });
    const { control } = await render();
    expect(control<HTMLInputElement>('flag').disabled).toBe(true);
  });

  it('UIX-035 the version string closes the view, below the groups and labelled', async () => {
    setup();
    const { el } = await render();
    const version = el.querySelector('.content')!.lastElementChild!;
    expect(version.textContent).toBe('v0.0.0-test');
    expect(version.getAttribute('aria-label')).toBe(translate('a11y.versionInfo'));
    expect(version.closest('section')).toBeNull();
  });

  it('UIX-023 General ends with the translated reset button, which asks and resets nothing yet', async () => {
    const registry = setup();
    const flag = registry.register({ id: 'flag', group: 'general', labelKey: 'a11y.settings', persist: true, type: 'boolean', defaultValue: false });
    await flag.set(true);
    const ui = TestBed.inject(UiStore);
    ui.setMode('settings');
    const { el } = await render();
    expect(el.querySelectorAll('button')).toHaveLength(1);
    const general = el.querySelector('[data-group="general"]')!;
    const button = general.lastElementChild as HTMLButtonElement;
    expect(button.tagName).toBe('BUTTON');
    expect(button.textContent?.trim()).toBe(translate('settings.reset.button'));
    expect(button.getAttribute('aria-label')).toBe(translate('a11y.resetSettings'));
    button.click();
    expect(ui.pendingReset()).toBe(true);
    expect(flag.value()).toBe(true);
  });
});
