import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../testing/provide-test-ports';
import { fakeFullscreen } from '../state/testing/fake-ports';
import { UiStore } from '../state/ui.store';
import { CommandBus } from './command-bus';
import { NavigationHandler } from './navigation-handler';

describe('presentation exit from the platform', () => {
  it('PLT-004 an external fullscreen exit (Esc) returns to annotation mode', () => {
    const fullscreen = fakeFullscreen();
    TestBed.configureTestingModule({ providers: provideTestPorts(fullscreen) });
    const ui = TestBed.inject(UiStore);
    ui.hasDocument.set(true);
    TestBed.inject(NavigationHandler);
    ui.setMode('presentation');
    fullscreen.externalExit();
    expect(ui.mode()).toBe('annotation');
  });

  it('PLT-016 the next navigation command after a denied entry asks for fullscreen again; Esc afterwards still exits', async () => {
    const fullscreen = fakeFullscreen([{ ok: false, error: 'denied' }, { ok: true, value: undefined }]);
    TestBed.configureTestingModule({ providers: provideTestPorts(fullscreen) });
    const ui = TestBed.inject(UiStore);
    ui.hasDocument.set(true);
    TestBed.inject(NavigationHandler);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    ui.setMode('presentation');
    await Promise.resolve();
    TestBed.inject(CommandBus).dispatch({ type: 'Next' });
    expect(fullscreen.enterCalls).toBe(2);
    fullscreen.externalExit();
    expect(ui.mode()).toBe('annotation');
  });
});
