import { TestBed } from '@angular/core/testing';

import { provideTestPorts } from '../../testing/provide-test-ports';
import { UiStore } from '../state/ui.store';
import { NavigationHandler } from './navigation-handler';

function setup() {
  TestBed.configureTestingModule({ providers: provideTestPorts() });
  const ui = TestBed.inject(UiStore);
  ui.hasDocument.set(true);
  return { ui, handler: TestBed.inject(NavigationHandler) };
}

describe('NavigationHandler.handleBack', () => {
  it('PLT-007 closes a popup first and reports it handled', () => {
    const { ui, handler } = setup();
    ui.setMode('presentation');
    ui.popup.set({ id: 'tool' });
    expect(handler.handleBack()).toBe(true);
    expect(ui.popup()).toBeNull();
    expect(ui.mode()).toBe('presentation');
  });

  it('PLT-007 leaves presentation mode for annotation mode', () => {
    const { ui, handler } = setup();
    ui.setMode('presentation');
    expect(handler.handleBack()).toBe(true);
    expect(ui.mode()).toBe('annotation');
  });

  it('PLT-007 reports nothing handled in annotation mode, so Android minimizes the app', () => {
    const { handler } = setup();
    expect(handler.handleBack()).toBe(false);
  });
});
