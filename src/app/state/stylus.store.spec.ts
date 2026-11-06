import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { PEN_INITIAL } from '../core';
import { PREFERENCES } from '../ports/preferences';
import { memoryPreferences } from './testing/fake-ports';
import { StylusStore } from './stylus.store';

async function setup(initial: Record<string, unknown> = {}) {
  const preferences = memoryPreferences(initial);
  const frames: Array<() => void> = [];
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  TestBed.configureTestingModule({ providers: [{ provide: PREFERENCES, useValue: preferences }] });
  const store = TestBed.inject(StylusStore);
  await store.ready;
  return { store, preferences, frames };
}

describe('StylusStore', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('STY-001 STY-003 starts with stylusSeen false and the tunable finger-drawing default', async () => {
    const { store } = await setup();
    expect(store.stylusSeen()).toBe(false);
    expect(store.allowFingerDrawing()).toBe(TUNABLES.stylus.allowFingerDrawingDefault);
    expect(store.pen()).toEqual(PEN_INITIAL);
  });

  it('STY-001 markSeen sets the flag and persists it once under stylus.seen', async () => {
    const { store, preferences } = await setup();
    const set = vi.spyOn(preferences, 'set');
    await store.markSeen();
    await store.markSeen();
    expect(store.stylusSeen()).toBe(true);
    expect(set).toHaveBeenCalledTimes(1);
    expect(preferences.data.get('stylus.seen')).toBe(true);
  });

  it('STY-001 the flag survives a reload', async () => {
    const { store, preferences } = await setup();
    await store.markSeen();
    TestBed.resetTestingModule();
    const again = await setup(Object.fromEntries(preferences.data));
    expect(again.store.stylusSeen()).toBe(true);
  });

  it('STY-003 allowFingerDrawing changes at once and is persisted under stylus.allowFinger', async () => {
    const { store, preferences } = await setup();
    await store.setAllowFingerDrawing(true);
    expect(store.allowFingerDrawing()).toBe(true);
    expect(preferences.data.get('stylus.allowFinger')).toBe(true);
    TestBed.resetTestingModule();
    const again = await setup(Object.fromEntries(preferences.data));
    expect(again.store.allowFingerDrawing()).toBe(true);
  });

  it('STY-001 STY-003 invalid stored values fall back to the defaults', async () => {
    const { store } = await setup({ 'stylus.seen': 'yes', 'stylus.allowFinger': 3 });
    expect(store.stylusSeen()).toBe(false);
    expect(store.allowFingerDrawing()).toBe(TUNABLES.stylus.allowFingerDrawingDefault);
  });

  it('STY-004 feedPen updates penNow at once and mirrors the signal once per frame', async () => {
    const { store, frames } = await setup();
    store.feedPen({ type: 'pen-down', t: 10 });
    store.feedPen({ type: 'pen-move', t: 20 });
    expect(store.penNow()).toEqual({ active: true, lastT: 20 });
    expect(store.pen()).toEqual(PEN_INITIAL);
    expect(frames).toHaveLength(1);
    frames[0]?.();
    expect(store.pen()).toEqual({ active: true, lastT: 20 });
    store.feedPen({ type: 'pen-up', t: 30 });
    expect(frames).toHaveLength(2);
  });
});
