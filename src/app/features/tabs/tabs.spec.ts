import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { FILE_ACCESS } from '../../ports/file-access';
import type { OpenedFile } from '../../ports/file-access';
import { fakeFileAccess } from '../../state/testing/fake-ports';
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

  it('FIL-016 the lock of a read-only tab is a control that offers to save a copy', async () => {
    const session = await openTabs({ ...file('a.pdf'), writable: false });
    const files = TestBed.inject(FILE_ACCESS) as ReturnType<typeof fakeFileAccess>;
    const fixture = TestBed.createComponent(TabBar);
    await fixture.whenStable();
    const lock = fixture.nativeElement.querySelector('button.marker') as HTMLElement;
    expect(lock.getAttribute('aria-label')).toBe(translate('a11y.readOnly'));
    lock.click();
    await settle();
    expect(files.saveCopy).toHaveBeenCalledWith('a (annotated).pdf', expect.any(Uint8Array));
    expect(session.tabs()).toHaveLength(1);
  });

  it('FIL-010 a failed save shows the error marker', async () => {
    const session = await openTabs(file('a.pdf'));
    session.activeDocument()?.saveFailed.set(true);
    const fixture = TestBed.createComponent(TabBar);
    await fixture.whenStable();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.marker')).map((m) =>
      (m as HTMLElement).getAttribute('aria-label'),
    );
    expect(labels).toEqual([translate('a11y.saveFailed')]);
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
    expect(bar.nativeElement.querySelectorAll('app-tab-item')).toHaveLength(0);
    expect(bar.nativeElement.querySelector('button')).toBeNull();
    expect(switcher.nativeElement.querySelector('button')).toBeNull();
  });

  it('FIL-004 a tab carries its full file name as hover text', async () => {
    await openTabs(file('a-very-long-score-name.pdf'));
    const fixture = TestBed.createComponent(TabBar);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.name').getAttribute('title')).toBe('a-very-long-score-name.pdf');
  });

  it('FIL-004 the all-tabs button appears only while the tabs do not fit and opens the tab list', async () => {
    await openTabs(file('a.pdf'), file('b.pdf'));
    const widths = { scroll: 100, client: 400 };
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockImplementation(() => widths.scroll);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => widths.client);
    const fixture = TestBed.createComponent(TabBar);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button[data-popup-trigger]')).toBeNull();
    widths.scroll = 600;
    await TestBed.inject(SessionStore).openFiles([file('c.pdf')]);
    await fixture.whenStable();
    const button: HTMLElement | null = fixture.nativeElement.querySelector('button[data-popup-trigger]');
    expect(button).not.toBeNull();
    button?.click();
    expect(TestBed.inject(UiStore).popup()?.id).toBe('tabs');
    vi.restoreAllMocks();
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

/** Pointer event with an explicit time stamp (the real one is the hardware time of the input). */
function pointer(type: string, timeStamp: number): Event {
  const event = new Event(type);
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  return event;
}

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
    el.dispatchEvent(pointer('pointerdown', 0));
    el.dispatchEvent(pointer('pointerup', 50));
    el.click();
    expect(pick).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(UiStore).popup()).toBeNull();
  });

  it('FIL-008 a long press opens the recent files and the following click does not open the picker', () => {
    const el = button();
    el.dispatchEvent(pointer('pointerdown', 0));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs);
    el.dispatchEvent(pointer('pointerup', TUNABLES.layout.longPressMs));
    el.click();
    expect(TestBed.inject(UiStore).popup()?.id).toBe('recent');
    expect(pick).not.toHaveBeenCalled();
    el.click();
    expect(pick).toHaveBeenCalledTimes(1);
  });

  it('FIL-008 a release before the long press time cancels it', () => {
    const el = button();
    el.dispatchEvent(pointer('pointerdown', 0));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs - 1);
    el.dispatchEvent(pointer('pointerup', TUNABLES.layout.longPressMs - 1));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs);
    expect(TestBed.inject(UiStore).popup()).toBeNull();
  });

  it('FIL-001 a quick tap still opens the picker when a stalled main thread fired the long-press timer first', () => {
    const el = button();
    el.dispatchEvent(pointer('pointerdown', 0));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs + 1); // timer runs before the release is handled
    expect(TestBed.inject(UiStore).popup()?.id).toBe('recent');
    el.dispatchEvent(pointer('pointerup', 80)); // but the user released after 80 ms
    el.click();
    expect(pick).toHaveBeenCalledTimes(1);
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
