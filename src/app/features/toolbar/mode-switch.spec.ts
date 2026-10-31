import { TestBed } from '@angular/core/testing';

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
});
