import { TUNABLES } from '../../config/tunables';
import { WHEEL_INITIAL, wheelStep } from '../core';
import type { WheelState } from '../core';
import type { Command, Point } from './command-bus';
import type { Mode } from '../state/ui.store';

/** The parts of a `WheelEvent` the mapping looks at; `t` is `event.timeStamp`. */
export interface WheelLike {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly t: number;
}

export interface WheelContext {
  readonly mode: Mode;
  readonly zoomed: boolean;
  /** Pointer position relative to the stage. */
  readonly anchor: Point;
}

export interface WheelResult {
  readonly command: Command | null;
  readonly preventDefault: boolean;
}

const NATIVE: WheelResult = { command: null, preventDefault: false };
const SWALLOWED: WheelResult = { command: null, preventDefault: true };

/** NAV-011..NAV-013, NAV-017: wheel and trackpad pinch (arrives as Ctrl+wheel) become commands. Holds the step state. */
export class WheelInput {
  private state: WheelState = WHEEL_INITIAL;

  handle(event: WheelLike, context: WheelContext): WheelResult {
    const wheel = TUNABLES.gestures.wheel;
    const unit = event.deltaMode === 1 ? wheel.lineHeightPx : event.deltaMode === 2 ? wheel.pageHeightPx : 1;
    if (event.ctrlKey) {
      if (context.mode === 'presentation') {
        return SWALLOWED; // the browser page zoom must not trigger either
      }
      return { command: { type: 'ZoomBy', factor: Math.exp(-event.deltaY * unit * wheel.zoomSensitivity), anchor: context.anchor }, preventDefault: true };
    }
    if (context.mode === 'organization') {
      return NATIVE;
    }
    if (context.zoomed) {
      const dx = event.shiftKey ? event.deltaX || event.deltaY : event.deltaX;
      const dy = event.shiftKey ? 0 : event.deltaY;
      return { command: { type: 'Pan', dx: 0 - dx * unit, dy: 0 - dy * unit }, preventDefault: true };
    }
    const mode = event.deltaMode === 1 || event.deltaMode === 2 ? event.deltaMode : 0;
    const result = wheelStep(this.state, { deltaY: event.deltaY, deltaMode: mode, t: event.t }, wheel);
    this.state = result.state;
    return { command: result.step === 0 ? null : { type: result.step === 1 ? 'Next' : 'Previous' }, preventDefault: true };
  }
}
