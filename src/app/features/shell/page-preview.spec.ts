import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../../testing/provide-test-ports';
import type { OpenedFile } from '../../ports/file-access';
import { Scheduler } from '../../state/scheduler';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { provideTestTransloco } from '../../../testing/transloco';
import { APP_VERSION } from '../../ports/app-version';
import { AppShell } from './app-shell';
import { PagePreview } from './page-preview';

const WIDTH = 300;
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));

function file(name: string, firstByte = 1): OpenedFile {
  return { ref: { id: `id-${name}`, name }, bytes: new Uint8Array([firstByte]), writable: true };
}

describe('PagePreview', () => {
  const drawImage = vi.fn();
  beforeEach(() => {
    drawImage.mockClear();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(WIDTH);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as never);
    TestBed.configureTestingModule({
      providers: [provideTestTransloco(), provideTestPorts(), { provide: APP_VERSION, useValue: 'v-test' }],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('FIL-001 renders page 1 of the active document at fit-width', async () => {
    const session = TestBed.inject(SessionStore);
    const setViewKey = vi.spyOn(TestBed.inject(Scheduler), 'setViewKey');
    await session.openFiles([file('a.pdf')]);
    const fixture = TestBed.createComponent(PagePreview);
    await fixture.whenStable();
    await settle();
    await fixture.whenStable();
    expect(setViewKey).toHaveBeenCalledWith(`${session.activeTabId()}|${WIDTH}`);
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('canvas').getAttribute('data-rendered')).toBe('true');
  });

  it('FIL-009 draws nothing for a document in error state', async () => {
    await TestBed.inject(SessionStore).openFiles([file('bad.pdf', 0)]);
    const fixture = TestBed.createComponent(PagePreview);
    await fixture.whenStable();
    await settle();
    expect(drawImage).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('canvas').getAttribute('data-rendered')).toBe('false');
  });

  it('FIL-007 the shell enables document controls only while the active tab is ready', async () => {
    const session = TestBed.inject(SessionStore);
    const ui = TestBed.inject(UiStore);
    const fixture = TestBed.createComponent(AppShell);
    await fixture.whenStable();
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
