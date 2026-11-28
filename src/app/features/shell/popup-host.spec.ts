import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
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
    store.openPopup('overflow-bottom');
    await fixture.whenStable();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  it('UIX-035 the overflow menu has no version info', async () => {
    const { el } = await setup();
    expect(el.textContent).not.toContain('v0.0.0-test');
    expect(el.querySelector(`[aria-label="${translate('a11y.versionInfo')}"]`)).toBeNull();
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

  it('UIX-036 the More menu holds the two slide-ratio buttons only, and shows in the compact annotation layout only', async () => {
    const { fixture, store, el } = await setup();
    const labels = () => Array.from(el.querySelectorAll('button'), (b) => b.getAttribute('aria-label'));
    expect(labels()).toEqual([translate('a11y.showMore'), translate('a11y.showLess')]);
    store.setMode('organization');
    store.openPopup('overflow-bottom');
    await fixture.whenStable();
    expect(el.querySelector('.popup')).toBeNull();
  });
});
