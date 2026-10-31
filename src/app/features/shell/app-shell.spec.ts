import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import type { OpenedFile } from '../../ports/file-access';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { AppShell } from './app-shell';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

function file(name: string, firstByte = 1): OpenedFile {
  return { ref: { id: `id-${name}`, name }, bytes: new Uint8Array([firstByte]), writable: true };
}

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

  it('FIL-007 the shell enables document controls only while the active tab is ready', async () => {
    const session = TestBed.inject(SessionStore);
    const ui = TestBed.inject(UiStore);
    const fixture = await render();
    expect(ui.hasDocument()).toBe(false);
    await session.openFiles([file('a.pdf')]);
    await settle();
    await fixture.whenStable();
    expect(ui.hasDocument()).toBe(true);
    await session.openFiles([file('bad.pdf', 0)]);
    await settle();
    await fixture.whenStable();
    expect(ui.hasDocument()).toBe(false);
    session.closeTab(session.activeTabId() ?? '');
    await fixture.whenStable();
    expect(ui.hasDocument()).toBe(true);
  });
});
