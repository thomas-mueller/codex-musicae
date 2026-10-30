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
});
