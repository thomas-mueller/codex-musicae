/**
 * core/gestures — pure recognizers and input policy. Requirements: NAV-006..NAV-017, ARC-006, ANN-008.
 * Time in milliseconds, distances in CSS pixels. No DOM types here: the input layer converts events to these plain values.
 */

export type Mode = 'organization' | 'annotation' | 'presentation';

export interface PointerSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

export interface GestureLimits {
  readonly tapMaxDurationMs: number;
  readonly tapMaxMovePx: number;
  readonly swipeMinDistanceFraction: number;
  readonly swipeMaxAngleDeg: number;
  readonly swipeMinVelocityPxPerMs: number;
}

export type TrackClass = 'tap' | 'swipe-left' | 'swipe-right' | 'none';

/**
 * Classifies the complete track of ONE pointer (first sample = down, last = up).
 *  - empty track -> 'none'
 *  - duration = last.t - first.t; maxMove = largest distance of any sample from the first sample
 *  - 'tap' if duration <= tapMaxDurationMs AND maxMove <= tapMaxMovePx
 *  - otherwise dx, dy = last - first;
 *      |dx| < swipeMinDistanceFraction * viewportWidth -> 'none'
 *      angle = atan2(|dy|, |dx|) in degrees > swipeMaxAngleDeg -> 'none'
 *      velocity = duration > 0 ? |dx| / duration : Infinity;  velocity < swipeMinVelocityPxPerMs -> 'none'
 *      dx < 0 -> 'swipe-left' (next), dx > 0 -> 'swipe-right' (previous)
 * Limits are inclusive for tap (<=) and for swipe thresholds (>=).
 */
export function classifyTrack(
  _track: readonly PointerSample[],
  _viewportWidth: number,
  _limits: GestureLimits,
): TrackClass {
  throw new Error('not implemented');
}

export type TapZone = 'left' | 'center' | 'right';

/** left if x / width < zones.left; right if x / width >= zones.left + zones.center; else center. */
export function tapZoneOf(
  _x: number,
  _viewportWidth: number,
  _zones: { readonly left: number; readonly center: number; readonly right: number },
): TapZone {
  throw new Error('not implemented');
}

/** Second tap follows the first within intervalMs (0 <= b.t - a.t <= intervalMs) and within distancePx. */
export function isDoubleTap(
  _a: PointerSample,
  _b: PointerSample,
  _limits: { readonly intervalMs: number; readonly distancePx: number },
): boolean {
  throw new Error('not implemented');
}

// ---------------------------------------------------------------- wheel

export interface WheelConfig {
  readonly stepThresholdPx: number;
  readonly idleResetMs: number;
  readonly cooldownMs: number;
  readonly lineHeightPx: number;
  readonly pageHeightPx: number;
}

export interface WheelState {
  readonly accum: number;
  /** Time of the previous wheel event. */
  readonly lastT: number;
  /** Time of the last step while locked, else null. */
  readonly stepT: number | null;
}

export const WHEEL_INITIAL: WheelState = { accum: 0, lastT: -1e12, stepT: null };

export interface WheelEventInput {
  readonly deltaY: number;
  /** DOM deltaMode: 0 = pixels, 1 = lines, 2 = pages. */
  readonly deltaMode: 0 | 1 | 2;
  readonly t: number;
}

/**
 * NAV-011. d = deltaY * (1 | lineHeightPx | pageHeightPx) by deltaMode.
 *  1. If locked (stepT !== null): unlocked only if (e.t - lastT >= idleResetMs) AND (e.t - stepT >= cooldownMs).
 *     While locked: return step 0 with state { accum: 0, lastT: e.t, stepT } (same stepT).
 *     When unlocked: continue below with accum = 0 (a new gesture).
 *  2. If not locked and e.t - lastT >= idleResetMs: accum = 0 (a new gesture; stale accumulation is dropped).
 *  3. accum += d. If |accum| >= stepThresholdPx: return step = sign(accum) (+1 = next, -1 = previous)
 *     with state { accum: 0, lastT: e.t, stepT: e.t }.
 *  4. Otherwise step 0 with state { accum, lastT: e.t, stepT: null }.
 */
export function wheelStep(
  _state: WheelState,
  _event: WheelEventInput,
  _config: WheelConfig,
): { state: WheelState; step: -1 | 0 | 1 } {
  throw new Error('not implemented');
}

// ---------------------------------------------------------------- policy (ARC-006)

export interface PointerContext {
  readonly mode: Mode;
  readonly toolActive: boolean;
  readonly pointerCount: number;
  /** True when zoom > fit (zoom > 1 + 1e-6). */
  readonly zoomed: boolean;
  /** Stylus rules (M19). In v1 the input layer always passes false for both. */
  readonly stylusSeen: boolean;
  readonly allowFingerDrawing: boolean;
  readonly pointerType: 'touch' | 'mouse' | 'pen';
}

export type PointerRole = 'draw' | 'gestures' | 'pinch' | 'org-select' | 'none';

export interface PointerPolicy {
  readonly role: PointerRole;
  /** One-finger/pointer panning of the zoomed content. */
  readonly pan: boolean;
  readonly tapZones: boolean;
  readonly swipes: boolean;
}

/**
 * Decides what a pointer does (the single place for this decision):
 *  presentation: pointerCount 1 -> { gestures, pan false, tapZones true, swipes true }; otherwise { none, false, false, false }
 *  organization: pointerCount 1 -> { org-select, pan true, tapZones false, swipes false };
 *                pointerCount >= 2 -> { pinch, pan true, false, false }
 *  annotation:   pointerCount >= 2 -> { pinch, pan true, false, false }
 *                pointerCount 1:
 *                  toolActive and NOT (stylusSeen && !allowFingerDrawing && pointerType === 'touch')
 *                      -> { draw, pan false, tapZones false, swipes false }
 *                  otherwise -> { gestures, pan = zoomed, tapZones true, swipes = !zoomed }
 *                  (toolActive with the stylus exception gives the same 'gestures' result)
 *  pointerCount 0 -> { none, false, false, false } in every mode.
 */
export function pointerPolicy(_ctx: PointerContext): PointerPolicy {
  throw new Error('not implemented');
}
