import { signal } from '@angular/core';

import { err, ok } from '../../ports/result';
import type { Result } from '../../ports/result';
import type { Fullscreen, FullscreenError } from '../../ports/fullscreen';

/** The `webkit`-prefixed members older Safari versions expose. */
interface FullscreenElementLike {
  requestFullscreen?: (options?: { navigationUI: 'hide' }) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface FullscreenDocumentLike extends EventTarget {
  readonly fullscreenElement?: Element | null;
  readonly webkitFullscreenElement?: Element | null;
  readonly documentElement: FullscreenElementLike;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void> | void;
}

const CHANGE_EVENTS = ['fullscreenchange', 'webkitfullscreenchange'] as const;

/**
 * PLT-004: browser fullscreen. `enter()` must be called synchronously inside a user gesture.
 * Where no API exists (iPhone Safari) it returns `unsupported` and only the app UI is hidden.
 */
export class WebFullscreen implements Fullscreen {
  private readonly activeSignal = signal(false);
  private readonly callbacks = new Set<() => void>();
  private ownExit = false;

  private readonly lastErrorSignal = signal<string | null>(null);

  readonly active = this.activeSignal.asReadonly();
  readonly lastError = this.lastErrorSignal.asReadonly();

  constructor(private readonly doc: FullscreenDocumentLike = document) {
    for (const name of CHANGE_EVENTS) {
      doc.addEventListener(name, () => this.onChange());
    }
  }

  /**
   * Fallback chain (PLT-016): standard request with `navigationUI: 'hide'`, the same without options (some Chromium/Edge
   * builds and policies reject the dictionary), then the `webkit`-prefixed method. Every step starts inside the original
   * gesture's transient activation (a rejection settles within a microtask). The last failure name goes into `lastError`.
   */
  async enter(): Promise<Result<void, FullscreenError>> {
    const element = this.doc.documentElement;
    const attempts: (() => Promise<void> | void)[] = [];
    if (element.requestFullscreen) {
      attempts.push(() => element.requestFullscreen?.({ navigationUI: 'hide' }));
      attempts.push(() => (element.requestFullscreen as () => Promise<void>)());
    }
    if (element.webkitRequestFullscreen) {
      attempts.push(() => element.webkitRequestFullscreen?.());
    }
    if (attempts.length === 0) {
      return err('unsupported');
    }
    let detail = '';
    this.lastErrorSignal.set(null);
    for (const attempt of attempts) {
      try {
        await attempt();
        this.sync();
        return ok(undefined);
      } catch (error) {
        detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      }
    }
    this.lastErrorSignal.set(detail);
    return err('denied');
  }

  async exit(): Promise<void> {
    // The event may lag behind the request, so the document itself decides, not the signal.
    if (!this.isFullscreen()) {
      return;
    }
    this.ownExit = true;
    try {
      await (this.doc.exitFullscreen?.() ?? this.doc.webkitExitFullscreen?.());
    } catch {
      // Already left: nothing to do.
    }
    if (!this.isFullscreen() && this.activeSignal()) {
      this.sync();
    }
    // A late or missing event must not turn the next Esc into an "own" exit.
    this.ownExit = false;
  }

  onExternalExit(callback: () => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private isFullscreen(): boolean {
    return (this.doc.fullscreenElement ?? this.doc.webkitFullscreenElement ?? null) !== null;
  }

  /** Brings `active` in line with the document without waiting for the change event. */
  private sync(): void {
    this.activeSignal.set(this.isFullscreen());
  }

  private onChange(): void {
    const was = this.activeSignal();
    const now = this.isFullscreen();
    this.activeSignal.set(now);
    if (was && !now) {
      const own = this.ownExit;
      this.ownExit = false;
      if (!own) {
        for (const callback of this.callbacks) {
          callback();
        }
      }
    }
  }
}
