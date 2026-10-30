/**
 * core/aspect-ratio — slide aspect-ratio steps. Requirements: SLD-013, SLD-014, SLD-016 (orientation).
 * Aspect ratio r = width / height. A LOWER value means a TALLER slide ("show more"), a HIGHER value a wider one ("show less").
 */

const STEP_EPSILON = 1e-9;
const ROUND_FACTOR = 1e10;
const DECIMAL_BASE = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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
  current: number,
  direction: 'more' | 'less',
  limits: AspectRatioLimits,
): number {
  const q = current / limits.step;
  const index = direction === 'more' ? Math.ceil(q - STEP_EPSILON) - 1 : Math.floor(q + STEP_EPSILON) + 1;
  const value = Math.round(index * limits.step * ROUND_FACTOR) / ROUND_FACTOR;
  return clamp(value, limits.min, limits.max);
}

/** width / height rounded to `roundDecimals` decimals, clamped to [min, max]. */
export function initialAspectRatio(
  viewportWidth: number,
  viewportHeight: number,
  config: InitialRatioConfig,
): number {
  const factor = DECIMAL_BASE ** config.roundDecimals;
  return clamp(Math.round((viewportWidth / viewportHeight) * factor) / factor, config.min, config.max);
}

/** 'landscape' if width >= height, else 'portrait'. */
export function orientationOf(width: number, height: number): Orientation {
  return width >= height ? 'landscape' : 'portrait';
}
