/**
 * core/gestures — pure recognizers and input policy. Requirements: NAV-006..NAV-017, ARC-006, ANN-008.
 * Time in milliseconds, distances in CSS pixels. No DOM types here: the input layer converts events to these plain values.
 */

const HALF_TURN_DEG = 180;

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
  track: readonly PointerSample[],
  viewportWidth: number,
  limits: GestureLimits,
): TrackClass {
  const first = track[0];
  const last = track[track.length - 1];
  if (first === undefined || last === undefined) {
    return 'none';
  }
  const duration = last.t - first.t;
  let maxMove = 0;
  for (const sample of track) {
    maxMove = Math.max(maxMove, Math.hypot(sample.x - first.x, sample.y - first.y));
  }
  if (duration <= limits.tapMaxDurationMs && maxMove <= limits.tapMaxMovePx) {
    return 'tap';
  }
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  if (Math.abs(dx) < limits.swipeMinDistanceFraction * viewportWidth) {
    return 'none';
  }
  if ((Math.atan2(Math.abs(dy), Math.abs(dx)) * HALF_TURN_DEG) / Math.PI > limits.swipeMaxAngleDeg) {
    return 'none';
  }
  const velocity = duration > 0 ? Math.abs(dx) / duration : Infinity;
  if (velocity < limits.swipeMinVelocityPxPerMs) {
    return 'none';
  }
  return dx < 0 ? 'swipe-left' : 'swipe-right';
}

export type TapZone = 'left' | 'center' | 'right';

/** left if x / width < zones.left; right if x / width >= zones.left + zones.center; else center. */
export function tapZoneOf(
  x: number,
  viewportWidth: number,
  zones: { readonly left: number; readonly center: number; readonly right: number },
): TapZone {
  const fraction = x / viewportWidth;
  if (fraction < zones.left) {
    return 'left';
  }
  return fraction >= zones.left + zones.center ? 'right' : 'center';
}

/** Second tap follows the first within intervalMs (0 <= b.t - a.t <= intervalMs) and within distancePx. */
export function isDoubleTap(
  a: PointerSample,
  b: PointerSample,
  limits: { readonly intervalMs: number; readonly distancePx: number },
): boolean {
  const dt = b.t - a.t;
  return dt >= 0 && dt <= limits.intervalMs && Math.hypot(b.x - a.x, b.y - a.y) <= limits.distancePx;
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
  state: WheelState,
  event: WheelEventInput,
  config: WheelConfig,
): { state: WheelState; step: -1 | 0 | 1 } {
  const unit = event.deltaMode === 1 ? config.lineHeightPx : event.deltaMode === 2 ? config.pageHeightPx : 1;
  const d = event.deltaY * unit;
  let accum = state.accum;
  if (state.stepT !== null) {
    const unlocked = event.t - state.lastT >= config.idleResetMs && event.t - state.stepT >= config.cooldownMs;
    if (!unlocked) {
      return { state: { accum: 0, lastT: event.t, stepT: state.stepT }, step: 0 };
    }
    accum = 0;
  } else if (event.t - state.lastT >= config.idleResetMs) {
    accum = 0;
  }
  accum += d;
  if (Math.abs(accum) >= config.stepThresholdPx) {
    return { state: { accum: 0, lastT: event.t, stepT: event.t }, step: accum > 0 ? 1 : -1 };
  }
  return { state: { accum, lastT: event.t, stepT: null }, step: 0 };
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
export function pointerPolicy(ctx: PointerContext): PointerPolicy {
  const none: PointerPolicy = { role: 'none', pan: false, tapZones: false, swipes: false };
  if (ctx.pointerCount <= 0) {
    return none;
  }
  if (ctx.mode === 'presentation') {
    return ctx.pointerCount === 1 ? { role: 'gestures', pan: false, tapZones: true, swipes: true } : none;
  }
  if (ctx.pointerCount >= 2) {
    return { role: 'pinch', pan: true, tapZones: false, swipes: false };
  }
  if (ctx.mode === 'organization') {
    return { role: 'org-select', pan: true, tapZones: false, swipes: false };
  }
  const stylusBlocksTouch = ctx.stylusSeen && !ctx.allowFingerDrawing && ctx.pointerType === 'touch';
  if (ctx.toolActive && !stylusBlocksTouch) {
    return { role: 'draw', pan: false, tapZones: false, swipes: false };
  }
  return { role: 'gestures', pan: ctx.zoomed, tapZones: true, swipes: !ctx.zoomed };
}
