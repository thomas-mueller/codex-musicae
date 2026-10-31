import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { FILE_ACCESS } from '../../ports/file-access';
import type { OpenedFile } from '../../ports/file-access';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { TabBar } from './tab-bar';
import { OpenFileDirective } from './open-file.directive';
import { TabSwitcher } from './tab-switcher';
import { Component } from '@angular/core';
import { TUNABLES } from '../../../config/tunables';

function file(name: string, firstByte = 1): OpenedFile {
  return { ref: { id: `id-${name}`, name }, bytes: new Uint8Array([firstByte]), writable: true };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('tabs', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts()] });
  });

  async function openTabs(...files: OpenedFile[]) {
    const session = TestBed.inject(SessionStore);
    await session.openFiles(files);
    await settle();
    return session;
  }

  it('FIL-003 FIL-004 the tab bar shows each tab with its name and a close control', async () => {
    const session = await openTabs(file('a.pdf'), file('b.pdf'));
    const fixture = TestBed.createComponent(TabBar);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(Array.from(el.querySelectorAll('.name')).map((n) => n.textContent?.trim())).toEqual(['a.pdf', 'b.pdf']);
    expect(el.querySelectorAll(`button[aria-label="${translate('a11y.closeTab')}"]`)).toHaveLength(2);
    expect(el.querySelector('.active .name')?.textContent?.trim()).toBe('b.pdf');
    el.querySelector<HTMLElement>(`button[aria-label="${translate('a11y.closeTab')}"]`)?.click();
    await fixture.whenStable();
    expect(session.tabs().map((t) => t.name)).toEqual(['b.pdf']);
  });

  it('FIL-003 clicking a tab name activates it', async () => {
    const session = await openTabs(file('a.pdf'), file('b.pdf'));
    const fixture = TestBed.createComponent(TabBar);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('.name').click();
    expect(session.activeTab()?.name).toBe('a.pdf');
  });

  it('FIL-009 a damaged file shows an error marker with the reason', async () => {
    await openTabs(file('bad.pdf', 0));
    const fixture = TestBed.createComponent(TabBar);
    await fixture.whenStable();
    const marker = fixture.nativeElement.querySelector('.marker');
    expect(marker?.getAttribute('aria-label')).toBe(translate('a11y.errorInvalid'));
  });

  it('FIL-003 the unsaved, read-only and needs-re-open markers follow the document flags', async () => {
    const session = await openTabs(file('a.pdf'));
    const doc = session.activeDocument();
    doc?.unsaved.set(true);
    doc?.readOnly.set(true);
    doc?.needsReopen.set(true);
    const fixture = TestBed.createComponent(TabBar);
    await fixture.whenStable();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.marker')).map((m) =>
      (m as HTMLElement).getAttribute('aria-label'),
    );
    expect(labels).toEqual([translate('a11y.unsaved'), translate('a11y.readOnly'), translate('a11y.needsReopen')]);
  });

  it('FIL-004 the tab bar and switcher render nothing without tabs', async () => {
    const bar = TestBed.createComponent(TabBar);
    const switcher = TestBed.createComponent(TabSwitcher);
    await bar.whenStable();
    await switcher.whenStable();
    expect(bar.nativeElement.children).toHaveLength(0);
    expect(switcher.nativeElement.querySelector('button')).toBeNull();
  });

  it('FIL-004 the tab switcher shows the current name and toggles the tab list popup', async () => {
    await openTabs(file('a.pdf'), file('b.pdf'));
    const fixture = TestBed.createComponent(TabSwitcher);
    await fixture.whenStable();
    const button: HTMLElement = fixture.nativeElement.querySelector('button');
    expect(button.textContent?.trim()).toBe('b.pdf');
    button.click();
    expect(TestBed.inject(UiStore).popup()?.id).toBe('tabs');
    button.click();
    expect(TestBed.inject(UiStore).popup()).toBeNull();
  });
});

@Component({ imports: [OpenFileDirective], template: '<button appOpenFile type="button"></button>' })
class Host {}

describe('OpenFileDirective', () => {
  let pick: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    pick = vi.fn(() => Promise.resolve({ ok: false, error: 'cancelled' }));
    TestBed.configureTestingModule({
      providers: [
        provideTestPorts(),
        { provide: FILE_ACCESS, useValue: { pickPdfs: pick, forget: vi.fn(), isSame: vi.fn() } },
      ],
    });
  });
  afterEach(() => vi.useRealTimers());

  function button(): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('button');
  }

  it('FIL-001 a tap opens the picker', () => {
    const el = button();
    el.dispatchEvent(new Event('pointerdown'));
    el.dispatchEvent(new Event('pointerup'));
    el.click();
    expect(pick).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(UiStore).popup()).toBeNull();
  });

  it('FIL-008 a long press opens the recent files and the following click does not open the picker', () => {
    const el = button();
    el.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs);
    el.dispatchEvent(new Event('pointerup'));
    el.click();
    expect(TestBed.inject(UiStore).popup()?.id).toBe('recent');
    expect(pick).not.toHaveBeenCalled();
    el.click();
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('FIL-008 a release before the long press time cancels it', () => {
    const el = button();
    el.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs - 1);
    el.dispatchEvent(new Event('pointerup'));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs);
    expect(TestBed.inject(UiStore).popup()).toBeNull();
  });

  it('FIL-008 a right click opens the recent files', () => {
    const el = button();
    const event = new Event('contextmenu', { cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(TestBed.inject(UiStore).popup()?.id).toBe('recent');
  });
});
