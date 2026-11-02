import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { TUNABLES } from '../../config/tunables';
import { provideTestPorts } from '../../testing/provide-test-ports';
import type { SessionSnapshot } from '../core';
import { APP_LIFECYCLE } from '../ports/app-lifecycle';
import { FILE_ACCESS } from '../ports/file-access';
import type { FileRef } from '../ports/file-access';
import { PREFERENCES } from '../ports/preferences';
import { err } from '../ports/result';
import { CLOCK } from './clock';
import { SessionPersistence } from './session-persistence';
import { SessionStore } from './session.store';
import { FakeClock } from './testing/fake-clock';
import { fakeFileAccess, memoryPreferences } from './testing/fake-ports';

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 10));
const KEY = TUNABLES.persistence.sessionKey;
const ref = (name: string): FileRef => ({ id: name, name });
const file = (name: string) => ({ ref: ref(name), bytes: new Uint8Array([1]), writable: true });

function setup(initial: Record<string, unknown> = {}) {
  const clock = new FakeClock();
  const prefs = memoryPreferences(initial);
  const files = fakeFileAccess();
  let pause: (() => void) | null = null;
  TestBed.configureTestingModule({
    providers: [
      ...provideTestPorts(),
      { provide: CLOCK, useValue: clock },
      { provide: PREFERENCES, useValue: prefs },
      { provide: FILE_ACCESS, useValue: files },
      {
        provide: APP_LIFECYCLE,
        useValue: {
          visible: signal(true),
          userActive: signal(true),
          batterySaver: signal<boolean | null>(null),
          onPause: (cb: () => void) => {
            pause = cb;
            return () => undefined;
          },
        },
      },
    ],
  });
  const persistence = TestBed.inject(SessionPersistence);
  const store = TestBed.inject(SessionStore);
  return { clock, prefs, files, store, persistence, firePause: () => pause?.() };
}

const written = (prefs: { data: Map<string, unknown> }) => prefs.data.get(KEY) as SessionSnapshot | undefined;

describe('SessionPersistence', () => {
  it('FIL-011 writes the tabs and the active tab after the debounce, not before', async () => {
    const { clock, prefs, store } = setup();
    await store.restore();
    await store.openFiles([file('a.pdf'), file('b.pdf')]);
    await settle();
    TestBed.tick();
    clock.advance(TUNABLES.persistence.sessionDebounceMs - 1);
    expect(written(prefs)?.tabs.length ?? 0).toBe(0);
    clock.advance(1);
    await settle();
    const snapshot = written(prefs)!;
    expect(snapshot.version).toBe(1);
    expect(snapshot.tabs.map((t) => t.ref.name)).toEqual(['a.pdf', 'b.pdf']);
    expect(snapshot.activeIndex).toBe(1);
  });

  it('FIL-014 NFR-015 the snapshot carries each tab system and organization position', async () => {
    const { store, persistence } = setup();
    await store.restore();
    await store.openFiles([file('a.pdf')]);
    await settle();
    expect(persistence.snapshot().tabs[0]).toEqual({ ref: ref('a.pdf'), system: 1, orgPage: 0, orgOffset: 0 });
  });

  it('NFR-015 a pause writes at once, without waiting for the debounce', async () => {
    const { prefs, store, firePause } = setup();
    await store.restore();
    await store.openFiles([file('a.pdf')]);
    await settle();
    firePause();
    await settle();
    expect(written(prefs)?.tabs.map((t) => t.ref.name)).toEqual(['a.pdf']);
  });

  it('FIL-011 nothing is written before the restore has finished, so a stored session is never replaced by an empty one', async () => {
    const stored = { version: 1, tabs: [{ ref: ref('a.pdf'), system: 4, orgPage: 0, orgOffset: 0 }], activeIndex: 0 };
    const { clock, prefs, firePause } = setup({ [KEY]: stored });
    TestBed.tick();
    clock.advance(TUNABLES.persistence.sessionDebounceMs * 2);
    firePause();
    await settle();
    expect(prefs.data.get(KEY)).toEqual(stored);
  });

  it('FIL-013 FIL-014 a tab that still needs re-opening keeps its stored position in the next snapshot', async () => {
    const stored = { version: 1, tabs: [{ ref: ref('a.pdf'), system: 4, orgPage: 2, orgOffset: 7 }], activeIndex: 0 };
    const { prefs, store, files, firePause } = setup({ [KEY]: stored });
    files.reopen = () => Promise.resolve(err('not-found'));
    await store.restore();
    firePause();
    await settle();
    expect(written(prefs)?.tabs[0]).toEqual({ ref: ref('a.pdf'), system: 4, orgPage: 2, orgOffset: 7 });
  });

  it('FIL-012 the session never records a mode: presentation is not restored', async () => {
    const { store, persistence } = setup();
    await store.restore();
    expect(Object.keys(persistence.snapshot()).sort()).toEqual(['activeIndex', 'tabs', 'version']);
  });
});
