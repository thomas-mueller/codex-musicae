/**
 * core/aspect-ratio — slide aspect-ratio steps. Requirements: SLD-013, SLD-014, SLD-016 (orientation).
 * Aspect ratio r = width / height. A LOWER value means a TALLER slide ("show more"), a HIGHER value a wider one ("show less").
 */

export interface AspectRatioLimits {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface InitialRatioConfig {
  readonly min: number;
  readonly max: number;
  readonly roundDecimals: number;
}

export type Orientation = 'portrait' | 'landscape';

/**
 * Moves to the next round multiple of `step` strictly below (`more`) or strictly above (`less`) `current`,
 * then clamps to [min, max]. Floating-point noise must not matter: 1.7 is a multiple of 0.1 (tolerance 1e-9).
 * Values outside [min, max] first move as described, then are clamped.
 * Results are rounded to 10 decimals so that 1.7 is returned as exactly 1.7.
 */
export function stepAspectRatio(
  _current: number,
  _direction: 'more' | 'less',
  _limits: AspectRatioLimits,
): number {
  throw new Error('not implemented');
}

/** width / height rounded to `roundDecimals` decimals, clamped to [min, max]. */
export function initialAspectRatio(
  _viewportWidth: number,
  _viewportHeight: number,
  _config: InitialRatioConfig,
): number {
  throw new Error('not implemented');
}

/** 'landscape' if width >= height, else 'portrait'. */
export function orientationOf(_width: number, _height: number): Orientation {
  throw new Error('not implemented');
}
