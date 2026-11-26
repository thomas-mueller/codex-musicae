import { TestBed } from '@angular/core/testing';

import { UiStore } from './ui.store';

describe('UiStore', () => {
  let store: UiStore;
  beforeEach(() => {
    store = TestBed.inject(UiStore);
  });

  it('UIX-001 defaults to annotation mode without tool or popup', () => {
    expect(store.mode()).toBe('annotation');
    expect(store.tool()).toBeNull();
    expect(store.popup()).toBeNull();
  });

  it('ANN-007 leaving annotation mode deactivates the tool and returning does not restore it', () => {
    store.hasDocument.set(true);
    for (const other of ['presentation', 'organization'] as const) {
      store.setMode('annotation');
      store.toggleTool('highlighter');
      expect(store.tool()).toBe('highlighter');
      store.setMode(other);
      expect(store.tool()).toBeNull();
      store.setMode('annotation');
      expect(store.tool()).toBeNull();
    }
  });

  it('ANN-007 tools can only be activated in annotation mode', () => {
    store.hasDocument.set(true);
    store.setMode('organization');
    store.toggleTool('pen');
    expect(store.tool()).toBeNull();
  });

  it('ANN-013 strokeInProgress is false by default', () => {
    expect(store.strokeInProgress()).toBe(false);
  });

  it('UIX-001 switching to a mode other than annotation clears the tool', () => {
    store.setTool('pen');
    store.setMode('organization');
    expect(store.tool()).toBeNull();
    store.hasDocument.set(true);
    store.setMode('annotation');
    store.setTool('eraser');
    store.setMode('presentation');
    expect(store.tool()).toBeNull();
  });

  it('UIX-003 sizeClass follows the viewport', () => {
    store.setViewport(360, 800);
    expect(store.sizeClass()).toBe('compact');
    store.setViewport(1280, 800);
    expect(store.sizeClass()).toBe('expanded');
  });

  it('UIX-002 presentation mode is refused without a document', () => {
    store.setMode('presentation');
    expect(store.mode()).toBe('annotation');
    store.hasDocument.set(true);
    store.setMode('presentation');
    expect(store.mode()).toBe('presentation');
  });

  it('FIL-007 tools need a document; tapping the active tool deactivates it', () => {
    store.toggleTool('pen');
    expect(store.tool()).toBeNull();
    store.hasDocument.set(true);
    store.toggleTool('pen');
    expect(store.tool()).toBe('pen');
    store.toggleTool('pen');
    expect(store.tool()).toBeNull();
  });

  it('UIX-013 only one popup is open at a time and togglePopup closes it', () => {
    store.openPopup('a');
    store.openPopup('b');
    expect(store.popup()).toEqual({ id: 'b' });
    store.togglePopup('b');
    expect(store.popup()).toBeNull();
  });

  it('UIX-025 the settings mode opens without a document and its button returns to the mode before', () => {
    for (const before of ['annotation', 'organization'] as const) {
      store.setMode(before);
      store.toggleSettings();
      expect(store.mode()).toBe('settings');
      store.toggleSettings();
      expect(store.mode()).toBe(before);
    }
  });

  it('UIX-025 choosing the settings mode again keeps the way back, and closing outside it does nothing', () => {
    store.setMode('organization');
    store.setMode('settings');
    store.setMode('settings');
    store.closeSettings();
    expect(store.mode()).toBe('organization');
    store.closeSettings();
    expect(store.mode()).toBe('organization');
  });

  it('UIX-025 entering the settings mode closes the popup and deactivates tool, selection and picking', () => {
    store.hasDocument.set(true);
    store.toggleTool('pen');
    store.openPopup('info');
    store.select({ kind: 'junction', junction: 1 });
    store.startPicking({ originJunction: 1 });
    store.toggleSettings();
    expect(store.popup()).toBeNull();
    expect(store.tool()).toBeNull();
    expect(store.selection()).toBeNull();
    expect(store.pickingTarget()).toBeNull();
    store.toggleTool('pen');
    expect(store.tool()).toBeNull();
  });

  it('UIX-023 the reset is only asked for in the settings mode, and leaving it drops the question', () => {
    store.requestReset();
    expect(store.pendingReset()).toBe(false);
    store.setMode('settings');
    store.requestReset();
    expect(store.pendingReset()).toBe(true);
    store.setMode('annotation');
    expect(store.pendingReset()).toBe(false);
  });
});
