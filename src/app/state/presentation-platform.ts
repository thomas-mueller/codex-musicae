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

  private presenting = false;
  private retryPending = false;

  enter(): void {
    this.presenting = true;
    this.retryPending = false;
    this.request(true);
    void this.wakeLock?.acquire();
  }

  leave(): void {
    this.presenting = false;
    this.retryPending = false;
    void this.fullscreen?.exit();
    void this.wakeLock?.release();
  }

  /**
   * PLT-016: when the entry request was denied (the gesture was spent or the browser refused), the next user gesture in
   * presentation mode asks once more. Called synchronously from the command handler, i.e. inside that gesture. Never
   * after an external exit (Esc): that does not set the flag.
   */
  retryEnter(): void {
    if (this.presenting && this.retryPending) {
      this.retryPending = false;
      this.request(false);
    }
  }

  private request(armRetry: boolean): void {
    void this.fullscreen?.enter().then((result) => {
      if (result.ok || result.error !== 'denied') {
        return;
      }
      // PLT-016: the reason goes to the developer console only; the UI shows no text.
      // eslint-disable-next-line no-console
      console.warn('fullscreen denied', this.fullscreen?.lastError?.() ?? '');
      this.retryPending = armRetry && this.presenting;
    });
  }

  /** Fires when the platform leaves fullscreen on its own (Esc, system gesture). */
  onExternalExit(callback: () => void): () => void {
    return this.fullscreen?.onExternalExit(callback) ?? (() => undefined);
  }
}
