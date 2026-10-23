/** Port AppLifecycle (first used in M10, M15). */
import { InjectionToken, type Signal } from '@angular/core';

export interface AppLifecycle {
  /** False while the app/page is hidden or in the background. */
  readonly visible: Signal<boolean>;
  /** True from the last pointer, touch, key or wheel event until `idleMs` (constructor argument) later (DET-017). */
  readonly userActive: Signal<boolean>;
  /** True under battery saver, false when off, null when not detectable on this platform. */
  readonly batterySaver: Signal<boolean | null>;
  /** Called when the app is about to be hidden/paused (save trigger). Returns an unsubscribe function. */
  onPause(callback: () => void | Promise<void>): () => void;
}

export const APP_LIFECYCLE = new InjectionToken<AppLifecycle>('AppLifecycle');
