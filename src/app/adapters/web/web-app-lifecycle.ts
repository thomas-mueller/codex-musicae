import { signal } from '@angular/core';

import { TUNABLES } from '../../../config/tunables';
import type { AppLifecycle } from '../../ports/app-lifecycle';

/** What the adapter needs from the browser (lets unit tests inject fakes). */
export interface LifecycleEnv {
  readonly document: EventTarget & { readonly visibilityState: string };
  readonly window: EventTarget;
  readonly clock: { schedule(ms: number, fn: () => void): () => void };
}

const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart'] as const;

function browserEnv(): LifecycleEnv {
  return {
    document,
    window,
    clock: { schedule: (ms, fn) => { const h = setTimeout(fn, ms); return () => clearTimeout(h); } },
  };
}

/**
 * DET-017: visibility, user activity and (where detectable) battery saver for the scheduler.
 * UNVERIFIED battery saver: browsers expose no battery-saver flag (`navigator.getBattery` only reports level and
 * charging), so `batterySaver` stays null on the web; a native adapter can supply it.
 */
export class WebAppLifecycle implements AppLifecycle {
  private readonly visibleSignal = signal(true);
  private readonly activeSignal = signal(false);
  private readonly pauseCallbacks = new Set<() => void | Promise<void>>();
  private cancelIdle: (() => void) | null = null;

  readonly visible = this.visibleSignal.asReadonly();
  readonly userActive = this.activeSignal.asReadonly();
  readonly batterySaver = signal<boolean | null>(null).asReadonly();

  constructor(
    private readonly idleMs: number = TUNABLES.detection.idleBeforeResumeMs,
    private readonly env: LifecycleEnv = browserEnv(),
  ) {
    this.visibleSignal.set(env.document.visibilityState !== 'hidden');
    for (const name of ACTIVITY_EVENTS) {
      env.window.addEventListener(name, () => this.markActive(), { passive: true });
    }
    env.document.addEventListener('visibilitychange', () => {
      const hidden = env.document.visibilityState === 'hidden';
      this.visibleSignal.set(!hidden);
      if (hidden) {
        this.firePause();
      }
    });
    env.window.addEventListener('pagehide', () => this.firePause());
  }

  onPause(callback: () => void | Promise<void>): () => void {
    this.pauseCallbacks.add(callback);
    return () => this.pauseCallbacks.delete(callback);
  }

  private markActive(): void {
    this.activeSignal.set(true);
    this.cancelIdle?.();
    this.cancelIdle = this.env.clock.schedule(this.idleMs, () => {
      this.cancelIdle = null;
      this.activeSignal.set(false);
    });
  }

  private firePause(): void {
    for (const callback of this.pauseCallbacks) {
      void callback();
    }
  }
}
