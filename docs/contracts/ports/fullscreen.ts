/** Port Fullscreen (M16). Web: Fullscreen API. Android: sticky immersive mode drawing under cutouts. */
import { InjectionToken, type Signal } from '@angular/core';
import type { Result } from './result';

export type FullscreenError = 'unsupported' | 'denied';

export interface Fullscreen {
  /** True while true fullscreen is active. */
  readonly active: Signal<boolean>;
  /** Name of the last failure of `enter()` for developer diagnostics (PLT-016); never shown in the UI. */
  readonly lastError?: Signal<string | null>;
  enter(): Promise<Result<void, FullscreenError>>;
  exit(): Promise<void>;
  /** Called when the platform leaves fullscreen on its own (Esc, system gesture). Returns an unsubscribe function. */
  onExternalExit(callback: () => void): () => void;
}

export const FULLSCREEN = new InjectionToken<Fullscreen>('Fullscreen');
