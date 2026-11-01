import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { CommandBus } from '../../input/command-bus';
import { NavigationHandler } from '../../input/navigation-handler';
import { APP_VERSION } from '../../ports/app-version';
import { UiStore } from '../../state/ui.store';
import { PopupHost } from './popup-host';

describe('PopupHost', () => {
  async function setup() {
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v0.0.0-test' }],
    });
    const fixture = TestBed.createComponent(PopupHost);
    const store = TestBed.inject(UiStore);
    store.openPopup('info');
    await fixture.whenStable();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  it('UIX-015 the info popover shows the version string only', async () => {
    const { el } = await setup();
    expect(el.querySelector('.version')?.textContent).toBe('v0.0.0-test');
  });

  it('UIX-013 a pointer-down outside closes the popup, one inside does not', async () => {
    const { fixture, store, el } = await setup();
    el.querySelector('.popup')?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(store.popup()).not.toBeNull();
    el.ownerDocument.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(store.popup()).toBeNull();
    expect(el.querySelector('.popup')).toBeNull();
  });

  it('UIX-013 Escape closes the popup', async () => {
    const { store } = await setup();
    TestBed.inject(NavigationHandler);
    TestBed.inject(CommandBus).dispatch({ type: 'Back' });
    expect(store.popup()).toBeNull();
  });
});
