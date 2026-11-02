/**
 * core/autosave — when to save. Requirements: SAV-008, SAV-009, FIL-010.
 * Pure reducer + decision; timers and the actual save live in `state/`.
 */

export interface SaveState {
  /** There are changes not yet written. */
  readonly dirty: boolean;
  /** Time of the last change (ms). */
  readonly lastChangeT: number;
  readonly strokeInProgress: boolean;
  /** A save is running. */
  readonly saving: boolean;
  /** A forced trigger (tab switch, close, hidden) is pending. */
  readonly forced: boolean;
  /** The last save failed; no automatic retry until a new change or a forced trigger. */
  readonly failed: boolean;
}

export const SAVE_INITIAL: SaveState = {
  dirty: false,
  lastChangeT: 0,
  strokeInProgress: false,
  saving: false,
  forced: false,
  failed: false,
};

export type SaveEvent =
  | { readonly type: 'change'; readonly t: number }
  | { readonly type: 'strokeStart' }
  | { readonly type: 'strokeEnd'; readonly t: number }
  | { readonly type: 'force' }
  | { readonly type: 'saveStarted' }
  | { readonly type: 'saveFinished'; readonly ok: boolean; readonly t: number };

/**
 *  change:       dirty = true, lastChangeT = t, failed = false
 *  strokeStart:  strokeInProgress = true
 *  strokeEnd:    strokeInProgress = false, dirty = true, lastChangeT = t, failed = false
 *  force:        forced = true (failed is cleared)
 *  saveStarted:  saving = true, dirty = false, forced = false
 *  saveFinished: saving = false; ok -> unchanged otherwise; !ok -> dirty = true, failed = true
 * (A change during a running save sets dirty again, so a further save follows.)
 */
export function reduceSave(state: SaveState, event: SaveEvent): SaveState {
  switch (event.type) {
    case 'change':
      return { ...state, dirty: true, lastChangeT: event.t, failed: false };
    case 'strokeStart':
      return { ...state, strokeInProgress: true };
    case 'strokeEnd':
      return { ...state, strokeInProgress: false, dirty: true, lastChangeT: event.t, failed: false };
    case 'force':
      return { ...state, forced: true, failed: false };
    case 'saveStarted':
      return { ...state, saving: true, dirty: false, forced: false };
    case 'saveFinished':
      return event.ok ? { ...state, saving: false } : { ...state, saving: false, dirty: true, failed: true };
  }
}

export type SaveDecision =
  | { readonly action: 'save' }
  | { readonly action: 'wait'; readonly until: number }
  | { readonly action: 'none' };

/**
 * Evaluated after every event and when a timer fires:
 *  - not dirty -> none;  saving -> none (re-evaluated after saveFinished);  strokeInProgress -> none (never save during a stroke)
 *  - forced -> save
 *  - failed -> none
 *  - now - lastChangeT >= idleMs -> save;  otherwise wait until lastChangeT + idleMs
 */
export function saveDecision(state: SaveState, now: number, idleMs: number): SaveDecision {
  if (!state.dirty || state.saving || state.strokeInProgress) {
    return { action: 'none' };
  }
  if (state.forced) {
    return { action: 'save' };
  }
  if (state.failed) {
    return { action: 'none' };
  }
  const until = state.lastChangeT + idleMs;
  return now >= until ? { action: 'save' } : { action: 'wait', until };
}
