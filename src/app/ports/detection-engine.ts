/** Port DetectionEngine (first used in M10). Implementation: OpenCV.js in a worker. */
import { InjectionToken } from '@angular/core';
import type { Rect } from '../core/geometry';
import type { Result } from './result';

export type DetectionError = 'cancelled' | 'out-of-memory' | 'unknown';

export interface DetectionEngine {
  /**
   * Binarizes `bitmap` (Otsu, ink = foreground) and returns the bounding rectangle of every connected component
   * in BITMAP PIXELS, including the background component (label 0), which spans the whole page.
   * The bitmap is transferred to the worker and closed there. Every OpenCV object is freed in `finally`.
   */
  extractComponents(bitmap: ImageBitmap, signal: AbortSignal): Promise<Result<readonly Rect[], DetectionError>>;
}

export const DETECTION_ENGINE = new InjectionToken<DetectionEngine>('DetectionEngine');
