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

  it('DET-013 the detection level defaults to fast and changes only with a document', () => {
    expect(store.level()).toBe('fast');
    store.setLevel('fine');
    expect(store.level()).toBe('fast');
    store.hasDocument.set(true);
    store.setLevel('fine');
    expect(store.level()).toBe('fine');
  });
});
