import { TestBed } from '@angular/core/testing';

import { ALL_FEATURES_ON, provideTestPorts } from '../../../testing/provide-test-ports';
import { provideTestTransloco, translate } from '../../../testing/transloco';
import { FEATURE_FLAGS } from '../../ports/feature-flags';
import { FILE_ACCESS } from '../../ports/file-access';
import type { OpenedFile } from '../../ports/file-access';
import { fakeFileAccess } from '../../state/testing/fake-ports';
import { SessionStore } from '../../state/session.store';
import { UiStore } from '../../state/ui.store';
import { PopupHost } from '../shell/popup-host';
import { FileBar } from './file-bar';
import { OpenFileDirective } from './open-file.directive';
import { Component } from '@angular/core';
import { TUNABLES } from '../../../config/tunables';

function file(name: string, firstByte = 1): OpenedFile {
  return { ref: { id: `id-${name}`, name }, bytes: new Uint8Array([firstByte]), writable: true };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const NARROW = TUNABLES.layout.compactMaxWidthPx - 1;
const WIDE = TUNABLES.layout.compactMaxWidthPx + 100;
const HEIGHT = TUNABLES.layout.compactMaxHeightPx + 100;

describe('file bar', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestTransloco(), provideTestPorts()] });
  });

  async function openAll(...files: OpenedFile[]) {
    const session = TestBed.inject(SessionStore);
    await session.openFiles(files);
    await settle();
    return session;
  }

  async function render(width = WIDE) {
    const ui = TestBed.inject(UiStore);
    ui.setViewport(width, HEIGHT);
    const fixture = TestBed.createComponent(FileBar);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const button = (key: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${translate(`a11y.${key}`)}"]`)!;
    const entry = () => el.querySelector<HTMLElement>('app-file-item');
    const name = () => entry()?.querySelector('.text')?.textContent?.trim();
    const markers = () => Array.from(el.querySelectorAll('app-file-item .marker'), (m) => m.getAttribute('aria-label'));
    return { ui, fixture, el, button, entry, name, markers };
  }

  const texts = (...keys: string[]) => keys.map((key) => translate(`a11y.${key}`));

  it('FIL-021 FIL-022 the entry shows the current file: name with a "*", lock, then the close icon, in this order', async () => {
    const session = await openAll(file('a.pdf'), file('b.pdf'));
    session.activeDocument()?.unsaved.set(true);
    session.activeDocument()?.readOnly.set(true);
    const { el, entry, name } = await render();
    expect(el.querySelectorAll('app-file-item')).toHaveLength(1);
    expect(name()).toBe('b.pdf');
    expect(Array.from(entry()!.children, (child) => child.getAttribute('aria-label') ?? child.className)).toEqual([
      'name', ...texts('readOnly'), 'rest', ...texts('closeTab'),
    ]);
    const mark = entry()!.querySelector('.name > .text + .unsaved')!; // the "*" ends the name
    expect(mark.textContent).toBe(TUNABLES.layout.unsavedMarkText);
    expect(mark.getAttribute('aria-label')).toBe(translate('a11y.unsaved'));
  });

  it('FIL-021 the close icon of the entry closes the current file and the neighbor becomes current', async () => {
    const session = await openAll(file('a.pdf'), file('b.pdf'));
    const { button, name, fixture } = await render();
    button('closeTab').click();
    await fixture.whenStable();
    expect(session.tabs().map((t) => t.name)).toEqual(['a.pdf']);
    expect(name()).toBe('a.pdf');
  });

  it('FIL-021 FIL-024 without a file there is no entry, previous and next are disabled and open file stays enabled', async () => {
    const { button, entry } = await render();
    expect(entry()).toBeNull();
    expect(button('previousFile').getAttribute('aria-disabled')).toBe('true');
    expect(button('nextFile').getAttribute('aria-disabled')).toBe('true');
    expect(button('openFile').getAttribute('aria-disabled')).toBeNull();
  });

  it('FIL-024 FIL-028 previous and next step through the files in opening order and stop at the ends', async () => {
    const session = await openAll(file('c.pdf'), file('a.pdf'), file('b.pdf'));
    const { button, name, fixture, el } = await render();
    const order = Array.from(el.querySelector('.entry')!.parentElement!.querySelectorAll('button'), (b) => b.getAttribute('aria-label'));
    expect([...order.slice(0, 2), order.at(-1)]).toEqual(texts('openFile', 'previousFile', 'nextFile')); // FIL-025: open file is leftmost
    expect(button('nextFile').getAttribute('aria-disabled')).toBe('true');
    button('previousFile').click();
    await fixture.whenStable();
    expect(name()).toBe('a.pdf');
    button('previousFile').click();
    await fixture.whenStable();
    expect(name()).toBe('c.pdf');
    expect(button('previousFile').getAttribute('aria-disabled')).toBe('true');
    button('previousFile').click();
    expect(session.activeTab()?.name).toBe('c.pdf');
    button('nextFile').click();
    await fixture.whenStable();
    expect(name()).toBe('a.pdf');
    expect(session.tabs().map((t) => t.name)).toEqual(['c.pdf', 'a.pdf', 'b.pdf']);
  });

  it('FIL-027 the full name is hover text of the name only, and only while it is shortened', async () => {
    const session = await openAll(file('a-very-long-score-name.pdf'));
    session.activeDocument()?.unsaved.set(true);
    const { el } = await render();
    const text = el.querySelector<HTMLElement>('app-file-item .text')!;
    const widths = { scroll: 100, client: 400 };
    Object.defineProperty(text, 'scrollWidth', { get: () => widths.scroll });
    Object.defineProperty(text, 'clientWidth', { get: () => widths.client });
    text.dispatchEvent(new Event('pointerenter'));
    expect(text.getAttribute('title')).toBeNull();
    widths.scroll = 600;
    text.dispatchEvent(new Event('pointerenter'));
    expect(text.getAttribute('title')).toBe('a-very-long-score-name.pdf');
    widths.scroll = 400;
    text.dispatchEvent(new Event('pointerenter'));
    expect(text.getAttribute('title')).toBeNull();
    widths.scroll = 600;
    text.dispatchEvent(new Event('pointerenter'));
    // no element around a marker has a hover text, so it cannot show beside the marker's own tooltip
    for (const marker of Array.from(el.querySelectorAll('app-file-item .marker'))) {
      expect(marker.closest('[title]')).toBeNull();
    }
  });

  it('FIL-021 UIX-037 the narrow entry has no close icon; the rows of the file list keep theirs', async () => {
    await openAll(file('a.pdf'));
    const { el, ui } = await render(NARROW);
    const close = `button[aria-label="${translate('a11y.closeTab')}"]`;
    expect(el.querySelector(close)).toBeNull();
    const list = TestBed.createComponent(PopupHost);
    ui.openPopup('files');
    await list.whenStable();
    expect((list.nativeElement as HTMLElement).querySelectorAll(close)).toHaveLength(1);
  });

  it('FIL-024 UIX-037 a narrow bar has no previous and next buttons', async () => {
    await openAll(file('a.pdf'), file('b.pdf'));
    const { el, ui, fixture, button } = await render(NARROW);
    expect(el.querySelector(`button[aria-label="${translate('a11y.previousFile')}"]`)).toBeNull();
    expect(el.querySelector(`button[aria-label="${translate('a11y.nextFile')}"]`)).toBeNull();
    ui.setViewport(WIDE, HEIGHT);
    await fixture.whenStable();
    expect(button('previousFile')).not.toBeNull();
    expect(button('nextFile')).not.toBeNull();
  });

  it('FIL-023 the entry toggles the file list', async () => {
    await openAll(file('a-very-long-score-name.pdf'));
    const { el, ui, fixture } = await render();
    const button = el.querySelector<HTMLButtonElement>('app-file-item .name')!;
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    await fixture.whenStable();
    expect(ui.popup()?.id).toBe('files');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    button.click();
    expect(ui.popup()).toBeNull();
  });

  for (const width of [NARROW, WIDE]) {
    it(`FIL-023 FIL-028 at ${width}px the list shows all files in opening order; a row makes its file current and closes it`, async () => {
      const session = await openAll(file('c.pdf'), file('a.pdf'), file('b.pdf'));
      const ui = TestBed.inject(UiStore);
      ui.setViewport(width, HEIGHT);
      const fixture = TestBed.createComponent(PopupHost);
      ui.openPopup('files');
      await fixture.whenStable();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('.popup')?.className).toBe('popup top'); // full width below the top bar
      expect(Array.from(el.querySelectorAll('app-file-item .text'), (n) => n.textContent?.trim())).toEqual(['c.pdf', 'a.pdf', 'b.pdf']);
      expect(el.querySelector('[aria-current="true"]')?.textContent?.trim()).toBe('b.pdf');
      el.querySelector<HTMLButtonElement>('app-file-item .name')!.click();
      await fixture.whenStable();
      expect(session.activeTab()?.name).toBe('c.pdf');
      expect(ui.popup()).toBeNull();
    });
  }

  it('FIL-023 closing files from the list keeps it open until none is left', async () => {
    await openAll(file('a.pdf'), file('b.pdf'));
    const ui = TestBed.inject(UiStore);
    const fixture = TestBed.createComponent(PopupHost);
    ui.openPopup('files');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const close = () => el.querySelector<HTMLButtonElement>(`button[aria-label="${translate('a11y.closeTab')}"]`)!.click();
    close();
    await fixture.whenStable();
    expect(el.querySelectorAll('app-file-item')).toHaveLength(1);
    close();
    await fixture.whenStable();
    expect(el.querySelector('.popup')).toBeNull();
  });

  it('FIL-009 a damaged file shows an error marker with the reason', async () => {
    await openAll(file('bad.pdf', 0));
    const { markers } = await render();
    expect(markers()).toEqual(texts('errorInvalid'));
  });

  it('FIL-016 the lock of a read-only file is a control that offers to save a copy', async () => {
    const session = await openAll({ ...file('a.pdf'), writable: false });
    const files = TestBed.inject(FILE_ACCESS) as ReturnType<typeof fakeFileAccess>;
    const { el } = await render();
    const lock = el.querySelector<HTMLElement>('button.marker')!;
    expect(lock.getAttribute('aria-label')).toBe(translate('a11y.readOnly'));
    lock.click();
    await settle();
    expect(files.saveCopy).toHaveBeenCalledWith('a (annotated).pdf', expect.any(Uint8Array));
    expect(session.tabs()).toHaveLength(1);
  });

  it('FIL-016 a file that waits for the write permission shows a control that asks for it', async () => {
    const session = await openAll(file('a.pdf'));
    const files = TestBed.inject(FILE_ACCESS) as ReturnType<typeof fakeFileAccess>;
    session.activeDocument()?.needsWriteAccess.set(true);
    const { el } = await render();
    const marker = el.querySelector<HTMLElement>('button.marker')!;
    expect(marker.getAttribute('aria-label')).toBe(translate('a11y.grantWriteAccess'));
    marker.click();
    await settle();
    expect(files.requestWriteAccess).toHaveBeenCalledTimes(1);
    expect(session.tabs()[0]?.needsWriteAccess).toBe(false);
  });

  it('FIL-013 the needs-re-open marker is a control that selects its file again', async () => {
    const session = await openAll(file('a.pdf'));
    session.activeDocument()?.needsReopen.set(true);
    const select = vi.spyOn(session, 'setActive').mockImplementation(() => undefined);
    const { el } = await render();
    const marker = el.querySelector<HTMLElement>('button.marker')!;
    expect(marker.getAttribute('aria-label')).toBe(translate('a11y.needsReopen'));
    marker.click();
    expect(select).toHaveBeenCalledWith(session.activeTabId());
  });

  it('FIL-010 FIL-022 a failed save shows the error marker', async () => {
    const session = await openAll(file('a.pdf'));
    session.activeDocument()?.saveFailed.set(true);
    const { markers } = await render();
    expect(markers()).toEqual(texts('saveFailed'));
  });

  it('FIL-022 the wide entry shows every status that applies: "*", lock, then the other icons', async () => {
    const session = await openAll(file('a.pdf'));
    const doc = session.activeDocument();
    doc?.unsaved.set(true);
    doc?.readOnly.set(true);
    doc?.needsReopen.set(true);
    const { markers } = await render();
    expect(markers()).toEqual(texts('unsaved', 'readOnly', 'needsReopen'));
  });

  it('FIL-022 the narrow entry keeps the "*" and the working lock and shows the most important other icon, which opens the list', async () => {
    const session = await openAll(file('a.pdf'));
    const doc = session.activeDocument();
    doc?.unsaved.set(true);
    doc?.readOnly.set(true);
    doc?.needsReopen.set(true);
    doc?.needsWriteAccess.set(true);
    const { markers, el, ui } = await render(NARROW);
    expect(markers()).toEqual(texts('unsaved', 'readOnly', 'grantWriteAccess'));
    expect(Array.from(el.querySelectorAll('button.marker'), (b) => b.getAttribute('aria-label'))).toEqual(texts('readOnly'));
    el.querySelector<HTMLElement>('app-file-item .rest .marker')!.click();
    expect(ui.popup()?.id).toBe('files');
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
  let recentFiles = true;
  beforeEach(() => {
    recentFiles = true;
    vi.useFakeTimers();
    pick = vi.fn(() => Promise.resolve({ ok: false, error: 'cancelled' }));
    TestBed.configureTestingModule({
      providers: [
        provideTestPorts(),
        { provide: FILE_ACCESS, useValue: { pickPdfs: pick, forget: vi.fn(), isSame: vi.fn() } },
        { provide: FEATURE_FLAGS, useFactory: () => ({ ...ALL_FEATURES_ON, recentFiles }) },
      ],
    });
  });
  afterEach(() => vi.useRealTimers());

  function button(): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('button');
  }

  it('FIL-001 FIL-025 a tap opens the picker', () => {
    const el = button();
    el.dispatchEvent(pointer('pointerdown', 0));
    el.dispatchEvent(pointer('pointerup', 50));
    el.click();
    expect(pick).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(UiStore).popup()).toBeNull();
  });

  it('FIL-008 FIL-026 UIX-022 a long press opens the recent files and the following click does not open the picker', () => {
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

  it('UIX-022 a right click opens nothing and only keeps the browser menu away', () => {
    const el = button();
    const event = new Event('contextmenu', { cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(TestBed.inject(UiStore).popup()).toBeNull();
    expect(pick).not.toHaveBeenCalled();
  });

  it('UIX-022 holding the right button is not a long press', () => {
    const el = button();
    const down = pointer('pointerdown', 0);
    Object.defineProperty(down, 'button', { value: 2 });
    el.dispatchEvent(down);
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs * 2);
    expect(TestBed.inject(UiStore).popup()).toBeNull();
  });

  it('FIL-026 with recent files switched off a long press opens no list and counts as a tap', () => {
    recentFiles = false;
    const el = button();
    el.dispatchEvent(pointer('pointerdown', 0));
    vi.advanceTimersByTime(TUNABLES.layout.longPressMs * 2);
    el.dispatchEvent(pointer('pointerup', TUNABLES.layout.longPressMs * 2));
    el.click();
    expect(TestBed.inject(UiStore).popup()).toBeNull();
    expect(pick).toHaveBeenCalledTimes(1);
  });
});
