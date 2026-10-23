/** Port BackButton (M16). Android back button/gesture. Handlers run highest priority first. */
import { InjectionToken } from '@angular/core';

export interface BackButton {
  /** `handler` returns true if it handled the event (stops propagation). Returns an unregister function. */
  register(priority: number, handler: () => boolean): () => void;
}

export const BACK_BUTTON = new InjectionToken<BackButton>('BackButton');
