import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../testing/provide-test-ports';
import { FULLSCREEN } from '../ports/fullscreen';
import { err, ok } from '../ports/result';
import { WAKE_LOCK } from '../ports/wake-lock';
import { fakeFullscreen, fakeWakeLock } from './testing/fake-ports';
import { UiStore } from './ui.store';
import { PresentationPlatform } from './presentation-platform';

function setup(fullscreen = fakeFullscreen(), wakeLock = fakeWakeLock()) {
  TestBed.configureTestingModule({
    providers: [
      ...provideTestPorts(),
      { provide: FULLSCREEN, useValue: fullscreen },
      { provide: WAKE_LOCK, useValue: wakeLock },
    ],
  });
  const ui = TestBed.inject(UiStore);
  ui.hasDocument.set(true);
  return { ui, fullscreen, wakeLock };
}

describe('presentation platform wiring', () => {
  it('PLT-004 PLT-005 enters fullscreen and acquires the wake lock synchronously on entry', () => {
    const { ui, fullscreen, wakeLock } = setup();
    ui.setMode('presentation');
    expect(fullscreen.enterCalls).toBe(1);
    expect(wakeLock.acquireCalls).toBe(1);
  });

  it('PLT-004 PLT-005 exits and releases on leaving, by any route', () => {
    const { ui, fullscreen, wakeLock } = setup();
    ui.setMode('presentation');
    ui.setMode('annotation');
    expect(fullscreen.exitCalls).toBe(1);
    expect(wakeLock.releaseCalls).toBe(1);
  });

  it('PLT-004 still enters presentation mode when fullscreen and wake lock are unsupported', () => {
    const { ui } = setup(fakeFullscreen(err('unsupported')), fakeWakeLock(err('unsupported')));
    ui.setMode('presentation');
    expect(ui.mode()).toBe('presentation');
  });

  it('PLT-004 does nothing when presentation cannot start without a document', () => {
    const { ui, fullscreen } = setup();
    ui.hasDocument.set(false);
    ui.setMode('presentation');
    expect(fullscreen.enterCalls).toBe(0);
  });

  it('PLT-016 a denied entry is retried exactly once on the next gesture in presentation mode', async () => {
    const { ui, fullscreen } = setup(fakeFullscreen([err('denied'), ok(undefined)]));
    const platform = TestBed.inject(PresentationPlatform);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    ui.setMode('presentation');
    await Promise.resolve();
    platform.retryEnter();
    platform.retryEnter();
    expect(fullscreen.enterCalls).toBe(2);
  });

  it('PLT-016 no retry after a successful entry, an unsupported one, or after leaving', async () => {
    for (const result of [ok(undefined), err('unsupported')]) {
      TestBed.resetTestingModule();
      const { ui, fullscreen } = setup(fakeFullscreen(result));
      ui.setMode('presentation');
      await Promise.resolve();
      TestBed.inject(PresentationPlatform).retryEnter();
      expect(fullscreen.enterCalls).toBe(1);
    }
    TestBed.resetTestingModule();
    const { ui, fullscreen } = setup(fakeFullscreen(err('denied')));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    ui.setMode('presentation');
    await Promise.resolve();
    ui.setMode('annotation');
    TestBed.inject(PresentationPlatform).retryEnter();
    expect(fullscreen.enterCalls).toBe(1);
  });
});
