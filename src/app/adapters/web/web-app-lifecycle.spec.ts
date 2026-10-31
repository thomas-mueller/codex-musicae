import { WebAppLifecycle } from './web-app-lifecycle';
import type { LifecycleEnv } from './web-app-lifecycle';

const IDLE_MS = 1000;

/** Manual clock: time only moves with `advance`. */
class FakeClock {
  private time = 0;
  private timers: Array<{ at: number; fn: () => void; cancelled: boolean }> = [];

  schedule(ms: number, fn: () => void): () => void {
    const timer = { at: this.time + ms, fn, cancelled: false };
    this.timers.push(timer);
    return () => {
      timer.cancelled = true;
    };
  }

  advance(ms: number): void {
    this.time += ms;
    for (const timer of this.timers) {
      if (!timer.cancelled && timer.at <= this.time) {
        timer.cancelled = true;
        timer.fn();
      }
    }
  }
}

function fakeEnv(): { env: LifecycleEnv; clock: FakeClock; doc: EventTarget & { visibilityState: string }; win: EventTarget } {
  const clock = new FakeClock();
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const win = new EventTarget();
  return { env: { document: doc, window: win, clock }, clock, doc, win };
}

describe('WebAppLifecycle', () => {
  it('DET-017 is active after an input event and idle after the idle time', () => {
    const { env, clock, win } = fakeEnv();
    const lifecycle = new WebAppLifecycle(IDLE_MS, env);
    expect(lifecycle.userActive()).toBe(false);
    win.dispatchEvent(new Event('pointermove'));
    expect(lifecycle.userActive()).toBe(true);
    clock.advance(IDLE_MS - 1);
    win.dispatchEvent(new Event('wheel'));
    clock.advance(IDLE_MS - 1);
    expect(lifecycle.userActive()).toBe(true);
    clock.advance(1);
    expect(lifecycle.userActive()).toBe(false);
  });

  it('DET-017 follows the visibility state', () => {
    const { env, doc } = fakeEnv();
    const lifecycle = new WebAppLifecycle(IDLE_MS, env);
    expect(lifecycle.visible()).toBe(true);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(lifecycle.visible()).toBe(false);
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(lifecycle.visible()).toBe(true);
  });

  it('DET-017 battery saver is not detectable on the web', () => {
    expect(new WebAppLifecycle(IDLE_MS, fakeEnv().env).batterySaver()).toBeNull();
  });

  it('DET-017 onPause fires when hidden or on pagehide and stops after unsubscribe', () => {
    const { env, doc, win } = fakeEnv();
    const lifecycle = new WebAppLifecycle(IDLE_MS, env);
    const calls: string[] = [];
    const off = lifecycle.onPause(() => void calls.push('pause'));
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    win.dispatchEvent(new Event('pagehide'));
    expect(calls).toEqual(['pause', 'pause']);
    off();
    win.dispatchEvent(new Event('pagehide'));
    expect(calls).toHaveLength(2);
  });
});
