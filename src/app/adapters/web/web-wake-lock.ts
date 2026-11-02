import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';
import type { WakeLock, WakeLockError } from '../../ports/wake-lock';

export interface WakeLockSentinelLike {
  readonly released: boolean;
  release(): Promise<void>;
}

/** What the adapter needs from the browser (lets unit tests inject fakes). */
export interface WakeLockEnv {
  readonly document: EventTarget & { readonly visibilityState: string };
  readonly wakeLock: { request(type: 'screen'): Promise<WakeLockSentinelLike> } | undefined;
}

function browserEnv(): WakeLockEnv {
  return { document, wakeLock: (navigator as { wakeLock?: WakeLockEnv['wakeLock'] }).wakeLock };
}

/**
 * PLT-005: Screen Wake Lock. The browser drops the lock when the page is hidden, so it is requested again when the page
 * becomes visible while the lock is still wanted.
 */
export class WebWakeLock implements WakeLock {
  private sentinel: WakeLockSentinelLike | null = null;
  private wanted = false;

  constructor(private readonly env: WakeLockEnv = browserEnv()) {
    env.document.addEventListener('visibilitychange', () => {
      if (this.wanted && env.document.visibilityState === 'visible' && (this.sentinel === null || this.sentinel.released)) {
        void this.request();
      }
    });
  }

  async acquire(): Promise<Result<void, WakeLockError>> {
    if (!this.env.wakeLock) {
      return err('unsupported');
    }
    this.wanted = true;
    return this.request();
  }

  async release(): Promise<void> {
    this.wanted = false;
    const sentinel = this.sentinel;
    this.sentinel = null;
    try {
      await sentinel?.release();
    } catch {
      // Already released by the browser.
    }
  }

  private async request(): Promise<Result<void, WakeLockError>> {
    try {
      const sentinel = await this.env.wakeLock!.request('screen');
      if (!this.wanted) {
        // Released while the request was pending.
        await sentinel.release();
        return ok(undefined);
      }
      this.sentinel = sentinel;
      return ok(undefined);
    } catch {
      return err('denied');
    }
  }
}
