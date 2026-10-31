import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import { UiStore } from '../../state/ui.store';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }] });
  });

  async function render() {
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();
    return fixture;
  }
  const areas = (el: HTMLElement) =>
    Array.from(el.querySelectorAll<HTMLElement>('[data-area]'))
      .filter((e) => !e.hidden)
      .map((e) => e.getAttribute('data-area'));

  it('UIX-008 shows both bars in annotation and organization mode', async () => {
    const store = TestBed.inject(UiStore);
    const fixture = await render();
    expect(areas(fixture.nativeElement)).toEqual(['top', 'canvas', 'bottom']);
    store.setMode('organization');
    await fixture.whenStable();
    expect(areas(fixture.nativeElement)).toEqual(['top', 'canvas', 'bottom']);
  });

  it('UIX-001 presentation mode shows only the canvas area', async () => {
    const store = TestBed.inject(UiStore);
    store.hasDocument.set(true);
    store.setMode('presentation');
    const fixture = await render();
    expect(areas(fixture.nativeElement)).toEqual(['canvas']);
  });
});
