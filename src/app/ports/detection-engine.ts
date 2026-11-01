/** Port DetectionEngine (first used in M10). Implementation: OpenCV.js in a worker. */
import { InjectionToken } from '@angular/core';
import type { ConnectedComponent } from '../core/system-selection';
import type { Result } from './result';

export type DetectionError = 'cancelled' | 'out-of-memory' | 'unknown';

/** The adaptive threshold of a level (`T:detection.levels`). */
export interface ExtractionParams {
  readonly blockSize: number;
  readonly c: number;
}

/** The connected components of one bitmap and the size of that bitmap (needed to normalize them). */
export interface ComponentSet {
  readonly width: number;
  readonly height: number;
  readonly components: readonly ConnectedComponent[];
}

export interface DetectionEngine {
  /**
   * Binarizes `bitmap` with the adaptive mean threshold (ink = foreground) and returns the bounding rectangle (BITMAP PIXELS)
   * and pixel area of every 4-connected component, WITHOUT the background component. DET-004.
   * The bitmap is transferred to the worker and closed there. Every OpenCV object is freed in `finally`.
   */
  extractComponents(bitmap: ImageBitmap, signal: AbortSignal, params: ExtractionParams): Promise<Result<ComponentSet, DetectionError>>;
}

export const DETECTION_ENGINE = new InjectionToken<DetectionEngine>('DetectionEngine');
