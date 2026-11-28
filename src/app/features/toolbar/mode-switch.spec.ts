import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../../config/tunables';
import { provideTestTransloco } from '../../../testing/transloco';
import { UiStore } from '../../state/ui.store';
import { ModeSwitch } from './mode-switch';

describe('ModeSwitch', () => {
  async function setup() {
    TestBed.configureTestingModule({ providers: [provideTestTransloco()] });
    const fixture = TestBed.createComponent(ModeSwitch);
    await fixture.whenStable();
    const buttons = () => Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button'));
    return { fixture, buttons, store: TestBed.inject(UiStore) };
  }

  it('UIX-002 exactly the active mode is toggled', async () => {
    const { fixture, buttons, store } = await setup();
    expect(buttons().map((b) => b.classList.contains('toggled'))).toEqual([false, true, false]);
    store.setMode('organization');
    await fixture.whenStable();
    expect(buttons().map((b) => b.classList.contains('toggled'))).toEqual([true, false, false]);
  });

  it('UIX-002 presentation is disabled without a document and enabled with one', async () => {
    const { fixture, buttons, store } = await setup();
    expect(buttons().map((b) => b.getAttribute('aria-disabled'))).toEqual([null, null, 'true']);
    store.hasDocument.set(true);
    await fixture.whenStable();
    expect(buttons()[2]?.getAttribute('aria-disabled')).toBeNull();
  });

  it('UIX-002 pressing a mode sets it', async () => {
    const { buttons, store } = await setup();
    buttons()[0]?.click();
    expect(store.mode()).toBe('organization');
  });

  async function collapsed() {
    const all = await setup();
    all.fixture.componentRef.setInput('collapsed', true);
    await all.fixture.whenStable();
    return all;
  }

  it('UIX-037 collapsed it is one button with the icon of the current mode that toggles the mode popup', async () => {
    const { buttons, store, fixture } = await collapsed();
    const icon = () => (fixture.nativeElement as HTMLElement).querySelector('use')?.getAttribute('href');
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]?.hasAttribute('data-popup-trigger')).toBe(true);
    expect(icon()).toContain(TUNABLES.icons.modeAnnotation);
    store.setMode('organization');
    await fixture.whenStable();
    expect(icon()).toContain(TUNABLES.icons.modeOrganization);
    buttons()[0]?.click();
    expect(store.popup()?.id).toBe('modes');
    buttons()[0]?.click();
    expect(store.popup()).toBeNull();
  });

  it('UIX-037 in the settings mode the collapsed button keeps the icon of the mode it returns to', async () => {
    const { store, fixture } = await collapsed();
    store.setMode('organization');
    store.setMode('settings');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('use')?.getAttribute('href')).toContain(TUNABLES.icons.modeOrganization);
  });

  it('UIX-037 choosing a mode sets it and closes the popup; presentation still needs a document', async () => {
    const { buttons, store } = await setup();
    store.openPopup('modes');
    buttons()[2]?.click();
    expect(store.mode()).toBe('annotation');
    expect(store.popup()?.id).toBe('modes');
    buttons()[0]?.click();
    expect(store.mode()).toBe('organization');
    expect(store.popup()).toBeNull();
  });
});
