import { InjectionToken } from '@angular/core';

/** Time source for state services; tests inject a manual clock. */
export interface Clock {
  now(): number;
  /** Runs `fn` once after `ms`; the returned function cancels it. */
  schedule(ms: number, fn: () => void): () => void;
}

export const CLOCK = new InjectionToken<Clock>('Clock', {
  providedIn: 'root',
  factory: () => ({
    now: () => Date.now(),
    schedule: (ms, fn) => {
      const handle = setTimeout(fn, ms);
      return () => clearTimeout(handle);
    },
  }),
});
