/**
 * core/palm — palm rejection state for stylus use (M19). Requirement: STY-004.
 */

export interface PenState {
  /** The pen is in contact or hovering. */
  readonly active: boolean;
  /** Time of the last pen event (ms). */
  readonly lastT: number;
}

export const PEN_INITIAL: PenState = { active: false, lastT: -1e12 };

export type PenEvent =
  | { readonly type: 'pen-down' | 'pen-move' | 'pen-hover'; readonly t: number }
  | { readonly type: 'pen-up' | 'pen-leave' | 'pen-cancel'; readonly t: number };

/** down/move/hover -> active = true, lastT = t; up/leave/cancel -> active = false, lastT = t. */
export function reducePen(_state: PenState, _event: PenEvent): PenState {
  throw new Error('not implemented');
}

/** A touch is ignored while the pen is active, and for `graceMs` after its last event: active || now - lastT <= graceMs. */
export function shouldIgnoreTouch(_pen: PenState, _now: number, _graceMs: number): boolean {
  throw new Error('not implemented');
}
