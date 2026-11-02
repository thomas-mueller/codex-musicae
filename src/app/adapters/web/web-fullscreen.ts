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

  readonly active = this.activeSignal.asReadonly();

  constructor(private readonly doc: FullscreenDocumentLike = document) {
    for (const name of CHANGE_EVENTS) {
      doc.addEventListener(name, () => this.onChange());
    }
  }

  enter(): Promise<Result<void, FullscreenError>> {
    const element = this.doc.documentElement;
    try {
      if (element.requestFullscreen) {
        return element.requestFullscreen({ navigationUI: 'hide' }).then(() => ok(undefined), () => err('denied'));
      }
      if (element.webkitRequestFullscreen) {
        return Promise.resolve(element.webkitRequestFullscreen()).then(() => ok(undefined), () => err('denied'));
      }
    } catch {
      return Promise.resolve(err('denied'));
    }
    return Promise.resolve(err('unsupported'));
  }

  async exit(): Promise<void> {
    if (!this.activeSignal()) {
      return;
    }
    this.ownExit = true;
    try {
      await (this.doc.exitFullscreen?.() ?? this.doc.webkitExitFullscreen?.());
    } catch {
      // Already left: nothing to do.
    }
  }

  onExternalExit(callback: () => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private onChange(): void {
    const was = this.activeSignal();
    const now = (this.doc.fullscreenElement ?? this.doc.webkitFullscreenElement ?? null) !== null;
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
