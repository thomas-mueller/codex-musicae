import { Injectable, inject } from '@angular/core';

import { FULLSCREEN } from '../ports/fullscreen';
import { WAKE_LOCK } from '../ports/wake-lock';

/**
 * PLT-004, PLT-005: true fullscreen and wake lock around presentation mode. Browsers demand a user gesture, so `enter()` is
 * called synchronously from `UiStore.setMode` inside the click or key event, never from an effect or after an await.
 * Failures are ignored on purpose: presentation mode opens either way.
 */
@Injectable({ providedIn: 'root' })
export class PresentationPlatform {
  private readonly fullscreen = inject(FULLSCREEN, { optional: true });
  private readonly wakeLock = inject(WAKE_LOCK, { optional: true });

  enter(): void {
    void this.fullscreen?.enter();
    void this.wakeLock?.acquire();
  }

  leave(): void {
    void this.fullscreen?.exit();
    void this.wakeLock?.release();
  }

  /** Fires when the platform leaves fullscreen on its own (Esc, system gesture). */
  onExternalExit(callback: () => void): () => void {
    return this.fullscreen?.onExternalExit(callback) ?? (() => undefined);
  }
}
